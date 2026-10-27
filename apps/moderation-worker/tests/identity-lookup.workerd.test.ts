import { beforeAll, afterAll, it, expect } from 'vitest';
import type { TestHarness } from 'wrangler';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type * as Caller from './fixtures/identity-lookup-caller.js';
const D = '123456789012345678',
  U = 'a0000000-0000-4000-8000-000000000001',
  MOD = '999999999999999999';
let harness: TestHarness, oauth: D1Database, presets: D1Database;
const saved = new Map<string, string | undefined>();
beforeAll(async () => {
  const root = resolve(
    import.meta.dirname,
    `../../../.superpowers/sdd/REMEDIATION_PLAN/stream-3-runtime-${process.pid}`,
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
  const { createTestHarness } = await import('wrangler');
  harness = createTestHarness({
    root,
    workers: [
      {
        config: {
          name: 'moderation-identity-caller',
          main: resolve(import.meta.dirname, 'fixtures/identity-lookup-caller.ts'),
          compatibility_date: '2026-10-23',
          vars: { LINKED_BAN_CONFIRMATION_ENABLED: 'true', MODERATOR_IDS: MOD },
          services: [
            {
              binding: 'OAUTH_IDENTITY',
              service: 'moderation-identity-provider',
              entrypoint: 'IdentityLookup',
            },
          ],
          d1_databases: [
            {
              binding: 'DB',
              database_name: 'fake-moderation-presets',
              database_id: '00000000-0000-4000-8000-000000000001',
            },
          ],
        },
      },
      {
        config: {
          name: 'moderation-identity-provider',
          main: resolve(import.meta.dirname, '../../oauth/src/worker.ts'),
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
              database_name: 'fake-moderation-oauth',
              database_id: '00000000-0000-4000-8000-000000000002',
            },
          ],
        },
      },
    ],
  });
  await harness.listen();
  oauth = (await harness.getWorker<{ DB: D1Database }>('moderation-identity-provider').getEnv()).DB;
  presets = (await harness.getWorker<{ DB: D1Database }>('moderation-identity-caller').getEnv()).DB;
  async function schema(db: D1Database, path: string) {
    const parser = new DatabaseSync(':memory:');
    try {
      parser.exec(readFileSync(path, 'utf8'));
      const rows = parser
        .prepare(
          "SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END,rowid",
        )
        .all() as { sql: string }[];
      await db.batch(rows.map((row) => db.prepare(row.sql)));
    } finally {
      parser.close();
    }
  }
  await schema(oauth, resolve(import.meta.dirname, '../../oauth/schema/users.sql'));
  await schema(presets, resolve(import.meta.dirname, '../../presets-api/schema.sql'));
  await oauth
    .prepare(
      'INSERT INTO users(id,discord_id,xivauth_id,auth_provider,username) VALUES (?,?,?,?,?)',
    )
    .bind(U, D, '20000000-0000-4000-8000-000000000001', 'discord', 'Provider private name')
    .run();
  await presets
    .prepare("INSERT INTO categories(id,name,description) VALUES ('jobs','Jobs','Description')")
    .run();
  for (const [id, author] of [
    ['d', D],
    ['u', U],
  ])
    await presets
      .prepare(
        "INSERT INTO presets(id,name,description,category_id,dyes,tags,author_discord_id,status) VALUES (?,?,'Description','jobs','[]','[]',?,'approved')",
      )
      .bind(id, id, author)
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
});
const call = (path: string, input: unknown) =>
  harness
    .getWorker<Record<string, never>, typeof Caller>('moderation-identity-caller')
    .fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
it('actual named OAuth binding validates canonical DTO in moderation consumer and commits reviewed linked scope', async () => {
  const response = await call('/lookup', { ids: [D] });
  expect(await response.json()).toEqual([
    {
      input: D,
      result: { version: 1, status: 'found', internalId: U, discordId: D, identityRevision: 0 },
    },
  ]);
  const reviewed = (await (
    await call('/review', { ids: [D], actorId: MOD, action: 'ban' })
  ).json()) as { review: { nonce: string }; message: { flags: number } };
  expect(reviewed.message.flags).toBe(64);
  expect(
    await (
      await call('/apply', {
        nonce: reviewed.review.nonce,
        actorId: MOD,
        action: 'ban',
        reason: 'Repeated abuse reason',
      })
    ).json(),
  ).toMatchObject({ success: true, presetsHidden: 2 });
  expect(
    (await presets
      .prepare("SELECT COUNT(*) n FROM presets WHERE status='hidden'")
      .first<{ n: number }>())!.n,
  ).toBe(2);
  expect(
    (await presets
      .prepare('SELECT outcome FROM moderation_ban_confirmations WHERE nonce=?')
      .bind(reviewed.review.nonce)
      .first<{ outcome: string }>())!.outcome,
  ).toBe('applied');
});
it('revision change across actual RPC boundary invalidates confirmation without another audit', async () => {
  const reviewed = (await (
    await call('/review', { ids: [D], actorId: MOD, action: 'ban' })
  ).json()) as { review: { nonce: string } };
  const before = await presets
    .prepare('SELECT COUNT(*) n FROM moderation_log')
    .first<{ n: number }>();
  await oauth
    .prepare('UPDATE users SET identity_revision=identity_revision+1 WHERE id=?')
    .bind(U)
    .run();
  expect(
    await (
      await call('/apply', {
        nonce: reviewed.review.nonce,
        actorId: MOD,
        action: 'ban',
        reason: 'Repeated abuse reason',
      })
    ).json(),
  ).toMatchObject({ success: false });
  expect(await presets.prepare('SELECT COUNT(*) n FROM moderation_log').first()).toEqual(before);
});
it('provider lookup stays off public routes; inactive consumer and missing binding DTOs remain unavailable', async () => {
  for (const path of ['/lookupStoredIdentity', '/auth/identity', '/validateSession'])
    expect((await harness.getWorker('moderation-identity-provider').fetch(path)).status).toBe(404);
  expect((await call('/inactive', { ids: [D] })).status).toBe(503);
  expect(await (await call('/lookup', { ids: ['bad'] })).json()).toEqual({ error: 'unavailable' });
  const unknown = 'b0000000-0000-4000-8000-000000000004';
  expect(await (await call('/lookup', { ids: [unknown] })).json()).toEqual([
    { input: unknown, result: { version: 1, status: 'missing' } },
  ]);
});

it('recorded-scope unban restores exact D1 counts and retains sanction memberships', async () => {
  const reviewed = (await (
    await call('/review', { ids: [D], actorId: MOD, action: 'unban' })
  ).json()) as { review: { nonce: string } };
  expect(
    await (
      await call('/apply', { nonce: reviewed.review.nonce, actorId: MOD, action: 'unban' })
    ).json(),
  ).toMatchObject({ success: true, presetsRestored: 2, presetsStillHidden: 0 });
  expect(
    (await presets
      .prepare('SELECT COUNT(*) n FROM ban_identity_memberships')
      .first<{ n: number }>())!.n,
  ).toBe(2);
  expect(await presets.prepare('SELECT username,reason FROM banned_users').first()).toEqual({
    username: '',
    reason: '',
  });
});
