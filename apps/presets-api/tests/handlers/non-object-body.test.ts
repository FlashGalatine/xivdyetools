/**
 * BUG-064 (2026-10-04 deep-dive): a JSON body that parses but is not an object.
 *
 * `c.req.json()` happily returns `null` for the body `null` (and an array or a
 * scalar for the others), and `jsonDepthLimit` lets every one of them through.
 * The four handlers below then read fields straight off it — `body.name`,
 * `body.status`, `body.reason` — so `null` threw a TypeError that the global
 * onError answered as an opaque 500 INTERNAL_ERROR. Each now answers the same
 * 400 INVALID_JSON a body that does not parse at all gets.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { presetsRouter, resetCategoryCache } from '../../src/handlers/presets';
import { moderationRouter } from '../../src/handlers/moderation';
import { authMiddleware } from '../../src/middleware/auth';
import type { Env, AuthContext } from '../../src/types';
import { createMockEnv, createMockD1Database, createMockPresetRow } from '../test-utils';

type Variables = { auth: AuthContext };

/** Bot auth as the preset's owner ('123') — not a moderator. */
const OWNER_HEADERS = {
    'Content-Type': 'application/json',
    Authorization: 'Bearer test-bot-secret',
    'X-User-Discord-ID': '123',
    'X-User-Discord-Name': 'TestUser',
};

/** Bot auth as a moderator listed in createMockEnv's MODERATOR_IDS. */
const MODERATOR_HEADERS = {
    'Content-Type': 'application/json',
    Authorization: 'Bearer test-bot-secret',
    'X-User-Discord-ID': '123456789',
    'X-User-Discord-Name': 'Moderator',
};

const NON_OBJECT_BODIES = [
    ['null', 'null'],
    ['an array', '[]'],
    ['a string', '"name"'],
    ['a number', '42'],
    ['a boolean', 'true'],
] as const;

describe('a JSON body that is not an object (BUG-064)', () => {
    let app: Hono<{ Bindings: Env; Variables: Variables }>;
    let env: Env;
    let mockDb: ReturnType<typeof createMockD1Database>;

    beforeEach(() => {
        resetCategoryCache();
        mockDb = createMockD1Database();
        env = createMockEnv({ DB: mockDb as unknown as D1Database });
        app = new Hono<{ Bindings: Env; Variables: Variables }>();
        app.use('*', authMiddleware);
        app.route('/api/v1/presets', presetsRouter);
        app.route('/api/v1/moderation', moderationRouter);
    });

    async function expectInvalidJson(res: Response): Promise<void> {
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
            success: false,
            error: 'INVALID_JSON',
            message: 'Invalid JSON body',
        });
    }

    describe.each(NON_OBJECT_BODIES)('body %s', (_label, raw) => {
        it('POST /presets answers 400 INVALID_JSON, not a 500', async () => {
            // The daily-cap COUNT runs before the body is read.
            mockDb._setupMock(() => ({ count: 0 }));

            const res = await app.request(
                '/api/v1/presets',
                { method: 'POST', headers: OWNER_HEADERS, body: raw },
                env
            );

            await expectInvalidJson(res);
            expect(mockDb._queries.some((q) => /INSERT INTO presets/i.test(q))).toBe(false);
        });

        it('PATCH /presets/:id answers 400 INVALID_JSON, not a 500', async () => {
            // The ownership read runs before the body is read.
            mockDb._setupMock(() =>
                createMockPresetRow({ id: 'preset-123', author_discord_id: '123', status: 'approved' })
            );

            const res = await app.request(
                '/api/v1/presets/preset-123',
                { method: 'PATCH', headers: OWNER_HEADERS, body: raw },
                env
            );

            await expectInvalidJson(res);
            expect(mockDb._queries.some((q) => /UPDATE\s+presets/i.test(q))).toBe(false);
        });

        it('PATCH /moderation/:id/status answers 400 INVALID_JSON, not a 500', async () => {
            mockDb._setupMock(() => createMockPresetRow({ id: 'preset-123', status: 'pending' }));

            const res = await app.request(
                '/api/v1/moderation/preset-123/status',
                { method: 'PATCH', headers: MODERATOR_HEADERS, body: raw },
                env
            );

            await expectInvalidJson(res);
            expect(mockDb._queries.some((q) => /UPDATE\s+presets/i.test(q))).toBe(false);
        });

        it('PATCH /moderation/:id/revert answers 400 INVALID_JSON, not a 500', async () => {
            mockDb._setupMock(() =>
                createMockPresetRow({ id: 'preset-123', status: 'pending', previous_values: '{}' })
            );

            const res = await app.request(
                '/api/v1/moderation/preset-123/revert',
                { method: 'PATCH', headers: MODERATOR_HEADERS, body: raw },
                env
            );

            await expectInvalidJson(res);
            expect(mockDb._queries.some((q) => /UPDATE\s+presets/i.test(q))).toBe(false);
        });
    });

    it('still answers an ordinary object body as before (validation, not INVALID_JSON)', async () => {
        mockDb._setupMock(() =>
            createMockPresetRow({ id: 'preset-123', author_discord_id: '123', status: 'approved' })
        );

        const res = await app.request(
            '/api/v1/presets/preset-123',
            { method: 'PATCH', headers: OWNER_HEADERS, body: '{}' },
            env
        );

        expect(res.status).toBe(400);
        expect(await res.json()).toMatchObject({ error: 'VALIDATION_ERROR', message: 'No updates provided' });
    });
});
