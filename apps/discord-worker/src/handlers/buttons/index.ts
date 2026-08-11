/**
 * Button Handlers Index
 *
 * Routes button interactions based on custom_id prefixes.
 * Note: Moderation buttons are handled by xivdyetools-moderation-worker.
 */

import type { Env } from '../../types/env.js';
import type { ExtendedLogger } from '@xivdyetools/logger';
import { ephemeralResponse } from '../../utils/response.js';
import { handleCopyHex, handleCopyRgb, handleCopyHsv } from './copy.js';
import { handlePreviewImageButton, isPreviewImageButton } from './preview-image.js';

// Re-export button creation helpers
export { createCopyButtons, createHexButton } from './copy.js';

// Re-export preview-image moderation handler
export { handlePreviewImageButton, isPreviewImageButton } from './preview-image.js';

interface ButtonInteraction {
  id: string;
  token: string;
  application_id: string;
  channel_id?: string;
  message?: {
    id: string;
    embeds?: Array<{
      title?: string;
      description?: string;
      color?: number;
      fields?: Array<{ name: string; value: string; inline?: boolean }>;
      footer?: { text?: string };
      timestamp?: string;
    }>;
  };
  member?: {
    user: {
      id: string;
      username: string;
    };
  };
  user?: {
    id: string;
    username: string;
  };
  data?: {
    custom_id?: string;
    component_type?: number;
  };
}

/**
 * Route button interactions to appropriate handlers
 */
export async function handleButtonInteraction(
  interaction: ButtonInteraction,
  env: Env,
  ctx: ExecutionContext,
  logger?: ExtendedLogger
): Promise<Response> {
  const customId = interaction.data?.custom_id || '';

  if (logger) {
    logger.info('Handling button', { customId });
  }

  // Copy buttons
  if (customId.startsWith('copy_hex_')) {
    return handleCopyHex(interaction);
  }

  if (customId.startsWith('copy_rgb_')) {
    return handleCopyRgb(interaction);
  }

  if (customId.startsWith('copy_hsv_')) {
    return handleCopyHsv(interaction);
  }

  // Preview-image moderation buttons (approve/reject) — handled here, not
  // moderation-worker, because Discord routes clicks to the app whose bot
  // posted the message (discord-worker's own token; see index.ts).
  if (isPreviewImageButton(customId)) {
    return handlePreviewImageButton(interaction, env, ctx, logger);
  }

  // Unknown button
  if (logger) {
    logger.warn(`Unknown button custom_id: ${customId}`);
  }
  return ephemeralResponse('This button is not recognized.');
}
