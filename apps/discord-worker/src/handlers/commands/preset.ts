/**
 * /preset Command Handler
 *
 * Manages community preset palettes - browsing, submitting, voting.
 * Interacts with the preset API worker for data persistence.
 *
 * Subcommands:
 * - list: Browse presets by category
 * - show: View a specific preset with color visualization
 * - random: Get random preset for inspiration
 * - submit: Create a new community preset
 * - vote: Toggle vote on a preset
 * - edit: Edit your own preset
 *
 * Note: Moderation commands (moderate, ban_user, unban_user) are handled
 * by xivdyetools-moderation-worker.
 */

import type { Dye } from '@xivdyetools/types';
import { dyeService } from '../../utils/color.js';
import type { ExtendedLogger } from '@xivdyetools/logger';
import {
  deferredResponse,
  errorEmbed,
  successEmbed,
  infoEmbed,
  messageResponse,
  ephemeralResponse,
} from '../../utils/response.js';
import { sendMessage, safeEditOriginalResponse } from '../../utils/discord-api.js';
import { generatePresetSwatch } from '@xivdyetools/svg';
import { renderSvgToPng } from '../../services/svg/renderer.js';
import { getDyeEmoji } from '../../services/emoji.js';
import { createUserTranslator, createTranslator, type Translator } from '../../services/bot-i18n.js';
import { sendModerationNotification } from './preset-notifications.js';
import { initializeLocale, getLocalizedDyeName, type LocaleCode } from '../../services/i18n.js';
import type { Env } from '../../types/env.js';
import {
  type CommunityPreset,
  type PresetCategory,
  CATEGORY_DISPLAY,
  STATUS_DISPLAY,
  PresetAPIError,
} from '../../types/preset.js';
import * as presetApi from '../../services/preset-api.js';
import {
  getPresetFavorites,
  addPresetFavorite,
  removePresetFavorite,
  MAX_PRESET_FAVORITES,
} from '../../services/preset-favorites.js';
import type { DiscordInteraction } from '../../types/env.js';

// ============================================================================
// Main Handler
// ============================================================================

/**
 * Handles the /preset command with all subcommands
 */
export async function handlePresetCommand(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext,
  logger?: ExtendedLogger
): Promise<Response> {
  const userId = interaction.member?.user?.id ?? interaction.user?.id ?? 'unknown';
  const userName =
    interaction.member?.user?.global_name ||
    interaction.member?.user?.username ||
    interaction.user?.global_name ||
    interaction.user?.username ||
    'Unknown';
  const t = await createUserTranslator(env.KV, userId, interaction.locale);

  // Check if API is enabled
  if (!presetApi.isApiEnabled(env)) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('preset.apiDisabled'))],
      flags: 64,
    });
  }

  // Find the first SUB_COMMAND (type 1) or SUB_COMMAND_GROUP (type 2)
  const options = interaction.data?.options || [];
  const subcommand = options.find((opt) => opt.type === 1 || opt.type === 2);

  if (!subcommand) {
    return ephemeralResponse('Invalid command structure');
  }

  // Route to subcommand handler
  switch (subcommand.name) {
    case 'list':
      return handleListSubcommand(interaction, env, ctx, t, subcommand.options, logger);

    case 'show':
      return handleShowSubcommand(interaction, env, ctx, t, userId, subcommand.options, logger);

    case 'random':
      return handleRandomSubcommand(interaction, env, ctx, t, userId, subcommand.options, logger);

    case 'submit':
      return handleSubmitSubcommand(interaction, env, ctx, t, userId, userName, subcommand.options, logger);

    case 'vote':
      return handleVoteSubcommand(interaction, env, ctx, t, userId, subcommand.options, logger);

    case 'edit':
      return handleEditSubcommand(interaction, env, ctx, t, userId, userName, subcommand.options, logger);

    case 'favorite': {
      // Subcommand group — favorite add/remove/list
      const inner = subcommand.options?.[0];
      if (!inner) return ephemeralResponse('Invalid command structure');
      switch (inner.name) {
        case 'add':
          return handleFavoriteAddSubcommand(interaction, env, ctx, t, userId, inner.options, logger);
        case 'remove':
          return handleFavoriteRemoveSubcommand(interaction, env, ctx, t, userId, inner.options, logger);
        case 'list':
          return handleFavoriteListSubcommand(interaction, env, ctx, t, userId, logger);
        default:
          return ephemeralResponse(`Unknown favorite subcommand: ${inner.name}`);
      }
    }

    default:
      return ephemeralResponse(`Unknown subcommand: ${subcommand.name}`);
  }
}

