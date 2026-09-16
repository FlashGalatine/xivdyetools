# Review: og-worker

Unit: `og-worker` (Cloudflare Worker, OpenGraph card rendering). Repo root:
`C:/dev/XIVProjects/xivdyetools/.claude/worktrees/deep-dive-2026-09-16`. Scope: everything under
`apps/og-worker/src/`, plus `apps/og-worker/wrangler.toml` (read-only).

## 1. Map

| Module | Role |
|---|---|
| `index.ts` | Hono app: observability middleware, `/og/*` guards (segment-length, query-key allowlist, canonical path grammar), edge-cache middleware (`ogCacheKey`), tool crawler routes (`/:tool`, `/presets/:presetId`), 11 image routes (`/og/harmony/…` … `/og/default.png`), root + catch-all |
| `og-data-generator.ts` | Builds `OGData` (title/description/url/imageUrl) per tool from validated query params; `generateOGHTML` renders the crawler HTML |
| `og-params.ts` | Shared enum/bounds vocabulary + parsers, one source for the crawler and the image routes |
| `crawler-detector.ts` | UA regex table (Discord/Twitter/FB/LinkedIn/Slack/Telegram/WhatsApp/other); Googlebot deliberately excluded |
| `types.ts` | `Env`, `ToolId`, per-tool `*Params`, `OGData`, `CrawlerInfo`, `AnalyticsEvent` |
| `services/character-cells.ts` | Swatch cell-address (`slot`+`i`) → hex resolution against `CharacterColorService` |
| `services/translator.ts` | Module-scope 6-locale `TranslationProvider`; dye/harmony/vision/clan-or-race name lookups (own-property checks only) |
| `services/fonts.ts` | 10 static TTF buffers, module-scope cache |
| `services/renderer.ts` | `initRenderer`/`renderSvgToPng`/`renderOGImage`; cached-promise reset on WASM init failure |
| `services/og-strings.ts` | ×6 deck names/subs, tool tags, deck lines, band role words (font-subset-covered) |
| `services/og-embed.ts` | ×6 crawler title/description templates (separate file, not subset-covered) |
| `services/svg/band.ts` | 15E band frame, shared header/footer chrome, linear-time text fit/wrap |
| `services/svg/band-shared.ts` | `algoTag`, `fmtDelta`, `notFoundBand` (label-clipped) |
| `services/svg/dye-helpers.ts` | Shared `DyeService`/`ALL_DYES`/stainID map, `deltaForAlgorithm`, `rankKeyForAlgorithm` |
| `services/svg/{harmony,gradient,mixer,swatch,comparison,accessibility,extractor,presets,budget}.ts` | One card generator per tool |
| `services/svg/default-card.ts`, `tokens.ts`, `index.ts` | 2a default cards, shared tokens, barrel |

## 2. Candidates

### og-worker-01 — BUG, MEDIUM — `apps/og-worker/src/index.ts:357`
**Claim:** the `wheel` cache-key gate is scoped by path *prefix*, not by the exact harmony route, so `/og/harmony/default.png` — which never reads `wheel` — still gets `wheel` folded into its cache key.

```ts
const wheel = parseColorWheelId(url.searchParams.get('wheel'));
if (wheel && wheel !== DEFAULT_COLOR_WHEEL && c.req.path.startsWith('/og/harmony/')) {
  params.set('wheel', wheel);
}
```

**Failing input → wrong outcome:** `GET /og/harmony/default.png` and `GET /og/harmony/default.png?wheel=munsell` (and `?wheel=oklch-hue`, `?wheel=oklch-lightness`, `?wheel=hsv`) all reach `app.get('/og/:tool/default.png', …)`, whose handler is `renderOGImage(buildDefaultCardSvg(tool, frame, locale))` — `buildDefaultCardSvg` (index.ts:572) takes no `wheel` argument at all. `c.req.path` for that request is `/og/harmony/default.png`, which satisfies `startsWith('/og/harmony/')`, so each distinct (valid) `wheel` value mints its own cache key and forces its own resvg render of the byte-identical default card — up to 6 unauthenticated re-renders (5 wheel ids + absent) of one picture. This is exactly the class of bug FINDING-024 closed for `wheel` on the *data* route (see the surrounding comment block, index.ts:340–355, and the parallel, deliberately-scoped fix for `mode`), reintroduced here because the scoping check is a prefix match rather than an exact-route check.
**Why tests miss it:** `og-guards.test.ts`'s "a wheel on a route that cannot read it shares the bare entry" test (line ~590) only exercises `/og/gradient/43/44/5`, never `/og/harmony/default.png`; `index.test.ts`'s `?frame=x` parity sweep includes `/og/harmony/default.png` but never varies `?wheel=` there.
**Covered by test:** no.
**Fix direction:** gate on the exact parameterized route (e.g. check the path does **not** end in `/default.png`, or move the `wheel` inclusion into a small per-route capability check shared with the `mode`/mixer gating) rather than a prefix match.

