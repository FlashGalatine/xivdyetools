/**
 * Copy list / Export .md — the click-time half of the glamour list.
 *
 * `chara-import` draws the two buttons; what a click needs lives here and is
 * loaded on demand, like the item-links menu, because the swatch chunk sits
 * within a kilobyte of its size budget and none of this is needed until
 * someone asks for the list. The component hands over what it knows (the
 * resolved file and the equipment answer) as plain data.
 *
 * Copy is the one action the component keeps for itself: the clipboard write
 * has to start inside the click (WebKit drops the user activation across the
 * chunk load), so this module only builds the content and the component
 * hands it to the clipboard as a promise. Export has no such constraint and
 * runs here whole.
 *
 * @module components/glamour-list-actions
 */

import type { ResolvedCharaCharacter, CharaGearSlotId } from '@xivdyetools/core';
import { LanguageService, ToastService } from '@services/index';
import { itemNameFor, type CharaResolveResult } from '@services/chara-resolve-service';
import type { RichText } from '@shared/clipboard';
import { downloadTextFile } from '@shared/download-file';
import { localizedDyeName } from '@shared/dye-name';
import { logger } from '@shared/logger';
import {
  GLAMOUR_MARKDOWN_FILENAME,
  buildGlamourHtml,
  buildGlamourMarkdown,
  buildGlamourPlainText,
  type GlamourMarkdownInput,
  type GlamourMarkdownPiece,
} from '@shared/glamour-markdown';

/** What the component knows when a button is clicked. */
export interface GlamourListSource {
  resolved: ResolvedCharaCharacter;
  /** api-worker's answer, or null before it lands / when it never did. */
  equipment: CharaResolveResult | null;
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
    if (item && !piece.name) piece.name = itemNameFor(item.names, lang);
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
 * What Copy list puts on the clipboard — bold labels as real formatting for
 * Word and Google Docs, the same lines as plain text for everything else.
 * Markdown syntax never reaches the clipboard. The component starts the write
 * and owns the toast; this only builds the two flavours.
 */
export function glamourCopyPayload(source: GlamourListSource): RichText {
  const input = glamourMarkdownInput(source);
  return { html: buildGlamourHtml(input), text: buildGlamourPlainText(input) };
}

/** Save the list as `glamour-equipment.md`; a failure says so rather than staying silent. */
export function exportGlamourList(source: GlamourListSource): void {
  try {
    const markdown = buildGlamourMarkdown(glamourMarkdownInput(source));
    downloadTextFile(markdown, GLAMOUR_MARKDOWN_FILENAME, 'text/markdown');
  } catch (error) {
    logger.error('[GlamourList] Export failed', error);
    ToastService.error(LanguageService.t('swatch.listExportFailed'));
  }
}
