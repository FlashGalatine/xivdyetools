# By-time sweep: web-app / og-worker / api-worker / core / svg (key: by-time-frontend)

Run 2026-10-11 at 42c35e87. Range: `git log --since=2026-09-21 --no-merges` over the five units (about 150 commits). Pure CHANGELOG, version-row, dependency-bump and test-only commits were skipped. HEAD source equals served source (16a6123f), so claims are checked against HEAD.

## Candidates

### cand-by-time-frontend-01 (MEDIUM, inaccurate)
- Doc: docs/projects/web-app/components.md:191. Claim: the bundle gate "reports JS payload (one locale) against a 2,200 KB total with per-chunk limits (60 KB default)".
- Truth: the payload limit is 2250 KB since 5.13.0 (tenth tool). 2800 KB is the separate all-locales artifact limit. The 60 KB default is correct.
- Evidence: apps/web-app/scripts/check-bundle-size.js:200 `PAYLOAD_JS_LIMIT = 2250 * KB`; comment at :193-199 ("5.13.0 raises it to 2250 KB"); :175 `DEFAULT_CHUNK_LIMIT = 60 * KB`. Commit b29b9562.
- Fix: change "2,200 KB" to "2,250 KB".

### cand-by-time-frontend-02 (LOW, inaccurate)
- Doc: docs/projects/web-app/components.md:197. Claim: "1,152 keys per language".
- Truth: 1,177 leaf keys in each of the six locales. The same counting method gave 1,152 at 7e0a30f9 (the 2026-09-05 audit), so the number is stale, not mis-counted.
- Evidence: leaf count over apps/web-app/src/locales/{en,ja,de,fr,ko,zh}.json = 1177 each.
- Fix: "1,177 keys per language", or drop the figure (it moves every sprint).

### cand-by-time-frontend-03 (LOW, inaccurate)
- Docs: docs/projects/web-app/components.md:163; docs/projects/web-app/tools.md:91. Claim: MixerBlendingEngine exports `blendColors` and `findMatchingDyes`.
- Truth: `blendColors` (the n-ary blend) was removed with its barrel re-export by 057cba2f (Sprint 23, mixer is a pair). Exports are `blendTwoColors`, `calculateColorDistance`, `findMatchingDyes`, `getContrastColor`.
- Evidence: apps/web-app/src/services/mixer-blending-engine.ts:69,106,128,168; `git grep blendColors` in that file = 0 hits; apps/web-app/src/services/index.ts:38.
- Fix: replace `blendColors` with `blendTwoColors` in both lines.

### cand-by-time-frontend-04 (LOW, inaccurate)
- Doc: docs/user-guides/web-app/color-harmony.md:51. Claim: the strip reads "Prices unavailable — the market board did not answer. Colour matching is unaffected — only the price lines are missing."
- Truth: shipped strings are title "Prices unavailable" and body "The market board did not answer. Color matching is unaffected — only the price lines are missing." The guide quotes a UI string so a reader can find it, but quotes it with a British spelling the UI does not use.
- Evidence: apps/web-app/src/locales/en.json:296-297 (`marketFailTitle`, `marketFailBody`). Origin: 647d8f9c (BUG-090).
- Fix: quote "Color matching is unaffected" exactly.

### cand-by-time-frontend-05 (LOW, missing)
- Docs: docs/projects/core/services.md (APIService section, ~205-218); packages/core/CLAUDE.md:156-158. Both list `getPricesForDataCenter`, `isAPIAvailable`, `getAPIStatus`, `clearCache`, `formatPrice` and stop there.
- Truth: core 5.9.0 (742a3061) added `getPricesForDataCenterWithOutcome()` returning `PriceBatchResult` (`outcome: 'ok' | 'partial' | 'error'`), exported `PriceBatchOutcome` and `PriceBatchResult`, and exported `CHARA_DYEABLE_SLOTS`. The web app's market-outage badge reads this outcome.
- Evidence: packages/core/src/services/APIService.ts:346-360,1060-1063; packages/core/src/index.ts (export block in 742a3061). `git grep -n "WithOutcome\|PriceBatch\|CHARA_DYEABLE" -- docs packages/core/CLAUDE.md packages/core/README.md` returns no living-doc hit.
- Fix: add one line for the method and the two types, and one for `CHARA_DYEABLE_SLOTS` (the single dyeable-slot set shared by the GPOSERS writer and the Glamour Reader chips).

### cand-by-time-frontend-06 (LOW, missing)
- Doc: docs/user-guides/web-app/glamour-reader.md:56-62 ("What is checked") and :95-104. Neither mentions the neutral note on a retired-only family.
- Truth: since 8f57c1e8 a piece whose whole family is retired is named, not "no item", and its note ends "A retired item, no longer obtainable". api-worker endpoints.md and chara.md were updated; the user guide was not.
- Evidence: apps/web-app/src/locales/en.json:1342 (`glamour.row.retired`); apps/web-app/src/components/glamour-block.ts (retired note appended after the verdict note); apps/api-worker/src/chara/types.ts:64-69.
- Fix: add a sentence under "An item behind the model": a family with only retired items is still named and reads "A retired item, no longer obtainable".

