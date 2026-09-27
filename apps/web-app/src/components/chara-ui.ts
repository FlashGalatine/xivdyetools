/**
 * XIV Dye Tools 5.0 — shared vocabulary for the `.chara` views (10A Sheet).
 *
 * The file card, the THIS CHARACTER sheet and DYES ON THIS GLAMOUR draw from
 * one set of sizes, colours and labels so they read as one family. Everything
 * here is stateless: each helper reads only the current theme and locale.
 *
 * The views render inside the v4 shell's shadow DOM, so styles are inline and
 * every colour comes from a theme token or from the theme-aware pairs below.
 *
 * Spec: docs/research/monorepo-2.0/10a-sheet-port-spec.md (10A "Sheet")
 *
 * @module components/chara-ui
 */

import type {
  CharaSlotErrorCode,
  ResolvedCharaCharacter,
  ResolvedCharaSlot,
} from '@xivdyetools/core';
import type { Dye } from '@xivdyetools/types';
import { LanguageService } from '@services/index';
import { ThemeService } from '@services/theme-service';

export const MONO = 'var(--font-mono)';
/** Matches globals.css h1–h6 — Space Grotesk with the system fallback. */
export const SANS = 'var(--font-display)';
const OFF_GRID_AMBER = '#F4BF4F';
const OFF_GRID_AMBER_LIGHT = '#B45309';
const LOCAL_ONLY_GREEN = '#61C554';
const LOCAL_ONLY_GREEN_LIGHT = '#137A33';
/** The suite's swatch inset ring — load-bearing on extreme colours. */
export const INSET_RING = 'box-shadow: inset 0 0 0 1px rgba(127, 127, 127, 0.28);';

/**
 * Core slot-failure code → locale key. Spelled out (not `` `swatch.slotError.${code}` ``)
 * so every key is a literal the orphan scanner can see, and so an unmapped
 * code degrades to `swatch.slotError.unknown` instead of printing a raw path.
 */
const SLOT_ERROR_KEY: Record<CharaSlotErrorCode, string> = {
  midRangeIndex: 'swatch.slotError.midRangeIndex',
  indexOutOfRange: 'swatch.slotError.indexOutOfRange',
  noTribe: 'swatch.slotError.noTribe',
};

/** A `swatch.*` string — the namespace every `.chara` view writes in. */
export function tSwatch(key: string): string {
  return LanguageService.t(`swatch.${key}`);
}

/**
 * Localized text for a core slot-failure code.
 *
 * Core's `error.message` is an EN engineering sentence naming the field and
 * the index ("LipsToneFurPattern index 100 falls in the 96-127 gap…") — good
 * for a log, not for a card. The `code` is the stable part, so the keys are
 * spelled out literally in `SLOT_ERROR_KEY` rather than built with a
 * template: `scripts/analyze-unused-keys.js` only sees literals and a literal
 * prefix, and a spelled-out map also survives a code being added upstream —
 * anything unrecognised falls back to `slotError.unknown`.
 */
export function slotErrorText(code: CharaSlotErrorCode | undefined): string {
  const key = code ? SLOT_ERROR_KEY[code] : undefined;
  return LanguageService.t(key ?? 'swatch.slotError.unknown');
}

/** OFF GRID and warning amber, legible on either theme. */
export function amber(): string {
  return ThemeService.isDarkMode() ? OFF_GRID_AMBER : OFF_GRID_AMBER_LIGHT;
}

/** LOCAL ONLY / valid-palette green, legible on either theme. */
export function green(): string {
  return ThemeService.isDarkMode() ? LOCAL_ONLY_GREEN : LOCAL_ONLY_GREEN_LIGHT;
}

export function el(tag: string, style: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.setAttribute('style', style);
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Mono chip label (8.5px, letter-spaced) — the drawn card vocabulary. */
export function monoChip(text: string, fg: string, bg: string): HTMLElement {
  return el(
    'span',
    `font-family: ${MONO}; font-size: 8.5px; letter-spacing: 1px; padding: 3px 7px; border-radius: 5px; background: ${bg}; color: ${fg}; white-space: nowrap;`,
    text
  );
}

export function slotLabel(slot: ResolvedCharaSlot): string {
  switch (slot.slot) {
    case 'leftEye':
      return tSwatch('slotLeftEye');
    case 'rightEye':
      return tSwatch('slotRightEye');
    case 'hair':
      return tSwatch('slotHair');
    case 'highlights':
      return tSwatch('slotHighlights');
    case 'skin':
      return tSwatch('slotSkin');
    case 'limbal':
      return slot.kind === 'tattoo' ? tSwatch('slotTattoo') : tSwatch('slotLimbal');
    case 'lip':
      return tSwatch('slotLips');
    case 'facePaint':
      return tSwatch('slotFacePaint');
    default:
      return slot.slot;
  }
}

/** The colour the slot is wearing: float wins off-grid, index otherwise. */
export function winningHex(slot: ResolvedCharaSlot): string | null {
  if (slot.verdict === 'offGrid' || slot.verdict === 'floatOnly') return slot.floatHex;
  if (slot.verdict === 'index') return slot.indexHex;
  return null;
}

export function dyeName(dye: Dye): string {
  return LanguageService.getDyeName(dye.itemID) || dye.name;
}

/**
 * Whether the character wears anything DYES ON THIS GLAMOUR can show: a dyed
 * channel, a worn piece, or facewear.
 *
 * `glassesId` counts as worn. It was once left out while the block gained a
 * facewear row, so a `.chara` carrying ONLY facewear rendered no block and
 * that row was unreachable. The item lookup makes the same three-way test.
 */
export function hasGlamour(resolved: ResolvedCharaCharacter): boolean {
  return (
    resolved.gearDyes.length > 0 || resolved.gearModels.length > 0 || resolved.glassesId !== null
  );
}
