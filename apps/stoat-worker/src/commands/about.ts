/**
 * About command — bot info and quick start guide.
 * `!xd about` → shows bot info and getting started
 *
 * BUG-070: the card used to advertise `!xd random` (not routed -- it answered
 * `Unknown command "dye.random"`), a ❓-reaction help (no reaction listener
 * exists) and six feature bullets this bot does not implement. It now names
 * only commands `COMMAND_ROUTES` serves; `about.test.ts` fails if it drifts.
 */

import type { CommandContext } from '../router.js';

export async function handleAboutCommand(ctx: CommandContext): Promise<void> {
  await ctx.message.channel?.sendMessage({
    embeds: [
      {
        title: '🎨 XIV Dye Tools — Stoat Edition',
        description:
          'An FFXIV dye lookup bot for Revolt.\n\n' +
          '**What it does**\n' +
          '• Look up any dye by name, ItemID, or hex code (HEX, RGB, HSV, LAB)\n\n' +
          '**Quick Start**\n' +
          '`!xd info Pure White`  ← Try this first!\n' +
          '`!xd help`  ← Full command list\n\n' +
          'More tools (harmony, mixer, match, and others) live in the Discord bot and the web app.\n\n' +
          '[Web App](https://xivdyetools.app) • [Docs](https://developers.xivdyetools.app)',
        colour: '#5865F2',
      },
    ],
    replies: [{ id: ctx.message.id, mention: false }],
  });
}
