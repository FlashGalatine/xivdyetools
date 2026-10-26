# DEAD-044: Exported unit-test seams in the chara resolver
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** api-worker · **Semver:** NONE · **Category:** Legacy
**Calibration:** Blast HIGH->LOW: these are api-worker app-internal exports (not published runtime API). Dropping the export keyword would break only tests, and the functions themselves stay on the production path.

## Location
- `apps/api-worker/src/chara/router.ts:76`
- `apps/api-worker/src/chara/resolver.ts:44,47,65,162`
- `apps/api-worker/src/chara/xivapi.ts:96,104,117,236`

## Evidence
- git grep -n -w per symbol over apps/packages/scripts: every one has a production call. parseResolveBody router.ts:193 (POST /resolve; index.ts:176 mounts /v1/chara). lookupsFor router.ts:216. indexRows lookup-loader.ts:56. MAX_ALTERNATES resolver.ts:135. pickGlasses resolver.ts:212. buildResolveQuery xivapi.ts:422 and parseItemRow xivapi.ts:439, both in searchItems (called at lookup-loader.ts:55). iconAssetUrl xivapi.ts:468 in fetchIcon (called at icons.ts:25). cleanName xivapi.ts:186-189. The only importers from other files are the *.test.ts files. build-item-names.mjs:182 has its own local cleanName, and the discord-worker hit is prose. dead-code-check.txt lists nothing under chara/.
- All nine symbols run on the live /v1/chara/resolve and icon paths in api-worker. Exporting them for unit tests is deliberate, and removing them would break the resolver at runtime. api-worker is not published (semver NONE). The blast is HIGH only because a wrong removal would hit production code. Revisit trigger: the CI step `pnpm dead-code:check` (.github/workflows/ci.yml:244) flags any of these symbols under apps/api-worker/src/chara, or a PR deletes one of the call sites cited above.
- Still live: POST /v1/chara/resolve handler at apps/api-worker/src/chara/router.ts:192, mounted at apps/api-worker/src/index.ts:176. XivapiClient.searchItems is called at lookup-loader.ts:55 and fetchIcon at icons.ts:25.

## Fix
- **KEEP** — revisit trigger: Re-audit when the CI `pnpm dead-code:check` step (ci.yml:244) reports any of these nine symbols under apps/api-worker/src/chara, or when a PR removes one of the production call sites: router.ts:193, router.ts:216, lookup-loader.ts:56, resolver.ts:135, resolver.ts:212, xivapi.ts:186-189, :422, :439, :468.
- Cascade: None.

## Status
OPEN
