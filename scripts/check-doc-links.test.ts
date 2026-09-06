#!/usr/bin/env tsx
/**
 * Self-test for `check-doc-links.ts` (and the shared `markdown-mask.ts`).
 *
 * A link gate that silently extracts nothing would pass forever, so beside the
 * unit cases these tests assert that the real tree yields a large, non-zero link
 * count, and that a deliberately broken link is caught.
 *
 * @module scripts/check-doc-links.test
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  checkFile,
  extractRelativeLinks,
  listTracked,
  livingTierFiles,
  resolveTarget,
  runCheck,
  trackedPathSet,
} from './check-doc-links.js';
import { maskCode } from './markdown-mask.js';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));

const known = trackedPathSet(listTracked());

test('livingTierFiles keeps docs/ minus the two archives, root files, and app/package README+CLAUDE', () => {
  const tracked = [
    'docs/index.md',
    'docs/architecture/overview.md',
    'docs/audits/2026-09-01-dead-code/README.md',
    'docs/historical/index.md',
    'docs/research/index.md',
    'README.md',
    'CLAUDE.md',
    'DEPRECATIONS.md',
    'SECURITY.md',
    'CHANGELOG.md',
    'apps/web-app/README.md',
    'apps/web-app/CLAUDE.md',
    'apps/web-app/scripts/README.md',
    'packages/core/CLAUDE.md',
    'packages/core/src/index.ts',
  ];
  assert.deepEqual(livingTierFiles(tracked), [
    'docs/index.md',
    'docs/architecture/overview.md',
    'docs/research/index.md',
    'README.md',
    'CLAUDE.md',
    'DEPRECATIONS.md',
    'SECURITY.md',
    'apps/web-app/README.md',
    'apps/web-app/CLAUDE.md',
    'packages/core/CLAUDE.md',
  ]);
});

test('maskCode blanks fenced blocks and inline spans without changing line numbers', () => {
  const text = 'a [x](one.md)\n```md\n[q](quoted.md)\n```\nb `[i](inline.md)` [y](two.md)';
  const masked = maskCode(text);
  assert.equal(masked.split('\n').length, text.split('\n').length);
  const targets = extractRelativeLinks(masked).map((l) => `${l.line}:${l.target}`);
  assert.deepEqual(targets, ['1:one.md', '5:two.md']);
});

test('maskCode pairs fences by character and length — a ````markdown wrapper around a ```md example is one block', () => {
  const text = [
    '````markdown',
    '```md',
    '[inside](gone-in-code.md)',
    '```',
    '````',
    '[after](real.md)',
  ].join('\n');
  const targets = extractRelativeLinks(maskCode(text)).map((l) => l.target);
  assert.deepEqual(targets, ['real.md']);
});

test('maskCode does not let a closed block plus an unclosed block swallow the rest of the file', () => {
  const text = [
    '```sh',
    'echo',
    '```',
    'text [live](live.md)',
    '```json',
    '{',
    '[not-a-link](x.md)',
  ].join('\n');
  const targets = extractRelativeLinks(maskCode(text)).map((l) => l.target);
  assert.deepEqual(targets, ['live.md']);
});

test('maskCode blanks HTML comments, including multi-line ones, so parked links are not checked', () => {
  const text =
    'keep [k](keep.md)\n<!-- parked: [old](deleted-page.md)\n[also](gone.md) -->\nafter [a](after.md)';
  const masked = maskCode(text);
  assert.equal(masked.split('\n').length, 4);
  assert.deepEqual(
    extractRelativeLinks(masked).map((l) => l.target),
    ['keep.md', 'after.md'],
  );
});

test('external, mailto, autolink and same-file anchor targets are ignored; fragments and queries are stripped', () => {
  const md =
    '[a](https://x.example/p.md) [b](mailto:x@y) [c](<https://z>) [d](#top) [e](guide.md#step-2) [f](guide.md?x=1) [g](../up.md "title")';
  const targets = extractRelativeLinks(maskCode(md)).map((l) => l.target);
  assert.deepEqual(targets, ['guide.md', 'guide.md', '../up.md']);
});

test('angle-bracketed destinations (spaces allowed) and one level of balanced parentheses are read', () => {
  const md = '[a](<docs/my file.md>) [b](notes_(draft).md) [c](<docs/gone.md>)';
  const targets = extractRelativeLinks(maskCode(md)).map((l) => l.target);
  assert.deepEqual(targets, ['docs/my file.md', 'notes_(draft).md', 'docs/gone.md']);
});

test('resolveTarget resolves relative to the document and treats a leading slash as the repo root', () => {
  assert.equal(
    resolveTarget('docs/projects/core/overview.md', '../../versions.md'),
    'docs/versions.md',
  );
  assert.equal(resolveTarget('docs/index.md', 'architecture/'), 'docs/architecture');
  assert.equal(resolveTarget('docs/index.md', '/apps/web-app/README.md'), 'apps/web-app/README.md');
  assert.equal(resolveTarget('README.md', 'docs/index.md'), 'docs/index.md');
  assert.equal(resolveTarget('docs/a.md', 'b%20c.md'), 'docs/b c.md');
});

test('trackedPathSet holds every tracked file and the directories it implies, exact case', () => {
  const set = trackedPathSet(['docs/a/b/c.md', 'README.md']);
  for (const p of ['docs/a/b/c.md', 'docs/a/b', 'docs/a', 'docs', 'README.md'])
    assert.ok(set.has(p), p);
  assert.ok(!set.has('DOCS/a/b/c.md'), 'lookup is case-sensitive');
  assert.ok(!set.has('docs/a/b/other.md'));
});

test('checkFile reports a missing target with file, line and resolved path, and accepts tracked directories', () => {
  const md =
    'ok: [i](../docs/index.md) dir: [d](../docs/architecture/)\nbad: [m](../docs/does-not-exist.md)';
  const { links, broken } = checkFile('scripts/fixture.md', md, known);
  assert.equal(links, 3);
  assert.equal(broken.length, 1);
  assert.equal(broken[0]?.line, 2);
  assert.equal(broken[0]?.resolved, 'docs/does-not-exist.md');
});

test('a target that differs from the tracked path only by case is broken (github.com and Linux CI are case-sensitive)', () => {
  const { broken } = checkFile('docs/index.md', '[v](VERSIONS.md)', known);
  assert.equal(broken.length, 1);
  assert.equal(broken[0]?.resolved, 'docs/VERSIONS.md');
});

test('a link that escapes the repository root is broken, and is reported with its ../ path', () => {
  const { broken } = checkFile('docs/index.md', '[x](../../outside.md)', known);
  assert.equal(broken.length, 1);
  assert.ok(broken[0]?.resolved.startsWith('..'), broken[0]?.resolved);
});

test('the real tree resolves every relative link, and the gate actually saw links', () => {
  const result = runCheck();
  assert.deepEqual(
    result.broken.map((b) => `${b.file}:${b.line} → ${b.target}`),
    [],
    'broken links',
  );
  // 234 files / 860+ links at the time of writing; a shrinking tree may only lower these slowly.
  assert.ok(result.files > 150, `expected many documents, saw ${result.files}`);
  assert.ok(result.links > 500, `expected many links, saw ${result.links}`);
});

test('mutation: one dangling link in a real document turns the gate red', () => {
  const result = runCheck({ 'docs/index.md': '# x\n\n[gone](nowhere/at-all.md)\n' });
  assert.equal(result.ok, false);
  assert.equal(result.broken.length, 1);
  assert.equal(result.broken[0]?.file, 'docs/index.md');
});
