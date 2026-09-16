# DEAD-018: Core APIs without local callers — 28 source lines retained
**Confidence:** HIGH · **Blast radius:** HIGH · **Deploy unit:** core · **Semver:** MAJOR · **Category:** Unused Export

Supersedes `2026-09-01-dead-code/DEAD-006`; references rechecked at this snapshot.

## Location
- `packages/core/src/services/CharacterColorService.ts:157,253; LocalizationService.ts:585,592; ColorService.ts:676,686`.

## Evidence
- getSharedColors, getRaceSpecificColors, both getAvailableLocales methods and hexToRyb/rybToHex remain documented/exported API. Repository-only absence cannot establish absence of npm consumers.
- See [tracked references](../evidence/reference-evidence.txt), [syntax survey](../evidence/syntax-survey.json) and [verification](../evidence/verification.md). Test boundaries: [measured spans](../evidence/test-removal-spans.json).

## Fix
- **KEEP** — Retain the API. At the next independently justified core major, check registry publication and external consumers, document deprecation/migration, then reassess.
- Gate: Reassess at the stated trigger; no removal gate is scheduled.
- Revisit trigger: Next independently justified core major, after publication and external-consumer review.
## Status
KEEP — unscheduled until its trigger.
