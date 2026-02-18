/**
 * Discord REST API Utilities
 *
 * Helpers for sending follow-up messages, editing deferred responses,
 * and other Discord API operations.
 */

import { sanitizeUrl, sanitizeErrorMessage } from './url-sanitizer.js';
import type { DiscordEmbed, DiscordActionRow } from './response.js';

const DISCORD_API_BASE = 'https://discord.com/api/v10';

export interface FollowUpOptions {
  content?: string;
  embeds?: DiscordEmbed[];
  components?: DiscordActionRow[];
  /** Make the message ephemeral (only visible to user) */
  ephemeral?: boolean;
}

/**
 * Sends a follow-up message to a deferred interaction.
 */
export async function sendFollowUp(
  applicationId: string,
  interactionToken: string,
  options: FollowUpOptions
): Promise<Response> {
  const url = `${DISCORD_API_BASE}/webhooks/${applicationId}/${interactionToken}`;

  const body: Record<string, unknown> = {};
  if (options.content) body.content = options.content;
  if (options.embeds) body.embeds = options.embeds;
  if (options.components) body.components = options.components;
  if (options.ephemeral) body.flags = 64;

  try {
    return await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.error('Discord API request failed', {
      url: sanitizeUrl(url),
      error: sanitizeErrorMessage(error),
    });
    throw error;
  }
}

/**
 * Edits the original deferred response.
 */
export async function editOriginalResponse(
  applicationId: string,
  interactionToken: string,
  options: FollowUpOptions
): Promise<Response> {
  const url = `${DISCORD_API_BASE}/webhooks/${applicationId}/${interactionToken}/messages/@original`;

  const body: Record<string, unknown> = {};
  if (options.content) body.content = options.content;
  if (options.embeds) body.embeds = options.embeds;
  if (options.components) body.components = options.components;

  try {
    return await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.error('Discord API request failed', {
      url: sanitizeUrl(url),
      error: sanitizeErrorMessage(error),
    });
    throw error;
  }
}

/**
 * Deletes the original interaction response.
 */
export async function deleteOriginalResponse(
  applicationId: string,
  interactionToken: string
): Promise<Response> {
  const url = `${DISCORD_API_BASE}/webhooks/${applicationId}/${interactionToken}/messages/@original`;

  try {
    return await fetch(url, {
      method: 'DELETE',
    });
  } catch (error) {
    console.error('Discord API request failed', {
      url: sanitizeUrl(url),
      error: sanitizeErrorMessage(error),
    });
    throw error;
  }
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

  try {
    return await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bot ${botToken}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
  } catch (error) {
    console.error('Discord API request failed', {
      url: sanitizeUrl(url),
      error: sanitizeErrorMessage(error),
    });
    throw error;
  }
}

/**
 * Edits a message in a channel.
 * Requires bot token authentication.
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

  try {
    return await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bot ${botToken}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
  } catch (error) {
    console.error('Discord API request failed', {
      url: sanitizeUrl(url),
      error: sanitizeErrorMessage(error),
    });
    throw error;
  }
}
