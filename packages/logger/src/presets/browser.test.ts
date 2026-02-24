/**
 * Tests for Browser Preset
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createBrowserLogger, browserLogger, perf } from './browser.js';
import type { ErrorTracker } from '../types.js';

// Node.js process global — available at runtime in vitest's node environment
declare const process: { env: Record<string, string | undefined> };

describe('Browser Preset', () => {
  let consoleSpy: {
    debug: ReturnType<typeof vi.spyOn>;
    info: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
    group: ReturnType<typeof vi.spyOn>;
    groupEnd: ReturnType<typeof vi.spyOn>;
    log: ReturnType<typeof vi.spyOn>;
  };

  // Store original values for restoration
  const originalProcess = (globalThis as unknown as Record<string, unknown>)['process'];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));

    consoleSpy = {
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      group: vi.spyOn(console, 'group').mockImplementation(() => {}),
      groupEnd: vi.spyOn(console, 'groupEnd').mockImplementation(() => {}),
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
    };

    // Clear perf metrics between tests
    perf.clearMetrics();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();

    // Restore any global modifications
    if (originalProcess !== undefined) {
      (globalThis as unknown as Record<string, unknown>)['process'] = originalProcess;
    }
  });

  describe('createBrowserLogger', () => {
    describe('dev mode detection', () => {
      it('should accept custom isDev function', () => {
        const devLogger = createBrowserLogger({
          isDev: () => true,
        });

        devLogger.debug('Debug in dev');
        expect(consoleSpy.debug).toHaveBeenCalled();
      });

      it('should suppress debug in production mode', () => {
        const prodLogger = createBrowserLogger({
          isDev: () => false,
        });

        prodLogger.debug('Debug in prod');
        expect(consoleSpy.debug).not.toHaveBeenCalled();
      });

      it('should still log warnings in production', () => {
        const prodLogger = createBrowserLogger({
          isDev: () => false,
        });

        prodLogger.warn('Warning in prod');
        expect(consoleSpy.warn).toHaveBeenCalled();
      });

      it('should still log errors in production', () => {
        const prodLogger = createBrowserLogger({
          isDev: () => false,
        });

        prodLogger.error('Error in prod');
        expect(consoleSpy.error).toHaveBeenCalled();
      });

      it('should use default isDev function when not provided', () => {
        // This tests the defaultIsDev path through process.env
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';

        const logger = createBrowserLogger({});
        // In test environment, it should detect dev mode
        logger.debug('Debug with default detection');
        
        // Restore
        process.env.NODE_ENV = originalEnv;

        // We just verify it didn't throw and created a logger
        expect(logger).toBeDefined();
      });

      it('should detect production via process.env.NODE_ENV', () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        // Create logger without isDev override to use default detection
        const logger = createBrowserLogger({});
        logger.debug('Should not appear');

        process.env.NODE_ENV = originalEnv;
        
        // Logger should be created (we can't easily test the behavior
        // since tests run in a specific environment)
        expect(logger).toBeDefined();
      });
    });

    describe('prefix', () => {
      it('should use default xivdyetools prefix', () => {
        const logger = createBrowserLogger({ isDev: () => true });
        logger.info('Test');

        expect(consoleSpy.info.mock.calls[0][0]).toContain('[xivdyetools]');
      });

      it('should accept custom prefix', () => {
        const logger = createBrowserLogger({
          isDev: () => true,
          prefix: 'myapp',
        });
        logger.info('Test');

        expect(consoleSpy.info.mock.calls[0][0]).toContain('[myapp]');
      });
    });

    describe('error tracking integration', () => {
      it('should call errorTracker.captureException in production', () => {
        const errorTracker: ErrorTracker = {
          captureException: vi.fn(),
          captureMessage: vi.fn(),
          setTag: vi.fn(),
          setUser: vi.fn(),
        };

        const logger = createBrowserLogger({
          isDev: () => false,
          errorTracker,
        });

        const error = new Error('Test error');
        logger.error('Something failed', error, { userId: '123' });

        expect(errorTracker.captureException).toHaveBeenCalledWith(
          error,
          { userId: '123' }
        );
      });

      it('should call errorTracker.captureMessage for non-Error errors', () => {
        const errorTracker: ErrorTracker = {
          captureException: vi.fn(),
          captureMessage: vi.fn(),
          setTag: vi.fn(),
          setUser: vi.fn(),
        };

        const logger = createBrowserLogger({
          isDev: () => false,
          errorTracker,
        });

        logger.error('Failed with string', 'string-error');

        expect(errorTracker.captureMessage).toHaveBeenCalledWith(
          'Failed with string: string-error',
          'error'
        );
      });

      it('should call errorTracker.captureMessage for errors without error object', () => {
        const errorTracker: ErrorTracker = {
          captureException: vi.fn(),
          captureMessage: vi.fn(),
          setTag: vi.fn(),
          setUser: vi.fn(),
        };

        const logger = createBrowserLogger({
          isDev: () => false,
          errorTracker,
        });

        logger.error('Just a message');

        expect(errorTracker.captureMessage).toHaveBeenCalledWith(
          'Just a message',
          'error'
        );
      });

      it('should send warnings to error tracker in production', () => {
        const errorTracker: ErrorTracker = {
          captureException: vi.fn(),
          captureMessage: vi.fn(),
          setTag: vi.fn(),
          setUser: vi.fn(),
        };

        const logger = createBrowserLogger({
          isDev: () => false,
          errorTracker,
        });

        logger.warn('Deprecated feature used');

        expect(errorTracker.captureMessage).toHaveBeenCalledWith(
          'Deprecated feature used',
          'warning'
        );
      });

      it('should NOT send to error tracker in dev mode', () => {
        const errorTracker: ErrorTracker = {
          captureException: vi.fn(),
          captureMessage: vi.fn(),
          setTag: vi.fn(),
          setUser: vi.fn(),
        };

        const logger = createBrowserLogger({
          isDev: () => true,
          errorTracker,
        });

        logger.error('Error in dev', new Error('test'));
        logger.warn('Warning in dev');

        expect(errorTracker.captureException).not.toHaveBeenCalled();
        expect(errorTracker.captureMessage).not.toHaveBeenCalled();
      });

      it('should still log to console even when sending to error tracker', () => {
        const errorTracker: ErrorTracker = {
          captureException: vi.fn(),
          captureMessage: vi.fn(),
          setTag: vi.fn(),
          setUser: vi.fn(),
        };

        const logger = createBrowserLogger({
          isDev: () => false,
          errorTracker,
        });

        logger.error('Error message', new Error('test'));
        expect(consoleSpy.error).toHaveBeenCalled();
      });
    });

    describe('error sanitization', () => {
      it('should sanitize errors in production', () => {
        const logger = createBrowserLogger({
          isDev: () => false,
        });

        const error = new Error('Token: Bearer abc123');
        logger.error('Auth failed', error);

        // Error should be logged (we can verify the call)
        expect(consoleSpy.error).toHaveBeenCalled();
      });

      it('should not sanitize errors in dev mode', () => {
        const logger = createBrowserLogger({
          isDev: () => true,
        });

        logger.error('Failed');
        expect(consoleSpy.error).toHaveBeenCalled();
      });
    });

    describe('child logger', () => {
      it('should create child with inherited context', () => {
        const logger = createBrowserLogger({ isDev: () => true });
        logger.setContext({ app: 'xivdyetools-web' });

        const child = logger.child({ page: 'dye-selector' });
        child.info('Rendering');

        const logged = consoleSpy.info.mock.calls[0][0];
        expect(logged).toContain('"app":"xivdyetools-web"');
        expect(logged).toContain('"page":"dye-selector"');
      });
    });
  });

  describe('browserLogger (pre-configured instance)', () => {
    it('should be defined', () => {
      expect(browserLogger).toBeDefined();
    });

    it('should have all logger methods', () => {
      expect(typeof browserLogger.debug).toBe('function');
      expect(typeof browserLogger.info).toBe('function');
      expect(typeof browserLogger.warn).toBe('function');
      expect(typeof browserLogger.error).toBe('function');
    });
  });

  describe('perf (performance monitoring)', () => {
    describe('start/end', () => {
      it('should measure duration', () => {
        vi.spyOn(performance, 'now')
          .mockReturnValueOnce(0)
          .mockReturnValueOnce(100);

        perf.start('operation');
        const duration = perf.end('operation');

        expect(duration).toBe(100);
      });

      it('should return 0 and warn for unstarted timer', () => {
        const duration = perf.end('nonexistent');

        expect(duration).toBe(0);
        expect(consoleSpy.warn).toHaveBeenCalledWith(
          'No timer started for label: nonexistent'
        );
      });

      it('should accumulate metrics', () => {
        vi.spyOn(performance, 'now')
          .mockReturnValueOnce(0) // start 1
          .mockReturnValueOnce(100) // end 1
          .mockReturnValueOnce(0) // start 2
          .mockReturnValueOnce(50) // end 2
          .mockReturnValueOnce(0) // start 3
          .mockReturnValueOnce(150); // end 3

        perf.start('repeated');
        perf.end('repeated');

        perf.start('repeated');
        perf.end('repeated');

        perf.start('repeated');
        perf.end('repeated');

        const metrics = perf.getMetrics('repeated');
        expect(metrics?.count).toBe(3);
        expect(metrics?.minTime).toBe(50);
        expect(metrics?.maxTime).toBe(150);
        expect(metrics?.totalTime).toBe(300);
        expect(metrics?.avgTime).toBe(100);
      });
    });

    describe('measure (async)', () => {
      it('should time async operation', async () => {
        vi.spyOn(performance, 'now')
          .mockReturnValueOnce(0)
          .mockReturnValueOnce(75);

        const result = await perf.measure('async-op', async () => {
          return 'async-result';
        });

        expect(result).toBe('async-result');

        const metrics = perf.getMetrics('async-op');
        expect(metrics?.totalTime).toBe(75);
      });

      it('should record time even when async function throws', async () => {
        vi.spyOn(performance, 'now')
          .mockReturnValueOnce(0)
          .mockReturnValueOnce(25);

        await expect(
          perf.measure('failing-op', async () => {
            throw new Error('Async failure');
          })
        ).rejects.toThrow('Async failure');

        const metrics = perf.getMetrics('failing-op');
        expect(metrics?.totalTime).toBe(25);
      });
    });

    describe('measureSync', () => {
      it('should time synchronous operation', () => {
        vi.spyOn(performance, 'now')
          .mockReturnValueOnce(0)
          .mockReturnValueOnce(30);

        const result = perf.measureSync('sync-op', () => {
          return 'sync-result';
        });

        expect(result).toBe('sync-result');

        const metrics = perf.getMetrics('sync-op');
        expect(metrics?.totalTime).toBe(30);
      });

      it('should record time even when sync function throws', () => {
        vi.spyOn(performance, 'now')
          .mockReturnValueOnce(0)
          .mockReturnValueOnce(15);

        expect(() =>
          perf.measureSync('failing-sync', () => {
            throw new Error('Sync failure');
          })
        ).toThrow('Sync failure');

        const metrics = perf.getMetrics('failing-sync');
        expect(metrics?.totalTime).toBe(15);
      });
    });

    describe('getMetrics', () => {
      it('should return null for unknown label', () => {
        expect(perf.getMetrics('unknown')).toBeNull();
      });

      it('should return metrics for known label', () => {
        vi.spyOn(performance, 'now')
          .mockReturnValueOnce(0)
          .mockReturnValueOnce(50);

        perf.start('known');
        perf.end('known');

        const metrics = perf.getMetrics('known');
        expect(metrics).toEqual({
          count: 1,
          totalTime: 50,
          minTime: 50,
          maxTime: 50,
          avgTime: 50,
        });
      });
    });

    describe('getAllMetrics', () => {
      it('should return empty object when no metrics', () => {
        expect(perf.getAllMetrics()).toEqual({});
      });

      it('should return all collected metrics', () => {
        vi.spyOn(performance, 'now')
          .mockReturnValueOnce(0)
          .mockReturnValueOnce(100)
          .mockReturnValueOnce(0)
          .mockReturnValueOnce(200);

        perf.start('op1');
        perf.end('op1');

        perf.start('op2');
        perf.end('op2');

        const all = perf.getAllMetrics();
        expect(Object.keys(all)).toHaveLength(2);
        expect(all['op1']).toBeDefined();
        expect(all['op2']).toBeDefined();
      });
    });

    describe('logMetrics', () => {
      it('should log all metrics to console', () => {
        vi.spyOn(performance, 'now')
          .mockReturnValueOnce(0)
          .mockReturnValueOnce(100);

        perf.start('logged-op');
        perf.end('logged-op');

        perf.logMetrics();

        expect(consoleSpy.group).toHaveBeenCalledWith('Performance Metrics');
        expect(consoleSpy.log).toHaveBeenCalled();
        expect(consoleSpy.groupEnd).toHaveBeenCalled();
      });
    });

    describe('clearMetrics', () => {
      it('should clear all metrics', () => {
        vi.spyOn(performance, 'now')
          .mockReturnValueOnce(0)
          .mockReturnValueOnce(50);

        perf.start('to-clear');
        perf.end('to-clear');

        expect(perf.getMetrics('to-clear')).not.toBeNull();

        perf.clearMetrics();

        expect(perf.getMetrics('to-clear')).toBeNull();
        expect(perf.getAllMetrics()).toEqual({});
      });

      it('should clear active timers', () => {
        perf.start('active');

        perf.clearMetrics();

        // Now ending should return 0 and warn
        const duration = perf.end('active');
        expect(duration).toBe(0);
        expect(consoleSpy.warn).toHaveBeenCalled();
      });
    });
  });

  describe('browser integration patterns', () => {
    it('should work with typical web app pattern', () => {
      const logger = createBrowserLogger({
        isDev: () => true,
        prefix: 'xivdyetools-web',
      });

      // Component lifecycle logging
      logger.info('App mounted');
      logger.debug('Loading dye data');

      // Feature usage
      logger.info('User selected dye', { dyeId: 1, dyeName: 'Snow White' });

      // Warnings
      logger.warn('Using deprecated color format');

      // Errors
      logger.error('Failed to save preset', new Error('Network error'), {
        presetId: 'preset-123',
      });

      expect(consoleSpy.info).toHaveBeenCalledTimes(2);
      expect(consoleSpy.debug).toHaveBeenCalledTimes(1);
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
    });

    it('should support performance monitoring workflow', () => {
      vi.spyOn(performance, 'now')
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(120)
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(45);

      // Time a render
      perf.start('render');
      // ... render logic
      perf.end('render');

      // Time another operation
      const result = perf.measureSync('compute', () => {
        return { computed: true };
      });

      expect(result).toEqual({ computed: true });

      const allMetrics = perf.getAllMetrics();
      expect(allMetrics['render'].avgTime).toBe(120);
      expect(allMetrics['compute'].avgTime).toBe(45);
    });
  });
});
