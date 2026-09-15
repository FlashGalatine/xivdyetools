# FINDING-004: An owner edit can overwrite a newer moderation state
**Severity:** LOW · **Exposure:** INTERNET-AUTH · **Deploy unit:** presets-api · **Rotation:** NONE · **CWE:** CWE-367

## Location
- `apps/presets-api/src/handlers/presets.ts:524` — snapshots ownership/status; hidden denial at line 588 and `ownerEditOutcome` at line 463 use the old state.
- `apps/presets-api/src/services/preset-service.ts:690` — adds status to the write; line 704 predicates only on ID.

## Evidence
- Owner begins an edit of an approved preset that moderation will flag, or resubmits rejected text; moderator hides/flags the preset during the intervening validation/moderation awaits; the owner's old-state write then changes the new state to pending.
- Current policy explicitly denies editing hidden presets and reserves flagged transitions to moderators (`handlers/presets.ts:498-501,584-589`). The final UPDATE does not enforce that policy. No direct public approval follows this path.
- Two source reviewers confirmed the await/write ordering; no concurrent production requests were sent. See [presets review](../evidence/review-presets-api.md).

## Fix
- Use a record revision or expected status/content version in the conditional UPDATE, and reject or re-evaluate on conflict. A same-state concurrent content edit should also change the revision.

## Status
OPEN — fixed locally; deployment acceptance pending.

Implementation commits: 74114ebf. Regression and gate evidence: [implementation report](../IMPLEMENTATION_REPORT.md). Original evidence above describes the audited snapshot.
