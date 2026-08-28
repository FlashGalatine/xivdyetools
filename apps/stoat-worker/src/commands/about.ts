/**
 * About command — bot info and quick start guide.
 * `!xd about` → shows bot info, features, and getting started
 */

import type { CommandContext } from '../router.js';

export async function handleAboutCommand(ctx: CommandContext): Promise<void> {
  await ctx.message.channel?.sendMessage({
    embeds: [
      {
        title: '🎨 XIV Dye Tools — Stoat Edition',
        description:
          'An FFXIV dye matching and color analysis bot.\n\n' +
          '**Features**\n' +
          '• Color matching & extraction\n' +
          '• Dye blending (6 algorithms)\n' +
          '• Color harmony generation\n' +
          '• Accessibility analysis\n' +
          '• 6-language support\n\n' +
          '**Quick Start**\n' +
          '`!xd info Pure White`  ← Try this first!\n' +
          '`!xd random`  ← Discover new dyes\n' +
          '`!xd help`  ← Full command list\n\n' +
          'React with ❓ on any bot message for help with that command.\n\n' +
          '[Web App](https://xivdyetools.app) • [Docs](https://developers.xivdyetools.app)',
        colour: '#5865F2',
      },
    ],
    replies: [{ id: ctx.message.id, mention: false }],
  });
}
