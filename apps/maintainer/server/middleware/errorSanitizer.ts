/**
 * Error sanitization utilities
 *
 * SECURITY: Prevents user input from appearing in error messages
 *
 * Zod validation errors can include user-supplied values in their messages.
 * This module sanitizes errors by mapping them to safe error codes and
 * generic messages that don't leak sensitive information.
 *
 * Detailed errors are still logged server-side for debugging.
 */

import { z } from 'zod'

/**
 * Safe error codes for client-facing error messages
 */
export enum ValidationErrorCode {
  INVALID_TYPE = 'INVALID_TYPE',
  INVALID_FORMAT = 'INVALID_FORMAT',
  REQUIRED_FIELD = 'REQUIRED_FIELD',
  OUT_OF_RANGE = 'OUT_OF_RANGE',
  TOO_SMALL = 'TOO_SMALL',
  TOO_BIG = 'TOO_BIG',
  INVALID_ENUM = 'INVALID_ENUM',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Sanitized error detail for client response
 */
export interface SanitizedError {
  /** Dot-separated path to the invalid field (e.g., "dyeNames.123") */
  field: string
  /** Safe error code that doesn't include user input */
  code: ValidationErrorCode
  /** Generic error message for display */
  message: string
}

/**
 * Sanitize a Zod validation error for safe client response
 *
 * Converts Zod's detailed error information into a safe format that:
 * - Does not include user-supplied values
 * - Uses structured error codes
 * - Provides helpful but generic messages
 *
 * @param zodError - The Zod validation error to sanitize
 * @returns Array of sanitized error details safe to send to client
 *
 * @example
 * ```typescript
 * try {
 *   schema.parse(req.body)
 * } catch (error) {
 *   if (error instanceof z.ZodError) {
 *     console.warn('Validation failed:', error.errors) // Log details server-side
 *     const safe = sanitizeZodError(error) // Get safe version for client
 *     res.status(400).json({ success: false, details: safe })
 *   }
 * }
 * ```
 */
export function sanitizeZodError(zodError: z.ZodError): SanitizedError[] {
  return zodError.errors.map((err) => {
    const code = mapZodErrorCode(err.code)
    const field = err.path.join('.')

    return {
      field,
      code,
      message: getGenericErrorMessage(code, field),
    }
  })
}

/**
 * Map Zod error codes to our safe error codes
 *
 * @param zodCode - The Zod error code (e.g., "invalid_type")
 * @returns Corresponding safe error code
 */
function mapZodErrorCode(zodCode: string): ValidationErrorCode {
  switch (zodCode) {
    case 'invalid_type':
      return ValidationErrorCode.INVALID_TYPE
    case 'invalid_string':
    case 'invalid_literal':
      return ValidationErrorCode.INVALID_FORMAT
    case 'too_small':
      return ValidationErrorCode.TOO_SMALL
    case 'too_big':
      return ValidationErrorCode.TOO_BIG
    case 'invalid_enum_value':
      return ValidationErrorCode.INVALID_ENUM
    default:
      return ValidationErrorCode.UNKNOWN
  }
}

/**
 * Generate a generic error message that doesn't include user input
 *
 * @param code - The safe error code
 * @param field - The field path (already safe - just the path, no values)
 * @returns A user-friendly generic error message
 */
function getGenericErrorMessage(code: ValidationErrorCode, field: string): string {
  // Use field name or "this field" if field is empty
  const fieldDisplay = field || 'this field'

  switch (code) {
    case ValidationErrorCode.INVALID_TYPE:
      return `Field '${fieldDisplay}' has invalid type`
    case ValidationErrorCode.INVALID_FORMAT:
      return `Field '${fieldDisplay}' has invalid format`
    case ValidationErrorCode.REQUIRED_FIELD:
      return `Field '${fieldDisplay}' is required`
    case ValidationErrorCode.TOO_SMALL:
      return `Field '${fieldDisplay}' value is too small`
    case ValidationErrorCode.TOO_BIG:
      return `Field '${fieldDisplay}' value is too large`
    case ValidationErrorCode.OUT_OF_RANGE:
      return `Field '${fieldDisplay}' is out of valid range`
    case ValidationErrorCode.INVALID_ENUM:
      return `Field '${fieldDisplay}' has invalid value`
    default:
      return `Field '${fieldDisplay}' failed validation`
  }
}
