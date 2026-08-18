/**
 * XIV Dye Tools - Logger Tests
 *
 * Comprehensive tests for centralized logger module
 * Covers logging levels, environment detection, and error tracking
 *
 * @module shared/__tests__/logger.test
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';

// Unmock the logger module for this test file to test the actual implementation
vi.unmock('@shared/logger');

import { logger, __setTestEnvironment } from '../logger';

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
