/**
 * The glamour list's data — what the GPOSERS list says for each worn piece.
 *
 * `glamour-block` hands over what it knows (the resolved file, the equipment
 * answer, the twin each row names) as plain data; this builds the template
 * input and the export sheet's rows (`glamour-sheet`, design 2c). Loaded on
 * demand with the sheet: nothing here is needed until someone asks for the list.
 *
 * @module components/glamour-list-actions
 */

import {
  charaModelKey,
  gposersOmittedSlots,
  gposersSameRings,
  type GposersSlotFacts,
  type ImportedCharaCharacter,
  type CharaGearSlotId,
} from '@xivdyetools/core';
import { LanguageService } from '@services/index';
import {
  itemNameFor,
  type CharaItemNames,
  type CharaResolveResult,
} from '@services/chara-resolve-service';
import { localizedDyeName } from '@shared/dye-name';
import {
  GLAMOUR_MARKDOWN_SLOTS,
  glamourSlotLabel,
  type GlamourMarkdownInput,
  type GlamourMarkdownPiece,
  type GlamourMarkdownSlot,
} from '@shared/glamour-markdown';
import { gearHash } from '@shared/acquisition-edits';

/** What the component knows when a button is clicked. */
export interface GlamourListSource {
  /**
   * Only the gear the list is built from, plus the gender the in-game slot
   * rules need. Nothing else of the file (labels, appearance, diagnostics)
   * can reach a glamour list.
   */
  resolved: Pick<ImportedCharaCharacter, 'gearDyes' | 'gearModels' | 'glassesId' | 'gender'>;
  /** api-worker's answer, or null before it lands / when it never did. */
  equipment: CharaResolveResult | null;
  /**
   * The twin the Glamour Reader names per slot (it may differ from the lowest
   * row), with its own acquisition line and, when the answer has rules, its
   * dye channel count. Absent = the resolved item.
   */
  picked?: Partial<
    Record<
      CharaGearSlotId,
      { itemId: number; names: CharaItemNames; acquisition?: string; dyeCount?: number }
    >
  >;
}

/** One row of the export sheet (design 2c). */
export interface GlamourSheetPiece {
  slot: GlamourMarkdownSlot;
  /** The template's label ("Main Hand") */
  label: string;
  name: string | null;
  /** Dye names in channel order, dyed channels only */
  dyes: string[];
  /** The generated GPOSERS line for the named twin; null = none known */
  generated: string | null;
  /** The gear's key for a device-kept edit (the model's, when the piece has no item) */
  hash: string;
  /**
   * The edit keys this row answers for: its own `hash`, and on a merged Rings row
   * the other ring's too. A twin pick can merge or split the pair, and the row
   * has to answer for both rings either way. The model's key is here as well, for
   * a line typed while the names lookup was down: with the names landed it no
   * longer shows, but it is still stored. The reverse cannot be done: with the
   * lookup down, nothing says which family's key to delete.
   */
  editKeys: string[];
  /**
   * The keys this row's switch covers, one per ring as `editKeys` is. Each is the
   * outfit's signature and the piece's model key, both from the file alone: a
   * switch belongs to this outfit, and the names lookup landing or failing moves
   * `hash` and must not turn a piece back on.
   */
  offKeys: string[];
  /** The twin the list names now */
  pickedItemId: number | null;
  pickedName: string | null;
}

/**
 * What the file and the resolve know, slot by slot. Names are the same
 * `itemNameFor` the rows show; a slot with no item (NPC model, unresolved,
 * unavailable) is left nameless rather than given the model key, which means
 * nothing on a submission form. Dyes are per channel, so a piece dyed only on
 * channel 2 keeps channel 1 blank; an unknown stain writes `#id`, as the rows
 * do. Facewear is worn whenever the file declares a Glasses row; it names
 * from the resolved row when there is one, and like any other worn piece
 * keeps its slot bare when there is not. The file carries no tint, and the
 * builder writes no dye line for it anyway.
 *
 * Only worn slots get an entry — the builder writes nothing for the rest.
 * Two kinds of worn slot are left out on purpose (core's
 * `gposersOmittedSlots`): invisible pieces, which a submission has nothing to
 * say about, and an Off Hand under a main hand that does not take one. An Off
 * Hand the resolve answers as the main hand's own model (`viaMainHand`) is
 * left out too, as the bot does. All of it is decided from the resolve's
 * answer, so nothing is dropped on a guess:
 * before it lands nothing is omitted, a slot it could not name is never taken
 * for invisible, and an Off Hand stays when the main hand's category is
 * unknown. The reader's own rows are built elsewhere and keep every piece.
 */
