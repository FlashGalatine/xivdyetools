#!/usr/bin/env node
/**
 * Build the Korean / Chinese equipment-name tables for `/v1/chara/resolve`.
 *
 * XIVAPI v2 serves en/ja/de/fr only; the regional clients' names come from the
 * community datamining exports (same Item row IDs as global — see
 * docs/research/chara-equipment-resolution/README.md §7.1). This script is a
 * BUILD-TIME step: run it by hand after a patch, commit the JSON, deploy.
 * Nothing here runs at request time and the worker never fetches GitHub.
 *
 *   node scripts/build-item-names.mjs            # writes src/chara/data/item-names.{ko,zh}.json
 *   FFXIV_DATAMINING_DIR=C:/dev/xivapi/ffxiv-datamining node scripts/build-item-names.mjs
 *
 * Inputs
 *   - Item.csv (global, SaintCoinach 3-header CSV) — decides which rows are
 *     EQUIPPABLE (EquipSlotCategory != 0) so the tables stay ~200 KB gz each
 *     instead of the full 52k-row sheet. Read from a local ffxiv-datamining
 *     clone when present, else fetched from GitHub raw.
 *   - Teamcraft `ko-items.json` / `zh-items.json` (flat `{ "<id>": { ko } }`),
 *     built by Teamcraft from ffxiv-datamining-ko / -cn. Easiest ID-keyed
 *     source; falls back to EN per item where a regional name is missing
 *     (brand-new-patch items lag the regional clients by weeks to months).
 *
 * Output: `{ "<itemId>": "<name>" }`, ids ascending, minified; plus
 * `item-names.meta.json` recording when/what was built.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, '..', 'src', 'chara', 'data');

const DATAMINING_DIR = process.env.FFXIV_DATAMINING_DIR ?? 'C:/dev/xivapi/ffxiv-datamining';
const ITEM_CSV_LOCAL = join(DATAMINING_DIR, 'csv', 'en', 'Item.csv');
const ITEM_CSV_REMOTE = 'https://raw.githubusercontent.com/xivapi/ffxiv-datamining/master/csv/Item.csv';
const TEAMCRAFT_BASE =
  'https://raw.githubusercontent.com/ffxiv-teamcraft/ffxiv-teamcraft/staging/libs/data/src/lib/json';
const SOURCES = {
  ko: `${TEAMCRAFT_BASE}/ko/ko-items.json`,
  zh: `${TEAMCRAFT_BASE}/zh/zh-items.json`,
};
const UA = 'xivdyetools-build-item-names/1.0 (https://xivdyetools.app)';

/** Minimal RFC-4180 CSV parser — SaintCoinach quotes fields containing commas/newlines. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.text();
}

async function loadItemCsv() {
  if (existsSync(ITEM_CSV_LOCAL)) {
    console.log(`Item.csv: local ${ITEM_CSV_LOCAL}`);
    return readFileSync(ITEM_CSV_LOCAL, 'utf8');
  }
  console.log(`Item.csv: fetching ${ITEM_CSV_REMOTE}`);
  return fetchText(ITEM_CSV_REMOTE);
}

/** Row ids whose EquipSlotCategory is non-zero — the equippable subset. */
function equippableIds(csvText) {
  const rows = parseCsv(csvText.replace(/^\uFEFF/, ''));
  // xivapi/ffxiv-datamining ships a one-header CSV (names on line 1); raw
  // SaintCoinach exports carry three (key / names / types). Find the names
  // row by content and treat every later row with an integer key as data.
  const headerIndex = rows.findIndex((r) => r.includes('EquipSlotCategory'));
  if (headerIndex < 0) throw new Error('Item.csv: no EquipSlotCategory column in any header row');
  const col = rows[headerIndex].indexOf('EquipSlotCategory');
  const ids = new Set();
  for (const row of rows.slice(headerIndex + 1)) {
    const id = Number(row[0]);
    if (row[0] === '' || !Number.isInteger(id)) continue;
    if (row[col] !== undefined && row[col] !== '' && row[col] !== '0') ids.add(id);
  }
  return ids;
}

/** Strip SaintCoinach inline tag markup and soft hyphens; collapse whitespace. */
function cleanName(name) {
  return name
    .replace(/<[^>]*>/g, '')
    .replace(/\u00AD/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function buildTable(lang, ids) {
  const raw = JSON.parse(await fetchText(SOURCES[lang]));
  const out = {};
  let missing = 0;
  for (const id of [...ids].sort((a, b) => a - b)) {
    const entry = raw[String(id)];
    const name = entry && typeof entry[lang] === 'string' ? cleanName(entry[lang]) : '';
    if (name) out[String(id)] = name;
    else missing++;
  }
  return { table: out, missing };
}

async function main() {
  const ids = equippableIds(await loadItemCsv());
  console.log(`equippable rows: ${ids.size}`);
  mkdirSync(OUT_DIR, { recursive: true });
  const meta = {
    generated: new Date().toISOString().slice(0, 10),
    equippable: ids.size,
    sources: { itemCsv: existsSync(ITEM_CSV_LOCAL) ? 'local ffxiv-datamining clone' : ITEM_CSV_REMOTE, ...SOURCES },
    counts: {},
  };
  for (const lang of ['ko', 'zh']) {
    const { table, missing } = await buildTable(lang, ids);
    const file = join(OUT_DIR, `item-names.${lang}.json`);
    writeFileSync(file, JSON.stringify(table));
    const bytes = Buffer.byteLength(JSON.stringify(table));
    meta.counts[lang] = { named: Object.keys(table).length, missing, bytes };
    console.log(`${lang}: ${Object.keys(table).length} named, ${missing} missing → ${file} (${(bytes / 1024).toFixed(0)} KB)`);
  }
  writeFileSync(join(OUT_DIR, 'item-names.meta.json'), JSON.stringify(meta, null, 2) + '\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
