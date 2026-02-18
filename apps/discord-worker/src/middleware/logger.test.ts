/**
 * Tests for Logger Middleware
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loggerMiddleware, getLogger } from './logger.js';
import type { Context, Next } from 'hono';
import type { ExtendedLogger } from '@xivdyetools/logger';

// Mock the logger module
vi.mock('@xivdyetools/logger/worker', () => ({
    createRequestLogger: vi.fn(() => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    })),
}));

import { createRequestLogger } from '@xivdyetools/logger/worker';

describe('logger.ts', () => {
    describe('loggerMiddleware', () => {
        let mockContext: Partial<Context>;
        let mockNext: Next;
        let storedLogger: ExtendedLogger | undefined;
        let mockRequestLogger: ExtendedLogger;
        let mockPerformance: { now: ReturnType<typeof vi.fn> };

        beforeEach(() => {
            storedLogger = undefined;
            mockRequestLogger = {
                info: vi.fn(),
                warn: vi.fn(),
                error: vi.fn(),
                debug: vi.fn(),
            } as unknown as ExtendedLogger;

            vi.mocked(createRequestLogger).mockReturnValue(mockRequestLogger);

            // Mock performance.now
            let callCount = 0;
            mockPerformance = {
                now: vi.fn(() => {
                    callCount++;
                    // First call returns start time, second call returns end time
                    return callCount === 1 ? 1000 : 1150;
                }),
            };
            vi.stubGlobal('performance', mockPerformance);

            mockNext = vi.fn(async () => { });

            mockContext = {
                req: {
                    method: 'POST',
                    url: 'https://example.com/api/test?query=1',
                } as unknown as Context['req'],
                res: {
                    status: 200,
                } as unknown as Context['res'],
                set: vi.fn((key: string, value: ExtendedLogger) => {
                    if (key === 'logger') {
                        storedLogger = value;
                    }
                }),
                get: vi.fn((key: string) => {
                    if (key === 'requestId') {
                        return 'test-request-id';
                    }
                    if (key === 'logger') {
                        return storedLogger;
                    }
                    return undefined;
                }),
            };
        });

        afterEach(() => {
            vi.restoreAllMocks();
        });

        it('should create a request logger with the request ID', async () => {
            await loggerMiddleware(mockContext as Context, mockNext);

            expect(createRequestLogger).toHaveBeenCalledWith(
                {
                    ENVIRONMENT: 'production',
                    SERVICE_NAME: 'xivdyetools-discord-worker',
                },
                'test-request-id'
            );
        });

        it('should store the logger in context', async () => {
            await loggerMiddleware(mockContext as Context, mockNext);

            expect(mockContext.set).toHaveBeenCalledWith('logger', mockRequestLogger);
        });

        it('should log request start', async () => {
            await loggerMiddleware(mockContext as Context, mockNext);

            expect(mockRequestLogger.info).toHaveBeenCalledWith('Request started', {
                method: 'POST',
                path: '/api/test',
            });
        });

        it('should log request completion with status and duration', async () => {
            await loggerMiddleware(mockContext as Context, mockNext);

            expect(mockRequestLogger.info).toHaveBeenCalledWith('Request completed', {
                method: 'POST',
                path: '/api/test',
                status: 200,
                durationMs: 150,
            });
        });

        it('should call next middleware', async () => {
            await loggerMiddleware(mockContext as Context, mockNext);

            expect(mockNext).toHaveBeenCalledTimes(1);
        });

        it('should handle different response statuses', async () => {
            mockContext.res = { status: 404 } as unknown as Context['res'];

            await loggerMiddleware(mockContext as Context, mockNext);

            expect(mockRequestLogger.info).toHaveBeenCalledWith('Request completed', {
                method: 'POST',
                path: '/api/test',
                status: 404,
                durationMs: 150,
            });
        });

        it('should extract path correctly from URL', async () => {
            // Create a new context with different req for this test
            const testContext: Partial<Context> = {
                req: {
                    method: 'GET',
                    url: 'https://example.com/some/nested/path',
                } as unknown as Context['req'],
                res: {
                    status: 200,
                } as unknown as Context['res'],
                set: vi.fn((key: string, value: ExtendedLogger) => {
                    if (key === 'logger') {
                        storedLogger = value;
                    }
                }),
                get: vi.fn((key: string) => {
                    if (key === 'requestId') {
                        return 'test-request-id';
                    }
                    if (key === 'logger') {
                        return storedLogger;
                    }
                    return undefined;
                }),
            };

            await loggerMiddleware(testContext as Context, mockNext);

            expect(mockRequestLogger.info).toHaveBeenCalledWith('Request started', {
                method: 'GET',
                path: '/some/nested/path',
            });
        });
    });

    describe('getLogger', () => {
        it('should return logger from context', () => {
            const mockLogger = { info: vi.fn() } as unknown as ExtendedLogger;
            const mockContext = {
                get: vi.fn(() => mockLogger),
            } as unknown as Context;

            const result = getLogger(mockContext);

            expect(result).toBe(mockLogger);
        });

        it('should return undefined when logger is not set', () => {
            const mockContext = {
                get: vi.fn(() => undefined),
            } as unknown as Context;

            const result = getLogger(mockContext);

            expect(result).toBeUndefined();
        });

        it('should return undefined when context.get throws an error', () => {
            const mockContext = {
                get: vi.fn(() => {
                    throw new Error('Context not initialized');
                }),
            } as unknown as Context;

            const result = getLogger(mockContext);

            expect(result).toBeUndefined();
        });
    });
});
