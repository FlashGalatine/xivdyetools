# review-og-worker — deep-dive 2026-09-02

Unit: `apps/og-worker` (CF Worker, Hono). Repo root: the worktree at `origin/main` e7ac4042.
Read-only review. Two routed envs; bare `wrangler deploy` = the **beta** worker on `beta.xivdyetools.app`.

## 1. Map

| Module | Role |
|---|---|
| `src/index.ts` (1131) | Hono app; 3 `/og/*` middlewares (length cap, query-key allowlist + `algo` validation, `caches.default`), 9 crawler-intercept tool routes + `/presets/:presetId`, 13 image routes, `/`, catch-all, `onError` |
| `src/og-params.ts` | Share-param vocabularies + bounds shared by crawler and image routes (`VALID_ALGORITHMS`, `VALID_SHEETS`, `parseHexColor`, `clampInt`, `parseDyeIdList`) |
| `src/og-data-generator.ts` (835) | Per-tool `OGData` (title/description/og:url/og:image) + `generateOGHTML` + `escapeHtml`; `withLang` / `withAlgo` |
| `src/services/og-embed.ts` | Crawler copy ×6 (`OG_EMBED`, `embed()`) — browser text, deliberately outside the CJK subsets |
| `src/services/og-strings.ts` | Card copy ×6 (`OG_DECK`, `TOOL_TAG`, `OG_DECK_LINE`, `OG_ROLE`) — subset-covered |
| `src/services/translator.ts` | Module-scope `TranslationProvider`, 6 locales preloaded, stateless per call |
| `src/services/renderer.ts` | `initRenderer()` (static WASM import, promise-guarded) → `renderSvgToPng` → `renderOGImage` (×3 raster, explicit TTLs) |
| `src/services/fonts.ts` | 10 static TTF imports (SG/Onest Regular+SemiBold+Bold, FragmentMono, Noto JP/SC/KR subsets), module-scope cache |
| `src/services/svg/band.ts` (555) | 15E frame: `bandInk`, `ogMark`, `fit`/`wrapName`, `cardHeader`/`cardFooter`, `generateBandCard` |
| `…/svg/{harmony,gradient,mixer,swatch,comparison,accessibility,extractor,presets,budget}.ts` | Nine adapters onto the band frame |
| `…/svg/{band-shared,default-card,dye-helpers,tokens,index}.ts` | `ALGO_TAG`/`fmtDelta`/`notFoundBand`, 2a default cards, shared `DyeService` + stainID map, tokens, barrel |
| `src/crawler-detector.ts` | UA regex table (Googlebot deliberately absent) |
| `wrangler.toml` | beta = top-level (9 zone routes + `og-beta.` custom domain), `[env.production]` = 9 routes + `og.`; `**/*.ttf` Data rule; AE dataset per env |

Route surface: `GET /health`, `GET /`, `GET /{tool}` + `/{tool}/` ×9, `GET /presets/:presetId`,
`GET /og/:tool/default.png`, `/og/harmony/:dyeId/:harmonyType`, `/og/gradient/:s/:e/:steps`,
`/og/mixer/:a/:b[/:c]/:ratio`, `/og/swatch/:color/:limit`, `/og/comparison/:dyes`,
`/og/accessibility/:dyes/:visionType`, `/og/extractor/:colors`, `/og/presets/:presetId`,
`/og/budget/:dyeId`, `/og/default.png`, `ALL *`.

## 2. Candidates

---

### og-1 — BUG — **HIGH** — `src/og-data-generator.ts:764`

**Claim.** The swatch crawler adapter still reads the pre-5.0 `?hex=` / `?color=` grammar; the web app's
5.0 Swatch Matcher shares a *cell address* (`?slot=<sheet>&i=<index>`) and no hex at all — so **every**
swatch share link unfurls as the generic Swatch default card.

