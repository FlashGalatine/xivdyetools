/**
 * @xivdyetools/logger - Base Logger
 *
 * Abstract base class implementing common logging functionality.
 *
 * @module core/base-logger
 */

import type { ExtendedLogger, LogContext, LogEntry, LogLevel, LoggerConfig } from '../types.js';
// LOGGER-REF-003 FIX: Import from centralized constants
import { CORE_REDACT_FIELDS } from '../constants.js';

/** Log levels in order of severity (for filtering) */
const LOG_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];

/**
 * What a cycle becomes in a redacted context (BUG-004).
 *
 * The same marker `safeStringify` writes for a back-edge, so a cyclic context
 * reads identically whether the cycle was caught during redaction or during
 * serialisation. Returning the raw node instead — which is what the guards
 * used to do — re-inserted an UNREDACTED subtree into the redacted copy.
 */
const CIRCULAR_SENTINEL = '[Circular]';
const UNSERIALIZABLE_SENTINEL = '[Unserializable]';

/** Case-insensitive, separator-insensitive form of a key name (BUG-024). */
function normalizeRedactKey(key: string): string {
  return key.toLowerCase().replace(/[_-]/g, '');
}

/** Compound key names the explicit list cannot enumerate (BUG-024). */
const SENSITIVE_SUFFIX = /(token|secret|password|apikey)$/;

const NO_TO_JSON = Symbol('no-usable-toJSON');

/**
 * BUG-141: run a value's `toJSON` (own or inherited) with the key it hangs
 * off, as `JSON.stringify` does. `NO_TO_JSON` when there is none, when it
 * throws (a throwing getter included), or when it hands back the same
 * object; the caller then redacts the value as a plain object.
 */
function callToJson(value: object, key: string): { result: unknown } | typeof NO_TO_JSON {
  try {
    const toJSON = (value as { toJSON?: unknown }).toJSON;
    if (typeof toJSON !== 'function') {
      return NO_TO_JSON;
    }
    const result: unknown = toJSON.call(value, key);
    return result === value ? NO_TO_JSON : { result };
  } catch {
    return NO_TO_JSON;
  }
}

/**
 * S10-R8 (2026-08-30 fix round 1): redaction recursion state for ONE
 * top-level log call, threaded through `redactSensitiveFields` /
 * `redactArrayItems`.
 *
 * `ancestors` is an ANCESTOR set — nodes currently on the recursion path —
 * not a "seen anywhere" set. A node is added right before recursing into
 * its children and removed right after (in a `finally`), so a genuine
 * cycle (a node reachable from itself) is still caught: the callee sees
 * itself in `ancestors` and returns the raw, unprocessed reference instead
 * of recursing forever. The previous global "seen anywhere" `WeakSet`
 * (BUG-024) prevented infinite recursion the same way but had a leak: a
 * value ALIASED from two sibling branches (`{ a: shared, b: shared }`) —
 * not a cycle, just referenced twice — was permanently marked "visited" by
 * the first branch, so the second branch's reference came back unredacted.
 * `FINDING-025`'s own headline example (`{ tokens: [...] }`) leaked exactly
 * this way whenever the array was aliased.
 *
 * `memo` (S10-R12, 2026-08-30 fix round 2) is a `WeakMap` from a node to
 * its FULLY redacted result, populated on the way OUT of
 * `redactSensitiveFields`/`redactArrayItems` — after that node's own
 * children have all been processed, never before. This is what makes
 * aliasing cheap instead of either (a) re-walked on every reference
 * (exponential in an aliased structure's depth — the original motivation
 * for a since-removed node-visit budget) or (b) silently left unscanned
 * past some cutoff, which is what that budget did: it failed OPEN, letting
 * an oversized context emit anything beyond the cutoff completely
 * unredacted — a redaction bypass, not just a performance limit. With
 * memoization every distinct node is processed exactly once, aliased
 * references all resolve to that one (reference-identical) redacted
 * result, and there is no cutoff to fail open past — see the S10-R12
 * CHANGELOG entry for why a belt-and-braces cutoff was judged unnecessary
 * on top of this rather than kept and made fail-closed.
 *
 * Memoizing on the way IN instead (before a node's children are processed)
 * would be wrong: a node reached again through a genuine cycle would then
 * receive its OWN partially-built, not-yet-fully-scanned result instead of
 * being recognised as a cycle and left alone. The `ancestors` check runs
 * first for exactly this reason — a node currently being processed must
 * never be treated as "already memoized".
 */
