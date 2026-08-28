# FINDING-017: presets-api ban check fails open on D1 error and is not applied to several mutating routes; bans are per-identity

## Severity
**LOW** — banned users retain some write paths; fail-open is a design choice that should be deliberate. Reviewer ID: PAPI-9. Coordinator-verified (`ban-check.ts:82-86, 155-158` catch → `next()`).

## Category
CWE-636 Not Failing Securely · CWE-862 Missing Authorization

## Location
- `apps/presets-api/src/middleware/ban-check.ts:82-86, 155-158` — `catch { console.error(...) }` then `next()` / `return null`.
- Not applied on `DELETE /presets/:id` (`handlers/presets.ts:227`), `DELETE /votes/:id` (`votes.ts:183`), preview-image routes and `refresh-author` (`presets.ts:821`).
- `banned_users` keyed by `discord_id` **or** `xivauth_id` separately (MOD-14) — a user banned under one identity can act under the other.

## Recommendation
Fail closed for mutations when the ban lookup errors (503), apply `requireNotBanned` to every mutating route via the router, and ban by local user id so both identities are covered.

## References
- Evidence: `../evidence/review-presets-api.md` (PAPI-9), `../evidence/review-moderation-worker.md` (MOD-14)

## Status
**FIXED 2026-08-21** (presets-api 2.1.0)
- presets-api 2.1.0: ban lookup fails CLOSED (503 `SERVICE_UNAVAILABLE`) everywhere except `ENVIRONMENT=development`; `requireNotBanned` registered once per router for every mutating method (newly covered: DELETE preset, PATCH refresh-author, DELETE preview-image, DELETE vote); throwing-lookup tests replace the vacuous ones. Deferred: cross-identity (`xivauth_id`) bans need oauth/moderation changes.
