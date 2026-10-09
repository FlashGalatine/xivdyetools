/**
 * /preferences Command Handler (V4)
 *
 * Unified settings management for user preferences.
 *
 * Subcommands:
 * - show: Display current preferences
 * - set: Set a preference value
 * - reset: Reset a preference to default
 *
 * REFACTOR-004: All user-facing strings now use i18n keys from locale files
 * instead of hardcoded English strings.
 *
 * @module handlers/commands/preferences
 */

import type { ExtendedLogger } from '@xivdyetools/logger';
import {
  deferredResponse,
  ephemeralResponse,
  errorEmbed,
  type InteractionResponseData,
} from '../../utils/response.js';
import { safeEditOriginalResponse } from '../../utils/discord-api.js';
import { markCommandOutcome, classifyError } from '../../services/command-trace.js';
import {
  getUserPreferences,
  getUserPreferencesStrict,
  setPreferences,
  resetPreference,
  getDefaultValue,
  getAffectedCommands,
  validatePreferenceValue,
} from '../../services/preferences.js';
import { validateWorld } from '../../services/budget/index.js';
import {
  BLENDING_MODES,
  MATCHING_METHODS,
  CLANS_BY_RACE,
  type PreferenceKey,
  type UserPreferences,
} from '../../types/preferences.js';
import type { DyeTypeFilters } from '@xivdyetools/types';
import { hasActiveFilters } from '@xivdyetools/core';
import { createUserTranslator, type Translator } from '../../services/bot-i18n.js';
import type { Env, DiscordInteraction } from '../../types/env.js';
import { BRAND_ACCENT, STATE } from '../../utils/brand.js';

// ============================================================================
// Constants
// ============================================================================

/** Preferences is the product speaking about itself — the accent. */
const PREFS_COLOR = BRAND_ACCENT;

/** Preference display order */
const PREFERENCE_ORDER: PreferenceKey[] = [
  'language',
  'blending',
  'matching',
  'count',
  'clan',
  'gender',
  'world',
  'market',
  'showHex',
  'showRgb',
  'showHsv',
  'showLab',
  'showDeltaE',
  'showAcquisition',
  'theme',
];

/** Emojis for preference categories */
const PREFERENCE_EMOJIS: Record<PreferenceKey, string> = {
  language: '🌐',
  blending: '🎨',
  matching: '🔍',
  count: '📊',
  clan: '👤',
  gender: '⚧️',
  world: '🌍',
  market: '💰',
  showHex: '#️⃣',
  showRgb: '🔴',
  showHsv: '🌈',
  showLab: '🧪',
  showDeltaE: '📐',
  showAcquisition: '🛒',
  theme: '🌙',
};

/**
 * Map snake_case Discord option names to camelCase PreferenceKey values.
 * Discord requires option names to be all lowercase, so display-option flags
 * are exposed as `show_hex` etc., but the underlying preference keys are camelCase.
 */
const OPTION_NAME_TO_KEY: Record<string, PreferenceKey> = {
  show_hex: 'showHex',
  show_rgb: 'showRgb',
  show_hsv: 'showHsv',
  show_lab: 'showLab',
  show_deltae: 'showDeltaE',
  show_acquisition: 'showAcquisition',
};

function resolveOptionKey(name: string): PreferenceKey {
  return OPTION_NAME_TO_KEY[name] ?? (name as PreferenceKey);
}

/**
 * Maps Discord option names to DyeTypeFilters keys. The display label is
 * `t.t(\`preferences.filters.labels.${option}\`)` (F-05, 2026-08-20 audit).
 */
const FILTER_OPTION_KEYS: Array<{ option: string; key: keyof DyeTypeFilters }> = [
  { option: 'metallic', key: 'excludeMetallic' },
  { option: 'pastel', key: 'excludePastel' },
  { option: 'dark', key: 'excludeDark' },
  { option: 'cosmic', key: 'excludeCosmic' },
  { option: 'ishgardian', key: 'excludeIshgardian' },
  { option: 'expensive', key: 'excludeExpensive' },
  { option: 'vendor', key: 'excludeVendorDyes' },
  { option: 'craft', key: 'excludeCraftDyes' },
];

/** Localized display label of a dye-type filter option. */
function filterLabel(t: Translator, option: string): string {
  return t.t(`preferences.filters.labels.${option}`);
}

