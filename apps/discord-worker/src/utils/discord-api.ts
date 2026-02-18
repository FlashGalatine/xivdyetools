/**
 * Discord REST API Utilities
 *
 * Helpers for sending follow-up messages with attachments,
 * editing deferred responses, and other Discord API operations.
 *
 * DISCORD-PERF-001: Added deadline tracking to prevent failed interactions
 * when processing takes longer than Discord's 3-second timeout.
 */

import type { DiscordEmbed, DiscordActionRow } from './response.js';
import type { ExtendedLogger } from '@xivdyetools/logger';

const DISCORD_API_BASE = 'https://discord.com/api/v10';

/**
 * Timeout for Discord webhook API requests without file uploads (ms).
 * BUG-004: Prevents indefinite hangs when Discord's webhook endpoint is slow.
 */
const DISCORD_WEBHOOK_TIMEOUT = 5000;

/**
 * Timeout for Discord webhook API requests with file uploads (ms).
 * Multipart form data with PNG attachments needs more time to transmit.
 */
const DISCORD_WEBHOOK_FILE_TIMEOUT = 10000;

/**
 * Discord's deadline for initial interaction response is 3 seconds.
 * We use 2800ms as our deadline with a 200ms safety buffer.
 */
const DISCORD_DEADLINE_MS = 2800;

/**
 * Interaction context that tracks timing for deadline enforcement.
 * DISCORD-PERF-001: Prevents "This interaction failed" errors.
 */
export class InteractionContext {
  private readonly startTime: number;
  private readonly deadlineMs: number;
  public readonly applicationId: string;
  public readonly interactionToken: string;

  constructor(applicationId: string, interactionToken: string, deadlineMs = DISCORD_DEADLINE_MS) {
    this.startTime = Date.now();
    this.deadlineMs = deadlineMs;
    this.applicationId = applicationId;
    this.interactionToken = interactionToken;
  }

  /**
   * Returns the elapsed time since this context was created.
   */
  get elapsedMs(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Returns the remaining time before the deadline.
   */
  get remainingMs(): number {
    return Math.max(0, this.deadlineMs - this.elapsedMs);
  }

  /**
   * Returns true if the deadline has passed.
   */
  get isDeadlineExceeded(): boolean {
    return this.elapsedMs > this.deadlineMs;
  }

  /**
   * Logs a warning if the deadline was exceeded.
   *
   * @param operation - Description of the operation for the log message
   * @param logger - Optional logger for structured logging
   */
  logDeadlineStatus(operation: string, logger?: ExtendedLogger): void {
    if (this.isDeadlineExceeded) {
      const message = `DISCORD-PERF-001: ${operation} - Deadline exceeded by ${this.elapsedMs - this.deadlineMs}ms`;
      if (logger) {
        logger.warn(message);
      }
    }
  }
}

/**
 * Creates an interaction context for deadline tracking.
 */
export function createInteractionContext(
  applicationId: string,
  interactionToken: string
): InteractionContext {
  return new InteractionContext(applicationId, interactionToken);
}

export interface FollowUpOptions {
  content?: string;
  embeds?: DiscordEmbed[];
  components?: DiscordActionRow[];
  /** File attachment */
  file?: {
    name: string;
    data: Uint8Array;
    contentType: string;
  };
  /** Make the message ephemeral (only visible to user) */
  ephemeral?: boolean;
}

/**
 * Sends a follow-up message to a deferred interaction.
 * Use this after responding with DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE.
 *
 * @param applicationId - Your Discord application ID
 * @param interactionToken - The interaction token from the original request
 * @param options - Message content and options
 */
export async function sendFollowUp(
  applicationId: string,
  interactionToken: string,
  options: FollowUpOptions
): Promise<Response> {
  const url = `${DISCORD_API_BASE}/webhooks/${applicationId}/${interactionToken}`;

  // If there's a file, use multipart form data
  if (options.file) {
    return sendFollowUpWithFile(url, options);
  }

  // Otherwise, send JSON
  const body: Record<string, unknown> = {};
  if (options.content) body.content = options.content;
  if (options.embeds) body.embeds = options.embeds;
  if (options.components) body.components = options.components;
  if (options.ephemeral) body.flags = 64;

  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(DISCORD_WEBHOOK_TIMEOUT),
  });
}

