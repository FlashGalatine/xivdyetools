/**
 * `.chara` slot resolution — arbitrates palette index vs extended float and
 * resolves everything against the character colour sheets and dye database.
 *
 * Confirmed rules (Swatch Matcher 10A):
 * - **Index wins where index and float agree**; past ~6 ΔE2000 the float wins
 *   and the slot is OFF GRID, with both hexes named.
 * - Floats count as live only when `IsExtendedAppearanceValid` is present and
 *   true — a missing flag means the index wins, and the UI says so
 *   (`indexWinNote: 'extendedMissing'`).
 * - **Dark/light palettes split 0-95 dark / 128-223 light; 96-127 fails
 *   loudly, never clamps** — one rule for every dark/light palette.
 * - A Hrothgar lip can hold a colour with no index → the same OFF-GRID path
 *   (`floatOnly`).
 * - Lip alpha 0 = no lip; the lip swatch composites over skin — both the raw
 *   colour and the blend are provided.
 * - Gear dye stain IDs resolve through the dye database
 *   (`stainID`/`legacyItemID`), never derived from ranges.
 * - Shared-index eyes (84% of files) merge into one badge — `eyesShareIndex`.
 * - Eye floats pair by name; a heterochromia file whose two floats each land
 *   on the other eye's palette entry is un-crossed first (4 of 157 in the
 *   2026-09-28 corpus) — see `uncrossEyeFloats`.
 * - **Skin and hair floats are never judged against the swatch**: the game
 *   stores a shading value derived from the entry, not the entry — see
 *   `SHADING_FLOAT_SLOTS`. A light-palette lip is judged against the dark
 *   entry the game stores for it.
 */

import type { CharacterColor, Dye, Gender, SubRace } from '@xivdyetools/types';
import { ColorConverter } from '../color/ColorConverter.js';
import { clamp } from '../../utils/index.js';
import type { CharacterColorService } from '../CharacterColorService.js';
import type {
  CharaColorSlotRaw,
  CharaGearSlotId,
  CharaSlotId,
  CharaSlotInertReason,
  ParsedCharaFile,
} from './chara-parser.js';
import type { CharaGearModel } from './chara-models.js';

/** ΔE2000 beyond which a live float overrides the palette index (OFF GRID). */
export const OFF_GRID_DELTA_E2000 = 6;

/**
 * ΔE2000 within which a stored eye float "lands on" a palette entry (the
 * square root is exact to ±1 per channel).
 */
const EYE_LANDS_DELTA_E2000 = 1;

export type CharaSlotVerdict =
  /** The palette index is the answer (float absent, not live, or agreeing) */
  | 'index'
  /** Live float disagrees past the threshold — float wins, both hexes named */
  | 'offGrid'
  /** A colour with no index (e.g. Hrothgar lip) — the OFF-GRID path */
  | 'floatOnly'
  /** A flag gates this slot off (reason on the slot) */
  | 'inert'
  /** Loud failure state — code + message name the field and value */
  | 'error';

export type CharaSlotErrorCode = 'midRangeIndex' | 'indexOutOfRange' | 'noTribe';

export interface ResolvedCharaSlot {
  slot: CharaSlotId;
  /** The limbal slot is a limbal ring on Au Ra and a tattoo otherwise */
  kind: CharaSlotId | 'tattoo';
  verdict: CharaSlotVerdict;
  inertReason?: CharaSlotInertReason;
  error?: { code: CharaSlotErrorCode; message: string };
  /** Raw palette index from the file */
  index: number | null;
  /** Index within the resolved sheet (light sheets subtract 128) */
  sheetIndex: number | null;
  /** Sheet variant for dark/light palettes */
  sheetVariant: 'dark' | 'light' | null;
  /** Grid address like "R6·C3" (8 columns), when the index resolved */
  gridAddress: string | null;
  /** Hex from the palette sheet, when the index resolved */
  indexHex: string | null;
  /** Hex from the extended float (gamma-encoded), when present */
  floatHex: string | null;
  /**
   * ΔE2000 between a live float and the colour the game stores for the index
   * (indexHex; a light lip's dark entry). Null when not judged — skin and hair
   * floats never are.
   */
  deltaE: number | null;
  /** Set when a float existed but was not live — the UI must say so */
  indexWinNote?: 'extendedMissing';
  /** Lip only: continuous opacity (null = not declared, ≠ 0) */
  alpha: number | null;
  /** Lip only: winning colour composited over the winning skin colour */
  blendHex: string | null;
}

