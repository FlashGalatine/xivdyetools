/**
 * `.chara` character-file parser — the 5.0 Swatch Matcher import.
 *
 * Rules measured across 112 sample files (design register, Swatch Matcher
 * 10A, confirmed):
 * - **Parse by key presence, never the declared `TypeName`** — producers
 *   (Anamnesis versions, Ktisis) write different key sets. `TypeName` is
 *   captured only to *show* the producer.
 * - **`REyeColor` holds the LEFT eye and `LEyeColor` the right** — crossed
 *   against the extended floats (`LeftEyeColor`/`RightEyeColor`); trust the
 *   extended naming. Never "fix" this by swapping — 16% of samples are
 *   heterochromia and a swap corrupts them silently.
 * - **Extended floats are linear RGB** — gamma-encode before use or every
 *   colour is wrong-but-plausible.
 * - **Flags gate live-looking data**: `EnableHighlights: false` inerts the
 *   highlight index (54% of samples, 47 of those with a live-looking index);
 *   `FacePaint: 0` inerts `FacePaintColor` (only 0 is load-bearing — values
 *   ≥128 exist, do not range-validate `FacePaint` itself).
 * - **`LipsToneFurPattern` is a fur-pattern enum on Hrothgar**, not a colour.
 * - **`MouthColor` alpha is a continuous opacity**: `0` = no lip; an absent
 *   key ≠ 0 (Ktisis omits it and the index stays valid).
 * - **`IsExtendedAppearanceValid` is unreliable** (declared in 16 of 96
 *   float-bearing files): the floats count as live only when it is present
 *   and true — a missing flag means the index wins, and the UI says so.
 * - **Gear dyes are stain IDs** (`DyeId`/`DyeId2` per slot, 0 = undyed; 35%
 *   of dyed channels are the second one).
 * - **Gear models are emitted beside the dyes** (`gearModels`): the
 *   `ModelBase`/`ModelVariant` pair (weapons add `ModelSet`) of every WORN
 *   slot — `ModelBase == 0` (weapons: `ModelSet == 0` too) is an empty slot
 *   and is skipped. `null` hand records (one Anamnesis file) are empty.
 *   `Glasses` is `{ GlassesId }` or, on Brio-era Ktisis, a bare integer —
 *   both are accepted; 0 = no facewear. Resolution to item names happens
 *   off-device (api-worker) — the parser only carries the keys.
 * - **Never read `Base64Image`.**
 * - An unrecognised tribe/race/gender fails loudly (name got vs expected),
 *   never an empty palette.
 */

import type { Gender, Race, RGB, SubRace } from '@xivdyetools/types';
import { AppError, ErrorCode } from '@xivdyetools/types';
import { clamp } from '../../utils/index.js';
import { isWornCharaModel, isCharaWeaponSlot, type CharaGearModel } from './chara-models.js';

/** Colour slots a `.chara` file can populate. */
export type CharaSlotId =
  'leftEye' | 'rightEye' | 'hair' | 'highlights' | 'skin' | 'limbal' | 'lip' | 'facePaint';

/** Equipment slots that can carry dye channels. */
export type CharaGearSlotId =
  | 'MainHand'
  | 'OffHand'
  | 'HeadGear'
  | 'Body'
  | 'Hands'
  | 'Legs'
  | 'Feet'
  | 'Ears'
  | 'Neck'
  | 'Wrists'
  | 'LeftRing'
  | 'RightRing';

export type CharaSlotInertReason = 'highlightsDisabled' | 'facePaintNone' | 'furPattern' | 'noLip';

export interface CharaColorSlotRaw {
  slot: CharaSlotId;
  /** Raw palette index; null = key absent from the file */
  index: number | null;
  /** False when a flag gates the index off (see inertReason) */
  indexActive: boolean;
  inertReason?: CharaSlotInertReason;
  /** Extended float colour, gamma-encoded to sRGB; null = key absent */
  float: RGB | null;
  /** The raw linear-RGB float triple as stored in the file */
  floatLinear: [number, number, number] | null;
  /** Lip only: continuous opacity. null = key absent (absent ≠ 0) */
  alpha: number | null;
}

export interface CharaGearDye {
  slot: CharaGearSlotId;
  /** Which dye channel (1 = DyeId, 2 = DyeId2) */
  channel: 1 | 2;
  /** Stain ID as stored (1-254); 0/undyed channels are not emitted */
  stainId: number;
}

