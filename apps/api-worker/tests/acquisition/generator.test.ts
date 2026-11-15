import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const schema = 'exdschema@2:rev:e773c41a90aed788cf4c1c48469fa85618ef01fb';
const root = resolve(import.meta.dirname, '../../../..');
const outputs = ['acquisition.en.json', 'facewear-unlocks.json', 'acquisition.meta.json'];
const data = join(root, 'apps/api-worker/src/chara/data');
const hash = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
const directories: string[] = [];
afterEach(() => {
  for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function run(args: string[]) {
  const dir = mkdtempSync(join(tmpdir(), 'acquisition-cli-'));
  directories.push(dir);
  const blocker = join(dir, 'block.mjs');
  const log = join(dir, 'network.log');
  writeFileSync(log, '');
  writeFileSync(
    blocker,
    `import {appendFileSync} from 'node:fs'; globalThis.fetch=async(url)=>{appendFileSync(process.env.ACQUISITION_NETWORK_LOG,String(url)+'\\n');throw new Error('FETCH_BLOCKED');};`,
  );
  for (const name of outputs) writeFileSync(join(dir, name), 'sentinel');
  const before = outputs.map((name) => hash(join(data, name)));
  const result = spawnSync(
    process.execPath,
    [
      '--import',
      'tsx',
      '--import',
      pathToFileURL(blocker).href,
      'apps/api-worker/scripts/build-acquisition.ts',
      '--out-dir',
      dir,
      ...args,
    ],
    {
      cwd: root,
      encoding: 'utf8',
      timeout: 15000,
      env: { ...process.env, ACQUISITION_NETWORK_LOG: log },
    },
  );
  expect(result.error).toBeUndefined();
  expect(result.stderr).not.toMatch(
    /ERR_MODULE_NOT_FOUND|ERR_UNSUPPORTED_ESM_URL_SCHEME|SyntaxError/,
  );
  expect(result.status).not.toBe(0);
  expect(readFileSync(log, 'utf8')).toBe('');
  expect(outputs.map((name) => readFileSync(join(dir, name), 'utf8'))).toEqual([
    'sentinel',
    'sentinel',
    'sentinel',
  ]);
  expect(outputs.map((name) => hash(join(data, name)))).toEqual(before);
  return `${result.stdout}${result.stderr}`;
}

describe('acquisition generator preflight and offline boundary', () => {
  it('refuses a schema override that conflicts with verified metadata before any fetch', () => {
    expect(run(['--pinned', '--schema', `exdschema@2:rev:${'1'.repeat(40)}`])).toMatch(/conflict/i);
  });
  it('refuses a moving schema selector during pinned replay', () => {
    expect(run(['--pinned', '--schema', 'latest'])).toMatch(/schema/i);
  });
  it('requires a cache directory in offline mode', () => {
    expect(run(['--pinned', '--schema', schema, '--offline'])).toMatch(/cache/i);
  });
  it('fails an offline cache miss without live fallback or partial output adoption', () => {
    const cache = mkdtempSync(join(tmpdir(), 'acquisition-empty-cache-'));
    directories.push(cache);
    expect(run(['--pinned', '--schema', schema, '--offline', '--cache-dir', cache])).toMatch(
      /cache|offline/i,
    );
  });
  it('rejects unknown options instead of silently doing a live refresh', () => {
    expect(run(['--offlinee'])).toMatch(/unknown|unsupported/i);
  });
  it('requires option values before any network or output work', () => {
    expect(run(['--cache-dir'])).toMatch(/value|requires/i);
  });
});
