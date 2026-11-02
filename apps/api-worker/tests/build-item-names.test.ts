import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const app = dirname(dirname(fileURLToPath(import.meta.url)));
const roots: string[] = [];
const dataSha = 'a'.repeat(40);
const teamSha = 'b'.repeat(40);
const dataRepo = 'xivapi/ffxiv-datamining';
const teamRepo = 'ffxiv-teamcraft/ffxiv-teamcraft';
const csv = Buffer.from('\uFEFF#,Name,EquipSlotCategory\r\n20,English,1\r\n3,Third,1\r\n4,Not equipment,0\r\n5,Missing,1\r\n', 'utf8');
const japanese = Buffer.from('#,Name,EquipSlotCategory\r\n3,"<i>刀</i>\t\u200f名",1\r\n20,"日本,刀",1\r\n5,,1\r\n');
const korean = Buffer.from('\uFEFF' + JSON.stringify({ 20: { ko: '<i>한</i>\u0001\u0080\u200f\u202e\u2066\u00ad\t 이름' }, 3: { ko: '😀'.repeat(129) } }) + '\r\n');
const chinese = Buffer.from(JSON.stringify({ 3: { zh: '中文' }, 20: { zh: '刀' }, 5: {} }) + '\r\n');
const api = (repo: string, branch: string) => `https://api.github.com/repos/${repo}/commits/${branch}`;
const csvUrl = (sha: string, lang: string) => `https://raw.githubusercontent.com/${dataRepo}/${sha}/csv/${lang}/Item.csv`;
const itemUrl = (sha: string, lang: string) => `https://raw.githubusercontent.com/${teamRepo}/${sha}/libs/data/src/lib/json/${lang}/${lang}-items.json`;
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
interface Reply { bytes: string; status?: number; error?: string }
interface FixtureConfig {
  routes: Record<string, Reply>;
  local: boolean;
  localSha: string;
  blobs: Record<string, string>;
  gitFailure?: string;
}
interface Call { kind: 'fetch' | 'git'; url?: string; args?: string[]; maxBuffer?: number }
const reply = (bytes: Buffer | string): Reply => ({ bytes: Buffer.from(bytes).toString('base64') });

