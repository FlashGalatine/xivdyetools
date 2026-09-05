#!/usr/bin/env tsx
/**
 * Self-test for `check-doc-links.ts`.
 *
 * A link gate that silently extracts nothing would pass forever, so beside the
 * unit cases these tests assert that the real living tier yields a large,
 * non-zero link count, and that a deliberately broken link is caught.
 *
 * @module scripts/check-doc-links.test
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  checkFile,
  extractRelativeLinks,
  livingTierFiles,
  maskCode,
  resolveTarget,
  runCheck,
} from './check-doc-links.js';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));

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

test('external, mailto, autolink and same-file anchor targets are ignored; fragments and queries are stripped', () => {
  const md =
    '[a](https://x.example/p.md) [b](mailto:x@y) [c](<https://z>) [d](#top) [e](guide.md#step-2) [f](guide.md?x=1) [g](../up.md "title")';
  const targets = extractRelativeLinks(maskCode(md)).map((l) => l.target);
  assert.deepEqual(targets, ['guide.md', 'guide.md', '../up.md']);
});

test('resolveTarget resolves relative to the document and treats a leading slash as the repo root', () => {
  assert.equal(resolveTarget('docs/projects/core/overview.md', '../../versions.md'), 'docs/versions.md');
  assert.equal(resolveTarget('docs/index.md', 'architecture/'), 'docs/architecture');
  assert.equal(resolveTarget('docs/index.md', '/apps/web-app/README.md'), 'apps/web-app/README.md');
  assert.equal(resolveTarget('README.md', 'docs/index.md'), 'docs/index.md');
  assert.equal(resolveTarget('docs/a.md', 'b%20c.md'), 'docs/b c.md');
});

test('checkFile reports a missing target with file, line and resolved path, and accepts directories', () => {
  const md = 'ok: [i](../docs/index.md) dir: [d](../docs/architecture/)\nbad: [m](../docs/does-not-exist.md)';
  const broken = checkFile('scripts/fixture.md', md);
  assert.equal(broken.length, 1);
  assert.equal(broken[0]?.line, 2);
  assert.equal(broken[0]?.resolved, 'docs/does-not-exist.md');
});

test('a link that escapes the repository root is broken', () => {
  const broken = checkFile('docs/index.md', '[x](../../outside.md)');
  assert.equal(broken.length, 1);
});

test('the real living tier resolves every relative link, and the gate actually saw links', () => {
  const result = runCheck();
  assert.deepEqual(
    result.broken.map((b) => `${b.file}:${b.line} → ${b.target}`),
    [],
    'broken links in the living tier',
  );
  assert.ok(result.files > 50, `expected many living-tier files, saw ${result.files}`);
  assert.ok(result.links > 200, `expected many links, saw ${result.links}`);
});

test('mutation: one dangling link in a real living-tier file turns the gate red', () => {
  const result = runCheck({ 'docs/index.md': '# x\n\n[gone](nowhere/at-all.md)\n' });
  assert.equal(result.ok, false);
  assert.equal(result.broken.length, 1);
  assert.equal(result.broken[0]?.file, 'docs/index.md');
});
