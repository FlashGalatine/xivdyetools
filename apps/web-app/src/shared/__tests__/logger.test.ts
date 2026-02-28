/**
 * XIV Dye Tools - Logger Tests
 *
 * Comprehensive tests for centralized logger module
 * Covers logging levels, environment detection, performance monitoring, and error tracking
 *
 * @module shared/__tests__/logger.test
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';

// Unmock the logger module for this test file to test the actual implementation
vi.unmock('@shared/logger');

import { logger, perf, __setTestEnvironment } from '../logger';

describe('Logger Module', () => {
  // Store original console methods
  let consoleDebugSpy: MockInstance;
  let consoleInfoSpy: MockInstance;
  let consoleWarnSpy: MockInstance;
  let consoleErrorSpy: MockInstance;
  let consoleLogSpy: MockInstance;
  let consoleGroupSpy: MockInstance;
  let consoleGroupEndSpy: MockInstance;
  let consoleTableSpy: MockInstance;

  beforeEach(() => {
    // Mock console methods
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleGroupSpy = vi.spyOn(console, 'group').mockImplementation(() => {});
    consoleGroupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
    consoleTableSpy = vi.spyOn(console, 'table').mockImplementation(() => {});

    // Clear performance metrics between tests
    perf.clearMetrics();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Logger Methods
  // ==========================================================================

  describe('logger', () => {
    describe('debug', () => {
      it('should call console.debug in dev mode', () => {
        // In test environment (dev mode), debug should be called
        logger.debug('test message');
        expect(consoleDebugSpy).toHaveBeenCalledWith('test message');
      });

      it('should handle multiple arguments', () => {
        logger.debug('message', { data: 123 }, [1, 2, 3]);
        expect(consoleDebugSpy).toHaveBeenCalledWith('message', { data: 123 }, [1, 2, 3]);
      });
    });

    describe('info', () => {
      it('should call console.info in dev mode', () => {
        logger.info('info message');
        expect(consoleInfoSpy).toHaveBeenCalledWith('info message');
      });

      it('should handle objects and numbers', () => {
        logger.info('count:', 42, { status: 'ok' });
        expect(consoleInfoSpy).toHaveBeenCalledWith('count:', 42, { status: 'ok' });
      });
    });

    describe('warn', () => {
      it('should call console.warn in dev mode', () => {
        logger.warn('warning message');
        expect(consoleWarnSpy).toHaveBeenCalledWith('warning message');
      });

      it('should handle error objects', () => {
        const err = new Error('test error');
        logger.warn('Warning:', err);
        expect(consoleWarnSpy).toHaveBeenCalledWith('Warning:', err);
      });
    });

    describe('error', () => {
      it('should always call console.error', () => {
        logger.error('error message');
        expect(consoleErrorSpy).toHaveBeenCalledWith('error message');
      });

      it('should handle Error instances', () => {
        const err = new Error('test error');
        logger.error(err);
        expect(consoleErrorSpy).toHaveBeenCalledWith(err);
      });

      it('should handle multiple arguments with Error', () => {
        const err = new Error('test error');
        logger.error('Failed:', err, { context: 'test' });
        expect(consoleErrorSpy).toHaveBeenCalledWith('Failed:', err, { context: 'test' });
      });
    });

    describe('log', () => {
      it('should call console.log in dev mode', () => {
        logger.log('general message');
        expect(consoleLogSpy).toHaveBeenCalledWith('general message');
      });
    });

    describe('group', () => {
      it('should call console.group in dev mode', () => {
        logger.group('Test Group');
        expect(consoleGroupSpy).toHaveBeenCalledWith('Test Group');
      });
    });

    describe('groupEnd', () => {
      it('should call console.groupEnd in dev mode', () => {
        logger.groupEnd();
        expect(consoleGroupEndSpy).toHaveBeenCalled();
      });
    });

    describe('table', () => {
      it('should call console.table in dev mode', () => {
        const data = [{ name: 'test', value: 1 }];
        logger.table(data);
        expect(consoleTableSpy).toHaveBeenCalledWith(data);
      });
    });
  });

  // ==========================================================================
  // Performance Monitoring
  // ==========================================================================

  describe('perf', () => {
    describe('start and end', () => {
      it('should track timing between start and end', () => {
        perf.start('test-timer');
        const duration = perf.end('test-timer');

        expect(duration).toBeGreaterThanOrEqual(0);
      });

      it('should return 0 for non-existent timer', () => {
        // The @xivdyetools/logger package returns 0 for non-existent timers
        const duration = perf.end('non-existent-timer');
        expect(duration).toBe(0);
        expect(consoleWarnSpy).toHaveBeenCalled();
      });

      it('should record metrics correctly', () => {
        perf.start('metric-test');
        perf.end('metric-test');

        const metrics = perf.getMetrics('metric-test');
        expect(metrics).not.toBeNull();
        expect(metrics?.count).toBe(1);
        expect(metrics?.minTime).toBeGreaterThanOrEqual(0);
        expect(metrics?.maxTime).toBeGreaterThanOrEqual(0);
        expect(metrics?.avgTime).toBeGreaterThanOrEqual(0);
        // Note: @xivdyetools/logger uses totalTime instead of lastTime
        expect(metrics?.totalTime).toBeGreaterThanOrEqual(0);
      });

      it('should accumulate metrics over multiple calls', () => {
        perf.start('multi-call');
        perf.end('multi-call');
        perf.start('multi-call');
        perf.end('multi-call');
        perf.start('multi-call');
        perf.end('multi-call');

        const metrics = perf.getMetrics('multi-call');
        expect(metrics?.count).toBe(3);
      });
    });

    describe('measure (async)', () => {
      it('should measure async function execution time', async () => {
        const result = await perf.measure('async-test', async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return 'done';
        });

        expect(result).toBe('done');

        const metrics = perf.getMetrics('async-test');
        expect(metrics).not.toBeNull();
        // Allow some timing variance - setTimeout(10) may complete slightly faster
        // Use avgTime since @xivdyetools/logger doesn't track lastTime
        expect(metrics?.avgTime).toBeGreaterThanOrEqual(5);
      });

      it('should record metrics even if function throws', async () => {
        await expect(
          perf.measure('error-test', async () => {
            throw new Error('test error');
          })
        ).rejects.toThrow('test error');

        const metrics = perf.getMetrics('error-test');
        expect(metrics).not.toBeNull();
        expect(metrics?.count).toBe(1);
      });
    });

    describe('measureSync', () => {
      it('should measure sync function execution time', () => {
        const result = perf.measureSync('sync-test', () => {
          let sum = 0;
          for (let i = 0; i < 1000; i++) {
            sum += i;
          }
          return sum;
        });

        expect(result).toBe(499500); // Sum of 0 to 999

        const metrics = perf.getMetrics('sync-test');
        expect(metrics).not.toBeNull();
        expect(metrics?.count).toBe(1);
      });

      it('should record metrics even if function throws', () => {
        expect(() =>
          perf.measureSync('sync-error', () => {
            throw new Error('sync error');
          })
        ).toThrow('sync error');

        const metrics = perf.getMetrics('sync-error');
        expect(metrics).not.toBeNull();
        expect(metrics?.count).toBe(1);
      });
    });

    describe('getMetrics', () => {
      it('should return null for non-existent label', () => {
        const metrics = perf.getMetrics('non-existent');
        expect(metrics).toBeNull();
      });

      it('should return correct structure', () => {
        perf.start('structure-test');
        perf.end('structure-test');

        const metrics = perf.getMetrics('structure-test');
        expect(metrics).toHaveProperty('count');
        expect(metrics).toHaveProperty('avgTime');
        expect(metrics).toHaveProperty('minTime');
        expect(metrics).toHaveProperty('maxTime');
        // @xivdyetools/logger uses totalTime instead of lastTime
        expect(metrics).toHaveProperty('totalTime');
      });
    });

    describe('getAllMetrics', () => {
      it('should return empty object when no metrics recorded', () => {
        const allMetrics = perf.getAllMetrics();
        expect(allMetrics).toEqual({});
      });

      it('should return all recorded metrics', () => {
        perf.start('metric-a');
        perf.end('metric-a');
        perf.start('metric-b');
        perf.end('metric-b');

        const allMetrics = perf.getAllMetrics();
        expect(Object.keys(allMetrics)).toContain('metric-a');
        expect(Object.keys(allMetrics)).toContain('metric-b');
      });
    });

    describe('logMetrics', () => {
      it('should log metrics in dev mode', () => {
        perf.start('log-test');
        perf.end('log-test');

        perf.logMetrics();

        // The @xivdyetools/logger package uses console.group and console.log
        expect(consoleGroupSpy).toHaveBeenCalledWith('Performance Metrics');
        expect(consoleLogSpy).toHaveBeenCalled();
        expect(consoleGroupEndSpy).toHaveBeenCalled();
      });

      it('should handle no metrics gracefully', () => {
        // The @xivdyetools/logger package logs an empty group when no metrics
        perf.logMetrics();
        expect(consoleGroupSpy).toHaveBeenCalledWith('Performance Metrics');
        expect(consoleGroupEndSpy).toHaveBeenCalled();
      });
    });

    describe('clearMetrics', () => {
      it('should clear all recorded metrics', () => {
        perf.start('clear-test');
        perf.end('clear-test');

        expect(perf.getMetrics('clear-test')).not.toBeNull();

        perf.clearMetrics();

        expect(perf.getMetrics('clear-test')).toBeNull();
        expect(perf.getAllMetrics()).toEqual({});
      });

      it('should clear active timers', () => {
        perf.start('active-timer');

        perf.clearMetrics();

        // Timer should no longer exist - returns 0 in @xivdyetools/logger package
        const duration = perf.end('active-timer');
        expect(duration).toBe(0);
      });
    });
  });
});

describe('Performance Metrics Edge Cases', () => {
  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    perf.clearMetrics();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle min/max time tracking correctly', () => {
    // Create multiple measurements with varying durations
    for (let i = 0; i < 5; i++) {
      perf.start('minmax-test');
      // Small delay to ensure measurable time
      const start = performance.now();
      while (performance.now() - start < 1) {
        // Busy wait for 1ms
      }
      perf.end('minmax-test');
    }

    const metrics = perf.getMetrics('minmax-test');
    expect(metrics).not.toBeNull();
    expect(metrics!.minTime).toBeLessThanOrEqual(metrics!.maxTime);
    expect(metrics!.avgTime).toBeGreaterThanOrEqual(metrics!.minTime);
    expect(metrics!.avgTime).toBeLessThanOrEqual(metrics!.maxTime);
  });

  it('should handle zero count case in getAllMetrics', () => {
    // Start a timer but don't end it
    perf.start('incomplete');

    // getAllMetrics should only show completed timers
    const allMetrics = perf.getAllMetrics();
    expect(allMetrics['incomplete']).toBeUndefined();
  });
});

// ==========================================================================
// Dev Mode Logging Verification
// ==========================================================================
// These tests verify that logging works correctly in dev mode (the default test environment)

describe('Dev Mode Logging Behavior', () => {
  let consoleDebugSpy: MockInstance;
  let consoleInfoSpy: MockInstance;
  let consoleLogSpy: MockInstance;
  let consoleGroupSpy: MockInstance;
  let consoleGroupEndSpy: MockInstance;
  let consoleTableSpy: MockInstance;

  beforeEach(() => {
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleGroupSpy = vi.spyOn(console, 'group').mockImplementation(() => {});
    consoleGroupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
    consoleTableSpy = vi.spyOn(console, 'table').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should call console.debug in dev mode', () => {
    logger.debug('debug message');
    expect(consoleDebugSpy).toHaveBeenCalledWith('debug message');
  });

  it('should call console.info in dev mode', () => {
    logger.info('info message');
    expect(consoleInfoSpy).toHaveBeenCalledWith('info message');
  });

  it('should call console.log in dev mode', () => {
    logger.log('log message');
    expect(consoleLogSpy).toHaveBeenCalledWith('log message');
  });

  it('should call console.group in dev mode', () => {
    logger.group('group label');
    expect(consoleGroupSpy).toHaveBeenCalledWith('group label');
  });

  it('should call console.groupEnd in dev mode', () => {
    logger.groupEnd();
    expect(consoleGroupEndSpy).toHaveBeenCalled();
  });

  it('should call console.table in dev mode', () => {
    const data = [{ a: 1 }, { a: 2 }];
    logger.table(data);
    expect(consoleTableSpy).toHaveBeenCalledWith(data);
  });
});

// ==========================================================================
// Performance Monitoring Additional Tests
// ==========================================================================

describe('Performance Monitoring Dev Mode', () => {
  let consoleLogSpy: MockInstance;
  let consoleGroupSpy: MockInstance;

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleGroupSpy = vi.spyOn(console, 'group').mockImplementation(() => {});
    vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
    perf.clearMetrics();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should record metrics when timing operations', () => {
    // The @xivdyetools/logger package's perf.end() returns duration but doesn't
    // log it - use logMetrics() to display collected metrics
    perf.start('dev-timer');
    const duration = perf.end('dev-timer');

    // Duration should be returned
    expect(duration).toBeGreaterThanOrEqual(0);

    // Metrics should be recorded
    const metrics = perf.getMetrics('dev-timer');
    expect(metrics).not.toBeNull();
    expect(metrics?.count).toBe(1);
  });

  it('should log metrics via logMetrics()', () => {
    perf.start('duration-test');
    perf.end('duration-test');

    // Use logMetrics() to display collected metrics
    perf.logMetrics();

    expect(consoleGroupSpy).toHaveBeenCalledWith('Performance Metrics');
    expect(consoleLogSpy).toHaveBeenCalled();
    // The output format includes label and timing info
    const logCall = consoleLogSpy.mock.calls[0][0] as string;
    expect(logCall).toMatch(/duration-test/);
    expect(logCall).toMatch(/\d+\.\d+ms/);
  });
});

// ==========================================================================
// Environment Override Tests
// ==========================================================================

describe('__setTestEnvironment', () => {
  afterEach(() => {
    __setTestEnvironment(null);
    vi.restoreAllMocks();
  });

  it('should allow overriding to production mode', () => {
    const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

    // First verify dev mode works (default)
    __setTestEnvironment({ isDev: true, isProd: false });
    logger.debug('dev message');
    expect(consoleDebugSpy).toHaveBeenCalled();

    consoleDebugSpy.mockClear();

    // Now override to production
    __setTestEnvironment({ isDev: false, isProd: true });
    logger.debug('prod message');
    // In production, debug is NOT logged
    expect(consoleDebugSpy).not.toHaveBeenCalled();
  });

  it('should restore normal behavior when set to null', () => {
    const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

    // Override to production
    __setTestEnvironment({ isDev: false, isProd: true });
    logger.debug('should not log');
    expect(consoleDebugSpy).not.toHaveBeenCalled();

    // Restore normal (vitest runs in dev mode)
    __setTestEnvironment(null);
    logger.debug('should log');
    expect(consoleDebugSpy).toHaveBeenCalledWith('should log');
  });
});
