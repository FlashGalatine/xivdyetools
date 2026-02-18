/**
 * Discord Interaction Response Builders
 *
 * Helper functions to create properly formatted Discord interaction responses.
 * @see https://discord.com/developers/docs/interactions/receiving-and-responding
 */

import { InteractionResponseType } from '../types/env.js';

/**
 * Discord Embed structure
 */
export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  footer?: {
    text: string;
    icon_url?: string;
  };
  image?: {
    url: string;
  };
  thumbnail?: {
    url: string;
  };
  author?: {
    name: string;
    icon_url?: string;
    url?: string;
  };
  timestamp?: string;
}

/**
 * Discord Button Component
 */
export interface DiscordButton {
  type: 2;
  style: 1 | 2 | 3 | 4 | 5;
  label?: string;
  emoji?: { name: string; id?: string };
  custom_id?: string;
  url?: string;
  disabled?: boolean;
}

/**
 * Discord Action Row (container for buttons)
 */
export interface DiscordActionRow {
  type: 1;
  components: DiscordButton[];
}

/**
 * Interaction response data structure
 */
export interface InteractionResponseData {
  content?: string;
  embeds?: DiscordEmbed[];
  components?: DiscordActionRow[];
  flags?: number;
}

// Response flags
export const MessageFlags = Object.freeze({
  EPHEMERAL: 64,
} as const);

/**
 * Creates a PONG response for Discord's PING verification.
 */
export function pongResponse(): Response {
  return Response.json({ type: InteractionResponseType.PONG });
}

/**
 * Creates an immediate message response.
 */
export function messageResponse(data: InteractionResponseData): Response {
  return Response.json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data,
  });
}

/**
 * Creates an ephemeral (private) message response.
 */
export function ephemeralResponse(content: string | InteractionResponseData): Response {
  if (typeof content === 'string') {
    return messageResponse({
      content,
      flags: MessageFlags.EPHEMERAL,
    });
  }
  return messageResponse({
    ...content,
    flags: (content.flags ?? 0) | MessageFlags.EPHEMERAL,
  });
}

/**
 * Creates an embed message response.
 */
export function embedResponse(embed: DiscordEmbed, components?: DiscordActionRow[]): Response {
  return messageResponse({
    embeds: [embed],
    components,
  });
}

/**
 * Creates a deferred response (shows "thinking..." state).
 */
export function deferredResponse(ephemeral = false): Response {
  return Response.json({
    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
    data: ephemeral ? { flags: MessageFlags.EPHEMERAL } : undefined,
  });
}

/**
 * Creates an autocomplete response with choices.
 */
export function autocompleteResponse(
  choices: Array<{ name: string; value: string }>
): Response {
  return Response.json({
    type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
    data: { choices },
  });
}

/**
 * Creates an error embed with consistent styling.
 */
export function errorEmbed(title: string, description: string): DiscordEmbed {
  return {
    title: `\u274C ${title}`,
    description,
    color: 0xff0000,
  };
}

/**
 * Creates a success embed with consistent styling.
 */
export function successEmbed(title: string, description: string): DiscordEmbed {
  return {
    title: `\u2705 ${title}`,
    description,
    color: 0x00ff00,
  };
}

/**
 * Creates an info embed with consistent styling.
 */
export function infoEmbed(title: string, description: string): DiscordEmbed {
  return {
    title: `\u2139\uFE0F ${title}`,
    description,
    color: 0x5865f2,
  };
}

/**
 * Converts a hex color string to a Discord color integer.
 */
export function hexToDiscordColor(hex: string): number {
  const cleanHex = hex.replace('#', '');
  return parseInt(cleanHex, 16);
}

/**
 * Sanitizes error messages for display to users.
 * Prevents internal error details from leaking to Discord messages.
 *
 * @param error - The error to sanitize
 * @param fallbackMessage - Generic message to show if error is not user-safe
 * @returns A safe error message string
 */
export function sanitizeErrorMessage(
  error: unknown,
  fallbackMessage = 'An unexpected error occurred.'
): string {
  // If it's a PresetAPIError with a safe message, use it
  if (error && typeof error === 'object' && 'statusCode' in error && 'message' in error) {
    const apiError = error as { statusCode: number; message: string };
    // Only show API error messages for client errors (4xx), not server errors (5xx)
    if (apiError.statusCode >= 400 && apiError.statusCode < 500) {
      return apiError.message;
    }
  }

  // For generic Error objects, only show message if it looks user-friendly
  // (doesn't contain file paths, stack traces, SQL, or internal details)
  if (error instanceof Error) {
    const msg = error.message;
    const unsafePatterns = [
      /\bstack\b/i,
      /\bat\s+\w+/, // Stack trace line
      /\.ts:\d+/, // TypeScript file references
      /\.js:\d+/, // JavaScript file references
      /\bSQL\b/i,
      /\bSELECT\b/i,
      /\bINSERT\b/i,
      /\bUPDATE\b/i,
      /\bDELETE\b/i,
      /\benv\./i,
      /\bprocess\./i,
    ];

    if (!unsafePatterns.some((pattern) => pattern.test(msg))) {
      return msg;
    }
  }

  return fallbackMessage;
}

/**
 * UUID v4 validation regex
 * Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 * where x is any hex digit and y is one of 8, 9, a, or b
 */
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates if a string is a valid UUID v4 format
 * @param id - The string to validate
 * @returns true if valid UUID v4, false otherwise
 */
export function isValidUuid(id: string): boolean {
  return UUID_V4_REGEX.test(id);
}

/**
 * Encodes a string to base64url (URL-safe base64, no padding)
 * Safe for use in Discord custom_ids and URLs
 *
 * @param str - The string to encode
 * @returns Base64url encoded string
 */
export function encodeBase64Url(str: string): string {
  // TextEncoder is available in Cloudflare Workers
  const bytes = new TextEncoder().encode(str);
  const base64 = btoa(String.fromCharCode(...bytes));

  // Convert to URL-safe format: replace +/= with -_ and remove padding
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Decodes a base64url string back to original string
 *
 * @param str - The base64url encoded string
 * @returns Decoded original string
 * @throws Error if the input is not valid base64url
 */
export function decodeBase64Url(str: string): string {
  // Convert from URL-safe format back to standard base64
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');

  // Add padding if needed
  while (base64.length % 4) {
    base64 += '=';
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new TextDecoder().decode(bytes);
}

/**
 * Creates a rate-limited (429) response
 *
 * Returns an ephemeral message informing the user they've exceeded the rate limit,
 * along with appropriate HTTP headers.
 *
 * @param resetTime - Unix timestamp (ms) when the rate limit resets
 * @returns Response with 429 status and Retry-After header
 *
 * @example
 * ```typescript
 * if (!rateLimitCheck.allowed) {
 *   return rateLimitedResponse(rateLimitCheck.resetTime);
 * }
 * ```
 */
export function rateLimitedResponse(resetTime: number): Response {
  const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);

  return new Response(
    JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: 'Rate limit exceeded. Please wait before trying again.',
        flags: MessageFlags.EPHEMERAL,
      },
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(Math.max(1, retryAfter)), // At least 1 second
      },
    }
  );
}
