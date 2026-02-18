/**
 * /dye Command Handler (V4 Enhanced)
 *
 * Provides subcommands for searching and exploring FFXIV dyes:
 * - /dye search <query> - Search dyes by name
 * - /dye info <name> - Get detailed information about a specific dye (V4: visual card)
 * - /dye list [category] - List dyes by category
 * - /dye random - Show 5 randomly selected dyes (V4: visual grid)
 *
 * All subcommands exclude Facewear dyes (generic names like "Red", "Blue").
 *
 * V4 Enhancements:
 * - /dye info now generates a visual result card
 * - /dye random now generates a visual infographic grid
 */

import type { Dye } from '@xivdyetools/core';
import { dyeService } from '../../utils/color.js';
import { messageResponse, deferredResponse, errorEmbed, hexToDiscordColor } from '../../utils/response.js';
import { editOriginalResponse } from '../../utils/discord-api.js';
import { getDyeEmoji } from '../../services/emoji.js';
import { createCopyButtons } from '../buttons/index.js';
import { createUserTranslator, createTranslator, type Translator } from '../../services/bot-i18n.js';
import { initializeLocale, getLocalizedDyeName, getLocalizedCategory, type LocaleCode } from '../../services/i18n.js';
import { generateDyeInfoCard } from '../../services/svg/dye-info-card.js';
import { generateRandomDyesGrid, type RandomDyeInfo } from '../../services/svg/random-dyes-grid.js';
import { renderSvgToPng } from '../../services/svg/renderer.js';
import type { Env, DiscordInteraction } from '../../types/env.js';

/**
 * Filters out Facewear dyes from results
 */
function excludeFacewear(dyes: Dye[]): Dye[] {
  return dyes.filter((dye) => dye.category !== 'Facewear');
}

/**
 * Formats a dye for a compact list display (with localized name)
 */
function formatDyeListItem(dye: Dye, locale: LocaleCode): string {
  const emoji = getDyeEmoji(dye.id);
  const emojiPrefix = emoji ? `${emoji} ` : '';
  const localizedName = getLocalizedDyeName(dye.itemID, dye.name, locale);
  return `${emojiPrefix}**${localizedName}** (\`${dye.hex.toUpperCase()}\`)`;
}

/**
 * Handles the /dye command with subcommands
 */
export async function handleDyeCommand(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const userId = interaction.member?.user?.id ?? interaction.user?.id ?? 'unknown';
  const t = await createUserTranslator(env.KV, userId, interaction.locale);
  const locale = t.getLocale();

  // Initialize xivdyetools-core localization for dye names
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
      // V4: Visual card requires deferred response
      return handleInfoSubcommand(interaction, env, ctx, t, locale, subcommand.options);

    case 'list':
      return handleListSubcommand(t, subcommand.options);

    case 'random':
      // V4: Visual grid requires deferred response
      return handleRandomSubcommand(interaction, env, ctx, t, locale, subcommand.options);

    default:
      return messageResponse({
        embeds: [errorEmbed(t.t('common.error'), t.t('errors.unknownSubcommand', { name: subcommand.name }))],
        flags: 64,
      });
  }
}

/**
 * Handles /dye search <query>
 */
function handleSearchSubcommand(
  t: Translator,
  options?: Array<{ name: string; value?: string | number | boolean }>
): Response {
  const queryOption = options?.find((opt) => opt.name === 'query');
  const query = queryOption?.value as string | undefined;

  if (!query) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.missingQuery'))],
      flags: 64,
    });
  }

  // Search for dyes and exclude Facewear
  const allResults = dyeService.searchByName(query);
  const results = excludeFacewear(allResults);

  if (results.length === 0) {
    return messageResponse({
      embeds: [
        {
          title: t.t('dye.search.noResults', { query }),
          description: t.t('dye.search.tryDifferent'),
          color: 0x808080,
        },
      ],
    });
  }

  // Limit to 10 results for display
  const displayResults = results.slice(0, 10);
  const dyeList = displayResults.map((d) => formatDyeListItem(d, t.getLocale())).join('\n');

  const moreText = results.length > 10 ? `\n\n*${t.t('dye.search.moreResults', { count: results.length - 10 })}*` : '';

  // Use singular or plural form
  const foundText = results.length === 1
    ? t.t('dye.search.foundCount', { count: results.length })
    : t.t('dye.search.foundCountPlural', { count: results.length });

  return messageResponse({
    embeds: [
      {
        title: t.t('dye.search.resultsTitle', { query }),
        description: `${foundText}\n\n${dyeList}${moreText}`,
        color: displayResults[0] ? hexToDiscordColor(displayResults[0].hex) : 0x5865f2,
        footer: { text: t.t('dye.search.useInfoHint') },
      },
    ],
  });
}