// ============================================================================
// Subcommand Handlers
// ============================================================================

/**
 * /preset list - Browse presets by category
 */
// eslint-disable-next-line @typescript-eslint/require-await
async function handleListSubcommand(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext,
  t: Translator,
  options?: Array<{ name: string; value?: string | number | boolean }>,
  logger?: ExtendedLogger
): Promise<Response> {
  const categoryValue = options?.find((opt) => opt.name === 'category')?.value as string | undefined;
  const sortValue = (options?.find((opt) => opt.name === 'sort')?.value as string) || 'popular';

  // Defer response
  const deferResponse = deferredResponse();

  ctx.waitUntil(
    processListCommand(interaction, env, t, categoryValue, sortValue, logger)
  );

  return deferResponse;
}

async function processListCommand(
  interaction: DiscordInteraction,
  env: Env,
  t: Translator,
  category: string | undefined,
  sort: string,
  logger?: ExtendedLogger
): Promise<void> {
  try {
    const response = await presetApi.getPresets(env, {
      category: category as PresetCategory | undefined,
      sort: sort as 'popular' | 'recent' | 'name',
      status: 'approved',
      limit: 10,
    });

    if (response.presets.length === 0) {
      await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
        embeds: [
          infoEmbed(
            t.t('preset.title'),
            category
              ? t.t('preset.noneInCategory')
              : 'No presets found.'
          ),
        ],
      });
      return;
    }

    // Build preset list
    const categoryDisplay = category
      ? CATEGORY_DISPLAY[category as PresetCategory]
      : null;

    const title = categoryDisplay
      ? `${categoryDisplay.icon} ${categoryDisplay.name}`
      : t.t('preset.title');

    const presetLines = response.presets.map((preset, index) => {
      const catIcon = CATEGORY_DISPLAY[preset.category_id]?.icon || '🎨';
      const author = preset.author_name ? ` by ${preset.author_name}` : '';
      return `**${index + 1}.** ${catIcon} ${preset.name} (${preset.vote_count}★)${author}`;
    });

    const description = [
      presetLines.join('\n'),
      '',
      `📊 Showing ${response.presets.length} of ${response.total} presets`,
      '',
      t.t('preset.useShowTip'),
    ].join('\n');

    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [
        {
          title,
          description,
          color: 0x5865f2,
          footer: { text: t.t('common.footer') },
        },
      ],
    });
  } catch (error) {
    if (logger) {
      logger.error('List presets error', error instanceof Error ? error : undefined);
    }
    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [errorEmbed(t.t('common.error'), 'Failed to load presets.')],
    });
  }
}

/**
 * /preset show - View a specific preset
 */
// eslint-disable-next-line @typescript-eslint/require-await
async function handleShowSubcommand(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext,
  t: Translator,
  _userId: string,
  options?: Array<{ name: string; value?: string | number | boolean }>,
  logger?: ExtendedLogger
): Promise<Response> {
  const presetId = options?.find((opt) => opt.name === 'name')?.value as string | undefined;

  if (!presetId) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.missingInput'))],
      flags: 64,
    });
  }

  // Defer response
  const deferResponse = deferredResponse();
  // Use translator's resolved locale instead of calling resolveUserLocale again
  const locale = t.getLocale();

  ctx.waitUntil(processShowCommand(interaction, env, t, presetId, locale, logger));

  return deferResponse;
}

async function processShowCommand(
  interaction: DiscordInteraction,
  env: Env,
  t: Translator,
  presetId: string,
  locale: LocaleCode,
  logger?: ExtendedLogger
): Promise<void> {
  await initializeLocale(locale);

  try {
    // Get preset by ID
    const preset = await presetApi.getPreset(env, presetId);

    if (!preset) {
      await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
        embeds: [errorEmbed(t.t('common.error'), t.t('preset.notFound'))],
      });
      return;
    }

    await sendPresetEmbed(interaction, env, t, preset, locale);
  } catch (error) {
    if (logger) {
      logger.error('Show preset error', error instanceof Error ? error : undefined);
    }
    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [errorEmbed(t.t('common.error'), 'Failed to load preset.')],
    });
  }
}

