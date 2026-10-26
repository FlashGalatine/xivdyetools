/**
 * Hermetic workerd ownership check. All game-data requests target a local
 * fixture server; only this harness's spawned processes and state are removed.
 */
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const V = 'aaaaaaaaaaaaaaaa';
const S = 'exdschema@2:rev:' + 'a'.repeat(40);
const body = JSON.stringify({ gear: [{ slot: 'HeadGear', base: 361, variant: 5 }], glasses: 3 });

async function waitFor(check, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = check();
    if (value) return value;
    await delay(25);
  }
  throw new Error('Timed out waiting for the local runtime/fixture');
}

async function scenario(holdDiscovery) {
  let release;
  const gate = new Promise((yes) => {
    release = yes;
  });
  const counts = { probes: 0, searches: 0, glasses: 0 };
  const identity = { version: V, schema: S };
  const upstream = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://fixture.local');
      let data;
      if (url.pathname === '/api/sheet/Item/1') {
        counts.probes++;
        assert.equal(url.searchParams.get('fields'), 'Name');
        if (holdDiscovery) await gate;
        data = { ...identity, row_id: 1, fields: { Name: 'Gil' } };
      } else if (url.pathname === '/api/search') {
        counts.searches++;
        assert.equal(url.searchParams.get('version'), V);
        assert.equal(url.searchParams.get('schema'), S);
        if (!holdDiscovery) await gate;
        data = {
          ...identity,
          results: [
            {
              row_id: 18085,
              fields: {
                Name: 'Fixture Head',
                Icon: { id: 41716 },
                ModelMain: 328041,
                ModelSub: 0,
                EquipSlotCategory: { fields: { Head: 1 } },
              },
            },
          ],
        };
      } else if (url.pathname === '/api/sheet/Glasses/3') {
        counts.glasses++;
        assert.equal(url.searchParams.get('version'), V);
        assert.equal(url.searchParams.get('schema'), S);
        data = { ...identity, row_id: 3, fields: { Name: 'Fixture Glasses' } };
      } else {
        throw new Error('Unexpected upstream URL: ' + req.url);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch (error) {
      res.writeHead(500);
      res.end(String(error));
    }
  });
  await new Promise((yes) => upstream.listen(0, '127.0.0.1', yes));
  const upstreamUrl = 'http://127.0.0.1:' + upstream.address().port;
  const stateRoot = join(appDir, '.wrangler');
  await mkdir(stateRoot, { recursive: true });
  const state = await mkdtemp(join(stateRoot, 'chara-runtime-'));
  let child;
  let logs = '';
  let ownerAbort;
  try {
    child = spawn(
      process.execPath,
      [
        join(appDir, 'node_modules/wrangler/bin/wrangler.js'),
        'dev',
        '--local',
        '--ip',
        '127.0.0.1',
        '--port',
        '0',
        '--inspector-port',
        '0',
        '--show-interactive-dev-session=false',
        '--persist-to',
        state,
        '--var',
        'XIVAPI_BASE:' + upstreamUrl,
        '--var',
        'XIVAPI_VERSION:' + (holdDiscovery ? 'latest' : V),
        '--var',
        'XIVAPI_SCHEMA:' + S,
      ],
      {
        cwd: appDir,
        windowsHide: true,
        detached: process.platform !== 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, CI: 'true', NO_COLOR: '1', WRANGLER_SEND_METRICS: 'false' },
      },
    );
    let spawnError;
    child.on('error', (error) => {
      spawnError = error;
    });
    const capture = (chunk) => {
      logs = (logs + chunk.toString()).slice(-128000);
    };
    child.stdout.on('data', capture);
    child.stderr.on('data', capture);
    const base = await waitFor(() => {
      if (spawnError) throw spawnError;
      if (child.exitCode !== null) throw new Error('Wrangler exited: ' + logs);
      return logs.match(/Ready on (http:\/\/127\.0\.0\.1:\d+)/)?.[1];
    });
    assert.equal((await fetch(base + '/health')).status, 200);
    const options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body };
    ownerAbort = new AbortController();
    const owner = fetch(base + '/v1/chara/resolve', { ...options, signal: ownerAbort.signal })
      .then(async (response) => ({ completed: true, body: await response.text() }))
      .catch((error) => ({ completed: false, error }));
    await waitFor(() => (holdDiscovery ? counts.probes === 1 : counts.searches === 1));
    const waiter = fetch(base + '/v1/chara/resolve', {
      ...options,
      signal: AbortSignal.timeout(20000),
    });
    // Let the second HTTP request enter workerd while the producer stays held.
    // MISS below prevents a late cache hit from satisfying this concurrency test.
    await delay(100);
    ownerAbort.abort();
    assert.equal((await owner).completed, false, 'the producer client must actually disconnect');
    await delay(50);
    release();
    const response = await waiter;
    const text = await response.text();
    assert.equal(response.status, 200, text);
    assert.equal(
      response.headers.get('X-Cache'),
      'MISS',
      'the waiter must share pending work, not replay a finished cache write',
    );
    const data = JSON.parse(text).data;
    assert.equal(data.items.HeadGear.names.en, 'Fixture Head');
    assert.equal(data.glasses.names.en, 'Fixture Glasses');
    assert.equal(counts.searches, 1);
    assert.equal(counts.glasses, 1);
    assert.equal(counts.probes, holdDiscovery ? 1 : 0);
    assert.doesNotMatch(
      logs,
      /Cannot perform I\/O on behalf|will never generate a response|error 1101/i,
    );
  } catch (error) {
    throw new Error(String(error) + '\nLocal runtime log:\n' + logs.slice(-12000), {
      cause: error,
    });
  } finally {
    ownerAbort?.abort();
    release();
    if (child && child.exitCode === null && child.signalCode === null && child.pid) {
      const ended = once(child, 'exit');
      if (process.platform === 'win32') {
        spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
          windowsHide: true,
          stdio: 'ignore',
        });
      } else {
        process.kill(-child.pid, 'SIGTERM');
      }
      await Promise.race([ended, delay(5000)]);
    }
    upstream.closeAllConnections();
    await new Promise((yes) => upstream.close(yes));
    assert.ok(state.startsWith(stateRoot + (process.platform === 'win32' ? '\\' : '/')));
    await rm(state, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}

test('pending lookup survives its owner disconnecting in workerd', { timeout: 60000 }, () =>
  scenario(false),
);
test('pending discovery survives its owner disconnecting in workerd', { timeout: 60000 }, () =>
  scenario(true),
);
