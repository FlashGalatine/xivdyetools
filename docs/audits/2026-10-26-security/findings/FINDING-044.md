# FINDING-044: Logger: a non-Error `error` argument skips key-name redaction (cookie, session_id, webhook_url, set_cookie, auth_header, nested keys)
**Severity:** INFO · **Exposure:** INTERNAL · **Deploy unit:** logger (published @xivdyetools/logger; consumed by every worker via worker-kit, plus discord/moderation/stoat directly) · **Rotation:** NONE · **Policy:** NONE · **CWE:** n/a

## Location
- `packages/logger/src/core/base-logger.ts:277` — Logger: a non-Error `error` argument skips key-name redaction (cookie, session_id, webhook_url, set_cookie, auth_header, nested keys)
- `packages/logger/src/core/base-logger.ts:268` — Logger: a non-Error `error` argument skips key-name redaction (cookie, session_id, webhook_url, nested keys)

## Evidence
- base-logger.ts:277-281: `const raw = typeof error === 'string' ? error : safeStringify(error); return { name: 'Unknown', message: this.config.sanitizeErrors ? this.sanitizeErrorMessage(raw) : raw };`
- Reach: A Worker code path calls `logger.error(msg, <plain object>)`, or catches a thrown non-Error object, and passes it in the `error` slot. createEntry (base-logger.ts:231-232) sends it to formatError, whose non-Error branch (:277-281) runs safeStringify and then only the free-text SANITIZE_RULES, never redactSensitiveFields.
- Confirmed at base-logger.ts:275-281 (the reviewer cited 268, which is the stack check in the Error branch). Free-text rules still catch quoted keys ending in token/secret/password/key (:952), plus authorization and the other key=value rules. Keys such as cookie, set_cookie, session_id, webhook_url and auth_header (CORE_REDACT_FIELDS) are emitted verbatim, while the same object passed as context is redacted. The cited call sites (discord-worker index.ts:319/:916, moderation-worker :239, presets-api retention-job.ts:86, stoat-worker index.ts:70) are actually all `logger.error(msg, {ctx})` with harmless values, and the web-app wrapper… Preconditions: A developer or upstream library passes or throws a non-Error object that carries a cookie, session_id, webhook_url, set_cookie or auth_header key. No current in-repo call site does this with sensitive values. Output goes only to console / wrangler tail, since Workers Logs are disabled.
- Live state the repo cannot show: Whether Workers Logs / Logpush are truly off in the Cloudflare dashboard. The repo pins [observability] enabled=false and the workers:check-logs gate enforces it.

## Fix
- In formatError's non-Error branch, run a plain object through redactSensitiveFields (the full context pipeline) before safeStringify, so the key-name list and SENSITIVE_SUFFIX apply. Optionally fix the five call sites to `logger.error(msg, undefined, ctx)`. Add a test pinning cookie/session_id/nested keys in the error slot.

## Status
OPEN
