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
 * after it, and for an already-judged preset only when the edit resubmits it — and an unavailable
 * Perspective is treated exactly as flagged content instead of as an all-clear.
 *
 * BUG-015 (2026-09-16 deep-dive) changed HOW `text_edit` / `flagged_edit` /
 * `preview_upload` are capped: `reserveDailyEvent` now inserts the event row
 * BEFORE counting (see rate-limit-service.ts), closing a check-then-insert
 * race. A mock that answers `FROM submission_events` with a fixed count no
 * longer models that correctly — the count has to reflect real row state
 * after the insert reserveDailyEvent just made — so this file drives every
 * test through `mockSubmissionEventsTable`, a small in-memory model of the
 * table, instead of a hard-coded number.
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

/**
 * A minimal in-memory `submission_events` table (BUG-015). `reserveDailyEvent`
 * inserts a row, then counts today's rows for that user+kind INCLUDING the
 * new one — a static `{ count: N }` mock can no longer tell a real reservation
 * apart from a refused one that self-deletes, so this tracks actual rows the
 * way real D1 would.
 *
 * `seed(kind, n)` pre-fills `n` rows of a kind before the request under test,
 * standing in for "already used n slots today" — what the old fixed counts
 * modelled directly. `events()` reads back which kinds are PERSISTED right
 * now (survivors only — a reservation that was inserted then deleted by a
 * refusal or a release never appears), in insertion order, which is what the
 * daily-cap tests actually care about.
 */
