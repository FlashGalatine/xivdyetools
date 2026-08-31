# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.1] - 2026-08-30

### Security — 2026-08-29 security audit (FINDING-025)

This finding claimed two gaps; only one was still open — the other (free-text `message`/`error.message` sanitization) was already fixed by FINDING-026 in 2.1.0. What actually changed here:

- **String items inside arrays now get the same value-shape scan a top-level string field already gets.** `logger.warn('x', { tokens: ['eyJ…'] })` used to log the JWT verbatim — the array branch recursed only into object items and returned every other item, strings included, unchanged. A bare item has no key of its own, so this is a value-shape check only (`looksLikeSecretValue`), not the key-name list; it also reaches arrays nested inside arrays.
- **A bare token with no key name in front of it is now redacted inside free text** (`message`, `error.message`, and a non-`Error` throw — all three go through one shared function, so they can't drift). Only the JWT and Discord-bot-token shape patterns are applied here, as `\b`-delimited substring replacements that redact just the matched span and leave the rest of the sentence readable (`refresh failed for [REDACTED] at 12:04`). **The `≥64`-hex pattern is deliberately NOT applied to free text** — unlike the other two patterns it is whole-value-anchored by design, and a 64-hex *substring* inside a log message is far more likely a sha256 content hash, an artifact digest, or a cache key than a secret. If your logs legitimately contain long hex strings in prose (not as a dedicated field or array item — those are still caught), they are unaffected by this release.
- **Fixed a shape bug in the same array recursion:** an item that was itself an array (`{ a: [[1, 2]] }`) used to be spread through the object-redaction path's `{ ...context }`, turning it into `{ a: [{ '0': 1, '1': 2 }] }` in the logged output. Nested arrays now stay arrays at every depth.
- **Fixed a pre-existing leak in the same recursion, found reviewing this release (S10-R8): a value aliased from two keys was redacted only at its FIRST reference.** The cycle guard that makes recursive redaction safe was a *global* "seen anywhere" set, so `{ a: shared, b: shared }` (the same object or array referenced from two keys) redacted `a` and returned `b` verbatim — this is FINDING-025's own headline example (`{ tokens: [...] }`) leaking whenever the array happened to be referenced twice. This bug predates this release (it's the same guard BUG-024 introduced in the 2026-07-18 audit) — it isn't something FINDING-025 introduced — but it lived in the method this release rewrote and is exactly the class of leak this audit is about, so it is fixed here rather than filed separately.
- **The fix above went through two designs; only the second shipped (S10-R12).** The first replaced the global set with an ANCESTOR set (tracking only nodes on the current recursion path, so a genuine cycle is still caught but an aliased sibling reference is redacted independently) plus a total node-visit budget, on the reasoning that removing the global dedup makes a heavily-aliased structure exponentially more expensive to walk and something has to bound that. Reviewing *that* design found the budget itself was a bypass, not a safety net: it failed OPEN — `if (budget exhausted) return context unchanged` — so a context whose nested structure exceeded the cutoff (measured at exactly 4998 object/array nodes, deterministic, key-order-dependent) emitted everything past that point **completely unscanned**, silently. A secret nested past the cutoff logged raw. That is a worse defect than the one this release set out to fix, so the budget was removed rather than patched: `redactSensitiveFields`/`redactArrayItems` now **memoize** each node's fully-redacted result (a `WeakMap`, populated only after a node's own children have all been processed) alongside the ancestor set. Every distinct node is processed exactly once regardless of how many times it's referenced — linear work, not exponential — so there is no cutoff to fail open (or closed) past, and nothing is ever emitted unscanned.
- **Behavior change worth knowing about: two aliased references now resolve to the SAME redacted object** (`ctx.a === ctx.b` when both keys held the same reference), not two independently-computed values — and, before this release, the second one was literally the caller's own raw, unredacted object (see the leak above). A consumer that mutates a logged context after the fact, or identity-compares (`===`) values pulled back out of one, could notice the redacted copies are now shared.
- **Still not covered:**
  - A bare 64-hex secret with no key name in front of it inside free text — by design, per the false-positive reasoning above. If you log raw high-entropy hex outside a dedicated field, prefer putting it under a key name so the key-name/value-shape mechanisms can see it.
  - More fundamentally — not new to this release, but easy to over-assume given the free-text reuse above: value-shape detection only recognizes the four specific shapes in `SECRET_VALUE_PATTERNS` (Bearer, a three-part JWT, a Discord *bot* token, and 64+ hex). Any other opaque secret with no recognizable key name nearby — a Discord *webhook* token (68 base64url characters, no dots), an `sk-live-…`-style provider key, or any other random-looking blob matching none of those four shapes — is not caught anywhere (field, array item, or free text) unless it also carries a key name the key-name mechanism recognizes.
  - A detected CYCLE's back-edge still serialises one layer of the ORIGINAL, unredacted object before `JSON.stringify`'s own circularity check catches it — `{ o }` where `o.self = o` logs as `{"o":{"name":"o","password":"[REDACTED]","self":{"name":"o","password":"hunter2","self":"[Circular]"}}}`: the primary occurrence is redacted, but the back-edge (`self`) points at the raw original rather than the redacted copy, so its own fields serialise once, raw, before THAT reference is (correctly) recognised as circular and stopped. Pre-existing since the cycle guard was introduced (2026-07-18 audit) and unchanged by this release — a cycle's back-edge, by construction, always points at a node still being processed, which by construction has no memoized (or otherwise redacted) result yet to use instead. Not fixed here; flagged for anyone relying on cyclic context objects.

