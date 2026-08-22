/**
 * Slash-command schemas — the single source of truth for what registers
 * with Discord. `register-commands.ts` publishes this array verbatim and
 * asserts name parity with the roster in `registry.ts` before doing so.
 *
 * @module commands/schemas
 */

import type { PresetCategory } from '@xivdyetools/types';
import { QUICK_PICKS } from '../services/budget/quick-picks.js';

/**
 * Discord command option types
 * @see https://discord.com/developers/docs/interactions/application-commands#application-command-object-application-command-option-type
 */
export const OptionType = {
  SUB_COMMAND: 1,
  SUB_COMMAND_GROUP: 2,
  STRING: 3,
  INTEGER: 4,
  BOOLEAN: 5,
  USER: 6,
  CHANNEL: 7,
  ROLE: 8,
  MENTIONABLE: 9,
  NUMBER: 10,
  ATTACHMENT: 11,
} as const;

/**
 * The `category` choice list shared by every `/preset` subcommand that filters
 * or assigns a category (`list`, `random`, `submit`).
 *
 * `value` is typed as {@link PresetCategory} deliberately: these are *registered*
 * Discord choices, so a value the backing union no longer defines cannot be
 * caught at runtime — Discord itself presents it to the user as valid. Binding
 * the literal to the union makes a dropped member a compile error here instead
 * of a dead menu entry in every Discord client.
 *
 * 5.0 retired the `community` member; see BUG-001.
 */
export const PRESET_CATEGORY_CHOICES: ReadonlyArray<{ name: string; value: PresetCategory }> = [
  { name: '⚔️ FFXIV Jobs', value: 'jobs' },
  { name: '🏛️ Grand Companies', value: 'grand-companies' },
  { name: '🍂 Seasons', value: 'seasons' },
  { name: '🎉 FFXIV Events', value: 'events' },
  { name: '🎨 Aesthetics', value: 'aesthetics' },
  { name: '👤 Appearance', value: 'appearance' },
  { name: '🏔️ Zones', value: 'zones' },
  { name: '🗡️ Raids & Trials', value: 'raids-trials' },
];

/**
 * All slash commands for the bot
 * V4.0.0 command set
 */
/**
 * Shared by /accessibility and its /a11y alias — the two registrations must
 * carry identical options or the alias silently drifts.
 */
const ACCESSIBILITY_OPTIONS = [
  {
    name: 'dye',
    description: 'Primary dye (hex code or dye name)',
    type: OptionType.STRING,
    required: true,
    autocomplete: true,
  },
  {
    name: 'dye2',
    description: 'Second dye — renders the pair frames (optional)',
    type: OptionType.STRING,
    required: false,
    autocomplete: true,
  },
  {
    name: 'vision',
    description: 'The lens: a named type renders one lens, All renders every lens',
    type: OptionType.STRING,
    required: false,
    choices: [
      { name: 'All lenses', value: 'all' },
      { name: 'Protanopia (red-blind)', value: 'protanopia' },
      { name: 'Deuteranopia (green-blind)', value: 'deuteranopia' },
      { name: 'Tritanopia (blue-blind)', value: 'tritanopia' },
      { name: 'Achromatopsia (total colorblindness)', value: 'achromatopsia' },
    ],
  },
];

