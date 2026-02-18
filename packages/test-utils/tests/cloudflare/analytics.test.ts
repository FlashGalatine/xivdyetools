/**
 * Tests for Mock Analytics Engine
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createMockAnalyticsEngine } from '../../src/cloudflare/analytics.js';

describe('createMockAnalyticsEngine', () => {
  it('creates a mock analytics engine', () => {
    const analytics = createMockAnalyticsEngine();

    expect(analytics.writeDataPoint).toBeDefined();
    expect(analytics._dataPoints).toBeDefined();
    expect(analytics._reset).toBeDefined();
  });

  describe('writeDataPoint', () => {
    it('records data points', () => {
      const analytics = createMockAnalyticsEngine();

      analytics.writeDataPoint({
        indexes: ['command_usage', 'preset'],
        doubles: [1, 2, 3],
      });

      expect(analytics._dataPoints).toHaveLength(1);
      expect(analytics._dataPoints[0].indexes).toEqual(['command_usage', 'preset']);
      expect(analytics._dataPoints[0].doubles).toEqual([1, 2, 3]);
    });

    it('records timestamp', () => {
      const before = Date.now();
      const analytics = createMockAnalyticsEngine();

      analytics.writeDataPoint({ indexes: ['test'] });

      const after = Date.now();
      expect(analytics._dataPoints[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(analytics._dataPoints[0].timestamp).toBeLessThanOrEqual(after);
    });

    it('handles empty data point', () => {
      const analytics = createMockAnalyticsEngine();

      analytics.writeDataPoint();

      expect(analytics._dataPoints).toHaveLength(1);
      expect(analytics._dataPoints[0].indexes).toBeUndefined();
      expect(analytics._dataPoints[0].doubles).toBeUndefined();
    });

    it('handles blobs', () => {
      const analytics = createMockAnalyticsEngine();
      const blob = new ArrayBuffer(10);

      analytics.writeDataPoint({ blobs: [blob] });

      expect(analytics._dataPoints[0].blobs).toEqual([blob]);
    });

    it('accumulates multiple data points', () => {
      const analytics = createMockAnalyticsEngine();

      analytics.writeDataPoint({ indexes: ['first'] });
      analytics.writeDataPoint({ indexes: ['second'] });
      analytics.writeDataPoint({ indexes: ['third'] });

      expect(analytics._dataPoints).toHaveLength(3);
    });
  });

  describe('_reset', () => {
    it('clears all data points', () => {
      const analytics = createMockAnalyticsEngine();

      analytics.writeDataPoint({ indexes: ['test1'] });
      analytics.writeDataPoint({ indexes: ['test2'] });
      expect(analytics._dataPoints).toHaveLength(2);

      analytics._reset();

      expect(analytics._dataPoints).toHaveLength(0);
    });
  });
});
