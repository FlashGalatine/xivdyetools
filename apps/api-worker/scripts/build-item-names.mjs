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
 *     equippable flag always come from one patch. Read pinned HEAD blobs from
 *     a local clone (FFXIV_DATAMINING_DIR) when present, else fetch at the
 *     resolved `master` commit. No branch fallback is allowed. A local clone
 *     is only as new as its last pull — check its patch against XIVAPI `latest`.
 *   - Teamcraft `ko-items.json` / `zh-items.json` (flat `{ "<id>": { ko } }`),
 *     built by Teamcraft from ffxiv-datamining-ko / -cn. Easiest ID-keyed
 *     source, pinned to one resolved staging commit per run. Missing names
 *     are omitted and counted, leaving runtime fallback to EN (brand-new-patch
 *     items lag the regional clients by weeks to months).
 *
 * Output: `{ "<itemId>": "<name>" }`, ids ascending, minified; plus
 * `item-names.meta.json` recording when/what was built. A run that names
 * languages rewrites only those tables and their per-language meta entries.
 * Legacy shared metadata is preserved; new provenance and generation counts
 * belong to each affected language (ja may use a different Item.csv).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanName as cleanRuntimeName } from '../src/chara/name-cleaner.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, '..', 'src', 'chara', 'data');
const META_FILE = join(OUT_DIR, 'item-names.meta.json');

const DATAMINING_DIR = process.env.FFXIV_DATAMINING_DIR ?? 'C:/dev/xivapi/ffxiv-datamining';
const DATAMINING_REPO = 'xivapi/ffxiv-datamining';
// The repo keeps one folder per client language; the flat `csv/Item.csv` it
// used to carry is gone (404), so the remote path names the language too.
const itemCsvRemote = (ref, lang) => `https://raw.githubusercontent.com/${DATAMINING_REPO}/${ref}/csv/${lang}/Item.csv`;
const TEAMCRAFT_REPO = 'ffxiv-teamcraft/ffxiv-teamcraft';
const regionalPath = (lang) => `libs/data/src/lib/json/${lang}/${lang}-items.json`;
// Real Item.csv blobs exceed execFileSync's default 1 MiB capture limit.
const MAX_GIT_BYTES = 128 * 1024 * 1024;
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
  let afterQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
          afterQuote = true;
        }
      } else {
        field += ch;
      }
    } else if (afterQuote && ch !== ',' && ch !== '\n' && ch !== '\r') {
      throw new Error('Item.csv: unexpected character after closing quote');
    } else if (ch === '"') {
      if (field !== '') throw new Error('Item.csv: unexpected quote in unquoted field');
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
      afterQuote = false;
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      afterQuote = false;
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  if (inQuotes) throw new Error('Item.csv: unterminated quoted field');
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

async function fetchBytes(url, accept) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, ...(accept ? { Accept: accept } : {}) } });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

let dataminingRef;
let teamcraftRef;

