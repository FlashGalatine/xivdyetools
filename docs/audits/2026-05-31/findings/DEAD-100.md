# DEAD-100: dye-filters.ts + buildFiltersPanel (deprecated chain hidden behind the barrel)

## Category
Legacy/Deprecated + Unused Export

## Location
- File(s): `src/components/dye-filters.ts` (385 lines, `@deprecated`),
  `src/components/__tests__/dye-filters.test.ts` (357 lines),
  `src/services/tool-panel-builders.ts` (the `buildFiltersPanel` export + `new DyeFilters` call),
  `src/services/index.ts:145` (barrel re-export)
- Symbol(s): `DyeFilters` class, `DyeFilterConfig`, `buildFiltersPanel`

## Evidence
`dye-filters.ts` is explicitly deprecated:
```typescript
// src/components/dye-filters.ts:52
* @deprecated Use `<v4-dye-filters>` (dye-filters-v4.ts) and `DyeFiltersConfig` from
*   `@shared/tool-config-types` with pure functions from `@shared/dye-filter-utils` instead.
```
It looks production-reachable, but only through a dead link:
- `tool-panel-builders.ts:120` does `new DyeFilters(...)` **inside the function `buildFiltersPanel`**.
- `services/index.ts:145` re-exports `buildFiltersPanel`.
- **`buildFiltersPanel` has zero production call-sites** — grep finds it only in the barrel re-export, its own definition, and
  `vi.fn()` mocks in 8 component tests. (Its sibling `buildMarketPanel` *is* live: `extractor-tool.ts:826`,
  `gradient-tool.ts:579` — keep it.)

So the live v4 filter UI is `<v4-dye-filters>` (`v4/dye-filters-v4.ts`, rendered ~7× in `v4/config-sidebar.ts`), and the v3
`DyeFilters` class is reachable only via the unused `buildFiltersPanel`.

- Git: `dye-filters.ts` and `dye-filters-v4.ts` both last touched **2026-04-02** — the deprecation date.

## Why It Exists
The v3 imperative dye-filter component + its panel-builder. The v4 redesign replaced it with the `<v4-dye-filters>` Lit element
driven by pure functions in `@shared/dye-filter-utils`, but the v3 class, its 357-line test, and the `buildFiltersPanel`
wrapper were left in place behind the barrel.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | MEDIUM-HIGH — file is import-reachable, but only via the call-site-less `buildFiltersPanel`. Confirm with `tsc --noEmit` after each step. |
| **Blast Radius** | LOW-MEDIUM — touches `tool-panel-builders.ts` + `services/index.ts` barrel; must keep `buildMarketPanel` |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | The 8 `vi.fn()` mocks for `buildFiltersPanel`/`buildMarketPanel` in component tests (DEAD-101) — keep the `buildMarketPanel` half |

## Recommendation
**REMOVE WITH CAUTION** (symbol-first, then file)

### Rationale
- ~742 lines + the `buildFiltersPanel` function (~50 lines). Collapses a deprecated chain the barrel was hiding.
- Removing the dead export is what *lets* the file be deleted — deleting the file first would break the (dead) export.

### If Removing
1. Delete the `buildFiltersPanel` function from `tool-panel-builders.ts` and the `DyeFilters` import it uses; keep
   `buildMarketPanel`.
2. Remove `buildFiltersPanel` from the `services/index.ts:145` re-export (and `FiltersPanelConfig`/`FiltersPanelRefs` types if
   now unused — see DEAD-107).
3. Delete `src/components/dye-filters.ts` and `__tests__/dye-filters.test.ts`.
4. In the 8 component tests that `vi.mock('@services/tool-panel-builders', …)`, drop the `buildFiltersPanel: vi.fn()` line; keep
   `buildMarketPanel: vi.fn()` (DEAD-101).
5. `pnpm --filter xivdyetools-web-app run type-check && run test`.
