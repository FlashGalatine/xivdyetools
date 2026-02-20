/**
 * Command parser for prefix-based Stoat bot commands.
 *
 * Handles:
 * - Dual prefix: `!xivdye` and `!xd`
 * - Subcommand routing
 * - Greedy dye name matching
 * - `>` separator for multi-dye commands
 */

/** Recognized prefixes (case-insensitive) */
const PREFIXES = ['!xivdye', '!xd'] as const;

/**
 * Result of parsing a raw message string.
 * Returns null if the message doesn't start with a recognized prefix.
 */
export interface ParsedCommand {
  /** The prefix used (normalized to lowercase) */
  prefix: string;
  /** The primary command name (e.g., 'dye', 'harmony', 'help') */
  command: string;
  /** The subcommand, if any (e.g., 'info', 'search', 'list') */
  subcommand: string | null;
  /** Raw argument tokens after command/subcommand extraction */
  rawArgs: string[];
}

/**
 * Result of parsing arguments for a multi-dye command.
 * The `>` separator splits dye arguments.
 */
export interface MultiDyeArgs {
  /** Dye name segments (split by `>`) */
  dyeSegments: string[];
  /** Remaining non-dye arguments (e.g., steps count, color space) */
  trailingArgs: string[];
}

/**
 * Commands that have subcommands (e.g., `!xd dye info`, `!xd stats overview`).
 */
const COMMANDS_WITH_SUBCOMMANDS = new Set([
  'dye',
  'stats',
  'admin',
  'prefs',
  'preset',
  'budget',
  'swatch',
]);

/**
 * Short aliases that map to full command + subcommand combinations.
 * e.g., `!xd info` → command: 'dye', subcommand: 'info'
 */
const SHORT_ALIASES: Record<string, { command: string; subcommand: string | null }> = {
  info: { command: 'dye', subcommand: 'info' },
  search: { command: 'dye', subcommand: 'search' },
  random: { command: 'dye', subcommand: 'random' },
  list: { command: 'dye', subcommand: 'list' },
};

/**
 * Parse a raw message content string into a structured command.
 * Returns null if the message doesn't match a known prefix.
 */
export function parseCommand(content: string): ParsedCommand | null {
  const trimmed = content.trim();
  const lower = trimmed.toLowerCase();

  // Find matching prefix
  let matchedPrefix: string | null = null;
  for (const prefix of PREFIXES) {
    if (lower.startsWith(prefix)) {
      // Must be followed by whitespace or end of string
      const afterPrefix = trimmed[prefix.length];
      if (afterPrefix === undefined || afterPrefix === ' ') {
        matchedPrefix = prefix;
        break;
      }
    }
  }

  if (!matchedPrefix) return null;

  // Extract everything after the prefix
  const rest = trimmed.slice(matchedPrefix.length).trim();
  if (rest.length === 0) {
    // Just the prefix, no command — treat as help
    return { prefix: matchedPrefix, command: 'help', subcommand: null, rawArgs: [] };
  }

  // Split into tokens
  const tokens = rest.split(/\s+/);
  const firstToken = tokens[0].toLowerCase();

  // Check short aliases first (e.g., `!xd info Snow White`)
  if (SHORT_ALIASES[firstToken]) {
    const alias = SHORT_ALIASES[firstToken];
    return {
      prefix: matchedPrefix,
      command: alias.command,
      subcommand: alias.subcommand,
      rawArgs: tokens.slice(1),
    };
  }

  // Check if this command has subcommands
  if (COMMANDS_WITH_SUBCOMMANDS.has(firstToken)) {
    const subcommand = tokens[1]?.toLowerCase() ?? null;
    return {
      prefix: matchedPrefix,
      command: firstToken,
      subcommand,
      rawArgs: tokens.slice(subcommand ? 2 : 1),
    };
  }

  // Simple command (e.g., `!xivdye harmony Pure White triadic`)
  return {
    prefix: matchedPrefix,
    command: firstToken,
    subcommand: null,
    rawArgs: tokens.slice(1),
  };
}