interface RedactionGuard {
  ancestors: WeakSet<object>;
  memo: WeakMap<object, unknown>;
  /**
   * BUG-141: how many `toJSON` results are currently being walked on this
   * path. A `toJSON` can hand back a fresh object at every level, which
   * neither `ancestors` nor `memo` can ever match, so this bounds it.
   */
  jsonDepth: number;
  /**
   * BUG-141 review: `toJSON` calls made so far in this top-level log call
   * that returned an object or array (see `MAX_TO_JSON_CALLS`). `jsonDepth`
   * bounds depth, not fan-out: a `toJSON` returning two fresh instances per
   * level is 2^depth calls, and `ancestors`/`memo` never match a fresh object.
   */
  jsonCalls: number;
}

/**
 * BUG-141 review: cap on the `toJSON` calls one log call may make whose result
 * is an object or array. Only those are counted, because only they can fan
 * out into more `toJSON` values; a call that returns a string or other
 * primitive (every `Date`, `URL`) is not, and neither is a plain object, an
 * array or, with `sanitizeErrors` on, an `Error`, since no `toJSON` runs for
 * them. Once the count reaches the cap, any further value that has a `toJSON`
 * becomes `'[Truncated]'` without the call (fail closed, never throws). 4096
 * is roughly 10 ms of worst-case fan-out, and a context of thousands of rows
 * that each carry a Date never touches it.
 */
const MAX_TO_JSON_CALLS = 4096;

/** True when `value.toJSON` is a function; a throwing getter counts as true (fail closed). */
function hasToJson(value: object): boolean {
  try {
    return typeof (value as { toJSON?: unknown }).toJSON === 'function';
  } catch {
    return true;
  }
}

/**
 * `value instanceof Error`, failing closed: a Proxy whose `getPrototypeOf` trap
 * throws counts as an Error, so it takes the spread path instead of throwing
 * out of a log call.
 */
function isErrorValue(value: object): boolean {
  try {
    return value instanceof Error;
  } catch {
    return true;
  }
}

/**
 * BUG-141: deepest chain of `toJSON` results one log call will walk. Past it
 * the value becomes `'[Truncated]'` (fail closed): a log call must never throw
 * or run away, and no real `toJSON` nests this deep.
 */
