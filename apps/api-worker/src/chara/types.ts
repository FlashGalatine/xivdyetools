/**
 * `/v1/chara/*` — shapes shared by the router, the resolver and the cache.
 *
 * The request carries only model keys (twelve small integers plus the
 * facewear row) — nothing else from the `.chara` file. The response is one
 * entry per requested slot: the lowest-row_id item on that (slot, model key),
 * its names in six languages, its icon id, and the family of visually
 * identical alternates that share the mesh.
 */

import type {
  CharaGearModel,
  CharaGearSlotId,
  CharaItemRules,
  CharaTwinRules,
} from '@xivdyetools/core';

export type { CharaGearModel, CharaGearSlotId, CharaItemRules, CharaTwinRules };

/** en/ja/de/fr come from XIVAPI in the same call; ko/zh merge from the build-time tables when known. */
export interface ItemNames {
  en: string;
  ja: string;
  de: string;
  fr: string;
  ko?: string;
  zh?: string;
}

export interface ResolvedCharaItem {
  /** Item sheet row_id — the lowest in the family */
  itemId: number;
  names: ItemNames;
  /** Icon sheet id for `GET /v1/chara/icon/:iconId`; null when the row has none */
  iconId: number | null;
  /** Number of Item rows sharing this (slot, model key) — 1 = unique */
  familySize: number;
  /** The other family members, row_id ascending (capped — see MAX_ALTERNATES) */
  alternates: Array<{ itemId: number; names: ItemNames }>;
  /**
   * OffHand only: true when the off-hand model is the main-hand item's own
   * ModelSub (quiver, focus, fist pair…) — the row is the main weapon, not a
   * separate item.
   */
  viaMainHand: boolean;
  /**
   * What the game allows, as the family's distinct rule sets: dye channels,
   * glamour flag, race/gender lock, Grand Company. The first set holds
   * `itemId`. `[]` when XIVAPI did not return the fields. The browser checks
   * these against the file's dyes and character, which never reach us.
   */
  rules: CharaTwinRules[];
}

export interface ResolvedGlasses {
  /** Glasses sheet row_id */
  id: number;
  names: ItemNames;
  iconId: number | null;
}

export interface CharaResolveRequest {
  gear: CharaGearModel[];
  /** Glasses sheet row; omitted/0 = no facewear */
  glasses?: number;
}

export interface CharaResolveResponse {
  /** XIVAPI game-version key the upstream answered with (null when fully served from cache) */
  version: string | null;
  /** Requested slots only. `null` = the key has no Item row (NPC / prop model). */
  items: Partial<Record<CharaGearSlotId, ResolvedCharaItem | null>>;
  /** Present only when the request carried a glasses row */
  glasses?: ResolvedGlasses | null;
}

/**
 * One Item row as cached per (slot field, model key) — trimmed to what the
 * resolver needs. `modelMain` / `modelSub` are decimal strings (weapon values
 * exceed 2^32; strings keep cache entries and wire keys identical).
 */
export interface ItemRow {
  rowId: number;
  names: Pick<ItemNames, 'en' | 'ja' | 'de' | 'fr'>;
  iconId: number | null;
  modelMain: string;
  modelSub: string;
  /** EquipSlotCategory columns set to 1 on this row (rings carry FingerL + FingerR) */
  slots: string[];
  /** The in-game rules; null when the answer lacked any of their fields */
  rules: CharaItemRules | null;
}

export interface GlassesRow {
  rowId: number;
  names: Pick<ItemNames, 'en' | 'ja' | 'de' | 'fr'>;
  iconId: number | null;
}

/** One (EquipSlotCategory column, packed ModelMain) search unit. */
export interface SlotLookup {
  field: string;
  key: string;
}

export const lookupKey = (l: SlotLookup): string => `${l.field}:${l.key}`;
