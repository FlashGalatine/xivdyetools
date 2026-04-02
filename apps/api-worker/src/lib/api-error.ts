/**
 * API Error class for structured error responses.
 * Thrown from validation helpers and route handlers,
 * caught by the global error handler in index.ts.
 */
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Standard error codes for Phase 1 */
export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MISSING_PARAMETER: 'MISSING_PARAMETER',
  INVALID_HEX: 'INVALID_HEX',
  INVALID_MATCHING_METHOD: 'INVALID_MATCHING_METHOD',
  INVALID_LOCALE: 'INVALID_LOCALE',
  INVALID_STAIN_ID: 'INVALID_STAIN_ID',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
