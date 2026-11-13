/**
 * Palette slot contract: how a tool tells the dye palette which dye slots it
 * has, and how a pick in the palette resolves against them. Pure logic, no DOM.
 *
 * @module components/palette-slots
 */

import type { Dye } from '@xivdyetools/types';
import { isCustomDye } from '@shared/custom-dye';

export type PaletteSlotMode = 'single' | 'multi';

export interface PaletteSlot {
  /** Short chip label: "1".."4", "A"/"B", or the localized FROM/TO label. '' for single-input tools. */
  label: string;
  /** Full localized header line for this slot, e.g. "Choosing dye 2 of 4". '' for single-input tools. */
  targetLabel: string;
  dye: Dye | null;
  /** True when the slot cannot be targeted yet (Gradient Builder's TO before FROM). */
  disabled?: boolean;
}

/** Every palette tool implements this. */
export interface PaletteSlotSource {
  readonly paletteSlotMode: PaletteSlotMode;
  getPaletteSlots(): PaletteSlot[];
}

/** Multi-input tools implement this as well. */
export interface PaletteSlotHost extends PaletteSlotSource {
  readonly paletteSlotMode: 'multi';
  /** True when the slots are a dense list (Dye Comparison, Accessibility Checker): every empty slot means "the next one". */
  readonly paletteSlotsDense?: boolean;
  /** Put `dye` in slot `index`. If the dye is in another slot, the two slots swap. */
  placeDyeAt(index: number, dye: Dye): void;
  removeDyeAt(index: number): void;
  /** Draw (or clear, with null) the accent border on the targeted slot in the tool. */
  setPaletteTarget(index: number | null): void;
}

export const PALETTE_SLOTS_CHANGED = 'palette-slots-changed';
export const OPEN_PALETTE_DRAWER = 'open-palette-drawer';
export interface OpenPaletteDrawerDetail {
  slot?: number;
}

export function isPaletteSlotSource(tool: unknown): tool is PaletteSlotSource {
  if (typeof tool !== 'object' || tool === null) return false;
  const t = tool as Partial<PaletteSlotSource>;
  return (
    (t.paletteSlotMode === 'single' || t.paletteSlotMode === 'multi') &&
    typeof t.getPaletteSlots === 'function'
  );
}

export function isPaletteSlotHost(tool: unknown): tool is PaletteSlotHost {
  if (!isPaletteSlotSource(tool) || tool.paletteSlotMode !== 'multi') return false;
  const t = tool as Partial<PaletteSlotHost>;
  return (
    typeof t.placeDyeAt === 'function' &&
    typeof t.removeDyeAt === 'function' &&
    typeof t.setPaletteTarget === 'function'
  );
}

/** Index of the slot holding this dye id, or -1. Custom dyes (isCustomDye) never match. */
export function findHeldSlot(
  slots: readonly PaletteSlot[],
  dye: Pick<Dye, 'id' | 'category'>
): number {
  if (isCustomDye(dye)) return -1;
  return slots.findIndex((s) => s.dye !== null && s.dye.id === dye.id);
}

/** Disabled or out-of-range → null. When `dense`, any empty slot index collapses to the first empty one. */
export function normalizeTarget(
  slots: readonly PaletteSlot[],
  target: number | null,
  dense: boolean
): number | null {
  if (target === null || !Number.isInteger(target) || target < 0 || target >= slots.length)
    return null;
  const slot = slots[target];
  if (slot.disabled) return null;
  if (dense && slot.dye === null) {
    const firstEmpty = slots.findIndex((s) => s.dye === null && !s.disabled);
    return firstEmpty === -1 ? target : firstEmpty;
  }
  return target;
}

/** The accent border of a targeted slot in a tool (Gradient Builder's former ACCENT_BORDER value). */
export const SLOT_TARGET_BORDER = 'color-mix(in srgb, var(--theme-primary) 45%, transparent)';

export type PickAction =
  | { kind: 'add' } // use the tool's existing selectDye/addDye
  | { kind: 'place'; index: number }
  | { kind: 'remove'; index: number }
  | { kind: 'none' };

export function resolvePick(input: {
  mode: PaletteSlotMode;
  slots: readonly PaletteSlot[];
  target: number | null;
  dye: Pick<Dye, 'id' | 'category'>;
  random?: boolean;
}): PickAction {
  const { mode, slots, target, dye, random } = input;
  if (mode === 'single') return { kind: 'add' };
  const held = findHeldSlot(slots, dye);
  if (target === null) {
    if (held === -1) return { kind: 'add' };
    return random ? { kind: 'none' } : { kind: 'remove', index: held };
  }
  if (held === target) return { kind: 'none' };
  return { kind: 'place', index: target };
}