### Why this stays a patch release (2.1.1), not a minor bump

Semver decides who receives a fix automatically: a consumer pinned to `~2.1.0` picks up a patch release without any action but does not pick up a minor one. Nothing above changes the public API surface, and for a redaction fix specifically, reaching every consumer beats a tidier version label.

## [2.1.0] - 2026-08-21

### Security — 2026-08-21 security audit (FINDING-026)

- **`write()` can no longer throw out of a log call.** `JsonAdapter` serialises with the new exported `safeStringify()` (cycles → `"[Circular]"`, BigInt → decimal string, anything else that refuses to serialise is replaced); a circular context used to raise `TypeError: Converting circular structure to JSON` and fail the request that logged it.
- **The free-text `message` argument is sanitised** like error messages (`token=…`, `Bearer …`, `password=…` patterns), and non-`Error` throws passed to `error()` are serialised + sanitised instead of `String(error)`.
- **Redaction gaps closed:** `CORE_REDACT_FIELDS` gains `private_key`/`privateKey`, `set_cookie`/`setCookie`, `webhook_url`/`webhookUrl`, `auth_header`/`authHeader`, `session_id`/`sessionId`, `client_secret`, `signing_secret`, `webhook_secret`; and a value-shape pass redacts secret-shaped STRINGS under any key (`Bearer …`, three-part JWTs, Discord bot tokens, ≥64-hex blobs) — `looksLikeSecretValue()` exported for reuse.
- The browser preset's `errorTracker` path sanitises the re-attached `error.stack` (its first line repeats the raw message).

## [2.0.0] - 2026-08-18

2026-08-18 dead-code audit (DEAD-021) — removes three dead/deprecated exports. Major bump: `perf` and `getRequestId(request)` were public surface on the `./browser` and `./worker` subpaths.

### Removed (2026-08-18 dead-code audit)

- **BREAKING**: `perf` (`start`/`end`/`measure`/`measureSync`/`getMetrics`/`getAllMetrics`/`logMetrics`/`clearMetrics`) removed from `presets/browser.ts` and the `./browser` subpath / main barrel. Zero production callers — web-app's `shared/logger.ts` re-exported it but only its own test consumed the re-export. If timing utilities are still needed, use `BaseLogger#time()`/`#timeAsync()` or a dedicated perf tool.
- **BREAKING**: `getRequestId(request: Request)` removed from `presets/worker.ts` and the `./worker` subpath. Already `@deprecated`/`@internal` since 1.2.2 (DEAD-070); the claim that `createRequestLogger` called it internally was false (see the DEAD-070 correction above) — it had zero callers. Every worker already uses worker-kit's `getRequestId(c: Context)` instead.
- `createSimpleLogger` removed from `core/base-logger.ts` and the main barrel. `@internal` since 1.2.2 (DEAD-068) with zero external consumers; use `createLibraryLogger` or `createBrowserLogger`.

### Fixed

- Corrected the false DEAD-070 CHANGELOG claim (see 1.2.2 entry) that `getRequestId` remained in use internally.
- `presets/library.ts` doc examples now import from `@xivdyetools/core` instead of the pre-scope `xivdyetools-core` package name.

## [1.3.0] - 2026-07-19

2026-07-18 audit remediation (Sprint 6) — redaction hardening.

### Fixed

- **BUG-024**: context redaction now matches case-insensitively with separators collapsed (`Token`, `Authorization`, `jwtSecret` all redact), adds a sensitive-suffix heuristic (`…token/…secret/…password/…apikey` catches `sessionToken`, `webhookSecret`, …), and replaces the fixed depth-3 recursion cap with a WeakSet cycle guard so deeply nested secrets are redacted too.
- **BUG-025**: `sanitizeErrorMessage` catches JSON-quoted keys and spaced separators (`{"access_token":"…"}`, `token = …`) plus a JSON-shaped sweep over all sensitive-suffixed quoted keys — the shapes third-party API clients actually emit in error messages.
- **BUG-026**: the browser preset's `errorTracker` path (e.g. Sentry) now redacts context and sanitizes error/warn messages before forwarding; previously the one path where data left the origin bypassed the entire redaction pipeline.
- **OPT-020**: `child()` loggers implement `time()`/`timeAsync()` locally so timing entries carry the child context (`requestId` etc.) and are joinable per request.

### Added

