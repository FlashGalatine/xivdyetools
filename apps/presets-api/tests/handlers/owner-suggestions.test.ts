import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { createBotSignatureV2 } from '@xivdyetools/auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../../src/index';
import type { Env, PresetStatus } from '../../src/types';
import { SqliteD1 } from '../sqlite-d1';
import { createMockEnv, createTestJWT } from '../test-utils';

const minePath = '/api/v1/presets/mine';
const suggestionsPath = `${minePath}/suggestions`;
const owner = '123456789123456789';
const otherOwner = '246813579246813579';
const secret = 'bot-signing-secret-for-owner-suggestions-tests';
const schema = readFileSync(new URL('../../schema.sql', import.meta.url), 'utf8');

async function signedHeaders(path: string, userDiscordId?: string): Promise<Headers> {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomUUID();
  const signature = await createBotSignatureV2(
    { method: 'GET', path, timestamp, nonce, userDiscordId },
    secret,
  );
  const headers = new Headers({
    Authorization: 'Bearer test-bot-secret',
    'X-Request-Timestamp': timestamp,
    'X-Request-Nonce': nonce,
    'X-Request-Signature-V2': signature,
  });
  if (userDiscordId) headers.set('X-User-Discord-ID', userDiscordId);
  return headers;
}

describe('owner preset suggestions on SQLite', () => {
  let db: SqliteD1;
  let env: Env;

  beforeEach(() => {
    db = new SqliteD1(schema);
    env = createMockEnv({
      DB: db as unknown as D1Database,
      BOT_SIGNING_SECRET: secret,
      MODERATOR_IDS: owner,
    });
  });

  afterEach(() => db.close());

  function seed({
    id,
    name = id,
    status = 'approved',
    author = owner,
    created = '2026-11-22 12:00:00',
  }: {
    id: string;
    name?: string;
    status?: PresetStatus;
    author?: string;
    created?: string;
  }): D1PreparedStatement {
    return db.prepare(`
      INSERT INTO presets (id, name, status, author_discord_id, created_at, category_id,
        description, dyes, tags, author_name, previous_values)
      VALUES (?, ?, ?, ?, ?, 'jobs', 'Private description', '[1,2,3]', '[]',
        'Author display name', '{"name":"Private revision"}')
    `).bind(id, name, status, author, created);
  }

  async function suggest(query = '') {
    return app.request(`${suggestionsPath}${query}`, {
      headers: await signedHeaders(suggestionsPath, owner),
    }, env);
  }

  it('returns the latest 25, breaking creation-time ties by ID and exposing three fields', async () => {
    const recent = Array.from({ length: 28 }, (_, index) =>
      `recent-${String(index).padStart(2, '0')}`,
    );
    await db.batch([
      ...[...recent].reverse().map((id) => seed({ id })),
      seed({ id: 'old', created: '2026-11-21 12:00:00' }),
      seed({ id: 'newest', status: 'pending', created: '2026-11-23 12:00:00' }),
      seed({ id: 'hidden', status: 'hidden', created: '2026-11-23 11:00:00' }),
    ]);

    const read = vi.spyOn(db, 'execute');
    const response = await suggest();
    expect(response.status).toBe(200);
    const expected = [
      { id: 'newest', name: 'newest', status: 'pending' },
      { id: 'hidden', name: 'hidden', status: 'hidden' },
      ...recent.slice(0, 23).map((id) => ({ id, name: id, status: 'approved' })),
    ];
    expect(await response.json()).toEqual({ presets: expected });
    expect(read).toHaveBeenCalledTimes(1);
    const databaseResult = await read.mock.results[0].value;
    expect(databaseResult.results).toEqual(expected);
  });

  it('matches older names before limiting, with literal case-insensitive substring search', async () => {
    await db.batch([
      ...Array.from({ length: 30 }, (_, index) => seed({ id: `new-${index}`, name: 'Other' })),
      seed({ id: 'matching', name: 'Moon Silver', status: 'rejected', created: '2026-11-21' }),
      seed({ id: 'foreign-match', name: 'Night silver', status: 'hidden', author: otherOwner }),
    ]);

    const response = await suggest('?q=sILver');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      presets: [{ id: 'matching', name: 'Moon Silver', status: 'rejected' }],
    });

    const full = await app.request(minePath, { headers: await signedHeaders(minePath, owner) }, env);
    expect(full.status).toBe(200);
    const body = (await full.json()) as { total: number; presets: { id: string }[] };
    expect(body.total).toBe(31);
    expect(body.presets.find(({ id }) => id === 'matching')).toMatchObject({
      name: 'Moon Silver', description: 'Private description', dyes: [1, 2, 3],
      previous_values: { name: 'Private revision' },
    });
  });

  it.each(['%', '_', '\\', '*', '?', '[', ']', '[xy]', '月光'])('matches literal text %j inside the name', async (query) => {
    await db.batch([
      seed({ id: 'match', name: `Start ${query} End`, status: 'flagged' }),
      seed({ id: 'unmatched', name: 'Start x End' }),
    ]);

    const response = await suggest(`?${new URLSearchParams({ q: query })}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      presets: [{ id: 'match', name: `Start ${query} End`, status: 'flagged' }],
    });
  });

  it.each([
    ['L’Étoile', 'éToi'],
    ['L’étoile', 'ÉTOI'],
    ['Straße', 'TRAẞ'],
    ['STRAẞE', 'traß'],
    ['X'.repeat(50), 'x'.repeat(50)],
  ])('matches a case variant of %s with %s', async (name, query) => {
    await db.batch([
      seed({ id: 'match', name }),
      seed({ id: 'unmatched', name: 'Etoile et Strasse' }),
    ]);

    const response = await suggest(`?${new URLSearchParams({ q: query })}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ presets: [{ id: 'match', name, status: 'approved' }] });
  });

  it('keeps a query containing NUL from becoming a shorter match', async () => {
    await seed({ id: 'match-prefix', name: 'Moonlight' }).run();
    const response = await suggest('?q=Moon%00xyz');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ presets: [] });
  });

  it('returns no matches for an overlong query without truncating it', async () => {
    await seed({ id: 'match-prefix', name: 'X'.repeat(50) }).run();
    const response = await suggest(`?q=${'X'.repeat(51)}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ presets: [] });
  });

  it('does not cache owner suggestions or authorization denials', async () => {
    const responses = await Promise.all([
      suggest(),
      app.request(suggestionsPath, {}, env),
      app.request(suggestionsPath, { headers: await signedHeaders(suggestionsPath) }, env),
    ]);
    expect(responses.map((response) => response.headers.get('Cache-Control'))).toEqual([
      'private, no-store', 'private, no-store', 'private, no-store',
    ]);
  });

  it('rejects anonymous calls and authenticated bots without an actor', async () => {
    expect((await app.request(suggestionsPath, {}, env)).status).toBe(401);
    const headers = await signedHeaders(suggestionsPath);
    expect((await app.request(suggestionsPath, { headers }, env)).status).toBe(400);
  });

  it('uses the JWT actor even if a query parameter and header name another owner', async () => {
    await db.batch([
      seed({ id: 'own', name: 'Private' }),
      seed({ id: 'foreign', name: 'Private', author: otherOwner, status: 'hidden' }),
    ]);
    const identity = {
      sub: 'internal-id',
      discord_id: owner,
      username: 'Owner',
    };
    const token = await createTestJWT(env.JWT_SECRET!, identity);
    const response = await app.request(`${suggestionsPath}?author_discord_id=${otherOwner}`, {
      headers: { Authorization: `Bearer ${token}`, 'X-User-Discord-ID': otherOwner },
    }, env);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      presets: [{ id: 'own', name: 'Private', status: 'approved' }],
    });
  });
});
