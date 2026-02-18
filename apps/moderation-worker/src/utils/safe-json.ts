/**
 * Safe JSON Parsing Utilities for Cloudflare Workers
 *
 * Provides protection against:
 * - Prototype pollution attacks (__proto__, constructor, prototype)
 * - Deeply nested objects (DoS via stack exhaustion)
 * - Excessively large arrays (memory exhaustion)
 * - Runtime object modification (via Object.freeze)
 *
 * @see https://portswigger.net/web-security/prototype-pollution
 *
 * @example
 * ```typescript
 * const result = safeParseJSON<MyType>(jsonString, {
 *   maxDepth: 10,
 *   validateStructure: true,
 *   freezeResult: true
 * });
 *
 * if (!result.success) {
 *   console.error('JSON parse failed:', result.error);
 *   return;
 * }
 *
 * const data = result.data;  // Frozen, validated object
 * ```
 */

/**
 * Options for safe JSON parsing
 */
export interface SafeJSONOptions {
  /**
   * Maximum nesting depth allowed
   * @default 20
   */
  maxDepth?: number;

  /**
   * Whether to validate object structure (depth, array size)
   * @default true
   */
  validateStructure?: boolean;

  /**
   * Whether to freeze result object (prevents runtime modification)
   * @default true
   */
  freezeResult?: boolean;
}

/**
 * Result of safe JSON parsing
 */
export interface SafeParseResult<T = unknown> {
  /** Whether parsing succeeded */
  success: boolean;

  /** Parsed and validated data (only present if success = true) */
  data?: T;

  /** Error message if parsing failed */
  error?: string;

  /** Non-fatal warnings (e.g., unusual but valid structure) */
  warnings?: string[];
}

/**
 * Safely parse JSON with security validation
 *
 * Performs the following checks:
 * 1. Standard JSON.parse (catches syntax errors)
 * 2. Prototype pollution detection
 * 3. Structure validation (depth, array size)
 * 4. Optional Object.freeze for immutability
 *
 * @param body - JSON string to parse
 * @param options - Parsing options
 * @returns Parse result with validated data or error
 *
 * @example
 * ```typescript
 * // Parse Discord interaction with strict validation
 * const result = safeParseJSON<DiscordInteraction>(body, {
 *   maxDepth: 10,  // Discord interactions are shallow
 *   validateStructure: true,
 *   freezeResult: true
 * });
 *
 * if (!result.success) {
 *   logger.warn('Malicious JSON detected', { error: result.error });
 *   return badRequest(result.error);
 * }
 *
 * const interaction = result.data!;
 * ```
 */
export function safeParseJSON<T = unknown>(
  body: string,
  options: SafeJSONOptions = {}
): SafeParseResult<T> {
  // Apply defaults
  const maxDepth = options.maxDepth ?? 20;
  const validateStructure = options.validateStructure ?? true;
  const freezeResult = options.freezeResult ?? true;

  // Step 1: Parse JSON (may throw on syntax errors)
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch (err) {
    return {
      success: false,
      error: 'Invalid JSON syntax',
    };
  }

  // Step 2: Check for prototype pollution
  const pollutionCheck = hasPrototypePollution(parsed);
  if (pollutionCheck.detected) {
    return {
      success: false,
      error: `Potential prototype pollution detected: ${pollutionCheck.reason}`,
    };
  }

  // Step 3: Validate object structure
  if (validateStructure) {
    const validation = validateObjectStructure(parsed, maxDepth);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
        warnings: validation.warnings,
      };
    }

    // Return warnings even if valid
    if (validation.warnings && validation.warnings.length > 0) {
      return {
        success: true,
        data: parsed as T,
        warnings: validation.warnings,
      };
    }
  }

  // Step 4: Freeze result to prevent modification
  if (freezeResult && typeof parsed === 'object' && parsed !== null) {
    deepFreeze(parsed);
  }

  return {
    success: true,
    data: parsed as T,
  };
}

/**
 * Result of prototype pollution detection
 */
interface PrototypePollutionCheck {
  detected: boolean;
  reason?: string;
}