/**
 * Handles /dye info <name>
 * V4 Enhanced: Generates a visual result card
 */
function handleInfoSubcommand(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext,
  t: Translator,
  locale: LocaleCode,
  options?: Array<{ name: string; value?: string | number | boolean }>
): Response {
  const nameOption = options?.find((opt) => opt.name === 'name');
  const name = nameOption?.value as string | undefined;

  if (!name) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.missingName'))],
      flags: 64,
    });
  }

  // Search for the dye
  const results = dyeService.searchByName(name);
  const dye = results.find((d) => d.name.toLowerCase() === name.toLowerCase()) || results[0];

  if (!dye) {
    return messageResponse({
      embeds: [
        errorEmbed(t.t('common.error'), t.t('errors.dyeNotFound', { name })),
      ],
      flags: 64,
    });
  }

  // Defer response for image generation
  const deferResponse = deferredResponse();

  // Process in background
  ctx.waitUntil(processInfoCard(interaction, env, dye, locale));

  return deferResponse;
}

/**
 * Background processing for dye info visual card
 */
async function processInfoCard(
  interaction: DiscordInteraction,
  env: Env,
  dye: Dye,
  locale: LocaleCode
): Promise<void> {
  const t = createTranslator(locale);

  try {
    // Get localized names
    const localizedName = getLocalizedDyeName(dye.itemID, dye.name, locale);
    const localizedCategory = getLocalizedCategory(dye.category, locale);

    // Generate visual card SVG
    const svg = generateDyeInfoCard({
      dye,
      localizedName,
      localizedCategory,
    });

    // Render to PNG
    const pngBuffer = await renderSvgToPng(svg, { scale: 2 });

    // Get emoji if available
    const emoji = getDyeEmoji(dye.id);
    const emojiPrefix = emoji ? `${emoji} ` : '';

    // Create copy buttons for hex/RGB/HSV
    const rgb = dye.rgb;
    const hsv = dye.hsv;
    const copyButtons = createCopyButtons(
      dye.hex,
      rgb,
      { h: Math.round(hsv.h), s: Math.round(hsv.s), v: Math.round(hsv.v) }
    );

    // Send response with image
    await editOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [
        {
          title: `${emojiPrefix}${localizedName}`,
          description: t.t('dye.info.detailedInfo', { category: localizedCategory }),
          color: hexToDiscordColor(dye.hex),
          image: { url: 'attachment://image.png' },
          footer: { text: t.t('common.footer') },
        },
      ],
      components: [copyButtons],
      file: {
        name: `dye-${dye.name.toLowerCase().replace(/\s+/g, '-')}.png`,
        data: pngBuffer,
        contentType: 'image/png',
      },
    });
  } catch (error) {
    // Fallback to text-based response on error
    const localizedName = getLocalizedDyeName(dye.itemID, dye.name, locale);
    const localizedCategory = getLocalizedCategory(dye.category, locale);

    const emoji = getDyeEmoji(dye.id);
    const emojiPrefix = emoji ? `${emoji} ` : '';
    const rgb = dye.rgb;
    const hsv = dye.hsv;

    const fields = [
      { name: t.t('common.hexColor'), value: `\`${dye.hex.toUpperCase()}\``, inline: true },
      { name: t.t('common.category'), value: localizedCategory, inline: true },
      { name: t.t('common.itemId'), value: `\`${dye.id}\``, inline: true },
      { name: t.t('common.rgb'), value: `\`rgb(${rgb.r}, ${rgb.g}, ${rgb.b})\``, inline: true },
      { name: t.t('common.hsv'), value: `\`${Math.round(hsv.h)}°, ${Math.round(hsv.s)}%, ${Math.round(hsv.v)}%\``, inline: true },
    ];

    const copyButtons = createCopyButtons(
      dye.hex,
      rgb,
      { h: Math.round(hsv.h), s: Math.round(hsv.s), v: Math.round(hsv.v) }
    );

    await editOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [
        {
          title: `${emojiPrefix}${localizedName}`,
          description: t.t('dye.info.detailedInfo', { category: localizedCategory }),
          color: hexToDiscordColor(dye.hex),
          fields,
          footer: { text: t.t('common.footer') },
        },
      ],
      components: [copyButtons],
    });
  }
}

