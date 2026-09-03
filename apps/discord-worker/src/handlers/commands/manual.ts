/**
 * /manual Command Handler
 *
 * Displays comprehensive help documentation for all bot commands.
 * Organizes commands into logical categories with descriptions.
 * Supports optional topic parameter for specific help (e.g., match_image).
 * Sends as ephemeral message (only visible to the user).
 */

import type { Env, DiscordInteraction } from '../../types/env.js';
import {
  getLearnLink,
  getLodestoneLink,
  MANUAL_TOPICS,
  type LearnLink,
  type LodestoneRegion,
  type ManualTopicId,
} from '@xivdyetools/core';
import { createUserTranslatorWithPrefs, type Translator } from '../../services/bot-i18n.js';
import type { LocaleCode } from '../../services/i18n.js';
import { getCachedWorlds, getCachedDataCenters } from '../../services/budget/index.js';
import { BRAND_ACCENT } from '../../utils/brand.js';

// /manual used to spend five decorative colours across five embeds — one
// per section, signalling nothing, in a product where green already means
// two contradictory things. One accent, and colour reserved for state.

/**
 * Build embeds for the match_image help topic
 */
function buildMatchImageHelpEmbeds(t: Translator): object[] {
  return [
    // Main help embed
    {
      title: `🎨 ${t.t('matchImageHelp.title')}`,
      description: t.t('matchImageHelp.description'),
      color: BRAND_ACCENT,
      fields: [
        {
          name: `🔍 ${t.t('matchImageHelp.howItWorks')}`,
          value: t.t('matchImageHelp.howItWorksContent'),
          inline: false,
        },
        {
          name: `✅ ${t.t('matchImageHelp.tipsForBestResults')}`,
          value: t.t('matchImageHelp.tipsContent'),
          inline: false,
        },
        {
          name: `❌ ${t.t('matchImageHelp.commonIssues')}`,
          value: t.t('matchImageHelp.commonIssuesContent'),
          inline: false,
        },
        {
          name: `💡 ${t.t('matchImageHelp.proTips')}`,
          value: t.t('matchImageHelp.proTipsContent'),
          inline: false,
        },
      ],
      footer: {
        text: t.t('matchImageHelp.footer'),
      },
    },
    // Examples embed
    {
      title: `📸 ${t.t('matchImageHelp.exampleUseCases')}`,
      color: BRAND_ACCENT,
      fields: [
        {
          name: `✨ ${t.t('matchImageHelp.goodExamples')}`,
          value: t.t('matchImageHelp.goodExamplesContent'),
          inline: true,
        },
        {
          name: `⚠️ ${t.t('matchImageHelp.poorExamples')}`,
          value: t.t('matchImageHelp.poorExamplesContent'),
          inline: true,
        },
        {
          name: `🎯 ${t.t('matchImageHelp.whenToUse')}`,
          value: t.t('matchImageHelp.whenToUseContent'),
          inline: false,
        },
      ],
    },
    // Technical details embed
    {
      title: `⚙️ ${t.t('matchImageHelp.technicalDetails')}`,
      color: BRAND_ACCENT,
      fields: [
        {
          name: t.t('matchImageHelp.supportedFormats'),
          value: t.t('matchImageHelp.supportedFormatsContent'),
          inline: true,
        },
        {
          name: t.t('matchImageHelp.fileLimits'),
          value: t.t('matchImageHelp.fileLimitsContent'),
          inline: true,
        },
        {
          name: t.t('matchImageHelp.matchQualityRatings'),
          value: t.t('matchImageHelp.matchQualityRatingsContent'),
          inline: false,
        },
      ],
      footer: {
        text: t.t('matchImageHelp.poweredBy'),
      },
    },
  ];
}

/**
 * Build embeds using translated strings
 */
function buildEmbeds(t: Translator): object[] {
  return [
    // Overview
    {
      title: `📖 ${t.t('manual.title')}`,
      description: [
        t.t('manual.welcome'),
        '',
        t.t('manual.commandsIntro'),
        t.t('manual.autocompleteNote'),
      ].join('\n'),
      color: BRAND_ACCENT,
    },

    // Color Matching Tools
    {
      title: `🎨 ${t.t('manual.colorMatching')}`,
      color: BRAND_ACCENT,
      fields: [
        {
          name: t.t('manual.extractor.name'),
          value: t.t('manual.extractor.description'),
          inline: false,
        },
        {
          name: t.t('manual.harmony.name'),
          value: t.t('manual.harmony.description'),
          inline: false,
        },
        {
          name: t.t('manual.mixer.name'),
          value: t.t('manual.mixer.description'),
          inline: false,
        },
        {
          name: t.t('manual.gradient.name'),
          value: t.t('manual.gradient.description'),
          inline: false,
        },
        {
          name: t.t('manual.swatch.name'),
          value: t.t('manual.swatch.description'),
          inline: false,
        },
      ],
    },

    // Dye Information
    {
      title: `🧪 ${t.t('manual.dyeInformation')}`,
      color: BRAND_ACCENT,
      fields: [
        {
          name: t.t('manual.dyeSearch.name'),
          value: t.t('manual.dyeSearch.description'),
          inline: false,
        },
        {
          name: t.t('manual.dyeInfo.name'),
          value: t.t('manual.dyeInfo.description'),
          inline: false,
        },
        {
          name: t.t('manual.dyeList.name'),
          value: t.t('manual.dyeList.description'),
          inline: false,
        },
        {
          name: t.t('manual.dyeRandom.name'),
          value: t.t('manual.dyeRandom.description'),
          inline: false,
        },
      ],
    },

    // Bot Information
    {
      title: `ℹ️ ${t.t('manual.botInformation')}`,
      color: BRAND_ACCENT,
      fields: [
        {
          name: t.t('manual.preferences.name'),
          value: t.t('manual.preferences.description'),
          inline: false,
        },
        {
          name: t.t('manual.about.name'),
          value: t.t('manual.about.description'),
          inline: true,
        },
        {
          name: t.t('manual.manualCmd.name'),
          value: t.t('manual.manualCmd.description'),
          inline: true,
        },
      ],
    },

    // Tips & Resources
    {
      title: `💡 ${t.t('manual.tipsResources')}`,
      color: BRAND_ACCENT,
      description: [
        t.t('manual.tips.autocomplete'),
        '',
        t.t('manual.tips.hexColors'),
        '',
        t.t('manual.tips.dyeNames'),
        '',
        t.t('manual.tips.facewearExcluded'),
        '',
        t.t('manual.tips.links'),
        '• [Web App](https://xivdyetools.app/)',
        '• [Support Server](https://discord.gg/5VUSKTZCe5)',
        '• [Patreon](https://patreon.com/ProjectGalatine)',
      ].join('\n'),
    },
  ];
}

