/**
 * Per-user daily quotas on quota-bearing mutations (FINDING-008 / PAPI-1,
 * 2026-08-21 audit): submissions, flagged edits and preview-image uploads each
 * record an append-only `submission_events` row, and flagged edits / uploads
 * are capped per UTC day like submissions already were.
 *
 * Plus the gap FINDING-008 left behind (FINDING-004, 2026-08-29 audit): which
 * owner edits reach a moderator at all, and that every one of them is capped.
 *
 * And the gap FINDING-004 left behind (FINDING-005, same audit): the Perspective
 * call itself is capped per user *before* it is made — the flagged-edit cap runs
 * after it, and never at all for an already-judged preset — and an unavailable
 * Perspective is treated exactly as flagged content instead of as an all-clear.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Hono } from 'hono';
import { presetsRouter, resetCategoryCache } from '../../src/handlers/presets';
import { authMiddleware } from '../../src/middleware/auth';
import type { Env, AuthContext } from '../../src/types';
import {
    DAILY_FLAGGED_EDIT_LIMIT,
    DAILY_PREVIEW_UPLOAD_LIMIT,
    DAILY_TEXT_EDIT_LIMIT,
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
            // FINDING-005: the text edit is charged before moderation runs, the
            // flagged edit after it decided.
            expect(eventInserts().map((b) => b[1])).toEqual(['text_edit', 'flagged_edit']);
        });

        it('does not count a clean edit against the flagged-edit cap', async () => {
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

            // The flagged-edit quota is used up, but this edit reaches no
            // moderator, so only its (much larger) text-edit slot is spent.
            expect(res.status).toBe(200);
            expect(eventInserts().map((b) => b[1])).toEqual(['text_edit']);
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
            // It still cost a Perspective call, so it still cost a text-edit
            // slot (FINDING-005) — but no moderator heard about it.
            expect(eventInserts().map((b) => b[1])).toEqual(['text_edit']);
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
            expect(eventInserts().map((b) => b[1])).toEqual(['text_edit', 'flagged_edit']);
        });

        it('refuses the day\'s 11th notifying edit with 429 before writing the edit', async () => {
            ownPreset('pending', DAILY_FLAGGED_EDIT_LIMIT);

            const res = await patch({ name: 'A perfectly clean name' });

            expect(res.status).toBe(429);
            const body = (await res.json()) as { error: string; reset_at: string };
            expect(body.error).toBe('RATE_LIMITED');
            expect(body.reset_at).toBeTruthy();
            expect(presetUpdate()).toBeNull();
            expect(await notifications()).toEqual([]);
            // The refused edit had already spent its Perspective call, so the
            // text-edit slot it charged up front stays charged (FINDING-005).
            expect(eventInserts().map((b) => b[1])).toEqual(['text_edit']);
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
                // `moderation_status` is typed `approved | pending`, so a preset
                // left in a moderator's own status reports none at all
                expect(await res.json()).not.toHaveProperty('moderation_status');
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
                // No moderator hears about it, so no flagged_edit — but the
                // Perspective call it spent is counted (FINDING-005).
                expect(eventInserts().map((b) => b[1])).toEqual(['text_edit']);
                // BUG-052: the write-once revert snapshot is still taken
                expect(appliedUpdate().query).toMatch(/previous_values\s*=\s*\?/);
                expect(await res.json()).not.toHaveProperty('moderation_status');
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
            expect(eventInserts().map((b) => b[1])).toEqual(['text_edit', 'flagged_edit']);
            const body = (await res.json()) as { moderation_status: string };
            expect(body.moderation_status).toBe('pending');
        });

        it('keeps an approved preset approved when its new name passes moderation', async () => {
            ownPreset('approved');

            const res = await patch({ name: 'A perfectly clean name' });

            expect(res.status).toBe(200);
            expect(await notifications()).toEqual([]);
            expect(eventInserts().map((b) => b[1])).toEqual(['text_edit']);
            const body = (await res.json()) as { moderation_status: string };
            expect(body.moderation_status).toBe('approved');
        });
    });

    // FINDING-005 (2026-08-29 security audit): the Perspective call is itself
    // the scarce resource (~1 QPS by default), and it used to be bounded only
    // by the per-IP limiter — the flagged-edit cap is charged *after* the call
    // and only to edits that reach a moderator. And when the call did fail, its
    // `null` counted as "passed", so a burst that drove Perspective to 429
    // auto-approved everything behind it.
    describe('the Perspective call is capped per user before it is made (FINDING-005)', () => {
        const originalFetch = globalThis.fetch;
        let fetchMock: ReturnType<typeof vi.fn>;
        let perspectiveEnv: Env;

        beforeEach(() => {
            fetchMock = vi.fn();
            globalThis.fetch = fetchMock as typeof globalThis.fetch;
            perspectiveEnv = createMockEnv({
                DB: mockDb as unknown as D1Database,
                PERSPECTIVE_API_KEY: 'test-api-key',
            });
        });

        afterEach(() => {
            globalThis.fetch = originalFetch;
        });

        /** The caller's own preset in `status`, having used `used[kind]` today. */
        const ownPreset = (status: string, used: Record<string, number> = {}) => {
            const row = createMockPresetRow({
                id: 'preset-123',
                author_discord_id: '123',
                name: 'Stored Name',
                description: 'The stored description, long enough.',
                status,
            });
            mockDb._setupMock((query: string, bindings: unknown[]) => {
                // getEventCountToday binds (user_discord_id, kind, from, to)
                if (query.includes('FROM submission_events')) {
                    return { count: used[String(bindings[1])] ?? 0 };
                }
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
                perspectiveEnv,
                ctx
            );

        it("refuses the day's 31st name edit with 429 before Perspective is called", async () => {
            ownPreset('approved', { text_edit: DAILY_TEXT_EDIT_LIMIT });

            const res = await patch({ name: 'A perfectly clean name' });

            expect(res.status).toBe(429);
            const body = (await res.json()) as { error: string; reset_at: string };
            expect(body.error).toBe('RATE_LIMITED');
            expect(body.reset_at).toBeTruthy();
            expect(fetchMock).not.toHaveBeenCalled();
            expect(mockDb._queries.some((q) => /UPDATE\s+presets/i.test(q))).toBe(false);
        });

        it.each(['rejected', 'flagged'])(
            'caps a %s preset\'s text edit too, though it notifies nobody',
            async (status) => {
                // The gap FINDING-004 left behind: an already-judged preset
                // never reaches the flagged-edit cap, so its Perspective call
                // had no per-user bound at all.
                ownPreset(status, { text_edit: DAILY_TEXT_EDIT_LIMIT });

                const res = await patch({ description: 'A completely new description here.' });

                expect(res.status).toBe(429);
                expect(fetchMock).not.toHaveBeenCalled();
                expect(mockDb._queries.some((q) => /UPDATE\s+presets/i.test(q))).toBe(false);
            }
        );

        it('charges one slot per name/description edit and none for other edits', async () => {
            ownPreset('approved');
            fetchMock.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    attributeScores: {
                        TOXICITY: { summaryScore: { value: 0.1 } },
                        SEVERE_TOXICITY: { summaryScore: { value: 0.05 } },
                        IDENTITY_ATTACK: { summaryScore: { value: 0.02 } },
                        INSULT: { summaryScore: { value: 0.1 } },
                        PROFANITY: { summaryScore: { value: 0.1 } },
                    },
                }),
            });

            // Tags, dyes, category and example link are never moderated.
            expect((await patch({ tags: ['a'] })).status).toBe(200);
            expect(fetchMock).not.toHaveBeenCalled();
            expect(eventInserts()).toHaveLength(0);

            expect((await patch({ name: 'A perfectly clean name' })).status).toBe(200);
            expect(fetchMock).toHaveBeenCalledOnce();
            expect(eventInserts().map((b) => b[1])).toEqual(['text_edit']);
        });
    });

    // FINDING-005: a configured moderation service that cannot answer is not an
    // all-clear. Every caller must behave exactly as it does for flagged text.
    describe('Perspective unavailable is treated as flagged (FINDING-005)', () => {
        const originalFetch = globalThis.fetch;
        let fetchMock: ReturnType<typeof vi.fn>;
        let discordFetch: ReturnType<typeof makeDiscordFetch>;
        let perspectiveEnv: Env;

        beforeEach(() => {
            fetchMock = vi.fn();
            globalThis.fetch = fetchMock as typeof globalThis.fetch;
            discordFetch = makeDiscordFetch();
            perspectiveEnv = createMockEnv({
                DB: mockDb as unknown as D1Database,
                PERSPECTIVE_API_KEY: 'test-api-key',
                DISCORD_WORKER: { fetch: discordFetch } as unknown as Fetcher,
                INTERNAL_WEBHOOK_SECRET: 'test-webhook-secret',
            });
            // The service logs the upstream failure it is reacting to.
            vi.spyOn(console, 'error').mockImplementation(() => {});
        });

        afterEach(() => {
            globalThis.fetch = originalFetch;
        });

        /** Perspective at its quota — the answer that used to pass everything. */
        const perspectiveUnavailable = () =>
            fetchMock.mockResolvedValueOnce({
                ok: false,
                status: 429,
                text: async () => 'RESOURCE_EXHAUSTED',
            });

        const notifications = async (): Promise<NotificationBody[]> => {
            await Promise.allSettled(waitUntilPromises);
            return Promise.all(
                discordFetch.mock.calls.map((call) => call[0].json() as Promise<NotificationBody>)
            );
        };

        it('persists a new submission as pending and notifies moderators', async () => {
            mockDb._setupMock((query: string) => {
                if (query.includes('FROM submission_events')) return { count: 0 };
                if (query.includes('COUNT') && query.includes('author_discord_id')) return { count: 0 };
                if (query.includes('FROM categories')) return [{ id: 'aesthetics' }, { id: 'jobs' }];
                if (query.includes('dye_signature')) return null;
                if (query.includes('INSERT')) return { success: true, meta: { changes: 1 } };
                if (query.includes('COUNT')) return { count: 1 };
                return { success: true };
            });
            perspectiveUnavailable();

            const res = await app.request(
                '/api/v1/presets',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...BOT_HEADERS },
                    body: JSON.stringify(createMockSubmission({ name: 'A perfectly clean name' })),
                },
                perspectiveEnv,
                ctx
            );

            expect(res.status).toBe(201);
            const body = (await res.json()) as { moderation_status: string };
            expect(body.moderation_status).toBe('pending');
            const sent = await notifications();
            expect(sent).toHaveLength(1);
            expect(sent[0].preset.status).toBe('pending');
            expect(sent[0].preset.moderation_status).toBe('flagged');
        });

        it("drops an approved preset into the queue on a name edit, and charges the flagged-edit cap", async () => {
            const row = createMockPresetRow({
                id: 'preset-123',
                author_discord_id: '123',
                name: 'Stored Name',
                description: 'The stored description, long enough.',
                status: 'approved',
            });
            mockDb._setupMock((query: string) => {
                if (query.includes('FROM submission_events')) return { count: 0 };
                return row;
            });
            perspectiveUnavailable();

            const res = await app.request(
                '/api/v1/presets/preset-123',
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', ...BOT_HEADERS },
                    body: JSON.stringify({ name: 'A perfectly clean name' }),
                },
                perspectiveEnv,
                ctx
            );

            expect(res.status).toBe(200);
            const body = (await res.json()) as { moderation_status: string };
            expect(body.moderation_status).toBe('pending');

            const updateIndex = mockDb._queries.findIndex((q) => /UPDATE\s+presets/i.test(q));
            expect(updateIndex).not.toBe(-1);
            expect(mockDb._queries[updateIndex]).toMatch(/status\s*=\s*\?/);
            expect(mockDb._bindings[updateIndex]).toContain('pending');

            const sent = await notifications();
            expect(sent).toHaveLength(1);
            expect(sent[0].preset.status).toBe('pending');
            expect(sent[0].preset.moderation_status).toBe('flagged');
            expect(eventInserts().map((b) => b[1])).toEqual(['text_edit', 'flagged_edit']);
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