export interface ParsedCharaFile {
  /** Declared producer (`TypeName`), shown in UI — never used for parsing */
  producer: string | null;
  race: Race | null;
  tribe: SubRace | null;
  /** The tribe string exactly as the file spelled it */
  tribeRaw: string | null;
  gender: Gender | null;
  /**
   * Ktisis nickname. On-device display only (a file card label): players use
   * their real name here, so it is never a card or embed title and never the
   * default for a name that can be published — the bot strips it before a
   * record leaves `executeSwatch` (discord-worker PRIVACY_POLICY §3) and the
   * web-app never pre-fills the community palette name with it.
   */
  nickname: string | null;
  /** True only when IsExtendedAppearanceValid is present AND true */
  extendedValid: boolean;
  /** Whether the IsExtendedAppearanceValid key was present at all */
  extendedDeclared: boolean;
  slots: CharaColorSlotRaw[];
  /** Dyed gear channels only (stainId > 0), in file slot order */
  gearDyes: CharaGearDye[];
  /** Worn pieces only (model base > 0), in file slot order — undyed pieces included */
  gearModels: CharaGearModel[];
  /** Facewear `Glasses` sheet row; null when none / absent */
  glassesId: number | null;
}

const GEAR_SLOTS: readonly CharaGearSlotId[] = [
  'MainHand',
  'OffHand',
  'HeadGear',
  'Body',
  'Hands',
  'Legs',
  'Feet',
  'Ears',
  'Neck',
  'Wrists',
  'LeftRing',
  'RightRing',
];

/** File tribe spellings → SubRace. Files use the game's plural "Helions". */
const TRIBE_MAP: Record<string, SubRace> = {
  Midlander: 'Midlander',
  Highlander: 'Highlander',
  Wildwood: 'Wildwood',
  Duskwight: 'Duskwight',
  Plainsfolk: 'Plainsfolk',
  Dunesfolk: 'Dunesfolk',
  SeekerOfTheSun: 'SeekerOfTheSun',
  KeeperOfTheMoon: 'KeeperOfTheMoon',
  SeaWolf: 'SeaWolf',
  Hellsguard: 'Hellsguard',
  Raen: 'Raen',
  Xaela: 'Xaela',
  Helions: 'Helions',
  // Pre-5.0 identifier — accepted on read, stored as the game's plural
  Helion: 'Helions',
  TheLost: 'TheLost',
  Rava: 'Rava',
  Veena: 'Veena',
};

/** File race spellings → Race (Anamnesis serializes "Miqote" and "AuRa"). */
const RACE_MAP: Record<string, Race> = {
  Hyur: 'Hyur',
  Elezen: 'Elezen',
  Lalafell: 'Lalafell',
  Miqote: "Miqo'te",
  "Miqo'te": "Miqo'te",
  Roegadyn: 'Roegadyn',
  AuRa: 'AuRa',
  Hrothgar: 'Hrothgar',
  Viera: 'Viera',
};

const GENDER_MAP: Record<string, Gender> = {
  Masculine: 'Male',
  Feminine: 'Female',
  Male: 'Male',
  Female: 'Female',
};

/** Linear-light → sRGB gamma encoding, clamped, 0-255. */
function linearToSrgb255(c: number): number {
  const clamped = clamp(c, 0, 1);
  const encoded =
    clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
  return Math.round(clamp(encoded, 0, 1) * 255);
}

interface ParsedFloat {
  srgb: RGB;
  linear: [number, number, number];
  alpha: number | null;
}

/**
 * Parse an extended-appearance float string ("r, g, b" or "r, g, b, a",
 * linear RGB). Throws loudly on a malformed value — a wrong-but-plausible
 * colour is worse than a failure that names the field.
 */
function parseFloatColor(field: string, value: unknown): ParsedFloat | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') {
    throw new AppError(
      ErrorCode.INVALID_INPUT,
      `.chara field ${field}: expected a comma-separated float string, got ${typeof value}`,
      'error',
    );
  }
  const parts = value.split(',').map((p) => Number(p.trim()));
  if ((parts.length !== 3 && parts.length !== 4) || parts.some((n) => Number.isNaN(n))) {
    throw new AppError(
      ErrorCode.INVALID_INPUT,
      `.chara field ${field}: unparseable float colour "${value}"`,
      'error',
    );
  }
  const [r, g, b] = parts;
  return {
    srgb: { r: linearToSrgb255(r), g: linearToSrgb255(g), b: linearToSrgb255(b) },
    linear: [r, g, b],
    alpha: parts.length === 4 ? parts[3] : null,
  };
}