/**
 * Parse raw argument tokens for multi-dye commands.
 * Splits by the `>` separator to extract multiple dye name segments.
 *
 * Example:
 *   tokens: ['Pure', 'White', '>', 'Jet', 'Black', '5', 'oklch']
 *   result: { dyeSegments: ['Pure White', 'Jet Black'], trailingArgs: ['5', 'oklch'] }
 *
 * The last segment before any non-dye trailing argument is included.
 * Trailing arguments are tokens after the final dye segment that look
 * like options (numbers, known option values).
 */
export function parseMultiDyeArgs(tokens: string[]): MultiDyeArgs {
  if (tokens.length === 0) {
    return { dyeSegments: [], trailingArgs: [] };
  }

  // Split tokens by `>`
  const segments: string[][] = [];
  let current: string[] = [];

  for (const token of tokens) {
    if (token === '>') {
      if (current.length > 0) {
        segments.push(current);
        current = [];
      }
    } else {
      current.push(token);
    }
  }
  if (current.length > 0) {
    segments.push(current);
  }

  if (segments.length === 0) {
    return { dyeSegments: [], trailingArgs: [] };
  }

  // The last segment may contain trailing args mixed with dye name tokens.
  // Simple heuristic: if we have multiple segments (multi-dye command),
  // check if the last segment's trailing tokens look like options.
  const dyeSegments: string[] = [];
  let trailingArgs: string[] = [];

  if (segments.length === 1) {
    // Single segment — the entire thing is a dye name (or dye + trailing args).
    // Let the caller use greedy matching to disambiguate.
    dyeSegments.push(segments[0].join(' '));
  } else {
    // Multiple segments — each segment before options is a dye name
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (i === segments.length - 1) {
        // Last segment: split trailing option-like tokens from dye name
        const { name, trailing } = splitTrailingOptions(seg);
        if (name) dyeSegments.push(name);
        trailingArgs = trailing;
      } else {
        dyeSegments.push(seg.join(' '));
      }
    }
  }

  return { dyeSegments, trailingArgs };
}

/** Known option values that should be stripped from dye names */
const OPTION_VALUES = new Set([
  // Blending modes
  'rgb',
  'lab',
  'oklab',
  'ryb',
  'hsl',
  'spectral',
  // Color spaces
  'oklch',
  'lch',
  // Harmony types
  'triadic',
  'complementary',
  'analogous',
  'split-complementary',
  'tetradic',
  'square',
  'monochromatic',
]);

/**
 * Split trailing option-like tokens from a dye name.
 * Scans from right-to-left; tokens that are numbers or known options
 * are considered trailing args.
 */
function splitTrailingOptions(tokens: string[]): { name: string | null; trailing: string[] } {
  const trailing: string[] = [];
  let i = tokens.length - 1;

  while (i >= 0) {
    const token = tokens[i].toLowerCase();
    if (/^\d+$/.test(token) || OPTION_VALUES.has(token)) {
      trailing.unshift(tokens[i]);
      i--;
    } else {
      break;
    }
  }

  const name = i >= 0 ? tokens.slice(0, i + 1).join(' ') : null;
  return { name, trailing };
}

/**
 * Extract a single dye name + trailing args from raw argument tokens.
 * Used for single-dye commands like `!xd harmony Pure White triadic`.
 *
 * Uses greedy matching from the left — tries longest possible name first.
 */
export function parseSingleDyeArgs(tokens: string[]): {
  dyeName: string;
  trailingArgs: string[];
} {
  if (tokens.length === 0) {
    return { dyeName: '', trailingArgs: [] };
  }

  const { name, trailing } = splitTrailingOptions(tokens);
  return {
    dyeName: name ?? tokens.join(' '),
    trailingArgs: trailing,
  };
}
