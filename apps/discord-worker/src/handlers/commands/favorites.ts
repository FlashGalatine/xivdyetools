/**
 * /favorites Command Handler (DEPRECATED in V4)
 *
 * This command is deprecated in v4.0.0. Users should use /preset instead.
 * The command still works but shows a deprecation notice.
 *
 * @deprecated Use /preset instead for managing saved dyes
 * @module handlers/commands/favorites
 */

import type { Dye } from '@xivdyetools/core';
import { messageResponse, errorEmbed } from '../../utils/response.js';
import {
  getFavorites,
  addFavorite,
  removeFavorite,
  clearFavorites,
  MAX_FAVORITES,
} from '../../services/user-storage.js';
import { getDyeEmoji } from '../../services/emoji.js';
import { resolveDyeInput, dyeService } from '../../utils/color.js';
import { createUserTranslator, type Translator } from '../../services/bot-i18n.js';
import { initializeLocale, getLocalizedDyeName, getLocalizedCategory } from '../../services/i18n.js';
import type { Env, DiscordInteraction } from '../../types/env.js';

// ============================================================================
// Constants
// ============================================================================

/** Deprecation warning shown with all responses */
const DEPRECATION_NOTICE = '⚠️ **This command is deprecated.** Use `/preset` instead for managing saved dyes.\n\n';

/** Color for deprecation warning embeds */
const DEPRECATION_COLOR = 0xfee75c; // Yellow

// ============================================================================
// Main Handler
// ============================================================================

/**
 * Handles the /favorites command (deprecated)
 *
 * @deprecated Use /preset command instead
 */
export async function handleFavoritesCommand(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const userId = interaction.member?.user?.id ?? interaction.user?.id;

  if (!userId) {
    return messageResponse({
      embeds: [errorEmbed('Error', 'Could not identify user.')],
      flags: 64,
    });
  }

  // Get translator for user's locale
  const t = await createUserTranslator(env.KV, userId, interaction.locale);

  // Initialize xivdyetools-core localization for dye names using translator's resolved locale
  await initializeLocale(t.getLocale());

  // Extract subcommand
  const options = interaction.data?.options || [];
  const subcommand = options.find((opt) => opt.type === 1); // SUB_COMMAND type

  if (!subcommand) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), 'Please specify a subcommand: `add`, `remove`, `list`, or `clear`.')],
      flags: 64,
    });
  }

  switch (subcommand.name) {
    case 'add':
      return handleAddFavorite(env, userId, t, subcommand.options);

    case 'remove':
      return handleRemoveFavorite(env, userId, t, subcommand.options);

    case 'list':
      return handleListFavorites(env, userId, t);

    case 'clear':
      return handleClearFavorites(env, userId, t);

    default:
      return messageResponse({
        embeds: [errorEmbed(t.t('common.error'), `Unknown subcommand: ${subcommand.name}`)],
        flags: 64,
      });
  }
}

// ============================================================================
// Subcommand Handlers
// ============================================================================

/**
 * Handle /favorites add <dye>
 */
async function handleAddFavorite(
  env: Env,
  userId: string,
  t: Translator,
  options?: Array<{ name: string; value?: string | number | boolean }>
): Promise<Response> {
  const dyeOption = options?.find((opt) => opt.name === 'dye');
  const dyeInput = dyeOption?.value as string | undefined;

  if (!dyeInput) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.missingName'))],
      flags: 64,
    });
  }

  // Resolve the dye
  const dye = resolveDyeInput(dyeInput);
  if (!dye) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.dyeNotFound', { name: dyeInput }))],
      flags: 64,
    });
  }

  // Add to favorites
  const result = await addFavorite(env.KV, userId, dye.id);

  // Get localized dye name
  const localizedName = getLocalizedDyeName(dye.itemID, dye.name, t.getLocale());
  const emoji = getDyeEmoji(dye.id);
  const emojiStr = emoji ? `${emoji} ` : '';

  if (!result.success) {
    switch (result.reason) {
      case 'alreadyExists':
        return messageResponse({
          embeds: [{
            title: '⚠️ Already in Favorites',
            description: DEPRECATION_NOTICE + `${emojiStr}**${localizedName}** is already in your favorites.`,
            color: DEPRECATION_COLOR,
            footer: { text: 'Use /preset create to save dyes in the new system' },
          }],
          flags: 64,
        });

      case 'limitReached':
        return messageResponse({
          embeds: [{
            title: '❌ ' + t.t('common.error'),
            description: DEPRECATION_NOTICE + t.t('favorites.limitReached', { max: MAX_FAVORITES }),
            color: DEPRECATION_COLOR,
            footer: { text: 'Use /preset create - presets support more dyes' },
          }],
          flags: 64,
        });

      default:
        return messageResponse({
          embeds: [errorEmbed(t.t('common.error'), t.t('errors.failedToSave'))],
          flags: 64,
        });
    }
  }

  return messageResponse({
    embeds: [{
      title: '✅ ' + t.t('common.success'),
      description: DEPRECATION_NOTICE + `${emojiStr}${t.t('favorites.added', { name: localizedName })}`,
      color: DEPRECATION_COLOR,
      footer: { text: 'Use /preset create to save dyes in the new system' },
    }],
    flags: 64,
  });
}

