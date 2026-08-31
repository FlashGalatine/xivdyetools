/**
 * @xivdyetools/logger - Base Logger
 *
 * Abstract base class implementing common logging functionality.
 *
 * @module core/base-logger
 */

import type { ExtendedLogger, LogContext, LogEntry, LogLevel, LoggerConfig } from '../types.js';
// LOGGER-REF-003 FIX: Import from centralized constants
import { DEFAULT_REDACT_FIELDS } from '../constants.js';

/** Log levels in order of severity (for filtering) */
const LOG_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];

/**
 * S10-R8 (2026-08-30 fix round 1): redaction recursion state for ONE
 * top-level log call, threaded through `redactSensitiveFields` /
 * `redactArrayItems`.
 *
 * `ancestors` is an ANCESTOR set — nodes currently on the recursion path —
 * not a "seen anywhere" set. A node is added right before recursing into
 * its children and removed right after (in a `finally`), so a genuine
 * cycle (a node reachable from itself) is still caught, but a value
 * ALIASED from two sibling branches (`{ a: shared, b: shared }`) is
 * redacted at every reference instead of only the first. The previous
 * global "seen anywhere" `WeakSet` (BUG-024) prevented infinite recursion
 * the same way but had exactly this leak: the second reference to an
 * aliased value was skipped as "already visited" and returned unredacted —
 * `FINDING-025`'s own headline example (`{ tokens: [...] }`) leaked at the
 * second reference whenever the array was aliased.
 *
 * `budget` bounds total node visits across the whole call. Removing the
 * global dedup means a heavily-ALIASED-but-acyclic structure (the same
 * child referenced from both branches at every level of a binary chain) is
 * now walked once per path to it — exponential in depth. The budget makes
 * a pathological structure degrade safely (stop descending once
 * exhausted, leaving the un-walked remainder as-is — the same "leave it
 * alone" posture already used for a detected cycle) instead of hanging.
 */
interface RedactionGuard {
  ancestors: WeakSet<object>;
  budget: { remaining: number };
}

/**
 * S10-R8: total node-visit budget for one top-level redaction call. Sized
 * generously for any real log context (dozens to low hundreds of nested
 * fields) while keeping a pathological structure's worst case bounded to a
 * small, fast, constant amount of work instead of the exponential blowup
 * an ancestor-only guard would otherwise allow.
 */
