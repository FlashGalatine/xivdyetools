/**
 * Mock Analytics Engine for testing Cloudflare Workers
 *
 * Provides a mock implementation of AnalyticsEngineDataset for testing
 * analytics and metrics tracking.
 *
 * @example
 * ```typescript
 * const analytics = createMockAnalyticsEngine();
 *
 * // Use in tests
 * const env = { ANALYTICS: analytics as unknown as AnalyticsEngineDataset };
 *
 * // After running code that writes analytics
 * expect(analytics._dataPoints).toHaveLength(1);
 * expect(analytics._dataPoints[0].indexes).toContain('command_usage');
 *
 * // Reset between tests
 * analytics._reset();
 * ```
 */

/**
 * Analytics data point
 */
export interface AnalyticsDataPoint {
  /** String indexes (dimensions) */
  indexes?: string[];
  /** Numeric values (metrics) */
  doubles?: number[];
  /** Binary data */
  blobs?: ArrayBuffer[];
  /** Timestamp of when the data point was written */
  timestamp: number;
}

/**
 * Extended mock Analytics Engine with test helpers
 */
export interface MockAnalyticsEngine {
  writeDataPoint: (dataPoint?: { indexes?: string[]; doubles?: number[]; blobs?: ArrayBuffer[] }) => void;

  /** Array of all data points written (for assertions) */
  _dataPoints: AnalyticsDataPoint[];

  /** Reset all data points */
  _reset: () => void;
}

/**
 * Creates a mock Analytics Engine for testing
 *
 * @returns A mock Analytics Engine that can be cast to AnalyticsEngineDataset
 */
export function createMockAnalyticsEngine(): MockAnalyticsEngine {
  const dataPoints: AnalyticsDataPoint[] = [];

  return {
    writeDataPoint: (dataPoint?: { indexes?: string[]; doubles?: number[]; blobs?: ArrayBuffer[] }) => {
      dataPoints.push({
        indexes: dataPoint?.indexes,
        doubles: dataPoint?.doubles,
        blobs: dataPoint?.blobs,
        timestamp: Date.now(),
      });
    },

    _dataPoints: dataPoints,

    _reset: () => {
      dataPoints.length = 0;
    },
  };
}
