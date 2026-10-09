/**
 * Locale resolution shared by both Discord bots.
 *
 * REFACTOR-001: `discord-worker` and `moderation-worker` each carried a private
 * copy of this layer, and the copies drifted — BUG-001 was exactly that: only
 * the main bot's copy learned about the unified `prefs:v1:` preferences blob,
 * so a user who set their language through `/preferences` got every
 * moderation-bot string back in their Discord client locale, with no way to
 * correct it (moderation-worker ships no language command). Both workers bind
 * the SAME production KV namespace, so there was never a reason for two
 * readers of it.
 *
 * @module i18n/locale-resolution
 */

import { LOCALE_CODES, type LocaleCode } from './types.js';

/**
 * The one method locale resolution needs from a KV namespace.
 *
 * Declared structurally so `@xivdyetools/bot-logic` need not depend on
 * `@cloudflare/workers-types`; a real `KVNamespace` satisfies it.
 */
export interface LocalePreferenceStore {
  get(key: string): Promise<string | null>;
}

/**
 * Minimal logger accepted by `resolveUserLocale` and the legacy reader.
 * Compatible with `@xivdyetools/logger`'s `ExtendedLogger`.
 *
 * moderation-worker's private copy logged a KV failure here and
 * discord-worker's swallowed it silently. Unifying kept the louder of the two:
 * a KV error during locale resolution is worth a line, and the call still
 * resolves rather than throwing. Until BUG-126 (2026-10-04 audit) nothing
 * passed one in — `resolveUserLocale` called the reader without it — so the
 * louder copy was silent too; a caller can now pass its logger as
 * `resolveUserLocale`'s fourth argument.
 */
export interface LocaleResolutionLogger {
  error: (message: string, error?: Error) => void;
}

/** Display information for a locale, used by language pickers. */
export interface LocaleInfo {
  code: LocaleCode;
  name: string;
  nativeName: string;
  flag: string;
}

/** All supported locales with display info, in menu order. */
export const SUPPORTED_LOCALES: readonly LocaleInfo[] = Object.freeze([
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
] as const satisfies readonly LocaleInfo[]);

/**
 * The unified preferences blob the MAIN bot writes, in the KV namespace both
 * workers share. `discord-worker/src/services/preferences.ts` is its only
 * writer; moderation-worker only ever reads it.
 */
const UNIFIED_PREFS_PREFIX = 'prefs:v1:';

/**
 * Legacy per-user language key. Nothing writes it any more, but
 * `preferences.ts` deliberately does not delete it, so entries that predate the
 * unified system still resolve.
 */
const LEGACY_KEY_PREFIX = 'i18n:user:';

/**
 * Whether `code` is one of the supported locales.
 *
 * Checks against `LOCALE_CODES`, the same list `LocaleCode` is derived from, so
 * a seventh locale cannot be added to the type while this guard silently goes
 * on rejecting it — which is what moderation-worker's hand-written union and
 * hand-written array allowed.
 */
export function isValidLocale(code: string): code is LocaleCode {
  return (LOCALE_CODES as readonly string[]).includes(code);
}

/**
 * Map a Discord client locale to a supported locale, or `null`.
 *
 * @see https://discord.com/developers/docs/reference#locales
 */
export function discordLocaleToLocaleCode(discordLocale: string): LocaleCode | null {
  const mapping: Record<string, LocaleCode> = {
    'en-US': 'en',
    'en-GB': 'en',
    ja: 'ja',
    de: 'de',
    fr: 'fr',
    ko: 'ko',
    'zh-CN': 'zh',
    'zh-TW': 'zh',
  };
  // Own-property check: an inherited key ('toString', 'constructor') would
  // otherwise return a FUNCTION from a call declared `LocaleCode | null`.
  // Both forked copies carried this, and `?? null` cannot catch it because the
  // inherited value is not nullish. Same guard FINDING-027 put on help topics.
  return Object.hasOwn(mapping, discordLocale) ? mapping[discordLocale] : null;
}

/**
 * Read a user's legacy language preference.
 *
 * A KV failure resolves to `null` rather than throwing: locale resolution runs
 * on every interaction and must never be the reason one fails.
 */
export async function getLegacyLanguagePreference(
  kv: LocalePreferenceStore,
  userId: string,
  logger?: LocaleResolutionLogger
): Promise<LocaleCode | null> {
  try {
    const value = await kv.get(`${LEGACY_KEY_PREFIX}${userId}`);
    return value && isValidLocale(value) ? value : null;
  } catch (error) {
    logger?.error(
      'Failed to get user language preference',
      error instanceof Error ? error : undefined
    );
    return null;
  }
}

/**
 * Resolve the effective locale for a user, in priority order:
 *
 * 1. the unified preferences blob (`prefs:v1:<id>`),
 * 2. the legacy per-user key (`i18n:user:<id>`),
 * 3. the Discord client locale,
 * 4. English.
 *
 * Every step swallows its own failure and falls through — a malformed blob or a
 * KV hiccup must degrade the language, never the interaction.
 *
 * BUG-126 (2026-10-04 audit): `logger`, when given, hears about each degraded
 * step — a failed KV read or a malformed blob. Its messages are fixed strings
 * that never name the user id or quote what KV stored, and a malformed blob is
 * reported by its message alone, because `JSON.parse`'s `SyntaxError` quotes
 * its input.
 *
 * A failed KV read does pass the KV's own `Error` through unchanged, as
 * discord-worker's `getUserPreferences` does. Its message is what tells a rate
 * limit from an outage: the worker logger drops the stack, and the class alone
 * would read `Error`. If that message quotes the key, the user id goes with
 * it. The id is not something these logs withhold: `userId` is a reserved
 * `LogContext` field, and both bots log it on every slash command. Withholding
 * it here would cost the diagnosis and protect little.
 */
export async function resolveUserLocale(
  kv: LocalePreferenceStore,
  userId: string,
  discordLocale?: string,
  logger?: LocaleResolutionLogger
): Promise<LocaleCode> {
  let unifiedData: string | null = null;
  try {
    unifiedData = await kv.get(`${UNIFIED_PREFS_PREFIX}${userId}`);
  } catch (error) {
    // KV failure: fall through to the legacy key.
    logger?.error(
      'Failed to read unified preferences for locale resolution',
      error instanceof Error ? error : undefined
    );
  }

  if (unifiedData) {
    let prefs: { language?: string } | null = null;
    try {
      prefs = JSON.parse(unifiedData) as { language?: string } | null;
    } catch {
      // Malformed blob: fall through to the legacy key. The parse error is
      // deliberately not logged — its message quotes the stored blob.
      logger?.error('Malformed unified preferences blob; ignoring it for locale resolution');
    }
    const language = prefs?.language;
    if (typeof language === 'string' && isValidLocale(language)) {
      return language;
    }
  }

  const legacy = await getLegacyLanguagePreference(kv, userId, logger);
  if (legacy) {
    return legacy;
  }

  if (discordLocale) {
    const mapped = discordLocaleToLocaleCode(discordLocale);
    if (mapped) {
      return mapped;
    }
  }

  return 'en';
}