/**
 * /preset random - Get random preset
 */
// eslint-disable-next-line @typescript-eslint/require-await
async function handleRandomSubcommand(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext,
  t: Translator,
  _userId: string,
  options?: Array<{ name: string; value?: string | number | boolean }>,
  logger?: ExtendedLogger
): Promise<Response> {
  const category = options?.find((opt) => opt.name === 'category')?.value as string | undefined;

  // Defer response
  const deferResponse = deferredResponse();
  // Use translator's resolved locale instead of calling resolveUserLocale again
  const locale = t.getLocale();

  ctx.waitUntil(processRandomCommand(interaction, env, t, category, locale, logger));

  return deferResponse;
}

async function processRandomCommand(
  interaction: DiscordInteraction,
  env: Env,
  t: Translator,
  category: string | undefined,
  locale: LocaleCode,
  logger?: ExtendedLogger
): Promise<void> {
  await initializeLocale(locale);

  try {
    const preset = await presetApi.getRandomPreset(env, category);

    if (!preset) {
      await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
        embeds: [
          infoEmbed(
            t.t('preset.randomTitle'),
            category ? t.t('preset.noneInCategory') : 'No presets found.'
          ),
        ],
      });
      return;
    }

    await sendPresetEmbed(interaction, env, t, preset, locale);
  } catch (error) {
    if (logger) {
      logger.error('Random preset error', error instanceof Error ? error : undefined);
    }
    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [errorEmbed(t.t('common.error'), 'Failed to load random preset.')],
    });
  }
}

/**
 * /preset submit - Create a new preset
 */
// eslint-disable-next-line @typescript-eslint/require-await
async function handleSubmitSubcommand(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext,
  t: Translator,
  userId: string,
  userName: string,
  options?: Array<{ name: string; value?: string | number | boolean }>,
  logger?: ExtendedLogger
): Promise<Response> {
  // Extract all options
  const presetName = options?.find((opt) => opt.name === 'preset_name')?.value as string;
  const description = options?.find((opt) => opt.name === 'description')?.value as string;
  const category = options?.find((opt) => opt.name === 'category')?.value as string;
  const tagsRaw = options?.find((opt) => opt.name === 'tags')?.value as string | undefined;

  // Collect dye names (dye1-dye5)
  const dyeNames: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const dyeValue = options?.find((opt) => opt.name === `dye${i}`)?.value as string | undefined;
    if (dyeValue) {
      dyeNames.push(dyeValue);
    }
  }

  // Validate required fields
  if (!presetName || !description || !category) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.missingInput'))],
      flags: 64,
    });
  }

  // Validate dye count
  if (dyeNames.length < 2) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('preset.notEnoughDyes'))],
      flags: 64,
    });
  }

  // Resolve dye names to IDs
  const dyeIds: number[] = [];
  for (const name of dyeNames) {
    const dyes = dyeService.searchByName(name);
    if (dyes.length > 0) {
      dyeIds.push(dyes[0].id);
    } else {
      return messageResponse({
        embeds: [errorEmbed(t.t('common.error'), t.t('preset.invalidDye'))],
        flags: 64,
      });
    }
  }

  // Parse tags
  const tags = tagsRaw
    ? tagsRaw.split(',').map((tag) => tag.trim()).filter((tag) => tag.length > 0).slice(0, 10)
    : [];

  // Defer response
  const deferResponse = deferredResponse();

  ctx.waitUntil(
    processSubmitCommand(interaction, env, t, userId, userName, {
      name: presetName,
      description,
      category_id: category as PresetCategory,
      dyes: dyeIds,
      tags,
    }, logger)
  );

  return deferResponse;
}

