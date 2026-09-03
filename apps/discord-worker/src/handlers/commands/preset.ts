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
import { dyeService, searchDyesByName, sanitizeEmbedText } from '@xivdyetools/bot-logic';
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
import { generatePresetSwatch, CATEGORY_DISPLAY } from '@xivdyetools/svg';
import { filterToRenderable, filterToRenderableTitle } from '../../services/font-coverage.js';
import { renderSvgToPng } from '../../services/svg/renderer.js';
import { getDyeEmoji } from '../../services/emoji.js';
import {
  createUserTranslator,
  createTranslator,
  type Translator,
} from '../../services/bot-i18n.js';
import { sendModerationNotification } from './preset-notifications.js';
import { initializeLocale, getLocalizedDyeName, type LocaleCode } from '../../services/i18n.js';
import type { Env } from '../../types/env.js';
import { BRAND_ACCENT, STATE } from '../../utils/brand.js';
import {
  type CommunityPreset,
  type PresetCategory,
  STATUS_DISPLAY,
  PresetAPIError,
  isValidPresetId,
} from '../../types/preset.js';
import { sanitizePresetName, sanitizePresetDescription } from '../../utils/sanitize.js';
import * as presetApi from '../../services/preset-api.js';
import {
  getPresetFavorites,
  addPresetFavorite,
  removePresetFavorite,
  MAX_PRESET_FAVORITES,
} from '../../services/preset-favorites.js';
import type { DiscordInteraction } from '../../types/env.js';
import { markCommandOutcome, classifyError } from '../../services/command-trace.js';

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
  logger?: ExtendedLogger,
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
    return ephemeralResponse(t.t('preset.invalidStructure'));
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
      return handleSubmitSubcommand(
        interaction,
        env,
        ctx,
        t,
        userId,
        userName,
        subcommand.options,
        logger,
      );

    case 'vote':
      return handleVoteSubcommand(interaction, env, ctx, t, userId, subcommand.options, logger);

    case 'edit':
      return handleEditSubcommand(
        interaction,
        env,
        ctx,
        t,
        userId,
        userName,
        subcommand.options,
        logger,
      );

    case 'favorite': {
      // Subcommand group — favorite add/remove/list
      const inner = subcommand.options?.[0];
      if (!inner) return ephemeralResponse(t.t('preset.invalidStructure'));
      switch (inner.name) {
        case 'add':
          return handleFavoriteAddSubcommand(
            interaction,
            env,
            ctx,
            t,
            userId,
            inner.options,
            logger,
          );
        case 'remove':
          return handleFavoriteRemoveSubcommand(
            interaction,
            env,
            ctx,
            t,
            userId,
            inner.options,
            logger,
          );
        case 'list':
          return handleFavoriteListSubcommand(interaction, env, ctx, t, userId, logger);
        default:
          return ephemeralResponse(t.t('errors.unknownSubcommand', { name: `favorite ${inner.name}` }));
      }
    }

    default:
      return ephemeralResponse(t.t('errors.unknownSubcommand', { name: subcommand.name }));
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
  logger?: ExtendedLogger,
): Promise<Response> {
  const categoryValue = options?.find((opt) => opt.name === 'category')?.value as
    string | undefined;
  const sortValue = (options?.find((opt) => opt.name === 'sort')?.value as string) || 'popular';

  // Defer response
  const deferResponse = deferredResponse();

  ctx.waitUntil(processListCommand(interaction, env, t, categoryValue, sortValue, logger));

  return deferResponse;
}

