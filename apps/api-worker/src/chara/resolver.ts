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
 *   eligible row_id with an acquisition line names the row, else the lowest
 *   eligible row_id; the rest ride along as alternates, the lowest row always
 *   among them when it is not the named one.
 *   Unobtainable English item families are filtered before naming or checks;
 *   a family with nothing else is still named, from every row, as `retired`.
 * - Off-hands resolve THROUGH the main hand: if the off-hand key equals the
 *   main-hand item's `ModelSub` (quiver, focus, fist pair…) or the main-hand
 *   key itself (Anamnesis sometimes writes MainHand twice), it IS the main
 *   weapon. Only then is a genuine `OffHand` lookup used (shields). Never
 *   search ModelSub first — one aetherotransformer key matches 347 guns.
 * - No rows → `null` ("no item row"), never an error. Retired rows alone are
 *   not "no rows": they name the item, flagged `retired`.
 * - ko/zh merge from the build-time tables, EN fallback per item by omission.
 */

import { CHARA_SLOT_SEARCH_FIELD, charaModelKey, groupCharaTwinRules } from '@xivdyetools/core';
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
import { acquisitionFor, facewearAcquisitionFor } from './acquisition.js';

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

/** The build-time acquisition line as an optional field: absent, never empty. */
function withAcquisition(rowId: number): { acquisition?: string } {
  const acquisition = acquisitionFor(rowId);
  return acquisition ? { acquisition } : {};
}

/** English client names identify retired families regardless of display language. */
function selectableItem(row: ItemRow): boolean {
  if (/^(Aetherial|Deepmist)\b/.test(row.names.en)) return false;
  return !(/^Dated\b/.test(row.names.en) && row.levelEquip !== null && row.levelEquip <= 50);
}

/**
 * The rows that name a family: its eligible rows, or — when every row is
 * retired — all of them, flagged. The player is wearing a real item either
 * way, so a retired family is named rather than answered as "no item row"
 * (2026-10-09 merge-day review). Off-hand pairing reads the same set.
 */
function namingRows(rows: readonly ItemRow[]): { rows: ItemRow[]; retired: boolean } {
  const eligible = rows.filter(selectableItem);
  if (eligible.length > 0 || rows.length === 0) return { rows: eligible, retired: false };
  return { rows: [...rows], retired: true };
}

/**
 * The lowest naming row that has an acquisition line names the item, else the
 * lowest naming row: a blank line means no current route is known (old
 * non-Augmented tomestone gear is no longer sold), so the family is named by a
 * twin the player can still get (2026-10-11). The rest are alternates, row_id
 * ascending. The rule set holding the named twin comes first.
 *
 * The capped alternates always carry the family's lowest row when it is not
 * the named one, so a client can key the family by min(itemId, alternates)
 * even after a patch moves the name. Next come the lowest row of every rule
 * set, because the in-game rules cover the WHOLE family and a twin that passes
 * the check must be one the reader can name, however many Dated rows sort
 * ahead of it; the rest fill in row order. Each carries its own acquisition
 * line: the Glamour Reader lets the player name any twin, and the line must
 * match the name it sits under.
 */
export function pickItem(rows: readonly ItemRow[]): ResolvedCharaItem | null {
  const naming = namingRows(rows);
  const sorted = naming.rows.sort((a, b) => a.rowId - b.rowId);
  if (sorted.length === 0) return null;
  const primary = sorted.find((r) => acquisitionFor(r.rowId)) ?? sorted[0];
  const grouped = groupCharaTwinRules(
    sorted.map((r) => ({ rowId: r.rowId, rules: r.rules ?? null })),
  );
  // Keep "the first set holds itemId" true when a higher twin is named.
  const front = grouped.filter((g) => g.itemIds.includes(primary.rowId));
  const rules = [...front, ...grouped.filter((g) => !front.includes(g))];
  const chosen = new Set<number>();
  const choose = (id: number): void => {
    if (id !== primary.rowId && chosen.size < MAX_ALTERNATES) chosen.add(id);
  };
  choose(sorted[0].rowId);
  for (const g of rules) choose(g.itemIds[0]);
  for (const r of sorted) choose(r.rowId);
  return {
    itemId: primary.rowId,
    names: withRegional(primary.rowId, primary.names),
    iconId: primary.iconId,
    familySize: sorted.length,
    alternates: sorted
      .filter((r) => chosen.has(r.rowId))
      .map((r) => ({
        itemId: r.rowId,
        names: withRegional(r.rowId, r.names),
        ...withAcquisition(r.rowId),
      })),
    viaMainHand: false,
    rules,
    ...withAcquisition(primary.rowId),
    ...(naming.retired ? { retired: true as const } : {}),
  };
}

export function pickGlasses(row: GlassesRow | null): ResolvedGlasses | null {
  if (!row) return null;
  const acquisition = facewearAcquisitionFor(row.rowId);
  return {
    id: row.rowId,
    names: { ...row.names },
    iconId: row.iconId,
    ...(acquisition ? { acquisition } : {}),
  };
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
        (key === mainKey || namingRows(mainRows).rows.some((r) => r.modelSub === key));
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
