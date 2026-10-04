/**
 * FINDING-019 (no scorer -> moderator queue) and FINDING-016 (example_link and
 * author_name character rules), 2026-10-03 audit.
 *
 * Runs against a real SQLite database built from schema.sql.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { presetsRouter, resetCategoryCache } from '../../src/handlers/presets';
import { authMiddleware } from '../../src/middleware/auth';
import type { AuthContext, Env } from '../../src/types';
import { createMockEnv, createMockSubmission, createTestJWT, useCleanPerspective } from '../test-utils';
import { SqliteD1 } from '../sqlite-d1';

type Variables = { auth: AuthContext };

const schema = readFileSync(fileURLToPath(new URL('../../schema.sql', import.meta.url).toString()), 'utf8');
const SECRET = 'test-jwt-secret-that-is-at-least-32-bytes!!-that-is-at-least-32-bytes!!';
const USER = '123456789012345678';

describe('preset text safety (FINDING-019, FINDING-016)', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>;
  let d1: SqliteD1;
  let env: Env;
  const pending: Promise<unknown>[] = [];
  const ctx = {
    waitUntil: (p: Promise<unknown>) => {
      pending.push(p);
    },
    passThroughOnException: () => {},
  } as unknown as ExecutionContext;

  beforeEach(() => {
    resetCategoryCache();
    d1 = new SqliteD1(schema);
    env = createMockEnv({ DB: d1 as unknown as D1Database });
    app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.use('*', authMiddleware);
    app.route('/api/v1/presets', presetsRouter);
  });

  afterEach(async () => {
    await Promise.allSettled(pending.splice(0));
    vi.unstubAllGlobals();
    d1.close();
  });

  async function headers(username = 'Tester'): Promise<Record<string, string>> {
    const token = await createTestJWT(
      SECRET,
      { sub: USER, discord_id: USER, username } as Parameters<typeof createTestJWT>[1]
    );
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  }

  async function submit(overrides: Record<string, unknown> = {}, username = 'Tester'): Promise<Response> {
    return Promise.resolve(
      app.request(
        '/api/v1/presets',
        {
          method: 'POST',
          headers: await headers(username),
          body: JSON.stringify(createMockSubmission({ name: 'A perfectly clean name', ...overrides })),
        },
        env,
        ctx
      )
    );
  }

  async function stored(): Promise<{ status: string; author_name: string; example_link: string | null }> {
    const row = await d1
      .prepare('SELECT status, author_name, example_link FROM presets LIMIT 1')
      .first<{ status: string; author_name: string; example_link: string | null }>();
    if (!row) throw new Error('no preset stored');
    return row;
  }

  describe('FINDING-019: moderation without a scorer', () => {
    it('queues a new preset as pending when no PERSPECTIVE_API_KEY is set', async () => {
      const res = await submit();

      expect(res.status).toBe(201);
      expect(((await res.json()) as { moderation_status: string }).moderation_status).toBe('pending');
      expect((await stored()).status).toBe('pending');
    });

    it('approves a clean new preset when a scorer is configured (production behaviour)', async () => {
      useCleanPerspective(env);

      const res = await submit();

      expect(res.status).toBe(201);
      expect(((await res.json()) as { moderation_status: string }).moderation_status).toBe('approved');
      expect((await stored()).status).toBe('approved');
    });

    async function seedApproved(): Promise<void> {
      await d1
        .prepare(
          `INSERT INTO presets (
            id, name, description, category_id, dyes, tags, author_discord_id, author_name,
            status, dye_signature
          ) VALUES ('p1', 'Stored name', 'A stored description here', 'jobs', '[1,2,3]',
            '["tag"]', ?, 'Tester', 'approved', '[1,2,3]')`
        )
        .bind(USER)
        .run();
    }

    function edit(body: Record<string, unknown>): Promise<Response> {
      return headers().then((h) =>
        Promise.resolve(
          app.request('/api/v1/presets/p1', { method: 'PATCH', headers: h, body: JSON.stringify(body) }, env, ctx)
        )
      );
    }

    it('a text edit with no scorer moves an approved preset back to pending', async () => {
      await seedApproved();

      const res = await edit({ name: 'A brand new clean name' });

      expect(res.status).toBe(200);
      expect(((await res.json()) as { moderation_status?: string }).moderation_status).toBe('pending');
      expect((await stored()).status).toBe('pending');
    });

    it('a text edit with a scorer keeps an approved preset approved', async () => {
      await seedApproved();
      useCleanPerspective(env);

      const res = await edit({ name: 'A brand new clean name' });

      expect(res.status).toBe(200);
      expect((await stored()).status).toBe('approved');
    });
  });

  describe('FINDING-016: example_link', () => {
    it.each([
      ['LF', 'https://x.com/a\nb'],
      ['U+202E', 'https://x.com/a‮evil'],
    ])('rejects a link with %s', async (_label, link) => {
      useCleanPerspective(env);

      const res = await submit({ example_link: link });

      expect(res.status).toBe(400);
      expect(await d1.prepare('SELECT COUNT(*) AS n FROM presets').first()).toEqual({ n: 0 });
    });

    it('stores a valid link in canonical form, percent-encoding a space', async () => {
      useCleanPerspective(env);

      const res = await submit({ example_link: 'eorzeacollection.com/glamour/a b' });

      expect(res.status).toBe(201);
      expect((await stored()).example_link).toBe('https://eorzeacollection.com/glamour/a%20b');
    });
  });

  describe('FINDING-016: author_name', () => {
    const RLO_NAME = 'Eve‮nil​';

    it('strips a right-to-left override and invisibles from the stored author name', async () => {
      useCleanPerspective(env);

      const res = await submit({}, RLO_NAME);

      expect(res.status).toBe(201);
      expect((await stored()).author_name).toBe('Evenil');
    });

    it('PATCH /refresh-author strips them too, instead of rejecting', async () => {
      await d1
        .prepare(
          `INSERT INTO presets (
            id, name, description, category_id, dyes, tags, author_discord_id, author_name,
            status, dye_signature
          ) VALUES ('p1', 'Stored name', 'A stored description here', 'jobs', '[1,2,3]',
            '["tag"]', ?, 'Old', 'approved', '[1,2,3]')`
        )
        .bind(USER)
        .run();

      const res = await app.request(
        '/api/v1/presets/refresh-author',
        { method: 'PATCH', headers: await headers(RLO_NAME) },
        env
      );

      expect(res.status).toBe(200);
      expect((await stored()).author_name).toBe('Evenil');
    });

    it('PATCH /refresh-author rejects a name that is nothing but invisible characters', async () => {
      const res = await app.request(
        '/api/v1/presets/refresh-author',
        { method: 'PATCH', headers: await headers('‮​') },
        env
      );

      expect(res.status).toBe(400);
    });
  });
});
