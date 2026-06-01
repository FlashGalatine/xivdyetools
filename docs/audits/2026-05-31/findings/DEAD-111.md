# DEAD-111: Legacy/deprecated back-compat shims (KEEP / MONITOR)

## Category
Legacy/Deprecated

## Location
- `src/shared/logger.ts:28,34,64` — 3 `@deprecated` factory aliases
- `src/shared/tool-config-types.ts:56-63` — deprecated `showHex/showRgb/showHsv/showLab` fields (migration shims)
- `src/shared/tool-icons.ts:117` — "Legacy aliases for backwards compatibility"
- `src/services/router-service.ts:71-75` — `LEGACY_ROUTE_REDIRECTS` (e.g. `/matcher` → `/extractor`)
- `src/components/v4/result-card.ts` — "legacy action names for backwards compatibility"

## Evidence
These are intentional, documented compatibility shims rather than accidental dead code:
- `LEGACY_ROUTE_REDIRECTS` is **live** — `router-service.ts:348-352` consumes it to redirect old deep links. **KEEP.**
- `result-card.ts` legacy action names are **live** — gradient/mixer tools still emit the legacy keys. **KEEP.**
- `tool-config-types.ts` deprecated `showHex/...` fields back `DisplayOptions` migration — keep until the migration window
  closes; they are read by `display-options-helper.ts`. **MONITOR.**
- `logger.ts` 3 `@deprecated` factory aliases (`createBrowserLogger({ isDev })` is the replacement) — these may be removable if
  no caller uses the old signatures. **VERIFY** (the symbol sweep shows them with no prod ref; `__setTestEnvironment` is a
  test-only helper).

## Why It Exists
Deliberate back-compat: old share/deep-link URLs, persisted config from prior versions, and old logger call-sites are supported
through these shims so existing users/links don't break.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH that LEGACY_ROUTE_REDIRECTS / result-card legacy actions are needed (KEEP) |
| **Blast Radius** | HIGH if removed prematurely — breaks old shared URLs / persisted user config |
| **Reversibility** | MODERATE — user-facing back-compat, not a pure git revert |
| **Hidden Consumers** | External: old bookmarked share URLs, localStorage from prior app versions |

## Recommendation
**KEEP** the route redirects + result-card legacy actions; **MONITOR** the config-migration fields; **VERIFY then maybe remove**
the 3 deprecated `logger.ts` aliases only.

### Rationale
- These protect existing users; document them rather than removing. Only the logger aliases are a candidate, pending a call-site
  check.

### If Acting
1. For `logger.ts`: grep for the deprecated alias names across the monorepo (not just web-app); if zero callers, remove them.
2. Leave route redirects / result-card legacy actions in place; add a removal-target date to the config-migration fields if the
   migration is considered complete.