All six are leads. Severity is held low: no operator-facing or data-affecting advice is wrong.

## Per-commit coverage

| file (commit + subject) | tier | units | sections reviewed | result |
|---|---|---|---|---|
| 147a8e4a api-worker 0.18.0 / web-app 5.15.0 docs and version rows | living | api-worker, web-app | versions.md:120 row | reviewed |
| 8f57c1e8 name a retired-only family | living | api-worker, web-app | endpoints.md:365, chara.md, glamour-reader.md | reviewed (cand-06) |
| 12bd71b1, d5ac5362, dde82ec7, 1e6242b1, eab54eb2, 03979111, d92dd5b2, c6d67f64, 80393a08 changelog and version-row commits | living | web-app | changelog/version rows only | reviewed |
| ae815cda custom-color menu, active palette chip, slot pick | living | web-app | grep tools.md and components.md for menu and chip terms; no stale claim | reviewed |
| 2c07739a policy documents last-updated date | policy | web-app, discord-worker | policy files belong to other reviewers | unverified (not this angle) |
| ce5dbd60, de4d9aad, 34b6b570, 9d9e1425, 3e2efeb8, 83a2ea6a acquisition data fixes | living | api-worker | data edits to the build-time table; endpoints.md:365 is generic | reviewed |
| 2428f144 facewear unlock sources | living | api-worker, web-app | apps/api-worker/docs/reference/chara.md:72 already updated | reviewed |
| f45b3f04 re-budget core runtime chunk | living | web-app | check-bundle-size.js vs components.md:191 | reviewed (cand-01) |
| 26e43a64 CI Sprint 20 | living | repo | root CLAUDE.md CI section | reviewed, accurate |
| 6818070b api-worker 0.17.0 | living | api-worker | telemetry 240/60 s (environment-variables.md:281,376), strict params, 10-minute `latest` cache (endpoints.md:365), lazy tables | reviewed, accurate |
| 261f1a13 og-worker 2.12.0 | living | og-worker | og-worker/overview.md:117,154-172,277 | reviewed, accurate |
| 031458ae Glamour Reader drop zone | living | web-app | tools.md:201 | reviewed, accurate |
| fa56ae8a, 6cc934c3 Japanese item names, ja cards | living | discord-worker, api-worker | rendering.md:44; environment-variables.md:267 | reviewed, accurate |
| 290b1bb7, e48dd7ab, 49e6f31a core 5.10.0 grey mixes, locale build, sheet names | living | core, og-worker | core CLAUDE.md:300-312 (commit says living docs followed) | reviewed |
| 4d7df6c2 svg 4.4.0 | living | svg | card docs not contradicted | reviewed |
| 7c187084, ccda155f, 51a058de Sprint 29 workspace refactors | living | web-app | tools.md, components.md (leftPanel === rightPanel still true) | reviewed |
| 647d8f9c, 742a3061 Sprint 27 outage, CN/KR data centers, CHARA_DYEABLE_SLOTS | living | core, web-app | color-harmony.md:51, budget-suggestions.md:34, core services.md | reviewed (cand-04, cand-05) |
| fcc0b76f, bf1611a0, 60e89446, 85a16dcf, 7763d4e1, 057cba2f, 9dc5f75d Sprint 23 dead-code removals | living | web-app | components.md:82,92,163; WorldService, IndexedDB, APIService mentions | reviewed (cand-03) |
| 2023108b, 8a826c40, 3d5b84bd, ccfc0d81 Sprint 22 LOWs | living | web-app | validate-i18n docs, keyboard line components.md:130, Mixer pair | reviewed, accurate |
| c85fd23a, e7ad0bc8, bf332ddd, 3f662657, 91de5f8d, 59cc1d6a, 3daa83fd, 915b9127, 1f752c80 policy copy | policy | web-app | policy documents belong to other reviewers | unverified (not this angle) |
| 31c8914f, c88d51c6 Sprint 6 translations | living | web-app, core | terminology belongs to the i18n handoff | unverified |
| ad87be42, 665bf564 Sprint 5 tool correctness | living | web-app | tools.md:213 handoff and `dye` param | reviewed, accurate |
| ce5d71cf, b667d98d, e5a612b5, 10f6f881 Sprint 4 presets | living | web-app | components.md:157; core PresetService still has the methods the web wrapper lost | reviewed |
| a6fbd078, 68599b74, f20683f8, 924a1c35 Sprint 1 ConfigController | living | web-app | tools.md:13,158; components.md:168-176 | reviewed, accurate |
| a4a769f5 core 5.8.1 Korean names | living | core | no doc states old values | reviewed |
| d1f9e5c5, 1eaefd63 api-worker route removal, 0.16.1 | living | api-worker | overview.md:127; DOMAIN_DEPRECATION.md:45 | reviewed, accurate |
| 7c97fc1d og-worker 2.11.1 Workers Logs off | living | og-worker | root CLAUDE.md workers:check-logs gate | reviewed |
| 61b7077b web-app 5.13.3 beta headers | living | web-app | no living doc contradicts | reviewed |
| b29b9562 and the Glamour Reader 5.13.0 feature set (adc815a4, e6aba41d, 71f88d7f, 78ba2cda, 0e83fe74) | living | web-app, core, svg, api-worker | tools.md:197-209, glamour-reader.md, endpoints.md:365; anchor `#10-glamour-reader--design-1a1b--export-sheet-2c` resolves to tools.md:197 | reviewed, accurate |
| bfd393e7, 70e2482b /glamour bot; fbdc8c60, a9e6b37a slot labels | living | discord-worker, svg | command-reference.md:144-148 | reviewed, accurate |
| 975175da, 31c72cce, 5f0763ec og-worker Glamour Reader card | living | og-worker | overview.md route table | reviewed |
| 8ee1b689, 601dc4c0, b65ac15d, 8b6b0532 core .chara fixes (5.6.0, 5.7.0) | living | core | living docs not contradicted | reviewed |
| 6481d1c8, 6bfdae81, 0c74244e, 6628080e .chara persistence and drop race | living | web-app | components.md:173, tools.md:201 | reviewed, accurate |
| 063e88b6, e15928b2, e7d8daa5, 47190a5f ten-tool wording | living | web-app | tools.md:3,9,213; components.md:130; remaining "nine tools" hits (overview.md:329, index.md:260) are og-worker v2.0.0 history | reviewed, accurate |
| 559a219c, 6e9159f2, cda81279, 12af7a49, b36fd5a5 acquisition 0.15.0 | living | api-worker | endpoints.md:365 | reviewed, accurate |
| 43ee47e7, d25f37e4, 215cfa42, 404105f7 dependency bumps | living | all | skipped | reviewed |

