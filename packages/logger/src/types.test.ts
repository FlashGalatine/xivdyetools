/**
 * Tests for types module
 *
 * These tests ensure type exports work correctly and serve as
 * compile-time type verification.
 */
import { describe, it, expect } from 'vitest';
import type {
  LogLevel,
  LogContext,
  LogEntry,
  Logger,
  ExtendedLogger,
  LoggerConfig,
  ErrorTracker,
} from './types.js';

describe('Types', () => {
  describe('LogLevel', () => {
    it('should allow valid log levels', () => {
      const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
      expect(levels).toHaveLength(4);
    });
  });

  describe('LogContext', () => {
    it('should allow standard context properties', () => {
      const context: LogContext = {
        requestId: 'req-123',
        userId: 'user-456',
        operation: 'fetchDyes',
        service: 'xivdyetools-api',
        environment: 'production',
      };

      expect(context.requestId).toBe('req-123');
      expect(context.userId).toBe('user-456');
    });

    it('should allow custom properties', () => {
      const context: LogContext = {
        customProperty: 'value',
        numericValue: 42,
        booleanValue: true,
        objectValue: { nested: 'data' },
      };

      expect(context.customProperty).toBe('value');
      expect(context.numericValue).toBe(42);
    });
  });

  describe('LogEntry', () => {
    it('should represent a complete log entry', () => {
      const entry: LogEntry = {
        level: 'info',
        message: 'Test message',
        timestamp: '2024-01-15T12:00:00.000Z',
        context: {
          userId: '123',
        },
        error: {
          name: 'Error',
          message: 'Something failed',
          code: 'ERR_001',
          stack: 'Error: Something failed\n  at ...',
        },
      };

      expect(entry.level).toBe('info');
      expect(entry.error?.code).toBe('ERR_001');
    });

    it('should allow minimal log entry', () => {
      const entry: LogEntry = {
        level: 'debug',
        message: 'Minimal entry',
        timestamp: '2024-01-15T12:00:00.000Z',
      };

      expect(entry.context).toBeUndefined();
      expect(entry.error).toBeUndefined();
    });
  });

  describe('Logger interface', () => {
    it('should define basic logging methods', () => {
      // Create a mock logger that satisfies the interface
      const mockLogger: Logger = {
        debug: (message: string, _context?: LogContext) => {
          expect(typeof message).toBe('string');
        },
        info: (message: string, _context?: LogContext) => {
          expect(typeof message).toBe('string');
        },
        warn: (message: string, _context?: LogContext) => {
          expect(typeof message).toBe('string');
        },
        error: (message: string, _error?: unknown, _context?: LogContext) => {
          expect(typeof message).toBe('string');
        },
      };

      // Verify all methods exist
      expect(typeof mockLogger.debug).toBe('function');
      expect(typeof mockLogger.info).toBe('function');
      expect(typeof mockLogger.warn).toBe('function');
      expect(typeof mockLogger.error).toBe('function');
    });
  });

  describe('ExtendedLogger interface', () => {
    it('should extend Logger with additional methods', () => {
      const mockExtendedLogger: ExtendedLogger = {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
        child: (_context: LogContext): ExtendedLogger => mockExtendedLogger,
        setContext: (_context: LogContext) => {},
        time: (_label: string) => () => 0,
        timeAsync: async <T>(_label: string, fn: () => Promise<T>) => fn(),
      };

      expect(typeof mockExtendedLogger.child).toBe('function');
      expect(typeof mockExtendedLogger.setContext).toBe('function');
      expect(typeof mockExtendedLogger.time).toBe('function');
      expect(typeof mockExtendedLogger.timeAsync).toBe('function');
    });
  });

  describe('LoggerConfig', () => {
    it('should represent logger configuration', () => {
      const config: LoggerConfig = {
        level: 'debug',
        format: 'pretty',
        timestamps: true,
        prefix: 'myapp',
        sanitizeErrors: true,
        redactFields: ['password', 'token'],
      };

      expect(config.level).toBe('debug');
      expect(config.format).toBe('pretty');
      expect(config.redactFields).toContain('password');
    });

    it('should allow JSON format', () => {
      const config: LoggerConfig = {
        level: 'info',
        format: 'json',
        timestamps: true,
        sanitizeErrors: false,
      };

      expect(config.format).toBe('json');
    });
  });

  describe('ErrorTracker interface', () => {
    it('should define error tracking methods', () => {
      const mockTracker: ErrorTracker = {
        captureException: (error: unknown, context?: Record<string, unknown>) => {
          expect(error).toBeDefined();
          if (context) expect(typeof context).toBe('object');
        },
        captureMessage: (message: string, level?: string) => {
          expect(typeof message).toBe('string');
          if (level) expect(typeof level).toBe('string');
        },
        setTag: (key: string, value: string) => {
          expect(typeof key).toBe('string');
          expect(typeof value).toBe('string');
        },
        setUser: (user: { id?: string; username?: string; email?: string }) => {
          expect(typeof user).toBe('object');
        },
      };

      // Verify interface
      mockTracker.captureException(new Error('test'));
      mockTracker.captureMessage('test message', 'info');
      mockTracker.setTag('version', '1.0.0');
      mockTracker.setUser({ id: 'user-123' });
    });
  });

  describe('Type compatibility', () => {
    it('should allow using Logger where ExtendedLogger is returned', () => {
      // This tests that ExtendedLogger extends Logger properly
      const getExtendedLogger = (): ExtendedLogger => ({
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
        child: function() { return this; },
        setContext: () => {},
        time: () => () => 0,
        timeAsync: async <T>(_: string, fn: () => Promise<T>) => fn(),
      });

      // Should be assignable to Logger
      const logger: Logger = getExtendedLogger();
      expect(typeof logger.info).toBe('function');
    });
  });
});
