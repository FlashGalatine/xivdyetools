/**
 * Tests for RequestCoalescer - prevents duplicate in-flight requests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RequestCoalescer } from './request-coalescer';
import { createMockExecutionContext, resetAllMocks } from '../test-setup';

// We need to clear the module-level inFlightRequests map between tests
// Since it's not exported, we'll advance timers to clear it
describe('RequestCoalescer', () => {
  let mockCtx: ReturnType<typeof createMockExecutionContext>;
  let coalescer: RequestCoalescer;

  beforeEach(async () => {
    resetAllMocks();
    mockCtx = createMockExecutionContext();
    coalescer = new RequestCoalescer(mockCtx);
    vi.useFakeTimers();
    // Advance timers to ensure any lingering requests from previous tests are cleaned up
    await vi.advanceTimersByTimeAsync(35000);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllTimers();
  });

  describe('coalesce', () => {
    it('should execute fetch function and return result', async () => {
      const expectedData = { items: [1, 2, 3] };
      const fetchFn = vi.fn().mockResolvedValue(expectedData);

      const result = await coalescer.coalesce('test-key', fetchFn);

      expect(result).toEqual(expectedData);
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('should coalesce multiple simultaneous requests for the same key', async () => {
      const expectedData = { items: [1, 2, 3] };
      let resolvePromise: (value: unknown) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      const fetchFn = vi.fn().mockReturnValue(promise);

      // Start multiple requests simultaneously
      const request1 = coalescer.coalesce('same-key', fetchFn);
      const request2 = coalescer.coalesce('same-key', fetchFn);
      const request3 = coalescer.coalesce('same-key', fetchFn);

      // Resolve the underlying promise
      resolvePromise!(expectedData);

      // All requests should get the same result
      const [result1, result2, result3] = await Promise.all([request1, request2, request3]);

      expect(result1).toEqual(expectedData);
      expect(result2).toEqual(expectedData);
      expect(result3).toEqual(expectedData);

      // fetchFn should only be called once
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('should not coalesce requests with different keys', async () => {
      const fetchFn1 = vi.fn().mockResolvedValue({ key: 1 });
      const fetchFn2 = vi.fn().mockResolvedValue({ key: 2 });

      const [result1, result2] = await Promise.all([
        coalescer.coalesce('key-1', fetchFn1),
        coalescer.coalesce('key-2', fetchFn2),
      ]);

      expect(result1).toEqual({ key: 1 });
      expect(result2).toEqual({ key: 2 });
      expect(fetchFn1).toHaveBeenCalledTimes(1);
      expect(fetchFn2).toHaveBeenCalledTimes(1);
    });

    it('should propagate errors to all waiting requests', async () => {
      const error = new Error('Fetch failed');
      let rejectPromise: (error: Error) => void;
      const promise = new Promise((_, reject) => {
        rejectPromise = reject;
      });

      const fetchFn = vi.fn().mockReturnValue(promise);

      const request1 = coalescer.coalesce('error-key', fetchFn);
      const request2 = coalescer.coalesce('error-key', fetchFn);

      rejectPromise!(error);

      await expect(request1).rejects.toThrow('Fetch failed');
      await expect(request2).rejects.toThrow('Fetch failed');
    });

    it('should allow new requests after a failed request', async () => {
      const error = new Error('First request failed');
      const fetchFn1 = vi.fn().mockRejectedValue(error);
      const fetchFn2 = vi.fn().mockResolvedValue({ success: true });

      // First request fails
      await expect(coalescer.coalesce('retry-key', fetchFn1)).rejects.toThrow();

      // Second request should execute (not coalesce with failed request)
      // We need to wait a bit for the cleanup
      await vi.advanceTimersByTimeAsync(150);

      const result = await coalescer.coalesce('retry-key', fetchFn2);
      expect(result).toEqual({ success: true });
      expect(fetchFn2).toHaveBeenCalledTimes(1);
    });

    it('should register cleanup with waitUntil', async () => {
      const fetchFn = vi.fn().mockResolvedValue({ data: 'test' });

      await coalescer.coalesce('cleanup-test', fetchFn);

      // waitUntil should be called for cleanup and safety timeout
      expect(mockCtx.waitUntil).toHaveBeenCalled();
    });

    it('should clean up after request completes', async () => {
      const fetchFn = vi.fn().mockResolvedValue({ data: 'test' });

      await coalescer.coalesce('cleanup-key', fetchFn);

      // Initially the request is tracked
      expect(coalescer.isInFlight('cleanup-key')).toBe(true);

      // Wait for cleanup timeout
      await vi.advanceTimersByTimeAsync(150);

      expect(coalescer.isInFlight('cleanup-key')).toBe(false);
    });

    it('should clean up even with very long-running requests (safety timeout)', async () => {
      let resolvePromise: (value: unknown) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      const fetchFn = vi.fn().mockReturnValue(promise);

      // Start a request that won't complete for a while
      const requestPromise = coalescer.coalesce('long-running', fetchFn);

      expect(coalescer.isInFlight('long-running')).toBe(true);

      // Advance time past safety timeout (60 seconds) AND cleanup interval (10 seconds)
      // The cleanup only runs when cleanupStaleEntries() is called during a new coalesce()
      await vi.advanceTimersByTimeAsync(61000);

      // Trigger cleanup by starting a new request (cleanup runs at start of coalesce)
      const triggerCleanup = vi.fn().mockResolvedValue({ data: 'trigger' });
      await coalescer.coalesce('trigger-cleanup', triggerCleanup);
      await vi.advanceTimersByTimeAsync(150); // Wait for cleanup of trigger request

      // Safety cleanup should have removed the long-running entry
      expect(coalescer.isInFlight('long-running')).toBe(false);

      // Resolve the promise to complete the request
      resolvePromise!({ data: 'finally' });
      await requestPromise;
    });

    it('should handle safety timeout when request already completed (no-op branch)', async () => {
      // This test covers the branch where safety timeout fires but the key
      // has already been removed by normal cleanup
      const fetchFn = vi.fn().mockResolvedValue({ data: 'quick' });

      // Start and complete a fast request
      const result = await coalescer.coalesce('fast-key', fetchFn);
      expect(result).toEqual({ data: 'quick' });

      // Wait for normal cleanup (100ms delay after completion)
      await vi.advanceTimersByTimeAsync(150);

      // Key should already be cleaned up
      expect(coalescer.isInFlight('fast-key')).toBe(false);

      // Now advance past the safety timeout - it should be a no-op
      // The safety timeout was scheduled but the key is already gone
      await vi.advanceTimersByTimeAsync(31000);

      // Should still not be in flight (no error thrown)
      expect(coalescer.isInFlight('fast-key')).toBe(false);
    });
  });

  describe('isInFlight', () => {
    it('should return false for unknown keys', () => {
      expect(coalescer.isInFlight('unknown-key')).toBe(false);
    });

    it('should return true for in-flight requests', async () => {
      let resolvePromise: (value: unknown) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      const fetchFn = vi.fn().mockReturnValue(promise);

      const requestPromise = coalescer.coalesce('in-flight-key', fetchFn);

      expect(coalescer.isInFlight('in-flight-key')).toBe(true);

      resolvePromise!({ data: 'done' });
      await requestPromise;
    });
  });

  describe('getInFlightCount', () => {
    it('should track in-flight requests correctly', async () => {
      // Get the initial count (might not be 0 due to module-level map persisting)
      const initialCount = coalescer.getInFlightCount();

      const promises: Promise<unknown>[] = [];
      const resolvers: Array<(value: unknown) => void> = [];

      // Create multiple pending requests with unique keys for this test
      const uniquePrefix = `count-test-${Date.now()}`;
      for (let i = 0; i < 3; i++) {
        let resolver: (value: unknown) => void;
        const promise = new Promise((resolve) => {
          resolver = resolve;
        });
        resolvers.push(resolver!);

        const fetchFn = vi.fn().mockReturnValue(promise);
        promises.push(coalescer.coalesce(`${uniquePrefix}-${i}`, fetchFn));
      }

      // Count should increase by 3
      expect(coalescer.getInFlightCount()).toBe(initialCount + 3);

      // Resolve all and cleanup
      resolvers.forEach((resolve) => resolve({ data: 'done' }));
      await Promise.all(promises);
      await vi.advanceTimersByTimeAsync(150);

      // Count should return to initial
      expect(coalescer.getInFlightCount()).toBe(initialCount);
    });
  });

  describe('error handling edge cases', () => {
    it('should handle synchronous errors in fetch function', async () => {
      const fetchFn = vi.fn().mockImplementation(() => {
        throw new Error('Sync error');
      });

      await expect(coalescer.coalesce('sync-error', fetchFn)).rejects.toThrow('Sync error');
    });

    it('should isolate errors between different keys', async () => {
      const errorFetchFn = vi.fn().mockRejectedValue(new Error('Key 1 failed'));
      const successFetchFn = vi.fn().mockResolvedValue({ success: true });

      const [errorResult, successResult] = await Promise.allSettled([
        coalescer.coalesce('error-key', errorFetchFn),
        coalescer.coalesce('success-key', successFetchFn),
      ]);

      expect(errorResult.status).toBe('rejected');
      expect(successResult.status).toBe('fulfilled');
      if (successResult.status === 'fulfilled') {
        expect(successResult.value).toEqual({ success: true });
      }
    });
  });

  describe('real-world scenarios', () => {
    it('should handle rapid sequential requests for the same resource', async () => {
      let callCount = 0;
      const fetchFn = vi.fn().mockImplementation(async () => {
        callCount++;
        await new Promise((resolve) => setTimeout(resolve, 100));
        return { count: callCount };
      });

      // First request starts
      const promise1 = coalescer.coalesce('rapid-key', fetchFn);

      // Quick second request should coalesce
      const promise2 = coalescer.coalesce('rapid-key', fetchFn);

      // Advance timers to complete the request
      await vi.advanceTimersByTimeAsync(150);

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Both should get the same result from a single fetch
      expect(result1).toEqual({ count: 1 });
      expect(result2).toEqual({ count: 1 });
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('should handle mixed coalesced and separate requests', async () => {
      // These should coalesce (same key, concurrent)
      let resolveA: (value: unknown) => void;
      const promiseA = new Promise((resolve) => {
        resolveA = resolve;
      });
      const fetchA = vi.fn().mockReturnValue(promiseA);

      const req1 = coalescer.coalesce('key-a', fetchA);
      const req2 = coalescer.coalesce('key-a', fetchA);

      // This is a different key
      const req3 = coalescer.coalesce('key-b', () => Promise.resolve({ key: 'b' }));

      resolveA!({ key: 'a' });

      const results = await Promise.all([req1, req2, req3]);

      expect(results[0]).toEqual({ key: 'a' });
      expect(results[1]).toEqual({ key: 'a' });
      expect(results[2]).toEqual({ key: 'b' });
      expect(fetchA).toHaveBeenCalledTimes(1);
    });
  });
});