/**
 * Read the preferences blob for a read-modify-write (BUG-048): `null` when
 * the read failed, so the caller answers with an error instead of writing a
 * blob rebuilt from nothing. The failure is marked on the trace here, so the
 * caller's error embed is never recorded as a success.
 */
async function readForUpdate(
  interaction: DiscordInteraction,
  env: Env,
  userId: string,
  logger?: ExtendedLogger
): Promise<UserPreferences | null> {
  try {
    return await getUserPreferencesStrict(env.KV, userId, logger);
  } catch (error) {
    markCommandOutcome(interaction, classifyError(error));
    if (logger) {
      logger.error(
        'Failed to read preferences for an update',
        error instanceof Error ? error : undefined
      );
    }
    return null;
  }
}

// ============================================================================
// Main Handler
// ============================================================================

/**
 * Handles the /preferences command
 *
 * Routes to appropriate subcommand handler based on interaction data.
 */
export async function handlePreferencesCommand(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext,
  logger?: ExtendedLogger
): Promise<Response> {
  const userId = interaction.member?.user?.id ?? interaction.user?.id ?? 'unknown';
  const t = await createUserTranslator(env.KV, userId, interaction.locale, logger);

  // Get subcommand from options
  const options = interaction.data?.options || [];
  const subcommandOption = options[0];

  if (!subcommandOption) {
    return ephemeralResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('preferences.errors.noSubcommand'))],
    });
  }

  const subcommand = subcommandOption.name;

  switch (subcommand) {
    case 'show':
      return handleShowSubcommand(env, userId, t, logger);

    case 'set':
      return handleSetSubcommand(
        interaction,
        env,
        ctx,
        userId,
        subcommandOption.options || [],
        t,
        logger
      );

    case 'reset':
      return handleResetSubcommand(
        interaction,
        env,
        userId,
        subcommandOption.options || [],
        t,
        logger
      );

    case 'filters': {
      // Subcommand group — filters set/show/reset
      const filterSubcommand = subcommandOption.options?.[0];
      if (!filterSubcommand) {
        return ephemeralResponse({
          embeds: [errorEmbed(t.t('common.error'), t.t('preferences.errors.noSubcommand'))],
        });
      }
      switch (filterSubcommand.name) {
        case 'set':
          return handleFiltersSetSubcommand(
            interaction,
            env,
            userId,
            filterSubcommand.options || [],
            t,
            logger
          );
        case 'show':
          return handleFiltersShowSubcommand(env, userId, t, logger);
        case 'reset':
          return handleFiltersResetSubcommand(interaction, env, userId, t, logger);
        default:
          return ephemeralResponse({
            embeds: [errorEmbed(t.t('common.error'), t.t('preferences.errors.noSubcommand'))],
          });
      }
    }

    default:
      return ephemeralResponse({
        embeds: [errorEmbed(t.t('common.error'), t.t('preferences.errors.noSubcommand'))],
      });
  }
}

// ============================================================================
// Show Subcommand
// ============================================================================

/**
 * Handles /preferences show
 *
 * Displays all current preferences with their values and defaults.
 */