const MAX_REDACT_NODES = 5000;

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
      redactFields: [...DEFAULT_REDACT_FIELDS, ...(config.redactFields ?? [])],
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
    error?: unknown,
  ): LogEntry {
    // FINDING-026 (2026-08-21 audit): the free-text message goes through the
    // same redaction as error messages — callers interpolate upstream errors
    // and request data into it just as readily
    const safeMessage = this.config.sanitizeErrors ? this.sanitizeErrorMessage(message) : message;
    const entry: LogEntry = {
      level,
      message: this.config.prefix ? `[${this.config.prefix}] ${safeMessage}` : safeMessage,
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

    // Handle non-Error objects — FINDING-026: sanitised like Error messages
    // (a thrown string or object frequently carries the upstream payload)
    const raw = typeof error === 'string' ? error : safeStringify(error);
    return {
      name: 'Unknown',
      message: this.config.sanitizeErrors ? this.sanitizeErrorMessage(raw) : raw,
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

    return (
      message
        // Bearer tokens - typically single tokens without spaces
        .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
        // FINDING-025 (2026-08-29 audit): the value-SHAPE scan reaches free
        // text too, for a bare token with no key name in front of it
        // ("refresh failed for eyJhbGci…"). Only the two `\b`-delimited
        // SUBSTRING patterns below are safe here — a match redacts just the
        // token span and leaves the rest of the sentence diagnosable
        // ("refresh failed for [REDACTED] at 12:04"). The other two
        // SECRET_VALUE_PATTERNS entries are deliberately NOT reused: Bearer
        // is already fully handled by the line above (a real global
        // substring replace, unlike the ^-anchored whole-value pattern this
        // scan otherwise uses), and HEX64_VALUE_PATTERN is a whole-value
        // verdict — see its comment for why running it over free text would
        // be a false-positive risk (sha256 hashes, cache keys) this package
        // cannot afford.
        // S10-R11 (2026-08-30 fix round 1): preserve the source pattern's
        // own flags (both are flagless today) instead of hardcoding 'g' —
        // a future 'i'/'u' added to either pattern would otherwise silently
        // not apply here, defeating the "can't drift" guarantee above.
        .replace(new RegExp(JWT_VALUE_PATTERN.source, JWT_VALUE_PATTERN.flags + 'g'), '[REDACTED]')
        .replace(
          new RegExp(DISCORD_TOKEN_VALUE_PATTERN.source, DISCORD_TOKEN_VALUE_PATTERN.flags + 'g'),
          '[REDACTED]',
        )
        // BUG-025: JSON-shaped pass — catches every "…token"/"…secret"/"…password"/
        // "…key"-suffixed quoted key in one sweep, including compound names
        // (sessionToken, webhook_secret) that the per-key patterns below miss.
        .replace(
          /"([a-z0-9_-]*(?:token|secret|password|key))"\s*:\s*"[^"]*"/gi,
          '"$1":"[REDACTED]"',
        )
        // Key=value patterns - handle quoted and unquoted values
        // Matches: key="value with spaces" or key='value' or key=value until delimiter
        .replace(new RegExp(`${K('token')}${V}`, 'gi'), 'token=[REDACTED]')
        .replace(new RegExp(`${K('secret')}${V}`, 'gi'), 'secret=[REDACTED]')
        .replace(new RegExp(`${K('password')}${V}`, 'gi'), 'password=[REDACTED]')
        .replace(new RegExp(`${K('api[_-]?key')}${V}`, 'gi'), 'api_key=[REDACTED]')
        // Additional common sensitive patterns
        // Use negative lookahead to skip "Authorization: Bearer ..." which is handled by Bearer pattern
        .replace(
          new RegExp(`["']?authorization["']?\\s*[=:]\\s*(?!Bearer\\s)${V}`, 'gi'),
          'authorization=[REDACTED]',
        )
        .replace(new RegExp(`${K('access[_-]?token')}${V}`, 'gi'), 'access_token=[REDACTED]')
        .replace(new RegExp(`${K('refresh[_-]?token')}${V}`, 'gi'), 'refresh_token=[REDACTED]')
        // FINDING-005: Additional patterns for OAuth, crypto keys, and webhook secrets
        .replace(new RegExp(`${K('client[_-]?secret')}${V}`, 'gi'), 'client_secret=[REDACTED]')
        .replace(new RegExp(`${K('private[_-]?key')}${V}`, 'gi'), 'private_key=[REDACTED]')
        .replace(
          new RegExp(`${K('signing[_-]?(?:key|secret)')}${V}`, 'gi'),
          'signing_key=[REDACTED]',
        )
        .replace(new RegExp(`${K('webhook[_-]?secret')}${V}`, 'gi'), 'webhook_secret=[REDACTED]')
        .replace(new RegExp(`${K('auth[_-]?token')}${V}`, 'gi'), 'auth_token=[REDACTED]')
        .replace(new RegExp(`${K('credential[s]?')}${V}`, 'gi'), 'credentials=[REDACTED]')
    );
  }

  /**
   * Redact sensitive fields from context
   *
   * FINDING-008: recursively walks nested objects and arrays to redact
   * sensitive fields/values at any nesting level, not just top-level. This
   * comment used to say "up to MAX_REDACT_DEPTH" — stale even before this
   * fix; BUG-024 (2026-07-18 audit) already replaced that fixed depth cap
   * with a cycle guard. S10-R10 (2026-08-30 fix round 1): corrected here to
   * match reality and the parallel correction in this package's CLAUDE.md.
   *
   * S10-R8 (2026-08-30 fix round 1): the guard is an ANCESTOR set (nodes on
   * the current recursion path), not a global "seen anywhere" set — see
   * `RedactionGuard`'s doc comment for why that distinction is the fix (a
   * value aliased from two sibling keys used to be redacted only at its
   * first reference, leaking the second verbatim).
   */
  protected redactSensitiveFields(context: LogContext, guard?: RedactionGuard): LogContext {
    const g: RedactionGuard = guard ?? {
      ancestors: new WeakSet<object>(),
      budget: { remaining: MAX_REDACT_NODES },
    };

    if (g.budget.remaining <= 0) {
      // S10-R8: budget exhausted — stop descending and leave this subtree
      // as-is, the same posture already used for a detected cycle below.
      return context;
    }
    g.budget.remaining -= 1;

    g.ancestors.add(context);
    try {
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
          continue;
        }
        // FINDING-026 (2026-08-21 audit): secret-SHAPED values under innocuous
        // keys (a Bearer header pasted into `note`, a JWT in `detail`, a Discord
        // bot token in `raw`) — the key-name list cannot anticipate those.
        const value = redacted[key];
        if (typeof value === 'string' && looksLikeSecretValue(value)) {
          redacted[key] = '[REDACTED]';
        }
      }

      // Recursively redact nested plain objects and array elements (FINDING-007)
      for (const [key, value] of Object.entries(redacted)) {
        if (redacted[key] === '[REDACTED]' || value === null || typeof value !== 'object') {
          continue;
        }
        if (g.ancestors.has(value)) {
          // Genuine cycle on the CURRENT path — leave as-is rather than
          // recursing forever. An aliased-but-acyclic sibling reference is
          // NOT caught here, because by the time we reach it the earlier
          // branch has already popped it from `ancestors` (see `finally`
          // below) — that is what makes S10-R8 work.
          continue;
        }
        if (Array.isArray(value)) {
          redacted[key] = this.redactArrayItems(value, g);
        } else {
          redacted[key] = this.redactSensitiveFields(value as LogContext, g);
        }
      }

      return redacted;
    } finally {
      // Pop this node so a SIBLING branch that aliases the same object
      // (not a descendant of it) sees it as unvisited and redacts it too.
      g.ancestors.delete(context);
    }
  }

  /**
   * FINDING-025 (2026-08-29 audit): give a string array item the same
   * value-shape scan a top-level string field already gets —
   * `logger.warn('x', { tokens: ['eyJ…'] })` used to log the JWT verbatim,
   * because the old array branch recursed only into object items and
   * returned every other item, strings included, unchanged.
   *
   * An item has no key of its own, so the key-name rules (`redactSet` /
   * `SENSITIVE_SUFFIX` above) cannot apply to it — only the value-SHAPE
   * scan (`looksLikeSecretValue`) can, and that is all a string item gets
   * here. (The array's own key — `tokens` in the example above — still
   * goes through the normal key-name check one level up before this ever
   * runs, but verify before assuming that alone is enough: `tokens`
   * normalizes to `tokens`, and `SENSITIVE_SUFFIX` requires the key to
   * literally END in "token" — "tokens" does not, so that key is NOT
   * wholesale-redacted upstream. This scan is the only thing that catches
   * it, not a belt-and-suspenders duplicate of the key-name rule.)
   *
   * Also fixes a shape bug in the same recursion: an item that is itself
   * an array is `typeof 'object'`, so it used to be handed to
   * `redactSensitiveFields(item)`, whose `{ ...context }` spread turns an
   * array into a plain object with numeric-string keys —
   * `{ a: [[1, 2]] }` silently logged as `{ a: [{ '0': 1, '1': 2 }] }`.
   * Nested arrays now recurse through this method instead, so array-ness
   * is preserved at every depth.
   *
   * S10-R8 (2026-08-30 fix round 1): shares the same ancestor+budget guard
   * as `redactSensitiveFields` — see `RedactionGuard`'s doc comment. An
   * aliased array (`{ a: arr, b: arr }`) is now redacted at both `a` and
   * `b`, not just the first one reached.
   */
  protected redactArrayItems(items: unknown[], guard: RedactionGuard): unknown[] {
    if (guard.budget.remaining <= 0) {
      return items;
    }
    guard.budget.remaining -= 1;

    guard.ancestors.add(items);
    try {
      return items.map((item: unknown) => {
        if (typeof item === 'string') {
          return looksLikeSecretValue(item) ? '[REDACTED]' : item;
        }
        if (Array.isArray(item)) {
          // `Array.isArray` narrows to `any[]` per the lib types; re-assert
          // as `unknown[]` so the branch doesn't return an implicit `any`.
          const nested = item as unknown[];
          return guard.ancestors.has(nested) ? nested : this.redactArrayItems(nested, guard);
        }
        if (typeof item === 'object' && item !== null && !guard.ancestors.has(item)) {
          return this.redactSensitiveFields(item as LogContext, guard);
        }
        return item;
      });
    } finally {
      guard.ancestors.delete(items);
    }
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
    private childContext: LogContext,
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

// ===========================================================================
// FINDING-026 (2026-08-21 security audit) helpers
// ===========================================================================

/**
 * Value shapes that are secrets regardless of the key they hang off, used
 * WHOLE-VALUE by `looksLikeSecretValue()` below (a field or array item that
 * IS one of these, in full, gets redacted). Named individually because two
 * of the four are also reused as free-text SUBSTRING matchers in
 * `sanitizeErrorMessage` — see the FINDING-025 comments on each.
 */
const BEARER_VALUE_PATTERN = /^\s*Bearer\s+\S+/i;
/**
 * Three-part JWT (header.payload.signature). `\b`-delimited with no `^`/`$`
 * anchor, so it already behaves as a substring matcher: FINDING-025
 * (2026-08-29 audit) reuses its `.source` with a `g` flag in
 * `sanitizeErrorMessage` to redact a bare JWT inside free text while
 * leaving the surrounding prose intact.
 */
const JWT_VALUE_PATTERN = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/;
/**
 * Discord bot token (base64 snowflake . 6-char timestamp . 27+ char HMAC).
 * Same `\b`-delimited, unanchored shape as the JWT pattern — FINDING-025
 * reuses it the same way for free text.
 */
const DISCORD_TOKEN_VALUE_PATTERN = /\b[MN][A-Za-z\d]{23,}\.[\w-]{6}\.[\w-]{27,}\b/;
/**
 * 64+ hex chars, anchored `^...$` on purpose: a FIELD or ARRAY ITEM that IS
 * one of these end-to-end is almost certainly a raw secret (API key,
 * signing key). FINDING-025 (2026-08-29 audit): deliberately NOT reused for
 * free text — a 64-hex SUBSTRING inside a log message is far more likely a
 * sha256 content hash, an artifact digest, or a cache key than a secret,
 * and this package redacts OTHER people's log output, so eating a
 * legitimate hash out of a message is its own defect, not a safe default.
 */
const HEX64_VALUE_PATTERN = /^[A-Fa-f0-9]{64,}$/;

const SECRET_VALUE_PATTERNS: RegExp[] = [
  BEARER_VALUE_PATTERN,
  JWT_VALUE_PATTERN,
  DISCORD_TOKEN_VALUE_PATTERN,
  HEX64_VALUE_PATTERN,
];

/** @internal */
export function looksLikeSecretValue(value: string): boolean {
  return SECRET_VALUE_PATTERNS.some((re) => re.test(value));
}

/**
 * JSON.stringify that never throws: cycles become `"[Circular]"`, BigInt
 * becomes its decimal string, and anything else that refuses to serialise is
 * replaced rather than failing the log call (and with it, the request).
 */
export function safeStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  try {
    const json = JSON.stringify(value, (_key, v: unknown) => {
      if (typeof v === 'bigint') return v.toString();
      if (typeof v === 'object' && v !== null) {
        if (seen.has(v)) return '[Circular]';
        seen.add(v);
      }
      return v;
    });
    // JSON.stringify(undefined) / functions / symbols yield undefined
    return json ?? String(value);
  } catch (error) {
    return JSON.stringify({
      level: 'error',
      message: 'log entry could not be serialised',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