async function processSubmitCommand(
  interaction: DiscordInteraction,
  env: Env,
  t: Translator,
  userId: string,
  userName: string,
  submission: {
    name: string;
    description: string;
    category_id: PresetCategory;
    dyes: number[];
    tags: string[];
  },
  logger?: ExtendedLogger
): Promise<void> {
  try {
    const response = await presetApi.submitPreset(env, submission, userId, userName);

    // Handle duplicate
    if ('duplicate' in response) {
      await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
        embeds: [
          {
            title: `⚠️ ${t.t('preset.duplicateExists')}`,
            description: [
              `A preset with the same dyes already exists:`,
              `**"${response.duplicate.name}"** by ${response.duplicate.author_name || 'Official'}`,
              `(${response.duplicate.vote_count}★)`,
              '',
              response.vote_added ? `✅ ${t.t('preset.duplicateVoted')}` : '',
            ].join('\n'),
            color: 0xf5a623,
          },
        ],
      });
      return;
    }

    // Handle error
    if (!response.success) {
      await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
        embeds: [errorEmbed(t.t('common.error'), response.error)],
      });
      return;
    }

    // Handle success — response is now PresetSubmitCreatedResponse
    const preset = response.preset;
    const isApproved = response.moderation_status === 'approved';

    const embed = {
      title: isApproved
        ? `✅ ${t.t('preset.submitted')}`
        : `⏳ ${t.t('preset.submitted')}`,
      description: isApproved
        ? t.t('preset.submittedApproved')
        : t.t('preset.submittedPending'),
      color: isApproved ? 0x57f287 : 0xfee75c,
      fields: [
        { name: 'Name', value: preset.name, inline: true },
        { name: 'Category', value: CATEGORY_DISPLAY[preset.category_id]?.name || preset.category_id, inline: true },
        { name: 'Dyes', value: `${preset.dyes.length} colors`, inline: true },
      ],
      footer: { text: t.t('common.footer') },
    };

    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [embed],
    });

    // Log to submission channel if approved
    if (isApproved && env.SUBMISSION_LOG_CHANNEL_ID) {
      await notifySubmissionChannel(env, preset, 'approved');
    }

    // Notify moderation channel if pending
    if (!isApproved && env.MODERATION_CHANNEL_ID) {
      await notifyModerationChannel(env, preset);
    }
  } catch (error) {
    if (logger) {
      logger.error('Submit preset error', error instanceof Error ? error : undefined);
    }
    // SECURITY: Use getSafeMessage() to prevent exposing internal API details
    const message = error instanceof PresetAPIError
      ? error.getSafeMessage()
      : 'Failed to submit preset.';

    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [errorEmbed(t.t('common.error'), message)],
    });
  }
}

/**
 * /preset vote - Toggle vote on a preset
 */
// eslint-disable-next-line @typescript-eslint/require-await
async function handleVoteSubcommand(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext,
  t: Translator,
  userId: string,
  options?: Array<{ name: string; value?: string | number | boolean }>,
  logger?: ExtendedLogger
): Promise<Response> {
  const presetId = options?.find((opt) => opt.name === 'preset')?.value as string | undefined;

  if (!presetId) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.missingInput'))],
      flags: 64,
    });
  }

  // Defer response
  const deferResponse = deferredResponse();

  ctx.waitUntil(processVoteCommand(interaction, env, t, userId, presetId, logger));

  return deferResponse;
}

async function processVoteCommand(
  interaction: DiscordInteraction,
  env: Env,
  t: Translator,
  userId: string,
  presetId: string,
  logger?: ExtendedLogger
): Promise<void> {
  try {
    // Check if already voted
    const alreadyVoted = await presetApi.hasVoted(env, presetId, userId);

    let response;
    let actionMessage: string;

    if (alreadyVoted) {
      // Remove vote
      response = await presetApi.removeVote(env, presetId, userId);
      actionMessage = t.t('preset.voteRemoved');
    } else {
      // Add vote
      response = await presetApi.voteForPreset(env, presetId, userId);
      actionMessage = t.t('preset.voteAdded');
    }

    if (!response.success) {
      await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
        embeds: [errorEmbed(t.t('common.error'), response.error)],
      });
      return;
    }

    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [
        successEmbed(
          actionMessage,
          t.t('preset.currentVotes', { count: response.new_vote_count })
        ),
      ],
    });
  } catch (error) {
    if (logger) {
      logger.error('Vote error', error instanceof Error ? error : undefined);
    }
    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [errorEmbed(t.t('common.error'), 'Failed to process vote.')],
    });
  }
}

/**
 * /preset edit - Edit one of your own presets
 */