- Public `redactContext(context)` / `sanitizeMessage(message)` on `BaseLogger` for wrappers that forward data to third parties.

### Changed

- **REFACTOR-021**: `BrowserLoggerOptions.devOnly` is actually wired — `devOnly: false` keeps `debug`-level logging in production builds as documented (previously accepted and silently ignored).

## [1.2.2] - 2026-03-01

### Changed

- **DEAD-070**: Deprecated `getRequestId(request: Request)` — superseded by app-local `getRequestId(c: Context)` implementations. Removed from main barrel and `./worker` subpath re-exports; function remained in `worker.ts`, marked `@deprecated` and `@internal`. Correction (2026-08-18 dead-code audit): the comment claiming it stayed "for internal use by `createRequestLogger`" was false — `createRequestLogger` never called it; it had zero callers
- **DEAD-066**: Marked `BaseLogger`, `ConsoleAdapter`, `JsonAdapter`, `NoopAdapter` as `@internal` — implementation details; consumers should use factory functions and pre-configured instances
- **DEAD-067**: Marked `LogEntry` as `@internal` — internal to the write pipeline
- **DEAD-068**: Marked `createSimpleLogger` as `@internal` — no external consumers; prefer `createLibraryLogger` or `createBrowserLogger`
- **DEAD-069**: Marked `createWorkerLogger` as `@internal` — consumers should use `createRequestLogger` instead
- Updated README examples to use `createRequestLogger` instead of deprecated `createWorkerLogger`/`getRequestId` pattern
- Updated `@packageDocumentation` example to show `createRequestLogger` usage

## [1.2.1] - 2026-02-27

### Fixed

- Fix `globalThis` index signature errors in `browser.test.ts` — cast to `Record<string, unknown>` for dynamic property access
- Fix missing `process` type in `browser.test.ts` — added ambient declaration for vitest's Node environment
- Fix `Logger` type mismatch in `library.test.ts` — use `Logger` type for mock service fields

## [1.2.0] - 2026-02-21

### Security

- **FINDING-007**: Recurse into arrays during sensitive field redaction — previously array elements containing secrets were logged unredacted
- **FINDING-008**: Merge custom `redactFields` with defaults instead of replacing — previously custom fields replaced defaults, silently removing protection for `password`, `token`, etc.

### Changed

- Lint fixes and code quality improvements

## [1.1.3] - 2026-02-21

### Changed

- Patch version bump for lint-only changes

## [1.1.2] - 2026-02-06

### Security

- **FINDING-008**: `redactSensitiveFields()` now recursively walks nested objects (up to 3
  levels deep) to redact sensitive fields like `token`, `password`, etc. at any nesting level,
  not just top-level context properties.

### Added

- 5 new tests for recursive redaction (nested objects, depth limit, arrays, null values)

---

## [1.1.1] - 2026-02-06

### Security

- **FINDING-005**: Added 6 new secret redaction patterns to `sanitizeErrorMessage()`:
  `client_secret`, `private_key`, `signing_key`/`signing_secret`, `webhook_secret`, `auth_token`, `credentials`
- Refactored value-matching regex into shared pattern variable for consistency across all redaction rules

---

## [1.1.0] - 2026-01-19

### Fixed

- **LOGGER-BUG-001**: Fixed race condition in `perf.start()` that silently overwrote existing timers with same label. Now warns and returns `false` if timer already active, preventing data loss when concurrent operations use the same label

### Refactored

- **LOGGER-REF-003**: Consolidated hardcoded redact fields to centralized `constants.ts`. Core fields (9) and worker-specific fields (4) now defined in single source of truth with `CORE_REDACT_FIELDS`, `WORKER_SPECIFIC_REDACT_FIELDS`, and `WORKER_REDACT_FIELDS` constants

---

## [1.0.2] - 2025-12-24

### Fixed

- Fixed authorization pattern incorrectly matching "Authorization: Bearer ..." headers
  - Added negative lookahead `(?!Bearer\s)` to skip Bearer token headers
  - Bearer tokens are now correctly handled by the dedicated Bearer pattern

---

## [1.0.1] - 2025-12-24

### Fixed

#### Medium Priority Audit Fixes

- **LOG-ERR-001**: Fixed incomplete secret redaction patterns in `sanitizeErrorMessage`
  - Original patterns stopped at whitespace, potentially leaking partial secrets
  - Now properly handles both quoted (`token="value"`) and unquoted (`token=value`) formats
  - Added missing patterns for `authorization`, `access_token`, and `refresh_token` fields

---

## [1.0.0] - 2025-12-14

### Added

- Initial release of unified logging for xivdyetools ecosystem
- Support for browser, Node.js, and Cloudflare Workers environments
- Preset configurations: `browser`, `worker`, `library`
- Log levels: debug, info, warn, error
- Structured logging with context support
- Sensitive data sanitization
- `NoOpLogger` for silent operation
- `ConsoleLogger` for development
- Full TypeScript support
