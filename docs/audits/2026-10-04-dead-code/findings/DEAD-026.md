# DEAD-026: getPreset in moderation-worker services/preset-api.ts is test-only: 13 src lines + 34 test lines
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** apps/moderation-worker · **Semver:** NONE · **Category:** Test-only · **Origin:** MAIN

## Location
- `apps/moderation-worker/src/services/preset-api.ts:353` — getPreset

## Evidence
- No production caller in the unit. All 7 handlers use `import * as presetApi`, there is no `presetApi.getPreset` call and no computed `presetApi[...]` access. The other repo hits are separate same-named functions in discord-worker, web-app and core, not imports.
  - Commands: git grep -n -w getPreset -- apps/moderation-worker: preset-api.ts:353 def, CHANGELOG:268, preset-api.test.ts:7,328-353,894-896 only; git grep 'presetApi\[' apps/moderation-worker: none; main 8ecb878f: def at :316 and tests only
- Origin: git grep -n -w getPreset 8ecb878f -- apps/moderation-worker shows only preset-api.ts:316 def and test hits; git log 8ecb878f..HEAD -S'getPreset(' -- apps/moderation-worker is empty

## Fix
**REMOVE.** pathSegment (5 other callers) and the CommunityPreset import (used at :429-498) stay. A future single-preset fetch would re-add it.

Steps: 1. In apps/moderation-worker/src/services/preset-api.ts, delete lines 350-362 (docblock + getPreset).
2. In preset-api.test.ts, delete the import at line 7, the describe('getPreset') block at lines 328-355, and the 'getPreset encodes the preset id' test at lines 894-898.
3. Run `pnpm turbo run build type-check lint test --filter=...xivdyetools-moderation-worker`, then `pnpm dead-code:check`.

## Status
OPEN
