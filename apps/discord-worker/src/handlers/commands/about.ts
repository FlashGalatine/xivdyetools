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
import packageJson from '../../../package.json' with { type: 'json' };

// Discord embed color constants
const COLORS = {
  blurple: 0x5865f2,
} as const;

// All available commands organized by category
const COMMAND_CATEGORIES = {
  colorTools: {
    emoji: '🎨',
    commands: [
      { name: '/harmony', descKey: 'about.cmd.harmony' },
      { name: '/match', descKey: 'about.cmd.match' },
      { name: '/match_image', descKey: 'about.cmd.matchImage' },
      { name: '/mixer', descKey: 'about.cmd.mixer' },
    ],
  },
  dyeDatabase: {
    emoji: '📚',
    commands: [
      { name: '/dye search', descKey: 'about.cmd.dyeSearch' },
      { name: '/dye info', descKey: 'about.cmd.dyeInfo' },
      { name: '/dye list', descKey: 'about.cmd.dyeList' },
      { name: '/dye random', descKey: 'about.cmd.dyeRandom' },
    ],
  },
  analysis: {
    emoji: '🔍',
    commands: [
      { name: '/comparison', descKey: 'about.cmd.comparison' },
      { name: '/accessibility', descKey: 'about.cmd.accessibility' },
    ],
  },
  userData: {
    emoji: '💾',
    commands: [
      { name: '/favorites', descKey: 'about.cmd.favorites' },
      { name: '/collection', descKey: 'about.cmd.collection' },
    ],
  },
  community: {
    emoji: '🌐',
    commands: [
      { name: '/preset', descKey: 'about.cmd.preset' },
    ],
  },
  utility: {
    emoji: '⚙️',
    commands: [
      { name: '/language', descKey: 'about.cmd.language' },
      { name: '/manual', descKey: 'about.cmd.manual' },
      { name: '/about', descKey: 'about.cmd.about' },
      { name: '/stats', descKey: 'about.cmd.stats' },
    ],
  },
} as const;

/**
 * Build the command list as a formatted string
 */
function buildCommandList(t: Translator): string {
  const sections: string[] = [];

  for (const [categoryKey, category] of Object.entries(COMMAND_CATEGORIES)) {
    const categoryCommands = category.commands
      .map(cmd => `\`${cmd.name}\` - ${t.t(cmd.descKey)}`)
      .join('\n');
    sections.push(`${category.emoji} **${t.t(`about.categories.${categoryKey}`)}**\n${categoryCommands}`);
  }

  return sections.join('\n\n');
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

/**
 * Get total number of commands
 */
function getTotalCommandCount(): number {
  return Object.values(COMMAND_CATEGORIES).reduce(
    (total, category) => total + category.commands.length,
    0
  );
}
