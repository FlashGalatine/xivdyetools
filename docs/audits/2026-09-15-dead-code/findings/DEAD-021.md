# DEAD-021: InteractionResponseBody assertion contract retained
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** discord-worker · **Semver:** NONE · **Category:** Unused Type

Supersedes `2026-09-01-dead-code/DEAD-029`; references rechecked at this snapshot.

## Location
- `apps/discord-worker/src/types/env.ts:244–278`.

## Evidence
- The interface is imported by 12 tracked test files to type real handler responses. It has a concrete test-support role and erases from the runtime bundle.
- See [tracked references](../evidence/reference-evidence.txt), [syntax survey](../evidence/syntax-survey.json) and [verification](../evidence/verification.md). Test boundaries: [measured spans](../evidence/test-removal-spans.json).

## Fix
- **KEEP** — Keep the shape. A future test-support reorganization may move it to a testing module and update all imports together; deleting it is not a runtime optimization.
- Gate: Reassess at the stated trigger; no removal gate is scheduled.
- Revisit trigger: A scoped Discord test-support module reorganization is approved.
## Status
KEEP — unscheduled until its trigger.
