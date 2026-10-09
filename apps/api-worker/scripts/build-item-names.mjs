#!/usr/bin/env node
/**
 * Build the equipment-name tables in `src/chara/data/`.
 *
 * - `item-names.{ko,zh}.json` — the Korean / Chinese names `/v1/chara/resolve`
 *   merges into its answer (`regional-names.ts` imports them). XIVAPI v2
 *   serves en/ja/de/fr only; the regional clients' names come from the
 *   community datamining exports (same Item row IDs as global — see
 *   docs/research/chara-equipment-resolution/README.md §7.1).
 * - `item-names.ja.json` — the Japanese names, as BUILD-TIME DATA ONLY.
 *   api-worker never imports it: `/v1/chara/resolve` keeps taking `ja` from
 *   XIVAPI v2 (`Name@ja`) at request time. It exists for discord-worker,
 *   whose `scripts/subset-cjk-fonts.py` cuts the JP font subset from it and
 *   whose `item-name-coverage.test.ts` gates that subset against it, so
 *   /glamour draws every Japanese item name in Japanese letterforms. The
 *   global client carries Japanese, so the names come straight from the same
 *   global export XIVAPI serves (`csv/ja/Item.csv`); there is no Teamcraft step.
 *
 * This script is a BUILD-TIME step: run it by hand after a patch, commit the
 * JSON, deploy, and re-cut discord-worker's CJK subsets. Nothing here runs at
 * request time and the worker never fetches GitHub.
 *
 *   node scripts/build-item-names.mjs            # all three: ko, zh, ja
 *   node scripts/build-item-names.mjs ja         # only the languages named
 *   FFXIV_DATAMINING_DIR=C:/dev/xivapi/ffxiv-datamining node scripts/build-item-names.mjs
 *
 * Inputs
 *   - Item.csv (global client, `csv/<lang>/Item.csv` in xivapi/ffxiv-datamining)
 *     — decides which rows are EQUIPPABLE (EquipSlotCategory != 0) so the
 *     tables stay ~200 KB gz each instead of the full 52k-row sheet; the `ja`
 *     copy also supplies the Japanese names, so a ja row's name and its
 *     equippable flag always come from one patch. Read from a local clone
 *     (FFXIV_DATAMINING_DIR) when present, else fetched from GitHub raw at the
 *     commit `master` points to (recorded in the meta). A local clone is only
 *     as new as its last pull — check it is on the patch XIVAPI `latest` serves.
 *   - Teamcraft `ko-items.json` / `zh-items.json` (flat `{ "<id>": { ko } }`),
 *     built by Teamcraft from ffxiv-datamining-ko / -cn. Easiest ID-keyed
 *     source; falls back to EN per item where a regional name is missing
 *     (brand-new-patch items lag the regional clients by weeks to months).
 *
 * Output: `{ "<itemId>": "<name>" }`, ids ascending, minified; plus
 * `item-names.meta.json` recording when/what was built. A run that names
 * languages rewrites only those tables and only their meta entries: ko/zh
 * share the top-level `generated` / `equippable` / `sources.itemCsv`, and ja
 * carries its own in `counts.ja` (its Item.csv may be from a newer patch).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, '..', 'src', 'chara', 'data');
const META_FILE = join(OUT_DIR, 'item-names.meta.json');

const DATAMINING_DIR = process.env.FFXIV_DATAMINING_DIR ?? 'C:/dev/xivapi/ffxiv-datamining';
const DATAMINING_REPO = 'xivapi/ffxiv-datamining';
// The repo keeps one folder per client language; the flat `csv/Item.csv` it
// used to carry is gone (404), so the remote path names the language too.
const itemCsvLocal = (lang) => join(DATAMINING_DIR, 'csv', lang, 'Item.csv');
const itemCsvRemote = (ref, lang) => `https://raw.githubusercontent.com/${DATAMINING_REPO}/${ref}/csv/${lang}/Item.csv`;
const TEAMCRAFT_BASE =
  'https://raw.githubusercontent.com/ffxiv-teamcraft/ffxiv-teamcraft/staging/libs/data/src/lib/json';
const SOURCES = {
  ko: `${TEAMCRAFT_BASE}/ko/ko-items.json`,
  zh: `${TEAMCRAFT_BASE}/zh/zh-items.json`,
};
/** Teamcraft-sourced tables that `regional-names.ts` imports. */
const REGIONAL = ['ko', 'zh'];
/** Every table this script can write, in build order. */
const LANGUAGES = [...REGIONAL, 'ja'];
const JA_NOTE =
  'Build-time data only: discord-worker cuts its JP font subset from item-names.ja.json ' +
  '(scripts/subset-cjk-fonts.py) and gates it (item-name-coverage.test.ts). api-worker does ' +
  'not import it; /v1/chara/resolve takes ja names from XIVAPI v2 (Name@ja) at request time.';
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

let dataminingRef;

/**
 * The commit `master` points to, so every remote CSV of one run comes from the
 * same revision and the meta records which. Falls back to `master` when the
 * GitHub API is unreachable or rate-limited.
 */
async function resolveDataminingRef() {
  if (dataminingRef) return dataminingRef;
  try {
    const res = await fetch(`https://api.github.com/repos/${DATAMINING_REPO}/commits/master`, {
      headers: { 'User-Agent': UA, Accept: 'application/vnd.github.sha' },
    });
    const sha = res.ok ? (await res.text()).trim() : '';
    dataminingRef = /^[0-9a-f]{40}$/.test(sha) ? sha : 'master';
  } catch {
    dataminingRef = 'master';
  }
  return dataminingRef;
}