**Failing input → wrong outcome.** A crawler fetches the URL the share button produces,
`https://xivdyetools.app/swatch/?slot=eyeColors&i=12&algo=ciede2000&limit=5&v=1`
(`apps/web-app/src/components/swatch-tool.ts:2868-2889` — `{ slot, i, algo, limit }`, plus `race`/`gender`
on the race-specific sheets; the comment there reads *"Confirmed grammar: slot + i"*).
`parseHexColor(searchParams.get('hex') || searchParams.get('color'))` → `parseHexColor(null)` → `null`
→ `toolDefault('swatch', …)`. Result: `og:image` = `/og/swatch/default.png`, `og:title` = the generic
tool name, and `og:url` = `https://xivdyetools.app/swatch/` — the shared cell is lost from the picture,
the title, *and* the click-through.

Second half of the same drift: og-worker reads `?sheet=` (`og-data-generator.ts:768`, validated by
`isSheet` against `VALID_SHEETS` in `og-params.ts:71-81`), but nothing in the monorepo emits `sheet=` —
the SPA emits `slot=` with the *same* values (`swatch-tool.ts:152` `colorCategory: 'eyeColors'`).
So `swatch.descriptionSheet` and `swatch.descriptionSheetRace` — authored ×6 in `og-embed.ts` by the
2026-08-20 i18n audit — are unreachable, and `race`/`gender` (which the SPA *does* emit) are read but
never used, because both branches are gated on `sheet` being set.

```ts
// og-data-generator.ts:759-767
case 'swatch': {
  const color = parseHexColor(searchParams.get('hex') || searchParams.get('color'));
  if (!color) {
    return toolDefault('swatch', env, locale, embed('swatch.descriptionDefault', locale));
  }
  const sheetRaw = searchParams.get('sheet');   // never present — the SPA sends ?slot=
```

**Why tests miss it.** Every swatch case in the suite feeds the retired grammar:
`og-data-generator.test.ts:626` (`swatch: 'hex=ABCDEF&limit=5'` in the route↔emitter parity table),
`:650`, `:692-695`, `:827-852`, and `index.test.ts` likewise. The tests pin the contract the producer
stopped emitting, so they stay green while the real one degrades.

**Covered by test:** no. **Fix:** read `slot`/`i` (resolving the cell to a hex through the same colour
sheets the SPA uses, or keep `hex` as the image key and add a `slot`-aware description), keep `hex`/`color`
as the legacy read, and carry `slot`/`i` through into `og:url`.

---

### og-2 — BUG — **HIGH** — `src/services/svg/harmony.ts:39-48`

**Claim.** `IDEAL_OFFSETS` is a second, divergent copy of the web app's canonical `HARMONY_OFFSETS`
(`apps/web-app/src/services/harmony-generator.ts:73-84`, consumed at `harmony-tool.ts:1385` and `:1704`).
Three of the ten harmony types render a card whose dyes the tool page never shows.

| type | web-app (the page) | og-worker (the card) |
|---|---|---|
| `analogous` | `[30, 330]` | `[30, -30, **180**]` — an extra complement band |
| `compound` | `[30, 180, 330]` | `[30, 150, 210]` — a different scheme entirely |
| `shades` | `[15, 345]` | *absent* → falls to the nearest-dye branch (`harmony.ts:64-72`), role `≈` |

**Failing input → wrong outcome.** Share `https://xivdyetools.app/harmony/?dye=102&harmony=compound&v=1`
(the share button emits `harmony: this.selectedHarmonyType`, `harmony-tool.ts` `getShareParams`). The
unfurled card draws the dyes nearest +30°/+150°/+210° from Jet Black; the page the link opens draws
+30°/+180°/+330°. Zero of the three match. `analogous` shows four bands where the page shows three.

```ts
// harmony.ts:39-48
const IDEAL_OFFSETS: Partial<Record<HarmonyType, number[]>> = {
  complementary: [180],
  analogous: [30, -30, 180],      // page: [30, 330]
  ...
  compound: [30, 150, 210],       // page: [30, 180, 330]
};                                 // 'shades' missing → nearest-dye fallback
```