## Positive controls
- docs/projects/web-app/tools.md:158 (Budget fetches its own prices; sidebar hides Enable Market Board) matches config-sidebar.ts in a6fbd078 and en.json `enableMarketBoard`.
- docs/projects/web-app/components.md:92 lists exactly the surviving state icons (state-icons.ts:23-35).
- docs/developer-guides/environment-variables.md:281,376 give 240/60 s for telemetry, as in api-worker src/index.ts:119-131.
- docs/projects/og-worker/overview.md:172 documents `interpolation` with the five spellings introduced by 261f1a13.
- docs/projects/api-worker/endpoints.md:365 already describes `retired: true` and the lazy table load.
- tools.md:182 anchor link `#10-glamour-reader--design-1a1b--export-sheet-2c` resolves (heading tools.md:197), which docs:check-links does not test.

## Rejected suspicions
- components.md:82 lists context actions as `inspect-*`, `transform-*`, `external-*`: these are the live groups after bf1611a0; `add-mixer-slot-1/2` is a slot-picker pair (result-card.ts:90-129). Incomplete at most, and the line does not claim completeness.
- tools.md:182 "a blank Acquisition: line": the same sentence continues "Since 5.13.0 ... export sheet", and :207 documents the filled field. History, not stale.
- docs/index.md:260 and architecture/overview.md:329 "nine tools": og-worker v2.0.0 release text, a past release.
- specifications/community-presets.md `HybridPresetService` sketch and `GET /presets/featured`: spec-tier design text; the presets-api route still exists.
- core services.md `getPresetWithDyes`, `searchPresets`, `getRandomPreset`: core `PresetService` still exports them; only the web wrapper methods were removed.

## Spelling per document

Raw line-level matches of the colour/centre/-ise/behaviour/favourite family in files I opened; not deduplicated and not filtered for identifiers or the standing rejections. The american-spelling gate owns the authoritative count.

| doc | matches |
|---|---|
| docs/user-guides/web-app/color-harmony.md | 16 |
| docs/user-guides/web-app/palette-extractor.md | 27 |
| docs/user-guides/web-app/glamour-reader.md | 0 |
| docs/projects/web-app/components.md | 15 |
| docs/projects/web-app/tools.md | 37 |
| docs/projects/api-worker/endpoints.md | 10 |
| docs/projects/api-worker/overview.md | 3 |
| docs/projects/og-worker/overview.md | 3 |
| docs/projects/core/services.md | 3 |

palette-extractor.md:75 reads "data centre" where the shipped UI says "Data Center"; left to the spelling count.
