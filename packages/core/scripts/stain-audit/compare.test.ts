import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { completeSnapshot, validatePage, type LocalInputs } from './model.js';
import { compareStains, parseLocalCatalog } from './compare.js';

const header = 'itemID,English Name,Japanese Name,German Name,French Name,Korean Name,Chinese Name';
function inputs(
  dyes: unknown = [
    {
      stainID: 1,
      name: 'Black',
      hex: '#000000',
      category: 'Neutral',
      acquisition: 'Dye Vendor',
      consolidationType: 'A',
      legacyItemID: 5729,
    },
  ],
  csv = '5729,Black,?,Schwarz,Noir,??,??',
): LocalInputs {
  return {
    dyesJson: JSON.stringify(dyes),
    namesCsv: `${header}\n${csv}\n`,
    rulesJson: JSON.stringify({
      metallicStainIds: [],
      consolidatedIds: { A: 52254, B: 52255, C: 52256 },
    }),
  };
}
function snapshot(ids = [1]) {
  const pins = { version: 'v1', schema: 'schema1' };
  const page = validatePage({
    ...pins,
    rows: ids.map((id) => ({
      row_id: id,
      fields: {
        Name: 'Black',
        'Name@ja': '?',
        'Name@de': 'Schwarz',
        'Name@fr': 'Noir',
        Color: 0,
        Shade: 0,
        SubOrder: 0,
        IsMetallic: false,
        IsHousingApplicable: false,
        Item: [
          { value: 52254, row_id: 52254, sheet: 'Item', fields: { Name: 'Standard Spectrum Dye' } },
        ],
      },
    })),
  });
  return completeSnapshot([page, validatePage({ ...pins, rows: [] })]);
}
function frozenFile(file: string): string {
  return readFileSync(new URL(`./fixtures/2026-10-20/${file}`, import.meta.url), 'utf8');
}

function freezeTree(value: unknown): void {
  if (typeof value === 'object' && value !== null) {
    Object.values(value).forEach(freezeTree);
    Object.freeze(value);
  }
}