### og-worker-02 — OPT, LOW — `apps/og-worker/src/index.ts:516` and `:1218`
**Claim:** both SPA pass-through calls (`fetch(request)` for a human hit on a tool page, and `fetch(c.req.raw)` in the catch-all) carry no `AbortSignal`/timeout, so a slow or hanging `APP_BASE_URL` origin ties up the Worker's own request budget with no worker-side bound.
**Failing input → wrong outcome:** not independently reproducible from here (depends on origin behavior) — flagged per the brief's "fetch without timeout" checklist item rather than as a proven failure. CF's platform-level subrequest/wall-clock limits provide an outer bound, so this is defense-in-depth, not a live incident.
**Why tests miss it:** no test simulates a hung origin.
**Covered by test:** no.
**Fix direction:** wrap both `fetch()` calls with an `AbortSignal.timeout(…)` and a fallback redirect to `APP_BASE_URL` on abort/timeout, matching the existing 302 fallback used elsewhere in the same handlers.

## 3. POSITIVE

- `services/renderer.ts`'s `initRenderer()` resets `wasmInitPromise = null` in a `.catch()` so a first-request WASM init failure does not permanently poison the isolate with a cached rejected promise (BUG-013) — exactly the "cached rejected init promise" pattern the brief asked to check, and it holds.
- `index.privacy.test.ts` proves FINDING-006 (2026-09-15) still holds: the "Serving OG metadata" log carries only `tool`/`locale`/`crawler` — the test asserts the raw UA, full URL and a sentinel query value never reach the log — and `crawlerInfo.userAgent` is provably never read anywhere else in `src/` (grepped).
- `og-guards.test.ts` has thorough, non-vacuous cache-key coverage for `lang`, `frame`, `algo`, `mode` (mixer-only) and `wheel` (harmony-only, case-folded) as independent axes, plus the `CARD_VERSION`/BUG-025 invalidation-on-deploy behavior and the `.png`-suffix / percent-encoding / HEAD-vs-GET collapsing rules — all asserted via actual render-call counts, not just status codes.
- `harmony.ts` correctly uses core's `generateHarmonySlots` for every rotating harmony type (only `monochromatic`'s no-op `[0]` offset takes the nearest-dye branch) — no local hue rotation exists in this worker, consistent with the harmony-convergence fix (PR #159).
- `font-coverage.test.ts` and `font-faces.test.ts` both read the real bundled `.ttf` files off disk (`readFileSync` + a hand-rolled `cmap` parser, and a real `resvg-wasm` render comparing PNG bytes at three weights) rather than mocking the font imports — exactly the "tests must read real files" bar the brief set, and `mixer.test.ts`'s algorithm-disagreement test asserts `expect(checked).toBe(1)` so it cannot vacuously pass if no disagreeing pair is found.
- Share-URL dye-id parsing is consistently stainID-only (`dyeByStainId` built by filtering `d.stainID !== null` before indexing) — a legacy/facewear-range id simply misses to the default/not-found card rather than crashing or resolving to the wrong dye.

## 4. REJECTED

- `mode` cache-key inclusion (`index.ts:340-343`) is **not** path-scoped to the mixer routes the way `wheel` is scoped to harmony — but its validation comment explicitly parallels it to `algo`'s (deliberately unscoped, bounded to ~9-10 enum states across all routes) rather than to `wheel`'s scoped design; no evidence this diverges from the accepted `algo` tradeoff, so not filed as a defect distinct from that accepted design.
- `MixerParams.dyeC` treated via a truthy check (`params.dyeC ?` in `generateMixerOGData`) rather than `!== undefined` like `BudgetParams.dye` — would silently drop a `dyeC=0` third dye — but stainID 0 is never a real dye (`dyeByStainId` only holds 1+ keys), so this is unreachable for any real input.
- Cache-hit responses returned from `caches.default` might have immutable `Headers` (blocking the outer `X-Content-Type-Options` mutation) — could not verify against the real Workers Cache API from static reading, and the existing nosniff test only exercises a fresh render; left unfiled per the verification bar (could not prove failure).
- `generateExtractorOG` accepting arbitrary-magnitude `share` values (only `>0` and integer-canonical are enforced) with no upper bound — cosmetic only (proportional widths still sum correctly relative to each other; band count is separately capped at `BAND_CAP`), not a correctness bug.
- `budget.ts`'s `candidates[0]` possibly undefined when zero Type-A dyes exist — guarded by `(best ?? { dye: target })` at the read site, and unreachable in practice given 105/125 dyes are consolidated across three real Type-A/B/C ids.

## 5. COVERED

26 source files + 6 test files read in full or substantially, plus `wrangler.toml` and `apps/og-worker/CLAUDE.md`:

`index.ts`, `og-data-generator.ts`, `og-params.ts`, `crawler-detector.ts`, `types.ts`,
`services/character-cells.ts`, `services/translator.ts`, `services/fonts.ts`, `services/renderer.ts`,
`services/og-strings.ts`, `services/og-embed.ts`, `services/svg/band.ts`, `services/svg/band-shared.ts`,
`services/svg/dye-helpers.ts`, `services/svg/harmony.ts`, `services/svg/gradient.ts`,
`services/svg/mixer.ts`, `services/svg/swatch.ts`, `services/svg/comparison.ts`,
`services/svg/accessibility.ts`, `services/svg/extractor.ts`, `services/svg/presets.ts`,
`services/svg/budget.ts`, `services/svg/default-card.ts`, `services/svg/tokens.ts`, `services/svg/index.ts`;
`services/font-coverage.test.ts`, `services/font-faces.test.ts`, `index.privacy.test.ts`,
`og-guards.test.ts`, `index.test.ts` (partial — image-route/`?frame=x` sweep), `services/svg/mixer.test.ts` (partial).
