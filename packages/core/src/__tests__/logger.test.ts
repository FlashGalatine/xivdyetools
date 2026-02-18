/**
 * Logger Tests
 *
 * Tests for the logger interface and implementations.
 * Covers NoOpLogger, ConsoleLogger, and the Logger interface contract.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger, NoOpLogger, ConsoleLogger } from '../types/logger.js';

describe('Logger', () => {
  describe('NoOpLogger', () => {
    it('should implement the Logger interface', () => {
      expect(NoOpLogger).toBeDefined();
      expect(typeof NoOpLogger.info).toBe('function');
      expect(typeof NoOpLogger.warn).toBe('function');
      expect(typeof NoOpLogger.error).toBe('function');
      expect(typeof NoOpLogger.debug).toBe('function');
    });

    it('should not throw when calling info', () => {
      expect(() => NoOpLogger.info('test message')).not.toThrow();
    });

    it('should not throw when calling warn', () => {
      expect(() => NoOpLogger.warn('test warning')).not.toThrow();
    });

    it('should not throw when calling error without error object', () => {
      expect(() => NoOpLogger.error('test error')).not.toThrow();
    });

    it('should not throw when calling error with error object', () => {
      expect(() => NoOpLogger.error('test error', new Error('details'))).not.toThrow();
    });

    it('should not throw when calling debug', () => {
      expect(() => NoOpLogger.debug?.('test debug')).not.toThrow();
    });

    it('should return undefined from all methods', () => {
      expect(NoOpLogger.info('test')).toBeUndefined();
      expect(NoOpLogger.warn('test')).toBeUndefined();
      expect(NoOpLogger.error('test')).toBeUndefined();
      expect(NoOpLogger.debug?.('test')).toBeUndefined();
    });
  });

  describe('ConsoleLogger', () => {
    let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
    let consoleDebugSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should implement the Logger interface', () => {
      expect(ConsoleLogger).toBeDefined();
      expect(typeof ConsoleLogger.info).toBe('function');
      expect(typeof ConsoleLogger.warn).toBe('function');
      expect(typeof ConsoleLogger.error).toBe('function');
      expect(typeof ConsoleLogger.debug).toBe('function');
    });

    describe('info', () => {
      it('should call console.info with prefixed message', () => {
        ConsoleLogger.info('test message');
        expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
        expect(consoleInfoSpy).toHaveBeenCalledWith(
          expect.stringMatching(
            /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[xivdyetools\] test message$/
          )
        );
      });

      it('should handle empty message', () => {
        ConsoleLogger.info('');
        expect(consoleInfoSpy).toHaveBeenCalledWith(
          expect.stringMatching(
            /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[xivdyetools\] $/
          )
        );
      });

      it('should handle messages with special characters', () => {
        ConsoleLogger.info('Message with "quotes" and <brackets>');
        expect(consoleInfoSpy).toHaveBeenCalledWith(
          expect.stringContaining('[xivdyetools] Message with "quotes" and <brackets>')
        );
      });
    });

    describe('warn', () => {
      it('should call console.warn with prefixed message', () => {
        ConsoleLogger.warn('test warning');
        expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringMatching(
            /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[xivdyetools\] test warning$/
          )
        );
      });

      it('should handle empty message', () => {
        ConsoleLogger.warn('');
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringMatching(
            /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[xivdyetools\] $/
          )
        );
      });
    });

    describe('error', () => {
      it('should call console.error with prefixed message when no error object provided', () => {
        ConsoleLogger.error('test error');
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringMatching(
            /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[xivdyetools\] test error$/
          )
        );
      });

      it('should call console.error with message and error object when error is provided', () => {
        const error = new Error('details');
        ConsoleLogger.error('test error', error);
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        // New logger formats errors as {name, message} objects
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('[xivdyetools] test error'),
          expect.objectContaining({ name: 'Error', message: 'details' })
        );
      });

      it('should handle undefined error object', () => {
        ConsoleLogger.error('test error', undefined);
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringMatching(
            /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[xivdyetools\] test error$/
          )
        );
      });

      it('should handle non-Error objects as error parameter', () => {
        const errorLike = { code: 'ERR_001', message: 'Something went wrong' };
        ConsoleLogger.error('test error', errorLike);
        // Non-Error objects are formatted as {name: 'Unknown', message: '[object Object]'}
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('[xivdyetools] test error'),
          expect.objectContaining({ name: 'Unknown' })
        );
      });

      it('should handle string as error parameter', () => {
        ConsoleLogger.error('test error', 'string error');
        // Strings are formatted as {name: 'Unknown', message: 'string error'}
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('[xivdyetools] test error'),
          expect.objectContaining({ name: 'Unknown', message: 'string error' })
        );
      });

      it('should handle null as error parameter (truthy check)', () => {
        ConsoleLogger.error('test error', null);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringMatching(
            /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[xivdyetools\] test error$/
          )
        );
      });
    });

    describe('debug', () => {
      it('should call console.debug with prefixed message', () => {
        ConsoleLogger.debug?.('test debug');
        expect(consoleDebugSpy).toHaveBeenCalledTimes(1);
        expect(consoleDebugSpy).toHaveBeenCalledWith(
          expect.stringMatching(
            /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[xivdyetools\] test debug$/
          )
        );
      });

      it('should handle empty message', () => {
        ConsoleLogger.debug?.('');
        expect(consoleDebugSpy).toHaveBeenCalledWith(
          expect.stringMatching(
            /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[xivdyetools\] $/
          )
        );
      });
    });
  });

  describe('Custom Logger Implementation', () => {
    it('should accept a custom logger that implements the interface', () => {
      const logs: string[] = [];
      const customLogger: Logger = {
        info: (message: string) => logs.push(`INFO: ${message}`),
        warn: (message: string) => logs.push(`WARN: ${message}`),
        error: (message: string, error?: unknown) => logs.push(`ERROR: ${message} ${error ?? ''}`),
        debug: (message: string) => logs.push(`DEBUG: ${message}`),
      };

      customLogger.info('test info');
      customLogger.warn('test warn');
      customLogger.error('test error');
      customLogger.error('test error with details', new Error('oops'));
      customLogger.debug?.('test debug');

      expect(logs).toHaveLength(5);
      expect(logs[0]).toBe('INFO: test info');
      expect(logs[1]).toBe('WARN: test warn');
      expect(logs[2]).toBe('ERROR: test error ');
      expect(logs[3]).toContain('ERROR: test error with details');
      expect(logs[4]).toBe('DEBUG: test debug');
    });

    it('should allow logger without optional debug method', () => {
      const minimalLogger: Logger = {
        info: () => {},
        warn: () => {},
        error: () => {},
      };

      expect(minimalLogger.debug).toBeUndefined();
      expect(() => minimalLogger.info('test')).not.toThrow();
      expect(() => minimalLogger.warn('test')).not.toThrow();
      expect(() => minimalLogger.error('test')).not.toThrow();
    });
  });
});
