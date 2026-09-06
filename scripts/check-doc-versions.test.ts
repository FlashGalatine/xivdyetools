#!/usr/bin/env tsx
/**
 * Self-test for `check-doc-versions.ts`.
 *
 * The 2026-09-05 documentation audit found five hand-maintained version tables
 * (root `README.md`, `docs/versions.md`, `docs/index.md`, `docs/README.md`,
 * `docs/projects/index.md`) carrying four different snapshots, every one of them
 * behind `package.json`. The checker exists so the two tables that keep versions
 * cannot drift again; these tests exist so the checker cannot go vacuous — a gate
 * that finds zero claims because a table was reshaped would pass forever — and so
 * the history and Deprecated tables never produce false reds.
 *
 * @module scripts/check-doc-versions.test
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  compareClaims,
  extractDocVersions,
  readWorkspaceVersions,
  runCheck,
  type WorkspaceVersion,
} from './check-doc-versions.js';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));

const workspaces: WorkspaceVersion[] = [
  { name: '@xivdyetools/core', dir: 'packages/core', version: '5.2.0' },
  { name: '@xivdyetools/svg', dir: 'packages/svg', version: '4.1.0' },
  { name: '@xivdyetools/worker-kit', dir: 'packages/worker-kit', version: '1.3.0' },
  { name: 'xivdyetools-web-app', dir: 'apps/web-app', version: '5.7.0' },
  { name: 'xivdyetools-oauth-worker', dir: 'apps/oauth', version: '3.1.0' },
];

const table = (header: string, ...rows: string[]): string =>
  [header, header.replace(/[^|]/g, '-'), ...rows].join('\n');

test('a Version column plus a Package Name cell is a claim (docs/versions.md shape)', () => {
  const md = table(
    '| Project | Version | Package Name | Platform |',
    '| **Web Application** | v5.7.0 | `xivdyetools-web-app` | Pages |',
  );
  assert.deepEqual(extractDocVersions(md, 'x.md', workspaces), [
    { file: 'x.md', line: 3, workspace: 'xivdyetools-web-app', version: '5.7.0' },
  ]);
});

test('a first-cell link whose target is the workspace directory is a claim (root README shape)', () => {
  const md = table(
    '| Package | Version | Description |',
    '| [`@xivdyetools/core`](packages/core/) | 5.2.0 | Color algorithms |',
  );
  const claims = extractDocVersions(md, 'README.md', workspaces);
  assert.equal(claims[0]?.workspace, '@xivdyetools/core');
  assert.equal(claims[0]?.version, '5.2.0');
});

test('the link target resolves even when the package name differs from the directory', () => {
  // apps/oauth publishes as xivdyetools-oauth-worker; the README links the directory.
  const md = table(
    '| App | Version | Description |',
    '| [`oauth`](apps/oauth/) | 3.1.0 | Discord OAuth |',
  );
  assert.equal(
    extractDocVersions(md, 'README.md', workspaces)[0]?.workspace,
    'xivdyetools-oauth-worker',
  );
});

test('a bare leaf name is NOT a workspace reference — only the package name or a directory link is', () => {
  const md = table('| Project | Version |', '| core | 1.0.0 |', '| `svg` | 1.0.0 |');
  assert.deepEqual(extractDocVersions(md, 'x.md', workspaces), []);
});

test('bold markers around either cell are ignored', () => {
  const md = table('| Package | Version |', '| **`@xivdyetools/core`** | **v5.2.0** |');
  assert.equal(extractDocVersions(md, 'x.md', workspaces)[0]?.version, '5.2.0');
});

test('a version-history row never claims, even when its highlight is exactly a backticked package', () => {
  // History tables have a Version column but the version is the FIRST cell and
  // the only name-shaped cell is prose — or, in the worst case, a lone package
  // name in the Highlights column, which is not a name column.
  const md = table(
    '| Version | Date | Highlights |',
    '| **v5.7.0** | **Sep 2026** | **Backed by `@xivdyetools/core` 5.2.0 — five wheels** |',
    '| **v5.5.1** | Sep 2026 | **`@xivdyetools/svg`** |',
  );
  assert.deepEqual(extractDocVersions(md, 'x.md', workspaces), []);
});

test('the Deprecated table (Last Version, not Version) never claims — even without trailing prose', () => {
  const md = table(
    '| Project | Last Version | Replacement |',
    '| @xivdyetools/worker-middleware | v1.2.0 | `@xivdyetools/worker-kit` |',
    '| @xivdyetools/rate-limiter | v1.5.0 | `@xivdyetools/worker-kit` (2026-07-31) |',
  );
  assert.deepEqual(extractDocVersions(md, 'x.md', workspaces), []);
});

test('a table inside a fenced code block is an example, not a claim', () => {
  const md = [
    '```markdown',
    '| Package | Version |',
    '|---|---|',
    '| [`@xivdyetools/core`](packages/core/) | 1.0.0 |',
    '```',
  ].join('\n');
  assert.deepEqual(extractDocVersions(md, 'x.md', workspaces), []);
});

test('a table without a Version column never claims', () => {
  const md = table('| Package | Current | Notes |', '| `@xivdyetools/core` | 1.0.0 | x |');
  assert.deepEqual(extractDocVersions(md, 'x.md', workspaces), []);
});

test('compareClaims reports every mismatch with file and line, and nothing else', () => {
  const claims = [
    { file: 'a.md', line: 3, workspace: '@xivdyetools/core', version: '5.2.0' },
    { file: 'a.md', line: 4, workspace: 'xivdyetools-web-app', version: '5.0.0' },
  ];
  const mismatches = compareClaims(claims, workspaces);
  assert.equal(mismatches.length, 1);
  assert.match(mismatches[0] ?? '', /a\.md:4/);
  assert.match(mismatches[0] ?? '', /xivdyetools-web-app/);
  assert.match(mismatches[0] ?? '', /5\.0\.0/);
  assert.match(mismatches[0] ?? '', /5\.7\.0/);
});

test('readWorkspaceVersions finds every package and app in this repository', () => {
  const found = readWorkspaceVersions();
  const names = found.map((w) => w.name).sort();
  // 8 packages + 9 apps today; a new workspace may only raise this.
  assert.ok(found.length >= 17, `expected at least 17 workspaces, found: ${names.join(', ')}`);
  for (const w of found) {
    assert.match(w.version, /^\d+\.\d+\.\d+$/, `${w.name} has a non-semver version`);
  }
});

test('the real docs agree with package.json, and BOTH checked files cover every workspace', () => {
  const result = runCheck();
  assert.deepEqual(result.mismatches, [], result.mismatches.join('\n'));
  assert.deepEqual(result.uncovered, [], `missing rows: ${result.uncovered.join(', ')}`);
});

test('the gate cannot pass vacuously: an emptied versions.md is a failure, not a clean run', () => {
  const result = runCheck({ 'docs/versions.md': '# Version Matrix\n\nno tables here\n' });
  assert.ok(result.uncovered.length > 0);
  assert.equal(result.ok, false);
});

test('the gate cannot pass vacuously: a README with no version table is a failure too', () => {
  const result = runCheck({ 'README.md': '# XIV Dye Tools\n\nno tables here\n' });
  assert.ok(result.uncovered.some((u) => u.startsWith('README.md:')));
  assert.equal(result.ok, false);
});

test('mutation: a wrong version in the real README shape is caught', () => {
  const real = readWorkspaceVersions();
  const core = real.find((w) => w.name === '@xivdyetools/core');
  assert.ok(core);
  const wrong = core.version === '0.0.1' ? '0.0.2' : '0.0.1';
  const md = table(
    '| Package | Version | Description |',
    `| [\`@xivdyetools/core\`](packages/core/) | ${wrong} | x |`,
  );
  const claims = extractDocVersions(md, 'README.md', real);
  assert.equal(compareClaims(claims, real).length, 1);
});
