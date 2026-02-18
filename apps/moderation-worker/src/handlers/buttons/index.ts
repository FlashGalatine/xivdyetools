/**
 * Button Handler Exports
 *
 * @module handlers/buttons
 */

import type { Env } from '../../types/env.js';
import type { ExtendedLogger } from '@xivdyetools/logger';
import { ephemeralResponse } from '../../utils/response.js';
import {
  handlePresetApproveButton,
  handlePresetRejectButton,
  handlePresetRevertButton,
  isPresetModerationButton,
} from './preset-moderation.js';
import {
  handleBanConfirmButton,
  handleBanCancelButton,
  isBanConfirmButton,
  isBanCancelButton,
} from './ban-confirmation.js';

// Re-export individual handlers
export {
  handlePresetApproveButton,
  handlePresetRejectButton,
  handlePresetRevertButton,
  isPresetModerationButton,
} from './preset-moderation.js';

export {
  handleBanConfirmButton,
  handleBanCancelButton,
  isBanConfirmButton,
  isBanCancelButton,
} from './ban-confirmation.js';

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// Unified Button Handler
// ============================================================================

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

  // Preset moderation buttons (approve/reject/revert)
  if (customId.startsWith('preset_approve_')) {
    return handlePresetApproveButton(interaction, env, ctx, logger);
  }

  if (customId.startsWith('preset_reject_')) {
    return handlePresetRejectButton(interaction, env, ctx, logger);
  }

  if (customId.startsWith('preset_revert_')) {
    return handlePresetRevertButton(interaction, env, ctx, logger);
  }

  // Ban confirmation buttons
  if (isBanConfirmButton(customId)) {
    return handleBanConfirmButton(interaction, env, ctx, logger);
  }

  if (isBanCancelButton(customId)) {
    return handleBanCancelButton(interaction, env, ctx, logger);
  }

  // Unknown button
  logger?.warn('Unknown button interaction', { customId });
  return ephemeralResponse('Unknown button action.');
}
