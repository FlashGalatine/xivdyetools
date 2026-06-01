# Legacy / Deprecated Summary

## Overview
- **Total Findings:** 1 grouped finding (DEAD-111) — mostly **KEEP** (intentional back-compat).

## Findings
| ID | Item | Status | Recommendation |
|----|------|--------|----------------|
| DEAD-111 | `router-service.ts` `LEGACY_ROUTE_REDIRECTS` | **live** (consumed at line 348-352) | KEEP |
| DEAD-111 | `v4/result-card.ts` legacy action names | **live** (gradient/mixer emit legacy keys) | KEEP |
| DEAD-111 | `tool-config-types.ts` deprecated `showHex/showRgb/showHsv/showLab` | migration shim, read by `display-options-helper.ts` | MONITOR (set removal-target date) |
| DEAD-111 | `shared/logger.ts` 3 `@deprecated` factory aliases | no prod ref per sweep | VERIFY then maybe REMOVE |

## Notes
- These are **intentional** back-compat shims, not accidental dead code. They protect old shared/deep-link URLs and persisted
  user config — removing prematurely is user-facing breakage (HIGH blast radius).
- The only genuine removal candidate is the trio of deprecated `logger.ts` aliases — and only after a monorepo-wide call-site
  check (other apps may use them).
- Related deprecations already tracked elsewhere: `components/dye-filters.ts` `@deprecated` is handled as DEAD-100;
  `services/tool-panel-builders.ts` `@deprecated buildFiltersPanel` likewise.
