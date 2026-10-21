import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const tsx = createRequire(import.meta.url).resolve('tsx/cli');
const cli = fileURLToPath(new URL('./audit-dyes.ts', import.meta.url));
const frozen = fileURLToPath(new URL('./stain-audit/fixtures/2026-10-20/bundle', import.meta.url));
let root: string;
function run(args: string[]) {
  return spawnSync(process.execPath, [tsx, cli, ...args], {
    cwd: root,
    encoding: 'utf8',
    timeout: 30_000,
    env: {
      ...process.env,
      NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --require ${JSON.stringify(join(root, 'deny-network.cjs').replaceAll('\\', '/'))}`,
    },
  });
}
function digest(path: URL): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}
beforeEach(async () => {
  root = await fs.mkdtemp(join(tmpdir(), 'xiv-stain-cli-'));
  await fs.writeFile(
    join(root, 'deny-network.cjs'),
    `globalThis.fetch = () => { require('node:fs').appendFileSync(${JSON.stringify(join(root, 'network-used'))}, 'fetch'); throw new Error('Network forbidden by test'); };`,
  );
});
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('audit:dyes CLI', () => {
  it('prints help without fetching or creating output', async () => {
    const result = run(['--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('--snapshot');
    await expect(fs.access(join(root, 'network-used'))).rejects.toThrow();
  });
  it.each(
    [
      [],
      ['--latest'],
      ['--wat'],
      ['--version', 'latest', '--schema', 'latest', '--out', 'x'],
      ['--latest', '--snapshot', frozen, '--out', 'x'],
      ['--latest', '--latest', '--out', 'x'],
      ['--version', 'abc', '--out', 'x'],
    ].map((args) => ({ args })),
  )('rejects invalid usage $args before side effects', async ({ args }) => {
    const result = run(args);
    expect(result.status).toBe(2);
    await expect(fs.access(join(root, 'network-used'))).rejects.toThrow();
    expect(await fs.readdir(root)).toEqual(['deny-network.cjs']);
  });
  it('replays the saved baseline from another cwd without source edits or any fetch', async () => {
    const files = [
      '../src/data/dyes.json',
      '../dyenames.csv',
      '../src/config/dye-vocabulary.ts',
      '../src/config/consolidated-ids.ts',
      '../src/data/facewear_colors.json',
      '../src/config/facewear.ts',
      ...['en', 'ja', 'de', 'fr', 'ko', 'zh'].map((locale) => `../src/data/locales/${locale}.json`),
    ].map((path) => new URL(path, import.meta.url));
    const frozenFiles = [
      'manifest.json',
      'report.json',
      'REPORT.md',
      'inputs/dyes.json',
      'inputs/dyenames.csv',
      'inputs/rules.json',
      ...[1, 2, 3].map((n) => `raw/stain-page-${String(n).padStart(4, '0')}.json`),
    ].map((path) => new URL(`./stain-audit/fixtures/2026-10-20/bundle/${path}`, import.meta.url));
    const frozenBefore = frozenFiles.map(digest);
    const before = files.map(digest);
    const out = join(root, 'report');
    const relativeOut = relative(fileURLToPath(new URL('../../../', import.meta.url)), out);
    const result = run(['--snapshot', frozen, '--out', relativeOut]);
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('129');
    expect(result.stdout).toContain('125');
    expect(result.stdout).toMatch(/review/i);
    expect(await fs.readFile(join(out, 'report.json'), 'utf8')).toBe(
      await fs.readFile(join(frozen, 'report.json'), 'utf8'),
    );
    expect(files.map(digest)).toEqual(before);
    expect(frozenFiles.map(digest)).toEqual(frozenBefore);
    await expect(fs.access(join(root, 'network-used'))).rejects.toThrow();
    const repeated = run(['--snapshot', frozen, '--out', out]);
    expect(repeated.status).toBe(1);
  });
  it('returns failure for a missing/partial capture without live fallback or output', async () => {
    const out = join(root, 'report');
    const result = run(['--snapshot', root, '--out', out]);
    expect(result.status).toBe(1);
    await expect(fs.access(out)).rejects.toThrow();
    await expect(fs.access(join(root, 'network-used'))).rejects.toThrow();
  });
  it('leaves no output when the explicit live scan fails', async () => {
    const out = join(root, 'report');
    const result = run(['--latest', '--out', out]);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/incomplete/i);
    expect(result.stderr).toContain('Network forbidden by test');
    expect(await fs.readFile(join(root, 'network-used'), 'utf8')).toBe('fetchfetchfetch');
    await expect(fs.access(out)).rejects.toThrow();
  });
});
