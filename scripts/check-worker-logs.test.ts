#!/usr/bin/env tsx
/**
 * Self-test for `check-worker-logs.ts`.
 *
 * The gate exists so Workers Logs, Logpush and tail consumers cannot be switched on
 * without a deliberate, reviewed change (2026-10-03 FINDING-022). These tests pin each
 * spelling it must catch and the comment / Pages / allow-list cases it must not trip on.
 *
 * @module scripts/check-worker-logs.test
 */
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  ALLOWED_TO_LOG,
  checkWorkerConfig,
  runCheck,
  stripTomlComments,
} from './check-worker-logs.js';

const PINNED = 'name = "w"\n\n[observability]\nenabled = false\n';
const PINNED_PROD = `${PINNED}\n[env.production]\nname = "w"\n\n[env.production.observability]\nenabled = false\n`;

test('ALLOWED_TO_LOG ships empty (fail-closed)', () => {
  assert.deepEqual([...ALLOWED_TO_LOG], []);
});

test('a pinned top-level-only file passes', () => {
  assert.deepEqual(checkWorkerConfig(PINNED), []);
});

test('a file with [env.production] and both pins passes', () => {
  assert.deepEqual(checkWorkerConfig(PINNED_PROD), []);
});

test('[env.production] without the production pin fails', () => {
  const problems = checkWorkerConfig(`${PINNED}\n[env.production]\nname = "w"\n`);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /env\.production\.observability/);
});

test('another named env does not need its own pin', () => {
  assert.deepEqual(checkWorkerConfig(`${PINNED}\n[env.development]\nname = "w-dev"\n`), []);
});

test('missing top-level pin fails', () => {
  assert.equal(checkWorkerConfig('name = "w"\n').length, 1);
});

test('enabled = false must be the first key', () => {
  assert.equal(
    checkWorkerConfig('[observability]\nhead_sampling_rate = 1\nenabled = false\n').length,
    1,
  );
});

for (const [label, snippet] of [
  ['plain key', '[observability]\nenabled = false\n[observability.logs]\nenabled = true\n'],
  ['inline table', '[observability]\nenabled = false\nlogs = { enabled = true }\n'],
  [
    'logs subtable',
    '[observability]\nenabled = false\n\n[observability.logs]\nenabled = true\ninvocation_logs = true\n',
  ],
  ['dotted key', '[observability]\nenabled = false\nlogs.enabled = true\n'],
] as const) {
  test(`enabled = true fails (${label})`, () => {
    const problems = checkWorkerConfig(snippet);
    assert.ok(
      problems.some((p) => /enabled = true/.test(p)),
      problems.join('|'),
    );
  });
}

test('top-level enabled = true fails even when the pin is missing', () => {
  const problems = checkWorkerConfig('[observability]\nenabled = true\n');
  assert.ok(problems.some((p) => /enabled = true/.test(p)));
});

test('logpush = true fails', () => {
  assert.ok(checkWorkerConfig(`${PINNED}logpush = true\n`).some((p) => /logpush/.test(p)));
});

test('tail_consumers headers fail (top-level and per-env)', () => {
  assert.ok(
    checkWorkerConfig(`${PINNED}\n[[tail_consumers]]\nservice = "x"\n`).some((p) =>
      /tail_consumers/.test(p),
    ),
  );
  assert.ok(
    checkWorkerConfig(`${PINNED}\n[[env.production.tail_consumers]]\nservice = "x"\n`).some((p) =>
      /tail_consumers/.test(p),
    ),
  );
});

test('non-empty tail_consumers array fails, empty passes', () => {
  assert.ok(
    checkWorkerConfig(`tail_consumers = [{ service = "x" }]\n${PINNED}`).some((p) =>
      /tail_consumers/.test(p),
    ),
  );
  assert.ok(
    checkWorkerConfig(`tail_consumers = [\n  { service = "x" },\n]\n${PINNED}`).some((p) =>
      /tail_consumers/.test(p),
    ),
  );
  assert.deepEqual(checkWorkerConfig(`tail_consumers = []\n${PINNED}`), []);
  assert.deepEqual(checkWorkerConfig(`tail_consumers = [\n]\n${PINNED}`), []);
});

