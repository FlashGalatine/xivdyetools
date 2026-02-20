/**
 * /dye Command Handler (V4 Enhanced)
 *
 * Provides subcommands for searching and exploring FFXIV dyes:
 * - /dye search <query> - Search dyes by name
 * - /dye info <name> - Get detailed information about a specific dye (V4: visual card)
 * - /dye list [category] - List dyes by category
 * - /dye random - Show 5 randomly selected dyes (V4: visual grid)
 *
 * search and list are direct adapters (no business logic delegation needed).
 * info and random delegate to executeDyeInfo() and executeRandom().
 */

import type { Dye } from '@xivdyetools/core';
import { dyeService } from '../../utils/color.js';
import { messageResponse, deferredResponse, errorEmbed, hexToDiscordColor } from '../../utils/response.js';
import { editOriginalResponse } from '../../utils/discord-api.js';
import { getDyeEmoji } from '../../services/emoji.js';
import { createCopyButtons } from '../buttons/index.js';
import { createUserTranslator, createTranslator, type Translator } from '../../services/bot-i18n.js';
import { initializeLocale, getLocalizedDyeName, getLocalizedCategory, type LocaleCode } from '../../services/i18n.js';
import { renderSvgToPng } from '../../services/svg/renderer.js';
import { executeDyeInfo, executeRandom } from '@xivdyetools/bot-logic';
import type { Env, DiscordInteraction } from '../../types/env.js';

// ============================================================================
// Entry Point
// ============================================================================

export async function handleDyeCommand(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const userId = interaction.member?.user?.id ?? interaction.user?.id ?? 'unknown';
  const t = await createUserTranslator(env.KV, userId, interaction.locale);
  const locale = t.getLocale();
  await initializeLocale(locale);

  const options = interaction.data?.options || [];
  const subcommand = options[0];

  if (!subcommand) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.missingSubcommand'))],
      flags: 64,
    });
  }

  switch (subcommand.name) {
    case 'search':
      return handleSearchSubcommand(t, subcommand.options);
    case 'info':
      return handleInfoSubcommand(interaction, env, ctx, t, locale, subcommand.options);
    case 'list':
      return handleListSubcommand(t, subcommand.options);
    case 'random':
      return handleRandomSubcommand(interaction, env, ctx, t, locale, subcommand.options);
    default:
      return messageResponse({
        embeds: [errorEmbed(t.t('common.error'), t.t('errors.unknownSubcommand', { name: subcommand.name }))],
        flags: 64,
      });
  }
}

// ============================================================================
// Search Subcommand (unchanged — no SVG, no execute function needed)
// ============================================================================

function handleSearchSubcommand(
  t: Translator,
  options?: Array<{ name: string; value?: string | number | boolean }>
): Response {
  const query = options?.find((opt) => opt.name === 'query')?.value as string | undefined;
  if (!query) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.missingQuery'))],
      flags: 64,
    });
  }

  const results = dyeService.searchByName(query).filter((d) => d.category !== 'Facewear');

  if (results.length === 0) {
    return messageResponse({
      embeds: [{
        title: t.t('dye.search.noResults', { query }),
        description: t.t('dye.search.tryDifferent'),
        color: 0x808080,
      }],
    });
  }

  const displayResults = results.slice(0, 10);
  const dyeList = displayResults.map((d) => formatDyeListItem(d, t.getLocale())).join('\n');
  const moreText = results.length > 10 ? `\n\n*${t.t('dye.search.moreResults', { count: results.length - 10 })}*` : '';
  const foundText = results.length === 1
    ? t.t('dye.search.foundCount', { count: results.length })
    : t.t('dye.search.foundCountPlural', { count: results.length });

  return messageResponse({
    embeds: [{
      title: t.t('dye.search.resultsTitle', { query }),
      description: `${foundText}\n\n${dyeList}${moreText}`,
      color: displayResults[0] ? hexToDiscordColor(displayResults[0].hex) : 0x5865f2,
      footer: { text: t.t('dye.search.useInfoHint') },
    }],
  });
}

// ============================================================================
// Info Subcommand — delegates to executeDyeInfo
// ============================================================================

function handleInfoSubcommand(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext,
  t: Translator,
  locale: LocaleCode,
  options?: Array<{ name: string; value?: string | number | boolean }>
): Response {
  const name = options?.find((opt) => opt.name === 'name')?.value as string | undefined;
  if (!name) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.missingName'))],
      flags: 64,
    });
  }

  const results = dyeService.searchByName(name);
  const dye = results.find((d) => d.name.toLowerCase() === name.toLowerCase()) || results[0];

  if (!dye) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.dyeNotFound', { name }))],
      flags: 64,
    });
  }

  const deferResponse = deferredResponse();
  ctx.waitUntil(processInfoCard(interaction, env, dye, locale));
  return deferResponse;
}