function mockSubmissionEventsTable(
    db: ReturnType<typeof createMockD1Database>,
    fallback: (query: string, bindings: unknown[]) => unknown
): { seed: (kind: string, n: number) => void; events: () => string[] } {
    let nextId = 1;
    const rows = new Map<number, { user: string; kind: string }>();
    db._setupMock((query: string, bindings: unknown[]) => {
        if (/^\s*INSERT INTO submission_events/i.test(query)) {
            const id = nextId++;
            rows.set(id, { user: String(bindings[0]), kind: String(bindings[1]) });
            return { success: true, meta: { changes: 1, last_row_id: id } };
        }
        if (/^\s*DELETE FROM submission_events\s+WHERE id\s*=/i.test(query)) {
            rows.delete(Number(bindings[0]));
            return { success: true, meta: { changes: 1 } };
        }
        if (/^\s*DELETE FROM submission_events\s+WHERE created_at/i.test(query)) {
            // The FINDING-017 prune — nothing ages out inside these tests.
            return { meta: { changes: 0 } };
        }
        if (/^\s*SELECT COUNT/i.test(query) && query.includes('FROM submission_events')) {
            const [userId, kind] = bindings;
            const count = [...rows.values()].filter(
                (r) => r.user === userId && r.kind === kind
            ).length;
            return { count };
        }
        return fallback(query, bindings);
    });
    return {
        seed: (kind: string, n: number) => {
            for (let i = 0; i < n; i++) rows.set(nextId++, { user: '123', kind });
        },
        events: () => [...rows.values()].map((r) => r.kind),
    };
}

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

    describe('POST /api/v1/presets', () => {
        it('records a submission event on a successful submission', async () => {
            const table = mockSubmissionEventsTable(mockDb, (query: string) => {
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
            expect(table.events()).toEqual(['submission']);
        });
    });

    describe('PATCH /api/v1/presets/:id (flagged edits)', () => {
        const row = () =>
            createMockPresetRow({ id: 'preset-123', author_discord_id: '123', status: 'approved' });

        it('returns 429 and persists nothing when the daily flagged-edit cap is used up', async () => {
            const table = mockSubmissionEventsTable(mockDb, () => row());
            table.seed('flagged_edit', DAILY_FLAGGED_EDIT_LIMIT);

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
            // BUG-015: the refused flagged_edit reservation inserted, then
            // deleted, its own row — the seeded rows are all that remain.
            expect(table.events().filter((k) => k === 'flagged_edit')).toHaveLength(
                DAILY_FLAGGED_EDIT_LIMIT
            );
            // The text-edit reservation (charged before moderation ran, and
            // never released — see the handler's own BUG-015 comment) did
            // survive the 429.
            expect(table.events().filter((k) => k === 'text_edit')).toHaveLength(1);
        });

        it('records a flagged_edit event when a flagged edit is accepted', async () => {
            const table = mockSubmissionEventsTable(mockDb, () => row());

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
            expect(table.events()).toEqual(['text_edit', 'flagged_edit']);
        });

        it('does not count a clean edit against the flagged-edit cap', async () => {
            const table = mockSubmissionEventsTable(mockDb, () => row());
            table.seed('flagged_edit', DAILY_FLAGGED_EDIT_LIMIT);

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
            expect(table.events().filter((k) => k === 'text_edit')).toHaveLength(1);
            expect(table.events().filter((k) => k === 'flagged_edit')).toHaveLength(
                DAILY_FLAGGED_EDIT_LIMIT
            );
        });

        // BUG-015: the reservation is tied to the UPDATE's own outcome — a
        // stale content-revision conflict means the act failed, so the
        // reserved slot has to come back.
        it('releases the flagged-edit reservation when the UPDATE reports a stale-revision conflict', async () => {
            const staleRow = { ...row(), content_revision: 5 };
            const table = mockSubmissionEventsTable(mockDb, (query: string) => {
                if (/^\s*UPDATE\s+presets/i.test(query)) {
                    // updatePreset reads back via `RETURNING *` through
                    // `.first()` — a conditional UPDATE that matched no row
                    // (stale content_revision) returns no row at all.
                    return null;
                }
                return staleRow;
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

            expect(res.status).toBe(409);
            // The text-edit reservation stays (Perspective was genuinely
            // spent); the flagged-edit one was released — the act never
            // actually notified anyone.
            expect(table.events()).toEqual(['text_edit']);
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
        let table: ReturnType<typeof mockSubmissionEventsTable>;

        beforeEach(() => {
            discordFetch = makeDiscordFetch();
            notifyEnv = createMockEnv({
                DB: mockDb as unknown as D1Database,
                DISCORD_WORKER: { fetch: discordFetch } as unknown as Fetcher,
                INTERNAL_WEBHOOK_SECRET: 'test-webhook-secret',
            });
        });

        const STORED_NAME = 'Stored Name';

        /**
         * The caller's own preset in `status`, having already used
         * `flaggedEditEventsUsedToday` of the flagged-edit cap specifically
         * (the boundary tests below are all about that cap — text-edit's own
         * cap, DAILY_TEXT_EDIT_LIMIT, is far higher and unaffected).
         */
        const ownPreset = (status: string, flaggedEditEventsUsedToday = 0) => {
            const row = createMockPresetRow({
                id: 'preset-123',
                author_discord_id: '123',
                name: STORED_NAME,
                description: 'The stored description, long enough.',
                status,
            });
            table = mockSubmissionEventsTable(mockDb, () => row);
            if (flaggedEditEventsUsedToday > 0) {
                table.seed('flagged_edit', flaggedEditEventsUsedToday);
            }
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
            expect(table.events()).toHaveLength(0);
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
            expect(table.events()).toEqual(['text_edit']);
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
            expect(table.events()).toEqual(['text_edit', 'flagged_edit']);
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
            // The 11th flagged_edit reservation was inserted then immediately
            // released — the table still shows exactly the 10 seeded rows.
            expect(table.events().filter((k) => k === 'text_edit')).toHaveLength(1);
            expect(table.events().filter((k) => k === 'flagged_edit')).toHaveLength(
                DAILY_FLAGGED_EDIT_LIMIT
            );
        });

        it.each(['rejected', 'flagged'])(
            'leaves a %s preset in its status and notifies nobody',
            async (status) => {
                ownPreset(status);

                const res = await patch({ tags: ['a'] });

                expect(res.status).toBe(200);
                expect(appliedUpdate().query).not.toMatch(/status\s*=\s*\?/);
                expect(await notifications()).toEqual([]);
                expect(table.events()).toHaveLength(0);
                // `moderation_status` is typed `approved | pending`, so a preset
                // left in a moderator's own status reports none at all
                expect(await res.json()).not.toHaveProperty('moderation_status');
            }
        );

        it('still notifies nobody when new text on a flagged preset trips moderation', async () => {
            // `flagged` is the moderator's own state: no owner edit moves it or
            // puts it back in front of them (unlike `rejected` below, which the
            // author owns the next move on).
            ownPreset('flagged');

            const res = await patch({ name: 'flagged name that is long enough' });

            expect(res.status).toBe(200);
            expect(appliedUpdate().query).not.toMatch(/status\s*=\s*\?/);
            expect(await notifications()).toEqual([]);
            // No moderator hears about it, so no flagged_edit — but the
            // Perspective call it spent is counted (FINDING-005).
            expect(table.events()).toEqual(['text_edit']);
            // BUG-052: the write-once revert snapshot is still taken
            expect(appliedUpdate().query).toMatch(/previous_values\s*=\s*\?/);
            expect(await res.json()).not.toHaveProperty('moderation_status');
        });

        // FINDING-004 follow-up: editing a rejected preset's text IS the
        // resubmission — it is what the web app's "Resubmit" button does (it
        // reopens the edit form). Leaving the status at `rejected` applied the
        // edit, told the author "changes saved" and showed no moderator
        // anything, so a rejected preset could never come back.
        it('resubmits a rejected preset when its new text is clean', async () => {
            ownPreset('rejected');

            const res = await patch({ name: 'A perfectly clean name' });

            expect(res.status).toBe(200);
            expect(appliedUpdate().query).toMatch(/status\s*=\s*\?/);
            expect(appliedUpdate().bindings).toContain('pending');
            const sent = await notifications();
            expect(sent).toHaveLength(1);
            expect(sent[0].preset.status).toBe('pending');
            expect(sent[0].preset.moderation_status).toBe('clean');
            // Charged to the same daily cap as every other notifying edit
            expect(table.events()).toEqual(['text_edit', 'flagged_edit']);
            const body = (await res.json()) as { moderation_status: string };
            expect(body.moderation_status).toBe('pending');
        });

        it('resubmits a rejected preset as flagged when its new text trips moderation', async () => {
            ownPreset('rejected');

            const res = await patch({ name: 'flagged name that is long enough' });

            expect(res.status).toBe(200);
            expect(appliedUpdate().query).toMatch(/status\s*=\s*\?/);
            expect(appliedUpdate().bindings).toContain('pending');
            const sent = await notifications();
            expect(sent).toHaveLength(1);
            expect(sent[0].preset.status).toBe('pending');
            expect(sent[0].preset.moderation_status).toBe('flagged');
            expect(table.events()).toEqual(['text_edit', 'flagged_edit']);
            // BUG-052: the write-once revert snapshot is still taken
            expect(appliedUpdate().query).toMatch(/previous_values\s*=\s*\?/);
            const body = (await res.json()) as { moderation_status: string };
            expect(body.moderation_status).toBe('pending');
        });

        it('resubmits nothing when a rejected preset\'s stored text is re-sent unchanged', async () => {
            // FINDING-004's exploit stays closed: a moderator gets nothing new
            // to judge, so nothing is queued and nobody is pinged.
            ownPreset('rejected');

            const res = await patch({ name: STORED_NAME, tags: ['a'] });

            expect(res.status).toBe(200);
            expect(appliedUpdate().query).not.toMatch(/status\s*=\s*\?/);
            expect(await notifications()).toEqual([]);
            expect(table.events()).toEqual(['text_edit']);
            expect(await res.json()).not.toHaveProperty('moderation_status');
        });

        it('refuses a rejected preset\'s resubmission once the notifying-edit cap is used up', async () => {
            ownPreset('rejected', DAILY_FLAGGED_EDIT_LIMIT);

            const res = await patch({ name: 'A perfectly clean name' });

            expect(res.status).toBe(429);
            const body = (await res.json()) as { error: string; reset_at: string };
            expect(body.error).toBe('RATE_LIMITED');
            expect(body.reset_at).toBeTruthy();
            expect(presetUpdate()).toBeNull();
            expect(await notifications()).toEqual([]);
            expect(table.events().filter((k) => k === 'text_edit')).toHaveLength(1);
            expect(table.events().filter((k) => k === 'flagged_edit')).toHaveLength(
                DAILY_FLAGGED_EDIT_LIMIT
            );
        });

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
            expect(table.events()).toEqual(['text_edit', 'flagged_edit']);
            const body = (await res.json()) as { moderation_status: string };
            expect(body.moderation_status).toBe('pending');
        });

        it('keeps an approved preset approved when its new name passes moderation', async () => {
            ownPreset('approved');

            const res = await patch({ name: 'A perfectly clean name' });

            expect(res.status).toBe(200);
            expect(await notifications()).toEqual([]);
            expect(table.events()).toEqual(['text_edit']);
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
        let table: ReturnType<typeof mockSubmissionEventsTable>;

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
            table = mockSubmissionEventsTable(mockDb, () => row);
            for (const [kind, n] of Object.entries(used)) {
                if (n > 0) table.seed(kind, n);
            }
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
            // The refused reservation self-deleted — still exactly the cap.
            expect(table.events().filter((k) => k === 'text_edit')).toHaveLength(
                DAILY_TEXT_EDIT_LIMIT
            );
        });

        it.each(['rejected', 'flagged'])(
            'caps an already-judged (%s) preset\'s text edit too',
            async (status) => {
                // The gap FINDING-004 left behind: this cap is the only one an
                // edit of a `flagged` preset ever meets (it notifies nobody, so
                // it never reaches the flagged-edit cap), and it is the first
                // one a `rejected` preset's resubmission meets. Without it the
                // Perspective call had no per-user bound at all.
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
            expect(table.events()).toHaveLength(0);

            expect((await patch({ name: 'A perfectly clean name' })).status).toBe(200);
            expect(fetchMock).toHaveBeenCalledOnce();
            expect(table.events()).toEqual(['text_edit']);
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
            mockSubmissionEventsTable(mockDb, (query: string) => {
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
            const table = mockSubmissionEventsTable(mockDb, () => row);
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
            expect(table.events()).toEqual(['text_edit', 'flagged_edit']);
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
            const table = mockSubmissionEventsTable(mockDb, () =>
                createMockPresetRow({ id: 'preset-123', author_discord_id: '123' })
            );
            table.seed('preview_upload', DAILY_PREVIEW_UPLOAD_LIMIT);

            const res = await app.request(
                '/api/v1/presets/preset-123/preview-image',
                { method: 'POST', headers: BOT_HEADERS, body: png },
                env,
                ctx
            );

            expect(res.status).toBe(429);
            expect(fetchSpy).not.toHaveBeenCalled();
            // The refused reservation self-deleted (BUG-015) — no image
            // decode was ever attempted, and the seeded rows are untouched.
            expect(table.events()).toHaveLength(DAILY_PREVIEW_UPLOAD_LIMIT);
        });

        it('records a preview_upload event on a successful upload', async () => {
            const table = mockSubmissionEventsTable(mockDb, () =>
                createMockPresetRow({ id: 'preset-123', author_discord_id: '123' })
            );

            const res = await app.request(
                '/api/v1/presets/preset-123/preview-image',
                { method: 'POST', headers: BOT_HEADERS, body: png },
                env,
                ctx
            );

            expect(res.status).toBe(200);
            expect(table.events()).toEqual(['preview_upload']);
        });

        // B2 (2026-09-16 fix wave): a body read that throws (client
        // disconnect mid-upload) sat between the reservation and the first
        // release site, unwrapped — burning a daily slot for a request that
        // never stored anything. A ReadableStream that errors on read makes
        // `c.req.arrayBuffer()` itself reject, the same shape a real
        // disconnect produces.
        it('releases the reservation when reading the request body throws', async () => {
            const table = mockSubmissionEventsTable(mockDb, () =>
                createMockPresetRow({ id: 'preset-123', author_discord_id: '123' })
            );
            const erroringBody = new ReadableStream<Uint8Array>({
                start(controller) {
                    controller.error(new Error('client disconnected'));
                },
            });

            const res = await app.request(
                '/api/v1/presets/preset-123/preview-image',
                {
                    method: 'POST',
                    headers: BOT_HEADERS,
                    body: erroringBody,
                    duplex: 'half',
                } as RequestInit,
                env,
                ctx
            );

            // Hono's default error handling turns the rethrown error into a
            // 500 (no app.onError() is registered in this test harness) --
            // the same status the unwrapped read-then-throw path produced.
            // What this test actually verifies is that the reservation was
            // released before that error left the handler.
            expect(res.status).toBe(500);
            expect(table.events()).toHaveLength(0);
        });

        // BUG-015: a body that never becomes a stored image must not cost the
        // author their daily quota — matches the old check-then-record shape,
        // where the record call sat at the very end and these paths never
        // reached it.
        it('releases the reservation when the uploaded bytes are not a real image', async () => {
            const table = mockSubmissionEventsTable(mockDb, () =>
                createMockPresetRow({ id: 'preset-123', author_discord_id: '123' })
            );

            const res = await app.request(
                '/api/v1/presets/preset-123/preview-image',
                { method: 'POST', headers: BOT_HEADERS, body: new Uint8Array([1, 2, 3, 4]) },
                env,
                ctx
            );

            expect(res.status).toBe(400);
            expect(table.events()).toHaveLength(0);
        });

        it('releases the reservation when the body is empty', async () => {
            const table = mockSubmissionEventsTable(mockDb, () =>
                createMockPresetRow({ id: 'preset-123', author_discord_id: '123' })
            );

            const res = await app.request(
                '/api/v1/presets/preset-123/preview-image',
                { method: 'POST', headers: BOT_HEADERS, body: new Uint8Array([]) },
                env,
                ctx
            );

            expect(res.status).toBe(400);
            expect(table.events()).toHaveLength(0);
        });

        it('releases the reservation when the body exceeds the 5 MB limit', async () => {
            const table = mockSubmissionEventsTable(mockDb, () =>
                createMockPresetRow({ id: 'preset-123', author_discord_id: '123' })
            );
            // Real PNG magic bytes so ONLY the size check can reject this.
            const big = new Uint8Array(5 * 1024 * 1024 + 1);
            big.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);

            const res = await app.request(
                '/api/v1/presets/preset-123/preview-image',
                { method: 'POST', headers: BOT_HEADERS, body: big },
                env,
                ctx
            );

            expect(res.status).toBe(400);
            expect(table.events()).toHaveLength(0);
        });

        // Important 2 (fix round 1): the release sites at the storePreviewImage
        // catch and the DB UPDATE catch had no dedicated coverage.
        it('releases the reservation when storePreviewImage rejects (image-worker returns non-ok)', async () => {
            const table = mockSubmissionEventsTable(mockDb, () =>
                createMockPresetRow({ id: 'preset-123', author_discord_id: '123' })
            );
            const failingImageWorkerEnv = createMockEnv({
                DB: mockDb as unknown as D1Database,
                IMAGE_WORKER: {
                    fetch: async () => new Response('bad image', { status: 500 }),
                } as unknown as Fetcher,
            });

            const res = await app.request(
                '/api/v1/presets/preset-123/preview-image',
                { method: 'POST', headers: BOT_HEADERS, body: png },
                failingImageWorkerEnv,
                ctx
            );

            expect(res.status).toBe(400);
            const body = (await res.json()) as { message: string };
            expect(body.message).toBe('Image could not be processed');
            expect(table.events()).toHaveLength(0);
        });

        it('releases the reservation when the DB UPDATE itself throws', async () => {
            const table = mockSubmissionEventsTable(mockDb, (query: string) => {
                if (/^\s*UPDATE\s+presets\s+SET\s+preview_image_key/i.test(query)) {
                    throw new Error('D1_ERROR: database is locked');
                }
                return createMockPresetRow({ id: 'preset-123', author_discord_id: '123' });
            });

            const res = await app.request(
                '/api/v1/presets/preset-123/preview-image',
                { method: 'POST', headers: BOT_HEADERS, body: png },
                env,
                ctx
            );

            // Hono's default error handling turns the rethrown error into a
            // 500 (no app.onError() is registered in this test harness); what
            // this test actually verifies is that the reservation was released
            // before that error left the handler.
            expect(res.status).toBe(500);
            expect(table.events()).toHaveLength(0);
        });
    });
});