describe('report-only dye comparison', () => {
  it('discovers a lower-numbered addition without filtering black or nonhousing rows', () => {
    const result = compareStains(snapshot([1, 126, 200]), parseLocalCatalog(inputs()));
    expect(result.addedCandidateIds).toEqual([126, 200]);
    expect(result.counts.candidates).toBe(3);
    expect(result.regionalLocales).toEqual({ ko: 'not-supplied', zh: 'not-supplied' });
  });
  it('keeps shared consolidated items separate and supports a null legacy ID locale key', () => {
    const dyes = [
      {
        stainID: 1,
        name: 'Black',
        hex: '#000000',
        category: 'Neutral',
        acquisition: 'Dye Vendor',
        consolidationType: 'A',
        legacyItemID: 5729,
      },
      {
        stainID: 2,
        name: 'Black',
        hex: '#000000',
        category: 'Neutral',
        acquisition: 'Dye Vendor',
        consolidationType: 'A',
        legacyItemID: null,
      },
    ];
    const local = parseLocalCatalog(
      inputs(dyes, '5729,Black,?,Schwarz,Noir,??,??\n2,Black,?,Schwarz,Noir,??,??'),
    );
    expect(local.names.map((row) => row.key)).toEqual([2, 5729]);
    const result = compareStains(snapshot([1, 2]), local);
    expect(result.differences).toEqual([]);
    expect(result.observedItems.map((row) => row.stainID)).toEqual([1, 2]);
  });
  it('separates absent and newly unnamed local rows and reports missing translations', () => {
    const upstream = snapshot([1]);
    upstream.rows[0].names = { en: '', ja: '', de: '', fr: '' };
    expect(compareStains(upstream, parseLocalCatalog(inputs())).unnamedLocalIds).toEqual([1]);
    expect(compareStains(snapshot([2]), parseLocalCatalog(inputs())).missingLocalIds).toEqual([1]);
    upstream.rows[0].names.en = 'Black';
    expect(
      compareStains(upstream, parseLocalCatalog(inputs())).sourceIssues.some(
        (issue) => issue.code === 'upstream-name-missing' && issue.locale === 'ja',
      ),
    ).toBe(true);
  });
  it('keeps whitespace, case and value differences reviewable without mutating inputs', () => {
    const source = Object.freeze(inputs());
    const local = parseLocalCatalog(source);
    const upstream = snapshot();
    upstream.rows[0].names.en = 'Black ';
    upstream.rows[0].names.fr = 'noir';
    upstream.rows[0].color = 1;
    freezeTree(local);
    freezeTree(upstream);
    const before = JSON.stringify({ local, upstream });
    const result = compareStains(upstream, local);
    expect(result.differences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'jsonName', kind: 'whitespace' }),
        expect.objectContaining({ field: 'csvName', locale: 'fr', kind: 'case' }),
        expect.objectContaining({ field: 'color', local: '#000000', upstream: '#000001' }),
      ]),
    );
    expect(JSON.stringify({ local, upstream })).toBe(before);
  });
  it('reports source gaps without inventing translated values', () => {
    const result = compareStains(
      snapshot(),
      parseLocalCatalog(inputs(undefined, '999,Other,,,,,')),
    );
    expect(result.sourceIssues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['csv-row-missing', 'csv-row-unknown']),
    );
  });
  it('rejects duplicate identities, malformed sources and locale key collisions', () => {
    const one = JSON.parse(inputs().dyesJson) as Record<string, unknown>[];
    expect(() => parseLocalCatalog(inputs([...one, ...one]))).toThrow(/duplicate/i);
    expect(() =>
      parseLocalCatalog(
        inputs(undefined, '5729,Black,?,Schwarz,Noir,??,??\n5729,Black,?,Schwarz,Noir,??,??'),
      ),
    ).toThrow(/duplicate/i);
    expect(() =>
      parseLocalCatalog(
        inputs([
          { ...one[0], legacyItemID: null },
          { ...one[0], stainID: 2, legacyItemID: 1 },
        ]),
      ),
    ).toThrow(/key|collision/i);
    expect(() => parseLocalCatalog({ ...inputs(), dyesJson: '{}' })).toThrow(/array|catalog/i);
    expect(() => parseLocalCatalog({ ...inputs(), namesCsv: 'bad,header\n1,Black' })).toThrow(
      /header|columns/i,
    );
    expect(() => parseLocalCatalog(inputs([{ ...one[0], hex: '#nope' }]))).toThrow(/hex/i);
  });
  it('reproduces the measured differences from frozen sources, including regional bytes', () => {
    const localInputs = {
      dyesJson: frozenFile('dyes.json'),
      namesCsv: frozenFile('dyenames.csv'),
      rulesJson: frozenFile('rules.json'),
    };
    const captured = completeSnapshot(
      [1, 2, 3].map((n) =>
        validatePage(
          JSON.parse(frozenFile(`stain-page-${String(n).padStart(4, '0')}.json`)) as unknown,
        ),
      ),
    );
    const report = compareStains(captured, parseLocalCatalog(localInputs));
    expect(report.counts).toMatchObject({ sheetRows: 129, candidates: 125, localDyes: 125 });
    expect(report.addedCandidateIds).toEqual([]);
    expect(report.missingLocalIds).toEqual([]);
    expect(report.differences.filter((diff) => diff.field === 'color')).toHaveLength(22);
    expect(
      report.differences.filter(
        (diff) => diff.field === 'metallic' || diff.field === 'expectedItem',
      ),
    ).toEqual([]);
    expect(
      report.differences.filter((diff) => diff.field === 'jsonName').map((diff) => diff.stainID),
    ).toEqual([99, 122, 123]);
    expect(
      report.differences
        .filter((diff) => diff.field === 'jsonName')
        .every((diff) => diff.kind === 'whitespace'),
    ).toBe(true);
    for (const [locale, count] of [
      ['en', 0],
      ['ja', 0],
      ['de', 118],
      ['fr', 125],
    ] as const) {
      const differences = report.differences.filter(
        (diff) => diff.field === 'csvName' && diff.locale === locale,
      );
      expect(differences).toHaveLength(count);
      if (locale === 'fr') expect(differences.every((diff) => diff.kind === 'case')).toBe(true);
    }
    expect(localInputs.namesCsv).toBe(frozenFile('dyenames.csv'));
  });
});
