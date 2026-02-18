/**
 * Discord Interaction Response Builders
 *
 * Helper functions to create properly formatted Discord interaction responses.
 * @see https://discord.com/developers/docs/interactions/receiving-and-responding
 */

import { InteractionResponseType } from '../types/env.js';

/**
 * Discord Embed structure
 * @see https://discord.com/developers/docs/resources/message#embed-object
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
  type: 2; // Button component type
  style: 1 | 2 | 3 | 4 | 5; // Primary, Secondary, Success, Danger, Link
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
  type: 1; // Action row type
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
export const MessageFlags = {
  EPHEMERAL: 64, // Only visible to the user who triggered the interaction
} as const;

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
 * DISCORD-REF-002: Extended to accept either string or full InteractionResponseData
 * @param content - Either a simple string message or full InteractionResponseData
 */
export function ephemeralResponse(content: string | InteractionResponseData): Response {
  if (typeof content === 'string') {
    return messageResponse({
      content,
      flags: MessageFlags.EPHEMERAL,
    });
  }
  // InteractionResponseData passed - add ephemeral flag
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
 * Use this when your response will take more than 3 seconds.
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
    color: 0xff0000, // Red
  };
}

/**
 * Creates a success embed with consistent styling.
 */
export function successEmbed(title: string, description: string): DiscordEmbed {
  return {
    title: `\u2705 ${title}`,
    description,
    color: 0x00ff00, // Green
  };
}

/**
 * Creates an info embed with consistent styling.
 */
export function infoEmbed(title: string, description: string): DiscordEmbed {
  return {
    title: `\u2139\uFE0F ${title}`,
    description,
    color: 0x5865f2, // Discord Blurple
  };
}

/**
 * Converts a hex color string to a Discord color integer.
 */
export function hexToDiscordColor(hex: string): number {
  // Remove # if present
  const cleanHex = hex.replace('#', '');
  return parseInt(cleanHex, 16);
}