async function handleShowSubcommand(
  env: Env,
  userId: string,
  t: Translator,
  logger?: ExtendedLogger
): Promise<Response> {
  const prefs = await getUserPreferences(env.KV, userId, logger);

  // Build fields for each preference
  const fields = PREFERENCE_ORDER.map((key) => {
    const emoji = PREFERENCE_EMOJIS[key];
    const label = t.t(`preferences.keys.${key}`);
    const currentValue = prefs[key];
    const defaultValue = getDefaultValue(key);

    // Format the display value
    let displayValue: string;
    if (currentValue !== undefined) {
      displayValue = formatPreferenceValue(key, currentValue, t);
    } else if (defaultValue !== undefined) {
      displayValue = `*${formatPreferenceValue(key, defaultValue, t)}* (${t.t('preferences.show.default').toLowerCase()})`;
    } else {
      displayValue = `*${t.t('preferences.show.notSet')}*`;
    }

    return {
      name: `${emoji} ${label}`,
      value: displayValue,
      inline: true,
    };
  });

  // Add dye filters summary field
  const dyeFilters = prefs.dyeFilters;
  if (dyeFilters && hasActiveFilters(dyeFilters)) {
    const activeFilters = FILTER_OPTION_KEYS
      .filter(({ key }) => dyeFilters[key])
      .map(({ option }) => filterLabel(t, option));
    fields.push({
      name: `🚫 ${t.t('preferences.keys.filters')}`,
      value: activeFilters.join(', '),
      inline: false,
    });
  } else {
    fields.push({
      name: `🚫 ${t.t('preferences.keys.filters')}`,
      value: `*${t.t('preferences.show.notSet')}*`,
      inline: false,
    });
  }

  // Last-updated: the embed `timestamp` is rendered by the Discord client in
  // the viewer's own locale and timezone, so no server-side date formatting
  // (F-05/F-08 — the old `toLocaleString()` ignored the user's locale).
  const footer = prefs.updatedAt
    ? { text: t.t('preferences.show.lastUpdated') }
    : { text: t.t('preferences.show.hint') };
  const timestamp = prefs.updatedAt ? new Date(prefs.updatedAt).toISOString() : undefined;

  return ephemeralResponse({
    embeds: [
      {
        title: `⚙️ ${t.t('preferences.title')}`,
        description: t.t('preferences.show.description'),
        color: PREFS_COLOR,
        fields,
        footer,
        ...(timestamp ? { timestamp } : {}),
      },
    ],
  });
}

// ============================================================================
// Set Subcommand
// ============================================================================

/**
 * Handles /preferences set [options...]
 *
 * Sets one or more preference values. Each preference is an optional parameter.
 * Users can set multiple preferences in a single command:
 *   /preferences set language:en blending:oklab market:true
 *
 * BUG-002 (2026-10-04 deep dive): a `world:` value is checked against
 * Universalis (`validateWorld`), which on a cold cache is up to two
 * sequential service-binding fetches with a 10 s timeout each. Awaited
 * before the reply, that ran past Discord's 3-second ack window ("The
 * application did not respond"). When a lookup is needed, the command now
 * defers (ephemerally — every /preferences reply is private) and does the
 * whole set — lookup, write, reply — after the ack. Without a `world:` value
 * that needs one, nothing is slow, and it still answers in the ack itself.
 */
async function handleSetSubcommand(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext,
  userId: string,
  options: Array<{ name: string; value?: string | number | boolean }>,
  t: Translator,
  logger?: ExtendedLogger
): Promise<Response> {
  // Check if any options were provided
  if (options.length === 0) {
    return ephemeralResponse({
      embeds: [
        errorEmbed(t.t('common.error'), t.t('preferences.set.noOptions')),
      ],
    });
  }

  if (!needsWorldLookup(options)) {
    return ephemeralResponse(await buildSetReply(interaction, env, userId, options, t, logger));
  }

  ctx.waitUntil(
    (async (): Promise<void> => {
      let reply: InteractionResponseData;
      try {
        reply = await buildSetReply(interaction, env, userId, options, t, logger);
      } catch (error) {
        // The ack is already sent: whatever broke, the user still gets an
        // answer rather than a "thinking…" that never resolves.
        markCommandOutcome(interaction, classifyError(error));
        if (logger) {
          logger.error(
            'Preferences set failed after the defer',
            error instanceof Error ? error : undefined
          );
        }
        reply = {
          embeds: [errorEmbed(t.t('common.error'), t.t('preferences.validation.error'))],
        };
      }
      await safeEditOriginalResponse(
        env.DISCORD_CLIENT_ID,
        interaction.token,
        { embeds: reply.embeds },
        logger
      );
    })()
  );
  return deferredResponse(true);
}

/**
 * True when this `/preferences set` carries a `world:` value that passes the
 * cheap shape guard — i.e. one that will cost a Universalis lookup (BUG-002).
 * A malformed value is refused without a lookup, so it needs no defer.
 */
function needsWorldLookup(
  options: Array<{ name: string; value?: string | number | boolean }>
): boolean {
  return options.some(
    (opt) =>
      resolveOptionKey(opt.name) === 'world' &&
      typeof opt.value === 'string' &&
      validatePreferenceValue('world', opt.value.trim()).valid
  );
}

/**
 * Validate, write and describe one `/preferences set` — the reply body,
 * sent either as the ack itself or as the edit over a deferred ack.
 */
