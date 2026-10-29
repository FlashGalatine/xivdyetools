import { afterAll, beforeAll, expect, it } from 'vitest';
import type { TestHarness } from 'wrangler';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { resolve } from 'node:path';
import { continuityHash } from '../services/identity-contract.js';
import type * as CallerModule from './mocks/identity-rpc-caller.js';
import type * as ContinuityModule from './mocks/ban-continuity-worker.js';

let harness: TestHarness;
const U = '10000000-0000-4000-8000-000000000001';
const X = '20000000-0000-4000-8000-000000000001';
const D = '123456789012345678';
const source = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));
const saved = new Map<string, string | undefined>();
beforeAll(async () => {
  const root = resolve(
    source('../../../../.superpowers/sdd/REMEDIATION_PLAN'),
    `task-3-runtime-${process.pid}`,
  );
  mkdirSync(root, { recursive: true });
  // Scoped scratch configuration prevents loading a user's Wrangler config or credentials.
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
          name: 'identity-test-caller',
          main: source('./mocks/identity-rpc-caller.ts'),
          compatibility_date: '2026-10-23',
          services: [
            {
              binding: 'IDENTITY',
              service: 'identity-test-provider',
              entrypoint: 'IdentityLookup',
            },
            {
              binding: 'CONTINUITY',
              service: 'identity-test-continuity',
              entrypoint: 'BanContinuity',
            },
          ],
        },
      },
      {
        config: {
          name: 'identity-test-provider',
          main: source('../worker.ts'),
          compatibility_date: '2026-10-23',
          vars: {
            ENVIRONMENT: 'development',
            DISCORD_CLIENT_ID: D,
            DISCORD_CLIENT_SECRET: 'fake-discord-secret',
            XIVAUTH_CLIENT_ID: 'fake-xivauth-client',
            JWT_SECRET: 'fake-jwt-test-secret-at-least-32-characters',
            JWT_EXPIRY: '3600',
            FRONTEND_URL: 'http://localhost:5173',
            WORKER_URL: 'http://localhost:8788',
            IDENTITY_SPLIT_ENABLED: 'false',
          },
          d1_databases: [
            {
              binding: 'DB',
              database_name: 'fake-test-identities',
              database_id: '00000000-0000-4000-8000-000000000001',
            },
          ],
        },
      },
      {
        config: {
          name: 'identity-test-continuity',
          main: source('./mocks/ban-continuity-worker.ts'),
          compatibility_date: '2026-10-23',
        },
      },
    ],
  });
  await harness.listen();
  const { DB } = await harness.getWorker<{ DB: D1Database }>('identity-test-provider').getEnv();
  // D1 exec takes single-line statements; schema is local and has no credentials.
  const schema = readFileSync(source('../../schema/users.sql'), 'utf8')
    .replace(/--[^\n]*/g, '')
    .split(';')
    .map((sql) => sql.trim())
    .filter(Boolean);
  for (const sql of schema) await DB.prepare(sql).run();
  await DB.prepare(
    'INSERT INTO users (id,discord_id,xivauth_id,auth_provider,username) VALUES (?,?,?,?,?)',
  )
    .bind(U, D, X, 'xivauth', 'Private display name')
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
    .getWorker<Record<string, never>, typeof CallerModule>('identity-test-caller')
    .fetch(path, { method: 'POST', body: JSON.stringify(input) });

it('invokes the real named IdentityLookup entrypoint and returns only stored IDs/revision', async () => {
  const response = await rpc('/lookup', { kind: 'discord', id: D });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    version: 1,
    status: 'found',
    internalId: U,
    discordId: D,
    identityRevision: 0,
  });
  expect(
    await (await rpc('/session', { sub: U, authProvider: 'discord', discordId: D })).json(),
  ).toEqual({ version: 1, status: 'valid' });
});
it('keeps lookup off public HTTP routes and rejects malformed private DTOs', async () => {
  const provider = harness.getWorker('identity-test-provider');
  for (const path of ['/lookupStoredIdentity', '/auth/identity', '/validateSession'])
    expect((await provider.fetch(path)).status).toBe(404);
  const response = await rpc('/lookup', { kind: 'discord', id: X });
  expect(response.status).toBe(503);
  const body = await response.text();
  expect(body).not.toContain(X);
  expect(body).not.toContain('Private display name');
});
it('crosses a second named RPC boundary with the canonical continuity request', async () => {
  expect((await harness.getWorker<Record<string, never>, typeof ContinuityModule>('identity-test-continuity').fetch('/')).status).toBe(404);
  const now = Math.floor(Date.now() / 1000);
  const base = {
    v: 1 as const,
    operationId: crypto.randomUUID(),
    kind: 'detach' as const,
    sourceIds: [U, D],
    destinationIds: [crypto.randomUUID()],
    createdAt: now,
    expiresAt: now + 900,
  };
  const payloadHash = await continuityHash(base);
  const result = await rpc('/continuity', { ...base, payloadHash });
  expect(await result.json()).toEqual({
    v: 1,
    operationId: base.operationId,
    payloadHash,
    status: 'applied',
    matchedBanCount: 0,
  });
});
