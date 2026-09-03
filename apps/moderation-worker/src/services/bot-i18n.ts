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
  meta: {
    locale: string;
    name: string;
    nativeName: string;
    flag: string;
  };
  [key: string]: unknown;
}

/**
 * English locale data (moderation-focused)
 */
const enLocale: LocaleData = {
  meta: {
    locale: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '\uD83C\uDDFA\uD83C\uDDF8',
  },
  common: {
    error: 'Error',
    success: 'Success',
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
      approved: 'Preset Approved',
      approvedDesc: '**{name}** has been approved and is now live!',
      missingReason: 'Please provide a reason for rejection.',
      rejected: 'Preset Rejected',
      rejectedDesc: '**{name}** has been rejected.',
      stats: 'Moderation Statistics',
      // FINDING-001 (2026-08-11 fix wave): the queue was widened to include
      // approved presets whose picture alone is pending, but approve/reject
      // act on the preset's own status — the wrong tool for those entries.
      // These keys mark them instead of offering the two actions that would
      // either no-op forever or wrongly pull a live palette from the gallery.
      imageOnlyNote: 'Picture pending review: {url}',
      imageOnlyNoteNoUrl: 'Picture pending review',
      footerTextOnly: 'Use /preset moderate approve <id> or reject <id> <reason>',
      footerMixedQueue:
        'approve/reject apply to the text entries only — 🖼 entries are reviewed on the moderation embed in Discord',
    },
    categories: {
      jobs: 'FFXIV Jobs',
      'grand-companies': 'Grand Companies',
      seasons: 'Seasons',
      events: 'FFXIV Events',
      aesthetics: 'Aesthetics',
      community: 'Community',
    },
  },
  ban: {
    confirmTitle: 'Confirm User Ban',
    confirmDesc:
      'Are you sure you want to ban this user from Preset Palettes?\n\nThis will **hide all their presets** and prevent them from submitting, voting, or editing presets.',
    username: 'Username',
    discordId: 'Discord ID',
    totalPresets: 'Total Presets',
    recentPresets: 'Recent Presets',
    confirmFooter: 'Click "Yes" to proceed with the ban, or "No" to cancel.',
    yesBan: 'Yes, Ban User',
    cancel: 'Cancel',
    userBanned: 'User Banned',
    userUnbanned: 'User Unbanned',
    presetsHidden: 'Presets Hidden',
    presetsRestored: 'Presets Restored',
    alreadyBanned: 'User is already banned.',
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
  private fallbackData: LocaleData;
  private logger?: ExtendedLogger;

  constructor(locale: LocaleCode, logger?: ExtendedLogger) {
    // `locale` is still resolved and recorded — analytics and log lines want to
    // know what the moderator's client asked for — but it selects nothing:
    // this bot ships one English table on purpose (I18N-009).
    this.locale = locale;
    this.data = strings;
    this.fallbackData = strings;
    this.logger = logger;
  }

  /**
   * Get a translated string
   */
  t(key: string, variables?: Record<string, string | number>): string {
    let value = getNestedValue(this.data, key);

    if (value === undefined && this.locale !== 'en') {
      value = getNestedValue(this.fallbackData, key);
    }

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

  /**
   * Get locale metadata
   *
   * @testonly unit-tested across all six locales (name/nativeName presence),
   * but no moderation-worker handler surfaces locale display metadata — this
   * bot's embeds never show a locale's name back to the moderator.
   */
  getMeta(): LocaleData['meta'] {
    return this.data.meta;
  }
}

/**
 * Create a translator for a user, resolving their locale preference
 */
export async function createUserTranslator(
  kv: KVNamespace,
  userId: string,
  discordLocale?: string,
  logger?: ExtendedLogger
): Promise<Translator> {
  const locale = await resolveUserLocale(kv, userId, discordLocale);
  return new Translator(locale, logger);
}
