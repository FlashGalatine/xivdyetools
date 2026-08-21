/**
 * Per-user daily quotas on quota-bearing mutations (FINDING-008 / PAPI-1,
 * 2026-08-21 audit): submissions, flagged edits and preview-image uploads each
 * record an append-only `submission_events` row, and flagged edits / uploads
 * are capped per UTC day like submissions already were.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Hono } from 'hono';
import { presetsRouter, resetCategoryCache } from '../../src/handlers/presets';
import { authMiddleware } from '../../src/middleware/auth';
import type { Env, AuthContext } from '../../src/types';
import {
    DAILY_FLAGGED_EDIT_LIMIT,
    DAILY_PREVIEW_UPLOAD_LIMIT,
} from '../../src/services/rate-limit-service';
import {
    createMockEnv,
    createMockD1Database,
    createMockPresetRow,
    createMockSubmission,
} from '../test-utils';

type Variables = { auth: AuthContext };

const BOT_HEADERS = {
    Authorization: 'Bearer test-bot-secret',
    'X-User-Discord-ID': '123',
    'X-User-Discord-Name': 'TestUser',
};

describe('daily quotas (FINDING-008)', () => {
    let app: Hono<{ Bindings: Env; Variables: Variables }>;
    let env: Env;
    let mockDb: ReturnType<typeof createMockD1Database>;
    const waitUntilPromises: Promise<unknown>[] = [];
    const ctx = {
        waitUntil: (p: Promise<unknown>) => {
            waitUntilPromises.push(p);
        },
        passThroughOnException: () => {},
    } as unknown as ExecutionContext;

    beforeEach(async () => {
        resetCategoryCache();
        waitUntilPromises.length = 0;
        mockDb = createMockD1Database();
        env = createMockEnv({ DB: mockDb as unknown as D1Database });
        app = new Hono<{ Bindings: Env; Variables: Variables }>();
        app.use('*', authMiddleware);
        app.route('/api/v1/presets', presetsRouter);
        const { _setTestPatterns } = await import('../../src/services/moderation-service');
        _setTestPatterns([/\bflagged\b/i]);
        vi.clearAllMocks();
    });

    afterEach(async () => {
        const { _resetPatternsForTesting } = await import('../../src/services/moderation-service');
        _resetPatternsForTesting();
        vi.restoreAllMocks();
    });

    const eventInserts = (): unknown[][] =>
        mockDb._queries
            .map((q, i) => (/INSERT INTO submission_events/i.test(q) ? mockDb._bindings[i] : null))
            .filter((b): b is unknown[] => b !== null);

    describe('POST /api/v1/presets', () => {
        it('records a submission event on a successful submission', async () => {
            mockDb._setupMock((query: string) => {
                if (query.includes('FROM submission_events')) return { count: 0 };
                if (query.includes('COUNT') && query.includes('author_discord_id')) return { count: 0 };
                if (query.includes('FROM categories')) return [{ id: 'aesthetics' }, { id: 'jobs' }];
                if (query.includes('dye_signature')) return null;
                if (query.includes('INSERT')) return { success: true, meta: { changes: 1 } };
                if (query.includes('COUNT')) return { count: 1 };
                return { success: true };
            });

            const res = await app.request(
                '/api/v1/presets',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...BOT_HEADERS },
                    body: JSON.stringify(createMockSubmission({ name: 'A perfectly clean name' })),
                },
                env,
                ctx
            );

            expect(res.status).toBe(201);
            const inserts = eventInserts();
            expect(inserts).toHaveLength(1);
            expect(inserts[0][0]).toBe('123');
            expect(inserts[0][1]).toBe('submission');
        });
    });

    describe('PATCH /api/v1/presets/:id (flagged edits)', () => {
        const row = () =>
            createMockPresetRow({ id: 'preset-123', author_discord_id: '123', status: 'approved' });

        it('returns 429 and persists nothing when the daily flagged-edit cap is used up', async () => {
            mockDb._setupMock((query: string) => {
                if (query.includes('FROM submission_events')) return { count: DAILY_FLAGGED_EDIT_LIMIT };
                return row();
            });

            const res = await app.request(
                '/api/v1/presets/preset-123',
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', ...BOT_HEADERS },
                    body: JSON.stringify({ name: 'flagged name that is long enough' }),
                },
                env,
                ctx
            );

            expect(res.status).toBe(429);
            const body = (await res.json()) as { error: string; reset_at: string };
            expect(body.error).toBe('RATE_LIMITED');
            expect(body.reset_at).toBeTruthy();
            expect(mockDb._queries.some((q) => /UPDATE presets/i.test(q))).toBe(false);
        });

        it('records a flagged_edit event when a flagged edit is accepted', async () => {
            mockDb._setupMock((query: string) => {
                if (query.includes('FROM submission_events')) return { count: 0 };
                if (query.includes('INSERT INTO submission_events')) return { success: true, meta: { changes: 1 } };
                return row();
            });

            const res = await app.request(
                '/api/v1/presets/preset-123',
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', ...BOT_HEADERS },
                    body: JSON.stringify({ name: 'flagged name that is long enough' }),
                },
                env,
                ctx
            );

            expect(res.status).toBe(200);
            const inserts = eventInserts();
            expect(inserts).toHaveLength(1);
            expect(inserts[0][1]).toBe('flagged_edit');
        });

        it('does not count or cap a clean edit', async () => {
            mockDb._setupMock((query: string) => {
                if (query.includes('FROM submission_events')) return { count: DAILY_FLAGGED_EDIT_LIMIT };
                return row();
            });

            const res = await app.request(
                '/api/v1/presets/preset-123',
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', ...BOT_HEADERS },
                    body: JSON.stringify({ name: 'A perfectly clean name' }),
                },
                env,
                ctx
            );

            expect(res.status).toBe(200);
            expect(eventInserts()).toHaveLength(0);
        });
    });

    describe('POST /api/v1/presets/:id/preview-image', () => {
        const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

        it('returns 429 before touching image-worker when the daily upload cap is used up', async () => {
            const fetchSpy = vi.fn();
            env = createMockEnv({
                DB: mockDb as unknown as D1Database,
                IMAGE_WORKER: { fetch: fetchSpy } as unknown as Fetcher,
            });
            mockDb._setupMock((query: string) => {
                if (query.includes('FROM submission_events')) return { count: DAILY_PREVIEW_UPLOAD_LIMIT };
                return createMockPresetRow({ id: 'preset-123', author_discord_id: '123' });
            });

            const res = await app.request(
                '/api/v1/presets/preset-123/preview-image',
                { method: 'POST', headers: BOT_HEADERS, body: png },
                env,
                ctx
            );

            expect(res.status).toBe(429);
            expect(fetchSpy).not.toHaveBeenCalled();
        });

        it('records a preview_upload event on a successful upload', async () => {
            mockDb._setupMock((query: string) => {
                if (query.includes('FROM submission_events')) return { count: 0 };
                if (query.includes('INSERT INTO submission_events')) return { success: true, meta: { changes: 1 } };
                return createMockPresetRow({ id: 'preset-123', author_discord_id: '123' });
            });

            const res = await app.request(
                '/api/v1/presets/preset-123/preview-image',
                { method: 'POST', headers: BOT_HEADERS, body: png },
                env,
                ctx
            );

            expect(res.status).toBe(200);
            const inserts = eventInserts();
            expect(inserts).toHaveLength(1);
            expect(inserts[0][1]).toBe('preview_upload');
        });
    });
});
