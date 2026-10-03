# FINDING-009: apps/web-app/PRIVACY.md Community presets item claims to be part of "the complete list" but omits the 30-day daily submission/edit counters and the moderation-notification failure records that the bot policy discloses
**Severity:** LOW · **Exposure:** INTERNET-UNAUTH · **Deploy unit:** web-app (document); code in presets-api · **Rotation:** NONE · **Policy:** AMEND `apps/web-app/PRIVACY.md` §Network access item 3 — variants: `apps/web-app/PRIVACY.md`, `.ja.md`, `.ko.md`, `.zh.md`, `.de.md`, `.fr.md` · **CWE:** CWE-359
**Reconcile case:** 2 — necessary anti-abuse/ops records; names stores and a retention the web text does not
Scope note: ban / moderation-log records are FINDING-005; the Discord moderation-channel post is FINDING-008.

## Location
- `apps/web-app/PRIVACY.md:10-12,65-74` — "the sections below are the complete list"; item 3 names only the account record, presets/votes, author name, Perspective and preview serving.
- `apps/presets-api/src/services/rate-limit-service.ts:146` — `SUBMISSION_EVENT_RETENTION_DAYS = 30` for (user id, kind, preset id, timestamp) rows in `submission_events`, written for web submissions and edits too.
- `apps/discord-worker/PRIVACY_POLICY.md:104,176-177` — the bot policy already lists "daily submission / edit counters" (30 days) and "moderation-notification failure records" (30 / 90 days) for the same presets-api data.

## Evidence
- A web user's submission writes the same `submission_events` row as a bot user's (`rate-limit-service.ts:79,116`, keyed by the resolved account id), but only the bot document tells its readers so.
- `git grep -n -i -E 'ban|moderat|submission|30 days' -- apps/web-app/PRIVACY.md` finds only the Perspective sentence.

## Fix
- AMEND item 3 (six-file edit, bump all six `Last updated`): "Each submission or edit is counted for 30 days (account id, kind, preset id, time) to enforce daily limits; if a moderation notification fails, a record holding only the preset id is kept for 30 days after it is resolved (90 if unresolved) and deleted with the preset."
- Land together with the FINDING-005 and FINDING-008 edits to the same item, as one coordinated web-app policy commit.

## Status
OPEN
