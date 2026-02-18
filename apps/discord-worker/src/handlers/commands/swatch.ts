/**
 * /swatch Command Handler (V4)
 *
 * Matches FFXIV character customization colors to available dyes.
 * Supports all character color types: skin, hair, eyes, highlights,
 * lips, tattoos (including limbal rings), and face paint.
 *
 * Subcommands:
 * - color: Match a specific color by index (0-191 or 0-95)
 * - grid: Match a color by grid position (row/column)
 *
 * Race-specific colors (hair, skin) require clan and gender parameters.
 * Shared colors (eyes, lips, etc.) are the same for all races.
 *
 * @module handlers/commands/swatch
 */

import { CharacterColorService } from '@xivdyetools/core';
import { dyeService } from '../../utils/color.js';
import type { CharacterColor, SubRace, Gender as CoreGender } from '@xivdyetools/types';
import type { ExtendedLogger } from '@xivdyetools/logger';
import {
  messageResponse,
  deferredResponse,
  errorEmbed,
  hexToDiscordColor,
} from '../../utils/response.js';
import { editOriginalResponse } from '../../utils/discord-api.js';
import { getDyeEmoji } from '../../services/emoji.js';
import {
  getUserPreferences,
  resolveMatchingMethod,
  resolveCount,
} from '../../services/preferences.js';
import {
  VALID_CLANS,
  CLANS_BY_RACE,
  type MatchingMethod,
  type Gender,
} from '../../types/preferences.js';
import {
  createTranslator,
  createUserTranslator,
  type Translator,
} from '../../services/bot-i18n.js';
import {
  initializeLocale,
  getLocalizedDyeName,
  type LocaleCode,
} from '../../services/i18n.js';
import type { Env, DiscordInteraction } from '../../types/env.js';

// ============================================================================
// Constants
// ============================================================================

/** Grid columns for FFXIV character color grids */
const GRID_COLUMNS = 8;

/** Maximum index for standard color arrays (192 colors = 24 rows × 8 cols) */
const STANDARD_MAX_INDEX = 191;

/** Maximum index for lip color arrays (96 colors = 12 rows × 8 cols) */
const LIP_MAX_INDEX = 95;

/**
 * Color type categories
 */
type ColorType =
  | 'skin'
  | 'hair'
  | 'eye'
  | 'highlight'
  | 'lip_dark'
  | 'lip_light'
  | 'tattoo'
  | 'facepaint_dark'
  | 'facepaint_light';

/**
 * Color type metadata for validation
 */
const COLOR_TYPES: Record<ColorType, { emoji: string; maxIndex: number; needsClan: boolean }> = {
  skin: { emoji: '👤', maxIndex: STANDARD_MAX_INDEX, needsClan: true },
  hair: { emoji: '💇', maxIndex: STANDARD_MAX_INDEX, needsClan: true },
  eye: { emoji: '👁️', maxIndex: STANDARD_MAX_INDEX, needsClan: false },
  highlight: { emoji: '✨', maxIndex: STANDARD_MAX_INDEX, needsClan: false },
  lip_dark: { emoji: '💋', maxIndex: LIP_MAX_INDEX, needsClan: false },
  lip_light: { emoji: '💋', maxIndex: LIP_MAX_INDEX, needsClan: false },
  tattoo: { emoji: '🎭', maxIndex: STANDARD_MAX_INDEX, needsClan: false },
  facepaint_dark: { emoji: '🎨', maxIndex: LIP_MAX_INDEX, needsClan: false },
  facepaint_light: { emoji: '🎨', maxIndex: LIP_MAX_INDEX, needsClan: false },
};

/**
 * Maps ColorType code values to locale key paths
 * (handles mismatches: eye→eyes, lip_dark→lips_dark, lip_light→lips_light)
 */
const COLOR_TYPE_LOCALE_KEYS: Record<ColorType, string> = {
  skin: 'swatch.colorTypes.skin',
  hair: 'swatch.colorTypes.hair',
  eye: 'swatch.colorTypes.eyes',
  highlight: 'swatch.colorTypes.highlight',
  lip_dark: 'swatch.colorTypes.lips_dark',
  lip_light: 'swatch.colorTypes.lips_light',
  tattoo: 'swatch.colorTypes.tattoo',
  facepaint_dark: 'swatch.colorTypes.facepaint_dark',
  facepaint_light: 'swatch.colorTypes.facepaint_light',
};

/** Get the localized display name for a color type */
function getLocalizedColorTypeName(type: ColorType, t: Translator): string {
  return t.t(COLOR_TYPE_LOCALE_KEYS[type]);
}

