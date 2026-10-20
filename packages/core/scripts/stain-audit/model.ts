export const AUDIT_LIMITS = {
  pageRows: 100,
  maxPages: 20,
  maxBytes: 2 * 1024 * 1024,
  attemptMs: 15_000,
  maxAttempts: 3,
  gapMs: 250,
  runMs: 300_000,
} as const;
export const STAIN_ENDPOINT = 'https://v2.xivapi.com/api/sheet/Stain';
export const STAIN_FIELDS =
  'Name,Name@ja,Name@de,Name@fr,Color,Shade,SubOrder,IsMetallic,IsHousingApplicable,Item[].Name';
/** Private maintenance models; never exported by the runtime package. */
export const GLOBAL_LOCALES = ['en', 'ja', 'de', 'fr'] as const;
export type GlobalLocale = (typeof GLOBAL_LOCALES)[number];
export interface Pins {
  version: string;
  schema: string;
}
export interface StainRow {
  stainID: number;
  names: Record<GlobalLocale, string>;
  color: number;
  shade: number;
  subOrder: number;
  isMetallic: boolean;
  isHousingApplicable: boolean;
  items: { itemID: number; name: string }[];
}
export interface StainPage {
  pins: Pins;
  rows: StainRow[];
}
export interface DyeRules {
  metallicStainIds: number[];
  consolidatedIds: Record<'A' | 'B' | 'C', number | null>;
}
export interface LocalInputs {
  dyesJson: string;
  namesCsv: string;
  rulesJson: string;
}
export interface LocalDye {
  stainID: number;
  name: string;
  hex: string;
  category: string;
  acquisition: string;
  consolidationType: 'A' | 'B' | 'C' | null;
  legacyItemID: number | null;
}
export interface LocalCatalog {
  dyes: LocalDye[];
  names: { key: number; names: Record<GlobalLocale | 'ko' | 'zh', string> }[];
  rules: DyeRules;
}
export interface CompleteSnapshot {
  pins: Pins;
  rows: StainRow[];
  complete: true;
}
export interface CapturedPage {
  url: string;
  status: number;
  attempts: number;
  body: string;
  page: StainPage;
}
export interface Capture {
  pages: CapturedPage[];
  snapshot: CompleteSnapshot;
}
export interface SourceIssue {
  code: string;
  key: number;
  locale?: GlobalLocale | 'ko' | 'zh';
}
export interface Difference {
  stainID: number;
  field: 'jsonName' | 'csvName' | 'color' | 'metallic' | 'expectedItem';
  locale?: GlobalLocale;
  local: string | number | boolean;
  upstream: string | boolean | number[];
  kind: 'whitespace' | 'case' | 'value' | 'missing';
}
export interface Comparison {
  formatVersion: 1;
  pins: Pins;
  counts: { sheetRows: number; candidates: number; localDyes: number };
  candidateIds: number[];
  addedCandidateIds: number[];
  missingLocalIds: number[];
  unnamedLocalIds: number[];
  excludedRows: { stainID: number; classification: 'no-color' | 'blank' }[];
  sourceIssues: SourceIssue[];
  differences: Difference[];
  observedItems: { stainID: number; items: StainRow['items'] }[];
  regionalLocales: { ko: 'not-supplied'; zh: 'not-supplied' };
}

export function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error(`Invalid ${label}: expected object`);
  return value as Record<string, unknown>;
}
export function integer(value: unknown, label: string, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > max)
    throw new Error(`Invalid ${label}: expected nonnegative integer`);
  return value;
}
export function text(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`Invalid or missing ${label}: expected string`);
  return value;
}
function flag(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`Invalid or missing ${label}: expected boolean`);
  return value;
}
export function validatePage(value: unknown, expectedPins?: Pins): StainPage {
  const source = record(value, 'Stain page');
  const pins = { version: text(source.version, 'version'), schema: text(source.schema, 'schema') };
  if (!pins.version || !pins.schema) throw new Error('Missing version/schema pins');
  if (
    expectedPins &&
    (expectedPins.version !== pins.version || expectedPins.schema !== pins.schema)
  )
    throw new Error('Version/schema pin mismatch');
  if (!Array.isArray(source.rows)) throw new Error('Missing rows array');
  let last = -1;
  const rows = source.rows.map((value: unknown): StainRow => {
    const row = record(value, 'row');
    const stainID = integer(row.row_id, 'row ID');
    if (stainID <= last) throw new Error('Duplicate or unordered row IDs');
    last = stainID;
    const fields = record(row.fields, 'row fields');
    if (!Array.isArray(fields.Item)) throw new Error('Invalid or missing Item field');
    const items = fields.Item.map((value: unknown) => {
      const item = record(value, 'Item relation');
      const itemID = integer(item.row_id, 'Item ID');
      if (item.sheet !== 'Item' || item.value !== itemID)
        throw new Error('Invalid Item relation identity');
      return { itemID, name: text(record(item.fields, 'Item fields').Name, 'Item Name') };
    });
    return {
      stainID,
      names: {
        en: text(fields.Name, 'Name field'),
        ja: text(fields['Name@ja'], 'Name@ja field'),
        de: text(fields['Name@de'], 'Name@de field'),
        fr: text(fields['Name@fr'], 'Name@fr field'),
      },
      color: integer(fields.Color, 'Color field', 0xffffff),
      shade: integer(fields.Shade, 'Shade field'),
      subOrder: integer(fields.SubOrder, 'SubOrder field'),
      isMetallic: flag(fields.IsMetallic, 'IsMetallic field'),
      isHousingApplicable: flag(fields.IsHousingApplicable, 'IsHousingApplicable field'),
      items,
    };
  });
  return { pins, rows };
}
export function completeSnapshot(pages: readonly StainPage[]): CompleteSnapshot {
  const first = pages[0];
  if (!first || !first.rows.length || pages.length < 2)
    throw new Error('Incomplete scan: nonempty data and terminal empty page required');
  const rows: StainRow[] = [];
  let last = -1;
  pages.forEach((page, index) => {
    if (page.pins.version !== first.pins.version || page.pins.schema !== first.pins.schema)
      throw new Error('Snapshot pin mismatch');
    if ((page.rows.length === 0) !== (index === pages.length - 1))
      throw new Error('Incomplete scan: exactly one terminal empty page required');
    for (const row of page.rows) {
      if (row.stainID <= last) throw new Error('Duplicate or unordered IDs: scan made no progress');
      last = row.stainID;
      rows.push(row);
    }
  });
  return { pins: { ...first.pins }, rows, complete: true };
}
export function classifyRow(row: StainRow): 'no-color' | 'blank' | 'candidate' {
  if (row.stainID === 0) return 'no-color';
  return GLOBAL_LOCALES.some((locale) => row.names[locale].trim() !== '') ? 'candidate' : 'blank';
}

export function canonicalPins(value: unknown): Pins {
  const pins = record(value, 'pins');
  const version = text(pins.version, 'version');
  const schema = text(pins.schema, 'schema');
  if (!/^[0-9a-f]{16}$/.test(version) || !/^exdschema@2:rev:[0-9a-f]{40}$/.test(schema))
    throw new Error('Expected canonical game version and exdschema revision pins');
  return { version, schema };
}
