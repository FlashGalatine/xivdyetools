/**
 * Dead-letter minimisation and retention (FINDING-017, 2026-08-29 security audit).
 *
 * `failed_notifications.payload` stored the whole notification body — the
 * author's Discord id, their display name and the full preset text — and
 * nothing ever deleted a row, so the dead letter outlived the preset, the
 * author's deletion request and the moderator who resolved it. A row now keeps
 * only what a moderator can act on (the preset id and the notification type),
 * the write path prunes by age, and the moderator listing never re-publishes
 * the fat payload a pre-FINDING-017 row still carries.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    storeFailedNotification,
    listFailedNotifications,
    FAILED_NOTIFICATION_RESOLVED_RETENTION_DAYS,
    FAILED_NOTIFICATION_UNRESOLVED_RETENTION_DAYS,
    type PresetNotificationPayload,
} from '../../src/services/notification-service';
import { createMockD1Database } from '../test-utils';

/** Everything a submission notification carries — most of which must not be stored. */
const submissionPayload: PresetNotificationPayload = {
    type: 'submission',
    preset: {
        id: 'preset-123',
        name: 'Sunset over Costa del Sol',
        description: 'Warm oranges for a beach glamour',
        category_id: 'aesthetics',
        dyes: [1, 2, 3],
        tags: ['warm', 'beach'],
        author_name: 'Author Displayname',
        author_discord_id: '123456789012345678',
        status: 'pending',
        moderation_status: 'flagged',
        source: 'web',
        created_at: '2026-08-29T11:00:00.000Z',
    },
};

const previewPayload: PresetNotificationPayload = {
    type: 'preview_image',
    preview_image_key: 'pending/preset-123/abcdef.webp',
    preset: {
        id: 'preset-123',
        name: 'Sunset over Costa del Sol',
        author_name: 'Author Displayname',
    },
};

/** The JSON actually bound to the INSERT's `payload` column. */
function storedPayload(db: ReturnType<typeof createMockD1Database>): Record<string, unknown> {
    const index = db._queries.findIndex((q) => /INSERT INTO failed_notifications/i.test(q));
    expect(index).toBeGreaterThanOrEqual(0);
    return JSON.parse(db._bindings[index][0] as string) as Record<string, unknown>;
}

/** `[query, bindings]` pairs for every statement matching `pattern`. */
function statementsMatching(
    db: ReturnType<typeof createMockD1Database>,
    pattern: RegExp
): { index: number; query: string; bindings: unknown[] }[] {
    return db._queries
        .map((query, index) => ({ index, query, bindings: db._bindings[index] }))
        .filter(({ query }) => pattern.test(query));
}

