/**
 * Text Sanitization Utilities
 *
 * Security utilities for sanitizing user-provided content before display
 * in Discord embeds and messages.
 *
 * @module utils/sanitize
 */

/**
 * Maximum lengths for preset display
 */
export const MAX_PRESET_NAME_LENGTH = 100;
export const MAX_PRESET_DESCRIPTION_LENGTH = 500;
export const MAX_COLLECTION_NAME_LENGTH = 50;
export const MAX_COLLECTION_DESCRIPTION_LENGTH = 200;

/**
 * Sanitize text by removing control characters and normalizing whitespace.
 * This helps prevent:
 * - Zalgo text attacks
 * - Invisible character injection
 * - Log injection via newlines
 * - Display issues in Discord embeds
 *
 * @param text - The text to sanitize
 * @param maxLength - Optional maximum length (truncates with ellipsis)
 * @returns Sanitized text
 *
 * @example
 * ```typescript
 * sanitizeDisplayText("Hello\x00World")  // "HelloWorld"
 * sanitizeDisplayText("Too  many   spaces")  // "Too many spaces"
 * sanitizeDisplayText("Very long text...", 10)  // "Very lon…"
 * ```
 */
export function sanitizeDisplayText(text: string, maxLength?: number): string {
  if (typeof text !== 'string') {
    return '';
  }

  let sanitized = text
    // Remove ASCII control characters (0x00-0x1F except tab/newline) and DEL (0x7F)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Remove common invisible Unicode characters
    .replace(/[\u200B-\u200D\uFEFF\u2060\u00AD]/g, '')
    // Normalize consecutive whitespace to single space
    .replace(/\s+/g, ' ')
    // Trim leading and trailing whitespace
    .trim();

  // Truncate if max length specified
  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength - 1) + '…';
  }

  return sanitized;
}

/**
 * Sanitize a preset name for display
 *
 * @param name - The preset name
 * @returns Sanitized preset name
 */
export function sanitizePresetName(name: string): string {
  return sanitizeDisplayText(name, MAX_PRESET_NAME_LENGTH);
}

/**
 * Sanitize a preset description for display
 *
 * @param description - The preset description
 * @returns Sanitized preset description
 */
export function sanitizePresetDescription(description: string): string {
  return sanitizeDisplayText(description, MAX_PRESET_DESCRIPTION_LENGTH);
}

/**
 * Sanitize a collection name for display and storage
 *
 * @param name - The collection name
 * @returns Sanitized collection name
 */
export function sanitizeCollectionName(name: string): string {
  return sanitizeDisplayText(name, MAX_COLLECTION_NAME_LENGTH);
}

/**
 * Sanitize a collection description for display
 *
 * @param description - The collection description
 * @returns Sanitized collection description
 */
export function sanitizeCollectionDescription(description: string): string {
  return sanitizeDisplayText(description, MAX_COLLECTION_DESCRIPTION_LENGTH);
}

/**
 * Sanitize an error message for display to users.
 * Provides a safe, generic error message based on status codes.
 *
 * @param statusCode - HTTP status code
 * @param fallbackMessage - Optional fallback message for unknown errors
 * @returns A safe, user-friendly error message
 */
export function sanitizeErrorMessage(statusCode: number, fallbackMessage?: string): string {
  switch (statusCode) {
    case 400:
      return 'Invalid request. Please check your input and try again.';
    case 401:
    case 403:
      return 'Permission denied.';
    case 404:
      return 'Not found.';
    case 409:
      return 'This already exists or conflicts with another resource.';
    case 429:
      return 'Too many requests. Please wait a moment and try again.';
    case 500:
    case 502:
    case 503:
      return 'A server error occurred. Please try again later.';
    default:
      return fallbackMessage || 'An error occurred. Please try again.';
  }
}
