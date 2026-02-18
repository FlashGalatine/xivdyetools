/**
 * Standardized API Response Utilities
 *
 * PRESETS-MED-002: This module provides consistent error and success response
 * formats across all API endpoints.
 *
 * Error Response Format:
 * {
 *   success: false,
 *   error: "ERROR_CODE",      // Machine-readable, SCREAMING_SNAKE_CASE
 *   message: "Human message"  // Human-readable description
 * }
 *
 * Success Response Format:
 * {
 *   success: true,
 *   ...data                   // Additional response data
 * }
 */

import type { Context } from 'hono';

// ============================================
// ERROR CODES
// ============================================

/**
 * Standard error codes used across the API.
 * Using SCREAMING_SNAKE_CASE for machine-readability.
 */
export const ErrorCode = {
  // Client errors (4xx)
  BAD_REQUEST: 'BAD_REQUEST',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_JSON: 'INVALID_JSON',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',
  RATE_LIMITED: 'RATE_LIMITED',
  USER_BANNED: 'USER_BANNED',

  // Server errors (5xx)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR: 'DATABASE_ERROR',
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

// ============================================
// RESPONSE TYPES
// ============================================

/**
 * Standard error response shape
 */
export interface ApiErrorResponse {
  success: false;
  error: ErrorCodeType | string;
  message: string;
}

/**
 * Standard success response shape
 */
export interface ApiSuccessResponse<T = Record<string, unknown>> {
  success: true;
  message?: string;
}

// Use a generic context type that works with any Hono app configuration
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyContext = Context<any, any, any>;

// ============================================
// RESPONSE HELPERS
// ============================================

/**
 * Create a standardized error response
 *
 * @example
 * return errorResponse(c, ErrorCode.NOT_FOUND, 'Preset not found', 404);
 */
export function errorResponse(
  c: AnyContext,
  error: ErrorCodeType | string,
  message: string,
  status: number = 400
): Response {
  return c.json<ApiErrorResponse>(
    {
      success: false,
      error,
      message,
    },
    status as 400
  );
}

/**
 * Create a standardized success response
 *
 * @example
 * return successResponse(c, { preset, vote_count: 10 });
 * return successResponse(c, { deleted: true }, 'Preset deleted');
 */
export function successResponse<T extends Record<string, unknown>>(
  c: AnyContext,
  data: T,
  message?: string,
  status: number = 200
): Response {
  const response: ApiSuccessResponse & T = {
    success: true,
    ...data,
  };

  if (message) {
    response.message = message;
  }

  return c.json(response, status as 200);
}

// ============================================
// COMMON ERROR RESPONSES
// ============================================

/**
 * 400 Bad Request - Invalid JSON body
 */
export function invalidJsonResponse(c: AnyContext): Response {
  return errorResponse(c, ErrorCode.INVALID_JSON, 'Invalid JSON body', 400);
}

/**
 * 400 Bad Request - Validation failed
 */
export function validationErrorResponse(c: AnyContext, message: string): Response {
  return errorResponse(c, ErrorCode.VALIDATION_ERROR, message, 400);
}

/**
 * 401 Unauthorized
 */
export function unauthorizedResponse(c: AnyContext, message = 'Authentication required'): Response {
  return errorResponse(c, ErrorCode.UNAUTHORIZED, message, 401);
}

/**
 * 403 Forbidden
 */
export function forbiddenResponse(c: AnyContext, message: string): Response {
  return errorResponse(c, ErrorCode.FORBIDDEN, message, 403);
}

/**
 * 404 Not Found
 */
export function notFoundResponse(c: AnyContext, resource: string): Response {
  return errorResponse(c, ErrorCode.NOT_FOUND, `${resource} not found`, 404);
}

/**
 * 409 Conflict - Duplicate resource
 */
export function duplicateResponse(c: AnyContext, message: string): Response {
  return errorResponse(c, ErrorCode.DUPLICATE_RESOURCE, message, 409);
}

/**
 * 500 Internal Server Error
 */
export function internalErrorResponse(c: AnyContext, message = 'An unexpected error occurred'): Response {
  return errorResponse(c, ErrorCode.INTERNAL_ERROR, message, 500);
}
