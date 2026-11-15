# Review api-og: chara resolve backend (api-worker) and OG consumers (og-worker)

HEAD 88189ee8. Read-only. Deploy units: `xivdyetools-api-worker@0.21.0`, `xivdyetools-og-worker@2.12.0`
(both private apps, so every removal is semver NONE).

## Module map

| File | Role | Reached from |
|---|---|---|
| `apps/api-worker/src/chara/router.ts` | `POST /resolve`, `GET /icon/:iconId` | `src/index.ts` (`charaRouter`) |
| `resolver.ts` | pure naming rules | router, lookup-loader (`indexRows`) |
| `lookup-loader.ts` | isolate-local pending-key coalescing | router |
| `cache.ts` | per-key Cache API row store (`chara-resolve`) | router, lookup-loader |
| `xivapi.ts` | XIVAPI v2 client, context discovery | router, lookup-loader, icons, icon-cache |
| `icons.ts` / `icon-cache.ts` | icon refresh + binary cache (`chara-icons`) | router |
| `acquisition.ts` / `regional-names.ts` | lazy build-time tables | router (load), resolver (read) |
| `types.ts` | shapes + re-export of 4 core types | all of the above |
| `data/*.json` | build-time tables | see data table below |
| `scripts/build-item-names.mjs`, `scripts/build-acquisition.ts`, `scripts/acquisition/*` | hand-run generators | manual (documented in api-worker CLAUDE.md); `tests/acquisition/*` |
| `apps/og-worker/src/services/character-cells.ts` | Swatch `?slot=&i=` cell → hex | `og-data-generator.ts:26,1016-1018` |
| og-worker glamour | `og-data-generator.ts:1083-1086` default card only; `index.ts:110,741` | crawler `/glamour` |

Neither unit imports `xivcharakit` directly (`git grep -n -i xivcharakit -- apps/api-worker apps/og-worker` → no hits).
api-worker consumes core's own model helpers through the main barrel (`CHARA_SLOT_SEARCH_FIELD`, `charaModelKey`,
`isCharaWeaponSlot`, `isWornCharaModel`, `groupCharaTwinRules`, `CHARA_WEAR_RACE_COLUMNS`, `charaWearMask`); none
of them is in `packages/core/src/chara.ts` (the `/chara` subpath exports only `inspectCharaForTools`,
`resolveCharaWithProvider` + 4 types), so the barrel import is the only route — not a redundant re-export on this side.

## Reference tables

### Exports (bash docs/audits/.../scripts/symrefs.sh apps/api-worker <66 symbols>; then `git grep -l -w <sym> -- 'apps/*.ts' 'packages/*.ts' 'apps/*.mjs'`)

In-file-only exports (only file that names them is the defining file):
`CHARA_CACHE_CONFIG` (cache.ts), `XivapiEnv`, `DEFAULT_XIVAPI_BASE`, `DEFAULT_XIVAPI_VERSION` (xivapi.ts),
`RegionalNames` (regional-names.ts), `IconPayload` (icons.ts), `ICON_RETAIN_MS` (icon-cache.ts), `RowSource` (resolver.ts).
knip misses them because root `knip.jsonc:43` sets `"ignoreExportsUsedInFile": true`.

Exported test seams (live in prod in-file, external importer is a test only):
`parseResolveBody` (router.test), `pickGlasses`, `MAX_ALTERNATES` (resolver.test), `buildResolveQuery`,
`iconAssetUrl`, `parseItemRow` (xivapi.test). `cleanName`: the discord-worker hit is prose naming
`build-item-names.mjs`'s own private `cleanName` (item-name-coverage.test.ts:106), not an import.

Every class member is referenced from prod: XivapiClient.{resolveContext,resolveAssetContext,searchItems,getGlasses,fetchIcon},
CharaRowCache.{getRows,storeRows,getGlasses,storeGlasses}, CharaLookupLoader.{loadRows,loadGlasses},
CharaIconCache.{get,put} (router.ts:319-323, icons.ts:21).