**Why tests miss it.** `harmony.test.ts` only exercises `tetradic`, `triadic` and `monochromatic` — the
three types that happen to agree (or are deliberately the fallback). No test compares the two tables.

**Covered by test:** no. **Fix:** import one table (move `HARMONY_OFFSETS` into `@xivdyetools/core`
and have both consumers read it), and add the `shades` row rather than letting it fall through.

---

### og-3 — BUG — MEDIUM — `src/services/svg/swatch.ts:50-57, 73, 84`

**Claim.** Swatch *ranks* its matches by a hardcoded `'ciede2000'` but *prints* `deltaForAlgorithm(…,
algorithm)` and labels the footer with the requested `ALGO_TAG` — so the card claims a method it did not
rank by, and the printed values can run out of order.

**Failing input → wrong outcome.** `/og/swatch/7A6B4F/4.png?algo=oklab`: the four bands are the four
nearest by ΔE2000, ranked `1..4`, but each tag is a ΔEOK figure and the footer reads `ΔEOK`. ΔEOK and
ΔE2000 do not agree on order over 125 dyes, so rank 2 can display a *smaller* Δ than rank 1, and the set
can differ from what the page shows — `apps/web-app/src/components/swatch-tool.ts:666` ranks with
`this.matchingMethod`. This is the disagreement `withAlgo` (`og-data-generator.ts:87-92`, DEAD-022) exists
to prevent, on the half that was never fixed.

```ts
// swatch.ts:50-57
const matches = dyeService.getAllDyes()
  .map((dye) => ({ dye, delta: ColorService.getDistanceForMethod(targetHex, dye.hex, 'ciede2000') }))
  .sort((a, b) => a.delta - b.delta)
  .slice(0, limit);
// …:73  tag: `Δ${fmtDelta(deltaForAlgorithm(targetHex, m.dye.hex, algorithm), algorithm)}`
// …:84  footRight: ALGO_TAG[algorithm] ?? algorithm.toUpperCase(),
```

**Why tests miss it.** `swatch.test.ts` never passes an `algorithm`, and asserts only `>4<` / `not >5<`.
Nothing asserts the printed deltas are non-decreasing.

**Covered by test:** no. **Fix:** rank with `deltaForAlgorithm(targetHex, dye.hex, algorithm)` (one
distance call, reused for the tag), or drop the requested-algorithm footer on this card.

---

### og-4 — BUG — MEDIUM — `src/services/svg/band-shared.ts:14-22` (+ `harmony.ts:142`, `gradient.ts:117`, `mixer.ts:111`, `swatch.ts:84`)

**Claim.** `ALGO_TAG` has no row for `hyab` or `oklch-weighted`, the two legacy spellings
`VALID_ALGORITHMS` (`og-params.ts:50-61`) still accepts, so those cards name a method they did not use.

**Failing input → wrong outcome.** `/og/harmony/102/tetradic.png?algo=hyab` passes the shared `/og/*`
guard (`index.ts:227`) and the route's own `isAlgorithm` check. `ALGO_TAG['hyab']` is `undefined`, so the
fallback prints **`HYAB`** in the footer — but `deltaForAlgorithm` runs `normalizeMatchingMethod('hyab')`
→ `'ciede2000'` (`packages/core/src/types/index.ts:72-74`), so the Δ figures are ΔE2000. Same for
`oklch-weighted` → `OKLCH-WEIGHTED`. (`euclidean` *is* mapped, to `RGB DIST`, and normalises to `rgb` —
consistent; only these two are wrong.) Reachable from pre-5.0 shared links, which is exactly why those
spellings are still accepted.

