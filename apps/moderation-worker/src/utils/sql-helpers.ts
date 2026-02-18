/**
 * SQL Query Helpers for D1 Database (SQLite)
 *
 * Provides standardized SQL LIKE pattern escaping and input validation
 * for D1 database queries. D1 uses SQLite, which requires special handling
 * for LIKE wildcards.
 *
 * @see https://developers.cloudflare.com/d1/
 * @see https://www.sqlite.org/lang_expr.html#like
 *
 * @example
 * ```typescript
 * const userInput = "50% off";
 * const escaped = escapeLikePattern(userInput);
 * // escaped = "50\\% off"
 *
 * db.prepare('SELECT * FROM items WHERE name LIKE ? ESCAPE \'\\\'')
 *   .bind(`%${escaped}%`)
 *   .all();
 * ```
 */

/**
 * Result of query input validation
 */
export interface QueryValidationResult {
  /** Whether the query passed validation */
  valid: boolean;
  /** Sanitized query string (truncated if too long) */
  sanitized: string;
  /** Error message if validation failed */
  error?: string;
}

/**
 * Options for query input validation
 */
export interface QueryValidationOptions {
  /** Maximum allowed length (default: 100) */
  maxLength?: number;
  /** Minimum required length (default: 0) */
  minLength?: number;
  /** Regex pattern that must match (default: none) */
  allowedPattern?: RegExp;
}

/**
 * Escapes SQL LIKE pattern wildcards for D1/SQLite
 *
 * Escapes the following characters:
 * - `%` (matches zero or more characters)
 * - `_` (matches exactly one character)
 * - `\` (backslash escape character)
 *
 * IMPORTANT: Must be used with `ESCAPE '\\'` clause in SQL query.
 *
 * @param query - The user input query to escape
 * @param maxLength - Maximum length before truncation (default: 100)
 * @returns Escaped query safe for use in LIKE patterns
 *
 * @example
 * ```typescript
 * const query = escapeLikePattern("test_pattern");
 * // Returns: "test\\_pattern"
 *
 * // Use in SQL:
 * db.prepare('SELECT * FROM users WHERE name LIKE ? ESCAPE \'\\\'')
 *   .bind(`%${query}%`);
 * ```
 */
export function escapeLikePattern(query: string, maxLength: number = 100): string {
  // Truncate to max length first
  if (query.length > maxLength) {
    query = query.substring(0, maxLength);
  }

  // Escape backslash first, then wildcards
  // Regex explanation: /[%_\\]/g
  // - [%_\\] = character class matching %, _, or \
  // - g = global (replace all occurrences)
  // - \\$& = replacement: backslash + matched character
  return query.replace(/[%_\\]/g, '\\$&');
}

/**
 * Validates and sanitizes user input for SQL queries
 *
 * Performs validation checks:
 * - Length constraints (min/max)
 * - Optional regex pattern matching
 * - Automatically truncates overly long input
 *
 * @param query - The user input to validate
 * @param options - Validation options
 * @returns Validation result with sanitized query
 *
 * @example
 * ```typescript
 * const result = validateQueryInput(userInput, {
 *   maxLength: 100,
 *   minLength: 1,
 *   allowedPattern: /^[a-zA-Z0-9\s]+$/  // Alphanumeric + spaces only
 * });
 *
 * if (!result.valid) {
 *   return error(result.error);
 * }
 *
 * const escaped = escapeLikePattern(result.sanitized);
 * ```
 */
export function validateQueryInput(
  query: string,
  options: QueryValidationOptions = {}
): QueryValidationResult {
  const maxLength = options.maxLength ?? 100;
  const minLength = options.minLength ?? 0;

  // Check minimum length
  if (query.length < minLength) {
    return {
      valid: false,
      sanitized: '',
      error: `Query must be at least ${minLength} characters`,
    };
  }

  // Check maximum length (truncate if too long)
  let sanitized = query;
  if (query.length > maxLength) {
    sanitized = query.substring(0, maxLength);
    // Still valid, just truncated
  }

  // Check against allowed pattern
  if (options.allowedPattern && !options.allowedPattern.test(sanitized)) {
    return {
      valid: false,
      sanitized: '',
      error: 'Query contains invalid characters',
    };
  }

  return {
    valid: true,
    sanitized,
  };
}

/**
 * Validates and escapes a query input in one step
 *
 * Convenience function that combines validation and escaping.
 *
 * @param query - The user input to validate and escape
 * @param options - Validation options
 * @returns Validation result with escaped query
 *
 * @example
 * ```typescript
 * const result = validateAndEscapeQuery(userInput, { maxLength: 100 });
 * if (!result.valid) {
 *   return [];
 * }
 *
 * return db.prepare('SELECT * FROM users WHERE name LIKE ? ESCAPE \'\\\'')
 *   .bind(`%${result.sanitized}%`)
 *   .all();
 * ```
 */
export function validateAndEscapeQuery(
  query: string,
  options: QueryValidationOptions = {}
): QueryValidationResult {
  const validation = validateQueryInput(query, options);

  if (!validation.valid) {
    return validation;
  }

  return {
    valid: true,
    sanitized: escapeLikePattern(validation.sanitized, options.maxLength),
  };
}