### Resolve response fields vs clients (git grep -w over web-app/src, bot-logic/src, discord-worker/src, core/src, svg/src, non-test)

| Field | Read by |
|---|---|
| itemId, names, alternates[].{itemId,names,acquisition}, acquisition | web-app glamour-block / glamour-list-actions, bot-logic glamour.ts |
| iconId | web-app glamour-block.ts (charaIconUrl) |
| familySize, viaMainHand, uiCategory, retired, rules | web-app + bot-logic glamour.ts |
| glasses.{id,names,iconId,acquisition} | web-app glamour-block.ts:1178, glamour-list-actions.ts:125,202,204; bot glamour.ts:563 (names) |
| **version** | **nobody**: web-app copies it (chara-resolve-service.ts:229) and never reads `.version`; glamour-block.ts:388 only writes `version: null`; discord-worker ResolveEnvelope (glamour.ts:47) omits it |

### Icon route callers (`git grep -n "chara/icon"`): web-app `charaIconUrl` (chara-resolve-service.ts:125) — unversioned. No in-repo caller sends `?version=`.

### Data files

| File | Runtime reader | Other readers |
|---|---|---|
| acquisition.en.json (24,922 keys) | acquisition.ts:24 (lazy import) | acquisition.test, lazy-tables.test, tests/acquisition/table.test |
| acquisition.meta.json | none | build-acquisition.ts:387 (`--pinned`: teamcraftCommit, xivapiVersion), table.test.ts:72 (`generated`); other 12 keys are human-review provenance (plan 2026-09-27 step "Stop and show the user") |
| facewear-unlocks.json (732 Glasses → 61 items) | acquisition.ts:12 | acquisition.test |
| item-names.ko/zh.json | regional-names.ts:31-32 | lazy-tables.test |
| item-names.ja.json | none in api-worker (by design) | discord-worker scripts/subset-cjk-fonts.py, item-name-coverage.test |
| item-names.meta.json | none | build-item-names.mjs:54 (rewrite) |

python cross-check: 60 acquisition keys are outside the ja (equippable) universe = the 60 lined facewear unlock items;
12 Glasses rows (709–720) map to unlock item 52447 which has no acquisition line, so `facewearAcquisitionFor` answers undefined for them.

### Generators

Every `scripts/acquisition/*` export is reached from `build-acquisition.ts` or another stage (git grep table in transcript);
every `Inputs`/`Tables` field has a reader in sources/select/format; every `tables/*.json` is read by build-acquisition.ts:278.
No migration code for any row-shape version exists — the shape is only a key component (cache.ts:36,44; lookup-loader.ts:51).
`git grep -n -E "\.(skip|todo|only)\(|xit\(" -- apps/api-worker/src/chara apps/api-worker/tests apps/og-worker/src` → none.

## Candidates

### api-og-01 Stale icon caching claims (Legacy doc) — REMOVE (rewrite)
Since 4b03e9e8 (2026-10-20) the unversioned URL answers `public, max-age=300, must-revalidate` (router.ts:331-334).
Still claiming 30-day immutable: `apps/api-worker/README.md:27` ("edge-cached 30 d immutable"),
`apps/api-worker/docs/guide/responses.md:102` (`public, max-age=2592000, immutable` for the route),
`docs/user-guides/public-api.md:150` ("PNG, long-cached" on an unversioned URL). The reference page
(docs/reference/chara.md:107) and docs/projects/api-worker/endpoints.md:371 are correct. Cascade: none. 3 lines rewritten.

### api-og-02 Stale consumer claim "Swatch Matcher 11a/11c" (Legacy doc) — REMOVE (rewrite)
DYES ON THIS GLAMOUR moved to the Glamour Reader in e6aba41d (2026-09-27); swatch-tool.ts:1374 says so; the resolve
consumers are glamour-block/glamour-tool and discord-worker /glamour. Still naming Swatch: `apps/api-worker/CLAUDE.md:118`,
`apps/api-worker/docs/reference/chara.md:5`, `docs/developer-guides/environment-variables.md:255`. Already correct:
docs/projects/api-worker/endpoints.md:363. Cascade (web-app reviewer): apps/web-app/CLAUDE.md:136, chara-resolve-service.ts:3. 3 lines.