export const commands = [
  // =========================================================================
  // General
  // =========================================================================
  {
    name: 'about',
    description: 'Show information about the XIV Dye Tools bot',
  },

  // =========================================================================
  // Color Analysis
  // =========================================================================
  {
    name: 'harmony',
    description: 'Generate harmonious dye combinations from a color',
    options: [
      {
        name: 'color',
        description: 'Base color (hex code like #FF5733 or dye name)',
        type: OptionType.STRING,
        required: true,
        autocomplete: true,
      },
      {
        name: 'type',
        description: 'Type of color harmony',
        type: OptionType.STRING,
        required: false,
        choices: [
          { name: 'Complementary (opposite colors)', value: 'complementary' },
          { name: 'Analogous (adjacent colors)', value: 'analogous' },
          { name: 'Triadic (3 evenly spaced)', value: 'triadic' },
          { name: 'Split-Complementary', value: 'split-complementary' },
          { name: 'Tetradic (4 colors)', value: 'tetradic' },
          { name: 'Inverted Tetradic (4 colors, mirrored)', value: 'inverted-tetradic' },
          { name: 'Square (4 evenly spaced)', value: 'square' },
          { name: 'Monochromatic (shades)', value: 'monochromatic' },
        ],
      },
      {
        name: 'color_space',
        description: 'Color space for hue rotation',
        type: OptionType.STRING,
        required: false,
        choices: [
          { name: 'HSV - Classic hue wheel (default)', value: 'hsv' },
          { name: 'OKLCH - Modern perceptual', value: 'oklch' },
          { name: 'LCH - Cylindrical perceptual', value: 'lch' },
          { name: 'HSL - Hue-Saturation-Lightness', value: 'hsl' },
        ],
      },
      {
        name: 'companions',
        description: 'Number of companion dyes per harmony slot (1-3)',
        type: OptionType.INTEGER,
        required: false,
        min_value: 1,
        max_value: 3,
      },
      {
        name: 'matching',
        description: 'Algorithm used to find closest dye for companion expansion',
        type: OptionType.STRING,
        required: false,
        choices: [
          { name: 'ΔE2000 - Industry standard (default)', value: 'ciede2000' },
          { name: 'ΔEOK - OKLAB perceptual', value: 'oklab' },
          { name: 'ΔE76 - CIELAB distance', value: 'cie76' },
          { name: 'REDMEAN - Weighted RGB', value: 'redmean' },
          { name: 'RGB DIST - Euclidean RGB', value: 'rgb' },
          { name: 'DISTINGUISH % - RGB rescaled 0-100', value: 'distinguish' },
        ],
      },
      {
        name: 'strict_matching',
        description: 'Tighten distance threshold for closer matches',
        type: OptionType.BOOLEAN,
        required: false,
      },
      {
        name: 'prevent_duplicates',
        description: 'Deduplicate dyes across all harmony slots',
        type: OptionType.BOOLEAN,
        required: false,
      },
    ],
  },

  {
    name: 'dye',
    description: 'Search and explore FFXIV dyes',
    options: [
      {
        name: 'search',
        description: 'Search for dyes by name',
        type: OptionType.SUB_COMMAND,
        options: [
          {
            name: 'query',
            description: 'Search term (dye name)',
            type: OptionType.STRING,
            required: true,
            autocomplete: true,
          },
        ],
      },
      {
        name: 'info',
        description: 'Get detailed information about a specific dye',
        type: OptionType.SUB_COMMAND,
        options: [
          {
            name: 'name',
            description: 'Dye name',
            type: OptionType.STRING,
            required: true,
            autocomplete: true,
          },
        ],
      },
      {
        name: 'list',
        description: 'List dyes by category',
        type: OptionType.SUB_COMMAND,
        options: [
          {
            name: 'category',
            description: 'Dye category',
            type: OptionType.STRING,
            required: false,
            choices: [
              { name: 'Red Dyes', value: 'Reds' },
              { name: 'Brown Dyes', value: 'Browns' },
              { name: 'Yellow Dyes', value: 'Yellows' },
              { name: 'Green Dyes', value: 'Greens' },
              { name: 'Blue Dyes', value: 'Blues' },
              { name: 'Purple Dyes', value: 'Purples' },
              { name: 'Neutral (White/Black)', value: 'Neutral' },
              { name: 'Special Dyes', value: 'Special' },
            ],
          },
        ],
      },
      {
        name: 'random',
        description: 'Show 5 randomly selected dyes',
        type: OptionType.SUB_COMMAND,
        options: [
          {
            name: 'unique_categories',
            description: 'Limit to 1 dye per category (default: false)',
            type: OptionType.BOOLEAN,
            required: false,
          },
        ],
      },
    ],
  },

  // =========================================================================
  // Color Extraction & Matching
  // =========================================================================
  {
    name: 'extractor',
    description: 'Extract colors from inputs and find matching FFXIV dyes',
    options: [
      {
        name: 'color',
        description: 'Find the closest FFXIV dye(s) to a color',
        type: OptionType.SUB_COMMAND,
        options: [
          {
            name: 'color',
            description: 'Color to match (hex code like #FF5733 or dye name)',
            type: OptionType.STRING,
            required: true,
            autocomplete: true,
          },
          {
            name: 'count',
            description: 'Number of matches to show (1-10)',
            type: OptionType.INTEGER,
            required: false,
            min_value: 1,
            max_value: 10,
          },
          {
            name: 'matching',
            description: 'Color matching algorithm',
            type: OptionType.STRING,
            required: false,
            choices: [
              { name: 'ΔE2000 - Industry standard (default)', value: 'ciede2000' },
              { name: 'ΔEOK - OKLAB perceptual', value: 'oklab' },
              { name: 'ΔE76 - CIELAB distance', value: 'cie76' },
              { name: 'REDMEAN - Weighted RGB', value: 'redmean' },
              { name: 'RGB DIST - Euclidean RGB', value: 'rgb' },
              { name: 'DISTINGUISH % - RGB rescaled 0-100', value: 'distinguish' },
            ],
          },
        ],
      },
      {
        name: 'image',
        description: 'Extract colors from an image and find matching dyes',
        type: OptionType.SUB_COMMAND,
        options: [
          {
            name: 'image',
            description: 'Image to analyze',
            type: OptionType.ATTACHMENT,
            required: true,
          },
          {
            name: 'colors',
            description: 'Number of colors to extract (3-10)',
            type: OptionType.INTEGER,
            required: false,
            min_value: 3,
            max_value: 10,
          },
          {
            name: 'matching',
            description: 'Color matching algorithm',
            type: OptionType.STRING,
            required: false,
            choices: [
              { name: 'ΔE2000 - Industry standard (default)', value: 'ciede2000' },
              { name: 'ΔEOK - OKLAB perceptual', value: 'oklab' },
              { name: 'ΔE76 - CIELAB distance', value: 'cie76' },
              { name: 'REDMEAN - Weighted RGB', value: 'redmean' },
              { name: 'RGB DIST - Euclidean RGB', value: 'rgb' },
              { name: 'DISTINGUISH % - RGB rescaled 0-100', value: 'distinguish' },
            ],
          },
          {
            name: 'prevent_duplicates',
            description: 'Avoid mapping multiple slots to the same dye (default: true)',
            type: OptionType.BOOLEAN,
            required: false,
          },
        ],
      },
    ],
  },

  // /gradient - Color gradient between two colors
  {
    name: 'gradient',
    description: 'Generate a color gradient between two colors with intermediate dyes',
    options: [
      {
        name: 'start_color',
        description: 'Starting color: hex (e.g., #FF0000) or dye name',
        type: OptionType.STRING,
        required: true,
        autocomplete: true,
      },
      {
        name: 'end_color',
        description: 'Ending color: hex (e.g., #0000FF) or dye name',
        type: OptionType.STRING,
        required: true,
        autocomplete: true,
      },
      {
        name: 'steps',
        description: 'Number of color steps (default: 6, max 12)',
        type: OptionType.INTEGER,
        required: false,
        min_value: 2,
        max_value: 12,
      },
      {
        name: 'color_space',
        description: 'Color interpolation mode for gradient',
        type: OptionType.STRING,
        required: false,
        choices: [
          { name: 'HSV - Vibrant hue transitions (default)', value: 'hsv' },
          { name: 'OKLCH - Modern perceptual', value: 'oklch' },
          { name: 'LAB - Perceptually uniform', value: 'lab' },
          { name: 'LCH - Cylindrical perceptual', value: 'lch' },
          { name: 'RGB - Linear blending', value: 'rgb' },
          { name: 'OKLAB - Modern perceptual blend', value: 'oklab' },
          { name: 'RYB - Artist color wheel', value: 'ryb' },
          { name: 'HSL - Hue-Saturation-Lightness', value: 'hsl' },
          { name: 'Spectral - Pigment physics', value: 'spectral' },
        ],
      },
      {
        name: 'matching',
        description: 'Algorithm for finding closest dyes',
        type: OptionType.STRING,
        required: false,
        choices: [
          { name: 'ΔE2000 - Industry standard (default)', value: 'ciede2000' },
          { name: 'ΔEOK - OKLAB perceptual', value: 'oklab' },
          { name: 'ΔE76 - CIELAB distance', value: 'cie76' },
          { name: 'REDMEAN - Weighted RGB', value: 'redmean' },
          { name: 'RGB DIST - Euclidean RGB', value: 'rgb' },
          { name: 'DISTINGUISH % - RGB rescaled 0-100', value: 'distinguish' },
        ],
      },
    ],
  },

  // /mixer - Dye blending with color science
  {
    name: 'mixer',
    description: 'Blend two dyes using various color mixing algorithms',
    options: [
      {
        name: 'dye1',
        description: 'First dye to blend (hex code or dye name)',
        type: OptionType.STRING,
        required: true,
        autocomplete: true,
      },
      {
        name: 'dye2',
        description: 'Second dye to blend (hex code or dye name)',
        type: OptionType.STRING,
        required: true,
        autocomplete: true,
      },
      {
        name: 'mode',
        description: 'Color blending algorithm',
        type: OptionType.STRING,
        required: false,
        choices: [
          { name: 'RGB - Simple additive averaging', value: 'rgb' },
          { name: 'LAB - Perceptual CIELAB blending', value: 'lab' },
          { name: 'OKLAB - Modern perceptual', value: 'oklab' },
          { name: 'RYB - Traditional artist color wheel', value: 'ryb' },
          { name: 'HSL - Hue-Saturation-Lightness', value: 'hsl' },
          { name: 'Spectral - Pigment physics simulation', value: 'spectral' },
        ],
      },
      {
        name: 'matching',
        description: 'Algorithm for finding closest dyes to the blended result',
        type: OptionType.STRING,
        required: false,
        choices: [
          { name: 'ΔE2000 - Industry standard (default)', value: 'ciede2000' },
          { name: 'ΔEOK - OKLAB perceptual', value: 'oklab' },
          { name: 'ΔE76 - CIELAB distance', value: 'cie76' },
          { name: 'REDMEAN - Weighted RGB', value: 'redmean' },
          { name: 'RGB DIST - Euclidean RGB', value: 'rgb' },
          { name: 'DISTINGUISH % - RGB rescaled 0-100', value: 'distinguish' },
        ],
      },
    ],
  },

  // =========================================================================
  // Utility Commands
  // =========================================================================
  // 5.0: the vision: option routes the frame — a named lens renders 13D,
  // vision:all renders 13E, a single dye renders 13H. Achromatopsia is a
  // full member of the choice list, not a hidden flag. WCAG contrast moves
  // to its own command; /accessibility is pair-based. /a11y is a second
  // registration with identical options and output (Discord has no alias
  // mechanism); the handler is shared and the chip prints the typed name.
  {
    name: 'accessibility',
    description: 'How a dye or a pair of dyes survives each kind of color vision',
    options: ACCESSIBILITY_OPTIONS,
  },
  {
    name: 'a11y',
    description: 'How a dye or a pair of dyes survives each kind of color vision',
    options: ACCESSIBILITY_OPTIONS,
  },

  // 5.0: WCAG 1.4.11 contrast — the pair count routes the frame; four is
  // the command's own limit, enforced here by four discrete options (the
  // rejection happens before the handler runs and needs no error copy).
  {
    name: 'contrast',
    description: 'WCAG non-text contrast between dye pairs (floor 3:1)',
    options: [
      {
        name: 'dye1',
        description: 'First dye (hex code or dye name)',
        type: OptionType.STRING,
        required: true,
        autocomplete: true,
      },
      {
        name: 'dye2',
        description: 'Second dye (hex code or dye name)',
        type: OptionType.STRING,
        required: true,
        autocomplete: true,
      },
      {
        name: 'dye3',
        description: 'Third dye (optional)',
        type: OptionType.STRING,
        required: false,
        autocomplete: true,
      },
      {
        name: 'dye4',
        description: 'Fourth dye (optional)',
        type: OptionType.STRING,
        required: false,
        autocomplete: true,
      },
    ],
  },

  {
    name: 'manual',
    description: 'Show help and usage guide for all commands',
    options: [
      {
        name: 'topic',
        description: 'Specific help topic',
        type: OptionType.STRING,
        required: false,
        choices: [
          { name: '📸 Image Matching Tips', value: 'match_image' },
          { name: '♿ Colour Vision', value: 'color_vision' },
          { name: '🔲 Contrast', value: 'contrast' },
          { name: '📐 Matching Methods', value: 'matching_methods' },
          { name: '🪙 Spectrum & Prices', value: 'spectrum_prices' },
          { name: '👤 Character File', value: 'character_file' },
        ],
      },
    ],
  },

  // /changelog - the bot's own release notes, bundled CHANGELOG-laymans.md (5.0, ephemeral)
  {
    name: 'changelog',
    description: "See what's new in the Discord bot — release notes, newest first",
    options: [
      {
        name: 'version',
        description: 'Expand a specific release (e.g. 5.0.0)',
        type: OptionType.STRING,
        required: false,
      },
    ],
  },

  // /stats - Bot usage statistics (5 subcommands)
  {
    name: 'stats',
    description: 'Display bot usage statistics and information',
    options: [
      {
        name: 'summary',
        description: 'Show basic bot information (public)',
        type: OptionType.SUB_COMMAND,
      },
      {
        name: 'overview',
        description: 'Show usage metrics (admin only)',
        type: OptionType.SUB_COMMAND,
      },
      {
        name: 'commands',
        description: 'Show per-command breakdown (admin only)',
        type: OptionType.SUB_COMMAND,
      },
      {
        name: 'preferences',
        description: 'Show preference adoption rates (admin only)',
        type: OptionType.SUB_COMMAND,
      },
      {
        name: 'health',
        description: 'Show system health status (admin only)',
        type: OptionType.SUB_COMMAND,
      },
    ],
  },

  // /preferences - Unified settings management
  {
    name: 'preferences',
    description: 'Manage your personal bot preferences',
    options: [
      {
        name: 'show',
        description: 'Display your current preferences',
        type: OptionType.SUB_COMMAND,
      },
      {
        name: 'set',
        description: 'Set one or more preferences (all options are optional)',
        type: OptionType.SUB_COMMAND,
        options: [
          {
            name: 'language',
            description: 'UI language for dye names and messages',
            type: OptionType.STRING,
            required: false,
            choices: [
              { name: '🇺🇸 English', value: 'en' },
              { name: '🇯🇵 日本語 (Japanese)', value: 'ja' },
              { name: '🇩🇪 Deutsch (German)', value: 'de' },
              { name: '🇫🇷 Français (French)', value: 'fr' },
              { name: '🇰🇷 한국어 (Korean)', value: 'ko' },
              { name: '🇨🇳 中文 (Chinese)', value: 'zh' },
            ],
          },
          {
            name: 'blending',
            description: 'Default blending mode for /mixer',
            type: OptionType.STRING,
            required: false,
            choices: [
              { name: 'RGB - Additive channel averaging', value: 'rgb' },
              { name: 'LAB - Perceptually uniform CIELAB', value: 'lab' },
              { name: 'OKLAB - Modern perceptual', value: 'oklab' },
              { name: 'RYB - Traditional artist color wheel', value: 'ryb' },
              { name: 'HSL - Hue-Saturation-Lightness', value: 'hsl' },
              { name: 'Spectral - Kubelka-Munk physics', value: 'spectral' },
            ],
          },
          {
            name: 'matching',
            description: 'Default color matching method',
            type: OptionType.STRING,
            required: false,
            choices: [
              { name: 'ΔE2000 - Industry standard (default)', value: 'ciede2000' },
              { name: 'ΔEOK - OKLAB perceptual', value: 'oklab' },
              { name: 'ΔE76 - CIELAB distance', value: 'cie76' },
              { name: 'REDMEAN - Weighted RGB', value: 'redmean' },
              { name: 'RGB DIST - Euclidean RGB', value: 'rgb' },
              { name: 'DISTINGUISH % - RGB rescaled 0-100', value: 'distinguish' },
            ],
          },
          {
            name: 'count',
            description: 'Default number of matches for /extractor color (1-10)',
            type: OptionType.INTEGER,
            required: false,
            min_value: 1,
            max_value: 10,
          },
          {
            name: 'clan',
            description: 'Default clan for /swatch (e.g., Midlander, Raen)',
            type: OptionType.STRING,
            required: false,
            autocomplete: true,
          },
          {
            name: 'gender',
            description: 'Default gender for /swatch',
            type: OptionType.STRING,
            required: false,
            choices: [
              { name: '♂️ Male', value: 'male' },
              { name: '♀️ Female', value: 'female' },
            ],
          },
          {
            name: 'world',
            description: 'Default world/datacenter for market prices',
            type: OptionType.STRING,
            required: false,
            autocomplete: true,
          },
          {
            name: 'market',
            description: 'Show Market Board prices by default',
            type: OptionType.BOOLEAN,
            required: false,
          },
          {
            name: 'show_hex',
            description: 'Show hex color codes on result cards',
            type: OptionType.BOOLEAN,
            required: false,
          },
          {
            name: 'show_rgb',
            description: 'Show RGB values on result cards',
            type: OptionType.BOOLEAN,
            required: false,
          },
          {
            name: 'show_hsv',
            description: 'Show HSV values on result cards',
            type: OptionType.BOOLEAN,
            required: false,
          },
          {
            name: 'show_lab',
            description: 'Show LAB values on result cards',
            type: OptionType.BOOLEAN,
            required: false,
          },
          {
            name: 'show_deltae',
            description: 'Show Delta-E color distance on result cards',
            type: OptionType.BOOLEAN,
            required: false,
          },
          {
            name: 'show_acquisition',
            description: 'Show dye acquisition source on result cards',
            type: OptionType.BOOLEAN,
            required: false,
          },
          {
            name: 'theme',
            description: 'Card theme for every generated image',
            type: OptionType.STRING,
            required: false,
            choices: [
              { name: '🌙 Dark (default)', value: 'dark' },
              { name: '☀️ Light', value: 'light' },
            ],
          },
        ],
      },
      {
        name: 'reset',
        description: 'Reset a preference to default (or all if no key specified)',
        type: OptionType.SUB_COMMAND,
        options: [
          {
            name: 'key',
            description: 'Preference to reset (omit for all)',
            type: OptionType.STRING,
            required: false,
            choices: [
              { name: 'Language', value: 'language' },
              { name: 'Blending Mode', value: 'blending' },
              { name: 'Matching Method', value: 'matching' },
              { name: 'Result Count', value: 'count' },
              { name: 'Default Clan', value: 'clan' },
              { name: 'Default Gender', value: 'gender' },
              { name: 'Market World', value: 'world' },
              { name: 'Show Prices', value: 'market' },
              { name: 'Show Hex', value: 'show_hex' },
              { name: 'Show RGB', value: 'show_rgb' },
              { name: 'Show HSV', value: 'show_hsv' },
              { name: 'Show LAB', value: 'show_lab' },
              { name: 'Show Delta-E', value: 'show_deltae' },
              { name: 'Show Acquisition', value: 'show_acquisition' },
              { name: 'Card Theme', value: 'theme' },
              { name: 'Dye Filters', value: 'filters' },
            ],
          },
        ],
      },
      {
        name: 'filters',
        description: 'Manage dye type filters for search results',
        type: OptionType.SUB_COMMAND_GROUP,
        options: [
          {
            name: 'set',
            description: 'Set dye type filters (all options are optional)',
            type: OptionType.SUB_COMMAND,
            options: [
              {
                name: 'metallic',
                description: 'Exclude metallic dyes',
                type: OptionType.BOOLEAN,
                required: false,
              },
              {
                name: 'pastel',
                description: 'Exclude pastel dyes',
                type: OptionType.BOOLEAN,
                required: false,
              },
              {
                name: 'dark',
                description: 'Exclude dark dyes',
                type: OptionType.BOOLEAN,
                required: false,
              },
              {
                name: 'cosmic',
                description: 'Exclude cosmic dyes',
                type: OptionType.BOOLEAN,
                required: false,
              },
              {
                name: 'ishgardian',
                description: 'Exclude Ishgardian dyes',
                type: OptionType.BOOLEAN,
                required: false,
              },
              {
                name: 'expensive',
                description: 'Exclude expensive dyes (Pure White / Jet Black)',
                type: OptionType.BOOLEAN,
                required: false,
              },
              {
                name: 'vendor',
                description: 'Exclude vendor-sold dyes',
                type: OptionType.BOOLEAN,
                required: false,
              },
              {
                name: 'craft',
                description: 'Exclude crafted dyes',
                type: OptionType.BOOLEAN,
                required: false,
              },
            ],
          },
          {
            name: 'show',
            description: 'Display your current dye filter settings',
            type: OptionType.SUB_COMMAND,
          },
          {
            name: 'reset',
            description: 'Clear all dye filters',
            type: OptionType.SUB_COMMAND,
          },
        ],
      },
    ],
  },

  // /swatch - Character color matching
  {
    name: 'swatch',
    description: "Match a character file's colours to the nearest dyes",
    options: [
      {
        name: 'file',
        description: '.chara character file (Anamnesis / Ktisis export)',
        type: OptionType.ATTACHMENT,
        required: true,
      },
      {
        name: 'order',
        description: 'Row order — both orders show the same five rows',
        type: OptionType.STRING,
        required: false,
        choices: [
          { name: 'Slots — file order (default)', value: 'slots' },
          { name: 'Hardest — worst match first', value: 'hardest' },
        ],
      },
      {
        name: 'slot',
        description: 'Show the five nearest dyes for one slot instead',
        type: OptionType.STRING,
        required: false,
        choices: [
          { name: '👤 Skin', value: 'skin' },
          { name: '💇 Hair', value: 'hair' },
          { name: '✨ Highlights', value: 'highlights' },
          { name: '👁️ Eyes', value: 'eyes' },
          { name: '💋 Lip', value: 'lip' },
          { name: '🎨 Face paint', value: 'facepaint' },
          { name: '🎭 Tattoo / Limbal ring', value: 'limbal' },
        ],
      },
    ],
  },

  // =========================================================================
  // Comparison & Settings
  // =========================================================================
  {
    name: 'comparison',
    description: 'Compare 2-4 dyes side-by-side with color analysis',
    options: [
      {
        name: 'dye1',
        description: 'First dye (hex code or dye name)',
        type: OptionType.STRING,
        required: true,
        autocomplete: true,
      },
      {
        name: 'dye2',
        description: 'Second dye (hex code or dye name)',
        type: OptionType.STRING,
        required: true,
        autocomplete: true,
      },
      {
        name: 'dye3',
        description: 'Third dye (optional)',
        type: OptionType.STRING,
        required: false,
        autocomplete: true,
      },
      {
        name: 'dye4',
        description: 'Fourth dye (optional)',
        type: OptionType.STRING,
        required: false,
        autocomplete: true,
      },
    ],
  },

  // =========================================================================
  // Community Presets
  // =========================================================================
  {
    name: 'preset',
    description: 'Browse, submit, and vote on community color presets',
    options: [
      {
        name: 'list',
        description: 'Browse community presets',
        type: OptionType.SUB_COMMAND,
        options: [
          {
            name: 'category',
            description: 'Filter by category',
            type: OptionType.STRING,
            required: false,
            choices: [...PRESET_CATEGORY_CHOICES],
          },
          {
            name: 'sort',
            description: 'Sort order',
            type: OptionType.STRING,
            required: false,
            choices: [
              { name: '⭐ Most Popular', value: 'popular' },
              { name: '🕐 Most Recent', value: 'recent' },
              { name: '🔤 Alphabetical', value: 'name' },
            ],
          },
        ],
      },
      {
        name: 'show',
        description: 'Display a specific preset',
        type: OptionType.SUB_COMMAND,
        options: [
          {
            name: 'name',
            description: 'Preset name',
            type: OptionType.STRING,
            required: true,
            autocomplete: true,
          },
        ],
      },
      {
        name: 'random',
        description: 'Get a random preset for inspiration',
        type: OptionType.SUB_COMMAND,
        options: [
          {
            name: 'category',
            description: 'Filter by category',
            type: OptionType.STRING,
            required: false,
            choices: [...PRESET_CATEGORY_CHOICES],
          },
        ],
      },
      {
        name: 'submit',
        description: 'Submit a new community preset',
        type: OptionType.SUB_COMMAND,
        options: [
          {
            name: 'preset_name',
            description: 'Name for your preset (2-50 characters)',
            type: OptionType.STRING,
            required: true,
          },
          {
            name: 'description',
            description: 'Describe your preset (10-200 characters)',
            type: OptionType.STRING,
            required: true,
          },
          {
            name: 'category',
            description: 'Preset category',
            type: OptionType.STRING,
            required: true,
            choices: [...PRESET_CATEGORY_CHOICES],
          },
          {
            name: 'dye1',
            description: 'First dye (required)',
            type: OptionType.STRING,
            required: true,
            autocomplete: true,
          },
          {
            name: 'dye2',
            description: 'Second dye (required)',
            type: OptionType.STRING,
            required: true,
            autocomplete: true,
          },
          {
            name: 'dye3',
            description: 'Third dye (optional)',
            type: OptionType.STRING,
            required: false,
            autocomplete: true,
          },
          {
            name: 'dye4',
            description: 'Fourth dye (optional)',
            type: OptionType.STRING,
            required: false,
            autocomplete: true,
          },
          {
            name: 'dye5',
            description: 'Fifth dye (optional)',
            type: OptionType.STRING,
            required: false,
            autocomplete: true,
          },
          {
            name: 'tags',
            description: 'Comma-separated tags (optional, max 10)',
            type: OptionType.STRING,
            required: false,
          },
        ],
      },
      {
        name: 'vote',
        description: 'Toggle your vote on a preset',
        type: OptionType.SUB_COMMAND,
        options: [
          {
            name: 'preset',
            description: 'Preset to vote on',
            type: OptionType.STRING,
            required: true,
            autocomplete: true,
          },
        ],
      },
      {
        name: 'edit',
        description: 'Edit one of your presets',
        type: OptionType.SUB_COMMAND,
        options: [
          {
            name: 'preset',
            description: 'The preset to edit',
            type: OptionType.STRING,
            required: true,
            autocomplete: true,
          },
          {
            name: 'name',
            description: 'New preset name (2-50 characters)',
            type: OptionType.STRING,
            required: false,
          },
          {
            name: 'description',
            description: 'New description (10-200 characters)',
            type: OptionType.STRING,
            required: false,
          },
          {
            name: 'tags',
            description: 'New tags (comma-separated)',
            type: OptionType.STRING,
            required: false,
          },
          {
            name: 'dye1',
            description: 'First dye',
            type: OptionType.STRING,
            required: false,
            autocomplete: true,
          },
          {
            name: 'dye2',
            description: 'Second dye',
            type: OptionType.STRING,
            required: false,
            autocomplete: true,
          },
          {
            name: 'dye3',
            description: 'Third dye',
            type: OptionType.STRING,
            required: false,
            autocomplete: true,
          },
          {
            name: 'dye4',
            description: 'Fourth dye',
            type: OptionType.STRING,
            required: false,
            autocomplete: true,
          },
          {
            name: 'dye5',
            description: 'Fifth dye',
            type: OptionType.STRING,
            required: false,
            autocomplete: true,
          },
        ],
      },
      {
        name: 'favorite',
        description: 'Manage your favorite community presets',
        type: OptionType.SUB_COMMAND_GROUP,
        options: [
          {
            name: 'add',
            description: 'Add a preset to your favorites',
            type: OptionType.SUB_COMMAND,
            options: [
              {
                name: 'preset_name',
                description: 'Preset to favorite',
                type: OptionType.STRING,
                required: true,
                autocomplete: true,
              },
            ],
          },
          {
            name: 'remove',
            description: 'Remove a preset from your favorites',
            type: OptionType.SUB_COMMAND,
            options: [
              {
                name: 'preset_name',
                description: 'Preset to unfavorite',
                type: OptionType.STRING,
                required: true,
                autocomplete: true,
              },
            ],
          },
          {
            name: 'list',
            description: 'List your favorited presets',
            type: OptionType.SUB_COMMAND,
          },
        ],
      },
      // Note: moderate, ban_user, and unban_user are now handled by
      // xivdyetools-moderation-worker (separate bot application)
    ],
  },

  // =========================================================================
  // Budget/Market Integration
  // =========================================================================
  {
    name: 'budget',
    description: 'Find affordable dye alternatives using market board prices',
    options: [
      {
        name: 'find',
        description: 'Find cheaper alternatives to an expensive dye',
        type: OptionType.SUB_COMMAND,
        options: [
          {
            name: 'target_dye',
            description: 'The expensive dye you want alternatives for',
            type: OptionType.STRING,
            required: true,
            autocomplete: true,
          },
          {
            name: 'world',
            description: 'World or datacenter for prices (uses saved preference if not set)',
            type: OptionType.STRING,
            required: false,
            autocomplete: true,
          },
          {
            name: 'matching',
            description: 'Color matching algorithm for the ΔE column',
            type: OptionType.STRING,
            required: false,
            choices: [
              { name: 'ΔE2000 - Industry standard (default)', value: 'ciede2000' },
              { name: 'ΔEOK - OKLAB perceptual', value: 'oklab' },
              { name: 'ΔE76 - CIELAB distance', value: 'cie76' },
              { name: 'REDMEAN - Weighted RGB', value: 'redmean' },
              { name: 'RGB DIST - Euclidean RGB', value: 'rgb' },
              { name: 'DISTINGUISH % - RGB rescaled 0-100', value: 'distinguish' },
            ],
          },
          {
            name: 'max_distance',
            description: 'Match line — furthest ΔE2000 to consider (2-20, default: 8)',
            type: OptionType.INTEGER,
            required: false,
            min_value: 2,
            max_value: 20,
          },
          {
            name: 'exclude_coffers',
            description: 'Remove Venture Coffer dyes (gacha — priced by player resale only)',
            type: OptionType.BOOLEAN,
            required: false,
          },
          {
            name: 'exclude_wide_spectrum',
            description: 'Remove Wide Spectrum #1/#2 dyes (scrip/credit acquisition path)',
            type: OptionType.BOOLEAN,
            required: false,
          },
        ],
      },
      {
        name: 'set_world',
        description: 'Save your preferred world/datacenter for price lookups',
        type: OptionType.SUB_COMMAND,
        options: [
          {
            name: 'world',
            description: 'World or datacenter name',
            type: OptionType.STRING,
            required: true,
            autocomplete: true,
          },
        ],
      },
      {
        name: 'quick',
        description: 'Quick budget check for popular expensive dyes',
        type: OptionType.SUB_COMMAND,
        options: [
          {
            name: 'preset',
            description: 'Popular expensive dye to find alternatives for',
            type: OptionType.STRING,
            required: true,
            // Generated from the table the handler resolves against
            // (getQuickPickById) — 4.1.1 replaced the metallic/pastel picks
            // with the 22 Cosmic dyes but this list was never updated, so
            // three of the five old choices could not be resolved.
            // schemas.test.ts asserts parity; Discord caps choices at 25.
            choices: QUICK_PICKS.map((pick) => ({
              name: `${pick.emoji} ${pick.name}`,
              value: pick.id,
            })),
          },
          {
            name: 'world',
            description: 'World or datacenter for prices (uses saved preference if not set)',
            type: OptionType.STRING,
            required: false,
            autocomplete: true,
          },
        ],
      },
    ],
  },
];
