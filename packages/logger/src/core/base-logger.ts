/**
 * @xivdyetools/logger - Base Logger
 *
 * Abstract base class implementing common logging functionality.
 *
 * @module core/base-logger
 */

import type { Logger, ExtendedLogger, LogContext, LogEntry, LogLevel, LoggerConfig } from '../types.js';
// LOGGER-REF-003 FIX: Import from centralized constants
import { DEFAULT_REDACT_FIELDS } from '../constants.js';

/** Log levels in order of severity (for filtering) */
const LOG_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];

/**
 * Abstract base logger with common functionality
 *
 * Extend this class and implement the `write` method to create
 * custom logging adapters.
 *
 * @internal Implementation detail — consumers should use factory functions
 * (`createBrowserLogger`, `createWorkerLogger`, `createRequestLogger`,
 * `createLibraryLogger`) or pre-configured instances (`NoOpLogger`,
 * `ConsoleLogger`, `browserLogger`) instead.
 */
export abstract class BaseLogger implements ExtendedLogger {
  protected config: LoggerConfig;
  protected globalContext: LogContext = {};

  constructor(config: Partial<LoggerConfig> = {}) {
    // FINDING-008: Merge custom redactFields with defaults instead of replacing
    this.config = {
      level: 'info',
      format: 'json',
      timestamps: true,
      sanitizeErrors: true,
      ...config,
      redactFields: [
        ...DEFAULT_REDACT_FIELDS,
        ...(config.redactFields ?? []),
      ],
    };
  }

  /**
   * Write a log entry to the output
   *
   * Implement this method in subclasses to define where logs go.
   */
  protected abstract write(entry: LogEntry): void;

