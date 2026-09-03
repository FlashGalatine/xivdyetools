/**
 * Help command — sends a command reference via reply.
 * `!xd help` → brief command overview
 * `!xd help <command>` → detailed help for a specific command
 */

import type { CommandContext } from '../router.js';

/**
 * BUG-103: this overview advertised THIRTEEN commands while `COMMAND_ROUTES`
 * has four (`ping`, `help`, `about`, `dye.info`). `!xd random` was listed here
 * as though it worked and answered `Unknown command "dye.random"` -- the help
 * was documenting an intended bot rather than this one. It now lists what the
 * router actually dispatches, and `help.test.ts` fails if the two drift apart
 * again.
 */
const HELP_OVERVIEW = `**XIV Dye Tools — Command Reference**

**Dye Lookup**
  \`!xd info <dye>\`              Look up a dye's color values

**Utility**
  \`!xd ping\`                    Check bot connectivity and latency
  \`!xd about\`                   Bot information and quick start
  \`!xd help [command]\`          This message, or detail for one command

Tip: Use \`!xd\` as a shortcut for \`!xivdye\`.
     Dye names, ItemIDs (e.g., 5729), and localized names are all accepted.

More commands (harmony, gradient, mixer, comparison, match, extract, a11y,
search, list, random, prefs) exist in the Discord bot; this Revolt bot does not
serve them yet.`;

/**
 * Every topic `!xd help <topic>` answers. Each one MUST resolve to a route in
 * the router -- `help.test.ts` asserts exactly that, which is the gate BUG-103
 * did not have.
 */
export const HELP_TOPICS = ['info', 'ping', 'help', 'about'] as const;

const COMMAND_HELP: Record<string, string> = {
  info: `**!xd info <dye>**
Look up a dye's color values (HEX, RGB, HSV, LAB).
Accepts dye names, ItemIDs, or localized names.

Examples:
  \`!xd info Snow White\`
  \`!xd info 5729\`
  \`!xd info スノウホワイト\``,

  ping: `**!xd ping**
Check bot connectivity and response latency.`,

  help: `**!xd help [command]**
Show this help message, or detailed help for a specific command.`,

  about: `**!xd about**
Show bot information and quick start guide.`,
};

export async function handleHelpCommand(ctx: CommandContext): Promise<void> {
  const topic = ctx.parsed.rawArgs[0]?.toLowerCase();

  // Own-property check: `constructor` / `__proto__` are not topics
  // (FINDING-027, 2026-08-21 security audit).
  if (topic && Object.hasOwn(COMMAND_HELP, topic)) {
    await ctx.message.channel?.sendMessage({
      content: COMMAND_HELP[topic],
      replies: [{ id: ctx.message.id, mention: false }],
    });
    return;
  }

  await ctx.message.channel?.sendMessage({
    content: HELP_OVERVIEW,
    replies: [{ id: ctx.message.id, mention: false }],
  });
}
