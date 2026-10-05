# DEAD-033: PresetCategory/AuthSource re-exports in presets-api types.ts are test-only: 6 src lines + 33 test lines
**Confidence:** HIGH · **Blast radius:** NONE · **Deploy unit:** apps/presets-api · **Semver:** NONE · **Category:** Redundant Re-export · **Origin:** MAIN

## Location
- `apps/presets-api/src/types.ts:23` — PresetCategory, AuthSource deprecated re-exports

## Evidence
- No src or scripts file imports the PresetCategory/AuthSource re-exports; only tests/types.test.ts:9,21 imports them, as types. The app is private:true and no other workspace imports presets-api/src. The claimed 420 test lines is wrong: only the 2 describe blocks belong to these types, and the rest of types.test.ts covers live types.
  - Commands: git grep -n -w -e PresetCategory -e AuthSource -- apps/presets-api -> src/types.ts:23,38 (+198 comment), tests/types.test.ts:9,21,45,47,64,66, comment in categories.test.ts:289; git grep -e 'presets-api/src' -- apps packages -> comments only, no importer
- Origin: git grep @8ecb878f -> only types.ts:20 and :35 ('export type { AuthSource, AuthContext }'); #224 split out the line-38 AuthSource statement, but it was already test-only at main

## Fix
**REMOVE.** The PresetCategory test only assigns 5 valid literals, which compile with or without 'community' in the union, so deleting it loses no regression guard. Keep the other deprecated re-exports (PresetStatus, CommunityPreset, etc.), because src imports them.

Steps: 1) apps/presets-api/src/types.ts: delete line 23 (PresetCategory in the export type list) and lines 34-38 (the AuthSource @deprecated docblock + export). 2) apps/presets-api/tests/types.test.ts: delete import lines 9 and 21, the PresetCategory block at lines 41-59, and the AuthSource block at lines 60-71. 3) pnpm turbo run build type-check lint test --filter=...xivdyetools-presets-api && pnpm dead-code:check

## Status
OPEN
