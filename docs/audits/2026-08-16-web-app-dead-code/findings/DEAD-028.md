# [DEAD-028]: Unit-test infrastructure that no test uses — 22 of 32 `component-utils` helpers, all 9 mock-service factories, `errorHandlers`, and 2 MSW server helpers (~34 KB)

## Category
Stale Test (unused helpers)

## Location / Evidence
`evidence/agent-report-non-source.md` §C — extracted by parsing every `import {…} from` across all 91 `*.test.ts`:

| File | Bytes | Exports | Imported by tests | Dead |
|---|---:|---|---|---|
| `src/__tests__/component-utils.ts` | 12,755 | 32 | 10 (`createTestContainer`, `cleanupTestContainer`, `click`, `input`, `query`, `queryAll`, `getAttr`, `getText`, `hasClass`, `spyOnCustomEvent`) across 27 files | **22**: `createPanelContainers`, `waitForRender`, `waitForFrames`, `wait`, `waitFor`, `flushMicrotasks`, `doubleClick`, `change`, `keyboard`, `pressEnter`, `pressEscape`, `focus`, `blur`, `hover`, `unhover`, `dispatchCustomEvent`, `setupComponent`, `cleanupComponent`, `queryByText`, `queryByData`, `queryByRole`, `isVisible` |
| `src/__tests__/mocks/services.ts` | 14,965 | `mockDyes` + 9 factories + 9 interfaces | `mockDyes` only (17 files) | **all 9 factories** (`createMockDyeService`, `createMockStorageService`, `createMockCollectionService`, `createMockMarketBoardService`, `createMockToastService`, `createMockModalService`, `createMockRouterService`, `createMockColorService`, `createAllMockServices`) + interfaces — ~14 KB of 15 KB |
| `src/__tests__/mocks/handlers.ts` | 10,698 | `mockPresets`, `mockCategories`, `handlers`, `errorHandlers` | `handlers` (via `server.ts`) | **`errorHandlers`** (0 importers) |
| `src/__tests__/mocks/server.ts` | 627 | `server`, `resetHandlers`, `useHandler` | `server` (`setup.ts:11`, one integration test) | **`resetHandlers`, `useHandler`** (`setup.ts` calls `server.resetHandlers()` directly) |

Verified healthy: 0 skipped unit tests, 0 broken subject imports, no test file with zero `it()`, no MSW handler for an endpoint the source doesn't call.

## Why It Exists
`component-utils` and the mock factories were written as a general test toolkit up front; the tests that followed used a narrower subset (and `vi.mock` module mocks instead of factory objects).

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH |
| **Blast Radius** | NONE — test infra only; `vitest` is the oracle |
| **Reversibility** | EASY |
| **Hidden Consumers** | `src/__tests__/TESTING.md` may document some helpers — update it. The `wait*` helpers are exactly the kind of thing the "rAF vs flush-count" lesson warns against reintroducing; deleting them is a small guardrail. |

## Recommendation
**REMOVE**

### If Removing
1. Delete the 22 helpers from `component-utils.ts`; delete the 9 factories + interfaces from `mocks/services.ts` (keep `mockDyes`); delete `errorHandlers`; delete `resetHandlers`/`useHandler`
2. Update `src/__tests__/TESTING.md` if it lists them
3. `pnpm --filter xivdyetools-web-app run test`
