import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const fixture = new URL('./collector-fixture.mjs', import.meta.url).href;
const bsky = fileURLToPath(new URL('./bsky-ffxiv-census.mjs', import.meta.url));
const x = fileURLToPath(new URL('./x-follower-counts.mjs', import.meta.url));
const modes = ['profiles', 'actors', 'starterpacks', 'feeds', 'focus', 'tags', 'stream', 'x'];
function cli(mode, scenario = 'success', args, extraEnv = {}) {
  const tokens = args ?? (mode === 'x' ? [] : mode === 'stream' ? ['stream', '1', '2026-01-01T00:00:00.000Z'] : [mode]);
  const result = spawnSync(process.execPath, ['--import', fixture, mode === 'x' ? x : bsky, ...tokens], {
    encoding: 'utf8', timeout: 4000,
    env: { ...process.env, NODE_OPTIONS: '', EXTRA_HANDLES: '', EXTRA_PAIRS: '', BSKY_HANDLE: 'login.example.invalid', BSKY_APP_PASSWORD: 'synthetic-password', COLLECTOR_CASE: scenario, ...extraEnv },
  });
  assert.equal(result.error, undefined, 'CLI must terminate without leaking through a timeout');
  // Both streams are public artifacts: secrets, paths, identities, dates and arbitrary metadata are forbidden.
  assert.doesNotMatch(result.stdout + result.stderr, /SYNTHETIC_PRIVATE_MARKER|synthetic-password|example\.invalid|did:|at:\/\/|https?:\/\/|canonical_|2026-|\.mjs:\d|Error:|credential=password/);
  return result;
}

for (const mode of modes) {
  test(`${mode}: exports fixed aggregate schema across hostile text and metadata`, () => {
    const result = cli(mode);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, '');
    const out = JSON.parse(result.stdout);
    assert.deepEqual(Object.keys(out).sort(), ['failed', 'metrics', 'mode', 'requested', 'schemaVersion', 'succeeded', 'suppressed']);
    assert.equal(out.schemaVersion, 2);
    assert.equal(out.mode, mode);
    assert.equal(out.suppressed, false);
    if (['profiles', 'actors', 'x'].includes(mode)) assert.deepEqual(out.metrics, { followerBands: { under100: 7, '100to999': 0, '1000plus': 0 } });
    if (mode === 'starterpacks') assert.deepEqual(out.metrics, { packs: 7, membersListed: 70, joinedWeek: 14, joinedAllTime: 140 });
    if (mode === 'feeds') assert.deepEqual(out.metrics, { feeds: 7, likes: 70 });
    if (mode === 'focus') assert.deepEqual(out.metrics, { sampledPosts: 21, classifiablePosts: 14, ffxivPosts: 7, ffxivSharePct: 50 });
    if (mode === 'tags') assert.deepEqual(out.metrics, { posts: 12, observations: 120, duplicatesSkipped: 108, averagePerDay: 1.7 });
    if (mode === 'stream') assert.deepEqual(out.metrics, { posts: 12, ffxivPosts: 6, duplicatesSkipped: 1, ffxivSharePct: 50 });
  });
  test(`${mode}: duplicate aliases cannot satisfy the minimum subject cohort`, () => {
    const result = cli(mode, 'aliases');
    assert.equal(result.status, 0);
    const out = JSON.parse(result.stdout);
    assert.equal(out.suppressed, true);
    assert.equal(out.metrics, null);
  });
  for (const scenario of ['error', 'remote-body', 'malformed', 'auth-error']) {
    test(`${mode}: ${scenario} cannot export upstream bodies or exception details`, () => {
      const result = cli(mode, scenario);
      assert.equal(result.status, 1);
      assert.equal(result.stdout, '');
      assert.equal(result.stderr, 'Collection failed.\n');
    });
  }
}

for (const mode of modes) for (const [scenario, suppressed] of [['cohort4', true], ['cohort5', false]]) test(`${mode}: ${scenario} enforces distinct-subject boundary`, () => {
  const result = cli(mode, scenario);
  assert.equal(result.status, 0);
  const out = JSON.parse(result.stdout);
  assert.equal(out.suppressed, suppressed);
  assert.equal(out.metrics === null, suppressed);
});

