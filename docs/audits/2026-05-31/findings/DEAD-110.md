# DEAD-110: Permanently disabled e2e tests in collection-manager.spec.ts

## Category
Stale Test Code (disabled tests)

## Location
- File(s): `e2e/collection-manager.spec.ts`
- Symbol(s): 4 `test.skip('…', …)` blocks at lines 115, 126, 138, 159

## Evidence
Four named tests are permanently disabled with `test.skip('<name>', async …)`:
```
e2e/collection-manager.spec.ts:115  test.skip('should open collection manager modal when Manage Collections button exists', …)
e2e/collection-manager.spec.ts:126  test.skip('should close modal with Escape key', …)
e2e/collection-manager.spec.ts:138  test.skip('should create a new collection', …)
e2e/collection-manager.spec.ts:159  test.skip('should export collections as JSON', …)
```
These never run and have no re-enable condition. **Distinct from** the many bare `test.skip();` *runtime guards* in
`dye-comparison.spec.ts` / `ui-interactions.spec.ts` — those are intentional "skip if the element isn't present" guards and are
**not** dead.

## Why It Exists
The collection-manager flows were likely flaky or the UI shifted; the tests were skipped rather than fixed or deleted.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — permanently skipped, no re-enable path |
| **Blast Radius** | NONE — they don't execute |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None |

## Recommendation
**KEEP-OR-FIX (decide), do not silently leave skipped** — either re-enable (fix the underlying flake) or delete the 4 blocks

### Rationale
- Skipped tests rot: they imply coverage that doesn't exist. Decide explicitly.

### If Removing
1. Either repair the 4 flows and drop `.skip`, or delete the 4 `test.skip(...)` blocks.
2. `pnpm --filter xivdyetools-web-app run test:e2e` (chromium project) to confirm the spec still loads.