async function processListCommand(
  interaction: DiscordInteraction,
  env: Env,
  t: Translator,
  category: string | undefined,
  sort: string,
  logger?: ExtendedLogger,
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
            category ? t.t('preset.noneInCategory') : t.t('preset.none'),
          ),
        ],
      });
      return;
    }

    // Build preset list
    const categoryDisplay = category ? CATEGORY_DISPLAY[category as PresetCategory] : null;

    const title = categoryDisplay
      ? `${categoryDisplay.icon} ${categoryDisplay.name}`
      : t.t('preset.title');

    // FINDING-019: stored names / authors are user content — escape before embedding
    const presetLines = response.presets.map((preset, index) => {
      const catIcon = CATEGORY_DISPLAY[preset.category_id]?.icon || '🎨';
      const author = preset.author_name
        ? ` ${t.t('preset.byAuthor', { author: sanitizePresetName(preset.author_name) })}`
        : '';
      return `**${index + 1}.** ${catIcon} ${sanitizePresetName(preset.name)} (${preset.vote_count}★)${author}`;
    });

    const description = [
      presetLines.join('\n'),
      '',
      `📊 ${t.t('preset.showing', { shown: response.presets.length, total: response.total })}`,
      '',
      t.t('preset.useShowTip'),
    ].join('\n');

    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [
        {
          title,
          description,
          color: BRAND_ACCENT,
          footer: { text: t.t('common.footer') },
        },
      ],
    });
  } catch (error) {
    markCommandOutcome(interaction, classifyError(error));
    if (logger) {
      logger.error('List presets error', error instanceof Error ? error : undefined);
    }
    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [errorEmbed(t.t('common.error'), t.t('preset.loadFailed'))],
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
  logger?: ExtendedLogger,
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
  logger?: ExtendedLogger,
): Promise<void> {
  await initializeLocale(locale);

  try {
    // FINDING-020: a UUID is fetched by ID; anything else is a typed NAME and
    // goes through the search query — never into the URL path
    const preset = await lookupPreset(env, presetId);

    if (!preset) {
      await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
        embeds: [errorEmbed(t.t('common.error'), t.t('preset.notFound'))],
      });
      return;
    }

    await sendPresetEmbed(interaction, env, t, preset, locale);
  } catch (error) {
    markCommandOutcome(interaction, classifyError(error));
    if (logger) {
      logger.error('Show preset error', error instanceof Error ? error : undefined);
    }
    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [errorEmbed(t.t('common.error'), t.t('preset.loadOneFailed'))],
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
  logger?: ExtendedLogger,
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
  logger?: ExtendedLogger,
): Promise<void> {
  await initializeLocale(locale);

  try {
    const preset = await presetApi.getRandomPreset(env, category);

    if (!preset) {
      await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
        embeds: [
          infoEmbed(
            t.t('preset.randomTitle'),
            category ? t.t('preset.noneInCategory') : t.t('preset.none'),
          ),
        ],
      });
      return;
    }

    await sendPresetEmbed(interaction, env, t, preset, locale);
  } catch (error) {
    markCommandOutcome(interaction, classifyError(error));
    if (logger) {
      logger.error('Random preset error', error instanceof Error ? error : undefined);
    }
    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [errorEmbed(t.t('common.error'), t.t('preset.loadRandomFailed'))],
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
  logger?: ExtendedLogger,
): Promise<Response> {
  // Extract all options
  const presetName = options?.find((opt) => opt.name === 'preset_name')?.value as string;
  const description = options?.find((opt) => opt.name === 'description')?.value as string;
  const category = options?.find((opt) => opt.name === 'category')?.value as string;
  const tagsRaw = options?.find((opt) => opt.name === 'tags')?.value as string | undefined;

  // Collect dye names (dye1-dye6 — presets-api 5.0 takes 3–6 dyes)
  const dyeNames: string[] = [];
  for (let i = 1; i <= 6; i++) {
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

  // Validate dye count (the API's own floor is 3)
  if (dyeNames.length < 3) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('preset.notEnoughDyes'))],
      flags: 64,
    });
  }

  // Resolve dye names to stainIDs — presets-api 5.0 is stainID-keyed and
  // rejects the legacy item id (`dye.id`) this used to send.
  const dyeIds: number[] = [];
  for (const name of dyeNames) {
    const dyes = searchDyesByName(name, t.getLocale());
    const stainId = dyes[0]?.stainID;
    if (stainId != null) {
      dyeIds.push(stainId);
    } else {
      return messageResponse({
        embeds: [errorEmbed(t.t('common.error'), t.t('preset.invalidDye'))],
        flags: 64,
      });
    }
  }

  // Parse tags
  const tags = tagsRaw
    ? tagsRaw
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
        .slice(0, 10)
    : [];

  // Defer response
  const deferResponse = deferredResponse();

  ctx.waitUntil(
    processSubmitCommand(
      interaction,
      env,
      t,
      userId,
      userName,
      {
        name: presetName,
        description,
        category_id: category as PresetCategory,
        dyes: dyeIds,
        tags,
      },
      logger,
    ),
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
  logger?: ExtendedLogger,
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
              t.t('preset.duplicateIntro'),
              // FINDING-019: the duplicate's stored name/author are user content
              `**"${sanitizePresetName(response.duplicate.name)}"** ${t.t('preset.byAuthor', { author: response.duplicate.author_name ? sanitizePresetName(response.duplicate.author_name) : t.t('preset.official') })}`,
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
      title: isApproved ? `✅ ${t.t('preset.submitted')}` : `⏳ ${t.t('preset.submitted')}`,
      description: isApproved ? t.t('preset.submittedApproved') : t.t('preset.submittedPending'),
      color: isApproved ? 0x57f287 : 0xfee75c,
      fields: [
        { name: t.t('preset.name'), value: sanitizePresetName(preset.name), inline: true },
        {
          name: t.t('common.category'),
          value: CATEGORY_DISPLAY[preset.category_id]?.name || preset.category_id,
          inline: true,
        },
        { name: t.t('common.dyes'), value: t.t('preset.colorCount', { n: preset.dyes.length }), inline: true },
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
    markCommandOutcome(interaction, classifyError(error));
    if (logger) {
      logger.error('Submit preset error', error instanceof Error ? error : undefined);
    }
    // SECURITY: Use getSafeMessage() to prevent exposing internal API details
    const message =
      error instanceof PresetAPIError ? t.t(error.getSafeMessageKey()) : t.t('preset.submitFailed');

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
  logger?: ExtendedLogger,
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
  presetInput: string,
  logger?: ExtendedLogger,
): Promise<void> {
  try {
    // FINDING-020: autocomplete sends the UUID; a typed value is a NAME and is
    // resolved through the search query — only the API's own id reaches a path
    const presetId = isValidPresetId(presetInput)
      ? presetInput
      : (await presetApi.getPresetByName(env, presetInput))?.id;
    if (!presetId) {
      await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
        embeds: [errorEmbed(t.t('common.error'), t.t('preset.notFound'))],
      });
      return;
    }

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
        successEmbed(actionMessage, t.t('preset.currentVotes', { count: response.new_vote_count })),
      ],
    });
  } catch (error) {
    markCommandOutcome(interaction, classifyError(error));
    if (logger) {
      logger.error('Vote error', error instanceof Error ? error : undefined);
    }
    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [errorEmbed(t.t('common.error'), t.t('preset.voteFailed'))],
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
  logger?: ExtendedLogger,
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
  const newDescription = options?.find((opt) => opt.name === 'description')?.value as
    string | undefined;
  const tagsRaw = options?.find((opt) => opt.name === 'tags')?.value as string | undefined;

  // Collect dye names (dye1-dye6 — positions map onto the stored 3–6 stainIDs)
  const dyeNames: (string | undefined)[] = [];
  for (let i = 1; i <= 6; i++) {
    const dyeValue = options?.find((opt) => opt.name === `dye${i}`)?.value as string | undefined;
    dyeNames.push(dyeValue);
  }

  // Check if any updates provided
  const hasAnyDye = dyeNames.some((d) => d !== undefined);
  if (!newName && !newDescription && !tagsRaw && !hasAnyDye) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('preset.edit.noFields'))],
      flags: 64,
    });
  }

  // Defer response
  const deferResponse = deferredResponse();

  ctx.waitUntil(
    processEditCommand(
      interaction,
      env,
      t,
      userId,
      userName,
      presetId,
      {
        name: newName,
        description: newDescription,
        tagsRaw,
        dyeNames,
      },
      logger,
    ),
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
  logger?: ExtendedLogger,
): Promise<void> {
  try {
    // First, verify the preset exists and user owns it
    // FINDING-020: UUID → by id; anything else is a typed name (search query)
    const existingPreset = await lookupPreset(env, presetId);
    if (!existingPreset) {
      await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
        embeds: [errorEmbed(t.t('common.error'), t.t('preset.notFound'))],
      });
      return;
    }

    if (existingPreset.author_discord_id !== userId) {
      await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
        embeds: [errorEmbed(t.t('common.error'), t.t('preset.edit.notOwner'))],
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
    const hasAnyDye = updates.dyeNames.some((d) => d !== undefined);
    if (hasAnyDye) {
      // Start with existing dyes
      const newDyeIds: number[] = [...existingPreset.dyes];

      // Replace any specified positions (stored dyes are stainIDs — send the
      // same key back, never the legacy `dye.id`)
      for (let i = 0; i < 6; i++) {
        const dyeName = updates.dyeNames[i];
        if (dyeName) {
          const dyes = searchDyesByName(dyeName, t.getLocale());
          const stainId = dyes[0]?.stainID;
          if (stainId != null) {
            if (i < newDyeIds.length) {
              newDyeIds[i] = stainId;
            } else {
              newDyeIds.push(stainId);
            }
          } else {
            await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
              embeds: [
                errorEmbed(
                  t.t('common.error'),
                  // FINDING-019: typed option value echoed into a public embed
                  t.t('preset.edit.invalidDye', { name: sanitizeEmbedText(dyeName, 100) }),
                ),
              ],
            });
            return;
          }
        }
      }

      // Validate dye count (3-6, the API's own bounds)
      if (newDyeIds.length < 3 || newDyeIds.length > 6) {
        await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
          embeds: [errorEmbed(t.t('common.error'), t.t('preset.edit.dyeCount'))],
        });
        return;
      }

      editPayload.dyes = newDyeIds;
    }

    // Call the edit API — with the API's own id, never the raw option value
    const response = await presetApi.editPreset(
      env,
      existingPreset.id,
      editPayload,
      userId,
      userName,
    );

    // Handle duplicate dyes error
    if (!response.success && 'duplicate' in response) {
      await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
        embeds: [
          {
            title: `⚠️ ${t.t('preset.edit.duplicateTitle')}`,
            description: [
              t.t('preset.edit.duplicateIntro'),
              `**"${sanitizePresetName(response.duplicate.name)}"** ${t.t('preset.byAuthor', { author: response.duplicate.author_name ? sanitizePresetName(response.duplicate.author_name) : t.t('preset.unknownAuthor') })}`,
              '',
              t.t('preset.edit.duplicateHint'),
            ].join('\n'),
            color: STATE.error,
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
      title: isPending ? `⏳ ${t.t('preset.edit.updatedPending')}` : `✅ ${t.t('preset.edit.updated')}`,
      description: isPending
        ? t.t('preset.edit.pendingDescription')
        : t.t('preset.edit.appliedDescription'),
      color: isPending ? 0xfee75c : 0x57f287,
      fields: [
        { name: t.t('preset.name'), value: sanitizePresetName(updatedPreset.name), inline: true },
        {
          name: t.t('common.category'),
          value: CATEGORY_DISPLAY[updatedPreset.category_id]?.name || updatedPreset.category_id,
          inline: true,
        },
        {
          name: t.t('common.dyes'),
          value: t.t('preset.colorCount', { n: updatedPreset.dyes.length }),
          inline: true,
        },
      ],
      footer: {
        text: isPending ? t.t('preset.edit.pendingFooter') : t.t('common.footer'),
      },
    };

    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [embed],
    });

    // Notify moderation channel if pending
    if (isPending && env.MODERATION_CHANNEL_ID) {
      await notifyEditModerationChannel(env, updatedPreset, existingPreset);
    }
  } catch (error) {
    markCommandOutcome(interaction, classifyError(error));
    if (logger) {
      logger.error('Edit preset error', error instanceof Error ? error : undefined);
    }
    // SECURITY: Use getSafeMessage() to prevent exposing internal API details
    const message =
      error instanceof PresetAPIError ? t.t(error.getSafeMessageKey()) : t.t('preset.editFailed');
    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [errorEmbed(t.t('common.error'), message)],
    });
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Resolve a user-supplied preset option to a preset.
 *
 * FINDING-020 (2026-08-21 security audit): autocomplete sends the preset's
 * UUID, a user who ignores it sends free text. Only a UUID is ever fetched
 * by id (and so interpolated into a presets-api path); anything else is a
 * NAME and goes through the search query parameter. Errors propagate — the
 * caller decides between "not found" and "load failed".
 */
