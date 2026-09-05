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
  /** `wheel` is not one of core's `COLOR_WHEEL_IDS` */
  INVALID_COLOR_WHEEL: 'INVALID_COLOR_WHEEL',
  /** `type` is not a row of core's `HARMONY_OFFSETS` */
  INVALID_HARMONY_TYPE: 'INVALID_HARMONY_TYPE',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  /** Request body is not the JSON the route expects */
  INVALID_BODY: 'INVALID_BODY',
  /** A third-party upstream (XIVAPI) is down, ingesting, or timed out — retry later */
  UPSTREAM_UNAVAILABLE: 'UPSTREAM_UNAVAILABLE',
} as const;
