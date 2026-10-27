# DEAD-019: types.ts re-exports CharaTwinRules, which nothing imports through it
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** api-worker · **Semver:** NONE · **Category:** Legacy
**Calibration:** Blast NONE->LOW: it removes an internal re-export in api-worker production source. The rubric reserves NONE for comment, doc or test-only changes.

## Location
- `apps/api-worker/src/chara/types.ts:19`

## Evidence
- git grep -n -w CharaTwinRules: api-worker hits only types.ts:16 (import), :19 (re-export), :67 (rules: CharaTwinRules[]). Every other hit (web-app chara-resolve-service.ts:19, bot-logic glamour.ts:38, core tests) imports it from '@xivdyetools/core', not from api-worker. git grep "from './types'" in apps/api-worker: importers (cache.ts:17, lookup-loader.ts:8, resolver.ts:28-38, router.ts:34-40, xivapi.ts:23, plus tests) name CharaGearModel, CharaGearSlotId, CharaItemRules, ItemRow, etc., but never CharaTwinRules. symrefs.sh api-worker CharaTwinRules: prod=0 tests=0. api-worker package.json "private": true, so no npm consumers. No references in scripts, workflows, wrangler or knip config.
- This is a type-only re-export with no importer. Its one use is local, at types.ts:67, which the kept import covers. Removing the name from the export list changes a single line and does not change the compiled JS. api-worker is a private app, so there is no published API to break. The worst case is a compile error in some future importer, and type-check would catch it.

## Fix
- **REMOVE** — Edit apps/api-worker/src/chara/types.ts:19 to read `export type { CharaGearModel, CharaGearSlotId, CharaItemRules };`. Keep `CharaTwinRules` in the import at lines 12-17, because line 67 (`rules: CharaTwinRules[]`) still uses it. No barrel, test or doc changes are needed. Gate: pnpm turbo run build type-check lint test --filter=...xivdyetools-api-worker
- Cascade: None. The import has to stay because types.ts:67 uses it.

## Status
OPEN — source prepared in A-API: remove only the unused internal `CharaTwinRules` re-export, preserving its local import and rules field; [API evidence](../../2026-10-26-security/evidence/remediation-api-2026-10-27.md). Merge and production acceptance remain pending.
