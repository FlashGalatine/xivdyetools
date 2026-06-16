# DEAD-119: InteractionContext + deadline functions still present (continuation of DEAD-024)

> **STATUS: RESOLVED** (verified 2026-06-15) — executed in `106e94f` (2026-06-04), merged to main via `fbc065f`; the flagged files/symbols are no longer in the tree.

## Category
Unused Export

## Location
- File(s): `apps/discord-worker/src/utils/discord-api.ts`
- Symbol(s): `InteractionContext` class, `createInteractionContext()`, `FollowUpOptions`, `DeadlineResult`,
  `sendFollowUpWithDeadline()`, `editOriginalResponseWithDeadline()`

## Evidence
**Continuation of 2026-02-28 DEAD-024** (recommended REMOVE; not executed). Re-verifying, the symbols remain in
`utils/discord-api.ts` and are referenced **only** by the test + the CHANGELOG note:
```
grep InteractionContext|...Deadline... → discord-api.ts (defs), discord-api.test.ts (tests), CHANGELOG.md (doc only)
```
No production handler imports them. The live REST helpers handlers actually use are the standalone
`sendMessage` / `editOriginalResponse` / `sendFollowup` in the same file.

## Why It Exists
An ergonomic OOP wrapper + Discord 3-second-deadline helpers designed during V4 that handlers bypassed in favor of the
simpler standalone functions.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — zero production importers (def + test + changelog only) |
| **Blast Radius** | LOW — removes ~100 lines from an otherwise-live file |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None — private app |

## Recommendation
**REMOVE** (verify with `tsc` first)

### Rationale
- Closes DEAD-024. Removes an unused parallel API layer that competes with the live standalone helpers.

### If Removing
1. Delete the 6 symbols from `src/utils/discord-api.ts`; keep `sendMessage`/`editOriginalResponse`/`sendFollowup`.
2. Update `discord-api.test.ts` to drop their suites.
3. `pnpm --filter xivdyetools-discord-worker run type-check && run test`.