/**
 * Handles /dye list [category]
 */
function handleListSubcommand(
  t: Translator,
  options?: Array<{ name: string; value?: string | number | boolean }>
): Response {
  const categoryOption = options?.find((opt) => opt.name === 'category');
  const category = categoryOption?.value as string | undefined;

  // Get all dyes and exclude Facewear
  const allDyes = excludeFacewear(dyeService.getAllDyes());

  if (category) {
    // Filter by category
    const categoryDyes = allDyes.filter(
      (dye) => dye.category.toLowerCase() === category.toLowerCase()
    );

    if (categoryDyes.length === 0) {
      return messageResponse({
        embeds: [
          errorEmbed(t.t('common.error'), t.t('dye.list.noDyesInCategory', { category })),
        ],
        flags: 64,
      });
    }

    // Format list
    const dyeList = categoryDyes.map((d) => formatDyeListItem(d, t.getLocale())).join('\n');
    const localizedCategoryName = getLocalizedCategory(category, t.getLocale());

    return messageResponse({
      embeds: [
        {
          title: t.t('dye.list.categoryTitle', { category: localizedCategoryName }),
          description: `${t.t('dye.list.dyesInCategory', { count: categoryDyes.length })}\n\n${dyeList}`,
          color: categoryDyes[0] ? hexToDiscordColor(categoryDyes[0].hex) : 0x5865f2,
          footer: { text: t.t('dye.search.useInfoHint') },
        },
      ],
    });
  }

  // No category specified - show category summary
  const categories = new Map<string, number>();
  for (const dye of allDyes) {
    const count = categories.get(dye.category) || 0;
    categories.set(dye.category, count + 1);
  }

  const categoryList = Array.from(categories.entries())
    .map(([cat, count]) => `**${getLocalizedCategory(cat, t.getLocale())}**: ${count} ${t.t('common.dyes')}`)
    .join('\n');

  return messageResponse({
    embeds: [
      {
        title: t.t('dye.list.categoriesTitle'),
        description: `${t.t('dye.list.categorySummary', { total: allDyes.length, count: categories.size })}\n\n${categoryList}`,
        color: 0x5865f2,
        footer: { text: t.t('dye.list.useListHint') },
      },
    ],
  });
}

/**
 * Handles /dye random
 * V4 Enhanced: Generates a visual infographic grid
 */
function handleRandomSubcommand(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext,
  t: Translator,
  locale: LocaleCode,
  options?: Array<{ name: string; value?: string | number | boolean }>
): Response {
  // Check for unique_categories option
  const uniqueCategoriesOption = options?.find((opt) => opt.name === 'unique_categories');
  const uniqueCategories = uniqueCategoriesOption?.value === true;

  // Get all non-Facewear dyes
  const allDyes = excludeFacewear(dyeService.getAllDyes());

  if (allDyes.length === 0) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.noDyesAvailable'))],
      flags: 64,
    });
  }

  let selectedDyes: Dye[];

  if (uniqueCategories) {
    // Group dyes by category, then pick one random dye from each category
    const dyesByCategory = new Map<string, Dye[]>();
    for (const dye of allDyes) {
      const existing = dyesByCategory.get(dye.category) || [];
      existing.push(dye);
      dyesByCategory.set(dye.category, existing);
    }

    // Get all categories and shuffle them
    const categories = Array.from(dyesByCategory.keys());
    shuffleArray(categories);

    // Pick one random dye from each category (up to 5)
    selectedDyes = [];
    for (const category of categories.slice(0, 5)) {
      const categoryDyes = dyesByCategory.get(category)!;
      const randomDye = categoryDyes[Math.floor(Math.random() * categoryDyes.length)];
      selectedDyes.push(randomDye);
    }
  } else {
    // Original behavior: randomly select 5 dyes (or fewer if not enough)
    const count = Math.min(5, allDyes.length);
    selectedDyes = [];
    const usedIndices = new Set<number>();

    while (selectedDyes.length < count) {
      const index = Math.floor(Math.random() * allDyes.length);
      if (!usedIndices.has(index)) {
        usedIndices.add(index);
        selectedDyes.push(allDyes[index]);
      }
    }
  }

  // Defer response for image generation
  const deferResponse = deferredResponse();

  // Process in background
  ctx.waitUntil(processRandomGrid(interaction, env, selectedDyes, uniqueCategories, locale));

  return deferResponse;
}