export interface ResolvedGearDye {
  slot: CharaGearSlotId;
  channel: 1 | 2;
  stainId: number;
  /** Resolved dye, or null when the stain ID is unknown to the database */
  dye: Dye | null;
}

export interface ResolvedCharaCharacter {
  producer: string | null;
  race: ParsedCharaFile['race'];
  tribe: SubRace | null;
  gender: Gender | null;
  nickname: string | null;
  extendedValid: boolean;
  extendedDeclared: boolean;
  slots: ResolvedCharaSlot[];
  /** True when both eyes carry the same palette index — merge into one badge */
  eyesShareIndex: boolean;
  gearDyes: ResolvedGearDye[];
  /** Worn pieces' model keys (undyed included) — item names resolve off-device */
  gearModels: CharaGearModel[];
  /** Facewear `Glasses` sheet row; null when none */
  glassesId: number | null;
}

/** Minimal dye lookup the resolver needs (DyeService satisfies this). */
export interface StainIdLookup {
  getByStainId(stainId: number): Dye | null | undefined;
}

const GRID_COLUMNS = 8;

function gridAddress(sheetIndex: number): string {
  const row = Math.floor(sheetIndex / GRID_COLUMNS) + 1;
  const col = (sheetIndex % GRID_COLUMNS) + 1;
  return `R${row}·C${col}`;
}

function rgbToHex(rgb: { r: number; g: number; b: number }): string {
  return ColorConverter.rgbToHex(rgb.r, rgb.g, rgb.b);
}

function srgbToLinear(c: number): number {
  const n = c / 255;
  return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
}

function linearToSrgb255(c: number): number {
  const clamped = clamp(c, 0, 1);
  const encoded =
    clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
  return Math.round(clamp(encoded, 0, 1) * 255);
}

/** Composite `top` over `base` at `alpha`, in linear light. */
function compositeHex(topHex: string, baseHex: string, alpha: number): string {
  const top = ColorConverter.hexToRgb(topHex);
  const base = ColorConverter.hexToRgb(baseHex);
  const mix = (t: number, b: number): number =>
    linearToSrgb255(srgbToLinear(t) * alpha + srgbToLinear(b) * (1 - alpha));
  return ColorConverter.rgbToHex(mix(top.r, base.r), mix(top.g, base.g), mix(top.b, base.b));
}

/**
 * Eye floats pair with the index keys by name, but 4 of 157 heterochromia
 * files in the 2026-09-28 corpus store them crossed. All four are Brio's,
 * whose shader struct called the lower-offset eye colour `LeftEyeColor` until
 * its patch 7.5 update (2026-04-29) and `RightEyeColor` since, and a Brio file
 * carries no version to tell the two apart. Swap the two floats only when each
 * lands on the OTHER eye's palette entry and neither on its own: a custom
 * colour or a half match stays where the file put it.
 */
function uncrossEyeFloats(
  slots: CharaColorSlotRaw[],
  characterColors: CharacterColorService,
): CharaColorSlotRaw[] {
  const left = slots.find((s) => s.slot === 'leftEye');
  const right = slots.find((s) => s.slot === 'rightEye');
  if (!left?.float || !right?.float || left.index === null || right.index === null) return slots;
  if (left.index === right.index) return slots;
  const sheet = characterColors.getEyeColors();
  const lands = (index: number, float: CharaColorSlotRaw['float']): boolean => {
    const entry = sheet.find((c) => c.index === index);
    return (
      entry !== undefined &&
      float !== null &&
      ColorConverter.getDeltaE(entry.hex, rgbToHex(float), 'ciede2000') <= EYE_LANDS_DELTA_E2000
    );
  };
  const straight = lands(left.index, left.float) && lands(right.index, right.float);
  const crossed = lands(left.index, right.float) && lands(right.index, left.float);
  if (straight || !crossed) return slots;
  const swapped = (to: CharaColorSlotRaw, from: CharaColorSlotRaw): CharaColorSlotRaw => ({
    ...to,
    float: from.float,
    floatLinear: from.floatLinear,
  });
  return slots.map((s) =>
    s === left ? swapped(left, right) : s === right ? swapped(right, left) : s,
  );
}