describe('dead-letter queue (FINDING-017)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-08-29T12:00:00.000Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('stored payload', () => {
        it('keeps the preset id and type, never the author or the preset text', async () => {
            const db = createMockD1Database();
            db._setupMock(() => ({ meta: { changes: 0 } }));

            await storeFailedNotification(db, submissionPayload, new Error('Discord worker returned 500'));

            const stored = storedPayload(db);
            expect(stored).toEqual({
                type: 'submission',
                preset_id: 'preset-123',
                moderation_status: 'flagged',
            });
            for (const forbidden of ['name', 'description', 'author_name', 'author_discord_id', 'dyes', 'tags', 'preset']) {
                expect(Object.keys(stored)).not.toContain(forbidden);
            }
            const insertIndex = db._queries.findIndex((q) => /INSERT INTO failed_notifications/i.test(q));
            const serialised = db._bindings[insertIndex][0] as string;
            expect(serialised).not.toContain('123456789012345678');
            expect(serialised).not.toContain('Author Displayname');
            expect(serialised).not.toContain('Sunset over Costa del Sol');

            // What a moderator actually triages on is untouched.
            expect(db._bindings[insertIndex][1]).toBe('Discord worker returned 500');
            expect(db._bindings[insertIndex][2]).toBe(4);
        });

        it('keeps the preset id and type for a preview-image notification', async () => {
            const db = createMockD1Database();
            db._setupMock(() => ({ meta: { changes: 0 } }));

            await storeFailedNotification(db, previewPayload, new Error('timeout'));

            expect(storedPayload(db)).toEqual({ type: 'preview_image', preset_id: 'preset-123' });
            const insertIndex = db._queries.findIndex((q) => /INSERT INTO failed_notifications/i.test(q));
            // The R2 key names the author's own upload; the id is enough to find it.
            expect(db._bindings[insertIndex][0] as string).not.toContain('abcdef.webp');
        });

    });

    describe('age-based pruning on the write path', () => {
        it('drops resolved rows after 30 days and unresolved rows after 90, before inserting', async () => {
            const db = createMockD1Database();
            db._setupMock(() => ({ meta: { changes: 0 } }));

            await storeFailedNotification(db, submissionPayload, new Error('boom'));

            const deletes = statementsMatching(db, /DELETE FROM failed_notifications/i);
            expect(deletes).toHaveLength(2);

            const resolvedPrune = deletes.find((s) => /resolved_at IS NOT NULL/i.test(s.query));
            expect(resolvedPrune).toBeDefined();
            expect(resolvedPrune!.query).toMatch(/resolved_at\s*<\s*\?/i);
            // 2026-08-29T12:00:00Z − 30 days, in the `datetime('now')` format the
            // column is written in (a `T…Z` ISO string would not compare).
            expect(resolvedPrune!.bindings).toEqual(['2026-07-30 12:00:00']);

            const unresolvedPrune = deletes.find((s) => /resolved_at IS NULL/i.test(s.query));
            expect(unresolvedPrune).toBeDefined();
            expect(unresolvedPrune!.query).toMatch(/created_at\s*<\s*\?/i);
            expect(unresolvedPrune!.bindings).toEqual(['2026-05-31 12:00:00']);

            // The 30-day cutoff is charged to resolved_at and the 90-day one to
            // created_at: a row nobody has triaged yet must survive the shorter window.
            expect(resolvedPrune!.query).not.toMatch(/created_at/i);
            expect(unresolvedPrune!.query).not.toMatch(/resolved_at\s*<\s*\?/i);

            const insertIndex = db._queries.findIndex((q) => /INSERT INTO failed_notifications/i.test(q));
            expect(insertIndex).toBeGreaterThan(Math.max(...deletes.map((s) => s.index)));

            expect(FAILED_NOTIFICATION_RESOLVED_RETENTION_DAYS).toBe(30);
            expect(FAILED_NOTIFICATION_UNRESOLVED_RETENTION_DAYS).toBe(90);
        });

        it('a failed prune never costs the dead-letter row it was making space for', async () => {
            const db = createMockD1Database();
            db._setupMock((query) => {
                if (/DELETE FROM failed_notifications/i.test(query)) {
                    throw new Error('D1_ERROR: no such table: failed_notifications');
                }
                return { meta: { changes: 1 } };
            });

            await expect(
                storeFailedNotification(db, submissionPayload, new Error('boom'))
            ).resolves.toBeUndefined();

            expect(db._queries.some((q) => /DELETE FROM failed_notifications/i.test(q))).toBe(true);
            expect(db._queries.some((q) => /INSERT INTO failed_notifications/i.test(q))).toBe(true);
        });
    });

    describe('moderator listing', () => {
        it('renders the id, type, preset id, error and timestamps', async () => {
            const db = createMockD1Database();
            db._setupMock(() => [
                {
                    id: 7,
                    payload: JSON.stringify({
                        type: 'submission',
                        preset_id: 'preset-123',
                        moderation_status: 'flagged',
                    }),
                    error: 'Discord worker returned 500',
                    attempts: 4,
                    created_at: '2026-08-29 11:00:00',
                    resolved_at: null,
                },
            ]);

            const rows = await listFailedNotifications(db, false);

            expect(rows).toEqual([
                {
                    id: 7,
                    type: 'submission',
                    preset_id: 'preset-123',
                    moderation_status: 'flagged',
                    error: 'Discord worker returned 500',
                    attempts: 4,
                    created_at: '2026-08-29 11:00:00',
                    resolved_at: null,
                },
            ]);
        });

        it('never re-publishes the author id or preset text a pre-FINDING-017 row still holds', async () => {
            const db = createMockD1Database();
            db._setupMock(() => [
                {
                    id: 3,
                    payload: JSON.stringify({
                        type: 'submission',
                        preset: {
                            id: 'preset-legacy',
                            name: 'Sunset over Costa del Sol',
                            description: 'Warm oranges',
                            author_name: 'Author Displayname',
                            author_discord_id: '123456789012345678',
                            moderation_status: 'clean',
                        },
                    }),
                    error: 'timeout',
                    attempts: 4,
                    created_at: '2026-05-01 11:00:00',
                    resolved_at: null,
                },
            ]);

            const rows = await listFailedNotifications(db, false);

            expect(rows[0].preset_id).toBe('preset-legacy');
            expect(rows[0].type).toBe('submission');
            const serialised = JSON.stringify(rows);
            expect(serialised).not.toContain('author_discord_id');
            expect(serialised).not.toContain('123456789012345678');
            expect(serialised).not.toContain('Author Displayname');
            expect(serialised).not.toContain('Sunset over Costa del Sol');
        });

        it('degrades to a null preset id rather than throwing on an unparsable payload', async () => {
            const db = createMockD1Database();
            db._setupMock(() => [
                {
                    id: 9,
                    payload: 'not json',
                    error: 'timeout',
                    attempts: 4,
                    created_at: '2026-08-29 11:00:00',
                    resolved_at: null,
                },
            ]);

            const rows = await listFailedNotifications(db, false);

            expect(rows).toHaveLength(1);
            expect(rows[0].preset_id).toBeNull();
            expect(rows[0].error).toBe('timeout');
        });
    });
});