// eslint-disable-next-line @typescript-eslint/require-await
async function handleEditSubcommand(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext,
  t: Translator,
  userId: string,
  userName: string,
  options?: Array<{ name: string; value?: string | number | boolean }>,
  logger?: ExtendedLogger
): Promise<Response> {
  const presetId = options?.find((opt) => opt.name === 'preset')?.value as string | undefined;

  if (!presetId) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.missingInput'))],
      flags: 64,
    });
  }

  // Extract optional update fields
  const newName = options?.find((opt) => opt.name === 'name')?.value as string | undefined;
  const newDescription = options?.find((opt) => opt.name === 'description')?.value as string | undefined;
  const tagsRaw = options?.find((opt) => opt.name === 'tags')?.value as string | undefined;

  // Collect dye names (dye1-dye5)
  const dyeNames: (string | undefined)[] = [];
  for (let i = 1; i <= 5; i++) {
    const dyeValue = options?.find((opt) => opt.name === `dye${i}`)?.value as string | undefined;
    dyeNames.push(dyeValue);
  }

  // Check if any updates provided
  const hasAnyDye = dyeNames.some(d => d !== undefined);
  if (!newName && !newDescription && !tagsRaw && !hasAnyDye) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), 'Please provide at least one field to update.')],
      flags: 64,
    });
  }

  // Defer response
  const deferResponse = deferredResponse();

  ctx.waitUntil(
    processEditCommand(interaction, env, t, userId, userName, presetId, {
      name: newName,
      description: newDescription,
      tagsRaw,
      dyeNames,
    }, logger)
  );

  return deferResponse;
}

async function processEditCommand(
  interaction: DiscordInteraction,
  env: Env,
  t: Translator,
  userId: string,
  userName: string,
  presetId: string,
  updates: {
    name?: string;
    description?: string;
    tagsRaw?: string;
    dyeNames: (string | undefined)[];
  },
  logger?: ExtendedLogger
): Promise<void> {
  try {
    // First, verify the preset exists and user owns it
    const existingPreset = await presetApi.getPreset(env, presetId);
    if (!existingPreset) {
      await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
        embeds: [errorEmbed(t.t('common.error'), t.t('preset.notFound'))],
      });
      return;
    }

    if (existingPreset.author_discord_id !== userId) {
      await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
        embeds: [errorEmbed(t.t('common.error'), 'You can only edit your own presets.')],
      });
      return;
    }

    // Build the update payload
    const editPayload: {
      name?: string;
      description?: string;
      tags?: string[];
      dyes?: number[];
    } = {};

    if (updates.name) {
      editPayload.name = updates.name;
    }

    if (updates.description) {
      editPayload.description = updates.description;
    }

    if (updates.tagsRaw) {
      editPayload.tags = updates.tagsRaw
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
        .slice(0, 10);
    }

    // Handle dyes - if any dye option is provided, we need to rebuild the full dye array
    const hasAnyDye = updates.dyeNames.some(d => d !== undefined);
    if (hasAnyDye) {
      // Start with existing dyes
      const newDyeIds: number[] = [...existingPreset.dyes];

      // Replace any specified positions
      for (let i = 0; i < 5; i++) {
        const dyeName = updates.dyeNames[i];
        if (dyeName) {
          const dyes = dyeService.searchByName(dyeName);
          if (dyes.length > 0) {
            if (i < newDyeIds.length) {
              newDyeIds[i] = dyes[0].id;
            } else {
              newDyeIds.push(dyes[0].id);
            }
          } else {
            await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
              embeds: [errorEmbed(t.t('common.error'), `Invalid dye: ${dyeName}`)],
            });
            return;
          }
        }
      }

      // Validate dye count (2-5)
      if (newDyeIds.length < 2 || newDyeIds.length > 5) {
        await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
          embeds: [errorEmbed(t.t('common.error'), 'Preset must have 2-5 dyes.')],
        });
        return;
      }

      editPayload.dyes = newDyeIds;
    }

    // Call the edit API
    const response = await presetApi.editPreset(env, presetId, editPayload, userId, userName);

    // Handle duplicate dyes error
    if (!response.success && 'duplicate' in response) {
      await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
        embeds: [
          {
            title: '⚠️ Duplicate Dye Combination',
            description: [
              'This dye combination already exists in another preset:',
              `**"${response.duplicate.name}"** by ${response.duplicate.author_name || 'Unknown'}`,
              '',
              'Please use a different dye combination.',
            ].join('\n'),
            color: 0xed4245,
          },
        ],
      });
      return;
    }

    // Handle other errors
    if (!response.success) {
      await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
        embeds: [errorEmbed(t.t('common.error'), response.error)],
      });
      return;
    }

    // Handle success — response is now PresetEditSuccessResponse
    const updatedPreset = response.preset;
    const isPending = response.moderation_status === 'pending';

    const embed = {
      title: isPending ? '⏳ Preset Updated - Pending Review' : '✅ Preset Updated',
      description: isPending
        ? 'Your changes have been submitted for review due to content moderation.'
        : 'Your changes have been applied.',
      color: isPending ? 0xfee75c : 0x57f287,
      fields: [
        { name: 'Name', value: updatedPreset.name, inline: true },
        { name: 'Category', value: CATEGORY_DISPLAY[updatedPreset.category_id]?.name || updatedPreset.category_id, inline: true },
        { name: 'Dyes', value: `${updatedPreset.dyes.length} colors`, inline: true },
      ],
      footer: { text: isPending ? 'A moderator will review your changes shortly.' : t.t('common.footer') },
    };

    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [embed],
    });

    // Notify moderation channel if pending
    if (isPending && env.MODERATION_CHANNEL_ID) {
      await notifyEditModerationChannel(env, updatedPreset, existingPreset);
    }
  } catch (error) {
    if (logger) {
      logger.error('Edit preset error', error instanceof Error ? error : undefined);
    }
    // SECURITY: Use getSafeMessage() to prevent exposing internal API details
    const message = error instanceof PresetAPIError ? error.getSafeMessage() : 'Failed to edit preset.';
    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [errorEmbed(t.t('common.error'), message)],
    });
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Send a preset embed with color swatch image
 */