/**
 * Slots whose stored float is a shading value, not the creator swatch, so it
 * cannot say whether the file is OFF GRID. `human.cmp` keeps both per clan
 * and gender (`Skin`/`Hair` for the shader, `SkinInterface`/`HairInterface`
 * for the creator — Penumbra.GameData `CmpData`); the sheets are the latter.
 * In the 2026-09-28 corpus the float is identical for a given
 * tribe/gender/index in every file, yet equals the swatch for no skin entry
 * (0 of 338) and almost no hair entry past index 31 — and the creator itself
 * confirms the sheet: Raen ♀ hair 42 reads RGB 255,220,152 (#FFDC98, the
 * sheet's value) while every file stores #E5D2AC for it.
 */
const SHADING_FLOAT_SLOTS: ReadonlySet<CharaSlotId> = new Set(['skin', 'hair']);

interface SheetResolution {
  sheet: CharacterColor[] | null;
  variant: 'dark' | 'light' | null;
  sheetIndex: number | null;
  error?: { code: CharaSlotErrorCode; message: string };
}

/**
 * Resolve the sheet + in-sheet index for a slot. Dark/light palettes apply
 * the one split rule: 0-95 dark, 128-223 light, 96-127 loud failure.
 */
async function resolveSheet(
  slot: CharaSlotId,
  index: number,
  parsed: ParsedCharaFile,
  characterColors: CharacterColorService,
): Promise<SheetResolution> {
  const splitRange = (
    dark: CharacterColor[],
    light: CharacterColor[],
    field: string,
  ): SheetResolution => {
    if (index >= 0 && index <= 95) {
      return { sheet: dark, variant: 'dark', sheetIndex: index };
    }
    if (index >= 128 && index <= 223) {
      return { sheet: light, variant: 'light', sheetIndex: index - 128 };
    }
    if (index >= 96 && index <= 127) {
      return {
        sheet: null,
        variant: null,
        sheetIndex: null,
        error: {
          code: 'midRangeIndex',
          message: `${field} index ${index} falls in the 96-127 gap between the dark (0-95) and light (128-223) ranges`,
        },
      };
    }
    return {
      sheet: null,
      variant: null,
      sheetIndex: null,
      error: {
        code: 'indexOutOfRange',
        message: `${field} index ${index} is outside the dark (0-95) and light (128-223) ranges`,
      },
    };
  };

  switch (slot) {
    case 'leftEye':
    case 'rightEye':
      return { sheet: characterColors.getEyeColors(), variant: null, sheetIndex: index };
    case 'highlights':
      return { sheet: characterColors.getHighlightColors(), variant: null, sheetIndex: index };
    case 'limbal':
      return { sheet: characterColors.getTattooColors(), variant: null, sheetIndex: index };
    case 'lip':
      return splitRange(
        characterColors.getLipColorsDark(),
        characterColors.getLipColorsLight(),
        'LipsToneFurPattern',
      );
    case 'facePaint':
      return splitRange(
        characterColors.getFacePaintColorsDark(),
        characterColors.getFacePaintColorsLight(),
        'FacePaintColor',
      );
    case 'hair':
    case 'skin': {
      if (!parsed.tribe || !parsed.gender) {
        return {
          sheet: null,
          variant: null,
          sheetIndex: null,
          error: {
            code: 'noTribe',
            message: `${slot} needs Tribe and Gender to resolve its race-specific sheet`,
          },
        };
      }
      const sheet =
        slot === 'hair'
          ? await characterColors.getHairColors(parsed.tribe, parsed.gender)
          : await characterColors.getSkinColors(parsed.tribe, parsed.gender);
      return { sheet, variant: null, sheetIndex: index };
    }
  }
}

/**
 * Resolve a parsed `.chara` file against the character colour sheets and
 * (optionally) the dye database for gear dye names.
 */
