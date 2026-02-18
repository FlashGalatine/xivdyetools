/**
 * /language Command Handler (DEPRECATED in V4)
 *
 * This command is deprecated in v4.0.0. Users should use /preferences instead.
 * The command still works but shows a deprecation notice.
 *
 * Functionality is now delegated to the unified preferences system.
 *
 * @deprecated Use /preferences set language instead
 * @module handlers/commands/language
 */

import { messageResponse, errorEmbed } from '../../utils/response.js';
import {
  type LocaleCode,
  SUPPORTED_LOCALES,
  isValidLocale,
  getLocaleInfo,
  discordLocaleToLocaleCode,
} from '../../services/i18n.js';
import { createUserTranslator, type Translator } from '../../services/bot-i18n.js';
import {
  getUserPreferences,
  setPreference,
  resetPreference,
} from '../../services/preferences.js';
import type { Env, DiscordInteraction } from '../../types/env.js';

// ============================================================================
// Constants
// ============================================================================

/** Deprecation warning shown with all responses */
const DEPRECATION_NOTICE = '⚠️ **This command is deprecated.** Use `/preferences set language <code>` instead.\n\n';

/** Color for deprecation warning embeds */
const DEPRECATION_COLOR = 0xfee75c; // Yellow

// ============================================================================
// Main Handler
// ============================================================================

/**
 * Handles the /language command (deprecated)
 *
 * @deprecated Use /preferences command instead
 */
export async function handleLanguageCommand(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const userId = interaction.member?.user?.id ?? interaction.user?.id;

  if (!userId) {
    return messageResponse({
      embeds: [errorEmbed('Error', 'Could not identify user.')],
      flags: 64,
    });
  }

  // Get translator for user's current locale
  const t = await createUserTranslator(env.KV, userId, interaction.locale);

  // Extract subcommand
  const options = interaction.data?.options || [];
  const subcommand = options.find((opt) => opt.type === 1); // SUB_COMMAND type

  if (!subcommand) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), 'Please specify a subcommand: `set`, `show`, or `reset`.')],
      flags: 64,
    });
  }

  switch (subcommand.name) {
    case 'set':
      return handleSetLanguage(env, userId, t, subcommand.options);

    case 'show':
      return handleShowLanguage(interaction, env, userId, t);

    case 'reset':
      return handleResetLanguage(env, userId, t);

    default:
      return messageResponse({
        embeds: [errorEmbed(t.t('common.error'), `Unknown subcommand: ${subcommand.name}`)],
        flags: 64,
      });
  }
}

// ============================================================================
// Subcommand Handlers
// ============================================================================

/**
 * Handle /language set <locale>
 * Delegates to preferences system with deprecation notice
 */
async function handleSetLanguage(
  env: Env,
  userId: string,
  t: Translator,
  options?: Array<{ name: string; value?: string | number | boolean }>
): Promise<Response> {
  const localeOption = options?.find((opt) => opt.name === 'locale');
  const locale = localeOption?.value as string | undefined;

  if (!locale) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('language.missingLanguage'))],
      flags: 64,
    });
  }

  if (!isValidLocale(locale)) {
    const validLocales = SUPPORTED_LOCALES.map((l) => `\`${l.code}\``).join(', ');
    return messageResponse({
      embeds: [
        errorEmbed(
          t.t('common.error'),
          t.t('language.invalidLanguage', { locale, validList: validLocales })
        ),
      ],
      flags: 64,
    });
  }

  // Delegate to unified preferences system
  const result = await setPreference(env.KV, userId, 'language', locale);

  if (!result.success) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.failedToSave'))],
      flags: 64,
    });
  }

  const localeInfo = getLocaleInfo(locale);
  const displayName = localeInfo
    ? `${localeInfo.flag} ${localeInfo.name} (${localeInfo.nativeName})`
    : locale;

  return messageResponse({
    embeds: [
      {
        title: '✅ ' + t.t('common.success'),
        description:
          DEPRECATION_NOTICE +
          t.t('language.updated', { language: displayName }) +
          '\n\n' +
          t.t('language.updateNote'),
        color: DEPRECATION_COLOR,
      },
    ],
    flags: 64,
  });
}

/**
 * Handle /language show
 */
async function handleShowLanguage(
  interaction: DiscordInteraction,
  env: Env,
  userId: string,
  t: Translator
): Promise<Response> {
  // Get user's preferences from unified system
  const prefs = await getUserPreferences(env.KV, userId);
  const preference = prefs.language;

  // Get Discord's detected locale
  const discordLocale = interaction.locale;
  const mappedDiscord = discordLocale ? discordLocaleToLocaleCode(discordLocale) : null;

  // Build status message
  const lines: string[] = [DEPRECATION_NOTICE];

  if (preference) {
    const prefInfo = getLocaleInfo(preference);
    const prefDisplay = prefInfo
      ? `${prefInfo.flag} ${prefInfo.name} (${prefInfo.nativeName})`
      : preference;
    lines.push(`**${t.t('language.yourPreference')}:** ${prefDisplay}`);
  } else {
    lines.push(`**${t.t('language.yourPreference')}:** ${t.t('language.notSet')}`);
  }

  if (discordLocale) {
    const discordDisplay = mappedDiscord
      ? (() => {
          const info = getLocaleInfo(mappedDiscord);
          return info ? `${info.flag} ${info.name} (${info.nativeName})` : mappedDiscord;
        })()
      : `${discordLocale} (${t.t('language.unsupported')})`;
    lines.push(`**${t.t('language.discordLocale')}:** ${discordDisplay}`);
  }

  // Effective locale
  const effective = preference ?? mappedDiscord ?? 'en';
  const effectiveInfo = getLocaleInfo(effective as LocaleCode);
  const effectiveDisplay = effectiveInfo
    ? `${effectiveInfo.flag} ${effectiveInfo.name} (${effectiveInfo.nativeName})`
    : effective;
  lines.push(`\n**${t.t('language.effectiveLanguage')}:** ${effectiveDisplay}`);

  // Add supported languages list
  lines.push(`\n**${t.t('language.supportedLanguages')}:**`);
  for (const locale of SUPPORTED_LOCALES) {
    const marker = locale.code === effective ? ' ✓' : '';
    lines.push(`${locale.flag} \`${locale.code}\` - ${locale.name} (${locale.nativeName})${marker}`);
  }

  return messageResponse({
    embeds: [
      {
        title: '🌐 ' + t.t('language.title'),
        description: lines.join('\n'),
        color: DEPRECATION_COLOR,
        footer: {
          text: 'Use /preferences show to see all your settings',
        },
      },
    ],
    flags: 64,
  });
}

/**
 * Handle /language reset
 * Delegates to preferences system with deprecation notice
 */
async function handleResetLanguage(
  env: Env,
  userId: string,
  t: Translator
): Promise<Response> {
  // Delegate to unified preferences system
  const success = await resetPreference(env.KV, userId, 'language');

  if (!success) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.failedToReset'))],
      flags: 64,
    });
  }

  return messageResponse({
    embeds: [
      {
        title: '✅ ' + t.t('common.success'),
        description:
          DEPRECATION_NOTICE +
          t.t('language.reset') +
          '\n\n' +
          t.t('language.resetNote'),
        color: DEPRECATION_COLOR,
        footer: {
          text: 'Use /preferences reset language instead',
        },
      },
    ],
    flags: 64,
  });
}
