/**
 * Tests for Browser Preset
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createBrowserLogger, browserLogger } from './browser.js';
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

      /**
       * `defaultIsDev` falls through four checks in order: import.meta.env.DEV,
       * then MODE, then process.env.NODE_ENV, then `false`.
       *
       * Only the first is reachable from a test. Vitest gives every module its
       * own `import.meta.env` object, so mutating the test file's copy is
       * invisible to browser.ts; `vi.stubEnv` is the one channel that reaches
       * it, and it coerces `undefined` to `false` rather than deleting the
       * key — which still satisfies `!== undefined` and short-circuits. The
       * MODE / NODE_ENV / default arms therefore stay uncovered by design,
       * not by omission.
       */
      describe('defaultIsDev via import.meta.env.DEV', () => {
        afterEach(() => {
          vi.unstubAllEnvs();
        });

        it('logs debug when DEV is true', () => {
          vi.stubEnv('DEV', true);

          createBrowserLogger({}).debug('visible');
          expect(consoleSpy.debug).toHaveBeenCalled();
        });

        it('suppresses debug when DEV is false', () => {
          vi.stubEnv('DEV', false);

          createBrowserLogger({}).debug('hidden');
          expect(consoleSpy.debug).not.toHaveBeenCalled();
        });

        it('keeps warn and error in production', () => {
          vi.stubEnv('DEV', false);
          const logger = createBrowserLogger({});

          logger.warn('warn');
          logger.error('error');

          expect(consoleSpy.warn).toHaveBeenCalled();
          expect(consoleSpy.error).toHaveBeenCalled();
        });

        it('devOnly:false keeps debug in production (REFACTOR-021)', () => {
          vi.stubEnv('DEV', false);

          createBrowserLogger({ devOnly: false }).debug('still visible');
          expect(consoleSpy.debug).toHaveBeenCalled();
        });
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

        // BUG-026: the tracker receives a sanitized clone, not the raw error
        expect(errorTracker.captureException).toHaveBeenCalledTimes(1);
        const [sentError, sentContext] = (errorTracker.captureException as ReturnType<typeof vi.fn>)
          .mock.calls[0] as [Error, Record<string, unknown>];
        expect(sentError).toBeInstanceOf(Error);
        expect(sentError.message).toBe('Test error');
        expect(sentError.name).toBe('Error');
        expect(sentContext).toEqual({ userId: '123' });
      });

      it('BUG-026: redacts context and sanitizes messages before forwarding to the tracker', () => {
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

        logger.error('auth failed', new Error('token=abc123 rejected'), {
          token: 'secret-jwt',
          userId: '123',
        });

        const [sentError, sentContext] = (errorTracker.captureException as ReturnType<typeof vi.fn>)
          .mock.calls[0] as [Error, Record<string, unknown>];
        expect(sentError.message).not.toContain('abc123');
        expect(sentContext.token).toBe('[REDACTED]');
        expect(sentContext.userId).toBe('123');
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
          'error',
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

        expect(errorTracker.captureMessage).toHaveBeenCalledWith('Just a message', 'error');
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
          'warning',
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
  });
});
