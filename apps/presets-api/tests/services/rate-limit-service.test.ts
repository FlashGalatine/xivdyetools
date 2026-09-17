/**
 * Rate Limit Service Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
    checkSubmissionRateLimit,
    getRemainingSubmissions,
    getSubmissionCountToday,
    reserveDailyEvent,
    DAILY_FLAGGED_EDIT_LIMIT,
} from '../../src/services/rate-limit-service';
import { createMockD1Database } from '../test-utils';

describe('RateLimitService', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    // ============================================
    // checkSubmissionRateLimit
    // ============================================

    describe('checkSubmissionRateLimit', () => {
        it('should allow submission when under limit', async () => {
            const db = createMockD1Database();
            db._setupMock(() => ({ count: 5 }));

            const result = await checkSubmissionRateLimit(db, 'user-123');

            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(5);
            expect(result.resetAt).toBeDefined();
        });

        it('should deny submission when at limit', async () => {
            const db = createMockD1Database();
            db._setupMock(() => ({ count: 10 }));

            const result = await checkSubmissionRateLimit(db, 'user-123');

            expect(result.allowed).toBe(false);
            expect(result.remaining).toBe(0);
        });

        it('should deny submission when over limit', async () => {
            const db = createMockD1Database();
            db._setupMock(() => ({ count: 15 })); // Somehow over limit

            const result = await checkSubmissionRateLimit(db, 'user-123');

            expect(result.allowed).toBe(false);
            expect(result.remaining).toBe(0);
        });

        it('should allow when no submissions today', async () => {
            const db = createMockD1Database();
            db._setupMock(() => ({ count: 0 }));

            const result = await checkSubmissionRateLimit(db, 'user-123');

            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(10);
        });

        it('should calculate remaining correctly', async () => {
            const db = createMockD1Database();
            db._setupMock(() => ({ count: 7 }));

            const result = await checkSubmissionRateLimit(db, 'user-123');

            expect(result.remaining).toBe(3);
        });

        it('should set resetAt to tomorrow midnight UTC', async () => {
            const db = createMockD1Database();
            db._setupMock(() => ({ count: 0 }));

            const result = await checkSubmissionRateLimit(db, 'user-123');

            const expectedReset = new Date('2025-06-16T00:00:00.000Z');
            expect(result.resetAt.toISOString()).toBe(expectedReset.toISOString());
        });

        it('should query for submissions within UTC day', async () => {
            const db = createMockD1Database();
            db._setupMock(() => ({ count: 0 }));

            await checkSubmissionRateLimit(db, 'user-123');

            // Check that the query includes today's date range
            expect(db._queries[0]).toContain('created_at >=');
            expect(db._queries[0]).toContain('created_at <');
            expect(db._bindings[0]).toContain('user-123');
            expect(db._bindings[0]).toContain('2025-06-15T00:00:00.000Z');
            expect(db._bindings[0]).toContain('2025-06-16T00:00:00.000Z');
        });

        it('should filter by author_discord_id', async () => {
            const db = createMockD1Database();
            db._setupMock(() => ({ count: 0 }));

            await checkSubmissionRateLimit(db, 'specific-user');

            expect(db._queries[0]).toContain('author_discord_id = ?');
            expect(db._bindings[0]).toContain('specific-user');
        });

        it('should handle null count result', async () => {
            const db = createMockD1Database();
            db._setupMock(() => null);

            const result = await checkSubmissionRateLimit(db, 'user-123');

            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(10);
        });

        it('should track limit at edge of day (just before midnight)', async () => {
            vi.setSystemTime(new Date('2025-06-15T23:59:59Z'));

            const db = createMockD1Database();
            db._setupMock(() => ({ count: 9 }));

            const result = await checkSubmissionRateLimit(db, 'user-123');

            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(1);
            // Reset should still be tomorrow
            expect(result.resetAt.toISOString()).toBe('2025-06-16T00:00:00.000Z');
        });

        it('should reset at new day (just after midnight)', async () => {
            vi.setSystemTime(new Date('2025-06-16T00:00:01Z'));

            const db = createMockD1Database();
            db._setupMock(() => ({ count: 0 })); // New day, no submissions

            const result = await checkSubmissionRateLimit(db, 'user-123');

            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(10);
            // Reset should be the following day
            expect(result.resetAt.toISOString()).toBe('2025-06-17T00:00:00.000Z');
        });
    });

    // ============================================
    // getRemainingSubmissions
    // ============================================

    describe('getRemainingSubmissions', () => {
        it('should return remaining and resetAt', async () => {
            const db = createMockD1Database();
            db._setupMock(() => ({ count: 3 }));

            const result = await getRemainingSubmissions(db, 'user-123');

            expect(result.remaining).toBe(7);
            expect(result.resetAt).toBeDefined();
            expect(result.resetAt instanceof Date).toBe(true);
        });

        it('should delegate to checkSubmissionRateLimit', async () => {
            const db = createMockD1Database();
            db._setupMock(() => ({ count: 10 }));

            const result = await getRemainingSubmissions(db, 'user-123');

            expect(result.remaining).toBe(0);
        });

        it('should return correct remaining when all used', async () => {
            const db = createMockD1Database();
            db._setupMock(() => ({ count: 10 }));

            const result = await getRemainingSubmissions(db, 'user-123');

            expect(result.remaining).toBe(0);
        });

        it('should return correct remaining when none used', async () => {
            const db = createMockD1Database();
            db._setupMock(() => ({ count: 0 }));

            const result = await getRemainingSubmissions(db, 'user-123');

            expect(result.remaining).toBe(10);
        });
    });

    // ============================================
    // Edge Cases and Time Zones
    // ============================================

    describe('Time Zone Handling', () => {
        it('should handle users submitting across timezone boundaries', async () => {
            // User's local time might be 11 PM on June 14, but UTC is 3 AM June 15
            vi.setSystemTime(new Date('2025-06-15T03:00:00Z'));

            const db = createMockD1Database();
            db._setupMock(() => ({ count: 5 }));

            await checkSubmissionRateLimit(db, 'user-123');

            // Should still use UTC day (June 15)
            expect(db._bindings[0]).toContain('2025-06-15T00:00:00.000Z');
        });

        it('should correctly calculate different users limits independently', async () => {
            const db = createMockD1Database();

            // First user has 5 submissions
            db._setupMock((_query, bindings) => {
                if (bindings[0] === 'user-1') return { count: 5 };
                if (bindings[0] === 'user-2') return { count: 2 };
                return { count: 0 };
            });

            const result1 = await checkSubmissionRateLimit(db, 'user-1');
            const result2 = await checkSubmissionRateLimit(db, 'user-2');

            expect(result1.remaining).toBe(5);
            expect(result2.remaining).toBe(8);
        });
    });

    // ============================================
    // Daily Limit Constant
    // ============================================

    describe('Daily Limit', () => {
        it('should use limit of 10 per day', async () => {
            const db = createMockD1Database();

            // Test at exactly 9 (under limit)
            db._setupMock(() => ({ count: 9 }));
            const allowedResult = await checkSubmissionRateLimit(db, 'user-123');
            expect(allowedResult.allowed).toBe(true);
            expect(allowedResult.remaining).toBe(1);

            // Clear for next test
            db._queries.length = 0;
            db._bindings.length = 0;

            // Test at exactly 10 (at limit)
            db._setupMock(() => ({ count: 10 }));
            const deniedResult = await checkSubmissionRateLimit(db, 'user-123');
            expect(deniedResult.allowed).toBe(false);
            expect(deniedResult.remaining).toBe(0);
        });
    });

    // ============================================
    // getSubmissionCountToday (BUG-049)
    // ============================================

    describe('getSubmissionCountToday', () => {
        it('should return the raw count for the current UTC day', async () => {
            const db = createMockD1Database();
            db._setupMock(() => ({ count: 11 }));

            const count = await getSubmissionCountToday(db, 'user-123');

            expect(count).toBe(11);
        });

        it('should return 0 when the query yields no row', async () => {
            const db = createMockD1Database();
            db._setupMock(() => null);

            const count = await getSubmissionCountToday(db, 'user-123');

            expect(count).toBe(0);
        });
    });

    // ============================================
    // reserveDailyEvent (BUG-015 — 2026-09-16 deep-dive)
    //
    // The old shape was check-then-insert: `checkDailyEventLimit` counted,
    // the caller acted, and a LATER `recordSubmissionEvent` inserted —
    // concurrent requests sitting at cap-1 could all pass the check before
    // any of them recorded, overshooting the cap. `reserveDailyEvent`
    // inserts FIRST, then counts (including its own row), so the insert
    // itself is what concurrent requests serialize on.
    // ============================================

    describe('reserveDailyEvent', () => {
        beforeEach(() => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        /**
         * A minimal in-memory `submission_events` table. Real enough that
         * `reserveDailyEvent`'s insert -> count -> maybe-delete sequence runs
         * against actual row state rather than a count the test hard-coded —
         * the id `release()` binds has to come from a real (fake)
         * autoincrement, or a test could not tell a genuine release from a
         * coincidence. Returns the live row map so tests can assert on table
         * state directly, independent of what `reserveDailyEvent` reports.
         */
        function mockSubmissionEventsTable(
            db: ReturnType<typeof createMockD1Database>
        ): Map<number, { user: string; kind: string }> {
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
                return null;
            });
            return rows;
        }

        it('admits a reservation under the cap and keeps its row', async () => {
            const db = createMockD1Database();
            const rows = mockSubmissionEventsTable(db);

            const result = await reserveDailyEvent(db, 'user-1', 'preview_upload', 'preset-1');

            expect(result.allowed).toBe(true);
            // Hard-coded, not `DAILY_PREVIEW_UPLOAD_LIMIT - 1`: `remaining` is
            // slots left AFTER this reservation (20 - 1 = 19), so an assertion
            // built from the same expression the code evaluates couldn't catch
            // an off-by-one in that expression.
            expect(result.remaining).toBe(19);
            expect(typeof result.release).toBe('function');
            // The row is really there — not just reported as allowed.
            expect(rows.size).toBe(1);
        });

        it('pins the boundary at the cap: the cap-th reservation is allowed, the (cap+1)-th is refused', async () => {
            const db = createMockD1Database();
            const rows = mockSubmissionEventsTable(db);

            for (let i = 1; i <= DAILY_FLAGGED_EDIT_LIMIT; i++) {
                const result = await reserveDailyEvent(db, 'user-1', 'flagged_edit');
                expect(result.allowed).toBe(true);
            }
            expect(rows.size).toBe(DAILY_FLAGGED_EDIT_LIMIT);

            const overCap = await reserveDailyEvent(db, 'user-1', 'flagged_edit');

            expect(overCap.allowed).toBe(false);
            expect(overCap.remaining).toBe(0);
            expect(overCap.release).toBeUndefined();
            // The refused reservation's own row is gone again — the table is
            // back to exactly the cap, not cap + 1.
            expect(rows.size).toBe(DAILY_FLAGGED_EDIT_LIMIT);
        });

        it("a refused reservation deletes its OWN row, not an admitted one", async () => {
            const db = createMockD1Database();
            const rows = mockSubmissionEventsTable(db);

            for (let i = 1; i <= DAILY_FLAGGED_EDIT_LIMIT; i++) {
                await reserveDailyEvent(db, 'user-1', 'flagged_edit');
            }
            const idsBefore = new Set(rows.keys());

            await reserveDailyEvent(db, 'user-1', 'flagged_edit');

            // Same id set as before the refused attempt — its row was
            // inserted then deleted, none of the earlier admitted rows moved.
            expect(new Set(rows.keys())).toEqual(idsBefore);
        });

        it('release() deletes exactly the reserved row and no other', async () => {
            const db = createMockD1Database();
            const rows = mockSubmissionEventsTable(db);

            // The mock's autoincrement is deterministic (first insert -> id 1,
            // second -> id 2), so we can name which physical row survives —
            // not just how many rows are left.
            await reserveDailyEvent(db, 'user-1', 'preview_upload', 'preset-keep');
            const toRelease = await reserveDailyEvent(db, 'user-1', 'preview_upload', 'preset-release');
            expect(rows.size).toBe(2);

            await toRelease.release!();

            expect(rows.size).toBe(1);
            expect(rows.has(1)).toBe(true); // the kept reservation's row
            expect(rows.has(2)).toBe(false); // the released one's row
        });

        it('a released reservation frees the slot for a later one under the same cap', async () => {
            const db = createMockD1Database();
            mockSubmissionEventsTable(db);

            for (let i = 1; i <= DAILY_FLAGGED_EDIT_LIMIT; i++) {
                const result = await reserveDailyEvent(db, 'user-1', 'flagged_edit');
                if (i === 1) await result.release!();
            }
            // One of the cap admissions above was released, so one more slot
            // is free even though DAILY_FLAGGED_EDIT_LIMIT reservations were
            // attempted and admitted.
            const result = await reserveDailyEvent(db, 'user-1', 'flagged_edit');

            expect(result.allowed).toBe(true);
        });

        it('a failed release is swallowed and logged, never thrown', async () => {
            const db = createMockD1Database();
            mockSubmissionEventsTable(db);
            const warn = vi.fn();

            const result = await reserveDailyEvent(db, 'user-1', 'preview_upload', 'preset-1', { warn });
            db._setupMock((query: string) => {
                if (/^\s*DELETE FROM submission_events\s+WHERE id\s*=/i.test(query)) {
                    throw new Error('D1_ERROR: database is locked');
                }
                return { count: 0 };
            });

            await expect(result.release!()).resolves.toBeUndefined();
            expect(warn).toHaveBeenCalledWith(
                '[BUG-015] failed to release a daily-event reservation',
                expect.objectContaining({ kind: 'preview_upload' })
            );
        });

        // Critical 1 (fix round 1, coordinator ruling): a rate-limiter D1
        // failure must never fail the mutation it is gating — `pruneSubmissionEvents`
        // and `recordSubmissionEvent` already promised this; `reserveDailyEvent`
        // has to keep the promise too, including for a migration
        // (0012_submission_events_text_edit.sql) that is hand-run and may not
        // be applied to a given environment.
        it('fails open when the INSERT itself rejects: allowed, no release DELETE issued, warn logged', async () => {
            const db = createMockD1Database();
            const warn = vi.fn();
            let releaseDeleteCalled = false;
            db._setupMock((query: string) => {
                if (/^\s*INSERT INTO submission_events/i.test(query)) {
                    throw new Error('D1_ERROR: no such table: submission_events');
                }
                if (/^\s*DELETE FROM submission_events\s+WHERE id\s*=/i.test(query)) {
                    releaseDeleteCalled = true;
                    return { success: true, meta: { changes: 1 } };
                }
                // The FINDING-017 prune's DELETE, which runs before the INSERT.
                return { meta: { changes: 0 } };
            });

            const result = await reserveDailyEvent(db, 'user-1', 'preview_upload', 'preset-1', { warn });

            expect(result.allowed).toBe(true);
            // Hard-coded: fail-open reports the raw cap, not a count it never
            // got to take (there is no row to count).
            expect(result.remaining).toBe(20);
            expect(releaseDeleteCalled).toBe(false);
            expect(warn).toHaveBeenCalledWith(
                '[BUG-015] daily-event reservation insert failed — failing open',
                expect.objectContaining({ kind: 'preview_upload' })
            );

            // The fail-open reservation's own release() is a genuine no-op —
            // there is no row to delete, so it must not issue a DELETE either.
            await expect(result.release!()).resolves.toBeUndefined();
            expect(releaseDeleteCalled).toBe(false);
        });

        it('fails open when the COUNT rejects after a successful INSERT: releases the inserted row, warn logged', async () => {
            const db = createMockD1Database();
            const warn = vi.fn();
            const insertedId = 1;
            let releaseDeleteCalledWith: unknown = undefined;
            db._setupMock((query: string, bindings: unknown[]) => {
                if (/^\s*INSERT INTO submission_events/i.test(query)) {
                    return { success: true, meta: { changes: 1, last_row_id: insertedId } };
                }
                if (/^\s*SELECT COUNT/i.test(query) && query.includes('FROM submission_events')) {
                    throw new Error('D1_ERROR: database is locked');
                }
                if (/^\s*DELETE FROM submission_events\s+WHERE id\s*=/i.test(query)) {
                    releaseDeleteCalledWith = bindings[0];
                    return { success: true, meta: { changes: 1 } };
                }
                // The FINDING-017 prune's DELETE, which runs before the INSERT.
                return { meta: { changes: 0 } };
            });

            const result = await reserveDailyEvent(db, 'user-1', 'preview_upload', 'preset-1', { warn });

            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(20);
            // The row the INSERT actually created was released, by its real id
            // — not a fabricated one.
            expect(releaseDeleteCalledWith).toBe(insertedId);
            expect(warn).toHaveBeenCalledWith(
                '[BUG-015] daily-event reservation count failed — failing open',
                expect.objectContaining({ kind: 'preview_upload', rowId: insertedId })
            );

            // The row is already gone, so the reservation's own release() is
            // now a no-op and must not attempt a second DELETE.
            releaseDeleteCalledWith = undefined;
            await expect(result.release!()).resolves.toBeUndefined();
            expect(releaseDeleteCalledWith).toBeUndefined();
        });

        it('reserves independently per kind: 30 seeded text_edit rows do not block a preview_upload reservation', async () => {
            const db = createMockD1Database();
            const rows = mockSubmissionEventsTable(db);

            // DAILY_PREVIEW_UPLOAD_LIMIT is 20 and DAILY_FLAGGED_EDIT_LIMIT is
            // 10 — with only 10 rows of another kind seeded, a kind-BLIND count
            // (10) would still read as "under cap" for preview_upload (20)
            // whether or not the kind filter is really there, so that pairing
            // could never fail. 30 seeded `text_edit` rows exceeds
            // DAILY_PREVIEW_UPLOAD_LIMIT (20): a kind-blind count would refuse
            // the preview_upload reservation outright. Seeded directly (ids
            // deliberately far outside the autoincrement range the real
            // reservations below use) rather than via 30 real reserveDailyEvent
            // calls, since text_edit's own cap (30) would otherwise be the
            // thing under test.
            for (let i = 0; i < 30; i++) {
                rows.set(100000 + i, { user: 'user-1', kind: 'text_edit' });
            }

            const result = await reserveDailyEvent(db, 'user-1', 'preview_upload');

            expect(result.allowed).toBe(true);
        });
    });
});
