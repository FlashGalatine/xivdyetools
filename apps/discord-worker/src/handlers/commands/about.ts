/**
 * /about Command Handler
 *
 * Displays bot information including:
 * - Dynamic version from package.json
 * - Full list of available commands
 * - Links to resources
 */

import type { Env, DiscordInteraction } from '../../types/env.js';
import { createUserTranslator, Translator } from '../../services/bot-i18n.js';
import { COMMAND_REGISTRY, type CommandCategory } from '../../commands/registry.js';
import packageJson from '../../../package.json' with { type: 'json' };

// Discord embed color constants
const COLORS = {
  blurple: 0x5865f2,
} as const;

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
          color: COLORS.blurple,
          fields: [
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
              value: [
                '[Web App](https://xivdyetools.app/)',
                '[GitHub](https://github.com/FlashGalatine/xivdyetools-discord-worker)',
                '[Invite Bot](https://discord.com/oauth2/authorize?client_id=1447108133020369048)',
                '[Patreon](https://www.patreon.com/ProjectGalatine)',
              ].join(' • '),
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