async function processInfoCard(
  interaction: DiscordInteraction,
  env: Env,
  dye: Dye,
  locale: LocaleCode
): Promise<void> {
  const t = createTranslator(locale);
  const result = await executeDyeInfo({ dye, locale });

  if (!result.ok) {
    // Fallback to text-based response on error
    await sendDyeInfoFallback(interaction, env, dye, locale, t);
    return;
  }

  try {
    const pngBuffer = await renderSvgToPng(result.svgString, { scale: 2 });
    const emoji = getDyeEmoji(dye.id);
    const emojiPrefix = emoji ? `${emoji} ` : '';

    const rgb = dye.rgb;
    const hsv = dye.hsv;
    const copyButtons = createCopyButtons(dye.hex, rgb, {
      h: Math.round(hsv.h), s: Math.round(hsv.s), v: Math.round(hsv.v),
    });

    await editOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [{
        title: `${emojiPrefix}${result.localizedName}`,
        description: result.embed.description,
        color: result.embed.color,
        image: { url: 'attachment://image.png' },
        footer: { text: result.embed.footer ?? t.t('common.footer') },
      }],
      components: [copyButtons],
      file: {
        name: `dye-${dye.name.toLowerCase().replace(/\s+/g, '-')}.png`,
        data: pngBuffer,
        contentType: 'image/png',
      },
    });
  } catch {
    await sendDyeInfoFallback(interaction, env, dye, locale, t);
  }
}

async function sendDyeInfoFallback(
  interaction: DiscordInteraction,
  env: Env,
  dye: Dye,
  locale: LocaleCode,
  t: Translator
): Promise<void> {
  const localizedName = getLocalizedDyeName(dye.itemID, dye.name, locale);
  const localizedCategory = getLocalizedCategory(dye.category, locale);
  const emoji = getDyeEmoji(dye.id);
  const emojiPrefix = emoji ? `${emoji} ` : '';
  const rgb = dye.rgb;
  const hsv = dye.hsv;

  const copyButtons = createCopyButtons(dye.hex, rgb, {
    h: Math.round(hsv.h), s: Math.round(hsv.s), v: Math.round(hsv.v),
  });

  await editOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
    embeds: [{
      title: `${emojiPrefix}${localizedName}`,
      description: t.t('dye.info.detailedInfo', { category: localizedCategory }),
      color: hexToDiscordColor(dye.hex),
      fields: [
        { name: t.t('common.hexColor'), value: `\`${dye.hex.toUpperCase()}\``, inline: true },
        { name: t.t('common.category'), value: localizedCategory, inline: true },
        { name: t.t('common.itemId'), value: `\`${dye.id}\``, inline: true },
        { name: t.t('common.rgb'), value: `\`rgb(${rgb.r}, ${rgb.g}, ${rgb.b})\``, inline: true },
        { name: t.t('common.hsv'), value: `\`${Math.round(hsv.h)}°, ${Math.round(hsv.s)}%, ${Math.round(hsv.v)}%\``, inline: true },
      ],
      footer: { text: t.t('common.footer') },
    }],
    components: [copyButtons],
  });
}

// ============================================================================
// List Subcommand (unchanged — no SVG, no execute function needed)
// ============================================================================

function handleListSubcommand(
  t: Translator,
  options?: Array<{ name: string; value?: string | number | boolean }>
): Response {
  const category = options?.find((opt) => opt.name === 'category')?.value as string | undefined;
  const allDyes = dyeService.getAllDyes().filter((d) => d.category !== 'Facewear');

  if (category) {
    const categoryDyes = allDyes.filter((d) => d.category.toLowerCase() === category.toLowerCase());
    if (categoryDyes.length === 0) {
      return messageResponse({
        embeds: [errorEmbed(t.t('common.error'), t.t('dye.list.noDyesInCategory', { category }))],
        flags: 64,
      });
    }
    const dyeList = categoryDyes.map((d) => formatDyeListItem(d, t.getLocale())).join('\n');
    const localizedCategoryName = getLocalizedCategory(category, t.getLocale());
    return messageResponse({
      embeds: [{
        title: t.t('dye.list.categoryTitle', { category: localizedCategoryName }),
        description: `${t.t('dye.list.dyesInCategory', { count: categoryDyes.length })}\n\n${dyeList}`,
        color: categoryDyes[0] ? hexToDiscordColor(categoryDyes[0].hex) : 0x5865f2,
        footer: { text: t.t('dye.search.useInfoHint') },
      }],
    });
  }

  const categories = new Map<string, number>();
  for (const dye of allDyes) {
    categories.set(dye.category, (categories.get(dye.category) || 0) + 1);
  }
  const categoryList = Array.from(categories.entries())
    .map(([cat, count]) => `**${getLocalizedCategory(cat, t.getLocale())}**: ${count} ${t.t('common.dyes')}`)
    .join('\n');

  return messageResponse({
    embeds: [{
      title: t.t('dye.list.categoriesTitle'),
      description: `${t.t('dye.list.categorySummary', { total: allDyes.length, count: categories.size })}\n\n${categoryList}`,
      color: 0x5865f2,
      footer: { text: t.t('dye.list.useListHint') },
    }],
  });
}

