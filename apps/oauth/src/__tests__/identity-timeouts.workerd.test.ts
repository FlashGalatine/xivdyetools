import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import type { TestHarness } from 'wrangler';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { resolve } from 'node:path';
import type * as Caller from './mocks/identity-timeout-caller.js';
import type * as Peer from './mocks/identity-timeout-peer.js';
let harness: TestHarness;
let db: D1Database;
const source = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const saved = new Map<string, string | undefined>();
const U = '10000000-0000-4000-8000-000000000001';
const X = '20000000-0000-4000-8000-000000000001';
const D = '123456789012345678';
beforeAll(async () => {
  const root = resolve(
    source('../../../../.superpowers/sdd/2026-10-29-release-prerequisites/oauth'),
    `timeout-runtime-${process.pid}`,
  );
  mkdirSync(root, { recursive: true });
  for (const [key, value] of Object.entries({
    USERPROFILE: root,
    APPDATA: resolve(root, 'roaming'),
    LOCALAPPDATA: resolve(root, 'local'),
    XDG_CONFIG_HOME: resolve(root, 'config'),
    XDG_CACHE_HOME: resolve(root, 'cache'),
    WRANGLER_LOG_PATH: resolve(root, 'logs'),
    WRANGLER_SEND_METRICS: 'false',
    CLOUDFLARE_API_TOKEN: 'fake-local-test-token',
    CLOUDFLARE_ACCOUNT_ID: '00000000000000000000000000000000',
  })) {
    saved.set(key, process.env[key]);
    process.env[key] = value;
  }
  const { createTestHarness } = await import('wrangler');
  harness = createTestHarness({
    root,
    workers: [
      {
        config: {
          name: 'timeout-caller',
          main: source('./mocks/identity-timeout-caller.ts'),
          compatibility_date: '2026-10-23',
          services: [
            { binding: 'BAN_CONTINUITY', service: 'timeout-peer', entrypoint: 'TimeoutContinuity' },
          ],
          vars: {
            IDENTITY_SPLIT_ENABLED: 'true',
            JWT_SECRET: 'fake-local-secret-at-least-thirty-two-characters',
            JWT_EXPIRY: '3600',
            WORKER_URL: 'http://localhost:8788',
          },
          d1_databases: [
            {
              binding: 'DB',
              database_name: 'timeout-test',
              database_id: '00000000-0000-4000-8000-000000000009',
            },
          ],
        },
      },
      {
        config: {
          name: 'timeout-peer',
          main: source('./mocks/identity-timeout-peer.ts'),
          compatibility_date: '2026-10-23',
        },
      },
    ],
  });
  await harness.listen();
  db = (await harness.getWorker<{ DB: D1Database }>('timeout-caller').getEnv()).DB;
  const schema = readFileSync(source('../../schema/users.sql'), 'utf8')
    .replace(/--[^\n]*/g, '')
    .split(';')
    .map((sql) => sql.trim())
    .filter(Boolean);
  for (const sql of schema) await db.prepare(sql).run();
  await db.prepare('CREATE TABLE test_mints (user_id TEXT)').run();
}, 60000);
afterAll(async () => {
  try {
    if (harness) await harness.close();
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}, 30000);
const peer = () => harness.getWorker<Record<string, never>, typeof Peer>('timeout-peer');
const login = (
  params: {
    xivauth_id: string;
    discord_id: string | null;
    username: string;
    auth_provider: string;
  } = { xivauth_id: X, discord_id: null, username: 'Incoming', auth_provider: 'xivauth' },
) =>
  harness
    .getWorker<Record<string, never>, typeof Caller>('timeout-caller')
    .fetch('/login', { method: 'POST', body: JSON.stringify(params) });
async function reset() {
  for (const table of ['test_mints', 'identity_operation_locks', 'identity_operations', 'users'])
    await db.prepare(`DELETE FROM ${table}`).run();
  await db
    .prepare(
      'INSERT INTO users (id,discord_id,xivauth_id,auth_provider,username) VALUES (?,?,?,?,?)',
    )
    .bind(U, D, X, 'xivauth', 'Stored')
    .run();
}
it.each(['late-success', 'late-reject'])(
  'Workerd %s cannot commit local identity or mint after abandonment; retry recovers the same operation',
  async (mode) => {
    await reset();
    await peer().fetch('/mode', { method: 'POST', body: mode });
    const before = (await (await peer().fetch('/state')).json()) as { completed: number };
    const result = await login();
    expect(result.status).toBe(503);
    expect(await result.json()).toEqual({ error: 'unavailable' });
    const pending = await db.prepare('SELECT * FROM identity_operations').first();
    expect(pending).toMatchObject({ state: 'pending', resolution: null });
    await vi.waitFor(
      async () =>
        expect(
          ((await (await peer().fetch('/state')).json()) as { completed: number }).completed,
        ).toBe(before.completed + 1),
      { timeout: 2000, interval: 25 },
    );
    expect(await db.prepare('SELECT * FROM identity_operations').first()).toEqual(pending);
    expect((await db.prepare('SELECT * FROM identity_operation_locks').all()).results).toHaveLength(
      4,
    );
    expect((await db.prepare('SELECT * FROM test_mints').all()).results).toEqual([]);
    expect(
      await db.prepare('SELECT discord_id,xivauth_id FROM users WHERE id=?').bind(U).first(),
    ).toEqual({ discord_id: D, xivauth_id: X });
    await peer().fetch('/mode', { method: 'POST', body: 'normal' });
    const recovered = await login();
    expect(recovered.status).toBe(200);
    expect(await recovered.json()).toMatchObject({
      user: { discord_id: null, xivauth_id: X },
      token: expect.any(String),
    });
    expect(await db.prepare('SELECT * FROM identity_operations').first()).toMatchObject({
      id: pending!.id,
      payload_json: pending!.payload_json,
      payload_hash: pending!.payload_hash,
      state: 'complete',
    });
    expect((await db.prepare('SELECT * FROM test_mints').all()).results).toHaveLength(1);
  },
  15000,
);
it('Workerd hung acknowledgement permits terminal mint and a later unrelated login', async () => {
  await reset();
  await peer().fetch('/mode', { method: 'POST', body: 'stall-ack' });
  const result = await login();
  expect(result.status).toBe(200);
  expect(await result.json()).toMatchObject({ token: expect.any(String) });
  expect(await db.prepare('SELECT state,acknowledged_at FROM identity_operations').first()).toEqual(
    { state: 'complete', acknowledged_at: null },
  );
  const unrelated = await login({
    xivauth_id: '',
    discord_id: '923456789012345678',
    username: 'Unrelated',
    auth_provider: 'discord',
  });
  expect(unrelated.status).toBe(200);
  expect(await unrelated.json()).toMatchObject({
    user: { discord_id: '923456789012345678' },
    token: expect.any(String),
  });
}, 10000);