export function glamourMarkdownInput({
  resolved,
  equipment,
  picked,
}: GlamourListSource): GlamourMarkdownInput {
  const lang = LanguageService.getCurrentLocale();
  const input: GlamourMarkdownInput = {};
  const pieceFor = (slot: CharaGearSlotId): GlamourMarkdownPiece => {
    const piece = input[slot] ?? {};
    input[slot] = piece;
    return piece;
  };

  for (const model of resolved.gearModels) {
    const item = equipment?.items[model.slot];
    const piece = pieceFor(model.slot);
    const pick = picked?.[model.slot];
    if (pick && !piece.name) piece.name = itemNameFor(pick.names, lang);
    else if (item && !piece.name) piece.name = itemNameFor(item.names, lang);
    if (pick?.dyeCount !== undefined) piece.dyeSlots = pick.dyeCount;
  }
  for (const gear of resolved.gearDyes) {
    const piece = pieceFor(gear.slot);
    const text = gear.dye ? localizedDyeName(gear.dye) : `#${gear.stainId}`;
    if (gear.channel === 1) piece.dye1 = text;
    else piece.dye2 = text;
  }

  if (resolved.glassesId !== null && resolved.glassesId > 0) {
    const glasses = equipment?.glasses ?? null;
    input.Facewear = {
      name: glasses ? itemNameFor(glasses.names, lang) : null,
      acquisition: glasses?.acquisition,
    };
  }

  // Every name in a slot's family decides invisibility; a slot with no item has
  // no facts and so is never dropped for it
  const facts: Partial<Record<CharaGearSlotId, GposersSlotFacts>> = {};
  for (const model of resolved.gearModels) {
    const item = equipment?.items[model.slot];
    facts[model.slot] = item
      ? { familyEn: [item.names.en, ...item.alternates.map((a) => a.names.en)] }
      : {};
  }
  const omitted = gposersOmittedSlots(facts, {
    gender: resolved.gender,
    mainHandUiCategory: equipment?.items.MainHand?.uiCategory ?? null,
  });
  for (const slot of omitted) delete input[slot as CharaGearSlotId];
  // An Off Hand answered as the main hand's own model (a tool's sub-model, a
  // quiver, a focus) is the same weapon twice; the bot skips it the same way
  if (equipment?.items.OffHand?.viaMainHand === true) delete input.OffHand;
  return input;
}

/** The dyes on a worn slot, in channel order. */
function slotDyes(source: GlamourListSource, slot: GlamourMarkdownSlot) {
  return source.resolved.gearDyes
    .filter((gear) => gear.slot === slot)
    .sort((a, b) => a.channel - b.channel);
}

/** The stains on a worn slot, in channel order. */
function slotStains(source: GlamourListSource, slot: GlamourMarkdownSlot): number[] {
  return slotDyes(source, slot).map((gear) => gear.stainId);
}

/**
 * The key for a piece by what the file says alone: its model instead of the
 * family's row. It files what the player types on a piece with no item behind it
 * (the resolve failed, or the model has no Item row), like any other edit, and it
 * makes up the off switches' keys (`outfitSignature`), since it reads the same
 * before and after the resolve. Twins share a model, so a twin pick keeps it.
 */
function modelHash(source: GlamourListSource, slot: GlamourMarkdownSlot): string {
  const stains = slotStains(source, slot);
  if (slot === 'Facewear')
    return gearHash('Facewear@glasses', source.resolved.glassesId ?? 0, stains);
  const model = source.resolved.gearModels.find((m) => m.slot === slot);
  return gearHash(`${slot}@${model ? charaModelKey(model) : ''}`, 0, stains);
}

/**
 * What makes this outfit this outfit: every worn slot's model key and dyed channels,
 * in the fixed slot order, so one piece or dye changed anywhere makes another outfit,
 * a dye moved to the piece's other channel included. The channels are here and not in
 * `modelHash` because that is also the stored key of an edit on a piece with no item.
 * It reads the file and not `glamourMarkdownInput`'s keys, which lose a slot when the
 * lookup lands and omits it. It stays in memory, so it needs no hashing, and it holds
 * no colon, so `${signature}:` finds this outfit's `offKeys` and no other's.
 */
export function outfitSignature(source: GlamourListSource): string {
  const { gearModels, gearDyes, glassesId } = source.resolved;
  const worn = new Set<GlamourMarkdownSlot>([...gearModels, ...gearDyes].map((g) => g.slot));
  if (glassesId !== null && glassesId > 0) worn.add('Facewear');
  return GLAMOUR_MARKDOWN_SLOTS.filter((slot) => worn.has(slot))
    .map((slot) => {
      const channels = slotDyes(source, slot).map((gear) => gear.channel);
      return `${modelHash(source, slot)}/${channels.join('')}`;
    })
    .join(',');
}

