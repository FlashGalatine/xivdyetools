#!/usr/bin/env tsx
/**
 * Self-test for `check-doc-versions.ts`.
 *
 * The 2026-09-05 documentation audit found five hand-maintained version tables
 * (root `README.md`, `docs/versions.md`, `docs/index.md`, `docs/README.md`,
 * `docs/projects/index.md`) carrying four different snapshots, every one of them
 * behind `package.json`. The checker exists so the two tables that keep versions
 * cannot drift again; these tests exist so the checker cannot go vacuous — a gate
 * that finds zero claims because a table was reshaped would pass forever.
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
  { name: 'xivdyetools-web-app', dir: 'apps/web-app', version: '5.7.0' },
  { name: 'xivdyetools-oauth-worker', dir: 'apps/oauth', version: '3.1.0' },
];

test('a backticked package-name cell beside a version cell is a claim', () => {
  const md = [
    '| Project | Version | Package Name |',
    '|---|---|---|',
    '| **Web Application** | v5.7.0 | `xivdyetools-web-app` |',
  ].join('\n');
  const claims = extractDocVersions(md, 'x.md', workspaces);
  assert.deepEqual(claims, [
    { file: 'x.md', line: 3, workspace: 'xivdyetools-web-app', version: '5.7.0' },
  ]);
});

test('a link whose target is the workspace directory is a claim (root README shape)', () => {
  const md = '| [`@xivdyetools/core`](packages/core/) | 5.2.0 | Color algorithms |';
  const claims = extractDocVersions(md, 'README.md', workspaces);
  assert.equal(claims.length, 1);
  assert.equal(claims[0]?.workspace, '@xivdyetools/core');
  assert.equal(claims[0]?.version, '5.2.0');
});

test('the directory name alone resolves when the package name differs from it', () => {
  // apps/oauth publishes as xivdyetools-oauth-worker; the README links the directory.
  const md = '| [`oauth`](apps/oauth/) | 3.1.0 | Discord OAuth |';
  const claims = extractDocVersions(md, 'README.md', workspaces);
  assert.equal(claims[0]?.workspace, 'xivdyetools-oauth-worker');
});

test('bold markers around either cell are ignored', () => {
  const md = '| **`@xivdyetools/core`** | **v5.2.0** | x |';
  const claims = extractDocVersions(md, 'x.md', workspaces);
  assert.equal(claims[0]?.version, '5.2.0');
});

test('a version-history row is NOT a claim even when its prose names a package', () => {
  // The history tables pair a version with a date and a highlight; the highlight
  // routinely names *another* workspace. Only a cell that is exactly a workspace
  // reference counts, so this row must yield nothing.
  const md =
    '| **v5.7.0** | **Sep 2026** | **Backed by `@xivdyetools/core` 5.2.0 — five wheels** |';
  assert.deepEqual(extractDocVersions(md, 'x.md', workspaces), []);
});

test('a name that is not a workspace is ignored (retired packages, archived projects)', () => {
  const md = [
    '| @xivdyetools/crypto | v1.1.2 | `@xivdyetools/auth/encoding` |',
    '| xivdyetools-discord-bot | Archived | xivdyetools-discord-worker |',
  ].join('\n');
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
  assert.equal(found.length, 17, `expected 17 workspaces, found: ${names.join(', ')}`);
  for (const w of found) {
    assert.match(w.version, /^\d+\.\d+\.\d+$/, `${w.name} has a non-semver version`);
  }
});

test('the real docs agree with package.json, and docs/versions.md covers every workspace', () => {
  const result = runCheck();
  assert.deepEqual(result.mismatches, [], result.mismatches.join('\n'));
  assert.deepEqual(result.uncovered, [], `docs/versions.md has no row for: ${result.uncovered.join(', ')}`);
});

test('the gate cannot pass vacuously: an empty versions table is a failure, not a clean run', () => {
  const result = runCheck({ 'docs/versions.md': '# Version Matrix\n\nno tables here\n' });
  assert.ok(result.uncovered.length > 0);
  assert.equal(result.ok, false);
});

test('mutation: a wrong version in the real README shape is caught', () => {
  const real = readWorkspaceVersions();
  const core = real.find((w) => w.name === '@xivdyetools/core');
  assert.ok(core);
  const wrong = core.version === '0.0.1' ? '0.0.2' : '0.0.1';
  const md = `| [\`@xivdyetools/core\`](packages/core/) | ${wrong} | x |`;
  const claims = extractDocVersions(md, 'README.md', real);
  assert.equal(compareClaims(claims, real).length, 1);
});