```ts
// band-shared.ts:14-22 — 'hyab' and 'oklch-weighted' are missing
export const ALGO_TAG: Record<string, string> = {
  ciede2000: 'ΔE2000', oklab: 'ΔEOK', cie76: 'ΔE76',
  redmean: 'REDMEAN', rgb: 'RGB DIST', distinguish: 'DISTINGUISH %', euclidean: 'RGB DIST',
};
```

**Why tests miss it.** The only footer test is `harmony.test.ts:69-77`, which passes `'ciede2000'` and
expects `ΔE2000`. No test feeds a legacy spelling to an adapter.

**Covered by test:** no. **Fix:** normalise once at the route (or in the adapters) before `ALGO_TAG` and
`fmtDelta`, so the tag always describes the method `deltaForAlgorithm` actually ran.

---

### og-5 — BUG (operational) — MEDIUM — `src/index.ts:264-278` + `src/services/renderer.ts:444`

**Claim.** The `caches.default` key carries no app/data version and the stored response says
`s-maxage=604800`; neither deploy workflow purges. A card-design change or a `@xivdyetools/core` dye-data
change leaves already-rendered cards stale for up to 7 days per colo.

**Failing input → wrong outcome.** `ogCacheKey` is `origin + stripPngSuffix(c.req.path) + (lang, frame,
algo)` — nothing else. Deploy a band-layout change or a renamed dye; `/og/harmony/102/tetradic.png` keeps
serving the pre-deploy PNG from every colo that already has it. `.github/workflows/deploy-og-worker.yml`
and `deploy-og-worker-beta.yml` contain no purge step (the only post-deploy action is a reachability
check). og-worker's own `CLAUDE.md` deploy step 6 claims the new SVG appears "within ~5s of cache
expiry", which is off by six orders of magnitude.

**Why tests miss it.** `og-guards.test.ts` verifies the key *bounds* the space (the FINDING-024 goal); no
test asserts a key changes when the renderer or the data does — and a unit test could not observe a
deploy anyway.

**Covered by test:** no. **Fix:** fold a build-time version constant (package `version`, or a hash of the
card modules) into `ogCacheKey`, or add a purge-by-prefix step to both deploy workflows.

---

### og-6 — BUG — LOW — `src/og-data-generator.ts:214, 246, 276, 289, 425`

**Claim.** Every `og:url` / `<meta http-equiv="refresh">` is rebuilt from scratch and drops parameters
the SPA both emits and reads — so the link a reader clicks opens a different state from the picture
they clicked on.

**Failing input → wrong outcome.**
- `lang` on **all nine** tools: `ShareService.generateUrl` sets `?lang=<locale>` for non-EN
  (`apps/web-app/src/services/share-service.ts:206-210`) specifically so og-worker can localize; og-worker
  localizes the embed and the card, then hands back a URL without it, so the page opens in the browser's
  language.
- `algo` on harmony / gradient / mixer: `harmony-tool.ts:432` reads `params.get('algo')`, and the emitted
  `og:image` carries `?algo=` (via `withAlgo`), but `url:` at `:214` / `:246` / `:289` is
  `?dye=…&harmony=…&v=1` with no `algo`. Card says ΔEOK, page opens on ΔE2000.
- `ratio` on the 3-dye mixer (`:276`) — the image URL carries it, `og:url` does not. (Low impact: the SPA
  never emits `dyeC`, so that branch is hand-built URLs only.)

**Why tests miss it.** `og-data-generator.test.ts:898-903` asserts an *unknown* `algo` never reaches
`og:url`; nothing asserts a *known* one does, and nothing asserts `lang` round-trips into `og:url`.

**Covered by test:** no. **Fix:** carry the validated params through into `og:url` (they are already
validated and normalised for the image URL — the same values, one more `URLSearchParams`).

---

### og-7 — BUG — LOW — `src/index.ts:276`

**Claim.** `ogCacheKey` strips a trailing `.png` from **every** `/og/*` path, including the two routes
where `.png` is *not* optional, so a cache-warm `/og/<tool>/default` returns 200 where the route grammar
deliberately returns 400.

