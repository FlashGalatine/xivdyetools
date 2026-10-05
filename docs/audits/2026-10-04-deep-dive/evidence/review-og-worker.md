# Review: og-worker (deep-dive 2026-10-04)

Branch preview/integration-2026-10-04 @80262a2f. Read-only review; 29 slice files read.

## Map

| Module | Role |
|---|---|
| src/index.ts | Hono app. Guards on `/og/*`: length, query-key allowlist, edge cache (`ogCacheKey`). Crawler tool routes, 12 image routes, fallthrough |
| src/og-data-generator.ts | Per-tool crawler OGData and HTML; emits image/app URLs (`withLang/withAlgo/withMode/withWheel`) |
| src/og-params.ts | Shared vocab and parsers (algo 9 spellings, harmony, vision, sheet, clampInt) |
| src/crawler-detector.ts | UA regex table (Googlebot excluded) |
| src/services/renderer.ts, fonts.ts | resvg-wasm init, x3 raster, 10 bundled TTFs |
| src/services/svg/band.ts | 15E frame, shared header/footer chrome, `wrapName`/`fit` |
| src/services/svg/{harmony,gradient,mixer,swatch,comparison,accessibility,extractor,presets,budget}.ts | Thin adapters onto band |
| src/services/svg/default-card.ts | 2a default cards, glamour's only card |
| src/services/{og-strings,og-embed,translator,character-cells}.ts | x6 copy, stateless translator, swatch cell resolver |
| wrangler.toml | Routes beta/prod, Analytics Engine, observability pinned off, ttf rules |

Open-PR-touched files: index.ts, og-data-generator.ts, og-embed.ts, og-strings.ts, default-card.ts, types.ts (glamour card/strings). No defect found in the PR delta itself.

## Candidates

### og-worker-01 BUG MEDIUM - Gradient card ranks matched dyes by hardcoded ciede2000
- services/svg/gradient.ts:88 (interpolation at :38-43)
- Claim: the nearest-dye search always uses `'ciede2000'`, while the printed delta (`fmtDelta(deltaForAlgorithm(.., algorithm))`, :99) and footer tag (`algoTag(algorithm)`) use the requested algo. The web gradient tool ranks by its method (`apps/web-app/src/components/gradient-tool.ts:1853-1856`, `matchingMethod: this.matchingMethod`).
- Failing input: `/og/gradient/A/B/5.png?algo=oklab` (the crawler emits this for any shared gradient with a non-default algo).
- Wrong outcome: middle bands name the DE2000-nearest dyes under DEOK figures, a different set from the page. This is the BUG-023 class, fixed for harmony / swatch / mixer but not gradient.
- Also `interpolate()` compares the raw spelling (`algorithm === 'oklab'`), so a legacy `euclidean` (normalises to rgb) interpolates in Lab.
- Tests miss it: `gradient.test.ts` (39 lines) has no algorithm case. Covered by a test: no.
- Origin: MAIN.
- Excerpt: `const delta = ColorService.getDistanceForMethod(stepHex, candidate.hex, 'ciede2000');`
- Fix direction: rank with `rankKeyForAlgorithm(stepHex, candidate.hex, algorithm)` as swatch.ts does. Normalise `algorithm` once at the top. Add a test mirroring `harmony.test.ts` "requested algorithm chooses the dyes".

### og-worker-02 BUG MEDIUM - Legacy `?algo=` spellings reach core unnormalised in Harmony; ranking becomes NaN
- services/svg/harmony.ts:113 (`matchingMethod: algorithm`)
- Chain: the route guard accepts the 9 `VALID_ALGORITHMS`, including the legacy `euclidean`, `hyab`, `oklch-weighted` (og-params.ts:50-60; index.ts:215). `generateHarmonySlots` scores via `ColorService.getDistanceForMethod(.., config.matchingMethod)` (core `HarmonySelector.ts:126`). That switch has no default and returns `undefined` for a legacy name (`ColorService.ts:180-193`). `rankCandidates` then sorts on `NaN` (`HarmonySelector.ts:145`).
- Failing input: `/og/harmony/102/tetradic.png?algo=hyab`.
- Wrong outcome: every comparator is NaN, so the stable sort leaves `ALL_DYES` order and the card names the first four eligible dyes in table order, not the harmony. The printed delta is computed afterwards via the normalised `deltaForAlgorithm`, so the numbers look plausible.
- Reachability: the crawler normalises on emit (`withAlgo`), so only hand-built links or image URLs minted before normalisation hit it. Hence MEDIUM, not HIGH.
- Tests miss it: `harmony.test.ts:233` "every accepted algorithm" lists only the six 5.0 spellings and asserts just `<svg`. Covered by a test: no.
- Origin: MAIN.
- Excerpt: `matchingMethod: algorithm,   // raw; 'hyab' is not a MatchingMethod`
- Fix direction: `normalizeMatchingMethod(algorithm)` once at the top of `generateHarmonyOG`, as `deltaForAlgorithm` and `rankKeyForAlgorithm` already do. Add the three legacy spellings to the test, asserting the chosen set equals the default's.

### og-worker-03 UNTESTED LOW - Legacy and gradient algorithm behaviour has no test
- services/svg/gradient.test.ts:1-39; services/svg/harmony.test.ts:233.
- Behaviour to catch: the two defects above.
- Origin: MAIN.