export async function resolveCharaColors(
  parsed: ParsedCharaFile,
  characterColors: CharacterColorService,
  dyeLookup?: StainIdLookup,
): Promise<ResolvedCharaCharacter> {
  const slots: ResolvedCharaSlot[] = [];

  for (const raw of uncrossEyeFloats(parsed.slots, characterColors)) {
    const kind = raw.slot === 'limbal' ? (parsed.race === 'AuRa' ? 'limbal' : 'tattoo') : raw.slot;
    const floatHex = raw.float ? rgbToHex(raw.float) : null;
    const floatLive = parsed.extendedValid && floatHex !== null;

    const base: ResolvedCharaSlot = {
      slot: raw.slot,
      kind,
      verdict: 'index',
      ...(raw.inertReason !== undefined ? { inertReason: raw.inertReason } : {}),
      index: raw.index,
      sheetIndex: null,
      sheetVariant: null,
      gridAddress: null,
      indexHex: null,
      floatHex,
      deltaE: null,
      alpha: raw.alpha,
      blendHex: null,
    };

    // Lip alpha 0 = no lip (absent ≠ 0 — an absent key leaves the index valid)
    if (raw.slot === 'lip' && raw.alpha === 0) {
      slots.push({ ...base, verdict: 'inert', inertReason: 'noLip' });
      continue;
    }

    if (!raw.indexActive) {
      // A fur-pattern lip can still hold a live colour → the OFF-GRID path.
      if (raw.inertReason === 'furPattern' && floatLive) {
        slots.push({ ...base, verdict: 'floatOnly' });
      } else {
        slots.push({ ...base, verdict: 'inert' });
      }
      continue;
    }

    if (raw.index === null) {
      slots.push(floatLive ? { ...base, verdict: 'floatOnly' } : { ...base, verdict: 'inert' });
      continue;
    }

    const resolution = await resolveSheet(raw.slot, raw.index, parsed, characterColors);
    if (resolution.error || !resolution.sheet || resolution.sheetIndex === null) {
      slots.push({
        ...base,
        verdict: 'error',
        ...(resolution.error ? { error: resolution.error } : {}),
      });
      continue;
    }

    const entry = resolution.sheet.find((c) => c.index === resolution.sheetIndex);
    if (!entry) {
      slots.push({
        ...base,
        verdict: 'error',
        sheetIndex: resolution.sheetIndex,
        sheetVariant: resolution.variant,
        error: {
          code: 'indexOutOfRange',
          message: `${raw.slot} index ${raw.index} has no entry in its ${resolution.sheet.length}-colour sheet`,
        },
      });
      continue;
    }

    const resolved: ResolvedCharaSlot = {
      ...base,
      sheetIndex: resolution.sheetIndex,
      sheetVariant: resolution.variant,
      gridAddress: gridAddress(resolution.sheetIndex),
      indexHex: entry.hex,
    };

    if (floatLive && floatHex && !SHADING_FLOAT_SLOTS.has(raw.slot)) {
      // A light-palette lip stores its DARK entry's colour (358 of 358 corpus
      // files), so that is what an unedited file's float agrees with.
      const storedHex =
        raw.slot === 'lip' && resolution.variant === 'light'
          ? (characterColors.getLipColorsDark().find((c) => c.index === resolution.sheetIndex)
              ?.hex ?? entry.hex)
          : entry.hex;
      const deltaE = ColorConverter.getDeltaE(storedHex, floatHex, 'ciede2000');
      resolved.deltaE = deltaE;
      resolved.verdict = deltaE > OFF_GRID_DELTA_E2000 ? 'offGrid' : 'index';
    } else {
      resolved.verdict = 'index';
      if (floatHex && !parsed.extendedValid) {
        // Float present but not live — the index wins and the UI says so.
        resolved.indexWinNote = 'extendedMissing';
      }
    }

    slots.push(resolved);
  }

  // Lip blend: winning lip colour composited over the winning skin colour.
  const lip = slots.find((s) => s.slot === 'lip');
  const skin = slots.find((s) => s.slot === 'skin');
  if (lip && skin && lip.alpha !== null && lip.alpha > 0) {
    const lipHex =
      lip.verdict === 'offGrid' || lip.verdict === 'floatOnly' ? lip.floatHex : lip.indexHex;
    const skinHex =
      skin.verdict === 'offGrid' || skin.verdict === 'floatOnly' ? skin.floatHex : skin.indexHex;
    if (lipHex && skinHex) {
      lip.blendHex = compositeHex(lipHex, skinHex, clamp(lip.alpha, 0, 1));
    }
  }

  const leftEye = slots.find((s) => s.slot === 'leftEye');
  const rightEye = slots.find((s) => s.slot === 'rightEye');

  return {
    producer: parsed.producer,
    race: parsed.race,
    tribe: parsed.tribe,
    gender: parsed.gender,
    nickname: parsed.nickname,
    extendedValid: parsed.extendedValid,
    extendedDeclared: parsed.extendedDeclared,
    slots,
    eyesShareIndex:
      leftEye?.index !== null && leftEye?.index !== undefined && leftEye.index === rightEye?.index,
    gearDyes: parsed.gearDyes.map((g) => ({
      ...g,
      dye: dyeLookup?.getByStainId(g.stainId) ?? null,
    })),
    gearModels: parsed.gearModels,
    glassesId: parsed.glassesId,
  };
}
