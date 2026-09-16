# DEAD-019: Parked Stoat feature scaffolding retained
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** stoat-worker · **Semver:** NONE · **Category:** Test-only

Supersedes `2026-09-01-dead-code/DEAD-030`; references rechecked at this snapshot.

## Location
- `apps/stoat-worker/src/commands/parser.ts:148; services/loading-indicator.ts:25; services/response-formatter.ts:43`.

## Evidence
- parseMultiDyeArgs, withLoadingIndicator and DYE_INFO_REACTIONS have only test callers; the app documents deferred command/reaction features and remains parked. Its live imports into bot-logic still count.
- See [tracked references](../evidence/reference-evidence.txt), [syntax survey](../evidence/syntax-survey.json) and [verification](../evidence/verification.md). Test boundaries: [measured spans](../evidence/test-removal-spans.json).

## Fix
- **KEEP** — Keep while parked (P3). On resumption choose implementation or removal for each planned feature; on retirement remove the app as a separately approved action.
- Gate: Reassess at the stated trigger; no removal gate is scheduled.
- Revisit trigger: Stoat is explicitly resumed or retired.
## Status
KEEP — unscheduled until its trigger.