**Failing input → wrong outcome.** `GET /og/budget/default.png` matches `/og/:tool/default.png`
(`index.ts:605`) → 200, cached under key `…/og/budget/default?lang=en&frame=discord`. A later
`GET /og/budget/default` matches `/og/budget/:dyeId` (`index.ts:1021`), whose `parseCanonicalInt('default')`
is `NaN` → the handler would answer `400 {"error":"Invalid dye ID"}` — but the cache middleware
(`index.ts:303-313`) computes the *same* stripped key, hits, and returns the default-card PNG with a 200.
Same shape for every tool and for `/og/default`. Benign in content (it is the right card) but the status
is order-dependent.

**Why tests miss it.** `og-guards.test.ts:266-274` asserts `/og/budget/default` → 400, but that describe
block never stubs `caches`, so the middleware short-circuits to `next()` and the collision cannot appear.

**Covered by test:** no (the existing test is environment-dependent). **Fix:** only strip `.png` for the
routes that declare it optional, or reserve the literal `default` segment the way `presets` already does.

---

### og-8 — BUG — LOW — `src/services/svg/comparison.ts:45-49, 75`

**Claim.** The dye list is never deduplicated, and "the other dyes" is computed by object identity, so a
repeated stainID renders a card comparing a dye with itself.

**Failing input → wrong outcome.** `/og/comparison/1,1.png` (canonical, so the S7-R12 grammar accepts
it) — `getDyeByItemId(1)` returns the *same* `Dye` object twice, `dyes.length === 2` passes the `< 2`
guard, the only pair is `{a: Snow White, b: Snow White, delta: 0}`, and the card draws two identical
`CLOSEST PAIR` bands with the deck `Snow White ↔ Snow White · Δ0.0`. The crawler reaches it too:
`parseDyeIdList` (`og-params.ts:133-139`) passes `?dyes=1,1` through unchanged.

```ts
// comparison.ts:75
const ordered: Dye[] = [closest.a, closest.b, ...dyes.filter((d) => d !== closest.a && d !== closest.b)];
```

**Why tests miss it.** `comparison.test.ts` / `index.test.ts` only feed distinct ids.

**Covered by test:** no. **Fix:** `[...new Set(dyeIds)]` before resolving (and compare by `dye.id`, not
by reference).

---

### og-9 — UNTESTED — MEDIUM — `src/services/svg/harmony.test.ts:30-35`

**Claim.** The test named for the tetrad regression asserts only that *some* Δ was printed; it passes
identically under the bug it exists to prevent.

```ts
it('the Δ is match → computed ideal (never four-reds on a correct tetrad)', () => {
  const svg = generateHarmonyOG({ dyeId: stainId, harmonyType: 'tetradic' });
  const deltas = [...svg.matchAll(/Δ(\d+\.\d)/g)].map((m) => parseFloat(m[1]));
  expect(deltas.length).toBeGreaterThan(0);      // ← the whole assertion
});
```

**Behaviour it was supposed to catch.** That the printed Δ measures *match → computed ideal* rather than
*match → base*. The base→match measurement (the shipped bug) also prints ≥1 Δ, so the test cannot fail
for it. **Fix:** assert the deltas are small (e.g. each `< 25`) and that a complement's Δ is far below
`getDistanceForMethod(base, match)`.

---

### og-10 — UNTESTED — LOW — `src/services/svg/harmony.test.ts:62-67`

**Claim.** `it('localizes dye names')` renders `en` and `ja` and asserts `toContain('<svg')` on both — no
localization regression can fail it, and no other test asserts a localized dye *name* on a harmony card
(`:79-84` covers only the tool tag and the harmony-type name).

**Behaviour it was supposed to catch.** `getLocalizedDyeName` (`translator.ts:39`) returning the English
`dye.name` for every locale. **Fix:** assert `ja` contains `スノウホワイト` and `en` does not, mirroring
`og-data-generator.test.ts`'s embed test.