/** `csv/<lang>/Item.csv` and where it came from (for the meta). */
async function loadItemCsv(lang) {
  const local = itemCsvLocal(lang);
  if (existsSync(local)) {
    console.log(`Item.csv (${lang}): local ${local}`);
    return { text: readFileSync(local, 'utf8'), source: 'local ffxiv-datamining clone' };
  }
  const url = itemCsvRemote(await resolveDataminingRef(), lang);
  console.log(`Item.csv (${lang}): fetching ${url}`);
  return { text: await fetchText(url), source: url };
}

/**
 * Rows whose EquipSlotCategory is non-zero — the equippable subset — mapped to
 * their `Name` column (the client language's name; `''` if the sheet has none).
 */
function equippableRows(csvText) {
  const rows = parseCsv(csvText.replace(/^\uFEFF/, ''));
  // xivapi/ffxiv-datamining ships a one-header CSV (names on line 1); raw
  // SaintCoinach exports carry three (key / names / types). Find the names
  // row by content and treat every later row with an integer key as data.
  const headerIndex = rows.findIndex((r) => r.includes('EquipSlotCategory'));
  if (headerIndex < 0) throw new Error('Item.csv: no EquipSlotCategory column in any header row');
  const col = rows[headerIndex].indexOf('EquipSlotCategory');
  const nameCol = rows[headerIndex].indexOf('Name');
  const out = new Map();
  for (const row of rows.slice(headerIndex + 1)) {
    const id = Number(row[0]);
    if (row[0] === '' || !Number.isInteger(id)) continue;
    if (row[col] !== undefined && row[col] !== '' && row[col] !== '0') {
      out.set(id, nameCol >= 0 ? (row[nameCol] ?? '') : '');
    }
  }
  return out;
}

/** Strip SaintCoinach inline tag markup and soft hyphens; collapse whitespace. */
function cleanName(name) {
  return name
    .replace(/<[^>]*>/g, '')
    .replace(/\u00AD/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** `{ "<id>": cleaned name }` for every id with a non-empty name, ids ascending. */
function tableFrom(ids, nameOf) {
  const out = {};
  let missing = 0;
  for (const id of [...ids].sort((a, b) => a - b)) {
    const raw = nameOf(id);
    const name = typeof raw === 'string' ? cleanName(raw) : '';
    if (name) out[String(id)] = name;
    else missing++;
  }
  return { table: out, missing };
}

async function buildRegionalTable(lang, ids) {
  const raw = JSON.parse(await fetchText(SOURCES[lang]));
  return tableFrom(ids, (id) => raw[String(id)]?.[lang]);
}

/** Write one table; returns its counts entry. */
function writeTable(lang, { table, missing }) {
  const file = join(OUT_DIR, `item-names.${lang}.json`);
  const json = JSON.stringify(table);
  writeFileSync(file, json);
  const bytes = Buffer.byteLength(json);
  const named = Object.keys(table).length;
  console.log(`${lang}: ${named} named, ${missing} missing → ${file} (${(bytes / 1024).toFixed(0)} KB)`);
  return { named, missing, bytes };
}

function selectedLanguages(args) {
  const unknown = args.filter((lang) => !LANGUAGES.includes(lang));
  if (unknown.length > 0) {
    throw new Error(`unknown language(s): ${unknown.join(', ')} — expected any of ${LANGUAGES.join(', ')}`);
  }
  return args.length > 0 ? LANGUAGES.filter((lang) => args.includes(lang)) : LANGUAGES;
}

async function main() {
  const langs = selectedLanguages(process.argv.slice(2));
  const today = new Date().toISOString().slice(0, 10);
  mkdirSync(OUT_DIR, { recursive: true });
  // A run that names languages must keep what earlier runs recorded for the rest.
  const meta = existsSync(META_FILE) ? JSON.parse(readFileSync(META_FILE, 'utf8')) : {};
  meta.sources ??= {};
  meta.counts ??= {};

  const regional = langs.filter((lang) => REGIONAL.includes(lang));
  if (regional.length > 0) {
    const csv = await loadItemCsv('en');
    const ids = new Set(equippableRows(csv.text).keys());
    console.log(`equippable rows (en): ${ids.size}`);
    meta.generated = today;
    meta.equippable = ids.size;
    meta.sources.itemCsv = csv.source;
    for (const lang of regional) {
      meta.counts[lang] = writeTable(lang, await buildRegionalTable(lang, ids));
      meta.sources[lang] = SOURCES[lang];
    }
  }

  if (langs.includes('ja')) {
    const csv = await loadItemCsv('ja');
    const rows = equippableRows(csv.text);
    console.log(`equippable rows (ja): ${rows.size}`);
    // The table stands in for what /v1/chara/resolve serves, and xivapi.ts
    // cleans Name@ja only of soft hyphens and edge whitespace. A name that
    // cleanName changes beyond that (markup, an ideographic space collapsed
    // to ASCII) would gate a string the bot never receives. None did at 7.56.
    const altered = [...rows.values()].filter((raw) => raw && cleanName(raw) !== raw.replace(/­/g, '').trim());
    if (altered.length > 0) {
      console.warn(`ja: cleanName rewrote ${altered.length} name(s) beyond XIVAPI's own cleaning, e.g. ${JSON.stringify(altered[0])}`);
    }
    meta.counts.ja = { ...writeTable('ja', tableFrom(rows.keys(), (id) => rows.get(id))), equippable: rows.size, generated: today };
    meta.sources.ja = csv.source;
    meta.notes = { ...meta.notes, ja: JA_NOTE };
  }

  writeFileSync(META_FILE, JSON.stringify(meta, null, 2) + '\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
