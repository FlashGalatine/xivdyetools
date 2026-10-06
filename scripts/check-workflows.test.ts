#!/usr/bin/env tsx
/**
 * Self-test for the workflow invariants BUG-152 / BUG-153 fixed. These live in
 * YAML that no unit test reads, so a revert would otherwise pass every gate.
 * Plain text matching on purpose: the repo has no YAML dependency at the root.
 *
 * @module scripts/check-workflows.test
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../.github/workflows/', import.meta.url));
const read = (f: string): string => readFileSync(dir + f, 'utf8').replace(/\r\n/g, '\n');

/** Entries of the `push:` trigger's `paths:` list (comments skipped). */
function pushPaths(yaml: string): string[] {
  const lines = yaml.split('\n');
  const start = lines.findIndex((l) => /^ {2}push:\s*$/.test(l));
  if (start < 0) return [];
  const out: string[] = [];
  let inPaths = false;
  for (const line of lines.slice(start + 1)) {
    if (/^ {2}\S/.test(line) || /^\S/.test(line)) break; // next trigger or top-level key
    if (/^ {4}paths:\s*$/.test(line)) {
      inPaths = true;
      continue;
    }
    if (/^ {4}\S/.test(line)) inPaths = false;
    const m = inPaths ? /^ {6}- '?([^'#\s]+)'?/.exec(line) : null;
    if (m?.[1]) out.push(m[1]);
  }
  return out;
}

const ROOT_INPUTS = ['pnpm-lock.yaml', 'pnpm-workspace.yaml', 'turbo.json', 'tsconfig.base.json'];
const deploys = readdirSync(dir).filter((f) => /^deploy-.*\.yml$/.test(f));

test('BUG-153: the deploy workflow set is the 8 production + 3 beta files', () => {
  assert.ok(deploys.length >= 11, `found ${deploys.join(', ')}`);
});

for (const file of deploys) {
  test(`BUG-153: ${file} push.paths lists every root bundle input`, () => {
    const paths = pushPaths(read(file));
    assert.ok(paths.length > 0, 'no push.paths parsed');
    for (const input of ROOT_INPUTS) assert.ok(paths.includes(input), `${input} missing`);
  });
}

test('BUG-152: ci.yml cancels only superseded pull_request runs', () => {
  const yaml = read('ci.yml');
  const block = yaml.slice(yaml.indexOf('\nconcurrency:'));
  const group = /^ {2}group: (.+)$/m.exec(block)?.[1] ?? '';
  const cancel = /^ {2}cancel-in-progress: (.+)$/m.exec(block)?.[1] ?? '';
  assert.match(cancel, /github\.event_name == 'pull_request'/);
  assert.match(group, /github\.run_id/, 'non-PR runs need a group of their own');
});