test('quoted keys are caught (enabled, logpush, tail_consumers)', () => {
  assert.ok(checkWorkerConfig(`${PINNED}[observability.logs]\n"enabled" = true\n`).some((p) => /enabled = true/.test(p)));
  assert.ok(checkWorkerConfig(`${PINNED}'logpush' = true\n`).some((p) => /logpush/.test(p)));
  assert.ok(checkWorkerConfig(`"tail_consumers" = [{ service = "x" }]\n${PINNED}`).some((p) => /tail_consumers/.test(p)));
});

test('streaming_tail_consumers and previews tail consumers fail', () => {
  assert.ok(checkWorkerConfig(`${PINNED}\n[[streaming_tail_consumers]]\nservice = "x"\n`).some((p) => /tail_consumers/.test(p)));
  assert.ok(checkWorkerConfig(`streaming_tail_consumers = [{ service = "x" }]\n${PINNED}`).some((p) => /tail_consumers/.test(p)));
  assert.ok(checkWorkerConfig(`${PINNED}\n[[previews.tail_consumers]]\nservice = "x"\n`).some((p) => /tail_consumers/.test(p)));
  assert.ok(checkWorkerConfig(`${PINNED}\n[[env.production.previews.streaming_tail_consumers]]\nservice = "x"\n`).some((p) => /tail_consumers/.test(p)));
  assert.deepEqual(checkWorkerConfig(`streaming_tail_consumers = []\n${PINNED}`), []);
});

test('CRLF line endings are handled like LF', () => {
  assert.deepEqual(checkWorkerConfig(PINNED.replace(/\n/g, '\r\n')), []);
});

test('a production env defined only through subtables still needs its pin', () => {
  assert.ok(
    checkWorkerConfig(`${PINNED}\n[env.production.vars]\nX = "1"\n`).some((p) => /env\.production/.test(p)),
  );
});

test('a comment containing enabled = true does not fail', () => {
  assert.deepEqual(
    checkWorkerConfig(`# never set enabled = true here\n${PINNED}note = "x" # logpush = true\n`),
    [],
  );
});

test('a commented-out pin does not count as a pin', () => {
  assert.equal(checkWorkerConfig('# [observability]\n# enabled = false\nname = "w"\n').length, 1);
  assert.equal(
    checkWorkerConfig(
      `${PINNED}\n[env.production]\n# [env.production.observability]\n# enabled = false\n`,
    ).length,
    1,
  );
});

test('stripTomlComments keeps a # inside a quoted string', () => {
  assert.equal(stripTomlComments('a = "x#y" # c\nb = \'p#q\''), 'a = "x#y" \nb = \'p#q\'');
});

function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'worker-logs-'));
  for (const [worker, text] of Object.entries(files)) {
    mkdirSync(join(root, 'apps', worker), { recursive: true });
    writeFileSync(join(root, 'apps', worker, 'wrangler.toml'), text);
  }
  return root;
}

test('runCheck skips a Pages config and reports each worker', () => {
  const root = fixture({
    site: 'pages_build_output_dir = "dist"\n',
    good: PINNED,
    bad: 'name = "w"\n',
  });
  try {
    const byName = Object.fromEntries(runCheck(root).map((r) => [r.worker, r.status]));
    assert.deepEqual(byName, { bad: 'problems', good: 'ok', site: 'skipped' });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a wrangler.jsonc worker is reported, not silently skipped', () => {
  const root = mkdtempSync(join(tmpdir(), 'worker-logs-'));
  try {
    mkdirSync(join(root, 'apps', 'j'), { recursive: true });
    writeFileSync(join(root, 'apps', 'j', 'wrangler.jsonc'), '{ "observability": { "enabled": true } }');
    assert.equal(runCheck(root)[0].status, 'problems');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('an allow list exempts a listed worker', () => {
  const root = fixture({ loud: '[observability]\nenabled = true\n' });
  try {
    assert.equal(runCheck(root)[0].status, 'problems');
    assert.equal(runCheck(root, ['loud'])[0].status, 'allowed');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
