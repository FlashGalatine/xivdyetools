/**
 * Copy Button Handlers
 *
 * Handles button interactions for copying color values to clipboard.
 * Since Discord doesn't support clipboard access, we show the value
 * in a formatted message that users can easily copy.
 *
 * Button ID formats:
 * - copy_hex_{hex} - Copy hex code (e.g., copy_hex_FF5733)
 * - copy_rgb_{r}_{g}_{b} - Copy RGB values (e.g., copy_rgb_255_87_51)
 * - copy_hsv_{h}_{s}_{v} - Copy HSV values (e.g., copy_hsv_11_80_100)
 */

import { InteractionResponseType } from '../../types/env.js';

interface ButtonInteraction {
  data?: {
    custom_id?: string;
  };
}

/**
 * Handle copy_hex button
 */
export function handleCopyHex(interaction: ButtonInteraction): Response {
  const customId = interaction.data?.custom_id || '';
  const hex = customId.replace('copy_hex_', '');

  // Format as proper hex code
  const formattedHex = hex.startsWith('#') ? hex.toUpperCase() : `#${hex.toUpperCase()}`;

  return Response.json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `\`\`\`\n${formattedHex}\n\`\`\``,
      flags: 64, // Ephemeral
    },
  });
}

/**
 * Handle copy_rgb button
 */
export function handleCopyRgb(interaction: ButtonInteraction): Response {
  const customId = interaction.data?.custom_id || '';
  const parts = customId.replace('copy_rgb_', '').split('_');

  if (parts.length !== 3) {
    return Response.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: 'Invalid RGB format.',
        flags: 64,
      },
    });
  }

  const [r, g, b] = parts.map(Number);

  // Format options for different use cases
  const formats = [
    `rgb(${r}, ${g}, ${b})`,
    `${r}, ${g}, ${b}`,
  ];

  return Response.json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `**RGB Values:**\n\`\`\`\n${formats.join('\n')}\n\`\`\``,
      flags: 64,
    },
  });
}

/**
 * Handle copy_hsv button
 */
export function handleCopyHsv(interaction: ButtonInteraction): Response {
  const customId = interaction.data?.custom_id || '';
  const parts = customId.replace('copy_hsv_', '').split('_');

  if (parts.length !== 3) {
    return Response.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: 'Invalid HSV format.',
        flags: 64,
      },
    });
  }

  const [h, s, v] = parts.map(Number);

  return Response.json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `**HSV Values:**\n\`\`\`\nH: ${h}°, S: ${s}%, V: ${v}%\n\`\`\``,
      flags: 64,
    },
  });
}

/**
 * Create button components for a color
 *
 * @param hex - Hex code without # (e.g., "FF5733")
 * @param rgb - RGB object with r, g, b
 * @param hsv - HSV object with h, s, v
 * @returns Button row component
 */
export function createCopyButtons(
  hex: string,
  rgb: { r: number; g: number; b: number },
  hsv: { h: number; s: number; v: number }
): {
  type: 1;
  components: Array<{
    type: 2;
    style: 2;
    label: string;
    custom_id: string;
  }>;
} {
  // Remove # if present
  const cleanHex = hex.replace('#', '');

  return {
    type: 1, // ACTION_ROW
    components: [
      {
        type: 2, // BUTTON
        style: 2, // SECONDARY (gray)
        label: `HEX: #${cleanHex.toUpperCase()}`,
        custom_id: `copy_hex_${cleanHex}`,
      },
      {
        type: 2,
        style: 2,
        label: `RGB: ${rgb.r}, ${rgb.g}, ${rgb.b}`,
        custom_id: `copy_rgb_${rgb.r}_${rgb.g}_${rgb.b}`,
      },
      {
        type: 2,
        style: 2,
        label: `HSV: ${hsv.h}°, ${hsv.s}%, ${hsv.v}%`,
        custom_id: `copy_hsv_${hsv.h}_${hsv.s}_${hsv.v}`,
      },
    ],
  };
}

/**
 * Create a simpler button row with just hex
 */
export function createHexButton(hex: string): {
  type: 1;
  components: Array<{
    type: 2;
    style: 2;
    label: string;
    custom_id: string;
  }>;
} {
  const cleanHex = hex.replace('#', '');

  return {
    type: 1,
    components: [
      {
        type: 2,
        style: 2,
        label: `Copy: #${cleanHex.toUpperCase()}`,
        custom_id: `copy_hex_${cleanHex}`,
      },
    ],
  };
}
