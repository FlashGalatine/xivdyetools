/**
 * @xivdyetools/types - Error Codes
 *
 * Unified error codes from all xivdyetools projects.
 *
 * @module error/codes
 */

/**
 * Error codes for different failure scenarios
 *
 * Consolidated from xivdyetools-core and xivdyetools-web-app.
 */
export enum ErrorCode {
  // Core errors (from xivdyetools-core)
  /** Invalid hex color format provided */
  INVALID_HEX_COLOR = 'INVALID_HEX_COLOR',

  /** RGB value out of valid range (0-255) */
  INVALID_RGB_VALUE = 'INVALID_RGB_VALUE',

  /** Requested dye ID not found in database */
  DYE_NOT_FOUND = 'DYE_NOT_FOUND',

  /** Failed to load dye database */
  DATABASE_LOAD_FAILED = 'DATABASE_LOAD_FAILED',

  /** Invalid input provided to function */
  INVALID_INPUT = 'INVALID_INPUT',

  /** External API call failed */
  API_CALL_FAILED = 'API_CALL_FAILED',

  /** Failed to load locale data */
  LOCALE_LOAD_FAILED = 'LOCALE_LOAD_FAILED',

  /** Unknown or unexpected error */
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',

  // Web-specific errors (from xivdyetools-web-app)
  /** Browser storage quota exceeded */
  STORAGE_QUOTA_EXCEEDED = 'STORAGE_QUOTA_EXCEEDED',

  /** Invalid theme name provided */
  INVALID_THEME = 'INVALID_THEME',

  /** Failed to load image file */
  IMAGE_LOAD_FAILED = 'IMAGE_LOAD_FAILED',
}