// ============================================================================
// 5.0 topic roster (core's MANUAL_TOPICS is the roster of record)
// ============================================================================

/** Topic id → manual5.topics.* locale key (identifiers never localise). */
const TOPIC_KEYS: Partial<Record<ManualTopicId, string>> = {
  color_vision: 'colorVision',
  contrast: 'contrast',
  matching_methods: 'matchingMethods',
  spectrum_prices: 'spectrumPrices',
  character_file: 'characterFile',
};

/**
 * Spectrum & Prices links the Lodestone **by game region, not locale** —
 * resolved from the user's stored world via Universalis. Any failure (no
 * world, proxy absent, unknown world) degrades to the absent-link state.
 */
async function resolveLodestoneRegion(env: Env, world: string | undefined): Promise<LearnLink | null> {
  if (!world) return null;
  try {
    // BUG-034: this called the UNCACHED `fetchWorlds`/`fetchDataCenters`, two
    // service-binding round trips with a 10-second timeout each and no retry,
    // on a path that answers with `{type: 4}` — so Discord's 3-second ack was
    // the whole budget and a slow proxy produced "The application did not
    // respond". The 1-hour module caches already existed and every other
    // caller used them; they were simply private. World lists change when SE
    // adds a server, so a cache miss here is close to a once-per-isolate cost.
    const [worlds, dcs] = await Promise.all([getCachedWorlds(env), getCachedDataCenters(env)]);
    const target = world.toLowerCase();
    const worldEntry = worlds.find((w) => w.name.toLowerCase() === target);
    // The stored value may be a datacenter name rather than a world
    const dc = worldEntry
      ? dcs.find((d) => d.worlds.includes(worldEntry.id))
      : dcs.find((d) => d.name.toLowerCase() === target);
    if (!dc) return null;
    const region = dc.region.toLowerCase();
    const mapped: LodestoneRegion = region.includes('japan')
      ? 'jp'
      : region.includes('europe')
        ? 'eu'
        : 'na';
    return getLodestoneLink(mapped);
  } catch {
    return null;
  }
}

/**
 * A 5.0 topic embed: emoji + localized name, the localized body, and the
 * learn-more line. A missing URL degrades to NO link, never the English one;
 * the embed prints authority + host, never the path.
 */
function buildTopicEmbed(
  t: Translator,
  topicId: ManualTopicId,
  link: LearnLink | null
): object {
  const meta = MANUAL_TOPICS.find((m) => m.id === topicId);
  const key = TOPIC_KEYS[topicId];
  const description: string[] = [t.t(`manual5.topics.${key}.body`)];
  if (link) {
    description.push('');
    description.push(
      t.t('manual5.learnLead', { link: `[${link.authority}](${link.url}) · ${link.host}` })
    );
  }
  return {
    title: `${meta?.emoji ?? ''} ${t.t(`manual5.topics.${key}.name`)}`.trim(),
    description: description.join('\n'),
    color: BRAND_ACCENT,
  };
}

/**
 * Handles the /manual command
 */
export async function handleManualCommand(
  interaction: DiscordInteraction,
  env: Env,
  _ctx: ExecutionContext
): Promise<Response> {
  const userId = interaction.member?.user?.id ?? interaction.user?.id ?? 'unknown';

  // One KV read yields both translator and prefs (world for the 🪙 topic)
  const { t, prefs } = await createUserTranslatorWithPrefs(env.KV, userId, interaction.locale);
  const locale: LocaleCode = t.getLocale();

  // Check for topic option
  const options = interaction.data?.options || [];
  const topicOption = options.find((opt) => opt.name === 'topic');
  const topic = topicOption?.value as string | undefined;

  // Build localized embeds based on topic
  let embeds;
  if (topic === 'match_image') {
    embeds = buildMatchImageHelpEmbeds(t);
  } else if (topic && topic in TOPIC_KEYS) {
    const topicId = topic as ManualTopicId;
    const link =
      topicId === 'spectrum_prices'
        ? await resolveLodestoneRegion(env, prefs.world)
        : getLearnLink(topicId, locale);
    embeds = [buildTopicEmbed(t, topicId, link)];
  } else {
    embeds = buildEmbeds(t);
  }

  return Response.json({
    type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
    data: {
      embeds,
      flags: 64, // Ephemeral - only visible to user
    },
  });
}
