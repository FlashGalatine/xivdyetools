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

/** The beta guard job's `DEPLOY_PATHS:` value, split into pathspecs. */
function guardPaths(yaml: string): string[] {
  const value = /^ {10}DEPLOY_PATHS: (.+)$/m.exec(yaml)?.[1] ?? '';
  return value.trim().split(/\s+/).filter(Boolean);
}
/** A `push.paths` glob as the git pathspec the guard uses: `apps/x/**` is `apps/x`. */
const asPathspec = (glob: string): string => glob.replace(/\/\*\*$/, '');
const betas = deploys.filter((f) => /-beta\.yml$/.test(f));

test('Beta guard: there are 3 beta deploy workflows', () => {
  assert.equal(betas.length, 3, `found ${betas.join(', ')}`);
});

// A push filter sees only the pushed commits, so merging main into a branch used
// to redeploy the shared betas; each beta workflow now runs a `changes` job that
// diffs the branch against its merge base on main. These pin that design.
for (const file of betas) {
  const yaml = read(file);

  test(`Beta guard: ${file} guard pathspec mirrors push.paths`, () => {
    const filter = pushPaths(yaml)
      .filter((p) => !p.startsWith('!'))
      .map(asPathspec);
    assert.deepEqual([...guardPaths(yaml)].sort(), [...filter].sort());
  });

  test(`Beta guard: ${file} leaves out CLAUDE.md and README.md in the filter and the guard`, () => {
    const negated = pushPaths(yaml).filter((p) => p.startsWith('!'));
    assert.deepEqual([...negated].sort(), ['!**/CLAUDE.md', '!**/README.md']);
    for (const name of ['CLAUDE.md', 'README.md']) {
      assert.ok(yaml.includes(`':(exclude,glob)**/${name}'`), `the guard does not exclude ${name}`);
    }
  });

  test(`Beta guard: ${file} deploy waits on the guard and holds the concurrency group`, () => {
    assert.doesNotMatch(
      yaml,
      /^concurrency:/m,
      'workflow-level concurrency lets a skipping run cancel a real deploy',
    );
    const deploy = yaml.slice(yaml.indexOf('\n  deploy:\n'));
    assert.match(deploy, /^ {4}needs: changes$/m);
    assert.match(deploy, /^ {4}if: needs\.changes\.outputs\.deploy == 'true'$/m);
    assert.match(deploy, /^ {4}concurrency:$/m);
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