function decode(bytes) {
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

function validateCommit(ref) {
  const sha = decode(ref).trim();
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error('Source commit must be a lowercase 40-character SHA');
  return sha;
}

async function resolveRemoteCommit(repository, branch) {
  return validateCommit(await fetchBytes(
    `https://api.github.com/repos/${repository}/commits/${branch}`,
    'application/vnd.github.sha',
  ));
}

function gitRead(args) {
  // Arguments are passed directly, never through a shell; no repository mutation.
  return execFileSync('git', ['-C', DATAMINING_DIR, ...args], { maxBuffer: MAX_GIT_BYTES });
}

function provenance(bytes, repository, path, commit, url) {
  return {
    kind: url ? 'github' : 'local-git', repository, path, commit,
    ...(url ? { url } : {}),
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

/** `csv/<lang>/Item.csv` and where it came from (for the meta). */
async function loadItemCsv(lang) {
  const local = existsSync(DATAMINING_DIR);
  dataminingRef ??= local
    ? validateCommit(gitRead(['rev-parse', '--verify', 'HEAD^{commit}']))
    : await resolveRemoteCommit(DATAMINING_REPO, 'master');
  const path = `csv/${lang}/Item.csv`;
  const url = local ? undefined : itemCsvRemote(dataminingRef, lang);
  // Read the immutable object, never attribute arbitrary working-tree bytes to HEAD.
  const bytes = local
    ? gitRead(['show', '--no-ext-diff', `${dataminingRef}:${path}`])
    : await fetchBytes(url);
  console.log(`Item.csv (${lang}): ${local ? 'local pinned Git blob' : url}`);
  return { text: decode(bytes), source: provenance(bytes, DATAMINING_REPO, path, dataminingRef, url) };
}

function validId(value) {
  return /^(0|[1-9][0-9]*)$/.test(value) && Number.isSafeInteger(Number(value));
}

function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateRegional(raw, lang) {
  if (!record(raw)) throw new Error(`${lang}: expected an item-name object`);
  for (const [id, entry] of Object.entries(raw)) {
    if (!validId(id) || !record(entry)) throw new Error(`${lang}: invalid item ID or entry`);
    if (Object.hasOwn(entry, lang) && typeof entry[lang] !== 'string') {
      throw new Error(`${lang}: item ${id} name must be a string when present`);
    }
  }
  return raw;
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
  if (nameCol < 0) throw new Error('Item.csv: no Name column');
  const out = new Map();
  const seen = new Set();
  for (const [index, row] of rows.slice(headerIndex + 1).entries()) {
    if (row.length === 1 && row[0] === '') continue;
    // Raw SaintCoinach exports have one types row immediately after the names.
    if (headerIndex > 0 && index === 0 && /^(u?int(8|16|32|64))$/.test(row[0])) continue;
    if (!validId(row[0]) || row.length !== rows[headerIndex].length || !validId(row[col])) {
      throw new Error('Item.csv: invalid item ID, equipment category or row shape');
    }
    const id = Number(row[0]);
    if (seen.has(id)) throw new Error(`Item.csv: duplicate item ID ${id}`);
    seen.add(id);
    if (row[col] !== '0') {
      out.set(id, row[nameCol]);
    }
  }
  return out;
}

/** Preserve builder markup removal, then enforce the shared runtime name boundary. */
function cleanName(name) {
  return cleanRuntimeName(name.replace(/<[^>]*>/g, ''));
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
  teamcraftRef ??= await resolveRemoteCommit(TEAMCRAFT_REPO, 'staging');
  const path = regionalPath(lang);
  const url = `https://raw.githubusercontent.com/${TEAMCRAFT_REPO}/${teamcraftRef}/${path}`;
  const bytes = await fetchBytes(url);
  const raw = validateRegional(JSON.parse(decode(bytes)), lang);
  return {
    ...tableFrom(ids, (id) => raw[String(id)]?.[lang]),
    source: provenance(bytes, TEAMCRAFT_REPO, path, teamcraftRef, url),
  };
}

/** Serialize before any write; every source must pass acquisition and validation. */
function stageTable({ table, missing }, equippable, generated) {
  const json = JSON.stringify(table);
  const bytes = Buffer.byteLength(json);
  const named = Object.keys(table).length;
  return { json, counts: { named, missing, bytes, equippable, generated } };
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
  // A run that names languages must keep what earlier runs recorded for the rest.
  const meta = existsSync(META_FILE) ? JSON.parse(readFileSync(META_FILE, 'utf8')) : {};
  if (!record(meta)) throw new Error('Invalid existing metadata');
  meta.sources ??= {};
  meta.counts ??= {};
  if (!record(meta.sources) || !record(meta.counts) || (meta.notes !== undefined && !record(meta.notes))) {
    throw new Error('Invalid existing metadata records');
  }
  const pending = new Map();

  const regional = langs.filter((lang) => REGIONAL.includes(lang));
  if (regional.length > 0) {
    const csv = await loadItemCsv('en');
    const ids = new Set(equippableRows(csv.text).keys());
    console.log(`equippable rows (en): ${ids.size}`);
    for (const lang of regional) {
      const built = await buildRegionalTable(lang, ids);
      const staged = stageTable(built, ids.size, today);
      pending.set(lang, staged);
      meta.counts[lang] = staged.counts;
      meta.sources[lang] = { items: built.source, itemCsv: csv.source };
    }
  }

  if (langs.includes('ja')) {
    const csv = await loadItemCsv('ja');
    const rows = equippableRows(csv.text);
    console.log(`equippable rows (ja): ${rows.size}`);
    const staged = stageTable(tableFrom(rows.keys(), (id) => rows.get(id)), rows.size, today);
    pending.set('ja', staged);
    meta.counts.ja = staged.counts;
    meta.sources.ja = { itemCsv: csv.source };
    meta.notes = { ...meta.notes, ja: JA_NOTE };
  }

  const metadataJson = JSON.stringify(meta, null, 2) + '\n';
  mkdirSync(OUT_DIR, { recursive: true });
  for (const [lang, { json, counts }] of pending) {
    const file = join(OUT_DIR, `item-names.${lang}.json`);
    writeFileSync(file, json, 'utf8');
    console.log(`${lang}: ${counts.named} named, ${counts.missing} missing → ${file} (${(counts.bytes / 1024).toFixed(0)} KB)`);
  }
  writeFileSync(META_FILE, metadataJson, 'utf8');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