// Every child runs the byte-identical production CLI and cleaner in an isolated tree.
// The preload rejects any unlisted network/Git access, including accidental real fetches.
function fixture(local = false) {
  const root = mkdtempSync(join(tmpdir(), 'xiv-item-builder-'));
  roots.push(root);
  const scripts = join(root, 'scripts');
  const out = join(root, 'src/chara/data');
  const repo = join(root, 'private-user-local-clone');
  mkdirSync(scripts, { recursive: true });
  mkdirSync(out, { recursive: true });
  copyFileSync(join(app, 'scripts/build-item-names.mjs'), join(scripts, 'build-item-names.mjs'));
  copyFileSync(join(app, 'src/chara/name-cleaner.mjs'), join(root, 'src/chara/name-cleaner.mjs'));
  expect(readFileSync(join(scripts, 'build-item-names.mjs'))).toEqual(readFileSync(join(app, 'scripts/build-item-names.mjs')));
  if (local) {
    mkdirSync(join(repo, 'csv/en'), { recursive: true });
    writeFileSync(join(repo, 'csv/en/Item.csv'), '#,Name,EquipSlotCategory\n99,DIRTY NAME,1\n');
  }
  const oldMeta = {
    generated: '2026-08-21', equippable: 999,
    sources: { itemCsv: 'legacy local clone', ko: 'legacy-ko', zh: { existing: 'zh provenance' }, ja: 'legacy-ja' },
    counts: { ko: { named: 10 }, zh: { named: 11, generated: 'old-zh' }, ja: { named: 12 } },
    notes: { ja: 'historical-ja-note', extra: 'keep' }, extra: { untouched: true },
  };
  for (const lang of ['ko', 'zh', 'ja']) writeFileSync(join(out, `item-names.${lang}.json`), JSON.stringify({ 999: `historic ${lang}` }));
  writeFileSync(join(out, 'item-names.meta.json'), JSON.stringify(oldMeta, null, 2) + '\n');
  const config: FixtureConfig = {
    local, localSha: dataSha,
    blobs: { 'csv/en/Item.csv': csv.toString('base64'), 'csv/ja/Item.csv': japanese.toString('base64') },
    routes: {
      [api(dataRepo, 'master')]: reply(dataSha), [api(teamRepo, 'staging')]: reply(teamSha),
      [csvUrl(dataSha, 'en')]: reply(csv), [csvUrl(dataSha, 'ja')]: reply(japanese),
      [itemUrl(teamSha, 'ko')]: reply(korean), [itemUrl(teamSha, 'zh')]: reply(chinese),
      // Original implementation can run far enough to produce assertion failures.
      [itemUrl('staging', 'ko')]: reply(korean), [itemUrl('staging', 'zh')]: reply(chinese),
      [csvUrl('master', 'en')]: reply(csv), [csvUrl('master', 'ja')]: reply(japanese),
    },
  };
  const preload = join(root, 'offline.cjs');
  writeFileSync(preload, `const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const { syncBuiltinESMExports } = require('node:module');
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixture.json'), 'utf8'));
const calls = [];
function record(call) { calls.push(call); fs.writeFileSync(path.join(__dirname, 'calls.json'), JSON.stringify(calls)); }
global.fetch = async (url) => {
  record({ kind: 'fetch', url: String(url) });
  const result = config.routes[String(url)];
  if (!result) throw Error('Unlisted offline URL: ' + url);
  if (result.error) throw Error(result.error);
  return new Response(Buffer.from(result.bytes, 'base64'), { status: result.status || 200 });
};
cp.execFileSync = (command, args, options) => {
  record({ kind: 'git', args, maxBuffer: options?.maxBuffer });
  if (command !== 'git' || !config.local || config.gitFailure) throw Error(config.gitFailure || 'Unexpected Git call');
  if (args.slice(2).join(' ') === 'rev-parse --verify HEAD^{commit}') return Buffer.from(config.localSha + '\\n');
  if (args[2] === 'show' && args[3] === '--no-ext-diff') {
    const spec = args[4];
    if (!spec.startsWith(config.localSha + ':')) throw Error('Unpinned Git blob');
    const blob = config.blobs[spec.slice(41)];
    if (blob === undefined) throw Error('Missing Git blob');
    const bytes = Buffer.from(blob, 'base64');
    if (bytes.length > (options?.maxBuffer || 1024 * 1024)) throw Error('Git capture too small');
    return bytes;
  }
  throw Error('Unexpected Git arguments: ' + JSON.stringify(args));
};
syncBuiltinESMExports();
`, 'utf8');
  const files = ['item-names.ko.json', 'item-names.zh.json', 'item-names.ja.json', 'item-names.meta.json'];
  const snapshot = () => files.map((file) => readFileSync(join(out, file)).toString('base64'));
  const before = snapshot();
  return {
    config, out, oldMeta, before, snapshot,
    table: (lang: string): Record<string, string> => JSON.parse(readFileSync(join(out, `item-names.${lang}.json`), 'utf8')),
    meta: () => JSON.parse(readFileSync(join(out, 'item-names.meta.json'), 'utf8')) as typeof oldMeta & { sources: Record<string, unknown>; counts: Record<string, unknown> },
    run: (...langs: string[]) => {
      writeFileSync(join(root, 'fixture.json'), JSON.stringify(config));
      const result = spawnSync(process.execPath, ['--require', preload, join(scripts, 'build-item-names.mjs'), ...langs], {
        env: { ...process.env, FFXIV_DATAMINING_DIR: repo, NODE_OPTIONS: '' }, encoding: 'utf8', timeout: 10_000,
      });
      if (result.error) throw result.error;
      const calls: Call[] = (() => { try { return JSON.parse(readFileSync(join(root, 'calls.json'), 'utf8')); } catch { return []; } })();
      return { status: result.status, output: result.stdout + result.stderr, calls };
    },
  };
}

afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

