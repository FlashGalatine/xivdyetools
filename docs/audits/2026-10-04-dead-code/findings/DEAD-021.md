# DEAD-021: color-service.test.ts tests @xivdyetools/core ColorService, not web-app code — 280 test lines
**Confidence:** HIGH · **Blast radius:** NONE · **Deploy unit:** apps/web-app · **Semver:** NONE · **Category:** Stale Test · **Origin:** MAIN

## Location
- `apps/web-app/src/services/__tests__/color-service.test.ts:1` — color-service.test.ts

## Evidence
- Its only import is ColorService from @xivdyetools/core (line 6), and no web-app color-service.ts exists. Every method it asserts is covered in core's suites (ColorService, ColorConverter, ColorManipulator, ColorAccessibility).
  - Commands: grep '^import' color-service.test.ts: only '@xivdyetools/core'; git grep -c adjustBrightness|desaturate|invert|isLightColor|meetsWCAGAA|getOptimalTextColor|hexToHsv packages/core tests: ColorService 23, ColorManipulator 46, ColorAccessibility 33, ColorConverter 24
- Origin: git cat-file -e 8ecb878f:apps/web-app/src/services/__tests__/color-service.test.ts succeeds; file untouched by the PRs.

## Fix
**REMOVE WITH CAUTION.** First diff its ~40 assertions (e.g. '0G'-style exact values, colorblind outputs) against core's suites and move any exact-value case core lacks. Web-app coverage does not move, because it imports no local file.

Steps: Delete apps/web-app/src/services/__tests__/color-service.test.ts after porting any uncovered assertion into packages/core/src/services/**/__tests__. Run pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app (and --filter=@xivdyetools/core if a case was ported), then pnpm dead-code:check.

Correction from the final adversarial check: Also update apps/web-app/CLAUDE.md:283, whose Testing section uses this file as the single-file example command; docs:check-links cannot see it because it is inside a code block.

## Status
REMOVED, NOT DEPLOYED — `7763d4e1` (branch `fix/remediation-2026-10-04-sprint23`, web-app 5.14.7; PR #253, open, stacked on #252).
