# [DEAD-035]: core — four legacy dual-signature overloads whose legacy shape has no production caller (+ a stale-default inconsistency discord-worker silently relies on)

## Category
Legacy Code — migrate-then-remove

## Location
| Overload | Legacy shape callers | After migration |
|---|---|---|
| `APIService` ctor (399-423): `options?: ICacheBackend \| APIServiceOptions, fetchClient?, rateLimiter?` + `isOptionsObject` sniffing | production **none** (web-app `api-service-wrapper.ts:206` passes `{cacheBackend, …}`); core tests `APIService.test.ts` ×15, `APIService.construction.test.ts` ×19 positional; README:69,231,288 + `test-build.mjs:61` | delete positional branch (~10 lines + `isOptionsObject`) |
| `CharacterColorService.findClosestDyes(color, dyeService, countOrOptions: number \| CharacterMatchOptions)` (316-341) | in-core `CharacterColorService.ts:387` (`…, 1)`) + `CharacterColorService.test.ts:194,288,320`; web-app passes options | migrate 1 in-core call + 3 tests, drop `number` |
| `DyeSearch.findClosestDye(hex, excludeIdsOrOptions: number[] \| FindClosestOptions)` (164-172) & `DyeService.findClosestDye` (211-215) | in-core `HarmonyGenerator.ts:128`; web-app test `dye-service.test.ts:171`; all app/bot-logic callers pass options or nothing | migrate 1 in-core call + 1 web-app test, drop array form |
| `DyeSearch.findDyesWithinDistance(hex, maxDistanceOrOptions: number \| FindWithinDistanceOptions, limit?)` (255-272) & `DyeService` (225-234) | production **none** (api-worker, discord-worker, web-app ×2 pass options); core `DyeSearch.test.ts:340-373, 561-583` numeric; README:153,376 numeric | migrate tests + README, drop `number` + trailing `limit` |

≈40 src lines removable after ≈60 lines of test/README rewrites. Note: **no `@deprecated` tag exists anywhere in `packages/core/src`** — the legacy arms are undocumented as legacy.

**Not dead but flagged (stale-default inconsistency):** `DyeSearch.findDyesWithinDistance` defaults `matchingMethod='rgb'` ("for backwards compatibility", DyeSearch.ts:32/272) while `findClosestDye` defaults `'ciede2000'` (175). discord-worker `extractor.ts:121-124` calls it without `matchingMethod` and therefore gets an RGB neighbourhood while its primary match used the user's method. Fix the caller (pass the method) before or instead of changing the default.

**KEEP (live compat):** `LEGACY_MATCHING_METHOD_MAP` (api-worker + og-worker still accept `euclidean/hyab/oklch-weighted`), `LEGACY_FACEWEAR_ITEM_IDS` (frozen), `DyeDatabase.ts:120-232` legacy `id`/`itemID`/`price` acceptance (cheap; tighten once all fixtures are schema-v2).

## Evidence
`evidence/track-B-core.md` §3.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH (callers enumerated) |
| **Blast Radius** | LOW–MEDIUM — public signatures narrow (semver-minor for npm; in-repo callers all already use the new shape) |
| **Reversibility** | EASY |

## Recommendation
**REFACTOR FIRST** — migrate the in-core calls/tests/README, add `@deprecated` for one release if you want a grace period, then remove. Fix `extractor.ts:121` separately.
