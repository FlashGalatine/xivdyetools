/**
 * Discord REST API Utilities
 *
 * Helpers for sending follow-up messages, editing deferred responses,
 * and other Discord API operations.
 */

import { ALLOWED_MENTIONS_NONE } from '@xivdyetools/bot-logic';
import { sanitizeUrl, sanitizeErrorMessage } from './url-sanitizer.js';
import type { DiscordEmbed, DiscordActionRow, AllowedMentions } from './response.js';

const DISCORD_API_BASE = 'https://discord.com/api/v10';

export interface FollowUpOptions {
  content?: string;
  embeds?: DiscordEmbed[];
  components?: DiscordActionRow[];
  /** Make the message ephemeral (only visible to user) */
  ephemeral?: boolean;
  /**
   * FINDING-019 (2026-08-21 security audit): defaults to
   * `ALLOWED_MENTIONS_NONE` — nothing pings unless a caller opts in.
   */
  allowed_mentions?: AllowedMentions;
}

/** Every outbound body starts with `allowed_mentions` (caller override wins). */
function baseBody(options: { allowed_mentions?: AllowedMentions }): Record<string, unknown> {
  return { allowed_mentions: options.allowed_mentions ?? ALLOWED_MENTIONS_NONE };
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

  const body = baseBody(options);
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
      // BUG-040: this was the one Discord call in the file with no timeout,
      // while sendMessage and editMessage both carry 5 s. A stalled PATCH left
      // the moderator on Discord's "thinking…" indefinitely, and the isolate
      // holding the waitUntil promise with it.
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
 * BUG-040: throw-safe, outcome-checked `editOriginalResponse`.
 *
 * The raw call returns the Response and now carries an AbortSignal, so every
 * call site needs to read `.ok` and be ready for a throw — and none of the five
 * did. A 4xx (expired interaction token, embed over the limit) was discarded
 * silently, and a timeout rejected the `waitUntil` promise unhandled. Either
 * way the moderator saw a permanent "thinking…" with no clue whether their
 * action had landed.
 *
 * This mirrors `safeSendMessage` / `safeEditMessage` above, and the main bot's
 * `safeEditOriginalResponse`.
 *
 * @returns true when Discord accepted the edit
 */
export async function safeEditOriginalResponse(
  applicationId: string,
  interactionToken: string,
  options: FollowUpOptions
): Promise<boolean> {
  try {
    const res = await editOriginalResponse(applicationId, interactionToken, options);
    if (!res.ok) {
      console.error(
        'Discord editOriginalResponse failed',
        res.status,
        await res.text().catch(() => '')
      );
      return false;
    }
    return true;
  } catch (error) {
    console.error('Discord editOriginalResponse threw', sanitizeErrorMessage(error));
    return false;
  }
}

/**
 * Options for sending a message to a channel
 */
export interface SendMessageOptions {
  content?: string;
  embeds?: DiscordEmbed[];
  components?: DiscordActionRow[];
  /** FINDING-019: defaults to `ALLOWED_MENTIONS_NONE`. */
  allowed_mentions?: AllowedMentions;
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

  const body = baseBody(options);
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

  const body = baseBody(options);
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

/**
 * BUG-035 (2026-07-18 audit): throw-safe, outcome-checked wrappers. All
 * handler call sites previously discarded the fetch Response (silent 4xx)
 * and catch-path edits could themselves throw (5s AbortSignal timeout),
 * rejecting the surrounding waitUntil promise unhandled.
 *
 * @returns true when Discord accepted the request
 */
export async function safeSendMessage(
  botToken: string,
  channelId: string,
  options: SendMessageOptions
): Promise<boolean> {
  try {
    const res = await sendMessage(botToken, channelId, options);
    if (!res.ok) {
      console.error('Discord sendMessage failed', res.status, await res.text().catch(() => ''));
      return false;
    }
    return true;
  } catch (error) {
    console.error('Discord sendMessage threw', sanitizeErrorMessage(error));
    return false;
  }
}

/** BUG-035: throw-safe, outcome-checked editMessage */
export async function safeEditMessage(
  botToken: string,
  channelId: string,
  messageId: string,
  options: SendMessageOptions
): Promise<boolean> {
  try {
    const res = await editMessage(botToken, channelId, messageId, options);
    if (!res.ok) {
      console.error('Discord editMessage failed', res.status, await res.text().catch(() => ''));
      return false;
    }
    return true;
  } catch (error) {
    console.error('Discord editMessage threw', sanitizeErrorMessage(error));
    return false;
  }
}