### og-worker-04 BUG LOW - Edge-cache key still multiplies `algo` / `mode` on routes that ignore them
- index.ts:347-358 (`ogCacheKey`).
- Claim: `wheel` was fixed in BUG-018 to key only where read. `algo` is read only by harmony / gradient / mixer / swatch, and `mode` only by the two mixer routes, yet both are keyed on every route.
- Failing input: `/og/budget/5.png?algo=oklab`, `?algo=rgb`, `?mode=lab` ... Each of the up to 10 algo x 7 mode spellings is a distinct key, a distinct full resvg raster and a distinct 7-day entry for one byte-identical card.
- Wrong outcome: wasted renders and cache entries (up to ~70x per path on comparison / accessibility / extractor / presets / budget / default cards). The CLAUDE.md claim "an allowed key must not multiply the entries of a card that ignores it" is false for these two keys.
- Bounded and low impact: an attacker can already vary dye ids freely, which the WAF rule covers.
- Tests: og-guards.test.ts:363 asserts only that harmony keys on algo. Covered: no.
- Origin: MAIN.
- Fix direction: key `algo` only for harmony / gradient / mixer / swatch paths and `mode` only for `/og/mixer/*`, with a per-path `readsAlgo` / `readsMode` like `readsWheel`.

### og-worker-05 BUG LOW - Extractor card ignores `?algo=`, the page honours it
- services/svg/extractor.ts:74 (hardcoded ciede2000); og-data-generator.ts:532 forwards `params.algo` onto the og:url only, not the image URL.
- Failing input: share `/extractor/?colors=...&algo=oklab`.
- Wrong outcome: the unfurl shows DE2000-nearest dyes, while the page it opens (`extractor-tool.ts:2319-2325`) matches by DEOK. The footer says DE2000, so the card is truthful but not the page's picture.
- Likely a documented limitation (algo-aware routes are listed as five); filed LOW for the decision.
- Origin: MAIN. Covered: no.

### og-worker-06 OPT LOW - `Resvg` / `RenderedImage` are never `.free()`d
- services/renderer.ts:87-103.
- Claim: each 1200x1050 render holds a ~5 MB RGBA pixmap plus the parsed tree and font db in wasm linear memory until a FinalizationRegistry callback fires (`@resvg/resvg-wasm/index.js:214,279`). V8 sees only the tiny JS wrappers, so finalisation can lag; image-worker `.free()`s every PhotonImage in `finally` for exactly this reason (apps/image-worker/CHANGELOG.md:211).
- Risk: memory growth toward the 128 MB isolate limit under sustained cache-miss bursts. I could not reproduce it, so it is unverified.
- Fix direction: `try { ... } finally { rendered.free(); resvg.free(); }` after `asPng()` copies out.
- Origin: MAIN.

## POSITIVE
- Query-key allowlist, canonical path grammars and the `.png` strip are consistent. The `/og/:tool/default.png` vs bare-`default` cache-key split (index.ts:455-459) is correct.
- Hono `strict` defaults to true, so no trailing-slash key amplification.
- `escapeHtml` is applied to every interpolated value in `generateOGHTML`; the CSP plus `nosniff` headers are set on both cache hits and fresh renders.
- `isKnownClanOrRace` and `isSubRace` use `Object.hasOwn`, with no prototype-key lookups.
- The WASM init retry resets the cached rejected promise (BUG-013) with no poisoning.
- Human pass-through is guarded: the 5 s timeout, no og-host self-fetch, and a 302 off-app.
- Font-coverage test pins the code glyphs, and Fragment Mono's cmap was checked.
- No character names are read or emitted (the glamour card is the default card only).

## REJECTED
- Comparison crawler emitting duplicate ids (`dyes=1,1,2`) while the card dedupes: the page's selector cannot produce duplicates, and only the description count would differ. Cosmetic.
- Swatch description "5 closest" vs the card's MATCH_CAP 4: intentional (the description describes the page; the card is a drawn decision).
- Mixer 3-dye ignoring `ratio` while it still keys the cache: the web tool has no third dye (bot-origin only); the card is intentionally an equal mix.
- Cache middleware returning an immutable cache-hit response then `c.header`: Hono clones when finalized.
- wrangler routes `harmony/*` not matching bare `/harmony`: the app always emits the trailing slash; the `/${tool}` handler exists as a safety net.
- Harmony `role` showing `+330deg`: `HARMONY_OFFSETS` are already 0-360 positive, so it matches the page.
- `getLocalizedDyeName` keyed on `dye.itemID`: matches core's keying (`DyeService.ts:360`).
- Per-render font db parse cost: inherent to resvg-wasm; not fixable without a persistent db.

## COVERED
29 files, the whole slice list: package.json, subset-cjk-fonts.py, crawler-detector, index, og-data-generator, og-params, character-cells, fonts, og-embed (head and tail; table body skimmed), og-strings (tail), renderer, accessibility, band-shared, band, budget, comparison, default-card, dye-helpers, extractor, gradient, harmony, svg/index, mixer, presets, swatch, tokens, translator, types (head), wrangler.toml. Tests skimmed: gradient, harmony, og-guards, index, font-coverage. Cross-reads: core HarmonySelector.ts, ColorService.ts, blending.ts; web-app gradient-tool.ts, mixer-tool.ts, extractor-tool.ts.
