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
    },
    status: {
      pending: 'Pending',
      approved: 'Approved',
      rejected: 'Rejected',
      flagged: 'Flagged',
      hidden: 'Hidden',
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
 * All loaded locales (only English for moderation bot)
 */
const locales: Record<LocaleCode, LocaleData> = {
  en: enLocale,
  ja: enLocale, // Fallback to English
  de: enLocale,
  fr: enLocale,
  ko: enLocale,
  zh: enLocale,
};

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
  return template.replace(/\{(\w+)\}/g, (match, key) => {
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
    this.locale = locale;
    this.data = locales[locale] || locales.en;
    this.fallbackData = locales.en;
    this.logger = logger;
  }

  /**
   * Get a translated string
   */
  t(key: string, variables?: Record<string, string | number>): string {
    let value = getNestedValue(this.data as Record<string, unknown>, key);

    if (value === undefined && this.locale !== 'en') {
      value = getNestedValue(this.fallbackData as Record<string, unknown>, key);
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
   */
  getMeta(): LocaleData['meta'] {
    return this.data.meta;
  }
}

/**
 * Create a translator for a specific locale
 */
export function createTranslator(locale: LocaleCode, logger?: ExtendedLogger): Translator {
  return new Translator(locale, logger);
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
