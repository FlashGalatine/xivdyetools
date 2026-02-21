/**
 * /collection Command Handler (DEPRECATED in V4)
 *
 * This command is deprecated in v4.0.0. Users should use /preset instead.
 * The command still works but shows a deprecation notice.
 *
 * @deprecated Use /preset instead for managing dye collections
 * @module handlers/commands/collection
 */

import type { Dye } from '@xivdyetools/core';
import { messageResponse, errorEmbed } from '../../utils/response.js';
import {
  getCollections,
  getCollection,
  createCollection,
  deleteCollection,
  renameCollection,
  addDyeToCollection,
  removeDyeFromCollection,
  MAX_COLLECTIONS,
  MAX_DYES_PER_COLLECTION,
  MAX_COLLECTION_NAME_LENGTH,
} from '../../services/user-storage.js';
import { getDyeEmoji } from '../../services/emoji.js';
import { resolveDyeInput, dyeService } from '../../utils/color.js';
import { createUserTranslator, createTranslator, type Translator } from '../../services/bot-i18n.js';
import { discordLocaleToLocaleCode, initializeLocale, getLocalizedDyeName } from '../../services/i18n.js';
import type { Env, DiscordInteraction } from '../../types/env.js';

// ============================================================================
// Constants
// ============================================================================

/** Deprecation warning shown with all responses */
const DEPRECATION_NOTICE = '⚠️ **This command is deprecated.** Use `/preset` instead for managing dye collections.\n\n';

/** Color for deprecation warning embeds */
const DEPRECATION_COLOR = 0xfee75c; // Yellow

// ============================================================================
// Main Handler
// ============================================================================

/**
 * Handles the /collection command (deprecated)
 *
 * @deprecated Use /preset command instead
 */
