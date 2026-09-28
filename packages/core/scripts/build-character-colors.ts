#!/usr/bin/env tsx
/**
 * Derives the character color sheets in `src/data/character_colors/` from the
 * game's `chara/xls/charamake/human.cmp`, which is NOT vendored in this
 * repository (it is Square Enix game data — extract it with any FFXIV data
 * tool and pass its path):
 *
 *   pnpm --filter @xivdyetools/core run build:character-colors -- <path/to/human.cmp>
 *
 * `human.cmp` keeps every palette twice (Penumbra.GameData `Files/CmpData.cs`):
 * the **interface** half is what the character creator shows (verified against
 * the creator's own RGB readouts), and the **shader** half is what the game
 * renders from — the value a `.chara` extended float stores, squared. So:
 *
 * - `shared/*.json` and `race_specific/*.json` ← the interface half, in the
 *   `{ index, hex, rgb }` shape `CharacterColorService` serves. These are what
 *   the Swatch Matcher shows and matches dyes against.
 * - `shader/shared.json` and `shader/race_specific.json` ← the shader half, as
 *   bare hex lists. Only the `.chara` resolver reads them, to judge a float.
 *
 * File layout, in 4-byte RGBA colors: 9 shader blocks of 256 (Eyes,
 * HairHighlights, LipsDark 128 + FacePaintDark 128, Features, LipsLight 128 +
 * FacePaintLight 128, then four unused), the same 9 as the interface half,
 * then 32 clan/gender blocks of 1,280 (Skin 256, Hair 256 × {Main, Sheen},
 * SkinInterface 256, HairInterface 256; index = (clan − 1) × 2, +1 for
 * feminine), then the height/scale tables.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const COLORS_BLOCK = 256;
const COMMON_BLOCKS = 9;
const RACE_BASE = COMMON_BLOCKS * 2 * COLORS_BLOCK; // 4608
const RACE_STRIDE = 1280;
/** Swatches a player can pick; the palettes run on past this for NPC-only colors. */
const PLAYER_COLORS = 192;
/** Dark/light halves of the lip and face-paint palettes. */
const TONED_COLORS = 96;

/** The file's clan order (Penumbra `SubRace`, Midlander = 1) under this repo's names. */
const SUBRACES = [
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
] as const;
const GENDERS = ['Male', 'Female'] as const;

/** Offsets within one half of the shared palettes. */
const SHARED = {
  eyes: { offset: 0, count: PLAYER_COLORS },
  highlights: { offset: 256, count: PLAYER_COLORS },
  lipsDark: { offset: 512, count: TONED_COLORS },
  facePaintDark: { offset: 640, count: TONED_COLORS },
  features: { offset: 768, count: PLAYER_COLORS },
  lipsLight: { offset: 1024, count: TONED_COLORS },
  facePaintLight: { offset: 1152, count: TONED_COLORS },
} as const;
type SharedPalette = keyof typeof SHARED;

type Rgb = { r: number; g: number; b: number };

// `pnpm run build:character-colors -- <path>` passes the `--` through
const cmpPath = process.argv.slice(2).find((arg) => arg !== '--');
if (!cmpPath) {
  console.error('usage: build-character-colors.ts <path/to/human.cmp>');
  process.exit(1);
}
const buffer = readFileSync(cmpPath);
const expectedBytes = (RACE_BASE + SUBRACES.length * GENDERS.length * RACE_STRIDE) * 4;
if (buffer.length < expectedBytes) {
  throw new Error(
    `${cmpPath}: ${buffer.length} bytes, expected at least ${expectedBytes} — not a human.cmp`,
  );
}

const colorAt = (i: number): Rgb => ({
  r: buffer[i * 4],
  g: buffer[i * 4 + 1],
  b: buffer[i * 4 + 2],
});
const hexOf = ({ r, g, b }: Rgb): string =>
  '#' +
  [r, g, b]
    .map((c) => c.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
const range = (start: number, count: number, step = 1): Rgb[] =>
  Array.from({ length: count }, (_, i) => colorAt(start + i * step));

const sharedHalf = (palette: SharedPalette, ui: boolean): Rgb[] =>
  range((ui ? COMMON_BLOCKS * COLORS_BLOCK : 0) + SHARED[palette].offset, SHARED[palette].count);

const raceBase = (clan: number, gender: number): number =>
  RACE_BASE + (clan * 2 + gender) * RACE_STRIDE;
const skinHalf = (clan: number, gender: number, ui: boolean): Rgb[] =>
  range(raceBase(clan, gender) + (ui ? 768 : 0), PLAYER_COLORS);
// The shader hair block pairs each color with an unused sheen: take every other one
const hairHalf = (clan: number, gender: number, ui: boolean): Rgb[] =>
  ui
    ? range(raceBase(clan, gender) + 1024, PLAYER_COLORS)
    : range(raceBase(clan, gender) + 256, PLAYER_COLORS, 2);

const sheet = (colors: Rgb[]) => colors.map((rgb, index) => ({ index, hex: hexOf(rgb), rgb }));
const perClan = (
  half: (clan: number, gender: number) => Rgb[],
  shape: (colors: Rgb[]) => unknown,
) =>
  Object.fromEntries(
    SUBRACES.map((name, clan) => [
      name,
      Object.fromEntries(GENDERS.map((gender, g) => [gender, shape(half(clan, g))])),
    ]),
  );

const dataDir = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/character_colors');
const write = (path: string, value: unknown): void => {
  writeFileSync(resolve(dataDir, path), JSON.stringify(value, null, 2));
  console.log(`wrote ${path}`);
};

// Interface half — what the creator shows
write('shared/eye_colors.json', sheet(sharedHalf('eyes', true)));
write('shared/highlight_colors.json', sheet(sharedHalf('highlights', true)));
write('shared/tattoo_colors.json', sheet(sharedHalf('features', true)));
write('shared/lip_colors_dark.json', sheet(sharedHalf('lipsDark', true)));
write('shared/lip_colors_light.json', sheet(sharedHalf('lipsLight', true)));
write('shared/face_paint_dark.json', sheet(sharedHalf('facePaintDark', true)));
write('shared/face_paint_light.json', sheet(sharedHalf('facePaintLight', true)));
write(
  'race_specific/hair_colors.json',
  perClan((c, g) => hairHalf(c, g, true), sheet),
);
write(
  'race_specific/skin_colors.json',
  perClan((c, g) => skinHalf(c, g, true), sheet),
);

// Shader half — what a .chara float stores (squared)
const hexes = (colors: Rgb[]): string[] => colors.map(hexOf);
write('shader/shared.json', {
  eyes: hexes(sharedHalf('eyes', false)),
  highlights: hexes(sharedHalf('highlights', false)),
  features: hexes(sharedHalf('features', false)),
  lipsDark: hexes(sharedHalf('lipsDark', false)),
});
write('shader/race_specific.json', {
  skin: perClan((c, g) => skinHalf(c, g, false), hexes),
  hair: perClan((c, g) => hairHalf(c, g, false), hexes),
});