  /**
   * Check if a log level should be output
   */
  protected shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS.indexOf(level) >= LOG_LEVELS.indexOf(this.config.level);
  }

  /**
   * Create a structured log entry
   */
  protected createEntry(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: unknown
  ): LogEntry {
    const entry: LogEntry = {
      level,
      message: this.config.prefix ? `[${this.config.prefix}] ${message}` : message,
      timestamp: new Date().toISOString(),
    };

    const mergedContext = this.mergeContext(context);
    if (mergedContext && Object.keys(mergedContext).length > 0) {
      entry.context = mergedContext;
    }

    if (error) {
      entry.error = this.formatError(error);
    }

    return entry;
  }

  /**
   * Merge global context with provided context
   */
  protected mergeContext(context?: LogContext): LogContext | undefined {
    if (!context && Object.keys(this.globalContext).length === 0) {
      return undefined;
    }

    const merged = { ...this.globalContext, ...context };
    return this.redactSensitiveFields(merged);
  }

  /**
   * Format an error for logging
   */
  protected formatError(error: unknown): LogEntry['error'] {
    if (error instanceof Error) {
      const formatted: LogEntry['error'] = {
        name: error.name,
        message: this.config.sanitizeErrors
          ? this.sanitizeErrorMessage(error.message)
          : error.message,
      };

      // Include error code if present
      if ('code' in error && typeof error.code === 'string') {
        formatted.code = error.code;
      }

      // Only include stack in non-production or if not sanitizing
      if (!this.config.sanitizeErrors) {
        formatted.stack = error.stack;
      }

      return formatted;
    }

    // Handle non-Error objects
    return {
      name: 'Unknown',
      message: String(error),
    };
  }

  /**
   * Sanitize error messages to remove potential secrets
   *
   * LOG-ERR-001: Fixed patterns to capture values that may contain spaces.
   * Uses patterns that match:
   * - Quoted values: token="my secret" or token='my secret'
   * - Unquoted values until delimiter: token=value,next or token=value;next
   * - Remaining text until end: token=everything else here
   */
  protected sanitizeErrorMessage(message: string): string {
    // Pattern components:
    // - ["']([^"']*?)["'] matches quoted strings
    // - [^\s,;'"]+(?:\s+[^\s,;'"=]+)* matches unquoted values (including spaces before delimiter)
    // The order matters: try quoted first, then unquoted

    // Reusable value pattern: matches quoted strings or unquoted values until delimiter
    const V = `(?:["']([^"']*?)["']|[^\\s,;]+)`;

    // BUG-024/BUG-025: key may itself be quoted (JSON bodies echoed into error
    // messages) and whitespace is allowed on BOTH sides of the separator
    // ("token = abc"). Previously the separator had to immediately follow the
    // key name, so `{"token":"abc"}` and `token = abc` bypassed sanitization.
    const K = (name: string): string => `["']?${name}["']?\\s*[=:]\\s*`;

    return message
      // Bearer tokens - typically single tokens without spaces
      .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
      // BUG-025: JSON-shaped pass — catches every "…token"/"…secret"/"…password"/
      // "…key"-suffixed quoted key in one sweep, including compound names
      // (sessionToken, webhook_secret) that the per-key patterns below miss.
      .replace(
        /"([a-z0-9_-]*(?:token|secret|password|key))"\s*:\s*"[^"]*"/gi,
        '"$1":"[REDACTED]"'
      )
      // Key=value patterns - handle quoted and unquoted values
      // Matches: key="value with spaces" or key='value' or key=value until delimiter
      .replace(new RegExp(`${K('token')}${V}`, 'gi'), 'token=[REDACTED]')
      .replace(new RegExp(`${K('secret')}${V}`, 'gi'), 'secret=[REDACTED]')
      .replace(new RegExp(`${K('password')}${V}`, 'gi'), 'password=[REDACTED]')
      .replace(new RegExp(`${K('api[_-]?key')}${V}`, 'gi'), 'api_key=[REDACTED]')
      // Additional common sensitive patterns
      // Use negative lookahead to skip "Authorization: Bearer ..." which is handled by Bearer pattern
      .replace(new RegExp(`["']?authorization["']?\\s*[=:]\\s*(?!Bearer\\s)${V}`, 'gi'), 'authorization=[REDACTED]')
      .replace(new RegExp(`${K('access[_-]?token')}${V}`, 'gi'), 'access_token=[REDACTED]')
      .replace(new RegExp(`${K('refresh[_-]?token')}${V}`, 'gi'), 'refresh_token=[REDACTED]')
      // FINDING-005: Additional patterns for OAuth, crypto keys, and webhook secrets
      .replace(new RegExp(`${K('client[_-]?secret')}${V}`, 'gi'), 'client_secret=[REDACTED]')
      .replace(new RegExp(`${K('private[_-]?key')}${V}`, 'gi'), 'private_key=[REDACTED]')
      .replace(new RegExp(`${K('signing[_-]?(?:key|secret)')}${V}`, 'gi'), 'signing_key=[REDACTED]')
      .replace(new RegExp(`${K('webhook[_-]?secret')}${V}`, 'gi'), 'webhook_secret=[REDACTED]')
      .replace(new RegExp(`${K('auth[_-]?token')}${V}`, 'gi'), 'auth_token=[REDACTED]')
      .replace(new RegExp(`${K('credential[s]?')}${V}`, 'gi'), 'credentials=[REDACTED]');
  }

  /**
   * Redact sensitive fields from context
   *
   * FINDING-008: Recursively walks nested objects (up to MAX_REDACT_DEPTH)
   * to redact sensitive fields at any nesting level, not just top-level.
   */
  protected redactSensitiveFields(context: LogContext, seen?: WeakSet<object>): LogContext {
    // BUG-024: cycle guard replaces the old fixed depth cap (MAX_REDACT_DEPTH=3),
    // which let exact-match secrets nested 4+ levels deep through verbatim.
    const visited = seen ?? new WeakSet<object>();
    visited.add(context);

    const redacted = { ...context };
    const fieldsToRedact = this.config.redactFields || DEFAULT_REDACT_FIELDS;

    // BUG-024: match case-insensitively with separators collapsed, so
    // Token/TOKEN/Authorization/jwtSecret hit the same list entries as
    // token/authorization/jwt_secret; plus a suffix heuristic that catches
    // compound keys like sessionToken/webhookSecret/userPassword.
    const normalize = (k: string): string => k.toLowerCase().replace(/[_-]/g, '');
    const redactSet = new Set(fieldsToRedact.map(normalize));
    const SENSITIVE_SUFFIX = /(token|secret|password|apikey)$/;

    for (const key of Object.keys(redacted)) {
      const n = normalize(key);
      if (redactSet.has(n) || SENSITIVE_SUFFIX.test(n)) {
        redacted[key] = '[REDACTED]';
      }
    }

    // Recursively redact nested plain objects and array elements (FINDING-007)
    for (const [key, value] of Object.entries(redacted)) {
      if (redacted[key] === '[REDACTED]' || value === null || typeof value !== 'object') {
        continue;
      }
      if (visited.has(value)) {
        continue;
      }
      if (Array.isArray(value)) {
        visited.add(value);
        redacted[key] = value.map((item: unknown) =>
          typeof item === 'object' && item !== null && !visited.has(item)
            ? this.redactSensitiveFields(item as LogContext, visited)
            : item
        );
      } else {
        redacted[key] = this.redactSensitiveFields(value as LogContext, visited);
      }
    }

    return redacted;
  }

  /**
   * Public redaction entry points (BUG-026): let wrappers that forward data to
   * third parties (e.g. the browser preset's errorTracker path) run the same
   * redaction pipeline the console/JSON paths get.
   */
  redactContext(context: LogContext): LogContext {
    return this.redactSensitiveFields(context);
  }

  sanitizeMessage(message: string): string {
    return this.sanitizeErrorMessage(message);
  }

  // =========================================================================
  // Logger interface implementation
  // =========================================================================

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      this.write(this.createEntry('debug', message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      this.write(this.createEntry('info', message, context));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog('warn')) {
      this.write(this.createEntry('warn', message, context));
    }
  }

  error(message: string, error?: unknown, context?: LogContext): void {
    if (this.shouldLog('error')) {
      this.write(this.createEntry('error', message, context, error));
    }
  }

  // =========================================================================
  // ExtendedLogger interface implementation
  // =========================================================================

  child(context: LogContext): ExtendedLogger {
    // LOG-API-001: Use delegation pattern instead of creating full clone
    // This avoids duplicating adapters and allows shared state with parent
    return new DelegatingLogger(this, context);
  }

  setContext(context: LogContext): void {
    this.globalContext = { ...this.globalContext, ...context };
  }

  time(label: string): () => number {
    const start = typeof performance !== 'undefined' ? performance.now() : Date.now();

    return () => {
      const end = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const duration = end - start;
      this.debug(`${label}: ${duration.toFixed(2)}ms`, { duration, label });
      return duration;
    };
  }

  async timeAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const end = this.time(label);
    try {
      return await fn();
    } finally {
      end();
    }
  }
}

