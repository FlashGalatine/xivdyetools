# XIVAPI offloading research — issue #322

**Date:** 2026-10-20  
**Status:** Research complete; implementation and data changes not approved or performed.  
**Issue:** [#322](https://github.com/FlashGalatine/xivdyetools/issues/322)  
**Repository baseline:** `b98c8584a85f5dc50b4b4392c508cc627ef004d6` (main). Open PR #321 is excluded.

**Same-day follow-up:** [Complete dye-list discovery](DYE_DISCOVERY.md) verifies full Stain enumeration (129 rows: 125 named dyes, No Color and three blank rows) and extends the proposed first change to detect future additions, including previously blank rows.

## Recommendation

Use XIVAPI more effectively as a **maintenance-time source for reviewed game-data snapshots**. Keep the existing shared API-worker integration for equipment and icons. The first change should be a **pinned, report-only Stain comparison command**: it should propose no automatic production-data edits and introduce no network dependency into normal builds.

A wholesale runtime replacement of the dye database would trade a small bundled dataset for new latency and availability dependencies. The larger bundled resources either need regional sources or local interpretation that XIVAPI does not replace.

The comparison found real migration work: **22 of 125 stored hex colors differ from the tested Stain values**. German and French Stain names also differ from the current Item-derived naming conventions. These are differences to adjudicate, not a finding that every existing value is wrong.

## Decision matrix

All proposals below are recommendations for later approval. Current implementation evidence and exact line references are in [CODE_INVENTORY.md](CODE_INVENTORY.md); captured API evidence is in [evidence/README.md](evidence/README.md).

| Candidate / priority | Current source and existing integration | Verified capability | Recommended boundary and fallback | Tradeoff and required migration checks |
|---|---|---|---|---|
| Stain names, four global locales — **first** | Bundled dyes/CSV/locales. Manual Python helper already queries Item by legacyItemID, one language at a time. | All 125 canonical Stain rows and 500 localized names returned in two pinned batches. Language decorators combine en/ja/de/fr in one response. | Maintenance-time diff → reviewed source changes → bundled output. Keep last reviewed snapshots on upstream failure; normal builds remain offline. | Avoid Item-prefix stripping and cover future null-legacy dyes. Review German inflection and French case, trim presentation whitespace explicitly, preserve current locale keys. |
| Stain color, gloss and purchasable item links — **first, compare only** | Hex and consolidation class stored locally; metallic ID set derived historically from Stain; runtime color representations are calculated locally. | Color, IsMetallic and Item[] are present. All 16 gloss IDs and every existing A/B/C expected consolidated item match. **22 colors differ.** | Produce a maintenance report; keep existing hex values and reviewed identity maps pending decisions. | Color changes affect closest-match ranking, wheels, comparisons and exports. Verify against a matching client version and review downstream expectations before accepting any change. |
| Korean and Chinese names — **retain** | Six-locale dye CSV; API worker bundles Teamcraft-derived ko/zh equipment tables. | Global service documents en/ja/de/fr only; correctly spelled API codes kr/chs both returned unsupported-language errors. | Maintain regional sources, source revisions and English item fallback. | A four-language upstream cannot replace a six-language contract. Track regional patch lag and preserve glyph/font gates. |
| Equipment names, model fields and wearability metadata — **already offloaded** | API worker batches equipment cache misses into one XIVAPI search; browser/Discord use that worker. | Item ModelMain/ModelSub, slot fields, DyeCount, names and icons available; known model search returned Angel Brush. | Retain optional runtime enrichment through the shared cache. Keep local parsing, dyes and unknown/unresolved UI usable when unavailable. | Local candidate filtering, twin choice, slot semantics and wear rules remain ours. Do not treat search score or first result as canonical equipment identity. |
| Facewear equipment — **already offloaded** | Glasses lookup through worker; generated unlock→style→variant mappings support acquisition. | Glasses row lookup returns name/icon. Existing generator handles Item/Glasses/GlassesStyle relationships. | Retain cached runtime metadata + generated mappings; missing style remains unresolved. | Keep Glasses row identity separate from unlock Item IDs and the 11 local facewear color slugs. No arithmetic/name-based ID reconstruction. |
| Icons — **already offloaded; improve consistency later** | Worker proxies XIVAPI texture→PNG, checks image/size, caches for 30 days. | PNG asset response, ETag and successful 304 conditional request observed; upstream cache policy was seven days. | Keep proxy for consistent policy/privacy; evaluate versioned asset URLs and conditional refresh. Local placeholder on failure. | Direct hotlinking is supported upstream, but changes browser disclosures/CSP and bypasses current proxy protections. Current proxy cache URLs omit game version. |
| Acquisition/vendors — **keep hybrid generation** | Pinned Teamcraft + XIVAPI + reviewed overrides produce 24,922 lines for a 29,058-item equipment inventory. | GilShopItem and SpecialShop fields expose raw offers/cost structure; no general v2 reverse-link/computed acquisition endpoint is documented. | Maintain explicit upstream evidence joins and curated selection at maintenance time. Keep unknown acquisition blank. | Item price or a relationship alone does not prove a current reachable vendor. Quest unlocks, currency modes, repurchases, retired content, NPC position, stores and coffers still require interpretation and other sources. |
| Character/skin/hair/shader palettes — **keep local** | 12 files / 2,190,185 source bytes derived from human.cmp; interface and shader halves have different purposes. | Current asset API exposes jpg/png/webp; no raw human.cmp or decoded palette endpoint appears in the captured OpenAPI. | Keep current extraction and local indexed lookup. Optional future transport needs new verified capability first. | This is the largest core data candidate, but there is no verified drop-in API replacement. Preserve clan/gender/index and interface-versus-shader semantics. |
| Other small sheet-backed labels / future map previews — **selective, later** | Product/UI terms and selected client labels are bundled; map previews are a possible new feature. | General sheet localization and composed map images are documented. | For known client labels, maintenance-time validation; for a separately approved map feature, optional cached asset enrichment. Retain current labels/omit map on failure. | First establish exact row/field identity and ko/zh coverage. A generic localization API does not translate product text. No new feature is proposed for this first change. |
| Color science, matching/indexing, rendering, user collections/presets, prices — **retain existing ownership** | Pure core calculations and local/user-owned state; community presets API; Universalis price integration. | XIVAPI exposes static client data, not market listings, user inventories or those application algorithms. | Keep calculations/rendering local; existing project services own community data; keep Universalis for live prices. | No evidence that moving these to XIVAPI is possible or would improve the product. |

## Important verified differences

1. **The current relation is Stain.Item[].** StainTransient returned 404 both at latest and at acquisition's pinned game version `541c0c12e07da325`. The maintainer guide's StainTransient advice is stale for those tested versions. The pinned [EXDSchema Stain definition](https://github.com/xivdev/EXDSchema/blob/e773c41a90aed788cf4c1c48469fa85618ef01fb/Stain.yml) independently defines two Item links on Stain. This does not establish when the historical change happened.
2. **All 125 known dye rows were retrieved.** This is coverage of the local catalog, not proof that the catalog contains every possible upstream row. The two four-locale responses were 42,627 bytes total, including selected metadata/item links.
3. **Colors need a separate decision.** 103 hex values match; 22 differ. For example, Gunmetal Black (92) is locally `#181820`, while Stain returned `#606068`. The comparison establishes a numeric discrepancy, not rendered-material fidelity or its cause. [All 22 values](evidence/COLOR_DIFFERENCES.md).
4. **Names are not byte-compatible.** Against dyes.json, English differs only by trailing spaces on IDs 99, 122, 123. Against the source CSV after trimming, en/ja agree, but 118 German and all 125 French values differ; examples are `Schneeweißer` → `Schneeweiß` and `blanc neige` → `Blanc neige`. All French differences disappear under case-folding; German differences include adjectival forms. Changing the source sheet changes naming conventions. Do not blindly rewrite approved text or infer translation mistakes.
5. **Current and generated versions differ.** Live latest resolved to `0874aee069e1e7c4` (7.57x1), while acquisition metadata records `541c0c12e07da325` (7.56x1), generated 2026-10-11. This proves a provenance difference, not that every acquisition line is stale. Compare affected rows before advancing either pin.
6. **A successful filtered response can omit an incorrect field.** An initially guessed SpecialShop relationship path returned empty objects. Using the pinned schema's real `Item[].Item[]` and cost fields returned useful projected data. Validate required keys and shapes, not merely HTTP 200.

## Delivery-mode comparison

| Mode | Best fit | Benefits | Costs / failure behavior |
|---|---|---|---|
| Explicit maintenance-time refresh | Dyes, client terminology, acquisition and regional tables | Reviewable diffs; release-pinned data; no end-user requests; offline runtime | Patch work remains; retain snapshots and fail without partial writes if refresh fails. Avoid live requests in ordinary build/install/test commands. |
| Direct optional browser request | Narrow exploratory feature or assets if separately chosen | Avoids our Worker traffic; upstream supports browser CORS in observed responses | Exposes user IP/request metadata to upstream; adds another client contract, CSP and fallback; no shared application cache. Not preferred for current integrations. |
| Shared cached API-worker request | Existing equipment and facewear enrichment | One adapter for browser and Discord; central validation/field selection/cache | Worker/upstream availability and request budgets; Cache API is edge-location scoped, not a globally deduplicated database. Cold misses and client cancellation need deliberate handling. |
| Fully local precomputed model→item index | Possible future alternative to current resolver | Could eliminate runtime metadata lookups | Not measured here: index size, ambiguity, patch refresh, localization, browser/bot cost. Do not choose this without a prototype comparison. |

## Operational requirements for any later change

- **Version/schema:** pin game version plus the response's canonical schema revision for snapshot generation; record URLs, hashes, timestamp and source repository commit. Include schema identity in runtime cache invalidation if configurable schema pins are adopted. Current cache includes shape version and game version, but not schema.
- **Caching:** retain narrow per-key caching and negative-result rules. The chara cache currently returns stale entries without using their isStale flag to schedule refresh; its extra day is stale-serving headroom, not an implemented background refresh. Concurrent equipment-search and Glasses cache misses are not coalesced; latest-version discovery already memoizes its Promise. Treat these as separate improvement candidates, not claims about the Universalis path.
- **Request volume/limits:** the current 125-dye × four-language helper can make 500 requests before retries. The sampled equivalent data fit two 100-row batches with language decorators, plus version discovery when needed. This is a request-count comparison, not an upstream rate allowance. No authoritative numerical v2 quota or availability SLA was found in the consulted docs/OpenAPI; do not reuse v1 limits. Bound concurrency; obey 429/Retry-After; use bounded retry/backoff for transient failures.
- **Latency/cancellation:** JSON probes were single-run workstation observations, not production p95s. Current browser/Discord caps are 12 seconds; Worker calls allow 10 seconds each and version discovery up to 3 seconds, so a cold gear-plus-facewear sequence can outlast the caller. Propagate cancellation where practical, retain stale-result suppression, and measure the complete path before altering budgets.
- **Response size:** always project fields and cap response bytes. One unfiltered SpecialShop response advertised 5,267,357 bytes and was stopped by the research cap; the corrected projection was 23,085 bytes. Do not expand arbitrary relationships during user requests.
- **Offline:** preserve synchronous dye/localization access and local .chara parsing. The web app has no service worker, so offline behavior means already loaded/cached resources, not guaranteed cold offline startup. Equipment, new icons and live market prices remain optional online enrichment.
- **Privacy/browser access:** observed `Access-Control-Allow-Origin: *` supports credential-free browser reads, but does not verify the app's CSP or every browser. Preserve the identifier-only resolver boundary; never add raw character files, names, appearance or images to upstream requests. Direct requests reveal ordinary network metadata; a Worker reduces direct disclosure but does not make the integration anonymous.
- **Source/rights notices:** preserve the project's Square Enix ownership/unofficial-project notices and credit XIVAPI/EXDSchema/Teamcraft where used. API/server software licensing is not ownership of game data. Link the applicable [Square Enix materials policy](https://support.na.square-enix.com/rule.php?id=5382&policy=update&tag=authc) when reviewing redistribution; this research does not certify reuse rights or alter project notices.

## Bounded first change for separate implementation approval

**A report-only, maintenance-time Stain audit command beside the existing core helper.**

Inputs: explicit game version and schema pin (or an explicit resolve-and-record step), current dyes.json/CSV and reviewed identity maps. Output: deterministic report of missing/newly observed rows within the selected scope, names in en/ja/de/fr, colors, metallic flags and Item links, with source metadata. Preserve raw responses alongside normalized comparisons. No writing to canonical JSON/CSV/locales, package versions or runtime code.

Acceptance checks for that implementation:

1. Fixture-based tests cover sparse/missing rows, incorrect field paths that return 200, malformed responses, incomplete batches, timeout/429/503, retry bounds and failure without partial output.
2. Preserve stainID, legacyItemID, current locale-key compatibility, A/B/C market IDs, facewear slugs and frozen negative-ID mappings. Include a null-legacy dye fixture.
3. Preserve all six locales; record regional source gaps without substituting unreviewed translations. Separate whitespace normalization from German/French wording decisions.
4. Baseline this run's 125-row coverage, 22 color discrepancies and zero metallic/consolidation discrepancies without hard-coding those counts as permanent truth.
5. Keep normal package builds/tests network-free; rerunning against recorded responses yields the same semantic diff.
6. Any later accepted name/color migration needs relevant core locale/vocabulary/matching tests, consumer checks, bot/OG font gates and release review. No such migration is included here.

## Scope and verification

The coordinator inspected source and primary documentation, ran 25 small sequential probes (including failed attempts retained as evidence), and compared the complete local dye catalog. Two bounded workers inventoried core/bot and app/acquisition flows at `gpt-6.1-sol / medium`; a separate verifier used `gpt-6.1-sol / xhigh`, resolved from the runtime's advertised models. These were native agents without custom model pins.

This is a research snapshot, not a security/performance certification or a production change. No load test, exhaustive shop/NPC/quest join, regional-source replacement, rendered-color calibration, app browser test or production latency measurement was performed. Production code, datasets, changelogs and issue status were left unchanged.

## Primary references

- [Sheet reading](https://v2.xivapi.com/docs/guides/sheets/): projections, language decorators and batches.
- [Concepts](https://v2.xivapi.com/docs/guides/concepts/): client editions, languages and community schema limitations.
- [Stability](https://v2.xivapi.com/docs/guides/pinning/): game/schema pins and canonical schema identifiers.
- [Search](https://v2.xivapi.com/docs/guides/search/): mandatory clauses, model-field queries and cursor pagination.
- [Assets](https://v2.xivapi.com/docs/guides/assets/): hotlinking, conditional caching and map composition.
- [V2 migration](https://v2.xivapi.com/docs/migrate/): computed/reverse-link and Lodestone limitations.
- [Live OpenAPI](https://v2.xivapi.com/api/openapi.json), also [captured locally](evidence/openapi.json).
- [Service scope](https://v2.xivapi.com/docs/welcome/): static client data rather than live player/server state.
