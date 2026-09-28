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
  type ResolvedCharaCharacter,
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
  resolved: ResolvedCharaCharacter;
  /** api-worker's answer, or null before it lands / when it never did. */
  equipment: CharaResolveResult | null;
  /**
   * The twin the Glamour Reader names per slot (it may differ from the lowest
   * row), with its own acquisition line. Absent = the resolved item.
   */
  picked?: Partial<
    Record<CharaGearSlotId, { itemId: number; names: CharaItemNames; acquisition?: string }>
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
  }
  for (const gear of resolved.gearDyes) {
    const piece = pieceFor(gear.slot);
    const text = gear.dye ? localizedDyeName(gear.dye) : `#${gear.stainId}`;
    if (gear.channel === 1) piece.dye1 = text;
    else piece.dye2 = text;
  }

  if (resolved.glassesId !== null && resolved.glassesId > 0) {
    const glasses = equipment?.glasses ?? null;
    input.Facewear = { name: glasses ? itemNameFor(glasses.names, lang) : null };
  }
  return input;
}

/**
 * The key for a piece with no item behind it (the resolve failed, or the
 * model has no Item row): its model instead of the family's row, so what the
 * player types there is kept like any other edit.
 */
function modelHash(source: GlamourListSource, slot: GlamourMarkdownSlot, stains: number[]): string {
  if (slot === 'Facewear')
    return gearHash('Facewear@glasses', source.resolved.glassesId ?? 0, stains);
  const model = source.resolved.gearModels.find((m) => m.slot === slot);
  return gearHash(`${slot}@${model ? charaModelKey(model) : ''}`, 0, stains);
}

/**
 * The export sheet's rows (design 2c), in the template's order: what the
 * list says for each worn piece, the generated Acquisition line of the twin
 * it names, and the gear key a device-kept edit is filed under — slot, the
 * family's row and the stains, so a twin pick keeps the key (spec G8).
 */
export function glamourSheetPieces(source: GlamourListSource): GlamourSheetPiece[] {
  const { resolved, equipment, picked } = source;
  const lang = LanguageService.getCurrentLocale();
  const input = glamourMarkdownInput(source);
  // Two identical rings are written once, as Rings — so they are one row too
  const rightRing = input.RightRing?.name?.trim();
  const sameRings = !!rightRing && rightRing === input.LeftRing?.name?.trim();
  const pieces: GlamourSheetPiece[] = [];
  for (const slot of GLAMOUR_MARKDOWN_SLOTS) {
    const piece = input[slot];
    if (!piece) continue;
    if (sameRings && slot === 'LeftRing') continue;
    const stains = resolved.gearDyes
      .filter((gear) => gear.slot === slot)
      .sort((a, b) => a.channel - b.channel)
      .map((gear) => gear.stainId);
    let family: number | null;
    let pickedItemId: number | null;
    let pickedName: string | null = null;
    let generated: string | null = null;
    if (slot === 'Facewear') {
      const glasses = equipment?.glasses ?? null;
      family = glasses?.id ?? null;
      pickedItemId = family;
    } else {
      const item = equipment?.items[slot as CharaGearSlotId] ?? null;
      const pick = picked?.[slot as CharaGearSlotId];
      family = item?.itemId ?? null;
      pickedItemId = pick?.itemId ?? item?.itemId ?? null;
      pickedName = pick
        ? itemNameFor(pick.names, lang)
        : item
          ? itemNameFor(item.names, lang)
          : null;
      generated = (pick ? pick.acquisition : item?.acquisition) ?? null;
    }
    pieces.push({
      slot,
      label: sameRings && slot === 'RightRing' ? 'Rings' : glamourSlotLabel(slot),
      name: piece.name ?? null,
      dyes: [piece.dye1, piece.dye2].filter((d): d is string => Boolean(d)),
      generated,
      hash: family !== null ? gearHash(slot, family, stains) : modelHash(source, slot, stains),
      pickedItemId,
      pickedName,
    });
  }
  return pieces;
}

/** The list with each piece's Acquisition line filled in (the sheet's text). */
export function glamourInputWithAcquisition(
  source: GlamourListSource,
  acquisition: Partial<Record<GlamourMarkdownSlot, string>>
): GlamourMarkdownInput {
  const input = glamourMarkdownInput(source);
  for (const [slot, line] of Object.entries(acquisition) as Array<[GlamourMarkdownSlot, string]>) {
    const piece = input[slot];
    if (piece) piece.acquisition = line;
  }
  return input;
}