describe('offline item-name production CLI', () => {
  it('pins each repository once, hashes exact BOM/CRLF bytes and sanitizes all emitted names', () => {
    const f = fixture();
    const result = f.run();
    expect(result.status, result.output).toBe(0);
    const urls = result.calls.filter((call) => call.kind === 'fetch').map((call) => call.url);
    expect(urls).toEqual([api(dataRepo, 'master'), csvUrl(dataSha, 'en'), api(teamRepo, 'staging'), itemUrl(teamSha, 'ko'), itemUrl(teamSha, 'zh'), csvUrl(dataSha, 'ja')]);
    expect(f.table('ko')).toEqual({ 3: '😀'.repeat(128), 20: '한 이름' });
    expect(f.table('zh')).toEqual({ 3: '中文', 20: '刀' });
    expect(f.table('ja')).toEqual({ 3: '刀 名', 20: '日本,刀' });
    expect(readFileSync(join(f.out, 'item-names.ko.json'), 'utf8')).toMatch(/^\{"3":/);
    const meta = f.meta();
    expect(meta.sources.ko).toEqual({ items: { kind: 'github', repository: teamRepo, path: 'libs/data/src/lib/json/ko/ko-items.json', commit: teamSha, url: itemUrl(teamSha, 'ko'), sha256: sha256(korean) }, itemCsv: { kind: 'github', repository: dataRepo, path: 'csv/en/Item.csv', commit: dataSha, url: csvUrl(dataSha, 'en'), sha256: sha256(csv) } });
    expect(meta.sources.zh).toMatchObject({ items: { commit: teamSha, sha256: sha256(chinese) }, itemCsv: { commit: dataSha, sha256: sha256(csv) } });
    expect(meta.sources.ja).toMatchObject({ itemCsv: { commit: dataSha, sha256: sha256(japanese), url: csvUrl(dataSha, 'ja') } });
    expect(meta.counts.ko).toMatchObject({ named: 2, missing: 1, equippable: 3, bytes: Buffer.byteLength(JSON.stringify(f.table('ko'))) });
    expect(meta.notes.ja).toContain('Build-time data only');
  });

  it.each(['ko', 'ja'])('preserves all untouched %s-only language data and legacy shared metadata', (lang) => {
    const f = fixture();
    const result = f.run(lang);
    expect(result.status, result.output).toBe(0);
    const meta = f.meta();
    for (const untouched of ['ko', 'zh', 'ja'].filter((value) => value !== lang)) {
      expect(f.table(untouched)).toEqual({ 999: `historic ${untouched}` });
      const index = ['ko', 'zh', 'ja'].indexOf(untouched);
      expect(f.snapshot()[index]).toBe(f.before[index]);
      expect(meta.sources[untouched]).toEqual(f.oldMeta.sources[untouched as 'ko']);
      expect(meta.counts[untouched]).toEqual(f.oldMeta.counts[untouched as 'ko']);
    }
    expect(meta.generated).toBe(f.oldMeta.generated);
    expect(meta.equippable).toBe(f.oldMeta.equippable);
    expect(meta.sources.itemCsv).toBe(f.oldMeta.sources.itemCsv);
    expect(meta.extra).toEqual(f.oldMeta.extra);
    expect(meta.notes.extra).toBe('keep');
    if (lang === 'ko') expect(meta.notes.ja).toBe('historical-ja-note');
    if (lang === 'ja') expect(result.calls.some((call) => call.url?.includes(teamRepo))).toBe(false);
  });

  it('consumes pinned local blobs, ignores dirty working-tree bytes and supports CSVs above 1 MiB', () => {
    const f = fixture(true);
    const largeCsv = Buffer.concat([csv, Buffer.from('6,' + 'X'.repeat(1_100_000) + ',0\r\n')]);
    f.config.blobs['csv/en/Item.csv'] = largeCsv.toString('base64');
    const result = f.run('ko', 'ja');
    expect(result.status, result.output).toBe(0);
    expect(f.table('ko')).toHaveProperty('20', '한 이름');
    expect(f.table('ko')).not.toHaveProperty('99');
    const calls = result.calls.filter((call) => call.kind === 'git');
    expect(calls).toHaveLength(3);
    expect(calls[0]?.args?.slice(2)).toEqual(['rev-parse', '--verify', 'HEAD^{commit}']);
    expect(calls[1]?.args?.slice(2)).toEqual(['show', '--no-ext-diff', `${dataSha}:csv/en/Item.csv`]);
    expect(calls[1]?.maxBuffer).toBeGreaterThan(largeCsv.length);
    expect(f.meta().sources.ko).toMatchObject({ itemCsv: { kind: 'local-git', repository: dataRepo, path: 'csv/en/Item.csv', commit: dataSha, sha256: sha256(largeCsv) } });
    expect(f.meta().sources.ja).toMatchObject({ itemCsv: { kind: 'local-git', path: 'csv/ja/Item.csv', commit: dataSha, sha256: sha256(japanese) } });
    expect(JSON.stringify(f.meta())).not.toContain('private-user-local-clone');
    expect(result.calls.some((call) => call.url?.includes(`/repos/${dataRepo}/`))).toBe(false);
  });

  it.each(['data', 'team'] as const)('fails closed on invalid/unavailable %s commit without fallback or writes', (source) => {
    for (const mode of ['invalid', 'uppercase', 'http', 'network']) {
      const f = fixture();
      const url = source === 'data' ? api(dataRepo, 'master') : api(teamRepo, 'staging');
      f.config.routes[url] = mode === 'invalid' ? reply('master') : mode === 'uppercase' ? reply(dataSha.toUpperCase()) : mode === 'http' ? { ...reply('rate limit'), status: 403 } : { ...reply(''), error: 'network failure' };
      const result = f.run('ko');
      expect(result.status, mode + result.output).toBe(1);
      expect(f.snapshot()).toEqual(f.before);
      expect(result.calls.some((call) => call.url === csvUrl('master', 'en') || call.url === itemUrl('staging', 'ko'))).toBe(false);
    }
  });

  it.each(['invalid-head', 'git-failure', 'missing-blob'])('rejects local %s before any writes', (mode) => {
    const f = fixture(true);
    if (mode === 'invalid-head') f.config.localSha = 'master';
    if (mode === 'git-failure') f.config.gitFailure = 'not a repository';
    if (mode === 'missing-blob') delete f.config.blobs['csv/en/Item.csv'];
    const result = f.run('ko');
    expect(result.status, result.output).toBe(1);
    expect(f.snapshot()).toEqual(f.before);
    expect(result.calls.some((call) => call.url?.includes(dataRepo))).toBe(false);
    if (mode === 'invalid-head') {
      expect(result.output).toContain('Source commit must');
      expect(result.calls.filter((call) => call.kind === 'git')).toHaveLength(1);
    }
  });

  it('does not write earlier tables when a later source fails', () => {
    const f = fixture();
    f.config.routes[itemUrl(teamSha, 'zh')] = { ...reply('unavailable'), status: 503 };
    // Also target the original branch URL, proving original partial writes.
    f.config.routes[itemUrl('staging', 'zh')] = { ...reply('unavailable'), status: 503 };
    const result = f.run('ko', 'zh');
    expect(result.status).toBe(1);
    expect(f.snapshot()).toEqual(f.before);
  });

  it.each(['[]', 'null', '{"3":{"ko":42}}', '{"3":null}', '{"-1":{"ko":"bad"}}', '{"1e3":{"ko":"bad"}}', '{"3":{"ko":{"nested":true}}}', '{broken'])('rejects malformed regional input %s without changing outputs', (body) => {
    const f = fixture();
    f.config.routes[itemUrl(teamSha, 'ko')] = reply(body);
    f.config.routes[itemUrl('staging', 'ko')] = reply(body);
    const result = f.run('ko');
    expect(result.status, result.output).toBe(1);
    expect(f.snapshot()).toEqual(f.before);
  });

  it.each(['#,Name,EquipSlotCategory\n-1,bad,1\n', '#,Name,EquipSlotCategory\n3,bad,garbage\n', '#,Name,EquipSlotCategory\n3,"unterminated,1\n', '#,EquipSlotCategory\n3,1\n', '#,Name,EquipSlotCategory\n3,first,1\n3,duplicate,1\n'])('rejects invalid CSV without changing outputs (%s)', (body) => {
    const f = fixture();
    f.config.routes[csvUrl(dataSha, 'en')] = reply(body);
    const result = f.run('ko');
    expect(result.status, result.output).toBe(1);
    expect(f.snapshot()).toEqual(f.before);
  });

  it('retains SaintCoinach three-header CSV grammar, escaped quotes and embedded newlines', () => {
    const f = fixture();
    const body = Buffer.from('key,0,1\n#,Name,EquipSlotCategory\nint32,str,byte\n3,"<i>日本</i>\n""刀""",1\n20,Other,0\n');
    f.config.routes[csvUrl(dataSha, 'ja')] = reply(body);
    const result = f.run('ja');
    expect(result.status, result.output).toBe(0);
    expect(f.table('ja')).toEqual({ 3: '日本 "刀"' });
  });

  it('rejects malformed UTF-8 before output rather than trusting replacement characters', () => {
    const f = fixture();
    f.config.routes[csvUrl(dataSha, 'ja')] = reply(Buffer.from([0xff, 0xfe, 0x61]));
    const result = f.run('ko', 'ja');
    expect(result.status).toBe(1);
    expect(f.snapshot()).toEqual(f.before);
  });

  it('rejects unknown language arguments without any acquisition or writes', () => {
    const f = fixture();
    const result = f.run('bad');
    expect(result.status).toBe(1);
    expect(result.output).toContain('unknown language');
    expect(result.calls).toEqual([]);
    expect(f.snapshot()).toEqual(f.before);
  });
});