/**
 * Map from preference clan names to CharacterColorService SubRace names
 */
const CLAN_TO_SUBRACE: Record<string, SubRace> = {
  'Midlander': 'Midlander',
  'Highlander': 'Highlander',
  'Seeker of the Sun': 'SeekerOfTheSun',
  'Keeper of the Moon': 'KeeperOfTheMoon',
  'Plainsfolk': 'Plainsfolk',
  'Dunesfolk': 'Dunesfolk',
  'Sea Wolf': 'SeaWolf',
  'Hellsguard': 'Hellsguard',
  'Wildwood': 'Wildwood',
  'Duskwight': 'Duskwight',
  'Raen': 'Raen',
  'Xaela': 'Xaela',
  'Rava': 'Rava',
  'Veena': 'Veena',
  'Helions': 'Helion',
  'The Lost': 'TheLost',
};

// ============================================================================
// Services
// ============================================================================

/** Character color service instance */
const characterColorService = new CharacterColorService();

// ============================================================================
// Main Handler
// ============================================================================

/**
 * Handles the /swatch command
 *
 * Routes to appropriate subcommand handler based on interaction data.
 */
export async function handleSwatchCommand(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext,
  logger?: ExtendedLogger
): Promise<Response> {
  const userId = interaction.member?.user?.id ?? interaction.user?.id ?? 'unknown';
  const t = await createUserTranslator(env.KV, userId, interaction.locale);

  // Get subcommand from options
  const options = interaction.data?.options || [];
  const subcommandOption = options[0];

  if (!subcommandOption) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.missingSubcommand'))],
      flags: 64,
    });
  }

  const subcommand = subcommandOption.name;
  const subOptions = subcommandOption.options || [];

  switch (subcommand) {
    case 'color':
      return handleColorSubcommand(env, userId, subOptions, t, logger);

    case 'grid':
      return handleGridSubcommand(env, userId, subOptions, t, logger);

    default:
      return messageResponse({
        embeds: [errorEmbed(t.t('common.error'), t.t('errors.unknownSubcommand', { name: subcommand }))],
        flags: 64,
      });
  }
}

// ============================================================================
// Color Subcommand
// ============================================================================

/**
 * Handles /swatch color <type> <index> [clan] [gender] [matching] [count]
 *
 * Matches a specific character color by its index to FFXIV dyes.
 */
async function handleColorSubcommand(
  env: Env,
  userId: string,
  options: Array<{ name: string; value?: string | number | boolean }>,
  t: Translator,
  logger?: ExtendedLogger
): Promise<Response> {
  // Extract parameters
  const typeOption = options.find((opt) => opt.name === 'type');
  const indexOption = options.find((opt) => opt.name === 'index');
  const clanOption = options.find((opt) => opt.name === 'clan');
  const genderOption = options.find((opt) => opt.name === 'gender');
  const matchingOption = options.find((opt) => opt.name === 'matching');
  const countOption = options.find((opt) => opt.name === 'count');

  const colorType = typeOption?.value as ColorType | undefined;
  const colorIndex = indexOption?.value as number | undefined;
  const explicitClan = clanOption?.value as string | undefined;
  const explicitGender = genderOption?.value as string | undefined;
  const explicitMatching = matchingOption?.value as string | undefined;
  const explicitCount = countOption?.value as number | undefined;

  // Validate required parameters
  if (!colorType || colorIndex === undefined) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('swatch.errors.missingTypeAndIndex'))],
      flags: 64,
    });
  }

  // Validate color type
  if (!COLOR_TYPES[colorType]) {
    const validTypes = Object.keys(COLOR_TYPES).map((k) => `\`${k}\``).join(', ');
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('swatch.errors.invalidColorType', { type: colorType, validTypes }))],
      flags: 64,
    });
  }

  const typeInfo = COLOR_TYPES[colorType];

  // Validate index range
  if (colorIndex < 0 || colorIndex > typeInfo.maxIndex) {
    return messageResponse({
      embeds: [errorEmbed(
        t.t('common.error'),
        t.t('swatch.errors.invalidIndex', { typeName: getLocalizedColorTypeName(colorType, t), min: 0, max: typeInfo.maxIndex })
      )],
      flags: 64,
    });
  }

  // Get user preferences
  const prefs = await getUserPreferences(env.KV, userId, logger);
  const matchingMethod = resolveMatchingMethod(explicitMatching, prefs);
  const count = resolveCount(explicitCount, prefs);

  // Resolve clan and gender for race-specific colors
  let clan: string | undefined;
  let gender: CoreGender | undefined;

  if (typeInfo.needsClan) {
    clan = explicitClan ?? prefs.clan;
    const genderValue = explicitGender ?? prefs.gender;
    gender = genderValue === 'male' ? 'Male' : genderValue === 'female' ? 'Female' : undefined;

    if (!clan || !gender) {
      const missing: string[] = [];
      if (!clan) missing.push('`clan`');
      if (!gender) missing.push('`gender`');

      return messageResponse({
        embeds: [errorEmbed(
          t.t('common.error'),
          t.t('swatch.errors.clanGenderRequired', { typeName: getLocalizedColorTypeName(colorType, t), missing: missing.join(' & ') })
        )],
        flags: 64,
      });
    }

    // Validate clan
    if (!VALID_CLANS.some((c) => c.toLowerCase() === clan!.toLowerCase())) {
      const clanList = Object.entries(CLANS_BY_RACE)
        .map(([race, clans]) => `**${race}**: ${clans.join(', ')}`)
        .join('\n');
      return messageResponse({
        embeds: [errorEmbed(
          t.t('common.error'),
          t.t('swatch.errors.invalidClan', { clan, clanList })
        )],
        flags: 64,
      });
    }
  }

  // Process and return results
  return processSwatchMatch(
    colorType,
    colorIndex,
    clan,
    gender,
    matchingMethod,
    count,
    t.getLocale(),
    logger
  );
}

