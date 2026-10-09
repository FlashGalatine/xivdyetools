import { describe, expect, it } from 'vitest';
import { facewearUnlocks, type FacewearStyle, type FacewearUnlock } from '../../scripts/acquisition/facewear.js';

const unlocks: FacewearUnlock[] = [
  { row_id: 44259, fields: { Name: 'The Faces We Wear - Oval Spectacles', AdditionalData: { value: 1 } } },
  { row_id: 44264, fields: { Name: 'The Faces We Wear - Monocles', AdditionalData: { value: 61 } } },
];
const styles: FacewearStyle[] = [
  { row_id: 0, fields: { Name: 'Oval Spectacles', Glasses: [{ value: 1, fields: { Name: 'Oval Spectacles' } }, { value: 2 }, { value: 12 }] } },
  { row_id: 5, fields: { Name: 'Monocle', Glasses: [{ value: 61, fields: { Name: 'Monocle' } }, { value: 62 }, { value: 72 }] } },
];

describe('facewear unlock links', () => {
  it('follows AdditionalData and the style list, including the Monocle/Monocles name difference', () => {
    expect(facewearUnlocks(unlocks, styles)).toEqual({
      1: 44259, 2: 44259, 12: 44259, 61: 44264, 62: 44264, 72: 44264,
    });
  });

  it('uses explicit variants even if their ids are not adjacent', () => {
    const irregular = [{ ...styles[0], fields: { ...styles[0].fields, Glasses: [{ value: 1 }, { value: 900 }] } }];
    expect(facewearUnlocks([unlocks[0]], irregular)).toEqual({ 1: 44259, 900: 44259 });
  });

  it('skips unnamed unused styles instead of assigning a made-up source', () => {
    expect(facewearUnlocks(unlocks, [...styles, { row_id: 34, fields: { Name: 'Unused placeholder', Glasses: [{ value: 409, fields: { Name: '' } }] } }])[409]).toBeUndefined();
  });

  it('fails on missing style links or missing unlocks for named styles', () => {
    expect(() => facewearUnlocks(unlocks, [styles[0]])).toThrow('expected one GlassesStyle');
    expect(() => facewearUnlocks([unlocks[0]], styles)).toThrow('has no unlock item');
  });

  it('rejects duplicate links and an invalid unlock item', () => {
    expect(() => facewearUnlocks([...unlocks, unlocks[0]], styles)).toThrow('Duplicate unlock');
    expect(() => facewearUnlocks([{ row_id: 1, fields: { Name: 'Other Item' } }], styles)).toThrow('Invalid facewear unlock');
  });
});