async function lookupPreset(env: Env, input: string): Promise<CommunityPreset | null> {
  if (isValidPresetId(input)) {
    return presetApi.getPreset(env, input);
  }
  return presetApi.getPresetByName(env, input);
}

/**
 * Send a preset embed with color swatch image
 */
async function sendPresetEmbed(
  interaction: DiscordInteraction,
  env: Env,
  t: Translator,
  preset: CommunityPreset,
  locale: LocaleCode,
): Promise<void> {
  // Resolve stain IDs to Dye objects (5.0: preset dyes are stainIDs)
  const dyes: (Dye | null)[] = preset.dyes.map((stainId) => {
    return dyeService.getByStainId(stainId) || null;
  });

  // FINDING-019: the EMBED gets sanitised text (markdown escaped, mentions
  // defused, controls stripped); the SVG card below keeps the raw strings —
  // the svg layer XML-escapes itself and would otherwise print backslashes.
  const safeName = sanitizePresetName(preset.name);
  const safeDescription = sanitizePresetDescription(preset.description);
  const safeAuthor = preset.author_name ? sanitizePresetName(preset.author_name) : null;
  const safeTags = preset.tags.map((tag) => sanitizeEmbedText(tag, 50)).filter(Boolean);

  // BUG-030: the bundled CJK subsets are cut from LOCALE data — dye names, bot
  // UI strings, a fixed code-glyph list — but these three strings are written
  // by users. A preset called 桜の夢 has no reason to share characters with any
  // dye name, so it drew tofu boxes. The 3,072 KiB Worker cap rules out
  // shipping the full faces, so the card draws what it can and the embed below
  // carries the untouched original, which Discord renders with the reader's
  // own system fonts.
  const cardName = filterToRenderableTitle(preset.name);
  const cardDescription = preset.description ? filterToRenderable(preset.description) : null;
  const cardAuthor = preset.author_name ? filterToRenderableTitle(preset.author_name) : null;

  // Generate SVG swatch
  const svg = generatePresetSwatch({
    name: cardName.text,
    description: cardDescription?.text ?? preset.description,
    category: preset.category_id,
    dyes,
    // F-11: the swatch card renders in the user's locale. FONT-002: the votes
    // segment is localized text now — it used to be `${voteCount}★`, and no
    // bundled font carries U+2605, so it drew as a tofu box on every card.
    authorLine: cardAuthor
      ? t.t('preset.byAuthor', { author: cardAuthor.text })
      : t.t('preset.official'),
    emptyLabel: t.t('preset.noValidDyes'),
    votesLabel:
      preset.vote_count === undefined
        ? undefined
        : t.tc('preset.cardVotes', preset.vote_count),
    dyeName: (d) => getLocalizedDyeName(d.itemID, d.name, locale),
  });

  // Render to PNG
  const pngBuffer = await renderSvgToPng(svg, { scale: 2 });

  // Build dye list with emojis
  const dyeList = dyes
    .filter((d): d is Dye => d !== null)
    .map((dye) => {
      const emoji = getDyeEmoji(dye.stainID ?? 0, env.DISCORD_CLIENT_ID);
      const emojiPrefix = emoji ? `${emoji} ` : '';
      const localizedName = getLocalizedDyeName(dye.itemID, dye.name, locale);
      return `${emojiPrefix}${localizedName} (\`${dye.hex.toUpperCase()}\`)`;
    })
    .join('\n');

  const categoryDisplay = CATEGORY_DISPLAY[preset.category_id];
  const author = safeAuthor
    ? t.t('preset.byAuthor', { author: safeAuthor })
    : t.t('preset.official');

  await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
    embeds: [
      {
        title: `${categoryDisplay?.icon || '🎨'} ${safeName}`,
        description: [
          safeDescription,
          '',
          `**${t.t('preset.colors')}:**`,
          dyeList,
          '',
          safeTags.length > 0 ? `**${t.t('preset.tags')}:** ${safeTags.join(', ')}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
        color: BRAND_ACCENT,
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
  logger?: ExtendedLogger,
): Promise<void> {
  if (!env.SUBMISSION_LOG_CHANNEL_ID) return;

  const categoryDisplay = CATEGORY_DISPLAY[preset.category_id];
  const statusDisplay = STATUS_DISPLAY[status];
  // Use English translator for admin notifications (no user context)
  const adminT = createTranslator('en');
  // FINDING-019 (DW-1): this path used to skip the sanitiser the moderation
  // path applies — same treatment for name / description / author now
  const safeName = sanitizePresetName(preset.name);
  const safeDescription = sanitizePresetDescription(preset.description);
  const safeAuthor = sanitizePresetName(preset.author_name || 'Unknown');

  try {
    await sendMessage(env.DISCORD_TOKEN, env.SUBMISSION_LOG_CHANNEL_ID, {
      embeds: [
        {
          title: `${statusDisplay.icon} New Preset: ${safeName}`,
          description: safeDescription,
          color: statusDisplay.color,
          fields: [
            {
              name: adminT.t('webhook.fields.category'),
              value: categoryDisplay?.name || preset.category_id,
              inline: true,
            },
            {
              name: adminT.t('webhook.fields.author'),
              value: safeAuthor,
              inline: true,
            },
            {
              name: adminT.t('webhook.fields.dyes'),
              value: adminT.t('preset.colorCount', { n: preset.dyes.length }),
              inline: true,
            },
          ],
          footer: { text: `ID: ${preset.id}` },
          timestamp: new Date().toISOString(),
        },
      ],
    });
  } catch (error) {
    if (logger) {
      logger.error(
        'Failed to notify submission channel',
        error instanceof Error ? error : undefined,
      );
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
  logger?: ExtendedLogger,
): Promise<void> {
  await sendModerationNotification(
    env,
    {
      kind: 'new',
      preset,
      categoryName: CATEGORY_DISPLAY[preset.category_id]?.name,
    },
    logger,
  );
}

/**
 * Notify moderation channel about a preset edit that needs review
 */
async function notifyEditModerationChannel(
  env: Env,
  updatedPreset: CommunityPreset,
  originalPreset: CommunityPreset,
  logger?: ExtendedLogger,
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
    logger,
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
  _logger?: ExtendedLogger,
): Promise<CommunityPreset | null> {
  // FINDING-020: UUID → by id, anything else → name search (never a path segment)
  return lookupPreset(env, idOrName).catch(() => null);
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
  logger?: ExtendedLogger,
): Promise<Response> {
  const presetInput = options?.find((o) => o.name === 'preset_name')?.value as string | undefined;
  if (!presetInput) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('preset.favorite.nameRequired'))],
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
  logger?: ExtendedLogger,
): Promise<void> {
  try {
    const preset = await resolvePresetByIdOrName(env, presetInput, logger);
    if (!preset) {
      await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
        embeds: [
          errorEmbed(t.t('common.error'), t.t('preset.notFound')),
        ],
      });
      return;
    }
    const result = await addPresetFavorite(env.KV, userId, preset.id, preset.name, logger);
    // FINDING-019: stored preset name → escaped before it reaches the embed
    const safeName = sanitizePresetName(preset.name);
    if (!result.success) {
      const reasonMsg =
        result.reason === 'alreadyExists'
          ? t.t('preset.favorite.alreadyExists', { name: safeName })
          : result.reason === 'limitReached'
            ? t.t('preset.favorite.limitReached', { max: MAX_PRESET_FAVORITES })
            : t.t('preset.favorite.addFailed');
      await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
        embeds: [errorEmbed(t.t('common.error'), reasonMsg)],
      });
      return;
    }
    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [
        successEmbed(
          `⭐ ${t.t('preset.favorite.addedTitle')}`,
          t.t('preset.favorite.added', { name: safeName }),
        ),
      ],
    });
  } catch (error) {
    markCommandOutcome(interaction, classifyError(error));
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
  logger?: ExtendedLogger,
): Promise<Response> {
  const presetInput = options?.find((o) => o.name === 'preset_name')?.value as string | undefined;
  if (!presetInput) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('preset.favorite.nameRequired'))],
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
  logger?: ExtendedLogger,
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
    // FINDING-019: presetName may be the raw typed value when nothing resolved
    const safeName = sanitizePresetName(presetName);
    if (!result.success) {
      const reasonMsg =
        result.reason === 'notFound'
          ? t.t('preset.favorite.notFound', { name: safeName })
          : t.t('preset.favorite.removeFailed');
      await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
        embeds: [errorEmbed(t.t('common.error'), reasonMsg)],
      });
      return;
    }
    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [
        successEmbed(
          `🗑️ ${t.t('preset.favorite.removedTitle')}`,
          t.t('preset.favorite.removed', { name: safeName }),
        ),
      ],
    });
  } catch (error) {
    markCommandOutcome(interaction, classifyError(error));
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
  logger?: ExtendedLogger,
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
  logger?: ExtendedLogger,
): Promise<void> {
  try {
    const ids = await getPresetFavorites(env.KV, userId, logger);
    if (ids.length === 0) {
      await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
        embeds: [
          infoEmbed(`⭐ ${t.t('preset.favorite.listTitle')}`, t.t('preset.favorite.empty')),
        ],
      });
      return;
    }
    const resolved = await Promise.all(
      ids.map((id) => presetApi.getPreset(env, id).catch(() => null)),
    );
    const presets = resolved.filter((p): p is CommunityPreset => p !== null);

    if (presets.length === 0) {
      await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
        embeds: [
          infoEmbed(`⭐ ${t.t('preset.favorite.listTitle')}`, t.t('preset.favorite.allRemoved')),
        ],
      });
      return;
    }

    const lines = presets.map((p, i) => {
      const catEntry = CATEGORY_DISPLAY[p.category_id];
      const cat = catEntry?.name ?? p.category_id;
      return `**${i + 1}.** ${sanitizePresetName(p.name)} — *${cat}*`;
    });

    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [
        {
          title: `⭐ ${t.t('preset.favorite.listTitleCount', { n: presets.length, max: MAX_PRESET_FAVORITES })}`,
          description: lines.join('\n'),
          color: STATE.warning,
          footer: { text: t.t('common.footer') },
        },
      ],
    });
  } catch (error) {
    markCommandOutcome(interaction, classifyError(error));
    if (logger) {
      logger.error('preset favorite list failed', error instanceof Error ? error : undefined);
    }
    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [errorEmbed(t.t('common.error'), t.t('common.unknownError'))],
    });
  }
}