// ============================================================================
// Grid Subcommand
// ============================================================================

/**
 * Handles /swatch grid <type> <row> <col> [clan] [gender] [matching] [count]
 *
 * Matches a character color by its grid position (row, column).
 */
async function handleGridSubcommand(
  env: Env,
  userId: string,
  options: Array<{ name: string; value?: string | number | boolean }>,
  t: Translator,
  logger?: ExtendedLogger
): Promise<Response> {
  // Extract parameters
  const typeOption = options.find((opt) => opt.name === 'type');
  const rowOption = options.find((opt) => opt.name === 'row');
  const colOption = options.find((opt) => opt.name === 'col');
  const clanOption = options.find((opt) => opt.name === 'clan');
  const genderOption = options.find((opt) => opt.name === 'gender');
  const matchingOption = options.find((opt) => opt.name === 'matching');
  const countOption = options.find((opt) => opt.name === 'count');

  const colorType = typeOption?.value as ColorType | undefined;
  const row = rowOption?.value as number | undefined;
  const col = colOption?.value as number | undefined;
  const explicitClan = clanOption?.value as string | undefined;
  const explicitGender = genderOption?.value as string | undefined;
  const explicitMatching = matchingOption?.value as string | undefined;
  const explicitCount = countOption?.value as number | undefined;

  // Validate required parameters
  if (!colorType || row === undefined || col === undefined) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('swatch.errors.missingGridParams'))],
      flags: 64,
    });
  }

  // Validate color type
  if (!COLOR_TYPES[colorType]) {
    const validTypes = Object.keys(COLOR_TYPES).map((k) => `\`${k}\``).join(', ');
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('swatch.errors.invalidColorType', { type: colorType, validTypes }))],
      flags: 64,
    });
  }

  const typeInfo = COLOR_TYPES[colorType];
  const maxRow = Math.floor(typeInfo.maxIndex / GRID_COLUMNS) + 1; // 1-based

  // Validate row (1-based)
  if (row < 1 || row > maxRow) {
    return messageResponse({
      embeds: [errorEmbed(
        t.t('common.error'),
        t.t('swatch.errors.invalidRow', { typeName: getLocalizedColorTypeName(colorType, t), min: 1, max: maxRow })
      )],
      flags: 64,
    });
  }

  // Validate column (1-based)
  if (col < 1 || col > GRID_COLUMNS) {
    return messageResponse({
      embeds: [errorEmbed(
        t.t('common.error'),
        t.t('swatch.errors.invalidColumn', { min: 1, max: GRID_COLUMNS })
      )],
      flags: 64,
    });
  }

  // Convert 1-based grid position to 0-based index
  const colorIndex = (row - 1) * GRID_COLUMNS + (col - 1);

  // Validate calculated index
  if (colorIndex > typeInfo.maxIndex) {
    return messageResponse({
      embeds: [errorEmbed(
        t.t('common.error'),
        t.t('swatch.errors.gridOutOfRange', { row, col, typeName: getLocalizedColorTypeName(colorType, t) })
      )],
      flags: 64,
    });
  }

  // Get user preferences
  const prefs = await getUserPreferences(env.KV, userId, logger);
  const matchingMethod = resolveMatchingMethod(explicitMatching, prefs);
  const count = resolveCount(explicitCount, prefs);

  // Resolve clan and gender for race-specific colors
  let clan: string | undefined;
  let gender: CoreGender | undefined;

  if (typeInfo.needsClan) {
    clan = explicitClan ?? prefs.clan;
    const genderValue = explicitGender ?? prefs.gender;
    gender = genderValue === 'male' ? 'Male' : genderValue === 'female' ? 'Female' : undefined;

    if (!clan || !gender) {
      const missing: string[] = [];
      if (!clan) missing.push('`clan`');
      if (!gender) missing.push('`gender`');

      return messageResponse({
        embeds: [errorEmbed(
          t.t('common.error'),
          t.t('swatch.errors.clanGenderRequired', { typeName: getLocalizedColorTypeName(colorType, t), missing: missing.join(' & ') })
        )],
        flags: 64,
      });
    }

    // Validate clan
    if (!VALID_CLANS.some((c) => c.toLowerCase() === clan!.toLowerCase())) {
      const clanList = Object.entries(CLANS_BY_RACE)
        .map(([race, clans]) => `**${race}**: ${clans.join(', ')}`)
        .join('\n');
      return messageResponse({
        embeds: [errorEmbed(
          t.t('common.error'),
          t.t('swatch.errors.invalidClan', { clan, clanList })
        )],
        flags: 64,
      });
    }
  }

  // Process and return results
  return processSwatchMatch(
    colorType,
    colorIndex,
    clan,
    gender,
    matchingMethod,
    count,
    t.getLocale(),
    logger
  );
}