async function buildSetReply(
  interaction: DiscordInteraction,
  env: Env,
  userId: string,
  options: Array<{ name: string; value?: string | number | boolean }>,
  t: Translator,
  logger?: ExtendedLogger
): Promise<InteractionResponseData> {
  // Process each provided option.
  //
  // BUG-029: this used to call `setPreference` inside the loop, so k options
  // meant k read-modify-write cycles on the SAME KV key inside one request.
  // KV allows one write per second per key and its reads are eventually
  // consistent, so a later iteration could read the pre-update object and
  // write back a version missing an earlier key — while the embed still
  // reported every one as saved. The loop now only resolves and validates;
  // the writes happen once, below.
  const updates: Array<{ key: PreferenceKey; value: unknown; success: boolean; reason?: string }> = [];
  const affectedCommandsSet = new Set<string>();
  // Queued writes, each remembering the `updates` slot it must fill, so the
  // embed still lists results in the order the user typed the options.
  const pending: Array<{
    key: PreferenceKey;
    value: string | number | boolean;
    slot: number;
  }> = [];

  for (const opt of options) {
    const key = resolveOptionKey(opt.name);
    let value = opt.value;

    // Skip if no value provided
    if (value === undefined) continue;

    // Validate key is a known preference
    if (!PREFERENCE_ORDER.includes(key)) continue;

    // FINDING-019 (2026-08-29 security audit): `world` writes the same field
    // `/budget set_world` fills, and `/budget` prices against it — so it
    // takes the same Universalis lookup here, and what gets stored is the
    // CANONICAL name ("balmung" → "Balmung"). The cheap shape guard runs
    // first so a rejected value never costs a lookup.
    if (key === 'world' && typeof value === 'string') {
      const typed = value.trim();
      const shape = validatePreferenceValue('world', typed);
      if (!shape.valid) {
        updates.push({ key, value: typed, success: false, reason: shape.reason });
        continue;
      }
      const canonical = await validateWorld(env, typed, logger);
      if (!canonical.ok) {
        // BUG-031: an outage is not the user typing their world wrong. Keep
        // the distinct reason so the failure line can say which it was; the
        // shape is `{ key, value, success, reason }` either way.
        updates.push({
          key,
          value: typed,
          success: false,
          reason: canonical.reason === 'upstream' ? 'worldLookupUnavailable' : 'invalidWorld',
        });
        continue;
      }
      value = canonical.name;
    }

    // Queue it — the whole batch is written together below — but claim this
    // option's place in `updates` now, so the reply reads in option order.
    pending.push({ key, value, slot: updates.length });
    updates.push({ key, value, success: false });
  }

  if (pending.length > 0) {
    const results = await setPreferences(
      env.KV,
      userId,
      pending.map(({ key, value }) => ({ key, value })),
      logger,
    );
    // `reason: 'error'` is the service saying its read or write failed —
    // ours, not a value the user got wrong — so it is not a success either.
    if (results.some((result) => result.reason === 'error')) {
      markCommandOutcome(interaction, 'unknown');
    }
    results.forEach((result, i) => {
      const { key, value, slot } = pending[i];
      updates[slot] = { key, value, success: result.success, reason: result.reason };
      if (result.success) {
        getAffectedCommands(key).forEach((cmd) => affectedCommandsSet.add(cmd));
      }
    });
  }

  // Check if any updates were attempted
  if (updates.length === 0) {
    return {
      embeds: [
        errorEmbed(t.t('common.error'), t.t('preferences.set.noValidOptions')),
      ],
    };
  }

  // Separate successes and failures
  const successes = updates.filter((u) => u.success);
  const failures = updates.filter((u) => !u.success);

  // Build response
  if (successes.length === 0) {
    // All failed
    const errorLines = failures.map((f) => {
      const emoji = PREFERENCE_EMOJIS[f.key];
      const label = t.t(`preferences.keys.${f.key}`);
      const reason = getValidationErrorMessage(t, f.key, f.reason);
      return `${emoji} **${label}**: ${reason}`;
    });

    return {
      embeds: [
        errorEmbed(t.t('common.error'), errorLines.join('\n\n')),
      ],
    };
  }

  // Build success description
  const successLines = successes.map((s) => {
    const emoji = PREFERENCE_EMOJIS[s.key];
    const label = t.t(`preferences.keys.${s.key}`);
    const displayValue = formatPreferenceValue(s.key, s.value, t);
    return `${emoji} **${label}** → **${displayValue}**`;
  });

  // Build response embed
  const fields: Array<{ name: string; value: string; inline: boolean }> = [];

  // Add affected commands field (command tokens verbatim, phrases via t())
  if (affectedCommandsSet.size > 0) {
    fields.push({
      name: `📋 ${t.t('preferences.set.affects')}`,
      value: Array.from(affectedCommandsSet)
        .map((v) => (v.startsWith('/') ? v : t.t(v)))
        .join(', '),
      inline: false,
    });
  }

  // Add failures field if any
  if (failures.length > 0) {
    const failureLines = failures.map((f) => {
      const emoji = PREFERENCE_EMOJIS[f.key];
      const label = t.t(`preferences.keys.${f.key}`);
      return `${emoji} ${label}: ${f.reason || t.t('preferences.errors.invalidValue', { key: label, options: '' })}`;
    });
    fields.push({
      name: `⚠️ ${t.t('preferences.set.failedToUpdate')}`,
      value: failureLines.join('\n'),
      inline: false,
    });
  }

  const title = successes.length === 1
    ? `✅ ${t.t('preferences.set.success')}`
    : `✅ ${t.t('preferences.set.successCount', { count: successes.length })}`;

  return {
    embeds: [
      {
        title,
        description: successLines.join('\n'),
        color: failures.length > 0 ? 0xfee75c : 0x57f287, // Yellow if partial, green if all succeeded
        fields,
        footer: {
          text: t.t('preferences.set.overrideNote'),
        },
      },
    ],
  };
}

