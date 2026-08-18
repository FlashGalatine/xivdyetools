# [DEAD-001]: `services/component-context.ts` — a 326-line service with zero non-test consumers

## Category
Orphaned Module (TEST-ONLY)

## Location
- File(s): `apps/discord-worker/src/services/component-context.ts` (326 lines), `component-context.test.ts` (129), `component-context.storage.test.ts` (230)
- Symbol(s): `buildCustomId`, `storeContext`, `getContext`, `updateContext`, `verifyContextUser`, `parseCustomId` (all exports)
- Docs that describe it as live: `docs/projects/discord-worker/interactions.md:35`, `overview.md:84`, `apps/discord-worker/CLAUDE.md:111`

## Evidence
`grep -rln component-context apps/discord-worker/src` → only the module itself and its two test files. Every export has 0 non-test references (`preview-image.ts` has a *different* local `parseCustomId`). Rewritten in `935ef88` (Phase 0.4) "to unblock pagination"; no pagination or button flow ever consumed it. knip cannot see this because test files are entries — the module looks "used" through its own tests.

## Why It Exists
Planned infrastructure for stateful component interactions (pagination) that never landed in 5.0.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — 0 non-test importers, verified independently by two passes |
| **Blast Radius** | LOW — 685 lines across 3 files, plus a `vitest.config.ts` coverage-exclude line and 3 doc references |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None found (no dynamic import, no custom_id prefix routed to it in `handlers/buttons/index.ts`) |

## Recommendation
**REMOVE** — or, if pagination is still on the 5.1 roadmap, keep it and *fix the three docs*, which currently describe it as a live subsystem. Either way the docs are wrong today.

### Rationale
685 lines of code + tests that no runtime path can reach, guarding a KV schema (`ctx:` keys) nothing writes. Removing it also removes one of the reasons `src/test-utils.ts` carries its own `createMockKV`.

### If Removing
1. Delete the three files.
2. Remove the `component-context` line from `vitest.config.ts` coverage.exclude if present; update the 3 docs.
3. `pnpm turbo run test type-check --filter=xivdyetools-discord-worker`.