### api-og-03 Stale "`latest` resolved through `/api/version`" (Legacy doc) — REMOVE (rewrite)
1b3fabd4 (2026-10-20) replaced `/api/version` with a bounded `GET /api/sheet/Item/1` probe (xivapi.ts:318-344) and the
namespace became `JSON.stringify([base, version, schema])` (xivapi.ts:314). Stale: `apps/api-worker/README.md:194`,
`apps/api-worker/src/types.ts:55-57` ("A real key is also the row-cache namespace" — a canonical version without a
canonical schema is still discovered, xivapi.ts:271). 2 places, ~4 lines.

### api-og-04 Eight in-file-only exports (Unused Export) — REMOVE (drop `export`)
CHARA_CACHE_CONFIG cache.ts:21, XivapiEnv xivapi.ts:25, DEFAULT_XIVAPI_BASE :31, DEFAULT_XIVAPI_VERSION :32,
RegionalNames regional-names.ts:46, IconPayload icons.ts:9, ICON_RETAIN_MS icon-cache.ts:7, RowSource resolver.ts:173.
Proof: each `git grep -l -w` over all tracked apps/packages .ts/.mjs lists only its own file. 0 lines (keyword only).

### api-og-05 Chara row cache "stale-while-revalidate" never revalidates (Dead Path) — REFACTOR FIRST
cache.ts:20-25 configures `swrWindow: 24h` and documents "one day of stale-while-revalidate headroom", but
`CharaRowCache.getRows/getGlasses` (cache.ts:60-64,79-82) never read `isStale` (`git grep -n isStale -- apps/api-worker/src`
→ only universalis/*). A stale entry replays as a fresh HIT for the extra day; nothing revalidates. Behaviour is an
8-day TTL. Fix: either state it (cacheTtl 8 d, swrWindow 0, comment) or treat stale as a miss. Cascade: api-worker
CLAUDE.md "Row staleness behavior is unchanged" wording. ~2 lines.

### api-og-06 Orphaned comment in POST /resolve (Legacy comment) — REMOVE
router.ts:202-206 ("Same cast as the Universalis router … OPT-004 dropped the origin argument …") described the
`new CharaRowCache(c.executionCtx as ExecutionContext, origin)` line (0bc669e4:router.ts:199-203). 1b3fabd4 inserted the
context capture between, so the comment now sits above `resolveContext()` and talks about an argument that no longer exists. 5 lines.

### api-og-07 Redundant `=== 503` (Dead Path) — REMOVE
xivapi.ts:399 `response.status === 503 || response.status >= 500 || …`: 503 is subsumed by `>= 500`. 0 lines.

### api-og-08 `types.ts` re-exports CharaTwinRules with no importer (Redundant Re-export) — REMOVE
types.ts:19 re-exports 4 core types; router/resolver import CharaGearModel/CharaGearSlotId and xivapi.ts:23 CharaItemRules
through './types.js'; CharaTwinRules is used only inside types.ts:67. 0 lines (name removed from the list).

### api-og-09 Unreachable "304 without a retained ETag" guard (Dead Path) — KEEP
icons.ts:27-28. `fetchIcon` sends If-None-Match only when `retained?.etag` (icons.ts:25), and `XivapiClient.get` returns a 304
only when `allowNotModified` (= If-None-Match sent, xivapi.ts:395,471); otherwise the 3xx branch throws first (xivapi.ts:396).
The test "refuses an unsolicited 304" (icons.test.ts:102) actually exercises xivapi.ts:396. Trigger: keep as the
cross-module invariant guard; revisit if `get()` ever passes 304 without the flag. Optional: retitle the test.

### api-og-10 Empty-lookup guards reachable only from tests (Dead Path) — KEEP
xivapi.ts:418 and lookup-loader.ts:69-70. router.ts:225 calls `loadRows` only when `misses.length > 0`, misses come from
deduped `lookupsFor`; loader dedupes again before `searchItems`. Only lookup-loader.test.ts:115 and xivapi.test.ts:430-441
reach them. Trigger: a second caller of these public methods.

### api-og-11 Response `version` field read by no in-repo client (Unused field) — KEEP
See field table. Public, documented (docs/reference/chara.md:60). Also `null` whenever fully cached (types.ts:106), so it
cannot be used to pin icons reliably. Trigger: a v2 of the resolve contract; web-app may drop its copy (web-app reviewer).

### api-og-12 Icon `?version=` branch has no in-repo caller — KEEP
router.ts:306-314,332-334 and xivapi.ts:296. web-app sends unversioned URLs only. Documented public parameter
(docs/reference/chara.md:103). Trigger: drop only with a public-API deprecation.

### api-og-13 Exported unit-test seams (Test-only) — KEEP
parseResolveBody, pickGlasses, MAX_ALTERNATES, buildResolveQuery, iconAssetUrl, parseItemRow, indexRows, lookupsFor: all
called in prod in-file; `export` exists for unit tests. dead-code:check correctly ignores them (prod references exist).

### api-og-14 `tests/chara-concurrency.test.mjs` runs in no CI (Stale Test risk) — KEEP
Run only by `test:chara-runtime` (package.json:22); `git grep -n "test:chara-runtime\|chara-concurrency"` → CLAUDE.md:202,
docs/projects/api-worker/overview.md:72 only; vitest include (`tests/**/*.test.ts`) skips `.mjs`. Trigger: if it is not
run at the next lookup-loader change, wire it into CI or delete it.

### api-og-15 facewear-unlocks rows that can never yield a line (Dead Asset, data) — KEEP
12 Glasses rows 709–720 → item 52447, absent from acquisition.en.json (python check). Harmless; regenerating after
item 52447 gains a source fixes it. Trigger: next build-acquisition run.

### api-og-16 acquisition.meta.json provenance keys read by no code — KEEP
12 of 15 keys are read only by a human reviewer (plan step) — that is their purpose.

## KEEP / positives (not candidates)
- og-worker `character-cells.ts` is live: swatch-tool.ts:2539-2551 emits `slot`+`i`; og-data-generator.ts:1009-1018 reads them.
- og-worker swatch `?hex=`/`?color=` fallback (og-data-generator.ts:1026) is live: swatch-tool still reads `params.color`/`params.hex`.
- og-worker has no XIVCharaKit-era code; glamour is a default card by design (og-data-generator.ts:1083-1086).
- No cache-shape migration code; superseded key builders do not exist (shape is a key component).
- Generators: no unrun script, no unread Inputs/Tables field, no unproduced Source/Entry kind that format/select lacks.

## FILES COVERED
apps/api-worker/src/chara/{router,resolver,types,cache,lookup-loader,xivapi,icons,icon-cache,acquisition,regional-names}.ts
and their tests (titles + targeted reads), src/chara/data/* (key-level python check), scripts/build-item-names.mjs (header,
flags), scripts/build-acquisition.ts (flags, table reads), scripts/acquisition/*.ts (export + field tables),
tests/acquisition/* (imports), tests/chara-concurrency.test.mjs (header), apps/api-worker/{README.md,CLAUDE.md,package.json,
vitest.config.ts}, docs/reference/chara.md, docs/guide/responses.md, docs/.vitepress/theme/lib/endpoints.ts (chara rows),
apps/api-worker/src/types.ts (XIVAPI vars), universalis/services/cache-service.ts (get), og-worker services/character-cells.ts,
og-data-generator.ts (swatch + glamour cases), index.ts (glamour lines), docs/projects/api-worker/{endpoints,overview}.md,
docs/developer-guides/environment-variables.md, docs/user-guides/public-api.md.