/**
 * Handle /favorites remove <dye>
 */
async function handleRemoveFavorite(
  env: Env,
  userId: string,
  t: Translator,
  options?: Array<{ name: string; value?: string | number | boolean }>
): Promise<Response> {
  const dyeOption = options?.find((opt) => opt.name === 'dye');
  const dyeInput = dyeOption?.value as string | undefined;

  if (!dyeInput) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.missingName'))],
      flags: 64,
    });
  }

  // Resolve the dye
  const dye = resolveDyeInput(dyeInput);
  if (!dye) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.dyeNotFound', { name: dyeInput }))],
      flags: 64,
    });
  }

  // Remove from favorites
  const removed = await removeFavorite(env.KV, userId, dye.id);

  // Get localized dye name
  const localizedName = getLocalizedDyeName(dye.itemID, dye.name, t.getLocale());
  const emoji = getDyeEmoji(dye.id);
  const emojiStr = emoji ? `${emoji} ` : '';

  if (!removed) {
    return messageResponse({
      embeds: [{
        title: '⚠️ Not Found',
        description: DEPRECATION_NOTICE + `${emojiStr}**${localizedName}** is not in your favorites.`,
        color: DEPRECATION_COLOR,
        footer: { text: 'Use /preset to manage your saved dyes instead' },
      }],
      flags: 64,
    });
  }

  return messageResponse({
    embeds: [{
      title: '✅ ' + t.t('common.success'),
      description: DEPRECATION_NOTICE + `${emojiStr}${t.t('favorites.removed', { name: localizedName })}`,
      color: DEPRECATION_COLOR,
      footer: { text: 'Use /preset to manage your saved dyes instead' },
    }],
    flags: 64,
  });
}

/**
 * Handle /favorites list
 */
async function handleListFavorites(env: Env, userId: string, t: Translator): Promise<Response> {
  const favoriteIds = await getFavorites(env.KV, userId);

  if (favoriteIds.length === 0) {
    return messageResponse({
      embeds: [{
        title: '📋 ' + t.t('favorites.title'),
        description: DEPRECATION_NOTICE + `${t.t('favorites.empty')}\n\nConsider using \`/preset\` to create organized dye presets instead.`,
        color: DEPRECATION_COLOR,
        footer: { text: 'Use /preset list to see your presets' },
      }],
      flags: 64,
    });
  }

  // Get dye details for each favorite
  const dyes = favoriteIds
    .map((id) => dyeService.getDyeById(id))
    .filter((dye): dye is Dye => dye !== null);

  // Build list with emojis and localized names
  const dyeList = dyes.map((dye, index) => {
    const emoji = getDyeEmoji(dye.id);
    const emojiStr = emoji ? `${emoji} ` : '';
    const localizedName = getLocalizedDyeName(dye.itemID, dye.name, t.getLocale());
    const localizedCategory = getLocalizedCategory(dye.category, t.getLocale());
    return `${index + 1}. ${emojiStr}**${localizedName}** (\`${dye.hex.toUpperCase()}\`) - ${localizedCategory}`;
  });

  // Group by category for summary with localized names
  const categoryCount = dyes.reduce((acc, dye) => {
    acc[dye.category] = (acc[dye.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const categorySummary = Object.entries(categoryCount)
    .map(([cat, count]) => `${getLocalizedCategory(cat, t.getLocale())}: ${count}`)
    .join(' • ');

  return messageResponse({
    embeds: [{
      title: `📋 ${t.t('favorites.title')} (${t.t('favorites.count', { count: dyes.length, max: MAX_FAVORITES })})`,
      description: DEPRECATION_NOTICE + dyeList.join('\n'),
      color: DEPRECATION_COLOR,
      footer: {
        text: `${categorySummary} • Use /preset to migrate your favorites`,
      },
    }],
    flags: 64,
  });
}

/**
 * Handle /favorites clear
 */
async function handleClearFavorites(env: Env, userId: string, t: Translator): Promise<Response> {
  // Get current count for confirmation message
  const favorites = await getFavorites(env.KV, userId);
  const count = favorites.length;

  if (count === 0) {
    return messageResponse({
      embeds: [{
        title: '📋 ' + t.t('favorites.title'),
        description: DEPRECATION_NOTICE + t.t('favorites.empty'),
        color: DEPRECATION_COLOR,
        footer: { text: 'Use /preset to create organized dye presets' },
      }],
      flags: 64,
    });
  }

  const success = await clearFavorites(env.KV, userId);

  if (!success) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.failedToReset'))],
      flags: 64,
    });
  }

  return messageResponse({
    embeds: [{
      title: '✅ ' + t.t('common.success'),
      description: DEPRECATION_NOTICE + t.t('favorites.cleared'),
      color: DEPRECATION_COLOR,
      footer: { text: 'Use /preset create to start fresh with the new system' },
    }],
    flags: 64,
  });
}
