/**
 * The export sheet's device-kept Acquisition edits (spec G8/G9): keyed by a
 * hash of the gear — slot, the family's row, the dyes — never the file, its
 * name or the character; generated lines are never stored.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { AcquisitionEdits, gearHash } from '../acquisition-edits';

beforeEach(() => localStorage.clear());

describe('gearHash', () => {
  it('is stable for the same gear and differs by slot, family and dyes', () => {
    const base = gearHash('Body', 2629, [56, 33]);
    expect(gearHash('Body', 2629, [56, 33])).toBe(base);
    expect(gearHash('Legs', 2629, [56, 33])).not.toBe(base);
    expect(gearHash('Body', 2630, [56, 33])).not.toBe(base);
    expect(gearHash('Body', 2629, [56])).not.toBe(base);
    expect(base).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('AcquisitionEdits', () => {
  it('keeps an edit with the twin it replaced, and forgets it on remove', () => {
    AcquisitionEdits.set('abc', { text: 'My note', baseItemId: 2629 });
    expect(AcquisitionEdits.get('abc')).toEqual({ text: 'My note', baseItemId: 2629 });
    AcquisitionEdits.remove('abc');
    expect(AcquisitionEdits.get('abc')).toBeNull();
  });

  it('Reset all clears only the outfit it is given', () => {
    AcquisitionEdits.set('a', { text: '1', baseItemId: 1 });
    AcquisitionEdits.set('b', { text: '2', baseItemId: 2 });
    AcquisitionEdits.set('other', { text: '3', baseItemId: 3 });
    AcquisitionEdits.resetAll(['a', 'b']);
    expect(AcquisitionEdits.get('a')).toBeNull();
    expect(AcquisitionEdits.get('b')).toBeNull();
    expect(AcquisitionEdits.get('other')).toEqual({ text: '3', baseItemId: 3 });
  });

  it('stores nothing that names the file or the character', () => {
    AcquisitionEdits.set(gearHash('Body', 2629, [56]), { text: 'Crafted', baseItemId: 2629 });
    const stored = Object.keys(localStorage)
      .map((k) => `${k}=${localStorage.getItem(k)}`)
      .join('\n');
    expect(stored).toContain('Crafted');
    expect(stored).not.toMatch(/\.chara|Nickname/);
  });
});
