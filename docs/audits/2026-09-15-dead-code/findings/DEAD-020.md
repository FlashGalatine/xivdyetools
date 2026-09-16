# DEAD-020: Reachable rate-limit fallback paths retained
**Confidence:** HIGH · **Blast radius:** HIGH · **Deploy unit:** api-worker / discord-worker / moderation-worker / oauth · **Semver:** NONE · **Category:** Legacy

Supersedes `2026-09-01-dead-code/DEAD-034`; references rechecked at this snapshot.

## Location
- `apps/api-worker/src/middleware/rate-limit.ts:48,139; apps/discord-worker/src/services/rate-limiter.ts:154; apps/moderation-worker/src/middleware/rate-limit.ts:169; apps/oauth/src/services/rate-limit.ts:113`.

## Evidence
- Native binding selectors still route to KV/memory when bindings are absent. Development/test and degradation contracts are concrete consumers; elapsed calendar time does not satisfy the old production-evidence gate.
- See [tracked references](../evidence/reference-evidence.txt), [syntax survey](../evidence/syntax-survey.json) and [verification](../evidence/verification.md). Test boundaries: [measured spans](../evidence/test-removal-spans.json).

## Fix
- **KEEP** — Keep. Before any removal, establish an explicit replacement for local/test fallback behavior and review the prior operational gate with recorded evidence; no live logs or Cloudflare configuration were inspected here.
- Gate: Reassess at the stated trigger; no removal gate is scheduled.
- Revisit trigger: Fallback retirement is designed, local/test replacements exist, and the prior operational evidence gate is satisfied.
## Status
KEEP — unscheduled until its trigger.