/**
 * Check if object contains prototype pollution keys
 *
 * Detects common prototype pollution attack vectors:
 * - `__proto__` - Direct prototype manipulation
 * - `constructor` - Constructor property access
 * - `prototype` - Prototype property access
 *
 * @param obj - Object to check
 * @param path - Current path (for error reporting)
 * @returns Detection result
 *
 * @example
 * ```typescript
 * const malicious = { "__proto__": { "isAdmin": true } };
 * const check = hasPrototypePollution(malicious);
 * // check.detected = true
 * // check.reason = "Dangerous key '__proto__' found at root"
 * ```
 */
function hasPrototypePollution(
  obj: unknown,
  path: string = 'root'
): PrototypePollutionCheck {
  if (typeof obj !== 'object' || obj === null) {
    return { detected: false };
  }

  // Dangerous keys that indicate prototype pollution attempts
  const dangerousKeys = ['__proto__', 'constructor', 'prototype'];

  // Check keys at current level
  for (const key of dangerousKeys) {
    if (key in obj) {
      return {
        detected: true,
        reason: `Dangerous key '${key}' found at ${path}`,
      };
    }
  }

  // Recursively check nested objects
  for (const [key, value] of Object.entries(obj)) {
    const check = hasPrototypePollution(value, `${path}.${key}`);
    if (check.detected) {
      return check;
    }
  }

  return { detected: false };
}

/**
 * Result of object structure validation
 */
interface StructureValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

/**
 * Validate object structure (depth, array size, etc.)
 *
 * Prevents DoS attacks via:
 * - Deeply nested objects (stack exhaustion)
 * - Excessively large arrays (memory exhaustion)
 *
 * @param obj - Object to validate
 * @param maxDepth - Maximum allowed nesting depth
 * @param currentDepth - Current recursion depth (internal)
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const result = validateObjectStructure(data, 20);
 * if (!result.valid) {
 *   console.error('Invalid structure:', result.error);
 * }
 * ```
 */
function validateObjectStructure(
  obj: unknown,
  maxDepth: number,
  currentDepth: number = 0
): StructureValidationResult {
  // Check depth limit
  if (currentDepth > maxDepth) {
    return {
      valid: false,
      error: `Object nesting exceeds maximum depth of ${maxDepth}`,
    };
  }

  // Non-objects are always valid
  if (typeof obj !== 'object' || obj === null) {
    return { valid: true };
  }

  const warnings: string[] = [];

  // Check array length (prevent huge arrays)
  if (Array.isArray(obj)) {
    const MAX_ARRAY_LENGTH = 1000;
    if (obj.length > MAX_ARRAY_LENGTH) {
      return {
        valid: false,
        error: `Array exceeds maximum length of ${MAX_ARRAY_LENGTH} (has ${obj.length})`,
      };
    }

    // Warn about large arrays (but still valid)
    if (obj.length > 100) {
      warnings.push(`Large array detected: ${obj.length} elements`);
    }
  }

  // Check object property count
  if (!Array.isArray(obj)) {
    const keys = Object.keys(obj);
    const MAX_PROPERTIES = 1000;
    if (keys.length > MAX_PROPERTIES) {
      return {
        valid: false,
        error: `Object has too many properties: ${keys.length} (max ${MAX_PROPERTIES})`,
      };
    }
  }

  // Recursively validate nested objects/arrays
  const values = Array.isArray(obj) ? obj : Object.values(obj);
  for (const value of values) {
    const result = validateObjectStructure(value, maxDepth, currentDepth + 1);
    if (!result.valid) {
      return result;
    }

    // Collect warnings from nested objects
    if (result.warnings) {
      warnings.push(...result.warnings);
    }
  }

  return {
    valid: true,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Deep freeze an object (recursively freeze all properties)
 *
 * Prevents runtime modification of parsed JSON data.
 * Useful for ensuring that validated data remains unchanged.
 *
 * @param obj - Object to freeze
 *
 * @example
 * ```typescript
 * const data = { user: { name: 'Alice' } };
 * deepFreeze(data);
 *
 * data.user.name = 'Bob';  // Throws in strict mode, silently fails otherwise
 * ```
 */
function deepFreeze(obj: unknown): void {
  if (typeof obj !== 'object' || obj === null) {
    return;
  }

  // Freeze the object itself
  Object.freeze(obj);

  // Recursively freeze all property values
  const values = Array.isArray(obj) ? obj : Object.values(obj);
  for (const value of values) {
    deepFreeze(value);
  }
}
