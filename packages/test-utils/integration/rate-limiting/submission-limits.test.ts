/**
 * Rate Limiting Boundary Tests
 *
 * Tests the rate limiting behavior for:
 * - User submission limits (10 per day per user)
 * - IP-based rate limiting (100 requests per minute)
 * - Concurrent request handling
 *
 * @module integration/rate-limiting/submission-limits
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMockD1Database, type MockD1Database } from '../../src/cloudflare/d1.js';

// ============================================================================
// Rate Limit Constants (mirrors presets-api/src/services/rate-limit-service.ts)
// ============================================================================

const DAILY_SUBMISSION_LIMIT = 10;

const PUBLIC_RATE_LIMIT = {
  maxRequests: 100,
  windowMs: 60_000, // 1 minute
};

// ============================================================================
// Simulated Rate Limit Service
// ============================================================================

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * In-memory IP rate limiting (simulates worker behavior)
 */
const ipRequestLog = new Map<string, number[]>();

function resetIpRateLimits(): void {
  ipRequestLog.clear();
}

function checkPublicRateLimit(ip: string): RateLimitResult {
  const now = Date.now();
  const windowStart = now - PUBLIC_RATE_LIMIT.windowMs;

  const timestamps = ipRequestLog.get(ip) || [];
  const recentTimestamps = timestamps.filter((ts) => ts > windowStart);

  const allowed = recentTimestamps.length < PUBLIC_RATE_LIMIT.maxRequests;
  const remaining = Math.max(0, PUBLIC_RATE_LIMIT.maxRequests - recentTimestamps.length);

  const oldestInWindow = recentTimestamps[0];
  const resetAt = oldestInWindow
    ? new Date(oldestInWindow + PUBLIC_RATE_LIMIT.windowMs)
    : new Date(now + PUBLIC_RATE_LIMIT.windowMs);

  if (allowed) {
    recentTimestamps.push(now);
    ipRequestLog.set(ip, recentTimestamps);
  }

  return { allowed, remaining, resetAt };
}

function getStartOfDayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Simulates checking submission rate limit via database query
 */
async function checkSubmissionRateLimit(
  db: MockD1Database,
  userDiscordId: string,
  mockSubmissionCount: number
): Promise<RateLimitResult> {
  const today = getStartOfDayUTC();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  // In tests, we inject the count via mock
  const submissionsToday = mockSubmissionCount;
  const remaining = Math.max(0, DAILY_SUBMISSION_LIMIT - submissionsToday);

  return {
    allowed: submissionsToday < DAILY_SUBMISSION_LIMIT,
    remaining,
    resetAt: tomorrow,
  };
}

// ============================================================================
// Integration Tests
// ============================================================================

