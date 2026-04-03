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
import { messageResponse, errorEmbed } from '../../utils/response.js';
import {
  getUserPreferences,
  setPreference,
  resetPreference,
  getDefaultValue,
  getAffectedCommands,
} from '../../services/preferences.js';
import {
  BLENDING_MODES,
  MATCHING_METHODS,
  CLANS_BY_RACE,
  type PreferenceKey,
} from '../../types/preferences.js';
import type { DyeTypeFilters } from '@xivdyetools/types';
import { hasActiveFilters } from '@xivdyetools/core';
import { createUserTranslator, type Translator } from '../../services/bot-i18n.js';
import type { Env, DiscordInteraction } from '../../types/env.js';

// ============================================================================
// Constants
// ============================================================================

/** Embed color for preferences display (Discord blurple) */
const PREFS_COLOR = 0x5865f2;

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
};

/** Maps Discord option names to DyeTypeFilters keys and display labels */
const FILTER_OPTION_KEYS: Array<{ option: string; key: keyof DyeTypeFilters; label: string }> = [
  { option: 'metallic', key: 'excludeMetallic', label: 'Metallic' },
  { option: 'pastel', key: 'excludePastel', label: 'Pastel' },
  { option: 'dark', key: 'excludeDark', label: 'Dark' },
  { option: 'cosmic', key: 'excludeCosmic', label: 'Cosmic' },
  { option: 'ishgardian', key: 'excludeIshgardian', label: 'Ishgardian' },
  { option: 'expensive', key: 'excludeExpensive', label: 'Expensive (Pure White / Jet Black)' },
  { option: 'vendor', key: 'excludeVendorDyes', label: 'Vendor' },
  { option: 'craft', key: 'excludeCraftDyes', label: 'Crafted' },
  { option: 'allied_society', key: 'excludeAlliedSocietyDyes', label: 'Allied Society' },
];

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
  _ctx: ExecutionContext,
  logger?: ExtendedLogger
): Promise<Response> {
  const userId = interaction.member?.user?.id ?? interaction.user?.id ?? 'unknown';
  const t = await createUserTranslator(env.KV, userId, interaction.locale);

  // Get subcommand from options
  const options = interaction.data?.options || [];
  const subcommandOption = options[0];

  if (!subcommandOption) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('preferences.errors.noSubcommand'))],
      flags: 64,
    });
  }

  const subcommand = subcommandOption.name;

  switch (subcommand) {
    case 'show':
      return handleShowSubcommand(env, userId, t, logger);

    case 'set':
      return handleSetSubcommand(env, userId, subcommandOption.options || [], t, logger);

    case 'reset':
      return handleResetSubcommand(env, userId, subcommandOption.options || [], t, logger);

    case 'filters': {
      // Subcommand group — filters set/show/reset
      const filterSubcommand = subcommandOption.options?.[0];
      if (!filterSubcommand) {
        return messageResponse({
          embeds: [errorEmbed(t.t('common.error'), t.t('preferences.errors.noSubcommand'))],
          flags: 64,
        });
      }
      switch (filterSubcommand.name) {
        case 'set':
          return handleFiltersSetSubcommand(env, userId, filterSubcommand.options || [], t, logger);
        case 'show':
          return handleFiltersShowSubcommand(env, userId, t, logger);
        case 'reset':
          return handleFiltersResetSubcommand(env, userId, t, logger);
        default:
          return messageResponse({
            embeds: [errorEmbed(t.t('common.error'), t.t('preferences.errors.noSubcommand'))],
            flags: 64,
          });
      }
    }

    default:
      return messageResponse({
        embeds: [errorEmbed(t.t('common.error'), t.t('preferences.errors.noSubcommand'))],
        flags: 64,
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
      .map(({ label }) => label);
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

  // Add last updated timestamp if available
  const footer = prefs.updatedAt
    ? { text: `Last updated: ${new Date(prefs.updatedAt).toLocaleString()}` }
    : { text: t.t('preferences.show.hint') };

  return messageResponse({
    embeds: [
      {
        title: `⚙️ ${t.t('preferences.title')}`,
        description: t.t('preferences.show.description'),
        color: PREFS_COLOR,
        fields,
        footer,
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
 */
async function handleSetSubcommand(
  env: Env,
  userId: string,
  options: Array<{ name: string; value?: string | number | boolean }>,
  t: Translator,
  logger?: ExtendedLogger
): Promise<Response> {
  // Check if any options were provided
  if (options.length === 0) {
    return messageResponse({
      embeds: [
        errorEmbed(t.t('common.error'), t.t('preferences.set.noOptions')),
      ],
      flags: 64,
    });
  }

  // Process each provided option
  const updates: Array<{ key: PreferenceKey; value: unknown; success: boolean; reason?: string }> = [];
  const affectedCommandsSet = new Set<string>();

  for (const opt of options) {
    const key = opt.name as PreferenceKey;
    const value = opt.value;

    // Skip if no value provided
    if (value === undefined) continue;

    // Validate key is a known preference
    if (!PREFERENCE_ORDER.includes(key)) continue;

    // Attempt to set the preference
    const result = await setPreference(env.KV, userId, key, value, logger);
    updates.push({ key, value, success: result.success, reason: result.reason });

    // Collect affected commands for successful updates
    if (result.success) {
      getAffectedCommands(key).forEach((cmd) => affectedCommandsSet.add(cmd));
    }
  }

  // Check if any updates were attempted
  if (updates.length === 0) {
    return messageResponse({
      embeds: [
        errorEmbed(t.t('common.error'), t.t('preferences.set.noValidOptions')),
      ],
      flags: 64,
    });
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

    return messageResponse({
      embeds: [
        errorEmbed(t.t('common.error'), errorLines.join('\n\n')),
      ],
      flags: 64,
    });
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

  // Add affected commands field
  if (affectedCommandsSet.size > 0) {
    fields.push({
      name: `📋 ${t.t('preferences.set.affects')}`,
      value: Array.from(affectedCommandsSet).join(', '),
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

  return messageResponse({
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
  });
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
  env: Env,
  userId: string,
  options: Array<{ name: string; value?: string | number | boolean }>,
  t: Translator,
  logger?: ExtendedLogger
): Promise<Response> {
  const keyOption = options.find((opt) => opt.name === 'key');
  const key = keyOption?.value as PreferenceKey | 'filters' | undefined;

  // Handle 'filters' reset specially (it's not a PreferenceKey)
  if (key === 'filters') {
    return handleFiltersResetSubcommand(env, userId, t, logger);
  }

  // Validate key if provided
  if (key && !PREFERENCE_ORDER.includes(key)) {
    return messageResponse({
      embeds: [
        errorEmbed(
          t.t('common.error'),
          t.t('preferences.errors.invalidKey', { key })
        ),
      ],
      flags: 64,
    });
  }

  // Reset the preference(s)
  const success = await resetPreference(env.KV, userId, key, logger);

  if (!success) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('preferences.reset.failed'))],
      flags: 64,
    });
  }

  // Success response
  if (key) {
    const emoji = PREFERENCE_EMOJIS[key];
    const label = t.t(`preferences.keys.${key}`);

    return messageResponse({
      embeds: [
        {
          title: `🔄 ${t.t('preferences.reset.success')}`,
          description: t.t('preferences.reset.single', { key: `${emoji} ${label}` }),
          color: 0xfee75c, // Yellow
        },
      ],
    });
  } else {
    return messageResponse({
      embeds: [
        {
          title: `🔄 ${t.t('preferences.reset.allTitle')}`,
          description: t.t('preferences.reset.allDescription'),
          color: 0xfee75c, // Yellow
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
      return value === true || value === 'on' || value === 'true'
        ? t.t('preferences.values.yes')
        : t.t('preferences.values.no');

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
function getValidationErrorMessage(t: Translator, key: PreferenceKey, reason?: string): string {
  switch (reason) {
    case 'invalidLanguage':
      return t.t('preferences.validation.invalidLanguage');

    case 'invalidBlendingMode': {
      const options = BLENDING_MODES.map((m) => `• \`${m.value}\` - ${m.description}`).join('\n');
      return t.t('preferences.validation.invalidBlendingMode', { options });
    }

    case 'invalidMatchingMethod': {
      const options = MATCHING_METHODS.map((m) => `• \`${m.value}\` - ${m.description}`).join('\n');
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

    case 'invalidMarket':
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
  env: Env,
  userId: string,
  options: Array<{ name: string; value?: string | number | boolean }>,
  t: Translator,
  logger?: ExtendedLogger
): Promise<Response> {
  if (options.length === 0) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('preferences.filters.noOptions'))],
      flags: 64,
    });
  }

  const prefs = await getUserPreferences(env.KV, userId, logger);
  const filters: DyeTypeFilters = prefs.dyeFilters ?? {};

  // Apply each provided filter option
  const changes: string[] = [];
  for (const opt of options) {
    const mapping = FILTER_OPTION_KEYS.find((f) => f.option === opt.name);
    if (!mapping || typeof opt.value !== 'boolean') continue;

    filters[mapping.key] = opt.value;
    const status = opt.value ? '🚫' : '✅';
    changes.push(`${status} **${mapping.label}**: ${opt.value ? t.t('preferences.filters.excluded') : t.t('preferences.filters.included')}`);
  }

  if (changes.length === 0) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('preferences.filters.noOptions'))],
      flags: 64,
    });
  }

  // Save updated filters
  prefs.dyeFilters = filters;
  prefs.updatedAt = new Date().toISOString();
  const key = `prefs:v1:${userId}`;
  await env.KV.put(key, JSON.stringify(prefs));

  return messageResponse({
    embeds: [
      {
        title: `✅ ${t.t('preferences.filters.updated')}`,
        description: changes.join('\n'),
        color: 0x57f287,
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

  const lines = FILTER_OPTION_KEYS.map(({ key, label }) => {
    const isExcluded = filters[key] === true;
    const emoji = isExcluded ? '🚫' : '✅';
    const status = isExcluded ? t.t('preferences.filters.excluded') : t.t('preferences.filters.included');
    return `${emoji} **${label}**: ${status}`;
  });

  return messageResponse({
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
  env: Env,
  userId: string,
  t: Translator,
  logger?: ExtendedLogger
): Promise<Response> {
  const prefs = await getUserPreferences(env.KV, userId, logger);
  delete prefs.dyeFilters;
  prefs.updatedAt = new Date().toISOString();

  const hasPrefs = Object.keys(prefs).some((k) => !k.startsWith('_') && k !== 'updatedAt');
  const key = `prefs:v1:${userId}`;
  if (hasPrefs) {
    await env.KV.put(key, JSON.stringify(prefs));
  } else {
    await env.KV.delete(key);
  }

  return messageResponse({
    embeds: [
      {
        title: `🔄 ${t.t('preferences.filters.resetSuccess')}`,
        description: t.t('preferences.filters.resetDescription'),
        color: 0xfee75c,
      },
    ],
  });
}