/**
 * Every character colour field — the eight palette indices plus the extended
 * appearance floats. Presence of at least one is what makes a JSON document
 * a `.chara` file; an extended-only file (floats, no indices) is legitimate
 * and resolves as `floatOnly`. See the key-presence rule in `parseCharaFile`.
 */
const COLOR_KEYS = [
  'REyeColor',
  'LEyeColor',
  'HairTone',
  'Highlights',
  'Skintone',
  'LimbalEyes',
  'LipsToneFurPattern',
  'FacePaintColor',
  'SkinColor',
  'LeftEyeColor',
  'RightEyeColor',
  'LimbalRingColor',
  'HairColor',
  'HairHighlight',
  'MouthColor',
] as const;

function readIndex(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new AppError(
      ErrorCode.INVALID_INPUT,
      `.chara field ${key}: expected a numeric palette index, got ${JSON.stringify(value)}`,
      'error',
    );
  }
  return value;
}

function mapNamed<T>(
  table: Record<string, T>,
  field: string,
  value: unknown,
): { mapped: T | null; raw: string | null } {
  if (value === null || value === undefined) return { mapped: null, raw: null };
  if (typeof value !== 'string') {
    throw new AppError(
      ErrorCode.INVALID_INPUT,
      `.chara field ${field}: expected a string, got ${typeof value}`,
      'error',
    );
  }
  // FINDING-027 (2026-08-21 audit): own-property lookup only — `table[value]`
  // on a plain object literal let "constructor" / "__proto__" / "toString"
  // pass validation with a Function or Object.prototype as the mapped value
  const mapped = Object.hasOwn(table, value) ? table[value] : undefined;
  if (mapped === undefined) {
    throw new AppError(
      ErrorCode.INVALID_INPUT,
      `.chara field ${field}: unrecognised value "${value}" (expected one of: ${Object.keys(table).join(', ')})`,
      'error',
    );
  }
  return { mapped, raw: value };
}

/**
 * Parse a `.chara` file's text content. Structural problems (invalid JSON,
 * unrecognised tribe/race/gender, malformed colour values) throw AppError
 * naming field and value; per-slot range problems are left to the resolver,
 * which reports them as loud slot states.
 */
