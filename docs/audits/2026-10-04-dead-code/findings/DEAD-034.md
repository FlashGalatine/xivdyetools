# DEAD-034: Stale 'community' ternary in presets-api scripts/migrate-presets.ts is a never-taken branch: 1 line
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** apps/presets-api · **Semver:** NONE · **Category:** Dead Path · **Origin:** MAIN

## Location
- `apps/presets-api/scripts/migrate-presets.ts:81` — id !== 'community' ternary

## Evidence
- Only the ternary at line 81 is dead: no category key in packages/core/src/data/presets.json is 'community' (migration 0007 retired it), so isCurated is always 1. The duplicated generateDyeSignature (line 52) is LIVE (called at line 97); it is a duplicate, not dead code. The candidate's line 75 is wrong; the ternary is at line 81.
  - Commands: node -e keys(presets.json.categories) -> jobs, grand-companies, seasons, events, aesthetics, appearance, zones, raids-trials; grep -n isCurated scripts/migrate-presets.ts -> 81, 86; script live via package.json db:seed
- Origin: git show 8ecb878f:apps/presets-api/scripts/migrate-presets.ts | grep -n community -> 81; no preview-branch diff to this file

## Fix
**REMOVE.** Keep the script (live via db:seed). Optional separate refactor: share generateDyeSignature with src/services/preset-service.ts:40, but first check that the tsx script can import that module.

Steps: 1) apps/presets-api/scripts/migrate-presets.ts: delete line 81 (const isCurated ...) and change line 86 to emit `is_curated = 1`. 2) pnpm turbo run build type-check lint test --filter=...xivdyetools-presets-api && pnpm dead-code:check

## Status
REMOVED, NOT DEPLOYED — `a33842cc` (branch `fix/remediation-2026-10-04-sprint8`, presets-api 2.5.0; PR #256, open, on the join branch).
