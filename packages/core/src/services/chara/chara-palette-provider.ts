/**
 * Bridges the host's bundled palettes to the xivcharakit `PaletteProvider` contract, so the library
 * interprets a `.chara` file against the same colors the grids show and no second corpus ships.
 *
 * Every request is validated here, before any data loads: the host getters pull whole tables and
 * `charaShaderHex` throws for a palette it does not know.
 */

import type { PaletteColor, PaletteProvider, PaletteRequest } from 'xivcharakit/palettes';
import type { Gender, SubRace } from '@xivdyetools/types';
import type { CharacterColorService } from '../CharacterColorService.js';
import { charaShaderHex, type CharaShaderPalette } from './chara-shader-colors.js';

/** A bridge identifier, not a game patch: the host cannot substantiate the library's metadata contract. */
const DATASET_VERSION = 'xivdyetools-host-palette-bridge/1';

const SHARED_SIZES: Record<string, number> = {
  eyes: 192,
  highlights: 192,
  features: 192,
  lipsDark: 96,
  lipsLight: 96,
  facePaintDark: 192,
  facePaintLight: 192,
};
const RACE_PALETTE_SIZE = 192;

const SHADER_PALETTES: ReadonlySet<string> = new Set<CharaShaderPalette>([
  'eyes',
  'highlights',
  'features',
  'lipsDark',
  'skin',
  'hair',
]);

const TRIBES: ReadonlySet<string> = new Set<SubRace>([
  'Midlander',
  'Highlander',
  'Wildwood',
  'Duskwight',
  'Plainsfolk',
  'Dunesfolk',
  'SeekerOfTheSun',
  'KeeperOfTheMoon',
  'SeaWolf',
  'Hellsguard',
  'Raen',
  'Xaela',
  'Helions',
  'TheLost',
  'Rava',
  'Veena',
]);

const HOST_GENDER: Record<string, Gender> = { Masculine: 'Male', Feminine: 'Female' };

function colorFor(request: PaletteRequest, hex: string | null | undefined): PaletteColor | null {
  if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex)) return null;
  const upper = hex.toUpperCase();
  const n = parseInt(upper.slice(1), 16);
  const color: PaletteColor = {
    table: request.table,
    palette: request.palette,
    index: request.index,
    hex: upper,
    rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255],
    datasetVersion: DATASET_VERSION,
  };
  if (request.palette === 'skin' || request.palette === 'hair') {
    color.tribe = request.tribe;
    color.gender = request.gender;
  }
  return color;
}

/** Creator-table hex for a shared palette, or undefined for a name the host does not hold. */
function sharedCreatorHex(colors: CharacterColorService, palette: string, index: number): string | undefined {
  switch (palette) {
    case 'eyes':
      return colors.getEyeColors()[index]?.hex;
    case 'highlights':
      return colors.getHighlightColors()[index]?.hex;
    case 'features':
      return colors.getTattooColors()[index]?.hex;
    case 'lipsDark':
      return colors.getLipColorsDark()[index]?.hex;
    case 'lipsLight':
      return colors.getLipColorsLight()[index]?.hex;
    case 'facePaintDark':
      return colors.getFacePaintColorsDark()[index]?.hex;
    case 'facePaintLight':
      return colors.getFacePaintColorsLight()[index]?.hex;
    default:
      return undefined;
  }
}

export function createCharaPaletteProvider(colors: CharacterColorService): PaletteProvider {
  return {
    async getColor(request: PaletteRequest): Promise<PaletteColor | null> {
      const { table, palette, index } = request;
      if (table !== 'creator' && table !== 'shader') return null;
      if (typeof palette !== 'string' || !Number.isInteger(index) || index < 0) return null;

      if (palette === 'skin' || palette === 'hair') {
        if (index >= RACE_PALETTE_SIZE) return null;
        const { tribe, gender } = request;
        if (typeof tribe !== 'string' || !TRIBES.has(tribe)) return null;
        if (typeof gender !== 'string' || !Object.hasOwn(HOST_GENDER, gender)) return null;
        const hostTribe = tribe as SubRace;
        const hostGender = HOST_GENDER[gender];
        if (table === 'shader') {
          return colorFor(request, await charaShaderHex(palette, index, hostTribe, hostGender));
        }
        const list =
          palette === 'skin'
            ? await colors.getSkinColors(hostTribe, hostGender)
            : await colors.getHairColors(hostTribe, hostGender);
        return colorFor(request, list[index]?.hex);
      }

      const size = Object.hasOwn(SHARED_SIZES, palette) ? SHARED_SIZES[palette] : undefined;
      if (size === undefined || index >= size) return null;
      if (table === 'shader') {
        if (!SHADER_PALETTES.has(palette)) return null;
        return colorFor(request, await charaShaderHex(palette as CharaShaderPalette, index, null, null));
      }
      return colorFor(request, sharedCreatorHex(colors, palette, index));
    },
  };
}
