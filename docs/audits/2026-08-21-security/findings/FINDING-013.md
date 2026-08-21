# FINDING-013: XIVAuth linking — unverified character names become usernames, account merge trusts IdP-asserted Discord link, PII in production logs

## Severity
**LOW** (PLAUSIBLE) — impersonation/confusion and privacy hygiene rather than access control breaks. Reviewer IDs: OAUTH-7, OAUTH-8, OAUTH-9.

## Category
CWE-287 Improper Authentication (identity assertion trust) · CWE-532 Insertion of Sensitive Information into Log File

## Location
- `apps/oauth/src/handlers/xivauth.ts:269-274, 305-323` — the first (possibly **unverified**) XIVAuth character's name becomes `username`/`global_name`, which presets-api displays as preset author name → character-name impersonation.
- `apps/oauth/src/services/user-service.ts:57-93`, `handlers/xivauth.ts:263-267` — account merge keyed solely on the Discord link asserted by XIVAuth: deletes the other row, keeps a stale `xivauth_id` on re-link, `external_id` unvalidated; the resulting `discord_id` is the presets-api identity and moderator key.
- `apps/oauth/src/handlers/xivauth.ts:134-139, 153-159, 191-197, 226-233, 276-281` — production logs contain XIVAuth id, linked Discord id, username, character name and raw upstream error bodies (no tokens/secrets — verified).

## Recommendation
Only use characters with `verified: true` for display names (fallback to the XIVAuth account name); require an explicit, signed-in confirmation step before merging two local accounts; validate `external_id` shape; drop identifiers from info-level logs (keep a hashed correlation id).

## References
- Evidence: `../evidence/review-oauth.md` (OAUTH-7..9)

## Status
**FIXED 2026-08-21** (oauth 2.7.0)
- oauth 2.7.0: only a verified XIVAuth character becomes `username`/`global_name` (unverified carried as `primary_character{verified:false}`, else an opaque label); the asserted Discord `external_id` must be a snowflake; no identifiers in logs, upstream bodies only in `development`; the silent account merge is removed — a Discord ID owned by another row is left alone (audit event without identifiers), an existing Discord link is never overwritten from an XIVAuth claim.
