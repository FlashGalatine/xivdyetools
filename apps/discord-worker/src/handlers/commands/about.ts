/**
 * /about Command Handler
 *
 * The bot's counterpart to the About modal. Carries:
 * - the version, and the dye count the whole product is about
 * - the command roster, built from the registry so it cannot drift
 * - what v5 removed, and where each one went
 * - **the Square Enix attribution** — the one piece of this surface that
 *   does not degrade gracefully by being absent, and the only place in the
 *   bot that can carry it
 */

import type { Env, DiscordInteraction } from '../../types/env.js';
import { dyeDatabase, PRODUCT_LINKS, SOCIAL_LINKS } from '@xivdyetools/core';
import { BRAND_ACCENT } from '../../utils/brand.js';
import { createUserTranslator, Translator } from '../../services/bot-i18n.js';
import { COMMAND_REGISTRY, type CommandCategory } from '../../commands/registry.js';
import packageJson from '../../../package.json' with { type: 'json' };

/**
 * Verbatim in every locale, for the same reason the Spectrum item name is:
 * a trademark notice is a fixed string, and a loose translation of one is
 * worse than the original. Only its field label localises.
 */
const ATTRIBUTION = [
  'FINAL FANTASY is a registered trademark of Square Enix Holdings Co., Ltd.',
  'FINAL FANTASY XIV © SQUARE ENIX CO., LTD.',
  'XIV Dye Tools is an unofficial fan project, not affiliated with or endorsed by Square Enix.',
].join('\n');

/** Proper nouns — the two outside things the product genuinely rests on. */
const BUILT_ON = 'Market prices from Universalis · Paint mixing by spectral.js';

/** `[Label](url)` — the shape a Discord embed field takes. */
const md = ({ label, url }: { label: string; url: string }): string => `[${label}](${url})`;

/**
 * The way in, then the seven places we are. Product links first because a
 * Discord reader has no other route to the app; the socials come from core
 * so this list and the web app's About modal cannot drift apart.
 */
const ELSEWHERE = [PRODUCT_LINKS.webApp, PRODUCT_LINKS.inviteBot, ...SOCIAL_LINKS]
  .map(md)
  .join(' • ');

// 5.0: the roster comes from the command registry — /about can no longer
// drift from what actually registers (about.test.ts asserts parity).
// Per-command descriptions are cut (the confirmed sixth cut); the pill
// index redesign lands with the graphics port.
const CATEGORY_META: Record<CommandCategory, { emoji: string; labelKey: string }> = {
  'color-tools': { emoji: '🎨', labelKey: 'about.categories.colorTools' },
  'dye-database': { emoji: '📚', labelKey: 'about.categories.dyeDatabase' },
  analysis: { emoji: '🔍', labelKey: 'about.categories.analysis' },
  community: { emoji: '🌐', labelKey: 'about.categories.community' },
  utility: { emoji: '⚙️', labelKey: 'about.categories.utility' },
};

const CATEGORY_ORDER: CommandCategory[] = [
  'color-tools',
  'dye-database',
  'analysis',
  'community',
  'utility',
];

/** Commands deleted in v5 — carried in the Removed-in-v5 field for one release. */
const REMOVED_IN_V5 = ['/match', '/match_image', '/favorites', '/collection', '/language'];

/**
 * Build the command list from the registry, grouped by category.
 */
function buildCommandList(t: Translator): string {
  const sections: string[] = [];
  for (const category of CATEGORY_ORDER) {
    const commands = COMMAND_REGISTRY.filter((c) => c.category === category);
    if (commands.length === 0) continue;
    const meta = CATEGORY_META[category];
    const names = commands.map((c) => `\`/${c.name}\``).join(' · ');
    sections.push(`${meta.emoji} **${t.t(meta.labelKey)}**\n${names}`);
  }
  return sections.join('\n\n');
}

function getTotalCommandCount(): number {
  return COMMAND_REGISTRY.length;
}

/**
 * Handles the /about command
 */
export async function handleAboutCommand(
  interaction: DiscordInteraction,
  env: Env,
  _ctx: ExecutionContext
): Promise<Response> {
  const userId = interaction.member?.user?.id ?? interaction.user?.id ?? 'unknown';
  const t = await createUserTranslator(env.KV, userId, interaction.locale);

  // Get version from package.json (bundled at build time)
  const version = packageJson.version || '2.0.0';

  const commandList = buildCommandList(t);

  return Response.json({
    type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
    data: {
      embeds: [
        {
          title: `${t.t('about.title')} v${version}`,
          description: [
            t.t('about.description'),
            '',
            `**${t.t('about.commands')}** (${t.t('about.totalCount', { count: getTotalCommandCount() })})`,
          ].join('\n'),
          color: BRAND_ACCENT,
          fields: [
            { name: t.t('about.version'), value: `\`${version}\``, inline: true },
            { name: t.t('about.dyes'), value: `\`${dyeDatabase.length}\``, inline: true },
            {
              name: '\u200B', // Zero-width space for spacing
              value: commandList,
              inline: false,
            },
            {
              name: `🗑️ ${t.t('about.removedTitle')}`,
              value: `${REMOVED_IN_V5.map((c) => `\`${c}\``).join(' · ')} — ${t.t('about.removedBody')}`,
              inline: false,
            },
            {
              name: `🔗 ${t.t('about.links')}`,
              value: ELSEWHERE,
              inline: false,
            },
            {
              name: t.t('about.builtOn'),
              value: BUILT_ON,
              inline: false,
            },
            // Last, and never conditional — this is the one piece of this
            // surface that does not degrade gracefully by being absent.
            {
              name: `⚖️ ${t.t('about.attribution')}`,
              value: ATTRIBUTION,
              inline: false,
            },
          ],
          footer: {
            text: `${t.t('about.poweredBy')} • v${version}`,
          },
          timestamp: new Date().toISOString(),
        },
      ],
    },
  });
}