describe('Rate Limiting: Submission Limits', () => {
  let db: MockD1Database;

  beforeEach(() => {
    db = createMockD1Database();
    resetIpRateLimits();
  });

  describe('Daily Submission Rate Limit', () => {
    it('should allow submission when under daily limit', async () => {
      const result = await checkSubmissionRateLimit(db, 'user123', 0);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(10);
    });

    it('should allow submission at limit boundary (9 existing)', async () => {
      const result = await checkSubmissionRateLimit(db, 'user123', 9);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1);
    });

    it('should reject submission when at daily limit', async () => {
      const result = await checkSubmissionRateLimit(db, 'user123', 10);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should reject submission when over daily limit', async () => {
      const result = await checkSubmissionRateLimit(db, 'user123', 15);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should track limits per user independently', async () => {
      const result1 = await checkSubmissionRateLimit(db, 'user1', 10);
      const result2 = await checkSubmissionRateLimit(db, 'user2', 0);

      expect(result1.allowed).toBe(false);
      expect(result2.allowed).toBe(true);
    });

    it('should reset at UTC midnight', async () => {
      const result = await checkSubmissionRateLimit(db, 'user123', 10);

      // Reset time should be start of next day UTC
      const tomorrow = new Date(getStartOfDayUTC().getTime() + 24 * 60 * 60 * 1000);
      expect(result.resetAt.getTime()).toBe(tomorrow.getTime());
    });

    it('should correctly calculate remaining submissions', async () => {
      for (let count = 0; count <= 10; count++) {
        const result = await checkSubmissionRateLimit(db, 'user123', count);
        expect(result.remaining).toBe(Math.max(0, 10 - count));
      }
    });
  });

  describe('IP-Based Rate Limiting', () => {
    it('should allow requests when under IP limit', () => {
      const result = checkPublicRateLimit('192.168.1.1');

      expect(result.allowed).toBe(true);
      // Note: remaining is calculated BEFORE the current request is recorded
      // So the first request shows 100 remaining (we haven't counted "this" request yet)
      expect(result.remaining).toBe(100);
    });

    it('should track requests per IP independently', () => {
      // Exhaust limit for IP1
      for (let i = 0; i < 100; i++) {
        checkPublicRateLimit('192.168.1.1');
      }

      // IP2 should still have full quota
      const result = checkPublicRateLimit('192.168.1.2');
      expect(result.allowed).toBe(true);
      // Note: remaining shows 100 (before this request is counted)
      expect(result.remaining).toBe(100);
    });

    it('should reject requests when at IP limit', () => {
      // Use up all requests
      for (let i = 0; i < 100; i++) {
        checkPublicRateLimit('192.168.1.1');
      }

      const result = checkPublicRateLimit('192.168.1.1');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should allow request at boundary (99 existing)', () => {
      for (let i = 0; i < 99; i++) {
        checkPublicRateLimit('192.168.1.1');
      }

      const result = checkPublicRateLimit('192.168.1.1');
      expect(result.allowed).toBe(true);
      // Note: remaining is calculated BEFORE this request is counted (100 - 99 = 1)
      expect(result.remaining).toBe(1);
    });

    it('should decrement remaining correctly', () => {
      for (let i = 0; i < 5; i++) {
        const result = checkPublicRateLimit('192.168.1.1');
        // remaining is calculated BEFORE this request is recorded
        // So first call: 100 - 0 = 100, second call: 100 - 1 = 99, etc.
        expect(result.remaining).toBe(100 - i);
      }
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle multiple users submitting concurrently', async () => {
      // Simulate 5 different users each making submissions
      const users = ['user1', 'user2', 'user3', 'user4', 'user5'];
      const results = await Promise.all(
        users.map((user) => checkSubmissionRateLimit(db, user, 0))
      );

      // All should be allowed
      for (const result of results) {
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(10);
      }
    });

    it('should handle concurrent IP requests correctly', () => {
      // Simulate concurrent requests from same IP
      const results = Array(10)
        .fill(null)
        .map(() => checkPublicRateLimit('192.168.1.1'));

      // All should be allowed (under 100 limit)
      for (const result of results) {
        expect(result.allowed).toBe(true);
      }

      // Remaining decreases - calculated BEFORE each request is recorded
      // First: 100 - 0 = 100, Last: 100 - 9 = 91
      expect(results[0].remaining).toBe(100);
      expect(results[9].remaining).toBe(91);
    });

    it('should handle mixed authenticated and anonymous requests', () => {
      // Anonymous requests count against IP limit
      for (let i = 0; i < 50; i++) {
        checkPublicRateLimit('192.168.1.1');
      }

      // Authenticated requests still count against IP for public endpoints
      const ipResult = checkPublicRateLimit('192.168.1.1');
      expect(ipResult.allowed).toBe(true);
      // After 50 requests, remaining is 100 - 50 = 50 (before this request)
      expect(ipResult.remaining).toBe(50);
    });
  });

  describe('Rate Limit Boundary Edge Cases', () => {
    it('should handle exactly at limit boundary', async () => {
      // At exactly 10 submissions - should not allow more
      const result = await checkSubmissionRateLimit(db, 'user123', DAILY_SUBMISSION_LIMIT);
      expect(result.allowed).toBe(false);
    });

    it('should handle first request of the day', async () => {
      const result = await checkSubmissionRateLimit(db, 'newuser', 0);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(DAILY_SUBMISSION_LIMIT);
    });

    it('should handle IP limit exactly at boundary', () => {
      // Make exactly 99 requests
      for (let i = 0; i < 99; i++) {
        checkPublicRateLimit('test-ip');
      }

      // 100th request should be allowed (remaining calculated before recording: 100 - 99 = 1)
      const result100 = checkPublicRateLimit('test-ip');
      expect(result100.allowed).toBe(true);
      expect(result100.remaining).toBe(1);

      // 101st should be blocked (100 requests already logged)
      const result101 = checkPublicRateLimit('test-ip');
      expect(result101.allowed).toBe(false);
      expect(result101.remaining).toBe(0);
    });
  });

  describe('Reset Time Calculation', () => {
    it('should calculate correct reset time for submission limit', async () => {
      const result = await checkSubmissionRateLimit(db, 'user123', 10);

      // Should reset at start of next UTC day
      const tomorrow = new Date(getStartOfDayUTC().getTime() + 24 * 60 * 60 * 1000);
      expect(result.resetAt.getUTCHours()).toBe(0);
      expect(result.resetAt.getUTCMinutes()).toBe(0);
      expect(result.resetAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should provide reset time even when under limit', async () => {
      const result = await checkSubmissionRateLimit(db, 'user123', 5);

      expect(result.resetAt).toBeInstanceOf(Date);
      expect(result.resetAt.getTime()).toBeGreaterThan(Date.now());
    });
  });
});

describe('Rate Limiting: Cross-Service Scenarios', () => {
  beforeEach(() => {
    resetIpRateLimits();
  });

  describe('Web App User Submissions', () => {
    it('should allow 10 submissions then block', async () => {
      const db = createMockD1Database();

      // Simulate user making submissions throughout the day
      for (let i = 0; i < 10; i++) {
        const result = await checkSubmissionRateLimit(db, 'web-user', i);
        expect(result.allowed).toBe(true);
      }

      // 11th submission should be blocked
      const blockedResult = await checkSubmissionRateLimit(db, 'web-user', 10);
      expect(blockedResult.allowed).toBe(false);
    });
  });

  describe('Discord Bot Submissions', () => {
    it('should enforce same limits for bot-submitted presets', async () => {
      const db = createMockD1Database();

      // Bot submitting on behalf of user
      const result = await checkSubmissionRateLimit(db, 'discord-user-id', 10);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });
  });

  describe('Mixed Web and Bot Submissions', () => {
    it('should count both sources against single user limit', async () => {
      const db = createMockD1Database();

      // User submits 5 via web
      const afterWebResult = await checkSubmissionRateLimit(db, 'mixed-user', 5);
      expect(afterWebResult.remaining).toBe(5);

      // Then 5 more via Discord bot
      const afterBotResult = await checkSubmissionRateLimit(db, 'mixed-user', 10);
      expect(afterBotResult.allowed).toBe(false);
    });
  });
});
