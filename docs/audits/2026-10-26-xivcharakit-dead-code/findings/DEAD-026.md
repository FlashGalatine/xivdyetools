# DEAD-026: Eight api-worker chara exports referenced only in their own file (live symbols, redundant export keyword)
**Confidence:** HIGH · **Blast radius:** NONE · **Deploy unit:** api-worker · **Semver:** NONE · **Category:** Legacy

## Location
- `apps/api-worker/src/chara/cache.ts:21`
- `apps/api-worker/src/chara/xivapi.ts:25,31,32`
- `apps/api-worker/src/chara/regional-names.ts:46`

## Evidence
- git grep -n -w for all 8 symbols over tracked files (minus this audit's dir): every non-docs hit is in the defining file (CHARA_CACHE_CONFIG cache.ts:21,44,74,89; XivapiEnv xivapi.ts:25,263; DEFAULT_XIVAPI_BASE :31,264; DEFAULT_XIVAPI_VERSION :32,265; RegionalNames regional-names.ts:46,51,54; IconPayload icons.ts:9,20; ICON_RETAIN_MS icon-cache.ts:7,42,57; RowSource resolver.ts:173,181). No namespace/dynamic import of these modules; tests import none. All 8 are live at runtime; only `export` is redundant. api-worker tsconfig declaration:false so dropping export compiles. knip.jsonc:42-43 deliberately sets ignoreExportsUsedInFile ("Drop-the-export is churn"); 2026-10-04 audit review-api-worker.md:16 saw the same set and declined to file.
- The factual claim holds for all eight (no reference outside the defining file), but nothing is dead: each symbol is used at runtime, so removal deletes 0 lines. The REMOVE rec contradicts a documented repo decision (knip.jsonc:42-43 ignoreExportsUsedInFile, "Drop-the-export is churn"), already applied to this exact set by the 2026-10-04 audit. Four of the eight are types in exported signatures, and un-exporting them would stop callers and tests from naming those types. Narrow part: the four constants could lose `export` harmlessly (private app, semver NONE), but that is only cosmetic.
- Refuter (PARTIAL verdict): The factual part holds. All 8 symbols are exported, nothing outside their own files imports them, and the cited lines are correct. Dropping `export` is technically safe: api-worker is an unpublished app built with declaration:false and noEmit. But none of this is dead code. Every symbol is used at runtime, the change removes 0 lines, and the repo has a written policy (knip.jsonc:41-43, the comment quoted in the proof) that calls this exact edit churn. The 2026-10-04 audit reviewed the same symbols and deliberately did not file them. So the REMOVE recommendation is rejected, and the narrower result is KEEP. Revisit trigger: the root knip.jsonc changes ignoreExportsUsedInFile to false, or the dead-code-finder skill adopts a no-in-file-only-exports rule.
- Still live: In-file runtime use only: cache.ts:44,74,89; xivapi.ts:263-265; regional-names.ts:51,54; icons.ts:20; icon-cache.ts:42,57; resolver.ts:181.

## Fix
- **KEEP** — revisit trigger: Revisit if knip.jsonc ignoreExportsUsedInFile is changed to false, or if knip starts flagging these exports in api-worker's lint:dead. At that point, un-export only the four constants.
- Cascade: None. No importers, barrels, tests, docs or configs reference these symbols outside their own files, and no published package is involved.

## Status
OPEN
