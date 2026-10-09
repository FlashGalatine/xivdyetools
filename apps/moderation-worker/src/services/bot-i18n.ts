/**
 * Bot UI Translation Service (Simplified for Moderation Bot)
 *
 * This service handles bot-specific UI strings for the moderation worker.
 * This is a simplified version that only includes moderation-related strings.
 *
 * @module services/bot-i18n
 */

import type { LocaleCode } from './i18n.js';
import { resolveUserLocale } from './i18n.js';
import type { ExtendedLogger } from '@xivdyetools/logger';

/**
 * Locale data structure
 */
interface LocaleData {
  [key: string]: unknown;
}

/**
 * English locale data (moderation-focused)
 *
 * DEAD-030 (2026-10-04 dead-code audit): every key here has a literal
 * `t.t('<key>')` reader in the handlers; the bot builds no key at runtime. The
 * `meta` block, `common.success`, `preset.categories.*` (the review embed
 * prints the raw `category_id`) and `ban.userBanned` / `presetsHidden` /
 * `alreadyBanned` had none and were removed; add a key back only together
 * with the handler that reads it.
 */
const enLocale: LocaleData = {
  common: {
    error: 'Error',
  },
  errors: {
    userNotFound: 'Could not identify user.',
    missingSubcommand: 'Please specify a subcommand.',
    unknownSubcommand: 'Unknown subcommand: {name}',
  },
  preset: {
    moderation: {
      accessDenied: "You don't have permission to perform moderation actions.",
      pendingQueue: 'Presets Awaiting Moderation',
      noPending: 'No presets are currently awaiting moderation.',
      pendingCount: '{count} preset(s) pending review',
      missingId: 'Please specify a preset ID for this action.',
      stats: 'Moderation Statistics',
      // FINDING-001 (2026-08-11 fix wave): the queue was widened to include
      // approved presets whose picture alone is pending, but approve/reject
      // act on the preset's own status — the wrong tool for those entries.
      // These keys mark them instead of offering the two actions that would
      // either no-op forever or wrongly pull a live palette from the gallery.
      imageOnlyNote: 'Picture pending review: {url}',
      imageOnlyNoteNoUrl: 'Picture pending review',
      footerTextOnly: 'Use /preset moderate approve <id> or reject <id>',
      footerMixedQueue:
        'approve/reject apply to the text entries only — 🖼 entries are reviewed on the moderation embed in Discord',
    },
  },
  ban: {
    confirmTitle: 'Confirm User Ban',
    confirmDesc:
      'Are you sure you want to ban this user from Preset Palettes?\n\nThis will **hide all their presets** and prevent them from submitting, voting, or editing presets.',
    username: 'Username',
    discordId: 'Discord ID',
    // A4 (2026-09-16 PR review, BUG-001 path (a)): the ban-confirmation
    // embed's id field is Discord-only labeled even when the target is an
    // XIVAuth-only account (no Discord ID, banned by their oauth `sub`
    // UUID) — `handlers/commands/preset.ts` picks between this and
    // `discordId` above by `isValidSnowflake(user.discordId)`.
    xivauthId: 'XIVAuth ID',
    totalPresets: 'Total Presets',
    recentPresets: 'Recent Presets',
    confirmFooter: 'Click "Yes" to proceed with the ban, or "No" to cancel.',
    yesBan: 'Yes, Ban User',
    cancel: 'Cancel',
    userUnbanned: 'User Unbanned',
    presetsRestored: 'Presets Restored',
    presetsStillHidden: 'Presets Still Hidden',
    presetsStillHiddenWhy:
      'another approved or pending preset already uses the same dye combination, so restoring it would duplicate that preset.',
    notBanned: 'User is not currently banned.',
    userNotFound: 'User not found or has no presets.',
    channelRestricted: 'This command can only be used in the moderation channel.',
    permissionDenied: 'You do not have permission to perform this action.',
  },
};

/**
 * The moderation bot's strings — English only, deliberately (I18N-009).
 *
 * Every moderator is an English speaker and this bot talks to nobody else: its
 * commands are restricted to the moderation channel, and the messages a preset
 * AUTHOR receives are sent by discord-worker, which *is* localized.
 *
 * This used to be a `Record<LocaleCode, LocaleData>` with all six locales
 * pointing at `enLocale`, alongside a KV locale round-trip and an unused
 * `preset.status.*` key set — an apparatus that could never return anything but
 * English while looking like it might. If this bot is ever localized, add real
 * locale files here and give the handlers translators; do not restore the map.
 */
const strings: LocaleData = enLocale;

/**
 * Get a nested value from an object using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

/**
 * Interpolate variables into a string
 */
function interpolate(template: string, variables: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    return variables[key]?.toString() ?? match;
  });
}

/**
 * Translator class for a specific locale
 */
export class Translator {
  private locale: LocaleCode;
  private data: LocaleData;
  private logger?: ExtendedLogger;

  constructor(locale: LocaleCode, logger?: ExtendedLogger) {
    // `locale` is still resolved and recorded — analytics and log lines want to
    // know what the moderator's client asked for — but it selects nothing:
    // this bot ships one English table on purpose (I18N-009). There is no
    // separate fallback table either (DEAD-027): it was the same English table,
    // so re-reading a missing key from it could never find anything.
    this.locale = locale;
    this.data = strings;
    this.logger = logger;
  }

  /**
   * Get a translated string
   */
  t(key: string, variables?: Record<string, string | number>): string {
    const value = getNestedValue(this.data, key);

    if (value === undefined || typeof value !== 'string') {
      if (this.logger) {
        this.logger.warn(`Missing translation: ${key} for locale ${this.locale}`);
      }
      return key;
    }

    if (variables) {
      return interpolate(value, variables);
    }

    return value;
  }

  /**
   * Get the current locale code
   */
  getLocale(): LocaleCode {
    return this.locale;
  }
}

/**
 * Create a translator for a user, resolving their locale preference
 *
 * BUG-126 (2026-10-04 deep-dive): `logger` also goes to `resolveUserLocale`,
 * which logs a KV failure (or a malformed preferences blob) on it and still
 * falls through to the next step. Without it the degraded lookup was silent.
 */
export async function createUserTranslator(
  kv: KVNamespace,
  userId: string,
  discordLocale?: string,
  logger?: ExtendedLogger
): Promise<Translator> {
  const locale = await resolveUserLocale(kv, userId, discordLocale, logger);
  return new Translator(locale, logger);
}