/**
 * Sends a follow-up message with a file attachment using multipart form data.
 */
async function sendFollowUpWithFile(
  url: string,
  options: FollowUpOptions
): Promise<Response> {
  const formData = new FormData();

  // Build the payload_json part
  const payload: Record<string, unknown> = {};

  if (options.content) payload.content = options.content;
  if (options.ephemeral) payload.flags = 64;

  // If we have embeds with image references, we need to reference the attachment
  // Note: options.file is guaranteed truthy since this function is only called when file exists
  if (options.embeds) {
    payload.embeds = options.embeds.map((embed) => {
      // If the embed has an image placeholder, replace with attachment reference
      if (embed.image?.url === 'attachment://image.png') {
        return {
          ...embed,
          image: { url: `attachment://${options.file!.name}` },
        };
      }
      return embed;
    });
  }

  if (options.components) payload.components = options.components;

  // Add attachments metadata
  if (options.file) {
    payload.attachments = [
      {
        id: 0,
        filename: options.file.name,
      },
    ];
  }

  formData.append('payload_json', JSON.stringify(payload));

  // Add the file
  if (options.file) {
    const blob = new Blob([options.file.data], { type: options.file.contentType });
    formData.append('files[0]', blob, options.file.name);
  }

  return fetch(url, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(DISCORD_WEBHOOK_FILE_TIMEOUT),
  });
}

/**
 * Edits the original deferred response.
 * Use this to update the "thinking..." message with actual content.
 */
export async function editOriginalResponse(
  applicationId: string,
  interactionToken: string,
  options: FollowUpOptions
): Promise<Response> {
  const url = `${DISCORD_API_BASE}/webhooks/${applicationId}/${interactionToken}/messages/@original`;

  // If there's a file, use multipart form data
  if (options.file) {
    return editResponseWithFile(url, options);
  }

  // Otherwise, send JSON
  const body: Record<string, unknown> = {};
  if (options.content) body.content = options.content;
  if (options.embeds) body.embeds = options.embeds;
  if (options.components) body.components = options.components;

  return fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(DISCORD_WEBHOOK_TIMEOUT),
  });
}

/**
 * Edits the original response with a file attachment.
 */
async function editResponseWithFile(
  url: string,
  options: FollowUpOptions
): Promise<Response> {
  const formData = new FormData();

  // Build the payload_json part
  const payload: Record<string, unknown> = {};

  if (options.content) payload.content = options.content;

  // Handle embeds with image attachments
  // Note: options.file is guaranteed truthy since this function is only called when file exists
  if (options.embeds) {
    payload.embeds = options.embeds.map((embed) => {
      if (embed.image?.url === 'attachment://image.png') {
        return {
          ...embed,
          image: { url: `attachment://${options.file!.name}` },
        };
      }
      return embed;
    });
  }

  if (options.components) payload.components = options.components;

  // Add attachments metadata
  if (options.file) {
    payload.attachments = [
      {
        id: 0,
        filename: options.file.name,
      },
    ];
  }

  formData.append('payload_json', JSON.stringify(payload));

  // Add the file
  if (options.file) {
    const blob = new Blob([options.file.data], { type: options.file.contentType });
    formData.append('files[0]', blob, options.file.name);
  }

  return fetch(url, {
    method: 'PATCH',
    body: formData,
    signal: AbortSignal.timeout(DISCORD_WEBHOOK_FILE_TIMEOUT),
  });
}

/**
 * Deletes the original interaction response.
 */
export async function deleteOriginalResponse(
  applicationId: string,
  interactionToken: string
): Promise<Response> {
  const url = `${DISCORD_API_BASE}/webhooks/${applicationId}/${interactionToken}/messages/@original`;

  return fetch(url, {
    method: 'DELETE',
    signal: AbortSignal.timeout(DISCORD_WEBHOOK_TIMEOUT),
  });
}