// ============================================================================
// Processing
// ============================================================================

/**
 * Process the swatch match and build the response
 */
async function processSwatchMatch(
  colorType: ColorType,
  colorIndex: number,
  clan: string | undefined,
  gender: CoreGender | undefined,
  matchingMethod: MatchingMethod,
  count: number,
  locale: LocaleCode,
  logger?: ExtendedLogger
): Promise<Response> {
  const t = createTranslator(locale);
  await initializeLocale(locale);

  try {
    // Get the character color
    const characterColor = await getCharacterColor(colorType, colorIndex, clan, gender);

    if (!characterColor) {
      return messageResponse({
        embeds: [errorEmbed(t.t('common.error'), t.t('swatch.errors.colorNotFound'))],
        flags: 64,
      });
    }

    // Find closest dye matches
    const matches = characterColorService.findClosestDyes(characterColor, dyeService, {
      count,
      matchingMethod: matchingMethod as any, // Core uses same string values
    });

    if (matches.length === 0) {
      return messageResponse({
        embeds: [errorEmbed(t.t('common.error'), t.t('errors.noMatchFound'))],
        flags: 64,
      });
    }

    // Build the response
    return buildSwatchResponse(colorType, characterColor, clan, gender, matchingMethod, matches, t);
  } catch (error) {
    if (logger) {
      logger.error('Swatch command error', error instanceof Error ? error : undefined);
    }

    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.generationFailed'))],
      flags: 64,
    });
  }
}

/**
 * Get a character color from the service
 */
async function getCharacterColor(
  colorType: ColorType,
  index: number,
  clan?: string,
  gender?: CoreGender
): Promise<CharacterColor | null> {
  switch (colorType) {
    case 'skin': {
      if (!clan || !gender) return null;
      const subrace = getSubraceFromClan(clan);
      if (!subrace) return null;
      const colors = await characterColorService.getSkinColors(subrace, gender);
      return colors.find((c) => c.index === index) ?? null;
    }

    case 'hair': {
      if (!clan || !gender) return null;
      const subrace = getSubraceFromClan(clan);
      if (!subrace) return null;
      const colors = await characterColorService.getHairColors(subrace, gender);
      return colors.find((c) => c.index === index) ?? null;
    }

    case 'eye': {
      const colors = characterColorService.getEyeColors();
      return colors.find((c) => c.index === index) ?? null;
    }

    case 'highlight': {
      const colors = characterColorService.getHighlightColors();
      return colors.find((c) => c.index === index) ?? null;
    }

    case 'lip_dark': {
      const colors = characterColorService.getLipColorsDark();
      return colors.find((c) => c.index === index) ?? null;
    }

    case 'lip_light': {
      const colors = characterColorService.getLipColorsLight();
      return colors.find((c) => c.index === index) ?? null;
    }

    case 'tattoo': {
      const colors = characterColorService.getTattooColors();
      return colors.find((c) => c.index === index) ?? null;
    }

    case 'facepaint_dark': {
      const colors = characterColorService.getFacePaintColorsDark();
      return colors.find((c) => c.index === index) ?? null;
    }

    case 'facepaint_light': {
      const colors = characterColorService.getFacePaintColorsLight();
      return colors.find((c) => c.index === index) ?? null;
    }

    default:
      return null;
  }
}

