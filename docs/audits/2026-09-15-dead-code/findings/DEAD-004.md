# DEAD-004: ThemeService.getRequiredColor — 15 source lines
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** web-app · **Semver:** NONE · **Category:** Legacy

## Location
- `apps/web-app/src/services/theme-service.ts:329–343`.

## Evidence
- No executable or test caller. Two prose references describe the unused accessor and do not establish reachability.
- See [tracked references](../evidence/reference-evidence.txt), [syntax survey](../evidence/syntax-survey.json) and [verification](../evidence/verification.md). Test boundaries: [measured spans](../evidence/test-removal-spans.json).

## Fix
- **REMOVE** — Delete getRequiredColor and update explanatory comments plus docs/projects/web-app/theming.md:39, which presents it as an accessor; preserve applyPalette and current theme accessors.
- Gate: `pnpm turbo run build type-check lint test --filter=xivdyetools-web-app` plus `pnpm --filter xivdyetools-web-app run build:check`.

## Status
DONE — removed in `2d1695af` (2026-09-16, branch cleanup/dead-code-2026-09-15).
