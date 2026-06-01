# Deprecated Barrel Chain Summary

## Overview
- **Total Findings:** 1 (DEAD-100)
- **Recommended for Removal:** 1 (symbol-first, then file)
- **Estimated Lines Removable:** ~742 + ~50 (the `buildFiltersPanel` function)

## The chain
```
services/index.ts:145  re-exports  buildFiltersPanel   (no production call-site)
        │
tool-panel-builders.ts: buildFiltersPanel()  ──does──►  new DyeFilters(...)   (line 120)
        │
components/dye-filters.ts  (@deprecated; superseded by <v4-dye-filters>)
```
`dye-filters.ts` is `@deprecated` and looks production-reachable, but **only** because the call-site-less `buildFiltersPanel`
instantiates it and the barrel re-exports that function. Remove the dead export and the file falls out. The live filter UI is
`<v4-dye-filters>` (`v4/dye-filters-v4.ts`), rendered ~7× in `v4/config-sidebar.ts`.

## Findings
| ID | Symbol/File | Lines | Confidence | Recommendation |
|----|-------------|-------|------------|----------------|
| DEAD-100 | `buildFiltersPanel` + `dye-filters.ts` (+ test) | ~792 | MEDIUM-HIGH | REMOVE WITH CAUTION |

## Notes
- **Keep `buildMarketPanel`** — it is genuinely live (`extractor-tool.ts:826`, `gradient-tool.ts:579`).
- This is the audit's clearest example of **file-level reachability over-counting**: a barrel re-export keeps a deprecated file
  "reachable" with zero real consumers. Symbol-level call-site analysis is required to see it.
- Confirm each step with `tsc --noEmit`.