/**
 * The family's lowest row, which api-worker always sends. `itemId` is the row
 * the family is NAMED by (its lowest row with an acquisition line, else its
 * lowest row), and that can move when a patch adds or drops a source. Keying
 * edits on the lowest row keeps the ones saved before api-worker 0.19.0, and
 * after any later source change, applying.
 */
function familyRow(item: {
  itemId: number;
  alternates: ReadonlyArray<{ itemId: number }>;
}): number {
  return Math.min(item.itemId, ...item.alternates.map((a) => a.itemId));
}

/** A worn slot's gear key: slot, the family's row and the stains (spec G8). */
function pieceHash(source: GlamourListSource, slot: GlamourMarkdownSlot): string {
  const { equipment } = source;
  const item = slot === 'Facewear' ? null : (equipment?.items[slot as CharaGearSlotId] ?? null);
  const family =
    slot === 'Facewear' ? (equipment?.glasses?.id ?? null) : item ? familyRow(item) : null;
  return family !== null
    ? gearHash(slot, family, slotStains(source, slot))
    : modelHash(source, slot);
}

/**
 * The export sheet's rows (design 2c), in the template's order: what the
 * list says for each worn piece, the generated Acquisition line of the twin
 * it names, and the gear key a device-kept edit is filed under — slot, the
 * family's row and the stains, so a twin pick keeps the key (spec G8).
 */
export function glamourSheetPieces(source: GlamourListSource): GlamourSheetPiece[] {
  const { equipment, picked } = source;
  const lang = LanguageService.getCurrentLocale();
  const input = glamourMarkdownInput(source);
  // Two identical rings are written once, as Rings — so they are one row too
  const sameRings = gposersSameRings(input);
  const outfit = outfitSignature(source);
  const pieces: GlamourSheetPiece[] = [];
  for (const slot of GLAMOUR_MARKDOWN_SLOTS) {
    const piece = input[slot];
    if (!piece) continue;
    if (sameRings && slot === 'LeftRing') continue;
    let pickedItemId: number | null;
    let pickedName: string | null = null;
    let generated: string | null;
    if (slot === 'Facewear') {
      const glasses = equipment?.glasses ?? null;
      pickedItemId = glasses?.id ?? null;
      generated = glasses?.acquisition ?? null;
    } else {
      const item = equipment?.items[slot as CharaGearSlotId] ?? null;
      const pick = picked?.[slot as CharaGearSlotId];
      pickedItemId = pick?.itemId ?? item?.itemId ?? null;
      pickedName = pick
        ? itemNameFor(pick.names, lang)
        : item
          ? itemNameFor(item.names, lang)
          : null;
      generated = (pick ? pick.acquisition : item?.acquisition) ?? null;
    }
    const merged = sameRings && slot === 'RightRing';
    const covered: GlamourMarkdownSlot[] = merged ? [slot, 'LeftRing'] : [slot];
    pieces.push({
      slot,
      label: merged ? 'Rings' : glamourSlotLabel(slot),
      name: piece.name ?? null,
      dyes: [piece.dye1, piece.dye2].filter((d): d is string => Boolean(d)),
      generated,
      hash: pieceHash(source, slot),
      editKeys: covered.flatMap((s) => [pieceHash(source, s), modelHash(source, s)]),
      offKeys: covered.map((s) => `${outfit}:${modelHash(source, s)}`),
      pickedItemId,
      pickedName,
    });
  }
  return pieces;
}

/**
 * The list with each piece's Acquisition line filled in (the sheet's text),
 * without the slots the player switched off. Two identical rings are one row,
 * filed under RightRing, so leaving it out takes LeftRing too. That is decided
 * before anything goes: with RightRing gone they no longer read as the same
 * rings, and the list would write a stray Left Ring.
 */
export function glamourInputWithAcquisition(
  source: GlamourListSource,
  acquisition: Partial<Record<GlamourMarkdownSlot, string>>,
  leftOut: ReadonlySet<GlamourMarkdownSlot>
): GlamourMarkdownInput {
  const input = glamourMarkdownInput(source);
  for (const [slot, line] of Object.entries(acquisition) as Array<[GlamourMarkdownSlot, string]>) {
    const piece = input[slot];
    if (piece) piece.acquisition = line;
  }
  const sameRings = gposersSameRings(input);
  for (const slot of leftOut) delete input[slot];
  if (sameRings && leftOut.has('RightRing')) delete input.LeftRing;
  return input;
}