/**
 * LOG-API-001: Delegating logger for child() calls
 *
 * Instead of cloning the parent logger (which duplicates adapters),
 * this class delegates all write() calls to the parent while merging
 * its own context. Benefits:
 * - Shared adapter instance (no memory overhead)
 * - Parent config changes automatically apply to children
 * - Nested children form a chain of context merging
 */
class DelegatingLogger implements ExtendedLogger {
  constructor(
    private parent: BaseLogger,
    private childContext: LogContext
  ) {}

  debug(message: string, context?: LogContext): void {
    this.parent.debug(message, this.mergeContext(context));
  }

  info(message: string, context?: LogContext): void {
    this.parent.info(message, this.mergeContext(context));
  }

  warn(message: string, context?: LogContext): void {
    this.parent.warn(message, this.mergeContext(context));
  }

  error(message: string, error?: unknown, context?: LogContext): void {
    this.parent.error(message, error, this.mergeContext(context));
  }

  child(context: LogContext): ExtendedLogger {
    // Create a new delegating logger with merged context
    return new DelegatingLogger(this.parent, { ...this.childContext, ...context });
  }

  setContext(context: LogContext): void {
    Object.assign(this.childContext, context);
  }

  // OPT-020: implement timing locally so the emitted entry goes through THIS
  // logger's debug() and carries the child context (requestId etc.) —
  // delegating to the parent lost it, producing uncorrelatable timing lines.
  time(label: string): () => number {
    const start = typeof performance !== 'undefined' ? performance.now() : Date.now();

    return () => {
      const end = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const duration = end - start;
      this.debug(`${label}: ${duration.toFixed(2)}ms`, { duration, label });
      return duration;
    };
  }

  async timeAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const end = this.time(label);
    try {
      return await fn();
    } finally {
      end();
    }
  }

  private mergeContext(context?: LogContext): LogContext {
    return context ? { ...this.childContext, ...context } : this.childContext;
  }
}

/**
 * Standalone implementation of core Logger interface (simple version)
 *
 * Use this when you only need the basic Logger interface without
 * the extended features.
 *
 * @internal No external consumers — prefer `createLibraryLogger` or
 * `createBrowserLogger` for most use cases.
 */
export function createSimpleLogger(
  writeFn: (entry: LogEntry) => void,
  config: Partial<LoggerConfig> = {}
): Logger {
  class SimpleLogger extends BaseLogger {
    protected write(entry: LogEntry): void {
      writeFn(entry);
    }
  }

  return new SimpleLogger(config);
}