/**
 * Options for sending a message to a channel
 */
export interface SendMessageOptions {
  content?: string;
  embeds?: DiscordEmbed[];
  components?: DiscordActionRow[];
}

/**
 * Sends a message to a Discord channel.
 * Requires bot token authentication.
 *
 * @param botToken - Discord bot token
 * @param channelId - Target channel ID
 * @param options - Message content and options
 */
export async function sendMessage(
  botToken: string,
  channelId: string,
  options: SendMessageOptions
): Promise<Response> {
  const url = `${DISCORD_API_BASE}/channels/${channelId}/messages`;

  const body: Record<string, unknown> = {};
  if (options.content) body.content = options.content;
  if (options.embeds) body.embeds = options.embeds;
  if (options.components) body.components = options.components;

  // DISCORD-HIGH-002: Add 5 second timeout to prevent worker hang
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bot ${botToken}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
}

/**
 * Edits a message in a channel.
 * Requires bot token authentication.
 *
 * @param botToken - Discord bot token
 * @param channelId - Channel ID containing the message
 * @param messageId - Message ID to edit
 * @param options - New message content and options
 */
export async function editMessage(
  botToken: string,
  channelId: string,
  messageId: string,
  options: SendMessageOptions
): Promise<Response> {
  const url = `${DISCORD_API_BASE}/channels/${channelId}/messages/${messageId}`;

  const body: Record<string, unknown> = {};
  if (options.content) body.content = options.content;
  if (options.embeds) body.embeds = options.embeds;
  if (options.components) body.components = options.components;

  // DISCORD-HIGH-002: Add 5 second timeout to prevent worker hang
  return fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bot ${botToken}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
}

// ============================================
// DEADLINE-AWARE HELPERS (DISCORD-PERF-001)
// ============================================

/**
 * Result of a deadline-aware operation.
 */
export interface DeadlineResult {
  /** Whether the operation was sent (deadline not exceeded) */
  sent: boolean;
  /** The response from Discord if sent, undefined otherwise */
  response?: Response;
  /** The elapsed time in milliseconds */
  elapsedMs: number;
  /** Whether the deadline was exceeded */
  deadlineExceeded: boolean;
}

/**
 * Sends a follow-up message with deadline checking.
 * DISCORD-PERF-001: Returns early if deadline is exceeded to avoid "interaction failed".
 *
 * @param context - The interaction context with deadline tracking
 * @param options - Follow-up message options
 * @returns Result indicating whether the message was sent
 */
export async function sendFollowUpWithDeadline(
  context: InteractionContext,
  options: FollowUpOptions
): Promise<DeadlineResult> {
  context.logDeadlineStatus('sendFollowUp');

  // If deadline is exceeded, don't even try - Discord will reject it
  if (context.isDeadlineExceeded) {
    return {
      sent: false,
      elapsedMs: context.elapsedMs,
      deadlineExceeded: true,
    };
  }

  const response = await sendFollowUp(
    context.applicationId,
    context.interactionToken,
    options
  );

  return {
    sent: true,
    response,
    elapsedMs: context.elapsedMs,
    deadlineExceeded: false,
  };
}

/**
 * Edits the original response with deadline checking.
 * DISCORD-PERF-001: Returns early if deadline is exceeded to avoid "interaction failed".
 *
 * @param context - The interaction context with deadline tracking
 * @param options - Edit message options
 * @returns Result indicating whether the edit was sent
 */
export async function editOriginalResponseWithDeadline(
  context: InteractionContext,
  options: FollowUpOptions
): Promise<DeadlineResult> {
  context.logDeadlineStatus('editOriginalResponse');

  // If deadline is exceeded, don't even try - Discord will reject it
  if (context.isDeadlineExceeded) {
    return {
      sent: false,
      elapsedMs: context.elapsedMs,
      deadlineExceeded: true,
    };
  }

  const response = await editOriginalResponse(
    context.applicationId,
    context.interactionToken,
    options
  );

  return {
    sent: true,
    response,
    elapsedMs: context.elapsedMs,
    deadlineExceeded: false,
  };
}