export async function handleCollectionCommand(
  interaction: DiscordInteraction,
  env: Env,
  _ctx: ExecutionContext
): Promise<Response> {
  const userId = interaction.member?.user?.id ?? interaction.user?.id;

  if (!userId) {
    const locale = discordLocaleToLocaleCode(interaction.locale ?? 'en') ?? 'en';
    const t = createTranslator(locale);
    return messageResponse({
      embeds: [errorEmbed('Error', t.t('errors.userNotFound'))],
      flags: 64,
    });
  }

  // Get translator for user's locale
  const t = await createUserTranslator(env.KV, userId, interaction.locale);

  // Initialize xivdyetools-core localization for dye names
  const locale = t.getLocale();
  await initializeLocale(locale);

  // Extract subcommand
  const options = interaction.data?.options || [];
  const subcommand = options.find((opt) => opt.type === 1);

  if (!subcommand) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), 'Please specify a subcommand.')],
      flags: 64,
    });
  }

  switch (subcommand.name) {
    case 'create':
      return handleCreate(env, userId, t, subcommand.options);

    case 'delete':
      return handleDelete(env, userId, t, subcommand.options);

    case 'add':
      return handleAdd(env, userId, t, subcommand.options);

    case 'remove':
      return handleRemove(env, userId, t, subcommand.options);

    case 'show':
      return handleShow(env, userId, t, subcommand.options);

    case 'list':
      return handleList(env, userId, t);

    case 'rename':
      return handleRename(env, userId, t, subcommand.options);

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
 * Handle /collection create <name> [description]
 */
async function handleCreate(
  env: Env,
  userId: string,
  t: Translator,
  options?: Array<{ name: string; value?: string | number | boolean }>
): Promise<Response> {
  const nameOption = options?.find((opt) => opt.name === 'name');
  const descOption = options?.find((opt) => opt.name === 'description');

  const name = nameOption?.value as string | undefined;
  const description = descOption?.value as string | undefined;

  if (!name) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.missingName'))],
      flags: 64,
    });
  }

  const result = await createCollection(env.KV, userId, name, description);

  if (!result.success) {
    switch (result.reason) {
      case 'nameTooLong':
        return messageResponse({
          embeds: [{
            title: '❌ ' + t.t('common.error'),
            description: DEPRECATION_NOTICE + t.t('collection.nameTooLong', { max: MAX_COLLECTION_NAME_LENGTH }),
            color: DEPRECATION_COLOR,
            footer: { text: 'Use /preset create instead' },
          }],
          flags: 64,
        });

      case 'alreadyExists':
        return messageResponse({
          embeds: [{
            title: '❌ ' + t.t('common.error'),
            description: DEPRECATION_NOTICE + t.t('collection.alreadyExists', { name }),
            color: DEPRECATION_COLOR,
            footer: { text: 'Use /preset create instead' },
          }],
          flags: 64,
        });

      case 'limitReached':
        return messageResponse({
          embeds: [{
            title: '❌ ' + t.t('common.error'),
            description: DEPRECATION_NOTICE + t.t('collection.limitReached', { max: MAX_COLLECTIONS }),
            color: DEPRECATION_COLOR,
            footer: { text: 'Use /preset - supports more presets via cloud sync' },
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

  const descText = description ? `\n\n*${description}*` : '';

  return messageResponse({
    embeds: [{
      title: '✅ ' + t.t('common.success'),
      description: DEPRECATION_NOTICE +
        `${t.t('collection.created', { name })}${descText}\n\n` +
        t.t('collection.addDyeHint', { name }),
      color: DEPRECATION_COLOR,
      footer: { text: 'Consider using /preset create for the new system' },
    }],
    flags: 64,
  });
}

/**
 * Handle /collection delete <name>
 */
async function handleDelete(
  env: Env,
  userId: string,
  t: Translator,
  options?: Array<{ name: string; value?: string | number | boolean }>
): Promise<Response> {
  const nameOption = options?.find((opt) => opt.name === 'name');
  const name = nameOption?.value as string | undefined;

  if (!name) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.missingName'))],
      flags: 64,
    });
  }

  const deleted = await deleteCollection(env.KV, userId, name);

  if (!deleted) {
    return messageResponse({
      embeds: [{
        title: '❌ ' + t.t('common.error'),
        description: DEPRECATION_NOTICE + t.t('collection.notFound', { name }),
        color: DEPRECATION_COLOR,
        footer: { text: 'Use /preset delete instead' },
      }],
      flags: 64,
    });
  }

  return messageResponse({
    embeds: [{
      title: '✅ ' + t.t('common.success'),
      description: DEPRECATION_NOTICE + t.t('collection.deleted', { name }),
      color: DEPRECATION_COLOR,
      footer: { text: 'Use /preset for managing dye presets' },
    }],
    flags: 64,
  });
}

/**
 * Handle /collection add <name> <dye>
 */
async function handleAdd(
  env: Env,
  userId: string,
  t: Translator,
  options?: Array<{ name: string; value?: string | number | boolean }>
): Promise<Response> {
  const nameOption = options?.find((opt) => opt.name === 'name');
  const dyeOption = options?.find((opt) => opt.name === 'dye');

  const name = nameOption?.value as string | undefined;
  const dyeInput = dyeOption?.value as string | undefined;

  if (!name || !dyeInput) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.missingInput'))],
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

  const result = await addDyeToCollection(env.KV, userId, name, dye.id);

  // Get localized dye name
  const localizedDyeName = getLocalizedDyeName(dye.itemID, dye.name, t.getLocale());
  const emoji = getDyeEmoji(dye.id);
  const emojiStr = emoji ? `${emoji} ` : '';

  if (!result.success) {
    switch (result.reason) {
      case 'notFound':
        return messageResponse({
          embeds: [{
            title: '❌ ' + t.t('common.error'),
            description: DEPRECATION_NOTICE + t.t('collection.notFound', { name }),
            color: DEPRECATION_COLOR,
            footer: { text: 'Use /preset instead' },
          }],
          flags: 64,
        });

      case 'alreadyExists':
        return messageResponse({
          embeds: [{
            title: '⚠️ Already Added',
            description: DEPRECATION_NOTICE +
              `${emojiStr}**${localizedDyeName}** is already in **${name}**.`,
            color: DEPRECATION_COLOR,
            footer: { text: 'Use /preset instead' },
          }],
          flags: 64,
        });

      case 'limitReached':
        return messageResponse({
          embeds: [{
            title: '❌ ' + t.t('common.error'),
            description: DEPRECATION_NOTICE + t.t('collection.dyeLimitReached', { max: MAX_DYES_PER_COLLECTION }),
            color: DEPRECATION_COLOR,
            footer: { text: 'Use /preset - supports more dyes per preset' },
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
      description: DEPRECATION_NOTICE +
        `${emojiStr}${t.t('collection.dyeAdded', { dye: localizedDyeName, collection: name })}`,
      color: DEPRECATION_COLOR,
      footer: { text: 'Consider using /preset instead' },
    }],
    flags: 64,
  });
}

/**
 * Handle /collection remove <name> <dye>
 */
async function handleRemove(
  env: Env,
  userId: string,
  t: Translator,
  options?: Array<{ name: string; value?: string | number | boolean }>
): Promise<Response> {
  const nameOption = options?.find((opt) => opt.name === 'name');
  const dyeOption = options?.find((opt) => opt.name === 'dye');

  const name = nameOption?.value as string | undefined;
  const dyeInput = dyeOption?.value as string | undefined;

  if (!name || !dyeInput) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.missingInput'))],
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

  const removed = await removeDyeFromCollection(env.KV, userId, name, dye.id);

  // Get localized dye name
  const localizedDyeName = getLocalizedDyeName(dye.itemID, dye.name, t.getLocale());
  const emoji = getDyeEmoji(dye.id);
  const emojiStr = emoji ? `${emoji} ` : '';

  if (!removed) {
    return messageResponse({
      embeds: [{
        title: '⚠️ Not Found',
        description: DEPRECATION_NOTICE +
          `${emojiStr}**${localizedDyeName}** is not in **${name}**.`,
        color: DEPRECATION_COLOR,
        footer: { text: 'Use /preset instead' },
      }],
      flags: 64,
    });
  }

  return messageResponse({
    embeds: [{
      title: '✅ ' + t.t('common.success'),
      description: DEPRECATION_NOTICE +
        `${emojiStr}${t.t('collection.dyeRemoved', { dye: localizedDyeName, collection: name })}`,
      color: DEPRECATION_COLOR,
      footer: { text: 'Use /preset for managing dye presets' },
    }],
    flags: 64,
  });
}

/**
 * Handle /collection show <name>
 */
async function handleShow(
  env: Env,
  userId: string,
  t: Translator,
  options?: Array<{ name: string; value?: string | number | boolean }>
): Promise<Response> {
  const nameOption = options?.find((opt) => opt.name === 'name');
  const name = nameOption?.value as string | undefined;

  if (!name) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.missingName'))],
      flags: 64,
    });
  }

  const collection = await getCollection(env.KV, userId, name);

  if (!collection) {
    return messageResponse({
      embeds: [{
        title: '❌ ' + t.t('common.error'),
        description: DEPRECATION_NOTICE + t.t('collection.notFound', { name }),
        color: DEPRECATION_COLOR,
        footer: { text: 'Use /preset show instead' },
      }],
      flags: 64,
    });
  }

  if (collection.dyes.length === 0) {
    return messageResponse({
      embeds: [{
        title: `📁 ${collection.name}`,
        description: DEPRECATION_NOTICE +
          (collection.description ? `*${collection.description}*\n\n` : '') +
          `${t.t('collection.collectionEmpty')}\n\n` +
          t.t('collection.addDyeHint', { name: collection.name }),
        color: DEPRECATION_COLOR,
        footer: { text: 'Use /preset show instead' },
      }],
      flags: 64,
    });
  }

  // Get dye details
  const dyes = collection.dyes
    .map((id) => dyeService.getDyeById(id))
    .filter((dye): dye is Dye => dye !== null);

  // Build list with localized names
  const dyeList = dyes.map((dye, index) => {
    const emoji = getDyeEmoji(dye.id);
    const emojiStr = emoji ? `${emoji} ` : '';
    const localizedName = getLocalizedDyeName(dye.itemID, dye.name, t.getLocale());
    return `${index + 1}. ${emojiStr}**${localizedName}** (\`${dye.hex.toUpperCase()}\`)`;
  });

  const description =
    DEPRECATION_NOTICE +
    (collection.description ? `*${collection.description}*\n\n` : '') +
    dyeList.join('\n');

  return messageResponse({
    embeds: [{
      title: `📁 ${collection.name} (${dyes.length}/${MAX_DYES_PER_COLLECTION})`,
      description,
      color: DEPRECATION_COLOR,
      footer: {
        text: `Created: ${new Date(collection.createdAt).toLocaleDateString()} • Use /preset show instead`,
      },
    }],
    flags: 64,
  });
}

/**
 * Handle /collection list
 */
async function handleList(env: Env, userId: string, t: Translator): Promise<Response> {
  const collections = await getCollections(env.KV, userId);

  if (collections.length === 0) {
    return messageResponse({
      embeds: [{
        title: '📁 ' + t.t('collection.title'),
        description: DEPRECATION_NOTICE +
          `${t.t('collection.empty')}\n\nConsider using \`/preset\` to create organized dye presets instead.`,
        color: DEPRECATION_COLOR,
        footer: { text: 'Use /preset list to see your presets' },
      }],
      flags: 64,
    });
  }

  // Build list
  const collectionList = collections.map((c, index) => {
    const dyeCount = c.dyes.length;
    const desc = c.description ? ` - *${c.description.substring(0, 30)}${c.description.length > 30 ? '...' : ''}*` : '';
    const dyeWord = dyeCount === 1 ? t.t('common.dye') : t.t('common.dyes');
    return `${index + 1}. **${c.name}** (${dyeCount} ${dyeWord})${desc}`;
  });

  return messageResponse({
    embeds: [{
      title: `📁 ${t.t('collection.title')} (${collections.length}/${MAX_COLLECTIONS})`,
      description: DEPRECATION_NOTICE + collectionList.join('\n'),
      color: DEPRECATION_COLOR,
      footer: {
        text: 'Use /preset list to see presets • Consider migrating to /preset',
      },
    }],
    flags: 64,
  });
}

/**
 * Handle /collection rename <name> <new_name>
 */
async function handleRename(
  env: Env,
  userId: string,
  t: Translator,
  options?: Array<{ name: string; value?: string | number | boolean }>
): Promise<Response> {
  const nameOption = options?.find((opt) => opt.name === 'name');
  const newNameOption = options?.find((opt) => opt.name === 'new_name');

  const name = nameOption?.value as string | undefined;
  const newName = newNameOption?.value as string | undefined;

  if (!name || !newName) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.missingInput'))],
      flags: 64,
    });
  }

  const result = await renameCollection(env.KV, userId, name, newName);

  if (!result.success) {
    switch (result.reason) {
      case 'nameTooLong':
        return messageResponse({
          embeds: [{
            title: '❌ ' + t.t('common.error'),
            description: DEPRECATION_NOTICE + t.t('collection.nameTooLong', { max: MAX_COLLECTION_NAME_LENGTH }),
            color: DEPRECATION_COLOR,
            footer: { text: 'Use /preset instead' },
          }],
          flags: 64,
        });

      case 'notFound':
        return messageResponse({
          embeds: [{
            title: '❌ ' + t.t('common.error'),
            description: DEPRECATION_NOTICE + t.t('collection.notFound', { name }),
            color: DEPRECATION_COLOR,
            footer: { text: 'Use /preset instead' },
          }],
          flags: 64,
        });

      case 'alreadyExists':
        return messageResponse({
          embeds: [{
            title: '❌ ' + t.t('common.error'),
            description: DEPRECATION_NOTICE + t.t('collection.alreadyExists', { name: newName }),
            color: DEPRECATION_COLOR,
            footer: { text: 'Use /preset instead' },
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
      description: DEPRECATION_NOTICE + t.t('collection.renamed', { oldName: name, newName }),
      color: DEPRECATION_COLOR,
      footer: { text: 'Consider migrating to /preset' },
    }],
    flags: 64,
  });
}