// ============================================================================
// Reset Subcommand
// ============================================================================

/**
 * Handles /preferences reset [key]
 *
 * Resets a single preference to default, or all preferences if no key provided.
 */
async function handleResetSubcommand(
  interaction: DiscordInteraction,
  env: Env,
  userId: string,
  options: Array<{ name: string; value?: string | number | boolean }>,
  t: Translator,
  logger?: ExtendedLogger
): Promise<Response> {
  const keyOption = options.find((opt) => opt.name === 'key');
  const rawKeyValue = keyOption?.value as string | undefined;

  // Handle 'filters' reset specially (it's not a PreferenceKey)
  if (rawKeyValue === 'filters') {
    return handleFiltersResetSubcommand(interaction, env, userId, t, logger);
  }

  // Map snake_case reset choice values (e.g. 'show_hex') to camelCase PreferenceKey
  const key = rawKeyValue ? resolveOptionKey(rawKeyValue) : undefined;

  // Validate key if provided
  if (key && !PREFERENCE_ORDER.includes(key)) {
    return ephemeralResponse({
      embeds: [
        errorEmbed(
          t.t('common.error'),
          t.t('preferences.errors.invalidKey', { key })
        ),
      ],
    });
  }

  // Reset the preference(s)
  const success = await resetPreference(env.KV, userId, key, logger);

  if (!success) {
    // The service logged and swallowed a failed read or write
    markCommandOutcome(interaction, 'unknown');
    return ephemeralResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('preferences.reset.failed'))],
    });
  }

  // Success response
  if (key) {
    const emoji = PREFERENCE_EMOJIS[key];
    const label = t.t(`preferences.keys.${key}`);

    return ephemeralResponse({
      embeds: [
        {
          title: `🔄 ${t.t('preferences.reset.success')}`,
          description: t.t('preferences.reset.single', { key: `${emoji} ${label}` }),
          color: STATE.warning,
        },
      ],
    });
  } else {
    return ephemeralResponse({
      embeds: [
        {
          title: `🔄 ${t.t('preferences.reset.allTitle')}`,
          description: t.t('preferences.reset.allDescription'),
          color: STATE.warning,
          footer: {
            text: t.t('preferences.reset.showHint'),
          },
        },
      ],
    });
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format a preference value for display
 *
 * REFACTOR-004: Now uses i18n keys for display values
 */
function formatPreferenceValue(key: PreferenceKey, value: unknown, t: Translator): string {
  switch (key) {
    case 'language':
      return getLanguageDisplay(value as string);

    case 'blending': {
      const blendMode = BLENDING_MODES.find((m) => m.value === value);
      return blendMode ? `${blendMode.name}` : String(value);
    }

    case 'matching': {
      const matchMethod = MATCHING_METHODS.find((m) => m.value === value);
      return matchMethod ? `${matchMethod.name}` : String(value);
    }

    case 'count':
      return t.t('preferences.values.results', { count: value as string | number });

    case 'clan':
      return String(value);

    case 'gender':
      return value === 'male' ? t.t('preferences.values.male') : t.t('preferences.values.female');

    case 'world':
      return String(value);

    case 'market':
    case 'showHex':
    case 'showRgb':
    case 'showHsv':
    case 'showLab':
    case 'showDeltaE':
    case 'showAcquisition':
      return value === true || value === 'on' || value === 'true'
        ? t.t('preferences.values.yes')
        : t.t('preferences.values.no');
    case 'theme':
      return value === 'light'
        ? `☀️ ${t.t('preferences.values.themeLight')}`
        : `🌙 ${t.t('preferences.values.themeDark')}`;

    default:
      return String(value);
  }
}

/**
 * Get display name for a language code
 *
 * Language names are intentionally not localized — they should always
 * display in their native form so users can identify their language.
 */
function getLanguageDisplay(code: string): string {
  const languages: Record<string, string> = {
    en: 'English',
    ja: '日本語 (Japanese)',
    de: 'Deutsch (German)',
    fr: 'Français (French)',
    ko: '한국어 (Korean)',
    zh: '中文 (Chinese)',
  };
  return languages[code] ?? code;
}

/**
 * Get a localized validation error message
 *
 * REFACTOR-004: Now uses i18n keys. For errors with dynamic option lists
 * (blending modes, clans), the options are formatted in code and passed
 * via the {options} placeholder.
 */
function getValidationErrorMessage(t: Translator, _key: PreferenceKey, reason?: string): string {
  switch (reason) {
    case 'invalidLanguage':
      return t.t('preferences.validation.invalidLanguage');

    case 'invalidBlendingMode': {
      const options = BLENDING_MODES.map(
        (m) => `• \`${m.value}\` - ${t.t(`preferences.blendingModes.${m.value}`)}`,
      ).join('\n');
      return t.t('preferences.validation.invalidBlendingMode', { options });
    }

    case 'invalidMatchingMethod': {
      const options = MATCHING_METHODS.map(
        (m) => `• \`${m.value}\` - ${t.t(`preferences.methods.${m.value}`)}`,
      ).join('\n');
      return t.t('preferences.validation.invalidMatchingMethod', { options });
    }

    case 'invalidCount':
      return t.t('preferences.validation.invalidCount');

    case 'invalidClan': {
      const options = Object.entries(CLANS_BY_RACE).map(([race, clans]) => `• **${race}**: ${clans.join(', ')}`).join('\n');
      return t.t('preferences.validation.invalidClan', { options });
    }

    case 'invalidGender':
      return t.t('preferences.validation.invalidGender');

    case 'invalidWorld':
      return t.t('preferences.validation.invalidWorld');

    // BUG-031: the world lookup could not run at all. Reusing the budget
    // command's existing upstream sentence keeps this out of the locale files
    // (new UI text would force a CJK font re-subset) while still telling the
    // user the truth: nothing is wrong with what they typed.
    case 'worldLookupUnavailable':
      return t.t('budget.errors.apiError');

    case 'invalidTheme':
      return t.t('preferences.validation.invalidTheme');

    case 'invalidMarket':
    case 'invalidBoolean':
      return t.t('preferences.validation.invalidMarket');

    case 'error':
    default:
      return t.t('preferences.validation.error');
  }
}

// ============================================================================
// Filters Subcommand Group
// ============================================================================

/**
 * Handles /preferences filters set [options...]
 *
 * Sets dye type filter preferences. Each filter is an optional boolean.
 */
async function handleFiltersSetSubcommand(
  interaction: DiscordInteraction,
  env: Env,
  userId: string,
  options: Array<{ name: string; value?: string | number | boolean }>,
  t: Translator,
  logger?: ExtendedLogger
): Promise<Response> {
  if (options.length === 0) {
    return ephemeralResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('preferences.filters.noOptions'))],
    });
  }

  // BUG-048: this read feeds a whole-blob write, so a failed read must stop
  // here — the lenient `{}` would have put `{ dyeFilters }` over every other
  // preference the user has.
  const prefs = await readForUpdate(interaction, env, userId, logger);
  if (!prefs) {
    return ephemeralResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('preferences.validation.error'))],
    });
  }
  const filters: DyeTypeFilters = prefs.dyeFilters ?? {};

  // Apply each provided filter option
  const changes: string[] = [];
  for (const opt of options) {
    const mapping = FILTER_OPTION_KEYS.find((f) => f.option === opt.name);
    if (!mapping || typeof opt.value !== 'boolean') continue;

    filters[mapping.key] = opt.value;
    const status = opt.value ? '🚫' : '✅';
    changes.push(`${status} **${filterLabel(t, mapping.option)}**: ${opt.value ? t.t('preferences.filters.excluded') : t.t('preferences.filters.included')}`);
  }

  if (changes.length === 0) {
    return ephemeralResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('preferences.filters.noOptions'))],
    });
  }

  // Save updated filters
  prefs.dyeFilters = filters;
  prefs.updatedAt = new Date().toISOString();
  const key = `prefs:v1:${userId}`;
  try {
    await env.KV.put(key, JSON.stringify(prefs));
  } catch (error) {
    // Caught here, the rejection no longer reaches the dispatcher's mark
    markCommandOutcome(interaction, classifyError(error));
    if (logger) {
      logger.error('Failed to save dye filters', error instanceof Error ? error : undefined);
    }
    return ephemeralResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('preferences.validation.error'))],
    });
  }

  return ephemeralResponse({
    embeds: [
      {
        title: `✅ ${t.t('preferences.filters.updated')}`,
        description: changes.join('\n'),
        color: STATE.success,
        footer: { text: t.t('preferences.filters.affectsHint') },
      },
    ],
  });
}