export function parseCharaFile(text: string): ParsedCharaFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new AppError(ErrorCode.INVALID_INPUT, '.chara file is not valid JSON', 'error');
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new AppError(ErrorCode.INVALID_INPUT, '.chara file is not a JSON object', 'error');
  }
  const record = data as Record<string, unknown>;

  // Identity fields first: a file that names a bad tribe deserves that
  // message, not the generic refusal below.
  const { mapped: race } = mapNamed(RACE_MAP, 'Race', record['Race']);
  const { mapped: tribe, raw: tribeRaw } = mapNamed(TRIBE_MAP, 'Tribe', record['Tribe']);
  const { mapped: gender } = mapNamed(GENDER_MAP, 'Gender', record['Gender']);

  // Parse by key presence: a JSON carrying no colour field at all is some
  // other document that happens to be JSON, not a sparse character. Refuse
  // it rather than resolving eight dashed slots that read as a valid
  // character wearing nothing.
  if (!COLOR_KEYS.some((key) => key in record)) {
    throw new AppError(
      ErrorCode.INVALID_INPUT,
      `.chara file carries no character colour fields (expected at least one of: ${COLOR_KEYS.join(', ')})`,
      'error',
    );
  }

  const extendedDeclared = 'IsExtendedAppearanceValid' in record;
  const extendedValid = record['IsExtendedAppearanceValid'] === true;

  const isHrothgar = race === 'Hrothgar';
  const enableHighlights = record['EnableHighlights'] !== false;
  const facePaintValue = readIndex(record, 'FacePaint');
  const facePaintNone = facePaintValue === 0;

  const skinFloat = parseFloatColor('SkinColor', record['SkinColor']);
  // Crossed keys: the index REyeColor pairs with the float LeftEyeColor.
  const leftEyeFloat = parseFloatColor('LeftEyeColor', record['LeftEyeColor']);
  const rightEyeFloat = parseFloatColor('RightEyeColor', record['RightEyeColor']);
  const limbalFloat = parseFloatColor('LimbalRingColor', record['LimbalRingColor']);
  const hairFloat = parseFloatColor('HairColor', record['HairColor']);
  const highlightFloat = parseFloatColor('HairHighlight', record['HairHighlight']);
  const mouthFloat = parseFloatColor('MouthColor', record['MouthColor']);

  const slot = (
    id: CharaSlotId,
    index: number | null,
    float: ParsedFloat | null,
    options: {
      indexActive?: boolean;
      inertReason?: CharaSlotInertReason;
      alpha?: number | null;
    } = {},
  ): CharaColorSlotRaw => ({
    slot: id,
    index,
    indexActive: options.indexActive ?? true,
    ...(options.inertReason !== undefined ? { inertReason: options.inertReason } : {}),
    float: float?.srgb ?? null,
    floatLinear: float?.linear ?? null,
    alpha: options.alpha !== undefined ? options.alpha : null,
  });

  const slots: CharaColorSlotRaw[] = [
    slot('leftEye', readIndex(record, 'REyeColor'), leftEyeFloat),
    slot('rightEye', readIndex(record, 'LEyeColor'), rightEyeFloat),
    slot('hair', readIndex(record, 'HairTone'), hairFloat),
    slot('highlights', readIndex(record, 'Highlights'), highlightFloat, {
      indexActive: enableHighlights,
      ...(enableHighlights ? {} : { inertReason: 'highlightsDisabled' as const }),
    }),
    slot('skin', readIndex(record, 'Skintone'), skinFloat),
    slot('limbal', readIndex(record, 'LimbalEyes'), limbalFloat),
    slot('lip', readIndex(record, 'LipsToneFurPattern'), mouthFloat, {
      // On Hrothgar the key is a fur-pattern enum, not a colour index.
      indexActive: !isHrothgar,
      ...(isHrothgar ? { inertReason: 'furPattern' as const } : {}),
      alpha: mouthFloat ? mouthFloat.alpha : null,
    }),
    slot('facePaint', readIndex(record, 'FacePaintColor'), null, {
      indexActive: !facePaintNone,
      ...(facePaintNone ? { inertReason: 'facePaintNone' as const } : {}),
    }),
  ];

  const gearDyes: CharaGearDye[] = [];
  const gearModels: CharaGearModel[] = [];
  for (const gearSlot of GEAR_SLOTS) {
    const gear = record[gearSlot];
    if (typeof gear !== 'object' || gear === null) continue;
    const gearRecord = gear as Record<string, unknown>;
    for (const [channel, key] of [
      [1, 'DyeId'],
      [2, 'DyeId2'],
    ] as const) {
      const value = gearRecord[key];
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        gearDyes.push({ slot: gearSlot, channel, stainId: value });
      }
    }
    const set = readModelLane(gearRecord['ModelSet']);
    const base = readModelLane(gearRecord['ModelBase']);
    const variant = readModelLane(gearRecord['ModelVariant']);
    if (isWornCharaModel(gearSlot, set, base)) {
      gearModels.push(
        isCharaWeaponSlot(gearSlot)
          ? { slot: gearSlot, set, base, variant }
          : { slot: gearSlot, base, variant },
      );
    }
  }

  return {
    producer: typeof record['TypeName'] === 'string' ? record['TypeName'] : null,
    race,
    tribe,
    tribeRaw,
    gender,
    nickname: typeof record['Nickname'] === 'string' ? record['Nickname'] : null,
    extendedValid,
    extendedDeclared,
    slots,
    gearDyes,
    gearModels,
    glassesId: readGlassesId(record['Glasses']),
  };
}

/** A model lane is a non-negative integer; anything else reads as 0 (empty). */
function readModelLane(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
}

/**
 * `Glasses` is `{ GlassesId: n }` (Anamnesis, Ktisis) or a bare integer
 * (Brio-era "Ktisis/Anamnesis Character File"). Row 0 is "none".
 */
function readGlassesId(value: unknown): number | null {
  const raw =
    typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)['GlassesId']
      : value;
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : null;
}
