/**
 * Help command — sends a command reference via reply.
 * `!xd help` → brief command overview
 * `!xd help <command>` → detailed help for a specific command
 */

import type { CommandContext } from '../router.js';

const HELP_OVERVIEW = `**XIV Dye Tools — Command Reference**

**Dye Lookup**
  \`!xd info <dye>\`              Look up a dye's color values
  \`!xd search <query>\`          Search dyes by name
  \`!xd list [category]\`         List dyes in a category
  \`!xd random\`                  Show 5 random dyes

**Color Tools**
  \`!xivdye harmony <dye> [type]\`              Color harmonies
  \`!xivdye gradient <dye> > <dye> [steps]\`    Color gradients
  \`!xivdye mixer <dye> > <dye> [mode]\`        Blend two dyes
  \`!xivdye comparison <dye> > <dye> [> ...]\`  Compare dyes side-by-side
  \`!xivdye match <color>\`                     Find closest dye to a color
  \`!xivdye extract\`                           Extract colors from an image

**Accessibility**
  \`!xivdye a11y <dye> [dye2..4]\`             Colorblind simulation / contrast

**Settings**
  \`!xivdye prefs\`                             Show your preferences
  \`!xivdye prefs set <key> <value>\`           Update a preference

Tip: Use \`!xd\` as a shortcut for \`!xivdye\`.
     Dye names, ItemIDs (e.g., 5729), and localized names are all accepted.
     Use \`>\` to separate multiple dyes: \`!xivdye gradient Pure White > Jet Black\``;

const COMMAND_HELP: Record<string, string> = {
  info: `**!xd info <dye>**
Look up a dye's color values (HEX, RGB, HSV, LAB).
Accepts dye names, ItemIDs, or localized names.

Examples:
  \`!xd info Snow White\`
  \`!xd info 5729\`
  \`!xd info スノウホワイト\``,

  harmony: `**!xivdye harmony <dye> [type] [color_space]**
Generate a color harmony wheel.

Types: triadic, complementary, analogous, split-complementary, tetradic, square, monochromatic

Examples:
  \`!xd harmony Pure White\`
  \`!xd harmony Pure White complementary\`
  \`!xd harmony Pure White triadic oklch\``,

  match: `**!xivdye match <color>**
Find the closest FFXIV dye to any color.
Accepts hex codes, dye names, and CSS color names.

Examples:
  \`!xd match #FF5733\`
  \`!xd match coral\``,

  gradient: `**!xivdye gradient <dye1> > <dye2> [steps] [mode]**
Generate a color gradient between two dyes.

Examples:
  \`!xivdye gradient Pure White > Jet Black\`
  \`!xivdye gradient Pure White > Jet Black 5 oklch\``,

  mixer: `**!xivdye mixer <dye1> > <dye2> [mode]**
Blend two dye colors.

Modes: rgb, lab, oklab, ryb, hsl, spectral

Examples:
  \`!xivdye mixer Snow White > Jet Black\`
  \`!xivdye mixer Snow White > Jet Black spectral\``,

  comparison: `**!xivdye comparison <dye1> > <dye2> [> dye3 ...]]**
Compare dyes side-by-side.

Examples:
  \`!xivdye comparison Snow White > Pure White\`
  \`!xivdye comparison Snow White > Pure White > Pearl White\``,

  ping: `**!xd ping**
Check bot connectivity and response latency.`,

  help: `**!xd help [command]**
Show this help message, or detailed help for a specific command.`,

  about: `**!xd about**
Show bot information and quick start guide.`,
};

export async function handleHelpCommand(ctx: CommandContext): Promise<void> {
  const topic = ctx.parsed.rawArgs[0]?.toLowerCase();

  if (topic && COMMAND_HELP[topic]) {
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
