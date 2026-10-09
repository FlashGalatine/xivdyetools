# DEAD-012: HybridPresetService: 5 public methods with no caller and no test, about 49 lines including blanks
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** apps/web-app · **Semver:** NONE · **Category:** Unused Export · **Origin:** MAIN

## Location
- `apps/web-app/src/services/hybrid-preset-service.ts:393` — HybridPresetService.getRandomPreset/searchPresets/getPresetWithDyes/resolveDyes/getCategoryMeta

## Evidence
- Tracked-file git grep shows only the declarations (plus resolveDyes self-call at :428). Same-named hits are core PresetService/discord-worker functions. The production consumer (preset-tool.ts) uses only initialize/getPresets/getPreset/isAPIAvailable, and the class is unexported, so nothing can reach them dynamically.
  - Commands: git grep -n -w -E 'getRandomPreset|searchPresets|getPresetWithDyes|resolveDyes|getCategoryMeta' -- . : web-app hits only at hybrid :242,:393,:404,:415,:422,:428 (+ :285 is localPresetService.searchPresets); git grep hybridPresetService in apps/web-app: preset-tool.ts:430,533,568,593,598 + services/index.ts:91-94; preset-tool.test mock has initialize/getPresets/isAPIAvailable/getPreset only
- Origin: git diff --stat 8ecb878f HEAD -- apps/web-app/src/services shows only example-link changes; git grep at 8ecb878f returns the same declaration-only hits

## Fix
**REMOVE.** Follow-on: once getRandomPreset is gone, no production caller passes GetPresetsOptions.category (preset-tool.ts:589-592 says so), so re-check it as a follow-on once this lands.

Steps: In apps/web-app/src/services/hybrid-preset-service.ts delete getCategoryMeta (239-245), getRandomPreset (390-400), searchPresets (401-407), and the 'Dye Resolution' section with resolveDyes + getPresetWithDyes (408-431). Drop the now-unused imports CategoryMeta and Dye (lines 12-13) and resolvePresetDye from line 16, which stays live elsewhere via services/index.ts and components. No test changes. Then run pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app and pnpm dead-code:check.

## Status
REMOVED, NOT DEPLOYED — `e5a612b5` (branch `fix/remediation-2026-10-04-sprint4`, web-app 5.14.2; PR #245, open, stacked on #244). Removing it left core's published `PresetService.getCategoryMeta` without an in-repo caller; it is tagged `@public`.
