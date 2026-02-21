/**
 * Tests for Analytics Service
 *
 * Tests KV-based counters and Analytics Engine tracking.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  trackCommand,
  incrementCounter,
  getCounter,
  trackUniqueUser,
  trackCommandWithKV,
  getStats,
  type CommandEvent,
} from './analytics.js';
import type { Env } from '../types/env.js';

// Create mock KV namespace
// OPT-002: Updated to properly mock list() with metadata for getStats()
function createMockKV() {
  const store = new Map<string, string>();
  const metadata = new Map<string, { version: number; count: number }>();

  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    getWithMetadata: vi.fn(async (key: string) => ({
      value: store.get(key) ?? null,
      metadata: metadata.get(key) ?? null,
    })),
    put: vi.fn(async (key: string, value: string, options?: { metadata?: { version: number; count?: number } }) => {
      store.set(key, value);
      if (options?.metadata) {
        metadata.set(key, {
          version: options.metadata.version,
          count: options.metadata.count ?? (parseInt(value, 10) || 0),
        });
      }
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
      metadata.delete(key);
    }),
    // OPT-002: list() now returns keys with metadata from the store
    list: vi.fn(async (options?: { prefix?: string }) => {
      const prefix = options?.prefix || '';
      const keys: Array<{ name: string; metadata: { version: number; count: number } | null }> = [];
      for (const [key, value] of store.entries()) {
        if (key.startsWith(prefix)) {
          keys.push({
            name: key,
            metadata: metadata.get(key) ?? { version: 1, count: parseInt(value, 10) || 0 },
          });
        }
      }
      return { keys };
    }),
    _store: store,
    _metadata: metadata,
    // Helper to set data with proper metadata (for tests)
    _setWithMetadata: (key: string, value: string, count?: number) => {
      store.set(key, value);
      metadata.set(key, { version: 1, count: count ?? (parseInt(value, 10) || 0) });
    },
  } as unknown as KVNamespace & {
    _store: Map<string, string>;
    _metadata: Map<string, { version: number; count: number }>;
    _setWithMetadata: (key: string, value: string, count?: number) => void;
  };
}

// Create mock Analytics Engine
function createMockAnalytics() {
  return {
    writeDataPoint: vi.fn(),
  };
}

describe('analytics.ts', () => {
  let mockKV: ReturnType<typeof createMockKV>;
  let mockAnalytics: ReturnType<typeof createMockAnalytics>;
  let mockEnv: Env;

  beforeEach(() => {
    mockKV = createMockKV();
    mockAnalytics = createMockAnalytics();
    mockEnv = {
      DISCORD_PUBLIC_KEY: 'test-key',
      DISCORD_TOKEN: 'test-token',
      DISCORD_CLIENT_ID: 'test-app-id',
      PRESETS_API_URL: 'https://test-api.example.com',
      INTERNAL_WEBHOOK_SECRET: 'test-secret', // pragma: allowlist secret
      KV: mockKV,
      DB: {} as unknown as D1Database,
      ANALYTICS: mockAnalytics as unknown as AnalyticsEngineDataset,
    } as Env;

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('trackCommand', () => {
    it('should write data point to Analytics Engine with correct structure', () => {
      const event: CommandEvent = {
        commandName: 'harmony',
        userId: 'user-123',
        guildId: 'guild-456',
        success: true,
        latencyMs: 150,
      };

      trackCommand(mockEnv, event);

      expect(mockAnalytics.writeDataPoint).toHaveBeenCalledTimes(1);
      expect(mockAnalytics.writeDataPoint).toHaveBeenCalledWith({
        indexes: ['harmony'],
        blobs: ['harmony', 'user-123', 'guild-456', '1', ''],
        doubles: [1, 150, 1],
      });
    });

    it('should use "dm" for guildId when not provided', () => {
      const event: CommandEvent = {
        commandName: 'match',
        userId: 'user-123',
        success: true,
      };

      trackCommand(mockEnv, event);

      expect(mockAnalytics.writeDataPoint).toHaveBeenCalledWith(
        expect.objectContaining({
          blobs: expect.arrayContaining(['dm']),
        })
      );
    });

    it('should track failed commands with error type', () => {
      const event: CommandEvent = {
        commandName: 'dye',
        userId: 'user-123',
        guildId: 'guild-456',
        success: false,
        errorType: 'VALIDATION_ERROR',
      };

      trackCommand(mockEnv, event);

      expect(mockAnalytics.writeDataPoint).toHaveBeenCalledWith({
        indexes: ['dye'],
        blobs: ['dye', 'user-123', 'guild-456', '0', 'VALIDATION_ERROR'],
        doubles: [0, 0, 1],
      });
    });

    it('should silently skip when Analytics is not configured', () => {
      const envWithoutAnalytics = { ...mockEnv, ANALYTICS: undefined };
      const event: CommandEvent = {
        commandName: 'harmony',
        userId: 'user-123',
        success: true,
      };

      // Should not throw
      trackCommand(envWithoutAnalytics, event);
      expect(mockAnalytics.writeDataPoint).not.toHaveBeenCalled();
    });

    it('should catch errors without throwing', () => {
      mockAnalytics.writeDataPoint.mockImplementation(() => {
        throw new Error('Analytics error');
      });

      const event: CommandEvent = {
        commandName: 'harmony',
        userId: 'user-123',
        success: true,
      };

      // Should not throw (errors are silently caught when no logger is provided)
      expect(() => trackCommand(mockEnv, event)).not.toThrow();
    });

    it('should log errors when logger is provided', () => {
      mockAnalytics.writeDataPoint.mockImplementation(() => {
        throw new Error('Analytics error');
      });

      const mockLogger = {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        child: vi.fn().mockReturnThis(),
      } as unknown as import('@xivdyetools/logger').ExtendedLogger;

      const event: CommandEvent = {
        commandName: 'harmony',
        userId: 'user-123',
        success: true,
      };

      trackCommand(mockEnv, event, mockLogger);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Analytics tracking error',
        expect.any(Error)
      );
    });

    it('should pass undefined to logger for non-Error exceptions', () => {
      mockAnalytics.writeDataPoint.mockImplementation(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error -- intentionally testing non-Error exception handling
        throw 'string error';
      });

      const mockLogger = {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        child: vi.fn().mockReturnThis(),
      } as unknown as import('@xivdyetools/logger').ExtendedLogger;

      const event: CommandEvent = {
        commandName: 'harmony',
        userId: 'user-123',
        success: true,
      };

      trackCommand(mockEnv, event, mockLogger);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Analytics tracking error',
        undefined
      );
    });
  });

  describe('incrementCounter', () => {
    it('should create new counter starting at 1', async () => {
      await incrementCounter(mockKV, 'total');

      expect(mockKV.put).toHaveBeenCalledWith(
        'stats:total',
        '1',
        expect.objectContaining({ expirationTtl: 30 * 24 * 60 * 60 })
      );
    });

    it('should increment existing counter', async () => {
      mockKV._store.set('stats:total', '5');

      await incrementCounter(mockKV, 'total');

      expect(mockKV.put).toHaveBeenCalledWith(
        'stats:total',
        '6',
        expect.objectContaining({ expirationTtl: 30 * 24 * 60 * 60 })
      );
    });

    it('should handle command-specific counters', async () => {
      await incrementCounter(mockKV, 'cmd:harmony');

      expect(mockKV.put).toHaveBeenCalledWith(
        'stats:cmd:harmony',
        '1',
        expect.any(Object)
      );
    });
  });

  describe('getCounter', () => {
    it('should return 0 for non-existent counter', async () => {
      const result = await getCounter(mockKV, 'nonexistent');
      expect(result).toBe(0);
    });

    it('should return correct value for existing counter', async () => {
      mockKV._store.set('stats:total', '42');

      const result = await getCounter(mockKV, 'total');
      expect(result).toBe(42);
    });

    it('should handle command-specific counters', async () => {
      mockKV._store.set('stats:cmd:dye', '100');

      const result = await getCounter(mockKV, 'cmd:dye');
      expect(result).toBe(100);
    });
  });

  describe('trackUniqueUser', () => {
    // BUG-007: trackUniqueUser now uses per-user atomic keys (usertrack:YYYY-MM-DD:userId)
    // instead of a single comma-separated string. This eliminates race conditions.

    it('should add user to daily set', async () => {
      await trackUniqueUser(mockKV, 'user-123');

      // BUG-007: Each user gets their own key
      const stored = mockKV._store.get('usertrack:2024-06-15:user-123');
      expect(stored).toBe('1');
    });

    it('should track multiple users with individual keys', async () => {
      await trackUniqueUser(mockKV, 'user-111');
      await trackUniqueUser(mockKV, 'user-222');
      await trackUniqueUser(mockKV, 'user-333');

      // BUG-007: Each user has their own key
      expect(mockKV._store.get('usertrack:2024-06-15:user-111')).toBe('1');
      expect(mockKV._store.get('usertrack:2024-06-15:user-222')).toBe('1');
      expect(mockKV._store.get('usertrack:2024-06-15:user-333')).toBe('1');
    });

    it('should not duplicate existing user', async () => {
      // Pre-populate the user key
      mockKV._store.set('usertrack:2024-06-15:user-123', '1');

      await trackUniqueUser(mockKV, 'user-123');

      // BUG-007: Read-first check avoids unnecessary writes
      expect(mockKV.put).not.toHaveBeenCalled();
    });

    it('should use correct date for key', async () => {
      vi.setSystemTime(new Date('2024-12-25T23:59:59Z'));

      await trackUniqueUser(mockKV, 'user-123');

      expect(mockKV.put).toHaveBeenCalledWith(
        'usertrack:2024-12-25:user-123',
        '1',
        expect.objectContaining({ expirationTtl: expect.any(Number) })
      );
    });
  });

  describe('trackCommandWithKV', () => {
    it('should track both Analytics Engine and KV counters', async () => {
      const event: CommandEvent = {
        commandName: 'harmony',
        userId: 'user-123',
        guildId: 'guild-456',
        success: true,
      };

      await trackCommandWithKV(mockEnv, event);

      // Should call Analytics Engine
      expect(mockAnalytics.writeDataPoint).toHaveBeenCalled();

      // Should increment KV counters
      expect(mockKV._store.get('stats:total')).toBe('1');
      expect(mockKV._store.get('stats:cmd:harmony')).toBe('1');
      expect(mockKV._store.get('stats:success')).toBe('1');
      // BUG-007: User tracking uses individual keys
      expect(mockKV._store.get('usertrack:2024-06-15:user-123')).toBe('1');
    });

    it('should increment failure counter on failed command', async () => {
      const event: CommandEvent = {
        commandName: 'dye',
        userId: 'user-456',
        success: false,
        errorType: 'NOT_FOUND',
      };

      await trackCommandWithKV(mockEnv, event);

      expect(mockKV._store.get('stats:failure')).toBe('1');
      expect(mockKV._store.get('stats:success')).toBeUndefined();
    });

    it('should track multiple commands correctly', async () => {
      // First command
      await trackCommandWithKV(mockEnv, {
        commandName: 'harmony',
        userId: 'user-1',
        success: true,
      });

      // Second command
      await trackCommandWithKV(mockEnv, {
        commandName: 'dye',
        userId: 'user-2',
        success: true,
      });

      // Third command (same as first)
      await trackCommandWithKV(mockEnv, {
        commandName: 'harmony',
        userId: 'user-1',
        success: false,
      });

      expect(mockKV._store.get('stats:total')).toBe('3');
      expect(mockKV._store.get('stats:cmd:harmony')).toBe('2');
      expect(mockKV._store.get('stats:cmd:dye')).toBe('1');
      expect(mockKV._store.get('stats:success')).toBe('2');
      expect(mockKV._store.get('stats:failure')).toBe('1');
    });
  });

  describe('getStats', () => {
    it('should return zero stats for empty KV', async () => {
      const stats = await getStats(mockKV);

      expect(stats).toEqual({
        totalCommands: 0,
        successCount: 0,
        failureCount: 0,
        successRate: 0,
        commandBreakdown: {},
        uniqueUsersToday: 0,
      });
    });

    it('should return correct stats from KV', async () => {
      // Set up test data with metadata (OPT-002: list() reads from metadata)
      mockKV._setWithMetadata('stats:total', '100', 100);
      mockKV._setWithMetadata('stats:success', '95', 95);
      mockKV._setWithMetadata('stats:failure', '5', 5);
      mockKV._setWithMetadata('stats:cmd:harmony', '40', 40);
      mockKV._setWithMetadata('stats:cmd:dye', '30', 30);
      mockKV._setWithMetadata('stats:cmd:match', '20', 20);
      // BUG-007: Unique users are tracked with individual keys under usertrack: prefix
      mockKV._store.set('usertrack:2024-06-15:user-1', '1');
      mockKV._store.set('usertrack:2024-06-15:user-2', '1');
      mockKV._store.set('usertrack:2024-06-15:user-3', '1');

      const stats = await getStats(mockKV);

      expect(stats.totalCommands).toBe(100);
      expect(stats.successCount).toBe(95);
      expect(stats.failureCount).toBe(5);
      expect(stats.successRate).toBe(95);
      expect(stats.commandBreakdown).toEqual({
        harmony: 40,
        dye: 30,
        match: 20,
      });
      expect(stats.uniqueUsersToday).toBe(3);
    });

    it('should only include commands with non-zero counts', async () => {
      // OPT-002: Use setWithMetadata so list() returns proper counts
      mockKV._setWithMetadata('stats:cmd:harmony', '10', 10);
      mockKV._setWithMetadata('stats:cmd:dye', '0', 0); // Should not appear (count is 0)

      const stats = await getStats(mockKV);

      expect(stats.commandBreakdown).toEqual({ harmony: 10 });
      expect(stats.commandBreakdown['dye']).toBeUndefined();
    });

    it('should calculate success rate correctly', async () => {
      // OPT-002: Use setWithMetadata so list() returns proper counts
      mockKV._setWithMetadata('stats:total', '200', 200);
      mockKV._setWithMetadata('stats:success', '150', 150);
      mockKV._setWithMetadata('stats:failure', '50', 50);

      const stats = await getStats(mockKV);

      expect(stats.successRate).toBe(75);
    });

    it('should handle no unique users today', async () => {
      // BUG-007: No usertrack: keys means 0 unique users
      // (no setup needed — empty KV has no matching keys)
      const stats = await getStats(mockKV);

      expect(stats.uniqueUsersToday).toBe(0);
    });

    it('should use current date for unique users', async () => {
      vi.setSystemTime(new Date('2024-12-31T23:59:59Z'));
      // BUG-007: Individual user keys under usertrack: prefix
      mockKV._store.set('usertrack:2024-12-31:user-a', '1');
      mockKV._store.set('usertrack:2024-12-31:user-b', '1');

      const stats = await getStats(mockKV);

      expect(stats.uniqueUsersToday).toBe(2);
    });

    it('should use list() with prefix to fetch all stats keys (OPT-002)', async () => {
      // OPT-002: getStats now uses list() instead of individual get() calls
      // Set up some test data
      mockKV._setWithMetadata('stats:total', '10', 10);
      mockKV._setWithMetadata('stats:cmd:harmony', '5', 5);

      await getStats(mockKV);

      // Verify list() was called with the stats prefix
      expect(mockKV.list).toHaveBeenCalledWith({ prefix: 'stats:' });
    });
  });
});
