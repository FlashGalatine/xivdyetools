# FINDING-026: `@xivdyetools/logger` — circular/BigInt payloads crash the request inside `write()`, redaction gaps, raw stack re-attached in the browser preset

## Severity
**LOW** — reliability and secret-hygiene weaknesses in a cross-cutting dependency (every worker and the web app). Reviewer IDs: PKG-3, PKG-4, PKG-5 (executed by the reviewer against `dist/`).

## Category
CWE-248 Uncaught Exception · CWE-532 Insertion of Sensitive Information into Log File

## Location
- `packages/logger/src/core/base-logger.ts:196-241` + `adapters/json-adapter.ts:43` — the cycle guard leaves back-references, so `JSON.stringify` in `write()` throws (also on `BigInt`) — a log call can fail the request that made it.
- `packages/logger/src/core/base-logger.ts:66-70, 121-125, 209-218` — the `message` argument is never sanitised; non-`Error` throws are logged unsanitised; keys like `privateKey`, `setCookie`, `webhookUrl`, `authHeader` are not in the redaction list; no value-shape scan (e.g. `eyJ…` JWTs, `Bearer …` inside arbitrary values).
- `packages/logger/src/presets/browser.ts:113-117` — the `errorTracker` path re-attaches raw `error.stack` (first line = unsanitised message); latent, no consumer passes a tracker today.

## Recommendation
Use a `WeakSet`-based replacer that drops cycles and stringifies BigInt; wrap the final `JSON.stringify` in try/catch with a fallback payload; sanitise `message` and non-Error values with the same redactor; extend key patterns and add a value-shape pass for JWT/Bearer/Discord-token shapes; sanitise before handing to `errorTracker`.

## References
- Evidence: `../evidence/review-packages.md` (PKG-3..5)

## Status
**FIXED 2026-08-21** — `@xivdyetools/logger` (Unreleased): `safeStringify` in `JsonAdapter.write` (cycles/BigInt never throw), `message` and non-Error throws sanitised, redact list extended (privateKey/setCookie/webhookUrl/authHeader/sessionId/…), value-shape redaction (`Bearer …`, JWTs, Discord tokens, long hex), browser `errorTracker` stack sanitised.