/**
 * Convert a preference clan name to a SubRace enum value
 */
function getSubraceFromClan(clan: string): SubRace | null {
  // Normalize the clan name first
  const normalizedClan = VALID_CLANS.find((c) => c.toLowerCase() === clan.toLowerCase());
  if (!normalizedClan) return null;

  return CLAN_TO_SUBRACE[normalizedClan] ?? null;
}

// ============================================================================
// Response Building
// ============================================================================

/**
 * Build the swatch command response embed
 */
function buildSwatchResponse(
  colorType: ColorType,
  characterColor: CharacterColor,
  clan: string | undefined,
  gender: CoreGender | undefined,
  matchingMethod: MatchingMethod,
  matches: Array<{ characterColor: CharacterColor; dye: any; distance: number }>,
  t: Translator
): Response {
  const locale = t.getLocale();
  const typeInfo = COLOR_TYPES[colorType];
  const colorTypeName = getLocalizedColorTypeName(colorType, t);
  const row = Math.floor(characterColor.index / GRID_COLUMNS) + 1; // 1-based
  const col = (characterColor.index % GRID_COLUMNS) + 1; // 1-based

  // Format match quality labels
  const matchLines = matches.map((match, i) => {
    const { dye, distance } = match;
    const quality = getMatchQuality(distance, t);
    const emoji = getDyeEmoji(dye.id);
    const emojiPrefix = emoji ? `${emoji} ` : '';
    const localizedName = getLocalizedDyeName(dye.itemID, dye.name, locale);

    return `**${i + 1}.** ${emojiPrefix}**${localizedName}** • \`${dye.hex.toUpperCase()}\` • ${quality.emoji} ${quality.label} (Δ ${distance.toFixed(1)})`;
  }).join('\n');

  // Build description
  const description: string[] = [
    `**${typeInfo.emoji} ${colorTypeName}**`,
    `${t.t('swatch.index')}: \`${characterColor.index}\` (${t.t('swatch.row')} ${row}, ${t.t('swatch.column')} ${col})`,
    `${t.t('common.color')}: \`${characterColor.hex.toUpperCase()}\``,
  ];

  // Add clan/gender for race-specific colors
  if (typeInfo.needsClan && clan && gender) {
    const genderDisplay = gender === 'Male' ? t.t('swatch.genders.male') : t.t('swatch.genders.female');
    description.push(`${t.t('swatch.clan')}: **${clan}** • ${t.t('swatch.gender')}: **${genderDisplay}**`);
  }

  // Add matching method (localized)
  const methodDisplay = t.t(`matching.methods.${matchingMethod}`) || matchingMethod;
  description.push(`${t.t('swatch.matching')}: **${methodDisplay}**`);

  description.push('');
  description.push(
    matches.length > 1
      ? `**${t.t('swatch.topMatches', { count: matches.length })}:**`
      : `**${t.t('swatch.closestDye')}:**`
  );
  description.push(matchLines);

  // Get top match for footer suggestion
  const topMatch = matches[0];
  const topMatchName = getLocalizedDyeName(topMatch.dye.itemID, topMatch.dye.name, locale);

  return messageResponse({
    embeds: [
      {
        title: `🎨 ${t.t('swatch.title')}`,
        description: description.join('\n'),
        color: hexToDiscordColor(characterColor.hex),
        footer: {
          text: t.t('swatch.footer', { dyeName: topMatchName }),
        },
      },
    ],
  });
}

/**
 * Gets match quality emoji and label based on color distance
 */
function getMatchQuality(distance: number, t: Translator): { emoji: string; label: string } {
  if (distance === 0) return { emoji: '🎯', label: t.t('quality.perfect') };
  if (distance < 5) return { emoji: '✨', label: t.t('quality.excellent') };
  if (distance < 15) return { emoji: '👍', label: t.t('quality.good') };
  if (distance < 30) return { emoji: '⚠️', label: t.t('quality.fair') };
  return { emoji: '🔍', label: t.t('quality.approximate') };
}
