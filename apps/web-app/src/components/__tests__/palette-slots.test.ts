import { describe, it, expect } from 'vitest';
import type { Dye } from '@xivdyetools/types';
import { mockDyes } from '../../__tests__/mocks/services';
import { makeCustomDye } from '@shared/custom-dye';
import {
  findHeldSlot,
  isPaletteSlotHost,
  isPaletteSlotSource,
  normalizeTarget,
  resolvePick,
  SLOT_TARGET_BORDER,
  type PaletteSlot,
} from '../palette-slots';

const [dyeA, dyeB] = mockDyes;

function slot(label: string, dye: Dye | null): PaletteSlot {
  return { label, targetLabel: `Choosing ${label}`, dye };
}

describe('resolvePick', () => {
  const slots = [slot('1', dyeA), slot('2', null)];

  it('single mode always adds', () => {
    expect(resolvePick({ mode: 'single', slots: [], target: null, dye: dyeA })).toEqual({
      kind: 'add',
    });
    expect(resolvePick({ mode: 'single', slots, target: 1, dye: dyeA })).toEqual({ kind: 'add' });
  });
  it('multi, no target, dye not held: add', () => {
    expect(resolvePick({ mode: 'multi', slots, target: null, dye: dyeB })).toEqual({ kind: 'add' });
  });
  it('multi, no target, dye held: remove its slot', () => {
    expect(resolvePick({ mode: 'multi', slots, target: null, dye: dyeA })).toEqual({
      kind: 'remove',
      index: 0,
    });
  });
  it('multi, no target, dye held, random: none', () => {
    expect(resolvePick({ mode: 'multi', slots, target: null, dye: dyeA, random: true })).toEqual({
      kind: 'none',
    });
  });
  it('multi, target holds the dye: none', () => {
    expect(resolvePick({ mode: 'multi', slots, target: 0, dye: dyeA })).toEqual({ kind: 'none' });
  });
  it('multi, target set, dye held elsewhere: place', () => {
    expect(resolvePick({ mode: 'multi', slots, target: 1, dye: dyeA })).toEqual({
      kind: 'place',
      index: 1,
    });
  });
  it('multi, target set, dye not held: place', () => {
    expect(resolvePick({ mode: 'multi', slots, target: 1, dye: dyeB })).toEqual({
      kind: 'place',
      index: 1,
    });
  });

  it('never matches a custom dye as held', () => {
    const custom = makeCustomDye('#123456');
    const customSlots = [slot('1', custom), slot('2', null)];
    expect(findHeldSlot(customSlots, makeCustomDye('#123456'))).toBe(-1);
    expect(
      resolvePick({
        mode: 'multi',
        slots: customSlots,
        target: null,
        dye: makeCustomDye('#123456'),
      })
    ).toEqual({ kind: 'add' });
  });
});

describe('findHeldSlot', () => {
  it('returns the index of the slot holding the dye id', () => {
    expect(findHeldSlot([slot('1', null), slot('2', dyeB)], dyeB)).toBe(1);
    expect(findHeldSlot([slot('1', null)], dyeB)).toBe(-1);
  });
});

describe('normalizeTarget', () => {
  it('collapses an empty slot to the first empty one when dense', () => {
    const slots = [slot('1', dyeA), slot('2', null), slot('3', null), slot('4', null)];
    expect(normalizeTarget(slots, 3, true)).toBe(1);
    expect(normalizeTarget(slots, 0, true)).toBe(0);
    expect(normalizeTarget(slots, 3, false)).toBe(3);
  });
  it('rejects a disabled or out-of-range slot, and passes null through', () => {
    const slots = [slot('FROM', null), { ...slot('TO', null), disabled: true }];
    expect(normalizeTarget(slots, 1, false)).toBeNull();
    expect(normalizeTarget(slots, 7, false)).toBeNull();
    expect(normalizeTarget(slots, -1, false)).toBeNull();
    expect(normalizeTarget(slots, null, false)).toBeNull();
  });
});

describe('type guards', () => {
  const source = { paletteSlotMode: 'single', getPaletteSlots: () => [] };
  const host = {
    paletteSlotMode: 'multi',
    getPaletteSlots: () => [],
    placeDyeAt: () => {},
    removeDyeAt: () => {},
    setPaletteTarget: () => {},
  };

  it('isPaletteSlotSource needs a mode and getPaletteSlots', () => {
    expect(isPaletteSlotSource(source)).toBe(true);
    expect(isPaletteSlotSource({ paletteSlotMode: 'single' })).toBe(false);
    expect(isPaletteSlotSource({ getPaletteSlots: () => [] })).toBe(false);
    expect(isPaletteSlotSource({ paletteSlotMode: 'bogus', getPaletteSlots: () => [] })).toBe(
      false
    );
    expect(isPaletteSlotSource(null)).toBe(false);
  });
  it('isPaletteSlotHost needs the four required members and multi mode', () => {
    expect(isPaletteSlotHost(host)).toBe(true);
    expect(isPaletteSlotHost({ ...host, paletteSlotMode: 'single' })).toBe(false);
    for (const key of ['getPaletteSlots', 'placeDyeAt', 'removeDyeAt', 'setPaletteTarget']) {
      const partial: Record<string, unknown> = { ...host };
      delete partial[key];
      expect(isPaletteSlotHost(partial)).toBe(false);
    }
  });
});

describe('SLOT_TARGET_BORDER', () => {
  it('matches the accent border Gradient Builder used', () => {
    expect(SLOT_TARGET_BORDER).toBe('color-mix(in srgb, var(--theme-primary) 45%, transparent)');
  });
});
