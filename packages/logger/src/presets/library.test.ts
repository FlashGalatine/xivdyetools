/**
 * Tests for Library Preset
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NoOpLogger, ConsoleLogger, createLibraryLogger, type Logger } from './library.js';

describe('Library Preset', () => {
  let consoleSpy: {
    debug: ReturnType<typeof vi.spyOn>;
    info: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));

    consoleSpy = {
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('NoOpLogger', () => {
    it('should be a pre-configured logger instance', () => {
      expect(NoOpLogger).toBeDefined();
      expect(typeof NoOpLogger.debug).toBe('function');
      expect(typeof NoOpLogger.info).toBe('function');
      expect(typeof NoOpLogger.warn).toBe('function');
      expect(typeof NoOpLogger.error).toBe('function');
    });

    it('should not output any logs', () => {
      NoOpLogger.debug('Debug');
      NoOpLogger.info('Info');
      NoOpLogger.warn('Warn');
      NoOpLogger.error('Error', new Error('Test'));

      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.info).not.toHaveBeenCalled();
      expect(consoleSpy.warn).not.toHaveBeenCalled();
      expect(consoleSpy.error).not.toHaveBeenCalled();
    });

    it('should be usable as default logger in library classes', () => {
      class LibraryService {
        constructor(
          private logger: typeof NoOpLogger = NoOpLogger
        ) {}

        process(): string {
          this.logger.info('Processing');
          return 'done';
        }
      }

      const service = new LibraryService();
      expect(service.process()).toBe('done');
      expect(consoleSpy.info).not.toHaveBeenCalled();
    });
  });

  describe('ConsoleLogger', () => {
    it('should be a pre-configured logger instance', () => {
      expect(ConsoleLogger).toBeDefined();
      expect(typeof ConsoleLogger.debug).toBe('function');
      expect(typeof ConsoleLogger.info).toBe('function');
      expect(typeof ConsoleLogger.warn).toBe('function');
      expect(typeof ConsoleLogger.error).toBe('function');
    });

    it('should output debug logs', () => {
      ConsoleLogger.debug('Debug message');
      expect(consoleSpy.debug).toHaveBeenCalled();
    });

    it('should output info logs', () => {
      ConsoleLogger.info('Info message');
      expect(consoleSpy.info).toHaveBeenCalled();
    });

    it('should output warn logs', () => {
      ConsoleLogger.warn('Warn message');
      expect(consoleSpy.warn).toHaveBeenCalled();
    });

    it('should output error logs', () => {
      ConsoleLogger.error('Error message');
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it('should include xivdyetools prefix', () => {
      ConsoleLogger.info('Test message');
      expect(consoleSpy.info.mock.calls[0][0]).toContain('[xivdyetools]');
    });

    it('should include timestamps', () => {
      ConsoleLogger.info('Test');
      expect(consoleSpy.info.mock.calls[0][0]).toContain('2024-01-15');
    });

    it('should use pretty format', () => {
      ConsoleLogger.info('Test message', { data: 'value' });
      // Pretty format doesn't output pure JSON
      const logged = consoleSpy.info.mock.calls[0][0];
      expect(logged).toContain('[');
      expect(logged).toContain('Test message');
    });

    it('should be usable as verbose logger in library classes', () => {
      class LibraryService {
        constructor(
          private logger: typeof ConsoleLogger = NoOpLogger
        ) {}

        process(): string {
          this.logger.info('Processing');
          return 'done';
        }
      }

      const service = new LibraryService(ConsoleLogger);
      expect(service.process()).toBe('done');
      expect(consoleSpy.info).toHaveBeenCalled();
    });
  });

  describe('createLibraryLogger', () => {
    it('should create logger with custom prefix', () => {
      const logger = createLibraryLogger('mylib');
      logger.info('Test');

      expect(consoleSpy.info.mock.calls[0][0]).toContain('[mylib]');
    });

    it('should create logger with module-style prefix', () => {
      const logger = createLibraryLogger('xivdyetools:color');
      logger.info('Converting color');

      expect(consoleSpy.info.mock.calls[0][0]).toContain('[xivdyetools:color]');
    });

    it('should default to debug level', () => {
      const logger = createLibraryLogger('test');
      logger.debug('Debug message');

      expect(consoleSpy.debug).toHaveBeenCalled();
    });

    it('should use pretty format by default', () => {
      const logger = createLibraryLogger('test');
      logger.info('Test message');

      const logged = consoleSpy.info.mock.calls[0][0];
      expect(logged).toContain('[test]');
    });

    it('should include timestamps by default', () => {
      const logger = createLibraryLogger('test');
      logger.info('Test');

      expect(consoleSpy.info.mock.calls[0][0]).toContain('2024-01-15');
    });

    it('should accept custom configuration', () => {
      const logger = createLibraryLogger('test', {
        level: 'warn',
        timestamps: false,
      });

      logger.debug('Debug');
      logger.info('Info');
      logger.warn('Warn');

      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.info).not.toHaveBeenCalled();
      expect(consoleSpy.warn).toHaveBeenCalled();
    });

    it('should allow overriding format', () => {
      const logger = createLibraryLogger('test', { format: 'json' });
      logger.info('Test');

      const logged = consoleSpy.info.mock.calls[0][0];
      expect(() => JSON.parse(logged)).not.toThrow();
    });
  });

  describe('library integration pattern', () => {
    it('should support typical library logger pattern', () => {
      // This is the recommended pattern for libraries
      interface LoggerInterface {
        debug(message: string, context?: Record<string, unknown>): void;
        info(message: string, context?: Record<string, unknown>): void;
        warn(message: string, context?: Record<string, unknown>): void;
        error(
          message: string,
          error?: unknown,
          context?: Record<string, unknown>
        ): void;
      }

      interface ServiceOptions {
        logger?: LoggerInterface;
      }

      class DyeService {
        private logger: LoggerInterface;

        constructor(options: ServiceOptions = {}) {
          // Default to NoOpLogger - silent by default
          this.logger = options.logger ?? NoOpLogger;
        }

        findDye(id: number): { id: number; name: string } | null {
          this.logger.debug('Finding dye', { id });

          if (id === 1) {
            this.logger.info('Dye found', { id, name: 'Snow White' });
            return { id: 1, name: 'Snow White' };
          }

          this.logger.warn('Dye not found', { id });
          return null;
        }
      }

      // Silent by default
      const silentService = new DyeService();
      silentService.findDye(1);
      silentService.findDye(999);

      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.info).not.toHaveBeenCalled();
      expect(consoleSpy.warn).not.toHaveBeenCalled();

      // Verbose when needed
      const verboseService = new DyeService({ logger: ConsoleLogger });
      verboseService.findDye(1);

      expect(consoleSpy.debug).toHaveBeenCalled();
      expect(consoleSpy.info).toHaveBeenCalled();
    });

    it('should support custom logger from consumer', () => {
      const customLogs: string[] = [];
      const customLogger = {
        debug: (msg: string) => customLogs.push(`DEBUG: ${msg}`),
        info: (msg: string) => customLogs.push(`INFO: ${msg}`),
        warn: (msg: string) => customLogs.push(`WARN: ${msg}`),
        error: (msg: string) => customLogs.push(`ERROR: ${msg}`),
      };

      interface ServiceOptions {
        logger?: Logger;
      }

      class DyeService {
        private logger: Logger;

        constructor(options: ServiceOptions = {}) {
          this.logger = options.logger ?? NoOpLogger;
        }

        process(): void {
          this.logger.info('Processing');
        }
      }

      const service = new DyeService({ logger: customLogger });
      service.process();

      expect(customLogs).toContain('INFO: Processing');
    });
  });
});
