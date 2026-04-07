/**
 * API Response Utilities Tests
 *
 * Tests for standardized response helpers in api-response.ts
 */

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import {
  errorResponse,
  successResponse,
  invalidJsonResponse,
  validationErrorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  duplicateResponse,
  internalErrorResponse,
  ErrorCode,
} from '../../src/utils/api-response';

// Helper to create a Hono app with a handler that uses a response function
function createApp(handler: (c: any) => Response) {
  const app = new Hono();
  app.get('/test', handler);
  return app;
}

describe('API Response Utilities', () => {
  describe('errorResponse', () => {
    it('should return error JSON with default 400 status', async () => {
      const app = createApp((c) => errorResponse(c, 'TEST_ERROR', 'Test message'));
      const res = await app.request('/test');

      expect(res.status).toBe(400);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body).toEqual({
        success: false,
        error: 'TEST_ERROR',
        message: 'Test message',
      });
    });

    it('should accept custom status code', async () => {
      const app = createApp((c) => errorResponse(c, 'SERVER_ERR', 'Failure', 503));
      const res = await app.request('/test');
      expect(res.status).toBe(503);
    });
  });

  describe('successResponse', () => {
    it('should return success JSON without message', async () => {
      const app = createApp((c) => successResponse(c, { count: 5 }));
      const res = await app.request('/test');

      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body).toEqual({ success: true, count: 5 });
      expect(body.message).toBeUndefined();
    });

    it('should include message when provided', async () => {
      const app = createApp((c) => successResponse(c, { deleted: true }, 'Preset deleted'));
      const res = await app.request('/test');

      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body).toEqual({
        success: true,
        deleted: true,
        message: 'Preset deleted',
      });
    });

    it('should accept custom status code', async () => {
      const app = createApp((c) => successResponse(c, { id: 'abc' }, undefined, 201));
      const res = await app.request('/test');
      expect(res.status).toBe(201);
    });
  });

  describe('common error responses', () => {
    it('invalidJsonResponse returns 400 INVALID_JSON', async () => {
      const app = createApp((c) => invalidJsonResponse(c));
      const res = await app.request('/test');

      expect(res.status).toBe(400);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toBe(ErrorCode.INVALID_JSON);
    });

    it('validationErrorResponse returns 400 VALIDATION_ERROR', async () => {
      const app = createApp((c) => validationErrorResponse(c, 'Name too long'));
      const res = await app.request('/test');

      expect(res.status).toBe(400);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toBe(ErrorCode.VALIDATION_ERROR);
      expect(body.message).toBe('Name too long');
    });

    it('unauthorizedResponse returns 401 with default message', async () => {
      const app = createApp((c) => unauthorizedResponse(c));
      const res = await app.request('/test');

      expect(res.status).toBe(401);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toBe(ErrorCode.UNAUTHORIZED);
      expect(body.message).toBe('Authentication required');
    });

    it('forbiddenResponse returns 403', async () => {
      const app = createApp((c) => forbiddenResponse(c, 'Not allowed'));
      const res = await app.request('/test');

      expect(res.status).toBe(403);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toBe(ErrorCode.FORBIDDEN);
    });

    it('notFoundResponse returns 404 with resource name', async () => {
      const app = createApp((c) => notFoundResponse(c, 'Preset'));
      const res = await app.request('/test');

      expect(res.status).toBe(404);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toBe(ErrorCode.NOT_FOUND);
      expect(body.message).toBe('Preset not found');
    });

    it('duplicateResponse returns 409 DUPLICATE_RESOURCE', async () => {
      const app = createApp((c) => duplicateResponse(c, 'Already exists'));
      const res = await app.request('/test');

      expect(res.status).toBe(409);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toBe(ErrorCode.DUPLICATE_RESOURCE);
      expect(body.message).toBe('Already exists');
    });

    it('internalErrorResponse returns 500 with default message', async () => {
      const app = createApp((c) => internalErrorResponse(c));
      const res = await app.request('/test');

      expect(res.status).toBe(500);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toBe(ErrorCode.INTERNAL_ERROR);
      expect(body.message).toBe('An unexpected error occurred');
    });

    it('internalErrorResponse returns 500 with custom message', async () => {
      const app = createApp((c) => internalErrorResponse(c, 'DB down'));
      const res = await app.request('/test');

      expect(res.status).toBe(500);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.message).toBe('DB down');
    });
  });
});
