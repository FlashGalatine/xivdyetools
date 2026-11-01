import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBotSignatureV2 } from '@xivdyetools/auth';
import app from '../../src/index';
import type { Env } from '../../src/types';
import { createMockEnv, createTestJWT } from '../test-utils';
import { SqliteD1 } from '../sqlite-d1';

const path = '/api/v1/presets/batch';
const secret = 'signed-bot-secret-at-least-32-bytes-for-batch';
const schema = readFileSync(
  fileURLToPath(new URL('../../schema.sql', import.meta.url).toString()),
  'utf8',
);

describe('approved-only signed bot batch logical read', () => {
  let d1: SqliteD1;
  let env: Env;
  beforeEach(() => {
    d1 = new SqliteD1(schema);
    env = createMockEnv({ DB: d1 as unknown as D1Database, BOT_SIGNING_SECRET: secret });
  });
  afterEach(() => {
    d1.close();
    vi.restoreAllMocks();
  });
  async function headers(body: string, user: string | null = '123456789', signedPath = path) {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonce = crypto.randomUUID();
    const signature = await createBotSignatureV2(
      {
        method: 'POST',
        path: signedPath,
        body,
        timestamp,
        nonce,
        userDiscordId: user ?? undefined,
      },
      secret,
    );
    return {
      Authorization: 'Bearer test-bot-secret',
      'Content-Type': 'application/json',
      'X-Request-Timestamp': timestamp,
      'X-Request-Nonce': nonce,
      'X-Request-Signature-V2': signature,
      ...(user ? { 'X-User-Discord-ID': user } : {}),
    };
  }
  async function request(body: unknown, user = '123456789') {
    const raw = JSON.stringify(body);
    return app.request(path, { method: 'POST', body: raw, headers: await headers(raw, user) }, env);
  }
  async function seed(id: string, status = 'approved') {
    await d1
      .prepare(
        `INSERT INTO presets (id,name,description,category_id,dyes,tags,status,author_discord_id,author_name,previous_values,preview_image_key,preview_image_status)
      VALUES (?,'Public palette','A description','jobs','[1,2,3]','[]',?,'123456789','Public Name','{"name":"private snapshot"}','raw/private.webp','pending')`,
      )
      .bind(id, status)
      .run();
  }
  it('literal route returns ordered unique approved rows and indistinguishable missing/nonapproved IDs', async () => {
    await seed('a');
    await seed('b');
    for (const status of ['pending', 'flagged', 'hidden', 'rejected']) await seed(status, status);
    const response = await request({
      ids: ['b', 'pending', 'a', 'absent', 'b', 'flagged', 'hidden', 'rejected', 'absent'],
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      success: boolean;
      presets: Record<string, unknown>[];
      missing_ids: string[];
    };
    expect(body.success).toBe(true);
    expect(body.presets.map((p) => p.id)).toEqual(['b', 'a']);
    expect(body.missing_ids).toEqual(['pending', 'absent', 'flagged', 'hidden', 'rejected']);
    for (const preset of body.presets) {
      expect(preset).not.toHaveProperty('previous_values');
      expect(preset).not.toHaveProperty('author_discord_id');
      expect(preset).not.toHaveProperty('preview_image_key');
      expect(preset).not.toHaveProperty('content_revision');
      expect(preset.preview_image_url).toBeNull();
      expect(preset.author_name).toBe('Public Name');
    }
    expect(JSON.stringify(body)).not.toContain('private snapshot');
    expect(JSON.stringify(body)).not.toContain('raw/private.webp');
  });
  it('binds injection text as data with exactly one deduplicated SELECT', async () => {
    const injection = "a') OR 1=1 --";
    await seed('a');
    await seed(injection);
    await seed('not-requested');
    const queries: { sql: string; values: unknown[] }[] = [];
    d1.setBeforeStatement(({ sql, values }) => {
      queries.push({ sql, values });
    });
    const response = await request({ ids: [injection, 'a', injection] });
    expect(response.status).toBe(200);
    expect(
      ((await response.json()) as { presets: { id: string }[] }).presets.map((p) => p.id),
    ).toEqual([injection, 'a']);
    expect(queries).toHaveLength(1);
    expect(queries[0].sql).not.toContain(injection);
    expect(queries[0].values).toEqual([injection, 'a']);
  });
  it.each([1, 50])('accepts %i submitted IDs', async (count) => {
    const ids = Array.from({ length: count }, (_, i) => `id-${i}`);
    const response = await request({ ids });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ presets: [], missing_ids: ids });
  });
  it('accepts existing bounded identifier spelling at the 128 character boundary', async () => {
    const id = 'x'.repeat(128);
    await seed(id);
    const response = await request({ ids: [id] });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ presets: [{ id }], missing_ids: [] });
  });
  it.each([
    null,
    [],
    'string',
    1,
    {},
    { ids: null },
    { ids: 'a' },
    { ids: [] },
    { ids: [1] },
    { ids: [null] },
    { ids: [{}] },
    { ids: [''] },
    { ids: ['x'.repeat(129)] },
    { ids: ['a'], extra: true },
    { ids: Array(51).fill('a') },
  ])('rejects invalid body %j before querying', async (body) => {
    const query = vi.spyOn(d1, 'prepare');
    expect((await request(body)).status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });
  it.each([
    'anonymous',
    'jwt',
    'unsigned',
    'development-unsigned',
    'missing-user',
    'tampered-body',
    'tampered-user',
    'wrong-path',
  ])('denies %s credentials', async (kind) => {
    const raw = JSON.stringify({ ids: ['a'] });
    const authHeaders: Record<string, string> = await headers(
      raw,
      kind === 'missing-user' ? null : '123456789',
    );
    if (kind === 'anonymous') delete authHeaders.Authorization;
    if (kind === 'jwt')
      authHeaders.Authorization = `Bearer ${await createTestJWT(env.JWT_SECRET!, { sub: '123456789', username: 'TestUser' })}`;
    if (kind === 'unsigned' || kind === 'development-unsigned')
      delete authHeaders['X-Request-Signature-V2'];
    if (kind === 'development-unsigned') env.BOT_SIGNING_SECRET = undefined;
    if (kind === 'tampered-user') authHeaders['X-User-Discord-ID'] = '999999999';
    if (kind === 'wrong-path')
      Object.assign(authHeaders, await headers(raw, '123456789', '/api/v1/presets'));
    const response = await app.request(
      path,
      {
        method: 'POST',
        headers: authHeaders,
        body: kind === 'tampered-body' ? '{"ids":["b"]}' : raw,
      },
      env,
    );
    expect(response.status).toBe(401);
  });
  it('banned users can browse batch while their writes stay blocked', async () => {
    await seed('a');
    await d1
      .prepare(
        "INSERT INTO banned_users (id,discord_id,username,moderator_discord_id,reason) VALUES ('ban','123456789','Name','moderator','Ban reason')",
      )
      .run();
    expect((await request({ ids: ['a'] })).status).toBe(200);
    const body = '{}';
    const writePath = '/api/v1/presets';
    const response = await app.request(
      writePath,
      { method: 'POST', body, headers: await headers(body, '123456789', writePath) },
      env,
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: 'USER_BANNED' });
  });
  it('retains acting-user throttling for service-binding requests', async () => {
    for (let i = 0; i < 100; i++)
      expect((await request({ ids: ['a'] }, 'user-a')).status).toBe(200);
    expect((await request({ ids: ['a'] }, 'user-a')).status).toBe(429);
    expect((await request({ ids: ['a'] }, 'user-b')).status).toBe(200);
  });
  it('database failure is an error and cannot become missing IDs', async () => {
    d1.setBeforeStatement(() => {
      throw new Error('database unavailable');
    });
    const response = await request({ ids: ['a'] });
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ success: false, error: 'INTERNAL_ERROR' });
  });
  it('an unsuccessful database result cannot become a successful empty response', async () => {
    vi.spyOn(d1, 'execute').mockResolvedValue({
      success: false,
      results: [],
      error: 'database unavailable',
    } as unknown as D1Result);
    const response = await request({ ids: ['a'] });
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ success: false, error: 'INTERNAL_ERROR' });
  });
  it('does not verify the nonce twice, and refuses replay of a completed request', async () => {
    const nonces = new Set<string>();
    const get = vi.fn(async (key: string) => (nonces.has(key) ? '1' : null));
    const put = vi.fn(async (key: string) => {
      nonces.add(key);
    });
    env.TOKEN_BLACKLIST = { get, put } as unknown as KVNamespace;
    const body = JSON.stringify({ ids: ['a'] });
    const init = { method: 'POST', body, headers: await headers(body) };
    expect((await app.request(path, init, env)).status).toBe(200);
    expect(get).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledTimes(1);
    expect((await app.request(path, init, env)).status).toBe(401);
  });
  it('rejects malformed JSON with 400', async () => {
    const raw = '{';
    const response = await app.request(
      path,
      { method: 'POST', body: raw, headers: await headers(raw) },
      env,
    );
    expect(response.status).toBe(400);
  });
  it('rejects oversized bodies with 413', async () => {
    const raw = JSON.stringify({ ids: ['a'], padding: 'x'.repeat(103000) });
    const response = await app.request(
      path,
      { method: 'POST', body: raw, headers: await headers(raw) },
      env,
    );
    expect(response.status).toBe(413);
  });
});
