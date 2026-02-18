/**
 * Rate Limit Service Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
    checkSubmissionRateLimit,
    getRemainingSubmissions,
    checkPublicRateLimit,
    getClientIp,
} from '../../src/services/rate-limit-service';
import { createMockD1Database, resetCounters } from '../test-utils';

describe('RateLimitService', () => {
    beforeEach(() => {
        resetCounters();
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

            const result = await checkSubmissionRateLimit(db, 'user-123');

            // Should still use UTC day (June 15)
            expect(db._bindings[0]).toContain('2025-06-15T00:00:00.000Z');
        });

        it('should correctly calculate different users limits independently', async () => {
            const db = createMockD1Database();

            // First user has 5 submissions
            db._setupMock((query, bindings) => {
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
    // checkPublicRateLimit (IP-based)
    // ============================================

    describe('checkPublicRateLimit', () => {
        it('should allow first request from new IP', async () => {
            const result = await checkPublicRateLimit('192.168.1.1');

            expect(result.allowed).toBe(true);
            // Shared package starts at maxRequests - 1 after first check
            expect(result.remaining).toBe(99);
            expect(result.resetAt).toBeInstanceOf(Date);
        });

        it('should track multiple requests from same IP', async () => {
            const ip = '192.168.1.2';

            // First request - remaining is decremented after check
            let result = await checkPublicRateLimit(ip);
            expect(result.remaining).toBe(99);

            // Second request
            result = await checkPublicRateLimit(ip);
            expect(result.remaining).toBe(98);

            // Third request
            result = await checkPublicRateLimit(ip);
            expect(result.remaining).toBe(97);
        });

        it('should deny requests when limit is reached', async () => {
            const ip = '192.168.1.3';

            // Exhaust the limit (100 requests)
            for (let i = 0; i < 100; i++) {
                await checkPublicRateLimit(ip);
            }

            // 101st request should be denied
            const result = await checkPublicRateLimit(ip);
            expect(result.allowed).toBe(false);
            expect(result.remaining).toBe(0);
        });

        it('should track different IPs independently', async () => {
            const ip1 = '192.168.1.4';
            const ip2 = '192.168.1.5';

            // Use some of IP1's quota
            for (let i = 0; i < 50; i++) {
                await checkPublicRateLimit(ip1);
            }

            // IP2 should still have full quota (99 after first request)
            const result = await checkPublicRateLimit(ip2);
            expect(result.remaining).toBe(99);
        });

        it('should calculate resetAt correctly based on oldest request in window', async () => {
            const ip = '192.168.1.6';

            const result = await checkPublicRateLimit(ip);

            // Reset should be approximately 1 minute from the oldest request
            const now = Date.now();
            const resetTime = result.resetAt.getTime();

            // Should be within 60 seconds (+/- some tolerance) from now
            expect(resetTime).toBeGreaterThan(now);
            expect(resetTime).toBeLessThanOrEqual(now + 61000);
        });

        it('should not add request to log when denied', async () => {
            const ip = '192.168.1.7';

            // Exhaust the limit
            for (let i = 0; i < 100; i++) {
                await checkPublicRateLimit(ip);
            }

            // Try one more - should be denied
            const deniedResult = await checkPublicRateLimit(ip);
            expect(deniedResult.allowed).toBe(false);

            // Try again - remaining should still be 0 (not negative)
            const secondDeniedResult = await checkPublicRateLimit(ip);
            expect(secondDeniedResult.remaining).toBe(0);
        });
    });

    // ============================================
    // getClientIp
    // ============================================

    describe('getClientIp', () => {
        it('should extract IP from CF-Connecting-IP header', () => {
            const request = new Request('https://example.com', {
                headers: {
                    'CF-Connecting-IP': '203.0.113.1',
                },
            });

            const ip = getClientIp(request);
            expect(ip).toBe('203.0.113.1');
        });

        it('should fall back to X-Forwarded-For if CF-Connecting-IP not present', () => {
            const request = new Request('https://example.com', {
                headers: {
                    'X-Forwarded-For': '198.51.100.1, 10.0.0.1, 10.0.0.2',
                },
            });

            const ip = getClientIp(request);
            expect(ip).toBe('198.51.100.1');
        });

        it('should return first IP in X-Forwarded-For chain', () => {
            const request = new Request('https://example.com', {
                headers: {
                    'X-Forwarded-For': '192.0.2.1, 192.0.2.2, 192.0.2.3',
                },
            });

            const ip = getClientIp(request);
            expect(ip).toBe('192.0.2.1');
        });

        it('should trim whitespace from X-Forwarded-For IP', () => {
            const request = new Request('https://example.com', {
                headers: {
                    'X-Forwarded-For': '  192.0.2.50  , 10.0.0.1',
                },
            });

            const ip = getClientIp(request);
            expect(ip).toBe('192.0.2.50');
        });

        it('should return "unknown" if no IP headers present', () => {
            const request = new Request('https://example.com');

            const ip = getClientIp(request);
            expect(ip).toBe('unknown');
        });

        it('should prefer CF-Connecting-IP over X-Forwarded-For', () => {
            const request = new Request('https://example.com', {
                headers: {
                    'CF-Connecting-IP': '203.0.113.100',
                    'X-Forwarded-For': '198.51.100.200',
                },
            });

            const ip = getClientIp(request);
            expect(ip).toBe('203.0.113.100');
        });
    });
});
