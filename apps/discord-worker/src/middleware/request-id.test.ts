/**
 * Tests for Request ID Middleware
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestIdMiddleware, getRequestId } from './request-id.js';
import type { Context, Next } from 'hono';

// Mock crypto.randomUUID
vi.stubGlobal('crypto', {
    randomUUID: vi.fn(() => 'generated-uuid-12345'),
});

describe('request-id.ts', () => {
    describe('requestIdMiddleware', () => {
        let mockContext: Partial<Context>;
        let mockNext: Next;
        let storedRequestId: string | undefined;
        let responseHeaders: Map<string, string>;

        beforeEach(() => {
            storedRequestId = undefined;
            responseHeaders = new Map();
            mockNext = vi.fn(async () => { });

            mockContext = {
                req: {
                    header: vi.fn((name: string) => {
                        if (name === 'X-Request-ID') {
                            return undefined;
                        }
                        return undefined;
                    }),
                } as unknown as Context['req'],
                set: vi.fn((key: string, value: string) => {
                    if (key === 'requestId') {
                        storedRequestId = value;
                    }
                }),
                get: vi.fn((key: string) => {
                    if (key === 'requestId') {
                        return storedRequestId;
                    }
                    return undefined;
                }),
                header: vi.fn((name: string, value?: string) => {
                    if (value !== undefined) {
                        responseHeaders.set(name, value);
                    }
                }) as unknown as Context['header'],
            };
        });

        it('should generate a new request ID when none is provided', async () => {
            await requestIdMiddleware(mockContext as Context, mockNext);

            expect(mockContext.set).toHaveBeenCalledWith('requestId', 'generated-uuid-12345');
            expect(mockNext).toHaveBeenCalled();
            expect(responseHeaders.get('X-Request-ID')).toBe('generated-uuid-12345');
        });

        it('should preserve existing X-Request-ID header', async () => {
            const existingRequestId = 'existing-request-id-from-header';
            (mockContext.req!.header as ReturnType<typeof vi.fn>).mockImplementation((name: string) => {
                if (name === 'X-Request-ID') {
                    return existingRequestId;
                }
                return undefined;
            });

            await requestIdMiddleware(mockContext as Context, mockNext);

            expect(mockContext.set).toHaveBeenCalledWith('requestId', existingRequestId);
            expect(responseHeaders.get('X-Request-ID')).toBe(existingRequestId);
        });

        it('should add request ID to response headers after next()', async () => {
            let responseHeadersSetBeforeNext = false;

            mockNext = vi.fn(async () => {
                // Check that headers haven't been set yet when next() is called
                responseHeadersSetBeforeNext = responseHeaders.has('X-Request-ID');
            });

            await requestIdMiddleware(mockContext as Context, mockNext);

            expect(responseHeadersSetBeforeNext).toBe(false);
            expect(responseHeaders.get('X-Request-ID')).toBe('generated-uuid-12345');
        });

        it('should call next middleware', async () => {
            await requestIdMiddleware(mockContext as Context, mockNext);

            expect(mockNext).toHaveBeenCalledTimes(1);
        });
    });

    describe('getRequestId', () => {
        it('should return request ID from context', () => {
            const mockContext = {
                get: vi.fn(() => 'test-request-id'),
            } as unknown as Context;

            const result = getRequestId(mockContext);

            expect(result).toBe('test-request-id');
        });

        it('should return "unknown" when request ID is not set', () => {
            const mockContext = {
                get: vi.fn(() => undefined),
            } as unknown as Context;

            const result = getRequestId(mockContext);

            expect(result).toBe('unknown');
        });

        it('should return "unknown" when context.get throws an error', () => {
            const mockContext = {
                get: vi.fn(() => {
                    throw new Error('Context not initialized');
                }),
            } as unknown as Context;

            const result = getRequestId(mockContext);

            expect(result).toBe('unknown');
        });

        it('should return "unknown" when requestId is empty string', () => {
            const mockContext = {
                get: vi.fn(() => ''),
            } as unknown as Context;

            const result = getRequestId(mockContext);

            expect(result).toBe('unknown');
        });

        it('should return "unknown" when requestId is null', () => {
            const mockContext = {
                get: vi.fn(() => null),
            } as unknown as Context;

            const result = getRequestId(mockContext);

            expect(result).toBe('unknown');
        });
    });
});
