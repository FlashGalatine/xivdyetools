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
/** One job's lines, from its `  <name>:` key to the next job or top-level key. */
function jobBlock(yaml: string, name: string): string {
  const lines = yaml.split('\n');
  const start = lines.findIndex((l) => new RegExp(`^ {2}${name}:\\s*(#.*)?$`).test(l));
  if (start < 0) return '';
  const end = lines.findIndex((l, i) => i > start && /^ {0,2}[A-Za-z_][\w-]*:/.test(l));
  return lines.slice(start, end < 0 ? undefined : end).join('\n');
}
const betas = deploys.filter((f) => /-beta\.yml$/.test(f));

test('Beta guard: there are 3 beta deploy workflows', () => {
  assert.equal(betas.length, 3, `found ${betas.join(', ')}`);
});

// A push filter sees only the pushed commits, so merging main into a branch used
// to redeploy the shared betas; each beta workflow now runs a `changes` job that
// diffs the branch against its merge base on main. These pin that design.
for (const file of betas) {
  const yaml = read(file);

  test(`Release preparation: ${file} excludes isolated release-cut pushes`, () => {
    const push = /^ {2}push:\n([\s\S]*?)(?=^ {2}\S|^\S)/m.exec(yaml)?.[1] ?? '';
    const branches = /^ {4}branches-ignore:\n([\s\S]*?)(?=^ {4}\S)/m.exec(push)?.[1] ?? '';
    assert.match(branches, /^ {6}- 'codex\/release-cut-\*'$/m);
  });

  test(`Beta guard: ${file} guard pathspec mirrors push.paths`, () => {
    const filter = pushPaths(yaml)
      .filter((p) => !p.startsWith('!'))
      .map(asPathspec);
    assert.deepEqual([...guardPaths(yaml)].sort(), [...filter].sort());
  });

  test(`Beta guard: ${file} leaves out CLAUDE.md and README.md, last in the filter`, () => {
    const paths = pushPaths(yaml);
    const negated = paths.filter((p) => p.startsWith('!'));
    assert.deepEqual([...negated].sort(), ['!**/CLAUDE.md', '!**/README.md']);
    // GitHub reads the list in order: a positive pattern after a `!` one matches the file again.
    assert.deepEqual(paths.slice(-negated.length), negated, 'the `!` patterns must come last');
  });

  // Anchored at the step's indentation, so a commented-out or echoed copy cannot pass.
  test(`Beta guard: ${file} guard script keeps its shape`, () => {
    const changes = jobBlock(yaml, 'changes');
    assert.match(changes, /^ {10}fetch-depth: 0$/m, 'the merge base needs full history');
    assert.match(changes, /^ {10}EVENT: \$\{\{ github\.event_name \}\}$/m);
    assert.match(
      changes,
      /^ {10}if \[ "\$EVENT" = workflow_dispatch \]; then\n {12}echo "deploy=true" >> "\$GITHUB_OUTPUT"\n {12}exit 0$/m,
      'a manual run must always deploy',
    );
    assert.match(
      changes,
      /^ {10}if ! base=\$\(git merge-base origin\/main HEAD\); then\n {12}echo "::warning::.+"\n {12}echo "deploy=true" >> "\$GITHUB_OUTPUT"\n {12}exit 0$/m,
      'a branch with no merge base must deploy',
    );
    // The deploy job reads this output; a lost id or mapping skips every deploy.
    assert.match(changes, /^ {6}deploy: \$\{\{ steps\.diff\.outputs\.deploy \}\}$/m);
    assert.match(changes, /^ {8}id: diff$/m);
    // Without --quiet, git diff exits 0 and every push skips its deploy.
    const diff =
      /^ {10}if git diff --quiet "\$base" HEAD -- \$DEPLOY_PATHS ':\(exclude,glob\)\*\*\/CLAUDE\.md' ':\(exclude,glob\)\*\*\/README\.md'; then\n((?:(?: {12}.+)?\n)+) {10}else\n {12}echo "deploy=true" >> "\$GITHUB_OUTPUT"$/m.exec(
        changes,
      );
    assert.ok(diff, 'the guard diff line or its else branch changed');
    assert.match(diff[1], /^ {12}echo "deploy=false" >> "\$GITHUB_OUTPUT"$/m);
  });

  test(`Beta guard: ${file} serializes runs per ref and deploys through a shared group`, () => {
    const deploy = jobBlock(yaml, 'deploy');
    assert.match(deploy, /^ {4}needs: changes$/m);
    assert.match(deploy, /^ {4}if: needs\.changes\.outputs\.deploy == 'true'$/m);
    const shared =
      /^ {4}concurrency:\n {6}group: (deploy-[a-z-]+-beta)\n(?: {6}#.*\n)* {6}cancel-in-progress: true$/m.exec(
        deploy,
      )?.[1];
    assert.ok(shared, 'the deploy job holds no shared group with cancel-in-progress');
    assert.equal(
      shared,
      file.replace(/\.yml$/, ''),
      'the shared group is named after its own workflow',
    );
    // Per ref only: a shared workflow-level group would let a run that skips its deploy
    // cancel another branch's deploy in progress. Per ref, a newer push cancels its own
    // branch's older run, guard included, so two quick pushes no longer race to deploy.
    const top = /^concurrency:\n {2}group: (.+)\n(?: {2}#.*\n)* {2}cancel-in-progress: true$/m.exec(
      yaml,
    )?.[1];
    assert.equal(top, `${shared}-\${{ github.ref }}`, 'the workflow-level group must be per ref');
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