/**
 * Handles /preferences filters show
 *
 * Displays current dye filter settings.
 */
async function handleFiltersShowSubcommand(
  env: Env,
  userId: string,
  t: Translator,
  logger?: ExtendedLogger
): Promise<Response> {
  const prefs = await getUserPreferences(env.KV, userId, logger);
  const filters = prefs.dyeFilters ?? {};

  const lines = FILTER_OPTION_KEYS.map(({ key, option }) => {
    const isExcluded = filters[key] === true;
    const emoji = isExcluded ? '🚫' : '✅';
    const status = isExcluded ? t.t('preferences.filters.excluded') : t.t('preferences.filters.included');
    return `${emoji} **${filterLabel(t, option)}**: ${status}`;
  });

  return ephemeralResponse({
    embeds: [
      {
        title: `🔍 ${t.t('preferences.filters.title')}`,
        description: lines.join('\n'),
        color: PREFS_COLOR,
        footer: { text: t.t('preferences.filters.setHint') },
      },
    ],
  });
}

/**
 * Handles /preferences filters reset
 *
 * Clears all dye filters.
 */
async function handleFiltersResetSubcommand(
  interaction: DiscordInteraction,
  env: Env,
  userId: string,
  t: Translator,
  logger?: ExtendedLogger
): Promise<Response> {
  const failed = (): Response =>
    ephemeralResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('preferences.reset.failed'))],
    });

  // BUG-048: with the lenient `{}`, a failed read made `hasPrefs` false
  // below and deleted the user's whole blob.
  const prefs = await readForUpdate(interaction, env, userId, logger);
  if (!prefs) return failed();

  delete prefs.dyeFilters;
  prefs.updatedAt = new Date().toISOString();

  const hasPrefs = Object.keys(prefs).some((k) => !k.startsWith('_') && k !== 'updatedAt');
  const key = `prefs:v1:${userId}`;
  try {
    if (hasPrefs) {
      await env.KV.put(key, JSON.stringify(prefs));
    } else {
      await env.KV.delete(key);
    }
  } catch (error) {
    markCommandOutcome(interaction, classifyError(error));
    if (logger) {
      logger.error('Failed to reset dye filters', error instanceof Error ? error : undefined);
    }
    return failed();
  }

  return ephemeralResponse({
    embeds: [
      {
        title: `🔄 ${t.t('preferences.filters.resetSuccess')}`,
        description: t.t('preferences.filters.resetDescription'),
        color: STATE.warning,
      },
    ],
  });
}