for (const mode of ['profiles', 'actors', 'x']) test(`${mode}: a sparse occupied band suppresses the entire histogram`, () => {
  const result = cli(mode, 'sparse-band');
  assert.equal(result.status, 0);
  const out = JSON.parse(result.stdout);
  assert.equal(out.suppressed, true);
  assert.equal(out.metrics, null);
});

test('x: mixed ID availability cannot count canonical aliases as additional subjects', () => {
  const result = cli('x', 'mixed-x-identities');
  assert.equal(result.status, 0);
  assert.equal(JSON.parse(result.stdout).metrics, null);
});

test('stream: one matching author in a large total cohort cannot publish exact matching counts', () => {
  const result = cli('stream', 'singleton-match');
  assert.equal(result.status, 0);
  assert.equal(JSON.parse(result.stdout).metrics, null);
});

test('stream: a singleton nonmatching complement cannot be recovered by subtraction', () => {
  const result = cli('stream', 'singleton-nonmatch');
  assert.equal(result.status, 0);
  assert.equal(JSON.parse(result.stdout).metrics, null);
});

test('focus: one matching subject in a large total cohort cannot publish exact matching counts', () => {
  const result = cli('focus', 'focus-singleton-match');
  assert.equal(result.status, 0);
  assert.equal(JSON.parse(result.stdout).metrics, null);
});

for (const scenario of ['focus-singleton-classifiable', 'focus-singleton-nonmatching', 'focus-singleton-unclassified']) test(`focus: ${scenario} cannot be disclosed through pooled counts or subtraction`, () => {
  const result = cli('focus', scenario);
  assert.equal(result.status, 0);
  assert.equal(JSON.parse(result.stdout).metrics, null);
});

for (const mode of ['starterpacks', 'feeds']) {
  test(`${mode}: zero-padding cannot publish a singleton creator's nonzero measurements`, () => {
    const result = cli(mode, 'zero-padded');
    assert.equal(result.status, 0);
    assert.equal(JSON.parse(result.stdout).metrics, null);
  });
  test(`${mode}: all-zero measurements are safe after the base creator cohort passes`, () => {
    const result = cli(mode, 'zero-metric');
    assert.equal(result.status, 0);
    assert.equal(JSON.parse(result.stdout).suppressed, false);
  });
}

for (const scenario of ['socket-startup', 'socket-close']) test(`stream: ${scenario} exceptions cannot escape the CLI error boundary`, () => {
  const result = cli('stream', scenario);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, 'Collection failed.\n');
});

for (const [mode, args] of [
  ['profiles', ['profiles', 'unexpected']], ['actors', ['actors', '--raw']], ['starterpacks', ['starterpacks', '--raw']], ['feeds', ['feeds', '--raw']],
  ['focus', ['focus', '200', 'private-path.json']], ['tags', ['tags', '-1']], ['tags', ['tags', 'NaN']],
  ['stream', ['stream', 'Infinity']], ['stream', ['stream', '1', 'private-path']], ['x', ['--raw']],
]) test(`${mode}: rejects invalid CLI arguments before network`, () => {
  const result = cli(mode, 'error', args);
  assert.equal(result.status, 2);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, 'Invalid input.\n');
});

for (const mode of ['profiles', 'actors', 'starterpacks', 'feeds', 'x']) test(`${mode}: negative upstream metrics fail safely`, () => {
  const result = cli(mode, 'badnumber');
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, 'Collection failed.\n');
});

for (const [mode, extraEnv] of [['profiles', { EXTRA_HANDLES: 'private path' }], ['x', { EXTRA_PAIRS: 'private/path:account' }]]) test(`${mode}: startup environment validation is inside safe error boundary`, () => {
  const result = cli(mode, 'error', undefined, extraEnv);
  assert.equal(result.status, 2);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, 'Invalid input.\n');
});
