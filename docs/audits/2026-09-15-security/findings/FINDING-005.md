# FINDING-005: A stale moderator revert can undo a newer hide or rejection
**Severity:** LOW · **Exposure:** INTERNET-AUTH · **Deploy unit:** presets-api · **Rotation:** NONE · **CWE:** CWE-367

## Location
- `apps/presets-api/src/handlers/moderation.ts:200` — reads the preset and previous-values snapshot before the later batch at line 222.
- `apps/presets-api/src/services/preset-service.ts:475` — restores content and approved status with only an ID predicate at line 477.

## Evidence
- Moderator A reads an available revert snapshot; moderator B hides/rejects/flags the preset; A's delayed revert restores the old content and approved status, undoing B's newer decision.
- Batching the revert with its audit-log insert makes those two writes atomic, but does not bind the earlier snapshot read. The separate status handler's conditional transitions do not protect `prepareRevert`.
- Source ordering independently confirmed. Requires an authorized moderator operation and overlapping decisions; no unprivileged standalone request or production race was demonstrated.

## Fix
- Condition the revert on the revision/status/snapshot actually reviewed; return conflict on zero affected rows and retain the existing conditional audit-log insert. Add an interleaved-decision regression test.

## Status
OPEN