---

### og-11 — UNTESTED — LOW — `src/services/font-coverage.test.ts:148-158`

**Claim.** The font-coverage gate covers core locale data plus the four ×6 tables in `og-strings.ts`, but
not the curated `presetData` palette **names**, which `presets.ts:64-65` draws in the deck and in the X
footer. `scripts/subset-cjk-fonts.py` (header lines 16-17, `CORE_LOCALES_DIR` / `OG_STRINGS_TS` at 61-62)
reads exactly the same two sources, so nothing generates *or* verifies those glyphs.

**Failing input → wrong outcome.** Add a curated preset named with any CJK character (or any codepoint
outside the brand fonts) — `pnpm test` stays green and `/og/presets/<slug>.png` renders tofu in the deck
and the footer of every locale. All 30-odd current names are ASCII, so this is latent, not live.

**Covered by test:** no. **Fix:** add `collectStrings(presetData…names)` to `stringsFor()` and the preset
names to the subset script's sources.

---

### og-12 — REFACTOR — LOW — `harmony.ts:100`, `gradient.ts:50`, `mixer.ts:58`, `swatch.ts:41`, `dye-helpers.ts:71`

Five adapters default `algorithm = 'oklab'`, contradicting the suite default
`DEFAULT_MATCHING_METHOD = 'ciede2000'` that every route passes explicitly. Only tests ever see the
default, so tests measure with a method production never uses. Default to `DEFAULT_MATCHING_METHOD`.

### og-13 — OPT — LOW — `harmony.ts:79`, `gradient.ts:231`, `extractor.ts:180`

`dyeService.getAllDyes()` returns a **fresh 125-element copy per call** (per the OPT-023 note in
`dye-helpers.ts:17-19`) and is called *inside* the per-offset / per-step / per-entry loops — up to five
copies per render. Hoist one `const all = dyeService.getAllDyes()` above each loop.

## 3. POSITIVE — do not re-file

- **resvg-wasm init is still correct.** `renderer.ts:378-380` registers the `.catch` that nulls
  `wasmInitPromise` *before* the `await` on line 382, so the reset always runs before the rejection
  propagates — no rejected promise can poison the isolate, and no stale `.catch` can null a fresh promise.
- **The `/og/*` guard stack is unusually well-tested.** `og-guards.test.ts` covers the query-key
  allowlist, `algo` value validation on routes that never read it, the empty-`algo` carve-out, the
  canonical path grammars (leading zeros, `%2F`, `.png` mid-segment), and both directions of the HEAD
  caching fix — including the cold-cache HEAD storing a full body, asserted by reading the later GET's bytes.
- **No user-controlled text reaches the card any more.** After the S7-R12 grammars, every `notFoundBand`
  label is digits or an `[a-z0-9-]` slug, and `clipLabel`/`wrapName` are linear with a 32-cp / 512-cp cap.
- **Fonts ship as static Regular/SemiBold/Bold instances with a real gate** — `font-faces.test.ts` renders
  the three weights through actual resvg-wasm and fails if any two match; `font-coverage.test.ts` parses
  cmaps rather than comparing md5s.
- **og-worker calls no other worker.** Presets come from bundled `presetData`; a `community-<uuid>` or
  unknown slug degrades to the presets default card, so there is no unapproved-preset leak, no
  service-binding timeout, and no fetch to bound.
- **Crawler HTML hygiene holds**: every interpolated value goes through `escapeHtml`, CSP + nosniff +
  `Referrer-Policy` + `X-Frame-Options` + `Vary: User-Agent` on all three HTML paths, and the catch-all is
  a `no-store` 404 rather than a cacheable 200.
- **`isAppHost` / `isOgImageHost` correctly prevent worker self-fetch (CF 1042)** on the image custom
  domain, workers.dev and wrangler dev, with a table-driven test over all four ingress shapes.
