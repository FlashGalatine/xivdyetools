# DEAD-101: Stale vi.mock() scaffolding in live test files

## Category
Stale Test Code

## Location
- File(s): multiple live `*.test.ts` files (the mock targets are dead modules)
- Symbol(s): `vi.mock(...)` calls for modules the system-under-test no longer imports

## Evidence
Several still-passing tests carry `vi.mock()` calls for dependencies their subject no longer has — because the v4 refactor
changed what the tools import. The mocks are inert and misleading:

| Stale mock | In test file | For dead module |
|------------|--------------|-----------------|
| `vi.mock('../colorblindness-display', …)` | `accessibility-tool.test.ts:209` | DEAD-096 |
| `vi.mock('../color-distance-matrix', …)` | `comparison-tool.test.ts:206` | DEAD-097 |
| `vi.mock('../color-interpolation-display', …)` | `gradient-tool.test.ts:234` | DEAD-092 |
| `vi.mock('../dye-filters', …)` | `extractor/gradient/harmony/mixer-tool.test.ts` | DEAD-100 |
| `vi.mock('@services/tool-panel-builders', …)` w/ `buildFiltersPanel: vi.fn()` | ~8 component tests | DEAD-100 (filters half) |

Example confirming the subject no longer imports the mocked module:
```typescript
// accessibility-tool.ts:16  (imports result-card, NOT colorblindness-display)
import { ResultCard } from '@components/v4/result-card';
```

## Why It Exists
When the tools were migrated to `v4/result-card.ts` / `<v4-dye-filters>`, the `vi.mock()` lines guarding the old imports were
not cleaned up. They no longer mock anything the test exercises.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — the mocked modules are confirmed dead (DEAD-092/096/097/100) |
| **Blast Radius** | LOW — confined to test files; remove together with the modules they shadow |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | The `buildMarketPanel: vi.fn()` half of the `tool-panel-builders` mock is still needed — keep it |

## Recommendation
**REMOVE** (as part of the corresponding module removals)

### Rationale
- Removes dead test scaffolding that gives false signal about what the tools depend on.

### If Removing
1. Remove each stale `vi.mock(...)` block when removing its target module (DEAD-092/096/097/100).
2. For the `@services/tool-panel-builders` mocks, drop only the `buildFiltersPanel` line; keep `buildMarketPanel`.
3. `pnpm --filter xivdyetools-web-app run test`.