async function sendPresetEmbed(
  interaction: DiscordInteraction,
  env: Env,
  t: Translator,
  preset: CommunityPreset,
  locale: LocaleCode
): Promise<void> {
  // Resolve dye IDs to Dye objects
  const dyes: (Dye | null)[] = preset.dyes.map((dyeId) => {
    return dyeService.getDyeById(dyeId) || null;
  });

  // Generate SVG swatch
  const svg = generatePresetSwatch({
    name: preset.name,
    description: preset.description,
    category: preset.category_id,
    dyes,
    authorName: preset.author_name,
    voteCount: preset.vote_count,
  });

  // Render to PNG
  const pngBuffer = await renderSvgToPng(svg, { scale: 2 });

  // Build dye list with emojis
  const dyeList = dyes
    .filter((d): d is Dye => d !== null)
    .map((dye) => {
      const emoji = getDyeEmoji(dye.id);
      const emojiPrefix = emoji ? `${emoji} ` : '';
      const localizedName = getLocalizedDyeName(dye.itemID, dye.name, locale);
      return `${emojiPrefix}${localizedName} (\`${dye.hex.toUpperCase()}\`)`;
    })
    .join('\n');

  const categoryDisplay = CATEGORY_DISPLAY[preset.category_id];
  const author = preset.author_name ? `by ${preset.author_name}` : 'Official';

  await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
    embeds: [
      {
        title: `${categoryDisplay?.icon || '🎨'} ${preset.name}`,
        description: [
          preset.description,
          '',
          `**${t.t('preset.colors')}:**`,
          dyeList,
          '',
          preset.tags.length > 0 ? `**${t.t('preset.tags')}:** ${preset.tags.join(', ')}` : '',
        ].filter(Boolean).join('\n'),
        color: 0x5865f2,
        image: { url: 'attachment://preset.png' },
        fields: [
          { name: t.t('preset.author'), value: author, inline: true },
          { name: t.t('preset.votes'), value: `${preset.vote_count}★`, inline: true },
        ],
        footer: { text: t.t('common.footer') },
      },
    ],
    file: {
      name: 'preset.png',
      data: pngBuffer,
      contentType: 'image/png',
    },
  });
}

/**
 * Notify submission log channel about a new/approved preset
 */
