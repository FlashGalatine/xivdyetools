/**
 * Pure resolution rules — no I/O. Given the rows XIVAPI returned (or the
 * cache replayed) for each (slot column, model key), decide what each
 * requested slot IS.
 *
 * Rules (docs/research/chara-equipment-resolution §5, encoded as tests):
 * - The slot column is part of the key: a gear set shares one `ModelMain`
 *   across head/body/hands/legs/feet, and rings carry both FingerL+FingerR.
 * - Ambiguity is a feature of the data: 35% of keys are families of visually
 *   identical items (Augmented / Replica / +1 / role variants). The lowest
 *   row_id names the row; the rest ride along as alternates. Never strip
 *   prefixes — the naming is inconsistent across languages.
 * - Off-hands resolve THROUGH the main hand: if the off-hand key equals the
 *   main-hand item's `ModelSub` (quiver, focus, fist pair…) or the main-hand
 *   key itself (Anamnesis sometimes writes MainHand twice), it IS the main
 *   weapon. Only then is a genuine `OffHand` lookup used (shields). Never
 *   search ModelSub first — one aetherotransformer key matches 347 guns.
 * - No rows → `null` ("no item row"), never an error.
 * - ko/zh merge from the build-time tables, EN fallback per item by omission.
 */

import { CHARA_SLOT_SEARCH_FIELD, charaModelKey } from '@xivdyetools/core';
import type {
  CharaGearModel,
  CharaGearSlotId,
  CharaResolveRequest,
  CharaResolveResponse,
  GlassesRow,
  ItemNames,
  ItemRow,
  ResolvedCharaItem,
  ResolvedGlasses,
  SlotLookup,
} from './types.js';
import { lookupKey } from './types.js';
import { regionalNames } from './regional-names.js';

/** Alternates carried per row — the badge says `+N`; the tooltip lists these. */
export const MAX_ALTERNATES = 8;

/** The (column, key) search units a request needs — one per worn slot, deduped. */
export function lookupsFor(gear: readonly CharaGearModel[]): SlotLookup[] {
  const seen = new Set<string>();
  const out: SlotLookup[] = [];
  for (const model of gear) {
    const l = { field: CHARA_SLOT_SEARCH_FIELD[model.slot], key: charaModelKey(model) };
    const id = lookupKey(l);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(l);
  }
  return out;
}

/**
 * Re-associate a batched search result to its lookups: a row belongs to
 * every (column, ModelMain) pair it satisfies — ring rows land under both
 * FingerL and FingerR.
 */
export function indexRows(rows: readonly ItemRow[]): Map<string, ItemRow[]> {
  const index = new Map<string, ItemRow[]>();
  for (const row of rows) {
    for (const field of row.slots) {
      const id = lookupKey({ field, key: row.modelMain });
      const list = index.get(id) ?? [];
      list.push(row);
      index.set(id, list);
    }
  }
  return index;
}

function withRegional(rowId: number, names: ItemRow['names']): ItemNames {
  return { ...names, ...regionalNames(rowId) };
}

/** Lowest row_id names the item; the rest are alternates, row_id ascending. */
export function pickItem(rows: readonly ItemRow[]): ResolvedCharaItem | null {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => a.rowId - b.rowId);
  const primary = sorted[0];
  return {
    itemId: primary.rowId,
    names: withRegional(primary.rowId, primary.names),
    iconId: primary.iconId,
    familySize: sorted.length,
    alternates: sorted
      .slice(1, 1 + MAX_ALTERNATES)
      .map((r) => ({ itemId: r.rowId, names: withRegional(r.rowId, r.names) })),
    viaMainHand: false,
  };
}

export function pickGlasses(row: GlassesRow | null): ResolvedGlasses | null {
  if (!row) return null;
  return { id: row.rowId, names: { ...row.names }, iconId: row.iconId };
}

export type RowSource = (lookup: SlotLookup) => readonly ItemRow[];

/**
 * Resolve every requested slot from a row source (cache + upstream merged by
 * the route). Pure: same inputs, same answer.
 */
export function resolveCharaEquipment(
  request: CharaResolveRequest,
  rowsFor: RowSource,
  glassesRow: GlassesRow | null | undefined,
  version: string | null,
): CharaResolveResponse {
  const items: CharaResolveResponse['items'] = {};

  const main = request.gear.find((m) => m.slot === 'MainHand');
  const mainKey = main ? charaModelKey(main) : null;
  const mainRows = main ? rowsFor({ field: CHARA_SLOT_SEARCH_FIELD.MainHand, key: mainKey! }) : [];
  const mainItem = pickItem(mainRows);

  for (const model of request.gear) {
    const slot: CharaGearSlotId = model.slot;
    if (slot === 'MainHand') {
      items.MainHand = mainItem;
      continue;
    }
    const key = charaModelKey(model);
    if (slot === 'OffHand') {
      const pairedWithMain =
        mainItem !== null &&
        (key === mainKey || mainRows.some((r) => r.modelSub === key));
      items.OffHand = pairedWithMain
        ? { ...mainItem, viaMainHand: true }
        : pickItem(rowsFor({ field: CHARA_SLOT_SEARCH_FIELD.OffHand, key }));
      continue;
    }
    items[slot] = pickItem(rowsFor({ field: CHARA_SLOT_SEARCH_FIELD[slot], key }));
  }

  const response: CharaResolveResponse = { version, items };
  if (glassesRow !== undefined) response.glasses = pickGlasses(glassesRow);
  return response;
}
