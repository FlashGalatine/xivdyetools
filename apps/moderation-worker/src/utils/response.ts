/**
 * Discord Interaction Response Builders
 *
 * Helper functions to create properly formatted Discord interaction responses.
 * @see https://discord.com/developers/docs/interactions/receiving-and-responding
 */

import { ALLOWED_MENTIONS_NONE } from '@xivdyetools/bot-logic';
import { InteractionResponseType } from '../types/env.js';

/**
 * Discord `allowed_mentions` object. FINDING-019 (2026-08-21 security audit):
 * every response / follow-up / channel post built by this worker carries
 * `ALLOWED_MENTIONS_NONE` unless a caller explicitly supplies its own, so user
 * text echoed into `content` can never ping @everyone, roles or users.
 */
export interface AllowedMentions {
  parse: readonly string[];
  users?: string[];
  roles?: string[];
  replied_user?: boolean;
}

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
  /** Defaults to `ALLOWED_MENTIONS_NONE` (FINDING-019); set explicitly to allow pings. */
  allowed_mentions?: AllowedMentions;
}

/**
 * Spread `ALLOWED_MENTIONS_NONE` under any caller-supplied `allowed_mentions`
 * (FINDING-019). Caller wins, default otherwise.
 */
function withAllowedMentions<T extends { allowed_mentions?: AllowedMentions }>(
  data: T
): T & { allowed_mentions: AllowedMentions } {
  return { allowed_mentions: ALLOWED_MENTIONS_NONE, ...data };
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
    data: withAllowedMentions(data),
  });
}

/**
 * Creates an UPDATE_MESSAGE response (edits the message the component /
 * modal came from). Carries `allowed_mentions` like every other text-bearing
 * response (FINDING-019).
 */
export function updateMessageResponse(data: InteractionResponseData): Response {
  return Response.json({
    type: InteractionResponseType.UPDATE_MESSAGE,
    data: withAllowedMentions(data),
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
 * Creates a deferred response (shows "thinking..." state).
 */
export function deferredResponse(ephemeral = false): Response {
  return Response.json({
    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
    data: ephemeral ? { flags: MessageFlags.EPHEMERAL } : undefined,
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
    // MOD-8 (FINDING-034, 2026-08-21 audit): a 5xx / transport error carries
    // an upstream body — never fall through to the generic Error branch
    return fallbackMessage;
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
      // MOD-8 (FINDING-034, 2026-08-21 audit): D1 / SQLite internals — the
      // runtime's messages name tables, columns and constraints
      /\bD1_/,
      /\bSQLITE_/,
      /\bno such (table|column|index)\b/i,
      /\bconstraint\b/i,
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

// Base64URL encode/decode used to live here as a hand-rolled pair. They are now
// `base64UrlEncode` / `base64UrlDecode` from `@xivdyetools/auth/encoding`, which this
// worker already depends on (2026-09-01 dead-code audit, DEAD-017). The local copy also
// spread the whole byte array into String.fromCharCode, which the package avoids.

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
export function rateLimitedResponse(_resetTime: number): Response {
  return new Response(
    JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: 'Rate limit exceeded. Please wait before trying again.',
        flags: MessageFlags.EPHEMERAL,
        allowed_mentions: ALLOWED_MENTIONS_NONE,
      },
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}
