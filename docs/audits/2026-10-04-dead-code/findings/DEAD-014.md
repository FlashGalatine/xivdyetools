# DEAD-014: getPresets 'community' guard in hybrid-preset-service.ts is unreachable — 19 lines
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** apps/web-app · **Semver:** NONE · **Category:** Dead Path · **Origin:** MAIN

## Location
- `apps/web-app/src/services/hybrid-preset-service.ts:259` — getPresets 'community' category branch

## Evidence
- category is typed PresetCategory (packages/types/src/preset/core.ts:18, with no 'community' member). The only production getPresets call (preset-tool.ts:593) passes no category at all, and preset-tool's 'community' is the PresetTab UI type.
  - Commands: git grep "'community'" apps/web-app/src (non-test): preset-tool PresetTab only + the guard :261; git grep 'getPresets(' web-app: preset-tool.ts:593 {search,sort,limit}; hybrid :394 (dead getRandomPreset), :405 (dead searchPresets)
- Origin: The guard and its 5.0 comment are identical at 8ecb878f; no PR touched the file (diff --stat 8ecb878f HEAD).

## Fix
**REMOVE.** Follow-on after DEAD-012 lands: with getRandomPreset gone, the if (category) branches at 281-282 and 301-303 (and GetPresetsOptions.category) are also unreachable from production. Re-check them as a separate follow-up rather than widening this finding.

Steps: Delete hybrid-preset-service.ts lines 259-277 (the comment plus the if ((category as string) === 'community') block). No test covers it, because the file is istanbul-ignored. Run pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app and pnpm dead-code:check.

## Status
OPEN
