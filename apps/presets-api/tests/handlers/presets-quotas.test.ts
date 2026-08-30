/**
 * Per-user daily quotas on quota-bearing mutations (FINDING-008 / PAPI-1,
 * 2026-08-21 audit): submissions, flagged edits and preview-image uploads each
 * record an append-only `submission_events` row, and flagged edits / uploads
 * are capped per UTC day like submissions already were.
 *
 * Plus the gap FINDING-008 left behind (FINDING-004, 2026-08-29 audit): which
 * owner edits reach a moderator at all, and that every one of them is capped.
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

/** What discord-worker receives on `/webhooks/preset-submission`. */
type NotificationBody = {
    type: string;
    preset: { id: string; status: string; moderation_status: string };
};

/** A DISCORD_WORKER service binding that records the requests it is handed. */
const makeDiscordFetch = () =>
    vi.fn(async (_request: Request) => new Response('OK', { status: 200 }));

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

    // FINDING-004 (2026-08-29 security audit): every PATCH of a non-approved
    // preset was written back as `pending` and fired an uncapped moderation
    // embed, so `PATCH {"tags":["a"]}` on the caller's own pending preset was a
    // free moderation-channel ping, and a rejected preset bounced back into the
    // queue. Only an edit that brings a moderator something new notifies now,
    // and every notification passes the daily cap.
    describe('PATCH /api/v1/presets/:id (owner edits vs. the queue, FINDING-004)', () => {
        let discordFetch: ReturnType<typeof makeDiscordFetch>;
        let notifyEnv: Env;

        beforeEach(() => {
            discordFetch = makeDiscordFetch();
            notifyEnv = createMockEnv({
                DB: mockDb as unknown as D1Database,
                DISCORD_WORKER: { fetch: discordFetch } as unknown as Fetcher,
                INTERNAL_WEBHOOK_SECRET: 'test-webhook-secret',
            });
        });

        const STORED_NAME = 'Stored Name';

        /** The caller's own preset in `status`, having used `eventsUsedToday`. */
        const ownPreset = (status: string, eventsUsedToday = 0) => {
            const row = createMockPresetRow({
                id: 'preset-123',
                author_discord_id: '123',
                name: STORED_NAME,
                description: 'The stored description, long enough.',
                status,
            });
            mockDb._setupMock((query: string) => {
                if (query.includes('FROM submission_events')) return { count: eventsUsedToday };
                return row;
            });
        };

        const patch = (body: Record<string, unknown>) =>
            app.request(
                '/api/v1/presets/preset-123',
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', ...BOT_HEADERS },
                    body: JSON.stringify(body),
                },
                notifyEnv,
                ctx
            );

        /** The `UPDATE presets …` statement this request issued, if any. */
        const presetUpdate = (): { query: string; bindings: unknown[] } | null => {
            const i = mockDb._queries.findIndex((q) => /UPDATE\s+presets/i.test(q));
            return i === -1 ? null : { query: mockDb._queries[i], bindings: mockDb._bindings[i] };
        };

        /** The same statement, insisting the edit was actually applied. */
        const appliedUpdate = (): { query: string; bindings: unknown[] } => {
            const update = presetUpdate();
            if (!update) throw new Error('expected the edit to issue an UPDATE presets statement');
            return update;
        };

        /** Bodies actually handed to the discord-worker service binding. */
        const notifications = async (): Promise<NotificationBody[]> => {
            await Promise.allSettled(waitUntilPromises);
            return Promise.all(
                discordFetch.mock.calls.map((call) => call[0].json() as Promise<NotificationBody>)
            );
        };

        it('a tag-only edit of a pending preset notifies nobody and costs no quota', async () => {
            ownPreset('pending');

            const res = await patch({ tags: ['a'] });

            expect(res.status).toBe(200);
            expect(await notifications()).toEqual([]);
            expect(eventInserts()).toHaveLength(0);
            // The status column is a moderator's; an owner edit must not rewrite it
            expect(appliedUpdate().query).not.toMatch(/status\s*=\s*\?/);
            const body = (await res.json()) as { moderation_status: string };
            expect(body.moderation_status).toBe('pending');
        });

        it('resending a pending preset\'s existing name is not new text, so nobody is notified', async () => {
            ownPreset('pending');

            const res = await patch({ name: STORED_NAME, tags: ['a'] });

            expect(res.status).toBe(200);
            expect(await notifications()).toEqual([]);
            expect(eventInserts()).toHaveLength(0);
        });

        it('a clean name change on a pending preset notifies once, as clean, and counts', async () => {
            ownPreset('pending');

            const res = await patch({ name: 'A perfectly clean name' });

            expect(res.status).toBe(200);
            const sent = await notifications();
            expect(sent).toHaveLength(1);
            expect(sent[0].preset.status).toBe('pending');
            // It passed moderation — saying 'flagged' told moderators otherwise
            expect(sent[0].preset.moderation_status).toBe('clean');
            const inserts = eventInserts();
            expect(inserts).toHaveLength(1);
            expect(inserts[0][1]).toBe('flagged_edit');
        });

        it('refuses the day\'s 11th notifying edit with 429 before writing anything', async () => {
            ownPreset('pending', DAILY_FLAGGED_EDIT_LIMIT);

            const res = await patch({ name: 'A perfectly clean name' });

            expect(res.status).toBe(429);
            const body = (await res.json()) as { error: string; reset_at: string };
            expect(body.error).toBe('RATE_LIMITED');
            expect(body.reset_at).toBeTruthy();
            expect(presetUpdate()).toBeNull();
            expect(await notifications()).toEqual([]);
        });

        it.each(['rejected', 'flagged'])(
            'leaves a %s preset in its status and notifies nobody',
            async (status) => {
                ownPreset(status);

                const res = await patch({ tags: ['a'] });

                expect(res.status).toBe(200);
                expect(appliedUpdate().query).not.toMatch(/status\s*=\s*\?/);
                expect(await notifications()).toEqual([]);
                expect(eventInserts()).toHaveLength(0);
                const body = (await res.json()) as { moderation_status: string };
                expect(body.moderation_status).toBe(status);
            }
        );

        it.each(['rejected', 'flagged'])(
            'still notifies nobody when new text on a %s preset trips moderation',
            async (status) => {
                ownPreset(status);

                const res = await patch({ name: 'flagged name that is long enough' });

                expect(res.status).toBe(200);
                expect(appliedUpdate().query).not.toMatch(/status\s*=\s*\?/);
                expect(await notifications()).toEqual([]);
                expect(eventInserts()).toHaveLength(0);
                // BUG-052: the write-once revert snapshot is still taken
                expect(appliedUpdate().query).toMatch(/previous_values\s*=\s*\?/);
                const body = (await res.json()) as { moderation_status: string };
                expect(body.moderation_status).toBe(status);
            }
        );

        it('sends an approved preset to pending when its new name is flagged', async () => {
            ownPreset('approved');

            const res = await patch({ name: 'flagged name that is long enough' });

            expect(res.status).toBe(200);
            expect(appliedUpdate().query).toMatch(/status\s*=\s*\?/);
            expect(appliedUpdate().bindings).toContain('pending');
            const sent = await notifications();
            expect(sent).toHaveLength(1);
            expect(sent[0].preset.status).toBe('pending');
            expect(sent[0].preset.moderation_status).toBe('flagged');
            expect(eventInserts()).toHaveLength(1);
            const body = (await res.json()) as { moderation_status: string };
            expect(body.moderation_status).toBe('pending');
        });

        it('keeps an approved preset approved when its new name passes moderation', async () => {
            ownPreset('approved');

            const res = await patch({ name: 'A perfectly clean name' });

            expect(res.status).toBe(200);
            expect(await notifications()).toEqual([]);
            expect(eventInserts()).toHaveLength(0);
            const body = (await res.json()) as { moderation_status: string };
            expect(body.moderation_status).toBe('approved');
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