/**
 * Background processing for random dyes visual grid
 */
async function processRandomGrid(
  interaction: DiscordInteraction,
  env: Env,
  dyes: Dye[],
  uniqueCategories: boolean,
  locale: LocaleCode
): Promise<void> {
  const t = createTranslator(locale);

  try {
    // Build dye info with localized names
    const dyeInfos: RandomDyeInfo[] = dyes.map((dye) => ({
      dye,
      localizedName: getLocalizedDyeName(dye.itemID, dye.name, locale),
      localizedCategory: getLocalizedCategory(dye.category, locale),
    }));

    // Generate visual grid SVG
    const title = uniqueCategories ? t.t('dye.random.titleUnique') : t.t('dye.random.title');
    const svg = generateRandomDyesGrid({
      dyes: dyeInfos,
      title,
      uniqueCategories,
    });

    // Render to PNG
    const pngBuffer = await renderSvgToPng(svg, { scale: 2 });

    // Build text list for embed description (fallback/accessibility)
    const dyeList = dyes
      .map((dye, i) => {
        const emoji = getDyeEmoji(dye.id);
        const emojiPrefix = emoji ? `${emoji} ` : '';
        const localizedName = getLocalizedDyeName(dye.itemID, dye.name, locale);
        return `**${i + 1}.** ${emojiPrefix}${localizedName} (\`${dye.hex.toUpperCase()}\`)`;
      })
      .join('\n');

    // Send response with image
    await editOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [
        {
          title,
          description: dyeList,
          color: hexToDiscordColor(dyes[0].hex),
          image: { url: 'attachment://image.png' },
          footer: { text: `${t.t('dye.search.useInfoHint')} • ${t.t('dye.random.runAgainHint')}` },
        },
      ],
      file: {
        name: 'random-dyes.png',
        data: pngBuffer,
        contentType: 'image/png',
      },
    });
  } catch (error) {
    // Fallback to text-based response on error
    const dyeList = dyes
      .map((dye, i) => {
        const emoji = getDyeEmoji(dye.id);
        const emojiPrefix = emoji ? `${emoji} ` : '';
        const localizedName = getLocalizedDyeName(dye.itemID, dye.name, locale);
        const localizedCategory = getLocalizedCategory(dye.category, locale);
        return `**${i + 1}.** ${emojiPrefix}**${localizedName}** (\`${dye.hex.toUpperCase()}\`) • ${localizedCategory}`;
      })
      .join('\n');

    const title = uniqueCategories ? t.t('dye.random.titleUnique') : t.t('dye.random.title');
    const description = uniqueCategories
      ? `${t.t('dye.random.descriptionUnique', { count: dyes.length })}\n\n${dyeList}`
      : `${t.t('dye.random.description', { count: dyes.length })}\n\n${dyeList}`;

    await editOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [
        {
          title,
          description,
          color: hexToDiscordColor(dyes[0].hex),
          footer: { text: `${t.t('dye.search.useInfoHint')} • ${t.t('dye.random.runAgainHint')}` },
        },
      ],
    });
  }
}

/**
 * Fisher-Yates shuffle algorithm
 * Shuffles array in place
 */
function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}