async function notifySubmissionChannel(
  env: Env,
  preset: CommunityPreset,
  status: 'approved' | 'pending',
  logger?: ExtendedLogger
): Promise<void> {
  if (!env.SUBMISSION_LOG_CHANNEL_ID) return;

  const categoryDisplay = CATEGORY_DISPLAY[preset.category_id];
  const statusDisplay = STATUS_DISPLAY[status];
  // Use English translator for admin notifications (no user context)
  const adminT = createTranslator('en');

  try {
    await sendMessage(env.DISCORD_TOKEN, env.SUBMISSION_LOG_CHANNEL_ID, {
      embeds: [
        {
          title: `${statusDisplay.icon} New Preset: ${preset.name}`,
          description: preset.description,
          color: statusDisplay.color,
          fields: [
            { name: adminT.t('webhook.fields.category'), value: categoryDisplay?.name || preset.category_id, inline: true },
            { name: adminT.t('webhook.fields.author'), value: preset.author_name || 'Unknown', inline: true },
            { name: adminT.t('webhook.fields.dyes'), value: `${preset.dyes.length} colors`, inline: true },
          ],
          footer: { text: `ID: ${preset.id}` },
          timestamp: new Date().toISOString(),
        },
      ],
    });
  } catch (error) {
    if (logger) {
      logger.error('Failed to notify submission channel', error instanceof Error ? error : undefined);
    }
  }
}

/**
 * Notify moderation channel about a pending preset.
 * REFACTOR-025/BUG-009/BUG-072: delegates to the shared sanitized builder.
 */
async function notifyModerationChannel(
  env: Env,
  preset: CommunityPreset,
  logger?: ExtendedLogger
): Promise<void> {
  await sendModerationNotification(
    env,
    {
      kind: 'new',
      preset,
      categoryName: CATEGORY_DISPLAY[preset.category_id]?.name,
    },
    logger
  );
}

/**
 * Notify moderation channel about a preset edit that needs review
 */
async function notifyEditModerationChannel(
  env: Env,
  updatedPreset: CommunityPreset,
  originalPreset: CommunityPreset,
  logger?: ExtendedLogger
): Promise<void> {
  // REFACTOR-025/BUG-009/BUG-072: shared sanitized builder
  await sendModerationNotification(
    env,
    {
      kind: 'edit',
      preset: updatedPreset,
      original: originalPreset,
      categoryName: CATEGORY_DISPLAY[updatedPreset.category_id]?.name,
    },
    logger
  );
}

// ============================================================================
// Favorite Subcommand Group Handlers
// ============================================================================

/**
 * Resolve a preset by either UUID or name, returning null on miss.
 *
 * Autocomplete sends the preset ID as the option value when the user picks
 * a suggestion, but a manually-typed value will be the name string —
 * this helper handles both shapes.
 */
async function resolvePresetByIdOrName(
  env: Env,
  idOrName: string,
  _logger?: ExtendedLogger
): Promise<CommunityPreset | null> {
  // Try ID lookup first (UUID format from autocomplete)
  const byId = await presetApi.getPreset(env, idOrName).catch(() => null);
  if (byId) return byId;
  // Fall back to name lookup for manually-typed values
  return presetApi.getPresetByName(env, idOrName).catch(() => null);
}

/**
 * /preset favorite add <preset_name>
 */
// eslint-disable-next-line @typescript-eslint/require-await
async function handleFavoriteAddSubcommand(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext,
  t: Translator,
  userId: string,
  options?: Array<{ name: string; value?: string | number | boolean }>,
  logger?: ExtendedLogger
): Promise<Response> {
  const presetInput = options?.find((o) => o.name === 'preset_name')?.value as string | undefined;
  if (!presetInput) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), 'preset_name is required')],
      flags: 64,
    });
  }
  const deferResponse = deferredResponse(true);
  ctx.waitUntil(processFavoriteAdd(interaction, env, t, userId, presetInput, logger));
  return deferResponse;
}

async function processFavoriteAdd(
  interaction: DiscordInteraction,
  env: Env,
  t: Translator,
  userId: string,
  presetInput: string,
  logger?: ExtendedLogger
): Promise<void> {
  try {
    const preset = await resolvePresetByIdOrName(env, presetInput, logger);
    if (!preset) {
      await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
        embeds: [errorEmbed(t.t('common.error'), t.t('preset.errors.notFound', { name: presetInput }))],
      });
      return;
    }
    const result = await addPresetFavorite(env.KV, userId, preset.id, preset.name, logger);
    if (!result.success) {
      const reasonMsg =
        result.reason === 'alreadyExists'
          ? `**${preset.name}** is already in your favorites.`
          : result.reason === 'limitReached'
            ? `You've reached the limit of ${MAX_PRESET_FAVORITES} favorited presets.`
            : 'Failed to add favorite — please try again.';
      await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
        embeds: [errorEmbed(t.t('common.error'), reasonMsg)],
      });
      return;
    }
    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [successEmbed('⭐ Favorite added', `**${preset.name}** is now in your favorited presets.`)],
    });
  } catch (error) {
    if (logger) {
      logger.error('preset favorite add failed', error instanceof Error ? error : undefined);
    }
    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [errorEmbed(t.t('common.error'), t.t('common.unknownError'))],
    });
  }
}

