# DEAD-047: HarmonyGenerator find*Dyes family + 8 DyeService delegates + DyeDatabase hue-bucket index are test-only: ~660 src lines + ~1080 test lines
**Confidence:** HIGH · **Blast radius:** HIGH · **Deploy unit:** packages/core · **Semver:** MAJOR · **Category:** Test-only · **Origin:** MAIN

## Location
- `packages/core/src/services/dye/HarmonyGenerator.ts:156` — HarmonyGenerator find* family + DyeService.find*Dyes delegates + DyeDatabase hue-bucket index

## Evidence
- No production caller in the monorepo reaches the eight find*/findComplementaryPair methods. The only callers are the DyeService delegates (DyeService.ts:219-316), which only tests call: core HarmonyGenerator/DyeService/DyeDatabase/integration tests and web-app dye-service.test.ts:197+. Every surface uses generateHarmonySlots. The methods are still published DyeService API.
  - Commands: git grep -w find{Complementary..SplitComplementary},HarmonyGenerator,getHueBucketsToSearch,getDyesByHueBucket filtered to non-test files: only DyeService.ts:219-316, HarmonyGenerator.ts, DyeDatabase.ts:517/539/548/551, plus comments in bot-logic harmony.ts:201, svg tool-icons.ts:7 and web-app harmony-icons.ts:5. No computed-access patterns. web-app dye-service-wrapper only returns the core instance.
- Origin: git diff --stat 8ecb878f HEAD -- packages/core is empty. git log 8ecb878f..HEAD -G'findComplementaryPair|findTriadicDyes' returns nothing. Core at e24741c6 (published 5.8.0) == 8ecb878f, and DyeService there carries the find* delegates.

## Fix
**KEEP.** This is published DyeService API in core 5.8.0 (npm view = 5.8.0), and HarmonyGenerator.ts:33-39 documents it as kept on purpose. Revisit trigger: the next core major (same class as 2026-09-15-dead-code/DEAD-018). Until then, consider @deprecated on the 8 DyeService methods in a core minor. Note: dead-code:check cannot see this family because the facade delegate calls share the method names.

Steps: At a core major only.
1. Move the HarmonyOptions, HarmonyMatchingAlgorithm and HarmonyColorSpace types (HarmonyGenerator.ts:17-22, 91-150) to a surviving module. bot-logic harmony.ts:11 needs HarmonyOptions. Repoint the index.ts:49-55 type exports.
2. Delete the rest of HarmonyGenerator.ts: constants and deltaEFor (:24-89) and the class (:152-577).
3. In DyeService.ts, delete the import (:37), the field (:72), the constructor line (:83) and the delegates (:205-317).
4. In DyeDatabase.ts, delete HUE_BUCKET_* (:62-64), the dyesByHueBucket field (:56), its clear (:316), the index build (:344-352), and getHueBucket/getHueBucketsToSearch/getDyesByHueBucket (:503-542).
5. Delete HarmonyGenerator.test.ts (738 lines) and integration/harmony-workflow.test.ts (152 lines).
6. Prune the find*/bucket blocks in DyeService.test.ts, DyeDatabase.test.ts, end-to-end-workflow.test.ts and performance-benchmarks.test.ts, and in web-app dye-service.test.ts:193-230 and :255-280.
7. Then delete ColorManipulator (DEAD-048).
8. Update the core CLAUDE.md DyeService API list.
9. Run pnpm turbo run build type-check lint test --filter=...@xivdyetools/core && pnpm dead-code:check.

## Status
KEEP (register) — revisit on the trigger above
