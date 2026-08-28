/**
 * Append-only daily quotas (FINDING-008 / PAPI-1, 2026-08-21 audit).
 *
 * The daily submission cap used to count surviving rows in `presets`, so an
 * author could delete their own presets and submit again all day. Quota-
 * bearing mutations now also write `submission_events` rows that user actions
 * never delete, and the caps count those.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    checkSubmissionRateLimit,
    checkDailyEventLimit,
    recordSubmissionEvent,
    DAILY_SUBMISSION_LIMIT,
    DAILY_FLAGGED_EDIT_LIMIT,
    DAILY_PREVIEW_UPLOAD_LIMIT,
} from '../../src/services/rate-limit-service';
import { createMockD1Database } from '../test-utils';

describe('append-only daily quotas', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-08-21T12:00:00Z'));
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('denies a submission when the author deleted their rows but already used the quota today', async () => {
        const db = createMockD1Database();
        db._setupMock((query) =>
            query.includes('submission_events') ? { count: DAILY_SUBMISSION_LIMIT } : { count: 0 }
        );

        const result = await checkSubmissionRateLimit(db, '123456789012345678');

        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
    });

    it('still allows a submission when both counts are under the cap', async () => {
        const db = createMockD1Database();
        db._setupMock(() => ({ count: 3 }));

        const result = await checkSubmissionRateLimit(db, '123456789012345678');

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(DAILY_SUBMISSION_LIMIT - 3);
    });

    it('recordSubmissionEvent inserts an append-only row with the kind and preset id', async () => {
        const db = createMockD1Database();
        db._setupMock(() => ({ success: true, meta: { changes: 1 } }));

        await recordSubmissionEvent(db, '123456789012345678', 'preview_upload', 'preset-1');

        const insert = db._queries.find((q) => /INSERT INTO submission_events/i.test(q));
        expect(insert).toBeDefined();
        expect(db._bindings[db._queries.indexOf(insert!)]).toEqual([
            '123456789012345678',
            'preview_upload',
            'preset-1',
        ]);
    });

    it('checkDailyEventLimit counts only the requested kind for the UTC day', async () => {
        const db = createMockD1Database();
        db._setupMock((query, bindings) => {
            expect(query).toMatch(/FROM submission_events/);
            expect(bindings[0]).toBe('123456789012345678');
            expect(bindings[1]).toBe('flagged_edit');
            expect(bindings[2]).toBe('2026-08-21T00:00:00.000Z');
            expect(bindings[3]).toBe('2026-08-22T00:00:00.000Z');
            return { count: DAILY_FLAGGED_EDIT_LIMIT };
        });

        const result = await checkDailyEventLimit(db, '123456789012345678', 'flagged_edit');

        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
        expect(result.resetAt.toISOString()).toBe('2026-08-22T00:00:00.000Z');
    });

    it('exposes sane default caps', () => {
        expect(DAILY_FLAGGED_EDIT_LIMIT).toBeGreaterThan(0);
        expect(DAILY_PREVIEW_UPLOAD_LIMIT).toBeGreaterThan(0);
    });
});
