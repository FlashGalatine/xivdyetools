/**
 * Error UX Standard (V4)
 *
 * Provides consistent error handling with 6 distinct categories,
 * each with unique emoji, color, and messaging style.
 *
 * Categories:
 * - validation: User input errors (invalid hex, invalid dye name)
 * - notFound: Resource not found (dye doesn't exist, collection missing)
 * - rateLimit: Rate limiting / cooldown
 * - external: External API failures (Universalis timeout, service unavailable)
 * - internal: Internal errors (render failure, unexpected state)
 * - permission: Access denied (admin-only, guild restrictions)
 *
 * @module utils/error-response
 */

import type { DiscordEmbed, InteractionResponseData } from './response.js';
import { MessageFlags } from './response.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Error category determines styling and UX
 */
export type ErrorCategory =
  | 'validation'
  | 'notFound'
  | 'rateLimit'
  | 'external'
  | 'internal'
  | 'permission';

/**
 * Error code format: ERR-{CATEGORY_PREFIX}-{NUMBER}
 * e.g., ERR-V001 (validation), ERR-N001 (not found)
 */
export type ErrorCode =
  | `ERR-V${number}` // Validation
  | `ERR-N${number}` // Not Found
  | `ERR-R${number}` // Rate Limit
  | `ERR-E${number}` // External
  | `ERR-I${number}` // Internal
  | `ERR-P${number}`; // Permission

/**
 * Options for creating error responses
 */