const MAX_TO_JSON_DEPTH = 32;

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
  /**
   * OPT-010: the normalized key-name list, built once from the merged
   * `redactFields` (the Set also dedupes the worker preset's repeated core
   * entries). It used to be rebuilt for every object node of every log call.
   */
  private readonly normalizedRedactFields: ReadonlySet<string>;

  constructor(config: Partial<LoggerConfig> = {}) {
    // FINDING-008: Merge custom redactFields with defaults instead of replacing
    this.config = {
      level: 'info',
      format: 'json',
      timestamps: true,
      sanitizeErrors: true,
      ...config,
      redactFields: [...CORE_REDACT_FIELDS, ...(config.redactFields ?? [])],
    };
    this.normalizedRedactFields = new Set(
      (this.config.redactFields || CORE_REDACT_FIELDS).map(normalizeRedactKey),
    );
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
   * Sanitize error messages to remove potential secrets.
   *
   * The patterns themselves are module scope (`SANITIZE_RULES`) — this used to
   * compile 15 regexes on every call, and it runs once per log line plus once
   * per error message with `sanitizeErrors: true`, the Worker default
   * (OPT-007). All 15 are constant; nothing depended on the arguments. Reuse
   * across calls is safe because every rule is applied through
   * `String.prototype.replace` with a `g` flag, which resets `lastIndex`
   * itself — that would NOT hold for `.exec` / `.test`, which are not used
   * here.
   */
  protected sanitizeErrorMessage(message: string): string {
    return SANITIZE_RULES.reduce<string>(
      (text, [pattern, replacement]) =>
        // Two calls so each matches one `String.prototype.replace` overload.
        typeof replacement === 'string'
          ? text.replace(pattern, replacement)
          : text.replace(pattern, replacement),
      message,
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
   *
   * S10-R12 (2026-08-30 fix round 2): memoized, not budgeted. A node is
   * checked against `ancestors` first (genuine cycle → return the raw,
   * unprocessed reference) and `memo` second (already fully redacted via
   * an earlier, unrelated reference → return that SAME result, so aliases
   * resolve to one reference-identical object). Every distinct node is
   * therefore processed exactly once regardless of how many times it is
   * referenced, which is what makes a heavily-aliased structure cheap
   * without needing a cutoff that could fail open on an oversized one.
   */
  protected redactSensitiveFields(context: LogContext, guard?: RedactionGuard): LogContext {
    const g: RedactionGuard = guard ?? {
      ancestors: new WeakSet<object>(),
      memo: new WeakMap<object, unknown>(),
      jsonDepth: 0,
      jsonCalls: 0,
    };

    if (g.ancestors.has(context)) {
      // Genuine cycle on the CURRENT path — stop rather than recursing
      // forever. This must be checked before `memo`: a node still being
      // processed has no memo entry yet (memoized only on the way OUT,
      // below), so this order is actually load-bearing, not just defensive
      // — see `RedactionGuard`'s doc comment.
      //
      // BUG-004 (deep dive 2026-09-02): this used to `return context` — the
      // RAW, UNREDACTED original node. Everything reachable through the
      // back-edge was then emitted verbatim: given
      // `inner = { token: 'shhh' }; ctx = { items: [inner] }; inner.back = ctx`,
      // the copy of `inner` correctly got `token: '[REDACTED]'`, but
      // `inner.back` handed back the original `ctx` whose `items[0]` is the
      // original `inner` — so the emitted line contained `"token":"shhh"`.
      // `safeStringify` only marks the SECOND back-edge, so it did not save
      // us. The sentinel is the same marker `safeStringify` would have
      // written, and the already-redacted copy is unreachable here anyway.
      return CIRCULAR_SENTINEL as unknown as LogContext;
    }
    const cached = g.memo.get(context);
    if (cached !== undefined) {
      return cached as LogContext;
    }

    g.ancestors.add(context);
    try {
      const redacted = { ...context };

      // BUG-141: the spread copies an OWN `toJSON` function, and
      // `safeStringify` would call it AFTER redaction and emit its return
      // value raw (or fail the whole line if it throws). `JSON.stringify`
      // never re-applies `toJSON` to a `toJSON` result, so this copy must not
      // carry one. Inherited ones are not copied.
      //
      // One hook still survives, unchanged from before BUG-141: a FUNCTION or
      // class value is not an object to the loops below, so it is passed
      // through as-is, and if it carries a `toJSON` (`Object.assign(fn,
      // { toJSON })`, a class with a static `toJSON`), `safeStringify` calls
      // it and emits the result unredacted.
      if (typeof redacted.toJSON === 'function') {
        delete redacted.toJSON;
      }

      // BUG-024: match case-insensitively with separators collapsed, so
      // Token/TOKEN/Authorization/jwtSecret hit the same list entries as
      // token/authorization/jwt_secret; plus a suffix heuristic that catches
      // compound keys like sessionToken/webhookSecret/userPassword. The list
      // itself is normalized once, in the constructor (OPT-010).
      for (const key of Object.keys(redacted)) {
        const n = normalizeRedactKey(key);
        if (this.normalizedRedactFields.has(n) || SENSITIVE_SUFFIX.test(n)) {
          redacted[key] = '[REDACTED]';
          continue;
        }
        // FINDING-026 (2026-08-21 audit): secret-SHAPED values under innocuous
        // keys (a Bearer header pasted into `note`, a JWT in `detail`, a Discord
        // bot token in `raw`) — the key-name list cannot anticipate those.
        // BUG-140: and the free-text pass for a secret EMBEDDED in a longer
        // string (`'upstream said password=hunter2'`), which the whole-value
        // shape check cannot see.
        const value = redacted[key];
        if (typeof value === 'string') {
          redacted[key] = this.scrubString(value);
        }
      }

      // Recursively redact nested plain objects and array elements
      // (FINDING-007). No pre-check against `ancestors`/`memo` needed here
      // (S10-R12) — the callee now does both checks at its own entry, so
      // every nested object/array is simply handed off unconditionally.
      for (const [key, value] of Object.entries(redacted)) {
        if (redacted[key] === '[REDACTED]' || value === null || typeof value !== 'object') {
          continue;
        }
        redacted[key] = this.redactNested(value, key, g);
      }

      // S10-R12: memoize on the way OUT, after every child has been fully
      // processed — never on the way in. Memoizing early would let a node
      // reached again through a genuine CYCLE receive its own
      // partially-built result instead of being recognised as a cycle by
      // the `ancestors` check above.
      g.memo.set(context, redacted);
      return redacted;
    } finally {
      // Pop this node so a SIBLING branch that aliases the same object
      // (not a descendant of it) sees it as unvisited — the ancestors
      // check fails, the memo check (now populated) succeeds instead.
      g.ancestors.delete(context);
    }
  }

  /**
   * BUG-140 (2026-10-04 deep dive): redact one string VALUE (never a key).
   * The whole-value shape verdict runs first (a field that IS a Bearer header,
   * a JWT, a Discord token or a 64+ hex run is replaced outright); otherwise,
   * with `sanitizeErrors` on, the same free-text rules `message` and
   * `error.message` get run over it, so a secret embedded in a longer string
   * is redacted while the surrounding prose stays. A second pass is harmless
   * for every value the rules fully consume (`password=[REDACTED]` re-matches
   * to itself), so a value that is merged and redacted more than once is not
   * mangled. (A value with mixed quote characters, `password="x'y"`, is only
   * partly consumed on the first pass and settles on the second; that quirk
   * is shared with the message path.)
   */
  private scrubString(value: string): string {
    if (looksLikeSecretValue(value)) {
      return '[REDACTED]';
    }
    return this.config.sanitizeErrors ? this.sanitizeErrorMessage(value) : value;
  }

  /**
   * BUG-141 (2026-10-04 deep dive): redact one nested object or array value.
   *
   * The spread copy `redactSensitiveFields` makes turns anything with no own
   * enumerable keys into `{}`, so a `Date` or `URL` was logged as `{}`. A
   * value with a `toJSON` (own or inherited) is therefore serialized first,
   * the way `JSON.stringify` would have, and the RESULT goes through the same
   * redaction as any other value, so a `toJSON` cannot smuggle a secret past
   * it. The one exception is an `Error` while `sanitizeErrors` is on: its
   * `toJSON` is never called and it keeps the spread copy, so no stack can
   * get out (Sprint 12, 2026-10-06). A `toJSON` that throws, or returns the object itself, falls back to
   * the spread copy: a log call must never throw. The original stays in
   * `ancestors` while its result is walked, so a result that points back at
   * it meets the circular sentinel instead of recursing.
   *
   * Non-plain objects are deliberately not skipped: that would bypass key
   * redaction. `memo` is keyed by object identity, so an object aliased under
   * two keys gets `toJSON` called once, with the first key (`JSON.stringify`
   * would call it per key); a `toJSON` that throws is called once and the
   * object then falls back to the spread copy.
   */
  private redactNested(value: object, key: string, g: RedactionGuard): unknown {
    if (Array.isArray(value)) {
      return this.redactArrayItems(value as unknown[], g);
    }
    if (g.ancestors.has(value)) {
      return CIRCULAR_SENTINEL;
    }
    const cached = g.memo.get(value);
    if (cached !== undefined) {
      return cached;
    }

    // With `sanitizeErrors` on, an `Error` never has its `toJSON` called: a
    // `toJSON` can return the stack in any shape (`String(this.stack)`, or
    // nested under another key), and no key-based strip can catch them all.
    // It takes the spread path instead, as it did before BUG-141: own
    // enumerable fields only (an AppError's `code`, `severity`, `name`), no
    // stack and no message. With `sanitizeErrors` off its `toJSON` runs.
    if ((this.config.sanitizeErrors && isErrorValue(value)) || !hasToJson(value)) {
      return this.redactSensitiveFields(value as LogContext, g);
    }
    if (g.jsonCalls >= MAX_TO_JSON_CALLS) {
      return '[Truncated]';
    }
    const serialized = callToJson(value, key);
    if (serialized === NO_TO_JSON) {
      return this.redactSensitiveFields(value as LogContext, g);
    }
    // Counted only when the result is an object or array: that is the only
    // result that can hold further `toJSON` values (fan-out). A Date's string
    // or a primitive ends the chain, so a context of many Dates never counts.
    if (typeof serialized.result === 'object' && serialized.result !== null) {
      g.jsonCalls++;
    }

    if (g.jsonDepth >= MAX_TO_JSON_DEPTH) {
      return '[Truncated]';
    }

    g.ancestors.add(value);
    g.jsonDepth++;
    try {
      let out: unknown = serialized.result;
      try {
        if (typeof out === 'string') {
          out = this.scrubString(out);
        } else if (Array.isArray(out)) {
          out = this.redactArrayItems(out as unknown[], g);
        } else if (typeof out === 'object' && out !== null) {
          out = this.redactSensitiveFields(out as LogContext, g);
        }
      } catch {
        // A result that throws while it is walked (a Proxy whose `ownKeys`
        // trap throws, say) is logged as a sentinel: a log call must never throw.
        out = UNSERIALIZABLE_SENTINEL;
      }
      g.memo.set(value, out);
      return out;
    } finally {
      g.jsonDepth--;
      g.ancestors.delete(value);
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
   * S10-R8 (2026-08-30 fix round 1): shares the same ancestor guard as
   * `redactSensitiveFields` — see `RedactionGuard`'s doc comment. An
   * aliased array (`{ a: arr, b: arr }`) is now redacted at both `a` and
   * `b`, not just the first one reached.
   *
   * S10-R12 (2026-08-30 fix round 2): and the same memo, for the same
   * reason — every distinct array is walked once, aliased references
   * resolve to the one reference-identical redacted result.
   */
  protected redactArrayItems(items: unknown[], guard: RedactionGuard): unknown[] {
    if (guard.ancestors.has(items)) {
      // Genuine cycle — see the matching check in redactSensitiveFields,
      // including why this returns a sentinel rather than the raw array
      // (BUG-004).
      return CIRCULAR_SENTINEL as unknown as unknown[];
    }
    const cached = guard.memo.get(items);
    if (cached !== undefined) {
      return cached as unknown[];
    }

    guard.ancestors.add(items);
    try {
      const redacted = items.map((item: unknown, index: number) => {
        if (typeof item === 'string') {
          return this.scrubString(item);
        }
        if (Array.isArray(item)) {
          // `Array.isArray` narrows to `any[]` per the lib types; re-assert
          // as `unknown[]` so this branch doesn't return an implicit `any`.
          // No pre-check against ancestors/memo needed (S10-R12) — the
          // callee does both at its own entry.
          return this.redactArrayItems(item as unknown[], guard);
        }
        if (typeof item === 'object' && item !== null) {
          return this.redactNested(item, String(index), guard);
        }
        return item;
      });
      guard.memo.set(items, redacted);
      return redacted;
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

  /**
   * @public part of the published `ExtendedLogger` interface's contract —
   * async counterpart to `time()`. No in-repo caller awaits it directly today.
   */
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

  /**
   * @public implements the published `ExtendedLogger` interface's
   * `timeAsync` contract for child loggers created via `child()` — a
   * DelegatingLogger must satisfy the same interface as BaseLogger. No
   * in-repo caller awaits it directly today.
   */
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
 * Three-part JWT (header.payload.signature), as a linear-time scan.
 *
 * The plain pattern, `\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b`,
 * is quadratic: `-` is in the segment class but is not a word character, so
 * `\b` holds before every `eyJ` that follows a `-`, and in a dotless run such
 * as `eyJ-eyJ-eyJ-…` each of those starts scanned to the end of the run. A
 * 100 KB message or context string took about 5 s.
 *
 * Every start inside one run of segment characters has the same tail (the
 * header must end where the run ends, at a `.`), so if the first start in a
 * run fails, the later ones fail too. This scan therefore always consumes the
 * whole run from the first start: the first arm matches a header of 8 or more
 * characters plus an OPTIONAL `.payload.signature` tail, the second arm eats
 * a shorter run. Only a match whose tail (group 1) is present is a JWT; any
 * other match is handed back unchanged. A differential fuzz of 300,000 inputs
 * against the plain pattern gave identical output for both the free-text
 * replace and the whole-value verdict.
 *
 * `g` is set here, so the free-text rule uses it directly; `containsJwt` uses
 * `matchAll`, which clones the regex, so the shared `lastIndex` is never
 * relied on.
 */
const JWT_SCAN =
  /\beyJ(?:[A-Za-z0-9_-]{8,}(\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b)?|[A-Za-z0-9_-]*)/g;

/**
 * True when `value` contains a JWT anywhere: the `looksLikeSecretValue`
 * verdict, unanchored like the plain pattern's `.test` it replaces.
 */
function containsJwt(value: string): boolean {
  for (const m of value.matchAll(JWT_SCAN)) {
    if (m[1] !== undefined) {
      return true;
    }
  }
  return false;
}

/** `JWT_SCAN` replacer: redact a real JWT, hand any other match back unchanged. */
function redactJwtMatch(match: string, tail: string | undefined): string {
  return tail === undefined ? match : '[REDACTED]';
}

/**
 * Discord bot token (base64 snowflake . 6-char timestamp . 27+ char HMAC).
 * `\b`-delimited and unanchored like the JWT scan; FINDING-025 reuses it for
 * free text. Linear as written: its first class has no non-word character, so
 * `\b` can never hold inside its own run (the 2026-10-06 sweep measured it
 * under 25 ms on every adversarial 100 KB input).
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
  DISCORD_TOKEN_VALUE_PATTERN,
  HEX64_VALUE_PATTERN,
];

/** @internal */
export function looksLikeSecretValue(value: string): boolean {
  return containsJwt(value) || SECRET_VALUE_PATTERNS.some((re) => re.test(value));
}

/**
 * `Bearer` is the ONE auth scheme handled as a free-text pass, and the reason
 * it is alone there is worth recording.
 *
 * BUG-005 (deep dive 2026-09-02): `Authorization: Basic dXNlcjpwYXNzd29yZA==`
 * leaked its credential, because only `Bearer` had a dedicated pass and the
 * generic `authorization=` rule's unquoted value arm (`[^\s,;]+`) stopped at
 * the first space — it consumed the scheme word `Basic` and stopped, emitting
 * `authorization=[REDACTED] dXNlcjpwYXNzd29yZA==`. Discord's own `Bot` scheme
 * was the same, rescued only incidentally by `DISCORD_TOKEN_VALUE_PATTERN` when
 * the value happened to look like a Discord token.
 *
 * The first attempt at this fix extended the free-text pass to
 * `Bearer|Basic|Bot|Digest|Token`. That over-redacts badly, because four of
 * those five are ordinary English: it turned oauth's
 * `'XIVAuth token exchange failed'` into `'XIVAuth token [REDACTED] failed'`
 * (`Token` + ` exchange`), and `'bot token missing'` would go the same way.
 * A real oauth test caught it.
 *
 * So the fix lives in the `authorization=` rule instead — where the key name
 * supplies the context that makes a following word unambiguous — and this pass
 * stays `Bearer`-only, a word that is not prose.
 */
const AUTH_SCHEMES = ['Bearer'] as const;
const AUTH_SCHEME_ALT = AUTH_SCHEMES.join('|');

/** A pattern and its replacement: a string, or the JWT scan's replacer. */
type SanitizeRule = readonly [RegExp, string | typeof redactJwtMatch];

/**
 * Every `sanitizeErrorMessage` rule, compiled once (OPT-007).
 *
 * Order is load-bearing: the scheme pass runs before the `authorization=`
 * rule, so `Authorization: Basic …` is already `Basic [REDACTED]` by the time
 * that rule sees it — and the rule's lookahead skips every handled scheme so
 * the scheme word survives.
 */
const SANITIZE_RULES: ReadonlyArray<SanitizeRule> = ((): ReadonlyArray<SanitizeRule> => {
  // Value: a quoted string, or an unquoted run up to the next delimiter.
  const V = `(?:["']([^"']*?)["']|[^\\s,;]+)`;

  // BUG-024/BUG-025: key may itself be quoted (JSON bodies echoed into error
  // messages) and whitespace is allowed on BOTH sides of the separator
  // ("token = abc"). Previously the separator had to immediately follow the
  // key name, so `{"token":"abc"}` and `token = abc` bypassed sanitization.
  const K = (name: string): string => `["']?${name}["']?\\s*[=:]\\s*`;

  // S10-R11 (2026-08-30 fix round 1, refined in fix round 2): add the
  // 'g' flag for a global free-text substring replace without risking a
  // duplicate — `re.flags + 'g'` would throw `SyntaxError: Invalid flags
  // supplied to RegExp constructor 'gg'` at the first call if either
  // source pattern ever gained its own 'g' flag; this line's whole job
  // is preventing future drift, so it has to survive that case too.
  const withGlobalFlag = (re: RegExp): RegExp =>
    new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);

  const keyRule = (name: string, label: string): readonly [RegExp, string] => [
    new RegExp(`${K(name)}${V}`, 'gi'),
    `${label}=[REDACTED]`,
  ];

  return [
    // Auth schemes — the credential is everything after the scheme word.
    [new RegExp(`\\b(${AUTH_SCHEME_ALT})\\s+\\S+`, 'gi'), '$1 [REDACTED]'],
    // FINDING-025 (2026-08-29 audit): the value-SHAPE scan reaches free
    // text too, for a bare token with no key name in front of it
    // ("refresh failed for eyJhbGci…"). Only the two `\b`-delimited
    // SUBSTRING patterns below are safe here — a match redacts just the
    // token span and leaves the rest of the sentence diagnosable
    // ("refresh failed for [REDACTED] at 12:04"). The other two
    // SECRET_VALUE_PATTERNS entries are deliberately NOT reused: the scheme
    // pass above already handles Bearer as a real global substring replace
    // (unlike the ^-anchored whole-value pattern this scan otherwise uses),
    // and HEX64_VALUE_PATTERN is a whole-value verdict — see its comment for
    // why running it over free text would be a false-positive risk (sha256
    // hashes, cache keys) this package cannot afford.
    // Preserve each source pattern's own flags (both are flagless today)
    // instead of hardcoding 'g' — a future 'i'/'u' added to either pattern
    // would otherwise silently not apply here, defeating the "can't drift"
    // guarantee above. The JWT scan carries its own `g` and a replacer that
    // hands back every match that is not a JWT (see `JWT_SCAN`).
    [JWT_SCAN, redactJwtMatch],
    [withGlobalFlag(DISCORD_TOKEN_VALUE_PATTERN), '[REDACTED]'],
    // BUG-141 review: URL userinfo (`scheme://user:password@host`). A `URL`
    // object in a context now logs as its href, so credentials in it must go.
    // Only the password part is replaced; the user name stays diagnosable.
    // The user name may be empty (`redis://:pass@host`).
    //
    // The scheme is capped at 32 characters on purpose. Unanchored and
    // unbounded (`[a-z][a-z0-9+.-]*`), every start position in a long run of
    // scheme characters (letters, hex, base64, `a.a.a.`) scanned to the end of
    // the run and backtracked, so a 100 KB message or context string took
    // 3-8 s instead of milliseconds. Capped, each start does at most 32 steps
    // before it needs `://`. No `\b`: `foohttps://u:p@h` still matches from
    // inside the word, as the unbounded rule did, so the output is unchanged
    // for every scheme up to 32 characters (registered schemes are far
    // shorter). A longer one keeps only its last 32 characters as the scheme
    // and is still redacted.
    [/([a-z][a-z0-9+.-]{0,31}:\/\/[^/\s:@]*:)[^@\s/]+@/gi, '$1[REDACTED]@'],
    // BUG-025: JSON-shaped pass — catches every "…token"/"…secret"/"…password"/
    // "…key"-suffixed quoted key in one sweep, including compound names
    // (sessionToken, webhook_secret) that the per-key patterns below miss.
    [/"([a-z0-9_-]*(?:token|secret|password|key))"\s*:\s*"[^"]*"/gi, '"$1":"[REDACTED]"'],
    // Key=value patterns — quoted values, or unquoted up to a delimiter.
    keyRule('token', 'token'),
    keyRule('secret', 'secret'),
    keyRule('password', 'password'),
    keyRule('api[_-]?key', 'api_key'),
    // BUG-005: an `authorization=` value IS the rest of the header, so this
    // one rule consumes to a delimiter or end of line rather than stopping at
    // the first space — which is what let `Basic dXNlcjpwYXNzd29yZA==` keep its
    // credential. Every OTHER key rule still stops at whitespace, so an
    // ordinary `token=abc failed at 12:04` stays diagnosable; only here is the
    // whole tail known to belong to the value. The lookahead leaves `Bearer` to
    // the dedicated pass above, which keeps that scheme word visible.
    [
      new RegExp(
        // The unquoted arm must not START with whitespace. `\s*` above is
        // greedy but backtracks: with a value arm that accepts a leading
        // space, `\s*` can match zero characters, which moves the lookahead
        // off the scheme word and onto the space — where it trivially
        // succeeds, and `Authorization: Bearer x` gets swallowed whole. The
        // old `[^\s,;]+` arm was immune by accident; this one has to say so.
        `["']?authorization["']?\\s*[=:]\\s*(?!(?:${AUTH_SCHEME_ALT})\\s)(?:["']([^"']*?)["']|[^\\s,;][^\\n,;]*)`,
        'gi',
      ),
      'authorization=[REDACTED]',
    ],
    keyRule('access[_-]?token', 'access_token'),
    keyRule('refresh[_-]?token', 'refresh_token'),
    // FINDING-005: Additional patterns for OAuth, crypto keys, and webhook secrets
    keyRule('client[_-]?secret', 'client_secret'),
    keyRule('private[_-]?key', 'private_key'),
    keyRule('signing[_-]?(?:key|secret)', 'signing_key'),
    keyRule('webhook[_-]?secret', 'webhook_secret'),
    keyRule('auth[_-]?token', 'auth_token'),
    keyRule('credential[s]?', 'credentials'),
  ];
})();

/**
 * S10-R18 (2026-08-30 fix round 4): total replacer-invocation budget for
 * one `safeStringify` call. See the long comment on `safeStringify` for
 * why this is a fail-CLOSED bound and why that makes it a different tool
 * from the fail-open redaction budget S10-R12 removed, not a reversal of
 * that decision. Sized to comfortably clear any legitimate log payload
 * (tens of thousands of distinct fields would already be an unusual log
 * line) while keeping a maximally-shared, deeply-aliased structure's worst
 * case bounded to a small, fast, constant amount of work — at ~2^17 paths
 * a heavily-aliased binary chain is already emitting hundreds of KB
 * unbounded; this stops well short of that.
 */
const MAX_STRINGIFY_NODES = 50_000;

/**
 * JSON.stringify that never throws: cycles become `"[Circular]"`, BigInt
 * becomes its decimal string, and anything else that refuses to serialise is
 * replaced rather than failing the log call (and with it, the request).
 *
 * S10-R14 (2026-08-30 fix round 3): the cycle-detection stack is
 * PATH-SCOPED, not a "seen anywhere" set — the same distinction S10-R8 made
 * for redaction, one layer down at serialisation time. `JSON.stringify`'s
 * replacer only fires "entering a value" events; there is no explicit
 * "leaving a value" callback, so path-scoping has to be reconstructed
 * rather than tracked directly. The trick (the same one the long-standing
 * `json-stringify-safe` npm package uses — reimplemented here, not
 * depended on, per the "no new dependencies" constraint): inside the
 * replacer, `this` is always the object/array that directly CONTAINS the
 * key currently being visited, and `JSON.stringify` calls the replacer in
 * strict pre-order depth-first sequence. So finding `this` in `stack` and
 * truncating everything past it reconstructs "how far back up the tree
 * we've returned since the last call" — anything deeper in `stack`
 * belonged to a sibling branch that has already finished serialising and
 * can be discarded.
 *
 * Why this needed fixing at S10-R14: S10-R12 made `redactSensitiveFields`
 * memoize aliased references onto the SAME redacted object, so
 * `{ a: shared, b: shared }` now really does hand this function the
 * identical object twice. The previous "seen anywhere" `WeakSet` —
 * harmless while every reference was still a distinct object,
 * pre-memoization — started reading the second, legitimate reference as a
 * cycle and replacing it with `"[Circular]"`: a regression that failed
 * CLOSED (data dropped, nothing leaked) rather than open, but one that
 * would have shipped every deployed Worker silently mangling repeated
 * (not circular) data on the `JsonAdapter.write` path.
 *
 * S10-R18 (2026-08-30 fix round 4): fixing THAT introduced a second,
 * sharper problem. Memoization guarantees the redacted tree is *maximally
 * shared* — a value referenced 1000 times in the source is referenced
 * 1000 times, by the SAME object, in the redacted output. Path-scoped
 * detection is correct about NOT treating that sharing as a cycle, but
 * `JSON.stringify` has no concept of "already emitted this subtree" — it
 * walks the object graph exactly as given, so a shared subtree gets
 * walked AND EMITTED once per PATH that reaches it, not once per distinct
 * node. For a tree that just happens to have some repeated references,
 * that's a modest constant-factor cost. For the pathological case this
 * package's OWN S10-R12 test constructs on purpose — a binary chain where
 * each level aliases the SAME child from both of its own keys — path
 * count is exponential in depth (2^40 for the 40-level chain), and
 * measured serialisation time/output tracks that: 3ms/147KB at 12 levels,
 * 608ms/~37MB at 20, no measured completion at 40. The redaction step
 * itself stays fast (memoized, linear) — this is purely a serialisation-time
 * cost, and the reason it's new: before S10-R12, no maximally-shared tree
 * ever reached this function to expand; before S10-R14, the (wrong)
 * global seen-set accidentally bounded it by treating every repeat as
 * `"[Circular]"`.
 *
 * `MAX_STRINGIFY_NODES` bounds this the same way S10-R12 removed a budget
 * from the OTHER side of this file — but it is not a reversal of that
 * decision, because what exhaustion COSTS is the opposite here. In
 * `redactSensitiveFields`, stopping early meant emitting the remainder
 * UNSCANNED — real, possibly-secret data the redaction passes never
 * touched. That is a leak, and a fail-open budget is never an acceptable
 * tool for it. Here, by the time anything reaches `safeStringify` it has
 * ALREADY been through the redaction pass in full (these are two
 * sequential steps, not one) — there is no unredacted data anywhere in
 * this function's input, regardless of where serialisation stops. Cutting
 * off here can only drop already-safe data from the emitted log line —
 * diagnostics, not secrets. So this bound fails CLOSED: past the limit,
 * every remaining value (object, array, or primitive) becomes the literal
 * string `"[Truncated]"` instead of being walked further, rather than
 * either hanging or emitting anything raw.
 */
export function safeStringify(value: unknown): string {
  // `stack[i]` is the ancestor object/array at depth `i` on the branch
  // currently being serialised. Primitives never enter it — only an
  // object/array can be an ancestor, so there is nothing to track for one.
  const stack: unknown[] = [];
  let nodesRemaining = MAX_STRINGIFY_NODES;
  try {
    const json = JSON.stringify(value, function (this: unknown, _key, v: unknown) {
      // S10-R18: checked first and unconditionally — once exhausted,
      // EVERY further value (object, array, or primitive) is truncated,
      // so the output never has a confusing mix of "some data past the
      // cutoff, some not". Safe to do for any value type because nothing
      // reaching this function is ever unredacted (see the comment above).
      if (nodesRemaining <= 0) {
        return '[Truncated]';
      }
      nodesRemaining -= 1;
      if (typeof v === 'bigint') return v.toString();
      if (typeof v !== 'object' || v === null) {
        return v;
      }
      if (stack.length === 0) {
        // First call: `this` is JSON.stringify's own internal wrapper
        // object, which can never appear in `stack` — just seed it with
        // the root value we're about to enter.
        stack.push(v);
        return v;
      }
      const thisPos = stack.indexOf(this);
      if (thisPos === -1) {
        // Should not happen once seeded (every later `this` is a value
        // this function already returned), but fail safe by extending
        // rather than losing track of the current path.
        stack.push(this);
      } else {
        // Back up (or across) the tree to `this`'s depth — anything past
        // it belonged to a sibling branch that has already finished.
        stack.splice(thisPos + 1);
      }
      if (stack.indexOf(v) !== -1) {
        // `v` is its own ancestor on THIS path — a genuine cycle.
        return '[Circular]';
      }
      stack.push(v);
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