/**
 * /preset favorite remove <preset_name>
 */
// eslint-disable-next-line @typescript-eslint/require-await
async function handleFavoriteRemoveSubcommand(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext,
  t: Translator,
  userId: string,
  options?: Array<{ name: string; value?: string | number | boolean }>,
  logger?: ExtendedLogger
): Promise<Response> {
  const presetInput = options?.find((o) => o.name === 'preset_name')?.value as string | undefined;
  if (!presetInput) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), 'preset_name is required')],
      flags: 64,
    });
  }
  const deferResponse = deferredResponse(true);
  ctx.waitUntil(processFavoriteRemove(interaction, env, t, userId, presetInput, logger));
  return deferResponse;
}

async function processFavoriteRemove(
  interaction: DiscordInteraction,
  env: Env,
  t: Translator,
  userId: string,
  presetInput: string,
  logger?: ExtendedLogger
): Promise<void> {
  try {
    // Try to resolve to ID first; if input already looks like an ID, use it directly.
    let presetId = presetInput;
    let presetName = presetInput;
    const preset = await resolvePresetByIdOrName(env, presetInput, logger);
    if (preset) {
      presetId = preset.id;
      presetName = preset.name;
    }
    const result = await removePresetFavorite(env.KV, userId, presetId, logger);
    if (!result.success) {
      const reasonMsg =
        result.reason === 'notFound'
          ? `**${presetName}** is not in your favorites.`
          : 'Failed to remove favorite — please try again.';
      await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
        embeds: [errorEmbed(t.t('common.error'), reasonMsg)],
      });
      return;
    }
    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [successEmbed('🗑️ Favorite removed', `**${presetName}** has been removed from your favorites.`)],
    });
  } catch (error) {
    if (logger) {
      logger.error('preset favorite remove failed', error instanceof Error ? error : undefined);
    }
    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [errorEmbed(t.t('common.error'), t.t('common.unknownError'))],
    });
  }
}

/**
 * /preset favorite list — show user's favorited presets
 */
// eslint-disable-next-line @typescript-eslint/require-await
async function handleFavoriteListSubcommand(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext,
  t: Translator,
  userId: string,
  logger?: ExtendedLogger
): Promise<Response> {
  const deferResponse = deferredResponse(true);
  ctx.waitUntil(processFavoriteList(interaction, env, t, userId, logger));
  return deferResponse;
}

async function processFavoriteList(
  interaction: DiscordInteraction,
  env: Env,
  t: Translator,
  userId: string,
  logger?: ExtendedLogger
): Promise<void> {
  try {
    const ids = await getPresetFavorites(env.KV, userId, logger);
    if (ids.length === 0) {
      await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
        embeds: [
          infoEmbed(
            '⭐ Your favorite presets',
            'You haven\'t favorited any presets yet. Use `/preset favorite add` to add one.'
          ),
        ],
      });
      return;
    }
    const resolved = await Promise.all(
      ids.map((id) => presetApi.getPreset(env, id).catch(() => null))
    );
    const presets = resolved.filter((p): p is CommunityPreset => p !== null);

    if (presets.length === 0) {
      await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
        embeds: [
          infoEmbed(
            '⭐ Your favorite presets',
            'All of your favorited presets appear to have been removed. Use `/preset favorite remove` to clean up entries.'
          ),
        ],
      });
      return;
    }

    const lines = presets.map((p, i) => {
      const catEntry = CATEGORY_DISPLAY[p.category_id];
      const cat = catEntry?.name ?? p.category_id;
      return `**${i + 1}.** ${p.name} — *${cat}*`;
    });

    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [
        {
          title: `⭐ Your favorite presets (${presets.length}/${MAX_PRESET_FAVORITES})`,
          description: lines.join('\n'),
          color: 0xfee75c,
          footer: { text: t.t('common.footer') },
        },
      ],
    });
  } catch (error) {
    if (logger) {
      logger.error('preset favorite list failed', error instanceof Error ? error : undefined);
    }
    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [errorEmbed(t.t('common.error'), t.t('common.unknownError'))],
    });
  }
}
