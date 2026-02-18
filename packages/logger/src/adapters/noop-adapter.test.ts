/**
 * Tests for NoopAdapter
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NoopAdapter } from './noop-adapter.js';

describe('NoopAdapter', () => {
  let consoleSpies: {
    debug: ReturnType<typeof vi.spyOn>;
    info: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
    log: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    consoleSpies = {
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with default error level', () => {
      const logger = new NoopAdapter();
      // Even with error level, noop shouldn't log
      logger.error('Error message');
      expect(consoleSpies.error).not.toHaveBeenCalled();
    });

    it('should accept custom configuration', () => {
      // Config should be accepted but not affect behavior
      const logger = new NoopAdapter({
        level: 'debug',
        prefix: 'Test',
      });
      logger.debug('Debug message');
      expect(consoleSpies.debug).not.toHaveBeenCalled();
    });
  });

  describe('logging methods', () => {
    it('should not output debug messages', () => {
      const logger = new NoopAdapter({ level: 'debug' });
      logger.debug('Debug message');
      logger.debug('Debug with context', { userId: '123' });

      expect(consoleSpies.debug).not.toHaveBeenCalled();
      expect(consoleSpies.log).not.toHaveBeenCalled();
    });

    it('should not output info messages', () => {
      const logger = new NoopAdapter({ level: 'info' });
      logger.info('Info message');
      logger.info('Info with context', { operation: 'fetch' });

      expect(consoleSpies.info).not.toHaveBeenCalled();
      expect(consoleSpies.log).not.toHaveBeenCalled();
    });

    it('should not output warn messages', () => {
      const logger = new NoopAdapter({ level: 'warn' });
      logger.warn('Warning message');
      logger.warn('Warning with context', { deprecated: true });

      expect(consoleSpies.warn).not.toHaveBeenCalled();
      expect(consoleSpies.log).not.toHaveBeenCalled();
    });

    it('should not output error messages', () => {
      const logger = new NoopAdapter();
      const error = new Error('Test error');
      logger.error('Error message');
      logger.error('Error with exception', error);
      logger.error('Error with context', undefined, { code: 'ERR_500' });
      logger.error('Error with both', error, { code: 'ERR_500' });

      expect(consoleSpies.error).not.toHaveBeenCalled();
      expect(consoleSpies.log).not.toHaveBeenCalled();
    });

    it('should silently accept all log levels without output', () => {
      const logger = new NoopAdapter({ level: 'debug' });

      // Log at every level
      logger.debug('Debug');
      logger.info('Info');
      logger.warn('Warn');
      logger.error('Error', new Error('Test'));

      // Verify no console methods were called
      expect(consoleSpies.debug).not.toHaveBeenCalled();
      expect(consoleSpies.info).not.toHaveBeenCalled();
      expect(consoleSpies.warn).not.toHaveBeenCalled();
      expect(consoleSpies.error).not.toHaveBeenCalled();
      expect(consoleSpies.log).not.toHaveBeenCalled();
    });
  });

  describe('context handling', () => {
    it('should accept setContext without error', () => {
      const logger = new NoopAdapter();
      expect(() => {
        logger.setContext({ requestId: 'req-123' });
      }).not.toThrow();
    });

    it('should accept context in log calls without error', () => {
      const logger = new NoopAdapter({ level: 'debug' });
      expect(() => {
        logger.debug('Debug', { extra: 'data' });
        logger.info('Info', { service: 'test' });
        logger.warn('Warn', { deprecated: true });
        logger.error('Error', new Error(), { code: '500' });
      }).not.toThrow();
    });
  });

  describe('child logger', () => {
    it('should create child logger that also does nothing', () => {
      const logger = new NoopAdapter({ level: 'debug' });
      const child = logger.child({ requestId: 'req-123' });

      child.debug('Child debug');
      child.info('Child info');
      child.warn('Child warn');
      child.error('Child error');

      expect(consoleSpies.debug).not.toHaveBeenCalled();
      expect(consoleSpies.info).not.toHaveBeenCalled();
      expect(consoleSpies.warn).not.toHaveBeenCalled();
      expect(consoleSpies.error).not.toHaveBeenCalled();
      expect(consoleSpies.log).not.toHaveBeenCalled();
    });

    it('should not throw when creating nested children', () => {
      const logger = new NoopAdapter();
      const child1 = logger.child({ level: '1' });
      const child2 = child1.child({ level: '2' });
      const child3 = child2.child({ level: '3' });

      expect(() => {
        child3.info('Deeply nested log');
      }).not.toThrow();
    });
  });

  describe('timing methods', () => {
    it('should support time method without output', () => {
      const logger = new NoopAdapter({ level: 'debug' });

      const end = logger.time('operation');
      const duration = end();

      // Should return a number but not log
      expect(typeof duration).toBe('number');
      expect(consoleSpies.debug).not.toHaveBeenCalled();
      expect(consoleSpies.log).not.toHaveBeenCalled();
    });

    it('should support timeAsync method without output', async () => {
      const logger = new NoopAdapter({ level: 'debug' });

      const result = await logger.timeAsync('async-op', async () => {
        return 'async-result';
      });

      expect(result).toBe('async-result');
      expect(consoleSpies.debug).not.toHaveBeenCalled();
      expect(consoleSpies.log).not.toHaveBeenCalled();
    });

    it('should propagate errors from timeAsync', async () => {
      const logger = new NoopAdapter({ level: 'debug' });

      await expect(
        logger.timeAsync('failing-op', async () => {
          throw new Error('Async failure');
        })
      ).rejects.toThrow('Async failure');

      // Still should not log
      expect(consoleSpies.debug).not.toHaveBeenCalled();
    });
  });

  describe('use case: library default', () => {
    it('should work as silent default logger for libraries', () => {
      // Simulate library usage pattern
      interface LibraryOptions {
        logger?: {
          debug: (msg: string, ctx?: Record<string, unknown>) => void;
          info: (msg: string, ctx?: Record<string, unknown>) => void;
          warn: (msg: string, ctx?: Record<string, unknown>) => void;
          error: (msg: string, err?: unknown, ctx?: Record<string, unknown>) => void;
        };
      }

      class SomeLibraryClass {
        private logger: LibraryOptions['logger'];

        constructor(options: LibraryOptions = {}) {
          this.logger = options.logger ?? new NoopAdapter();
        }

        doWork(): string {
          this.logger?.debug('Starting work');
          this.logger?.info('Processing');
          this.logger?.warn('Deprecated method used');
          try {
            // Simulate work
            return 'result';
          } catch (err) {
            this.logger?.error('Work failed', err);
            throw err;
          }
        }
      }

      // Default usage - should be silent
      const instance = new SomeLibraryClass();
      const result = instance.doWork();

      expect(result).toBe('result');
      expect(consoleSpies.debug).not.toHaveBeenCalled();
      expect(consoleSpies.info).not.toHaveBeenCalled();
      expect(consoleSpies.warn).not.toHaveBeenCalled();
      expect(consoleSpies.error).not.toHaveBeenCalled();
    });
  });
});
