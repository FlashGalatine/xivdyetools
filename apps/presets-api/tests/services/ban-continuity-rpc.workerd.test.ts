import { afterAll, beforeAll, expect, it } from 'vitest';
import type { TestHarness } from 'wrangler';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { continuityHash } from '../../src/services/ban-continuity-contract.js';
import type * as Caller from '../fixtures/ban-continuity-caller.js';
const source = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const U = '10000000-0000-4000-8000-000000000001',
  D = '123456789012345678',
  N = '10000000-0000-4000-8000-000000000002';
const saved = new Map<string, string | undefined>();
let harness: TestHarness, db: D1Database;
beforeAll(async () => {
  const root = resolve(
    source('../../../../.superpowers/sdd/REMEDIATION_PLAN'),
    `stream-1-runtime-${process.pid}`,
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
    CLOUDFLARE_API_TOKEN: 'fake-local-only-token',
    CLOUDFLARE_ACCOUNT_ID: '00000000000000000000000000000000',
  })) {
    saved.set(key, process.env[key]);
    process.env[key] = value;
  }
  // Lazy import AFTER sandboxing Wrangler's config/cache/profile locations.
  const { createTestHarness } = await import('wrangler');
  harness = createTestHarness({
    root,
    workers: [
      {
        config: {
          name: 'continuity-caller',
          main: source('../fixtures/ban-continuity-caller.ts'),
          compatibility_date: '2026-10-23',
          services: [
            { binding: 'CONTINUITY', service: 'continuity-provider', entrypoint: 'BanContinuity' },
            {
              binding: 'OAUTH_IDENTITY',
              service: 'continuity-oauth-provider',
              entrypoint: 'IdentityLookup',
            },
          ],
        },
      },
      {
        config: {
          name: 'continuity-provider',
          main: source('../../src/worker.ts'),
          compatibility_date: '2026-10-23',
          vars: {
            ENVIRONMENT: 'development',
            BOT_API_SECRET: 'fake-local-bot-secret',
            MODERATOR_IDS: D,
            API_VERSION: 'v1',
            CORS_ORIGIN: 'http://localhost:5173',
            OAUTH_SESSION_CHECK_ENABLED: 'false',
          },
          d1_databases: [
            {
              binding: 'DB',
              database_name: 'fake-local-presets',
              database_id: '00000000-0000-4000-8000-000000000001',
            },
          ],
        },
      },
      {
        config: {
          name: 'continuity-oauth-provider',
          main: source('../../../oauth/src/worker.ts'),
          compatibility_date: '2026-10-23',
          vars: {
            ENVIRONMENT: 'development',
            DISCORD_CLIENT_ID: D,
            DISCORD_CLIENT_SECRET: 'fake-secret',
            XIVAUTH_CLIENT_ID: 'fake-client',
            JWT_SECRET: 'fake-jwt-local-secret-at-least-32-characters',
            JWT_EXPIRY: '3600',
            FRONTEND_URL: 'http://localhost:5173',
            WORKER_URL: 'http://localhost:8788',
            IDENTITY_SPLIT_ENABLED: 'false',
          },
          d1_databases: [
            {
              binding: 'DB',
              database_name: 'fake-local-oauth',
              database_id: '00000000-0000-4000-8000-000000000002',
            },
          ],
        },
      },
    ],
  });
  await harness.listen();
  db = (await harness.getWorker<{ DB: D1Database }>('continuity-provider').getEnv()).DB;
  const oauth = (await harness.getWorker<{ DB: D1Database }>('continuity-oauth-provider').getEnv())
    .DB;
  async function seedSchema(target: D1Database, path: string) {
    const parser = new DatabaseSync(':memory:');
    try {
      parser.exec(readFileSync(path, 'utf8'));
      const definitions = parser
        .prepare(
          "SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END,rowid",
        )
        .all() as { sql: string }[];
      await target.batch(definitions.map(({ sql }) => target.prepare(sql)));
    } finally {
      parser.close();
    }
  }
  await seedSchema(db, source('../../schema.sql'));
  await seedSchema(oauth, source('../../../oauth/schema/users.sql'));
  await db
    .prepare(
      'INSERT INTO banned_users(id,discord_id,username,reason,moderator_discord_id) VALUES (?,?,?,?,?)',
    )
    .bind('parent', D, 'Private name', 'Private reason', D)
    .run();
  await oauth
    .prepare(
      'INSERT INTO users(id,discord_id,xivauth_id,auth_provider,username) VALUES (?,?,?,?,?)',
    )
    .bind(U, D, '20000000-0000-4000-8000-000000000001', 'discord', 'Private name')
    .run();
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
const rpc = async (path: string, input: unknown) =>
  harness
    .getWorker<Record<string, never>, typeof Caller>('continuity-caller')
    .fetch(path, { method: 'POST', body: JSON.stringify(input) });
it('calls the exported production BanContinuity through its named binding and replays its durable receipt', async () => {
  const now = Math.floor(Date.now() / 1000);
  const r = {
    v: 1 as const,
    operationId: crypto.randomUUID(),
    kind: 'detach' as const,
    sourceIds: [U, D],
    destinationIds: [N],
    createdAt: now,
    expiresAt: now + 900,
  };
  const payloadHash = await continuityHash(r),
    key = { operationId: r.operationId, payloadHash };
  const result = await (await rpc('/apply', { ...r, payloadHash })).json();
  expect(result).toEqual({ v: 1, ...key, status: 'applied', matchedBanCount: 1 });
  expect(await db.prepare('SELECT identity_id FROM ban_identity_memberships').all()).toMatchObject({
    results: [{ identity_id: N }],
  });
  expect(await (await rpc('/get', key)).json()).toEqual(result);
  const ack = await (await rpc('/ack', { ...key, outcome: 'complete' })).json();
  expect(ack).toMatchObject({
    v: 1,
    ...key,
    status: 'acknowledged',
    outcome: 'complete',
    acknowledgedAt: expect.any(Number),
  });
  expect(await (await rpc('/ack', { ...key, outcome: 'complete' })).json()).toEqual(ack);
});
it('preserves default HTTP/scheduled handling and does not expose any private RPC methods over public HTTP', async () => {
  const worker = harness.getWorker('continuity-provider');
  for (const path of [
    '/apply',
    '/getOperation',
    '/acknowledge',
    '/lookupStoredIdentity',
    '/validateSession',
  ]) {
    const response = await worker.fetch(path, {
      method: 'POST',
      body: '{}',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.status).toBe(404);
    const body = await response.text();
    expect(body).not.toContain('Private name');
    expect(body).not.toContain(D);
  }
  expect((await worker.fetch('/health')).status).toBe(200);
  // TestHarness invokes the actual default export's scheduled handler in Workerd.
  await expect(worker.scheduled({ cron: '23 4 * * *' })).resolves.toBeDefined();
});
it('validates private DTOs and invokes the real OAuth provider via the structural consumer contract', async () => {
  expect(
    await (await rpc('/apply', { sourceIds: [D], unexpected: 'Private name' })).json(),
  ).toEqual({ v: 1, status: 'malformed' });
  expect(
    await (await rpc('/session', { sub: U, authProvider: 'discord', discordId: D })).json(),
  ).toEqual({ version: 1, status: 'valid' });
  const oauth = harness.getWorker('continuity-oauth-provider');
  expect((await oauth.fetch('/validateSession')).status).toBe(404);
});
