import { parse } from 'csv-parse/sync';
import { classifyRow, GLOBAL_LOCALES, integer, record, text } from './model.js';
import type {
  Comparison,
  CompleteSnapshot,
  Difference,
  DyeRules,
  GlobalLocale,
  LocalCatalog,
  LocalDye,
  LocalInputs,
  SourceIssue,
} from './model.js';

const LOCALES = [...GLOBAL_LOCALES, 'ko', 'zh'] as const;
const CSV_COLUMNS = [
  'itemID',
  'English Name',
  'Japanese Name',
  'German Name',
  'French Name',
  'Korean Name',
  'Chinese Name',
];
function positive(value: unknown, label: string): number {
  const result = integer(value, label);
  if (result === 0) throw new Error(`Invalid ${label}: must be positive`);
  return result;
}
function nonblank(value: unknown, label: string): string {
  const result = text(value, label);
  if (!result.trim()) throw new Error(`Invalid ${label}: must not be blank`);
  return result;
}
export function parseLocalCatalog(inputs: LocalInputs): LocalCatalog {
  const raw: unknown = JSON.parse(inputs.dyesJson);
  if (!Array.isArray(raw) || !raw.length) throw new Error('Local catalog must be a nonempty array');
  const seen = new Set<number>();
  const keys = new Set<number>();
  const dyes: LocalDye[] = raw
    .map((value: unknown): LocalDye => {
      const item = record(value, 'local dye');
      const required = [
        'stainID',
        'name',
        'hex',
        'category',
        'acquisition',
        'consolidationType',
        'legacyItemID',
      ];
      if (
        Object.keys(item).length !== required.length ||
        required.some((key) => !Object.hasOwn(item, key))
      )
        throw new Error('Local dye requires exactly seven source fields');
      const stainID = positive(item.stainID, 'stainID');
      if (seen.has(stainID)) throw new Error(`Duplicate stainID ${stainID}`);
      seen.add(stainID);
      const legacyItemID =
        item.legacyItemID === null ? null : positive(item.legacyItemID, 'legacyItemID');
      const key = legacyItemID ?? stainID;
      if (keys.has(key)) throw new Error(`Locale key collision ${key}`);
      keys.add(key);
      const hex = text(item.hex, 'hex');
      if (!/^#[0-9a-fA-F]{6}$/.test(hex)) throw new Error(`Invalid hex for stain ${stainID}`);
      const consolidationType = item.consolidationType;
      if (
        consolidationType !== null &&
        consolidationType !== 'A' &&
        consolidationType !== 'B' &&
        consolidationType !== 'C'
      )
        throw new Error('Invalid consolidationType');
      return {
        stainID,
        name: nonblank(item.name, 'name'),
        hex,
        category: nonblank(item.category, 'category'),
        acquisition: nonblank(item.acquisition, 'acquisition'),
        consolidationType,
        legacyItemID,
      };
    })
    .sort((a, b) => a.stainID - b.stainID);
  const rulesSource = record(JSON.parse(inputs.rulesJson) as unknown, 'rules');
  if (!Array.isArray(rulesSource.metallicStainIds)) throw new Error('Invalid metallic stain IDs');
  const metallicStainIds = rulesSource.metallicStainIds.map((id: unknown) =>
    positive(id, 'metallic stain ID'),
  );
  if (new Set(metallicStainIds).size !== metallicStainIds.length)
    throw new Error('Duplicate metallic stain ID');
  const ids = record(rulesSource.consolidatedIds, 'consolidated IDs');
  const rules: DyeRules = {
    metallicStainIds: metallicStainIds.sort((a, b) => a - b),
    consolidatedIds: {
      A: ids.A === null ? null : positive(ids.A, 'A item'),
      B: ids.B === null ? null : positive(ids.B, 'B item'),
      C: ids.C === null ? null : positive(ids.C, 'C item'),
    },
  };
  const parsed: unknown = parse(inputs.namesCsv, {
    bom: true,
    skip_empty_lines: true,
    columns: (header: string[]) => {
      if (
        header.length !== CSV_COLUMNS.length ||
        header.some((name, i) => name.trim() !== CSV_COLUMNS[i])
      )
        throw new Error('Invalid CSV header columns');
      return CSV_COLUMNS;
    },
  });
  if (!Array.isArray(parsed)) throw new Error('Invalid CSV rows');
  const csvKeys = new Set<number>();
  const names: LocalCatalog['names'] = parsed
    .map((value: unknown) => {
      const row = record(value, 'CSV row');
      const keyText = text(row.itemID, 'CSV itemID').trim();
      if (!/^[1-9][0-9]*$/.test(keyText)) throw new Error('Invalid CSV itemID key');
      const key = positive(Number(keyText), 'CSV key');
      if (csvKeys.has(key)) throw new Error(`Duplicate CSV key ${key}`);
      csvKeys.add(key);
      const names = Object.fromEntries(
        LOCALES.map((locale, index) => [
          locale,
          text(row[CSV_COLUMNS[index + 1]], `CSV ${locale}`),
        ]),
      ) as LocalCatalog['names'][number]['names'];
      return { key, names };
    })
    .sort((a, b) => a.key - b.key);
  return { dyes, names, rules };
}
function nameDifference(
  stainID: number,
  field: 'jsonName' | 'csvName',
  locale: GlobalLocale,
  local: string,
  upstream: string,
): Difference | null {
  // The CSV join convention trims cells; JSON whitespace remains visible separately.
  if (
    (field === 'csvName' ? local.trim() : local) ===
    (field === 'csvName' ? upstream.trim() : upstream)
  )
    return null;
  const kind =
    local.trim() === upstream.trim()
      ? 'whitespace'
      : local.trim().toLowerCase() === upstream.trim().toLowerCase()
        ? 'case'
        : 'value';
  return { stainID, field, locale, local, upstream, kind };
}
export function compareStains(snapshot: CompleteSnapshot, catalog: LocalCatalog): Comparison {
  const byId = new Map(snapshot.rows.map((row) => [row.stainID, row]));
  const localIds = new Set(catalog.dyes.map((row) => row.stainID));
  const names = new Map(catalog.names.map((row) => [row.key, row.names]));
  const localKeys = new Set(catalog.dyes.map((row) => row.legacyItemID ?? row.stainID));
  const candidates = snapshot.rows.filter((row) => classifyRow(row) === 'candidate');
  const sourceIssues: SourceIssue[] = [];
  const differences: Difference[] = [];
  for (const row of catalog.names) {
    if (!localKeys.has(row.key)) sourceIssues.push({ code: 'csv-row-unknown', key: row.key });
    for (const locale of LOCALES)
      if (!row.names[locale].trim())
        sourceIssues.push({ code: 'csv-name-missing', key: row.key, locale });
  }
  for (const row of candidates)
    for (const locale of GLOBAL_LOCALES) {
      if (!row.names[locale].trim())
        sourceIssues.push({ code: 'upstream-name-missing', key: row.stainID, locale });
    }
  for (const dye of catalog.dyes) {
    const key = dye.legacyItemID ?? dye.stainID;
    const csv = names.get(key);
    if (!csv) sourceIssues.push({ code: 'csv-row-missing', key });
    else if (csv.en.trim() !== dye.name.trim())
      sourceIssues.push({ code: 'csv-english-mismatch', key, locale: 'en' });
    const row = byId.get(dye.stainID);
    if (!row || classifyRow(row) !== 'candidate') continue;
    const jsonName = nameDifference(dye.stainID, 'jsonName', 'en', dye.name, row.names.en);
    if (jsonName) differences.push(jsonName);
    if (csv)
      for (const locale of GLOBAL_LOCALES) {
        const diff = nameDifference(dye.stainID, 'csvName', locale, csv[locale], row.names[locale]);
        if (diff) differences.push(diff);
      }
    const hex = `#${row.color.toString(16).padStart(6, '0')}`;
    if (dye.hex.toLowerCase() !== hex)
      differences.push({
        stainID: dye.stainID,
        field: 'color',
        local: dye.hex.toLowerCase(),
        upstream: hex,
        kind: 'value',
      });
    const metallic = catalog.rules.metallicStainIds.includes(dye.stainID);
    if (metallic !== row.isMetallic)
      differences.push({
        stainID: dye.stainID,
        field: 'metallic',
        local: metallic,
        upstream: row.isMetallic,
        kind: 'value',
      });
    const expectedItem = dye.consolidationType
      ? catalog.rules.consolidatedIds[dye.consolidationType]
      : dye.legacyItemID;
    if (expectedItem !== null && !row.items.some((item) => item.itemID === expectedItem))
      differences.push({
        stainID: dye.stainID,
        field: 'expectedItem',
        local: expectedItem,
        upstream: row.items.map((item) => item.itemID),
        kind: 'missing',
      });
    if (dye.consolidationType && expectedItem === null)
      sourceIssues.push({ code: 'consolidated-item-unresolved', key: dye.stainID });
  }
  const sortText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
  differences.sort(
    (a, b) =>
      a.stainID - b.stainID ||
      sortText(a.field, b.field) ||
      sortText(a.locale ?? '', b.locale ?? ''),
  );
  sourceIssues.sort(
    (a, b) => a.key - b.key || sortText(a.code, b.code) || sortText(a.locale ?? '', b.locale ?? ''),
  );
  return {
    formatVersion: 1,
    pins: { ...snapshot.pins },
    counts: {
      sheetRows: snapshot.rows.length,
      candidates: candidates.length,
      localDyes: catalog.dyes.length,
    },
    candidateIds: candidates.map((row) => row.stainID),
    addedCandidateIds: candidates
      .filter((row) => !localIds.has(row.stainID))
      .map((row) => row.stainID),
    addedCandidates: candidates
      .filter((row) => !localIds.has(row.stainID))
      .map((row) => ({
        ...row,
        names: { ...row.names },
        items: row.items.map((item) => ({ ...item })),
      })),
    missingLocalIds: catalog.dyes.filter((dye) => !byId.has(dye.stainID)).map((dye) => dye.stainID),
    unnamedLocalIds: catalog.dyes
      .filter((dye) => byId.has(dye.stainID) && classifyRow(byId.get(dye.stainID)!) !== 'candidate')
      .map((dye) => dye.stainID),
    excludedRows: snapshot.rows.flatMap((row) => {
      const classification = classifyRow(row);
      return classification === 'candidate' ? [] : [{ stainID: row.stainID, classification }];
    }),
    sourceIssues,
    differences,
    observedItems: candidates.map((row) => ({
      stainID: row.stainID,
      items: row.items.map((item) => ({ ...item })),
    })),
    regionalLocales: { ko: 'not-supplied', zh: 'not-supplied' },
  };
}
