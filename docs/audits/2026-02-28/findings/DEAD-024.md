# DEAD-024: InteractionContext Class & Deadline Functions (discord-api.ts)

## Category
Unused Export

## Location
- `apps/discord-worker/src/utils/discord-api.ts`
  - `InteractionContext` class (~50 lines)
  - `createInteractionContext()` factory
  - `FollowUpOptions` type
  - `DeadlineResult` type
  - `sendFollowUpWithDeadline()`
  - `editOriginalResponseWithDeadline()`

## Evidence
- All 6 symbols are only imported by `discord-api.test.ts`.
- Production code calls `editOriginalResponse`/`sendMessage`/`sendFollowUp` directly with individual params.
- The `InteractionContext` OOP wrapper was designed to simplify handler code but was never adopted.
- Deadline functions add timeout handling for Discord's 3-second response window but no handler uses them.

## Why It Exists
Designed as an ergonomic API layer during V4 development. Handlers ended up using the simpler standalone functions instead.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — zero production imports |
| **Runtime Impact** | NONE |
| **Build Impact** | Removes ~100 lines |
| **External Consumers** | None |

## Recommendation
**REMOVE** the InteractionContext class, createInteractionContext, FollowUpOptions, DeadlineResult, sendFollowUpWithDeadline, and editOriginalResponseWithDeadline. Update discord-api.test.ts accordingly.
