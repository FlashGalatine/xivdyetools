import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { classifyRow, completeSnapshot, validatePage } from './model.js';

const pins = {
  version: '0874aee069e1e7c4',
  schema: 'exdschema@2:rev:e773c41a90aed788cf4c1c48469fa85618ef01fb',
};
function wire(id = 1, fields: Record<string, unknown> = {}): unknown {
  return {
    ...pins,
    rows: [
      {
        row_id: id,
        fields: {
          Name: 'Black',
          'Name@ja': '',
          'Name@de': '',
          'Name@fr': '',
          Color: 0,
          Shade: 1,
          SubOrder: 0,
          IsMetallic: false,
          IsHousingApplicable: false,
          Item: [],
          ...fields,
        },
      },
    ],
  };
}
function fixture(n: number): unknown {
  return JSON.parse(
    readFileSync(
      new URL(
        `./fixtures/2026-10-20/stain-page-${String(n).padStart(4, '0')}.json`,
        import.meta.url,
      ),
      'utf8',
    ),
  ) as unknown;
}

describe('Stain validation and completion', () => {
  it('retains named black candidates without Item links or housing applicability', () => {
    const row = validatePage(wire()).rows[0];
    expect(classifyRow(row)).toBe('candidate');
    expect(row.color).toBe(0);
    expect(row.items).toEqual([]);
  });
  it('excludes row zero even with a name and Item, and keeps unnamed populated rows blank', () => {
    expect(
      classifyRow(
        validatePage(
          wire(0, {
            Item: [{ value: 5728, row_id: 5728, sheet: 'Item', fields: { Name: 'Terebinth' } }],
          }),
        ).rows[0],
      ),
    ).toBe('no-color');
    expect(classifyRow(validatePage(wire(126, { Name: '  ', Color: 123 })).rows[0])).toBe('blank');
  });
  it.each([
    'Name',
    'Name@ja',
    'Name@de',
    'Name@fr',
    'Color',
    'Shade',
    'SubOrder',
    'IsMetallic',
    'IsHousingApplicable',
    'Item',
  ])('rejects omitted %s even after HTTP success', (field) => {
    const data = wire() as { rows: { fields: Record<string, unknown> }[] };
    delete data.rows[0].fields[field];
    expect(() => validatePage(data)).toThrow(/field|missing|invalid/i);
  });
  it.each([-1, 0x1000000, 1.5, '0'])('rejects invalid packed color %s', (Color) => {
    expect(() => validatePage(wire(1, { Color }))).toThrow(/color/i);
  });
  it('rejects malformed identities and flags, while retaining extra fields and extra Item slots', () => {
    expect(() => validatePage(wire(-1))).toThrow(/id/i);
    expect(() => validatePage(wire(1, { IsMetallic: 1 }))).toThrow(/metallic/i);
    expect(() =>
      validatePage(
        wire(1, { Item: [{ value: 1, row_id: 2, sheet: 'Item', fields: { Name: 'X' } }] }),
      ),
    ).toThrow(/item/i);
    expect(() =>
      validatePage(
        wire(1, { Item: [{ value: 1, row_id: 1, sheet: 'Other', fields: { Name: 'X' } }] }),
      ),
    ).toThrow(/item/i);
    expect(
      validatePage(
        wire(1, {
          extra: true,
          Item: [1, 2, 3].map((itemID) => ({
            value: itemID,
            row_id: itemID,
            sheet: 'Item',
            fields: { Name: 'X' },
          })),
        }),
      ).rows[0].items,
    ).toHaveLength(3);
  });
  it('rejects duplicate or unordered IDs and pin drift', () => {
    const first = validatePage(wire(2));
    const second = validatePage(wire(1));
    const empty = validatePage({ ...pins, rows: [] });
    expect(() => completeSnapshot([first, first, empty])).toThrow(/order|duplicate|progress/i);
    expect(() => completeSnapshot([first, second, empty])).toThrow(/order|progress/i);
    expect(() => validatePage({ ...(wire() as object), version: 'different' }, pins)).toThrow(
      /pin|version/i,
    );
    expect(() =>
      completeSnapshot([first, { ...empty, pins: { ...pins, schema: 'changed' } }]),
    ).toThrow(/pin|schema/i);
  });
  it('requires exactly one terminal empty page and tolerates sparse IDs', () => {
    const first = validatePage(wire(0));
    const last = validatePage(wire(500));
    const empty = validatePage({ ...pins, rows: [] });
    expect(() => completeSnapshot([first])).toThrow(/terminal|empty|incomplete/i);
    expect(() => completeSnapshot([empty])).toThrow(/empty|incomplete/i);
    expect(() => completeSnapshot([first, empty, last, empty])).toThrow(/terminal|empty/i);
    expect(completeSnapshot([first, last, empty]).rows.map((row) => row.stainID)).toEqual([0, 500]);
  });
  it('reconstructs the complete measured 129-row snapshot', () => {
    const snapshot = completeSnapshot([1, 2, 3].map((n) => validatePage(fixture(n))));
    expect(snapshot.complete).toBe(true);
    expect(snapshot.rows).toHaveLength(129);
    expect(snapshot.rows.filter((row) => classifyRow(row) === 'candidate')).toHaveLength(125);
    expect(
      snapshot.rows.filter((row) => classifyRow(row) !== 'candidate').map((row) => row.stainID),
    ).toEqual([0, 126, 127, 128]);
  });
});
