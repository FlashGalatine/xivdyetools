# DEAD-048: ColorManipulator (whole class) + 6 ColorService delegates + 3 ColorAccessibility methods/delegates are test-only: ~170 src lines + ~600 test lines
**Confidence:** HIGH · **Blast radius:** HIGH · **Deploy unit:** packages/core · **Semver:** MAJOR · **Category:** Test-only · **Origin:** MAIN

## Location
- `packages/core/src/services/color/ColorManipulator.ts:15` — ColorManipulator + ColorService manipulation delegates; ColorAccessibility.meetsWCAGAA/meetsWCAGAAA/getOptimalTextColor

## Evidence
- No non-test file calls ColorService.adjustBrightness/adjustSaturation/rotateHue/rotateHueLch/invert/desaturate/meetsWCAGAA/meetsWCAGAAA/getOptimalTextColor. ColorManipulator's only other non-test caller is HarmonyGenerator.ts:187 (invert), inside the test-only find* family (DEAD-047). The ColorService facade is the published barrel export (index.ts:10).
  - Commands: git grep -w for the nine method names plus ColorManipulator over apps/packages/scripts, non-test: only ColorService.ts:254-327, ColorAccessibility.ts:54/62/78, ColorManipulator.ts, HarmonyGenerator.ts:8/187, and an og-worker comment (harmony.ts:91). Test-only refs: core ColorManipulator.test (79), ColorAccessibility.test (27), ColorService.test (21), web-app color-service.test (16).
- Origin: Core is unchanged 8ecb878f..HEAD. e24741c6 (published 5.8.0) ColorService carries meetsWCAGAA/getOptimalTextColor/adjustBrightness/rotateHueLch/invert/desaturate (also at 388f270c). git log 8ecb878f..HEAD -G for these names: empty.

## Fix
**KEEP.** These are published ColorService static API and are listed in the core CLAUDE.md public API. Revisit trigger: the next core major (fold into the 2026-09-15-dead-code/DEAD-018 class). ColorManipulator.invert stays live while the DEAD-047 family exists, so ColorManipulator can only be deleted with or after DEAD-047.

Steps: At a core major, after or together with DEAD-047 (HarmonyGenerator.ts:187 calls invert).
1. Delete ColorService.ts:251-263 and :272-277 (WCAG and optimal-text delegates) and :279-328 (manipulation delegates), plus the import at :45.
2. Delete ColorAccessibility.ts meetsWCAGAA, meetsWCAGAAA and getOptimalTextColor (~:51-57, :59-65, :75-82). Keep getContrastRatio and isLightColor, which are live.
3. Delete ColorManipulator.ts (78 lines) and ColorManipulator.test.ts (341 lines).
4. Prune ColorAccessibility.test.ts :87-197, :237-304, ColorService.test.ts and web-app color-service.test.ts blocks for these names.
5. Update the core CLAUDE.md API list.
6. Run pnpm turbo run build type-check lint test --filter=...@xivdyetools/core && pnpm dead-code:check.

Correction from the final adversarial check: Step 4's pruning of web-app color-service.test.ts applies only if DEAD-021 has not landed; DEAD-021 deletes that whole file.

## Status
KEEP (register) — revisit on the trigger above
