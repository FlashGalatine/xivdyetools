/**
 * URL and Sensitive Data Sanitization Utilities
 *
 * Prevents accidental token exposure in:
 * - Log messages
 * - Error stack traces
 * - Monitoring systems
 * - Debug output
 *
 * Masks sensitive data including:
 * - Discord interaction tokens in webhook URLs
 * - Bot tokens in Authorization headers
 * - API keys in URLs and query parameters
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
 * Header names that contain sensitive values
 * (case-insensitive matching)
 */
const SENSITIVE_HEADERS: string[] = [
  'authorization',
  'x-api-key',
  'x-auth-token',
  'x-request-signature',
  'cookie',
  'set-cookie',
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
 * Sanitize HTTP headers by masking sensitive values
 *
 * Replaces sensitive header values with a truncated version + "[REDACTED]".
 * Non-sensitive headers are returned unchanged.
 *
 * @param headers - Headers object or Headers instance
 * @returns Sanitized headers object safe for logging
 *
 * @example
 * ```typescript
 * const headers = {
 *   'Authorization': 'Bot ABC123...',
 *   'Content-Type': 'application/json'
 * };
 *
 * const sanitized = sanitizeHeaders(headers);
 * // {
 * //   'Authorization': 'Bot ABC1...[REDACTED]',
 * //   'Content-Type': 'application/json'
 * // }
 * ```
 */
export function sanitizeHeaders(
  headers: Record<string, string> | Headers
): Record<string, string> {
  const sanitized: Record<string, string> = {};

  // Convert Headers instance to entries array
  const entries =
    headers instanceof Headers ? Array.from(headers.entries()) : Object.entries(headers);

  for (const [key, value] of entries) {
    const lowerKey = key.toLowerCase();

    if (SENSITIVE_HEADERS.includes(lowerKey)) {
      // Keep first 8 chars for debugging, mask the rest
      if (value.length > 8) {
        sanitized[key] = value.substring(0, 8) + '...[REDACTED]';
      } else {
        // Very short value (shouldn't happen for real tokens)
        sanitized[key] = '[REDACTED]';
      }
    } else {
      // Non-sensitive header - keep as-is
      sanitized[key] = value;
    }
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
  let message = '';

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

/**
 * Sanitize fetch request details for logging
 *
 * Creates a sanitized representation of a fetch request
 * suitable for logging and debugging.
 *
 * @param url - Request URL
 * @param options - Fetch options (optional)
 * @returns Sanitized request info safe for logging
 *
 * @example
 * ```typescript
 * const logData = sanitizeFetchRequest(url, {
 *   method: 'POST',
 *   headers: {
 *     'Authorization': 'Bot SECRET',
 *     'Content-Type': 'application/json'
 *   }
 * });
 *
 * logger.debug('Making request', logData);
 * // {
 * //   url: '/webhooks/123/[REDACTED_TOKEN]',
 * //   method: 'POST',
 * //   headers: {
 * //     'Authorization': 'Bot SECR...[REDACTED]',
 * //     'Content-Type': 'application/json'
 * //   }
 * // }
 * ```
 */
export function sanitizeFetchRequest(
  url: string | URL,
  options?: RequestInit
): {
  url: string;
  method: string;
  headers: Record<string, string>;
} {
  return {
    url: sanitizeUrl(url),
    method: options?.method || 'GET',
    headers: options?.headers
      ? sanitizeHeaders(options.headers as Record<string, string>)
      : {},
  };
}

/**
 * Sanitize fetch response details for logging
 *
 * Creates a sanitized representation of a fetch response
 * suitable for logging and debugging.
 *
 * @param response - Fetch Response object
 * @returns Sanitized response info safe for logging
 *
 * @example
 * ```typescript
 * const response = await fetch(url);
 * const logData = sanitizeFetchResponse(response);
 *
 * logger.debug('Response received', logData);
 * // {
 * //   status: 200,
 * //   statusText: 'OK',
 * //   url: '/webhooks/123/[REDACTED_TOKEN]',
 * //   headers: { ... }
 * // }
 * ```
 */
export function sanitizeFetchResponse(response: Response): {
  status: number;
  statusText: string;
  url: string;
  headers: Record<string, string>;
} {
  return {
    status: response.status,
    statusText: response.statusText,
    url: sanitizeUrl(response.url),
    headers: sanitizeHeaders(response.headers),
  };
}