export interface ErrorResponseOptions {
  /** Error category */
  category: ErrorCategory;
  /** Main error message (shown to user) */
  message: string;
  /** Detailed description (optional, shown in embed description) */
  details?: string;
  /** Suggestions for how to fix (optional, shown as bullet points) */
  suggestions?: string[];
  /** Error code for debugging */
  code?: ErrorCode;
  /** Rate limit: seconds until retry allowed */
  retryAfterSeconds?: number;
  /** Not found: fuzzy match suggestions */
  alternatives?: string[];
  /** Footer text (e.g., "Use /manual for help") */
  footer?: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Visual styling for each error category
 */
const CATEGORY_STYLES: Record<ErrorCategory, { emoji: string; color: number; title: string }> = {
  validation: {
    emoji: '❌',
    color: 0xed4245, // Red
    title: 'Invalid Input',
  },
  notFound: {
    emoji: '🔍',
    color: 0xf5a623, // Orange
    title: 'Not Found',
  },
  rateLimit: {
    emoji: '⏳',
    color: 0xfee75c, // Yellow
    title: 'Slow Down',
  },
  external: {
    emoji: '🌐',
    color: 0xf5a623, // Orange
    title: 'Service Unavailable',
  },
  internal: {
    emoji: '⚠️',
    color: 0xed4245, // Red
    title: 'Something Went Wrong',
  },
  permission: {
    emoji: '🔒',
    color: 0x99aab5, // Gray
    title: 'Access Denied',
  },
};

// ============================================================================
// Error Embed Builder
// ============================================================================

/**
 * Create a styled error embed
 *
 * @param options - Error response options
 * @returns Discord embed object
 */
export function createErrorEmbed(options: ErrorResponseOptions): DiscordEmbed {
  const style = CATEGORY_STYLES[options.category];
  const embed: DiscordEmbed = {
    title: `${style.emoji} ${style.title}`,
    description: options.message,
    color: style.color,
  };

  // Add details if provided
  if (options.details) {
    embed.description += `\n\n${options.details}`;
  }

  // Add suggestions as bullet points
  if (options.suggestions && options.suggestions.length > 0) {
    const suggestionList = options.suggestions.map((s) => `• ${s}`).join('\n');
    embed.description += `\n\n**Suggestions:**\n${suggestionList}`;
  }

  // Add fuzzy match alternatives for notFound errors
  if (options.alternatives && options.alternatives.length > 0) {
    const altList = options.alternatives.slice(0, 5).map((a) => `\`${a}\``).join(', ');
    embed.fields = [
      {
        name: 'Did you mean?',
        value: altList,
        inline: false,
      },
    ];
  }

  // Add retry info for rate limit errors
  if (options.category === 'rateLimit' && options.retryAfterSeconds) {
    embed.description += `\n\nYou can try again <t:${Math.floor(Date.now() / 1000) + options.retryAfterSeconds}:R>.`;
  }

  // Add footer with error code
  const footerParts: string[] = [];
  if (options.code) {
    footerParts.push(options.code);
  }
  if (options.footer) {
    footerParts.push(options.footer);
  }
  if (footerParts.length > 0) {
    embed.footer = { text: footerParts.join(' • ') };
  }

  return embed;
}

/**
 * Create a full error response (ephemeral by default)
 *
 * @param options - Error response options
 * @returns Interaction response data
 */
export function createErrorResponse(options: ErrorResponseOptions): InteractionResponseData {
  return {
    embeds: [createErrorEmbed(options)],
    flags: MessageFlags.EPHEMERAL,
  };
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create a validation error response
 *
 * @param message - Error message
 * @param suggestions - Optional fix suggestions
 * @param code - Optional error code
 */
export function validationError(
  message: string,
  suggestions?: string[],
  code?: ErrorCode
): InteractionResponseData {
  return createErrorResponse({
    category: 'validation',
    message,
    suggestions,
    code: code ?? 'ERR-V001',
  });
}

/**
 * Create a not-found error response with fuzzy suggestions
 *
 * @param resourceType - What was being searched for (e.g., "Dye", "Collection")
 * @param searchTerm - The term that wasn't found
 * @param alternatives - Fuzzy match suggestions
 * @param code - Optional error code
 */
export function notFoundError(
  resourceType: string,
  searchTerm: string,
  alternatives?: string[],
  code?: ErrorCode
): InteractionResponseData {
  return createErrorResponse({
    category: 'notFound',
    message: `${resourceType} \`${searchTerm}\` was not found.`,
    alternatives,
    code: code ?? 'ERR-N001',
    footer: 'Use /dye search to find valid dye names',
  });
}

/**
 * Create a rate limit error response
 *
 * @param retryAfterSeconds - Seconds until retry allowed
 * @param code - Optional error code
 */
export function rateLimitError(
  retryAfterSeconds: number,
  code?: ErrorCode
): InteractionResponseData {
  return createErrorResponse({
    category: 'rateLimit',
    message: 'You\'re using commands too quickly.',
    details: 'To ensure a great experience for everyone, please wait before trying again.',
    retryAfterSeconds,
    code: code ?? 'ERR-R001',
  });
}

/**
 * Create an external service error response
 *
 * @param serviceName - Name of the failing service (e.g., "Universalis API")
 * @param code - Optional error code
 */
export function externalError(
  serviceName: string,
  code?: ErrorCode
): InteractionResponseData {
  return createErrorResponse({
    category: 'external',
    message: `Unable to reach ${serviceName}.`,
    details: 'This is a temporary issue. Please try again in a moment.',
    code: code ?? 'ERR-E001',
    footer: 'If this persists, the external service may be down',
  });
}

/**
 * Create an internal error response
 *
 * Does NOT expose technical details to users.
 *
 * @param code - Error code for debugging
 */
export function internalError(code?: ErrorCode): InteractionResponseData {
  return createErrorResponse({
    category: 'internal',
    message: 'An unexpected error occurred.',
    details: 'This has been logged and will be investigated.',
    code: code ?? 'ERR-I001',
    footer: 'If this persists, please report it',
  });
}

/**
 * Create a permission error response
 *
 * @param reason - Why access was denied
 * @param code - Optional error code
 */
export function permissionError(
  reason: string,
  code?: ErrorCode
): InteractionResponseData {
  return createErrorResponse({
    category: 'permission',
    message: reason,
    code: code ?? 'ERR-P001',
  });
}

// ============================================================================
// Specific Error Builders
// ============================================================================

/**
 * Invalid hex color error
 */
export function invalidHexError(input: string): InteractionResponseData {
  return validationError(
    `\`${input}\` is not a valid hex color code.`,
    [
      'Use format `#RRGGBB` (e.g., `#FF5733`)',
      'Use format `#RGB` (e.g., `#F53`)',
      'Or enter a dye name instead',
    ],
    'ERR-V002'
  );
}

/**
 * Invalid dye name error
 */
export function invalidDyeError(
  input: string,
  alternatives?: string[]
): InteractionResponseData {
  return createErrorResponse({
    category: 'notFound',
    message: `No dye found matching \`${input}\`.`,
    alternatives,
    code: 'ERR-N002',
    footer: 'Use /dye search to browse available dyes',
  });
}

/**
 * Invalid count error
 */
export function invalidCountError(min: number, max: number): InteractionResponseData {
  return validationError(
    `Count must be between ${min} and ${max}.`,
    undefined,
    'ERR-V003'
  );
}

/**
 * Collection not found error
 */
export function collectionNotFoundError(name: string): InteractionResponseData {
  return createErrorResponse({
    category: 'notFound',
    message: `Collection \`${name}\` was not found.`,
    code: 'ERR-N003',
    footer: 'Use /collection list to see your collections',
  });
}

/**
 * Collection limit reached error
 */
export function collectionLimitError(limit: number): InteractionResponseData {
  return validationError(
    `You've reached the maximum of ${limit} collections.`,
    ['Delete an existing collection to create a new one'],
    'ERR-V004'
  );
}

/**
 * Dye already in collection error
 */
export function dyeAlreadyInCollectionError(dyeName: string, collectionName: string): InteractionResponseData {
  return validationError(
    `\`${dyeName}\` is already in \`${collectionName}\`.`,
    undefined,
    'ERR-V005'
  );
}

/**
 * Preset not found error
 */
export function presetNotFoundError(name: string): InteractionResponseData {
  return createErrorResponse({
    category: 'notFound',
    message: `Preset \`${name}\` was not found.`,
    code: 'ERR-N004',
    footer: 'Use /preset list to browse community presets',
  });
}

/**
 * Universalis API error
 */
export function universalisError(): InteractionResponseData {
  return externalError('Universalis API (Market Board)', 'ERR-E002');
}

/**
 * Image render error
 */
export function renderError(): InteractionResponseData {
  return createErrorResponse({
    category: 'internal',
    message: 'Failed to generate the image.',
    details: 'This error has been logged. Please try again.',
    code: 'ERR-I002',
  });
}

/**
 * Admin-only command error
 */
export function adminOnlyError(): InteractionResponseData {
  return permissionError(
    'This command is restricted to bot administrators.',
    'ERR-P002'
  );
}

/**
 * Guild-only command error
 */
export function guildOnlyError(): InteractionResponseData {
  return permissionError(
    'This command can only be used in a server, not in DMs.',
    'ERR-P003'
  );
}

// ============================================================================
// Error Code Registry (for documentation)
// ============================================================================

/**
 * Error code descriptions for documentation/debugging
 */
export const ERROR_CODE_DESCRIPTIONS: Record<string, string> = {
  // Validation errors
  'ERR-V001': 'Generic validation error',
  'ERR-V002': 'Invalid hex color format',
  'ERR-V003': 'Count out of valid range',
  'ERR-V004': 'Collection limit reached',
  'ERR-V005': 'Dye already exists in collection',
  'ERR-V006': 'Invalid blending mode',
  'ERR-V007': 'Invalid matching method',
  'ERR-V008': 'Invalid clan name',
  'ERR-V009': 'Invalid gender value',
  'ERR-V010': 'Invalid language code',

  // Not Found errors
  'ERR-N001': 'Generic resource not found',
  'ERR-N002': 'Dye not found',
  'ERR-N003': 'Collection not found',
  'ERR-N004': 'Preset not found',
  'ERR-N005': 'User preferences not found',

  // Rate Limit errors
  'ERR-R001': 'Command rate limit exceeded',
  'ERR-R002': 'Image processing rate limit exceeded',

  // External errors
  'ERR-E001': 'Generic external service error',
  'ERR-E002': 'Universalis API unavailable',
  'ERR-E003': 'Preset API unavailable',

  // Internal errors
  'ERR-I001': 'Generic internal error',
  'ERR-I002': 'Image render failure',
  'ERR-I003': 'KV storage error',
  'ERR-I004': 'Analytics error',

  // Permission errors
  'ERR-P001': 'Generic permission error',
  'ERR-P002': 'Admin-only command',
  'ERR-P003': 'Guild-only command',
  'ERR-P004': 'User banned from presets',
};