// ============================================================================
// Random Subcommand — delegates to executeRandom
// ============================================================================

function handleRandomSubcommand(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext,
  t: Translator,
  locale: LocaleCode,
  options?: Array<{ name: string; value?: string | number | boolean }>
): Response {
  const uniqueCategories = options?.find((opt) => opt.name === 'unique_categories')?.value === true;
  const deferResponse = deferredResponse();
  ctx.waitUntil(processRandomGrid(interaction, env, uniqueCategories, locale));
  return deferResponse;
}

async function processRandomGrid(
  interaction: DiscordInteraction,
  env: Env,
  uniqueCategories: boolean,
  locale: LocaleCode
): Promise<void> {
  const t = createTranslator(locale);
  const result = await executeRandom({ locale, count: 5, uniqueCategories });

  if (!result.ok) {
    if (result.error === 'NO_DYES') {
      await editOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
        embeds: [errorEmbed(t.t('common.error'), t.t('errors.noDyesAvailable'))],
      });
    } else {
      await sendRandomFallback(interaction, env, t, locale);
    }
    return;
  }

  try {
    const pngBuffer = await renderSvgToPng(result.svgString, { scale: 2 });

    // Build description with Discord emojis
    const dyeList = result.dyes
      .map((dye, i) => {
        const emoji = getDyeEmoji(dye.id);
        const emojiPrefix = emoji ? `${emoji} ` : '';
        const localizedName = getLocalizedDyeName(dye.itemID, dye.name, locale);
        return `**${i + 1}.** ${emojiPrefix}${localizedName} (\`${dye.hex.toUpperCase()}\`)`;
      })
      .join('\n');

    await editOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [{
        title: result.title,
        description: dyeList,
        color: hexToDiscordColor(result.dyes[0].hex),
        image: { url: 'attachment://image.png' },
        footer: { text: `${t.t('dye.search.useInfoHint')} • ${t.t('dye.random.runAgainHint')}` },
      }],
      file: { name: 'random-dyes.png', data: pngBuffer, contentType: 'image/png' },
    });
  } catch {
    await sendRandomFallback(interaction, env, t, locale);
  }
}

async function sendRandomFallback(
  interaction: DiscordInteraction,
  env: Env,
  t: Translator,
  locale: LocaleCode
): Promise<void> {
  // Re-run a text-only random selection on fallback
  const result = await executeRandom({ locale, count: 5 });
  if (!result.ok) {
    await editOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.generationFailed'))],
    });
    return;
  }

  const dyeList = result.dyes
    .map((dye, i) => {
      const emoji = getDyeEmoji(dye.id);
      const emojiPrefix = emoji ? `${emoji} ` : '';
      const localizedName = getLocalizedDyeName(dye.itemID, dye.name, locale);
      const localizedCategory = getLocalizedCategory(dye.category, locale);
      return `**${i + 1}.** ${emojiPrefix}**${localizedName}** (\`${dye.hex.toUpperCase()}\`) • ${localizedCategory}`;
    })
    .join('\n');

  await editOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
    embeds: [{
      title: result.title,
      description: `${t.t('dye.random.description', { count: result.dyes.length })}\n\n${dyeList}`,
      color: hexToDiscordColor(result.dyes[0].hex),
      footer: { text: `${t.t('dye.search.useInfoHint')} • ${t.t('dye.random.runAgainHint')}` },
    }],
  });
}

// ============================================================================
// Shared helpers
// ============================================================================

function formatDyeListItem(dye: Dye, locale: LocaleCode): string {
  const emoji = getDyeEmoji(dye.id);
  const emojiPrefix = emoji ? `${emoji} ` : '';
  const localizedName = getLocalizedDyeName(dye.itemID, dye.name, locale);
  return `${emojiPrefix}**${localizedName}** (\`${dye.hex.toUpperCase()}\`)`;
}
