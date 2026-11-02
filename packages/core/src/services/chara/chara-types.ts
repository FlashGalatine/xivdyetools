/** Shared live contracts for the .chara import facade and compatibility APIs. */

import type { Dye, Gender, Race, SubRace } from '@xivdyetools/types';
import type { CharaGearModel } from './chara-models.js';

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
   * (the shader half of `human.cmp` — not `indexHex`, the swatch). Null when
   * the float is absent or not live.
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
  race: Race | null;
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
