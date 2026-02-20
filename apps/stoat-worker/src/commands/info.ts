/**
 * Dye info command — look up a dye's color values.
 * `!xd info <dye>` → shows dye info card with color values.
 *
 * This is the first end-to-end command: resolve dye → build embed → send response.
 * Image rendering (SVG→PNG) is deferred to a future implementation step.
 */

import { executeDyeInfo } from '@xivdyetools/bot-logic';
import type { Dye } from '@xivdyetools/core';
import type { LocaleCode } from '@xivdyetools/bot-i18n';
import type { CommandContext } from '../router.js';
import { parseSingleDyeArgs } from './parser.js';
import { resolveDyeInputMulti } from '../services/dye-resolver.js';
import {
  formatErrorReply,
  formatDisambiguationList,
  formatNoMatchReply,
  colorToHex,
  DYE_INFO_REACTIONS,
} from '../services/response-formatter.js';

/**
 * Handle the `!xd info <dye>` command.
 */
export async function handleInfoCommand(ctx: CommandContext): Promise<void> {
  const { dyeName } = parseSingleDyeArgs(ctx.parsed.rawArgs);

  if (!dyeName) {
    const msg = formatErrorReply(
      ctx.message.id,
      'Please provide a dye name or ItemID.',
      '!xd info <dye name or ItemID>',
    );
    await ctx.message.channel?.sendMessage(msg);
    return;
  }

  const locale: LocaleCode = 'en'; // TODO: resolve from user preferences
  const resolution = resolveDyeInputMulti(dyeName, locale);

  // Handle resolution result
  switch (resolution.kind) {
    case 'none': {
      const msg = formatNoMatchReply(ctx.message.id, resolution.query, resolution.suggestions);
      await ctx.message.channel?.sendMessage(msg);
      return;
    }

    case 'disambiguation': {
      const msg = formatDisambiguationList(
        ctx.message.id,
        resolution.query,
        resolution.dyes.map((d) => ({ name: d.name ?? '', itemID: d.itemID ?? null })),
        resolution.total,
      );
      await ctx.message.channel?.sendMessage(msg);
      return;
    }

    case 'single': {
      if (!resolution.dye.dye) {
        const msg = formatErrorReply(ctx.message.id, 'Could not resolve to a specific dye.');
        await ctx.message.channel?.sendMessage(msg);
        return;
      }
      await sendDyeInfoResponse(ctx, resolution.dye.dye, locale);
      return;
    }

    case 'multiple': {
      // Show all matches inline (2-4 results)
      for (const resolved of resolution.dyes) {
        if (resolved.dye) {
          await sendDyeInfoResponse(ctx, resolved.dye, locale);
        }
      }
      return;
    }
  }
}

/**
 * Send a dye info response for a single resolved Dye.
 */
async function sendDyeInfoResponse(
  ctx: CommandContext,
  dye: Dye,
  locale: LocaleCode,
): Promise<void> {
  const result = await executeDyeInfo({ dye, locale });

  if (!result.ok) {
    const msg = formatErrorReply(ctx.message.id, result.errorMessage);
    await ctx.message.channel?.sendMessage(msg);
    return;
  }

  // For now, send text-based response (SVG→PNG rendering is a future step)
  const embed = {
    title: result.embed.title,
    description: result.embed.description,
    colour: colorToHex(result.embed.color),
  };

  await ctx.message.channel?.sendMessage({
    embeds: [embed],
    replies: [{ id: ctx.message.id, mention: false }],
    masquerade: {
      name: result.dye.name,
      colour: result.dye.hex,
    },
    interactions: {
      reactions: DYE_INFO_REACTIONS,
      restrict_reactions: true,
    },
  });

  // Track message context for reaction handling
  ctx.messageContextStore.set(ctx.message.id, {
    command: 'dye-info',
    dyeId: result.dye.id,
    dyeHex: result.dye.hex,
    createdAt: Date.now(),
  });
}