- **The swatch bare-URL white card is gone on both surfaces** (noted, not re-filed): `og-params.ts:119`
  returns `null` for a non-hex target so the crawler emits `/og/swatch/default.png`, and
  `swatch.ts:44-46` renders `notFoundBand` rather than a white swatch.

## 4. REJECTED

- *`c.header()` on a `cache.match()` Response throws on immutable headers.* Hono 4.13.5
  `dist/context.js:212` re-wraps with `new Response(this.#res.body, this.#res)` whenever `finalized`, so
  the headers being mutated are always fresh.
- *`markUid` (band.ts:120) is a module-scope counter shared across requests.* It only names a `clipPath`
  id; the rasterised PNG bytes are identical, and the tests normalise it (`og-guards.test.ts:220`).
- *`embed()`'s `name in vars` walks the prototype chain (og-embed.ts:344).* Every template is a repo
  constant; none contains `{constructor}`/`{__proto__}`, and `vars` keys are never attacker-chosen.
- *`best!` non-null assertions (mixer.ts:51, extractor.ts:188).* `getAllDyes()` is never empty and
  `getDistanceForMethod` never returns NaN for a validated hex, so `bestDelta` always improves once.
- *The catch-all could `cache.put` a 200 from `fetch()` under an `/og/*` key.* Unreachable: `/og/*` is not
  a worker route on the app host, and on the image host the catch-all answers 404 JSON.
- *`wrapName`'s hyphenation loop could spin.* `if (cut <= 2) break` guarantees progress and
  `MAX_NAME_CHARS = 512` bounds the input.
- *Gradient clamps `steps` to `BAND_CAP` (5) while the route accepts 2–20.* Deliberate and documented
  (band cap); same for comparison/accessibility accepting 16 ids for a 4-band card (ruling S7-R17).
- *`getLocalizedDyeName` keys on `dye.itemID` rather than `stainID`.* Correct — the locale JSON is
  itemID-keyed (`packages/core/src/data/locales/en.json` `dyeNames`), and `TranslationProvider.getDyeName`
  additionally covers the three consolidated ids.
- *`accessibility.ts:90` labels every band `AS DESIGNED` while the body is the simulated colour.* The role
  line sits directly under the as-designed strip and takes the body's ink; a design judgment, not a bug.
- *Mixer `?ratio=0`/`100` clamped to 1/99 by the crawler but 400'd by the image route.* Cosmetic; the SPA
  bounds the slider.

## 5. COVERED

**In scope, read in full (28):** `apps/og-worker/` → `wrangler.toml`, `package.json`, `src/index.ts`,
`src/types.ts`, `src/og-params.ts`, `src/og-data-generator.ts`, `src/crawler-detector.ts`,
`src/services/{fonts,renderer,translator,og-strings,og-embed}.ts`,
`src/services/svg/{index,tokens,band,band-shared,default-card,dye-helpers,harmony,gradient,mixer,swatch,comparison,accessibility,extractor,presets,budget}.ts`,
`scripts/subset-cjk-fonts.py` (structure + sources).

**Tests skimmed (10):** `og-guards.test.ts`, `index.test.ts`, `og-data-generator.test.ts`,
`services/font-faces.test.ts`, `services/font-coverage.test.ts`, `services/svg/{harmony,swatch,new-tools,band-shared,dye-helpers}.test.ts`.

**Cross-referenced (15):** `packages/core/src/types/index.ts`,
`packages/core/src/services/localization/TranslationProvider.ts`,
`packages/core/src/services/dye/HarmonyGenerator.ts`, `packages/core/src/data/locales/en.json`,
`packages/types/src/dye/dye.ts`, `apps/web-app/src/services/{share-service,harmony-generator}.ts`,
`apps/web-app/src/components/{swatch,harmony,gradient,mixer,budget,comparison,accessibility}-tool.ts`,
`node_modules/hono/dist/context.js`, `.github/workflows/deploy-og-worker{,-beta}.yml`.

**Total: 53 files.**
