/**
 * URL and Sensitive Data Sanitization Utilities
 *
 * Prevents accidental token exposure in:
 * - Log messages
 * - Error stack traces
 * - Monitoring systems
 * - Debug output
 *
 * Masks sensitive data carried in a URL or an error's text:
 * - Discord interaction tokens in webhook URLs
 * - Bot tokens and API keys in URLs and query parameters
 *
 * Nothing here reads HTTP headers. The header and fetch-logging helpers
 * (`sanitizeHeaders`, `sanitizeFetchRequest`, `sanitizeFetchResponse`) were
 * removed in 1.7.2 (DEAD-010/011) — no production path ever called them, and
 * `discord-api.ts` redacts through `sanitizeUrl` and `sanitizeErrorMessage`.
 *
 * @example
 * ```typescript
 * const url = 'https://discord.com/api/webhooks/123/ABC123xyz';
 * console.log(sanitizeUrl(url));
 * // Output: 'https://discord.com/api/webhooks/123/[REDACTED_TOKEN]'
 * ```
 */

/**
 * Pattern for matching and replacing sensitive data in URLs
 */
interface SensitivePattern {
  /** Regex pattern to match sensitive data */
  pattern: RegExp;
  /** Replacement string (can use capture groups) */
  replacement: string;
}

/**
 * Patterns for sensitive data in URLs
 *
 * These patterns are ordered by specificity (most specific first).
 */
const SENSITIVE_URL_PATTERNS: SensitivePattern[] = [
  // Discord webhook URLs with message ID: /webhooks/{app_id}/{token}/messages/{id}
  {
    pattern: /\/webhooks\/(\d+)\/([A-Za-z0-9_-]{64,})\/messages/g,
    replacement: '/webhooks/$1/[REDACTED_TOKEN]/messages',
  },

  // Discord webhook URLs: /webhooks/{app_id}/{token}
  {
    pattern: /\/webhooks\/(\d+)\/([A-Za-z0-9_-]{64,})/g,
    replacement: '/webhooks/$1/[REDACTED_TOKEN]',
  },

  // Generic API keys in query params: ?api_key=xxx, &token=xxx, etc.
  {
    pattern: /([?&])(api_key|token|key|secret|password)=([^&\s]+)/gi,
    replacement: '$1$2=[REDACTED]',
  },

  // Bearer tokens in text (e.g., error messages)
  {
    pattern: /Bearer\s+([A-Za-z0-9_-]{20,})/gi,
    replacement: 'Bearer [REDACTED]',
  },
];

/**
 * Sanitize a URL by masking sensitive tokens
 *
 * Applies regex patterns to mask tokens and API keys in URLs.
 * Safe to call on any URL - non-sensitive URLs are returned unchanged.
 *
 * @param url - URL string or URL object to sanitize
 * @returns Sanitized URL with tokens masked
 *
 * @example
 * ```typescript
 * // Discord webhook URL
 * sanitizeUrl('/webhooks/123/ABC123xyz/messages/@original')
 * // Returns: '/webhooks/123/[REDACTED_TOKEN]/messages/@original'
 *
 * // Query parameter
 * sanitizeUrl('/api/data?token=secret123')
 * // Returns: '/api/data?token=[REDACTED]'
 *
 * // Normal URL (unchanged)
 * sanitizeUrl('/api/users/123')
 * // Returns: '/api/users/123'
 * ```
 */
export function sanitizeUrl(url: string | URL): string {
  let sanitized = typeof url === 'string' ? url : url.toString();

  // Apply all patterns
  for (const { pattern, replacement } of SENSITIVE_URL_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
  }

  return sanitized;
}

/**
 * Sanitize error messages that might contain sensitive data
 *
 * Applies URL sanitization to error messages to prevent
 * token leakage in stack traces and error logs.
 *
 * @param error - Error object, string, or unknown value
 * @returns Sanitized error message
 *
 * @example
 * ```typescript
 * try {
 *   await fetch('https://discord.com/api/webhooks/123/SECRET/messages');
 * } catch (error) {
 *   console.error(sanitizeErrorMessage(error));
 *   // Error message will have tokens masked
 * }
 * ```
 */
export function sanitizeErrorMessage(error: unknown): string {
  let message: string;

  if (error instanceof Error) {
    message = error.message;
    // Also check error.stack if present
    if (error.stack) {
      message += '\n' + error.stack;
    }
  } else if (typeof error === 'string') {
    message = error;
  } else {
    message = String(error);
  }

  // Apply URL sanitization to error message
  return sanitizeUrl(message);
}

