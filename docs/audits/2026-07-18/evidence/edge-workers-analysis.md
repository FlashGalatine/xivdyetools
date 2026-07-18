# Edge Workers Deep-Dive Analysis — api-worker / og-worker / universalis-proxy

**Date:** 2026-07-18
**Scope:** `apps/api-worker`, `apps/og-worker`, `apps/universalis-proxy` (read-only analysis)
**Method:** Full source read of all route/service/middleware/config files in the three workers, cross-referenced against `@xivdyetools/core` (LocalizationService, DyeSearch, TranslationProvider), `@xivdyetools/rate-limiter` (MemoryRateLimiter), and `@xivdyetools/svg` (base.ts) where the workers depend on their semantics.

---

## Prior findings status (2026-05-28 audit)

### BUG-002 (og-worker: string query params cast to enum/union types without membership validation)

**Status: FIXED on all `/og/*` image routes; RESIDUAL gaps on crawler-HTML routes and swatch context params.**

Fixed — `apps/og-worker/src/index.ts` now declares `VALID_HARMONY_TYPES` / `VALID_ALGORITHMS` / `VALID_VISION_TYPES` (lines 66–75) and rejects with 400:

- harmonyType + algo: lines 231–236 (`/og/harmony/...`)
- algo: lines 274–276, 318–320, 363–365, 407–409 (gradient, mixer×2, swatch)
- visionType: lines 479–481 (`/og/accessibility/...`)

Residual (not fixed):

1. **Crawler-HTML routes still cast unvalidated:** `apps/og-worker/src/og-data-generator.ts:466` (`(searchParams.get('harmony') || 'complementary').toLowerCase() as HarmonyParams['harmony']`), `:500-502` (`sheet as ColorSheetCategory`, `gender as CharacterGender`), `:525` (`vision as VisionType`). Impact is cosmetic (values are HTML-escaped, and `TranslationProvider.getHarmonyType/getVisionShort/getSheetName` fall through unknown keys), but junk values flow into titles/descriptions and `og:image` URLs.
2. **Swatch image route context params:** `apps/og-worker/src/index.ts:402-404` — `sheet` / `gender` are cast (`as import('./types').ColorSheetCategory`) with no membership check; they flow into `getCharacterColorFromSheet()` which treats an unknown sheet as a shared category and silently returns null. Benign today but is exactly the pattern BUG-002 flagged.
3. **Case mismatch:** `apps/og-worker/src/index.ts:220-221` lowercases the harmony type for *use* but line 231 validates the **non-lowercased** raw value — `/og/harmony/5771/Tetradic.png` is rejected 400 even though the generation path would have handled it.

### OPT-001 (KR subset font ~595 KiB oversized — subset from wrong charset scope)

**Status: FIXED (2026-05-29).**

- `apps/og-worker/scripts/subset-cjk-fonts.py:191-198` now scopes the KR subset to Hangul + ASCII only (`c < 0x80 or 0xAC00 <= c <= 0xD7AF or 0x1100 <= c <= 0x11FF`) with an explicit `# OPT-001` comment; the overall charset is collected from `packages/core/src/data/locales/{ja,ko,zh,de,fr}.json` (dye names/categories only, bot-i18n intentionally excluded).
- Current file sizes (both dated 2026-05-29):
  - `src/fonts/NotoSansKR-Subset.ttf` = **180,704 bytes (~176 KiB)** — down from ~595 KiB oversize.
  - `src/fonts/NotoSansSC-Subset.ttf` = **296,536 bytes (~290 KiB)**.
- Note: `apps/og-worker/CLAUDE.md` still claims "Three brand fonts" and "these fonts are Latin-only — CJK rendering would require subset font additions" — stale; the CJK subsets are bundled and wired into `services/fonts.ts` (lines 26–28, 52–58) and `FONTS.primaryCjk`/`headerCjk` are used by the generators. See REFACTOR-W3.

---

## New findings

Severity ordering: CRITICAL > HIGH > MEDIUM > LOW. IDs: `BUG-Wn`, `REFACTOR-Wn`, `OPT-Wn` (W = this 2026-07-18 edge-workers audit; distinct from the global DEAD-XXX registry).

---

### BUG-W1 — Cross-request locale race in api-worker via `LocalizationService` singleton (wrong-language responses, cacheable)

- **Kind:** BUG
- **Severity:** HIGH
- **Location:** `apps/api-worker/src/middleware/locale.ts:20-25`; `packages/core/src/services/LocalizationService.ts:170, 175, 207-230, 329-338`; consumers: `apps/api-worker/src/routes/dyes.ts:56-64, 111-114, 180-182, 216-218, 295-300`, `apps/api-worker/src/routes/match.ts:80-82, 136-141`

**Description:** `localeMiddleware` does `await LocalizationService.setLocale(locale)` per request. The static API mutates a **module-scope singleton's** `currentLocale` (`LocalizationService.ts:170`, `private static defaultInstance`), and every subsequent `LocalizationService.getDyeName(...)` / `dyeService.searchByLocalizedName(...)` reads that shared field. Cloudflare Worker isolates serve many requests **concurrently**; every `await` in the middleware chain (KV rate-limit read runs *before* locale middleware; `setLocale` itself awaits) is an interleaving point. Two concurrent requests with different `?locale=` can interleave so that request A (locale=ja) runs its handler after request B's `setLocale('de')` has completed — A's response then contains German `localizedName`s (and `/v1/dyes/search` matches against German names) while `meta.locale` still says `ja`.

**Evidence:**

```ts
// middleware/locale.ts
export const localeMiddleware: MiddlewareHandler = async (c, next) => {
  const locale = parseLocale(c.req.query('locale'));
  await LocalizationService.setLocale(locale);   // ← mutates shared singleton; await = interleave point
  c.set('locale', locale);
  await next();
};

// core LocalizationService.ts
private currentLocale: LocaleCode = 'en';                    // shared per-isolate state
async setLocale(locale: LocaleCode): Promise<void> {
  if (this.registry.hasLocale(locale)) {
    this.currentLocale = locale; ... return;                 // cached path — sync mutation
  }
  await Promise.resolve();                                   // yield point
  ...
  this.currentLocale = locale;
}
getDyeName(itemID: number): string | null {
  return this.translator.getDyeName(itemID, this.currentLocale);  // reads shared state
}
```

Interleaving (all locales already cached, the common steady-state case): A: `await setLocale('ja')` resolves → continuation queued. B (running on the same isolate): `setLocale('de')` sets `currentLocale='de'` synchronously. Microtask queue then runs A's continuation → A's handler calls `getDyeName()` under `'de'`.

**Aggravator — cache poisoning:** every affected handler sets `Cache-Control: public, max-age=3600, s-maxage=86400` (e.g. `dyes.ts:67`, `match.ts:84`). A wrong-language body can be cached for up to 24 h by any shared cache (and 1 h by browsers) under the *correct-locale* URL.

**Why it evades testing:** unit/integration tests issue requests sequentially; the race needs two in-flight requests with different locales interleaved inside one isolate. Load tests with a single locale also never trip it. In production it manifests as rare, unreproducible "API returned Japanese names on my German request" reports.

**Suggested fix:** Port og-worker's REFACTOR-001 pattern (already proven in this repo): build a module-scope stateless `TranslationProvider` with all 6 locales preloaded (`apps/og-worker/src/services/translator.ts`) and pass `locale` explicitly to `getDyeName(itemID, locale)` per call. Replace `searchByLocalizedName(q)` (which also reads the singleton via `LocalizationService.isLocaleLoaded()/getDyeName()` — `packages/core/src/services/DyeService.ts:364-386`) with an explicit-locale search helper. Delete `localeMiddleware`'s `setLocale` call; keep `c.set('locale', ...)`.

---

### BUG-W2 — Default `wrangler deploy` overwrites the production worker with development vars (all three workers share prod worker name + prod routes in the top-level env)

- **Kind:** BUG
- **Severity:** HIGH
- **Location:** `apps/universalis-proxy/wrangler.toml:1-26` + `package.json` (`"deploy": "wrangler deploy"`); `apps/api-worker/wrangler.toml:1-28`; `apps/og-worker/wrangler.toml:1-37`

**Description:** In each worker, `[env.production].name` is **identical** to the top-level `name`, and the top-level config carries the **production routes/custom domains** but **development vars**. So `pnpm deploy` ("staging" per each CLAUDE.md) actually deploys to the same production worker + custom domains, replacing production configuration:

- **universalis-proxy:** top-level has `ENVIRONMENT="development"`, `ALLOWED_ORIGINS="http://localhost:5173,..."`, `RATE_LIMIT_REQUESTS="60"` — with custom domains `proxy.xivdyetools.app` / `proxy.xivdyetools.projectgalatine.com` (lines 6–9). After a default deploy, the dev-mode CORS branch (`index.ts:59-61`) allows **any** localhost origin against production, and browser callers from `https://xivdyetools.app` get `Access-Control-Allow-Origin: http://localhost:5173` (fallback `allowedOrigins[0]`) → production web-app CORS breaks entirely.
- **api-worker:** top-level `ENVIRONMENT="development"` (enables verbose error `stack` in 500 bodies per `index.ts:159-168`, disables HSTS) and binds `RATE_LIMIT` to the **dev KV namespace id** (`8f2028...` vs prod `a57d95...`) — on the production custom domain `data.xivdyetools.app`.
- **og-worker:** same name-collision pattern; top-level vars happen to equal production vars, so damage is limited, but the "staging deploy" is still a production deploy.

**Evidence:**

```toml
# universalis-proxy/wrangler.toml
name = "xivdyetools-universalis-proxy"
routes = [
  { pattern = "proxy.xivdyetools.app", custom_domain = true }, ...
]
[vars]
ENVIRONMENT = "development"
ALLOWED_ORIGINS = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173"
...
[env.production]
name = "xivdyetools-universalis-proxy"   # ← same worker
```

**Reproduction:** `pnpm --filter xivdyetools-universalis-proxy run deploy` → check `proxy.xivdyetools.app/` health JSON: `environment: "development"`; production site's market-board calls start failing CORS.

**Why it evades testing:** no test exercises wrangler config; CI deploy workflows presumably always pass `--env production`, so the hazard only fires on a manual local `pnpm deploy` — exactly the "quick staging check" scenario the scripts invite.

**Suggested fix:** Give the top-level (default) env a distinct name (e.g. `xivdyetools-universalis-proxy-dev`) and **move routes/custom domains under `[env.production]` only** (dev deploys then get a workers.dev URL). Repeat for all three workers. Alternatively delete the top-level deploy target and make `deploy` = `wrangler deploy --env production` with a separate `[env.staging]`.

---

### BUG-W3 — universalis-proxy CORS responses are publicly cacheable but never send `Vary: Origin`

- **Kind:** BUG
- **Severity:** MEDIUM
- **Location:** `apps/universalis-proxy/src/index.ts:53-87` (CORS middleware), `apps/universalis-proxy/src/services/cached-fetch.ts:206-217` (`buildCacheHeaders` → `Cache-Control: public, max-age=...`)

**Description:** The CORS middleware emits a **per-origin** `Access-Control-Allow-Origin` (echoes the request Origin when allowed, else `allowedOrigins[0]`), and success responses carry `Cache-Control: public, max-age=300` (24 h for worlds/data-centers). No `Vary: Origin` header is ever set. Any shared cache between the worker and the user — and the browser's own HTTP cache when the same proxy URL is fetched from **both** allowed production origins (`https://xivdyetools.app` and `https://xivdyetools.projectgalatine.com` are both in `ALLOWED_ORIGINS`) — may replay a response whose `Access-Control-Allow-Origin` names the *other* origin, causing spurious CORS failures. This is precisely the error class the proxy exists to eliminate.

**Evidence:**

```ts
// index.ts
const corsOrigin = isAllowed ? origin : allowedOrigins[0];  // response varies by request Origin
...
c.header('Access-Control-Allow-Origin', corsOrigin);        // but no Vary: Origin anywhere

// cached-fetch.ts
'Cache-Control': `public, max-age=${config.cacheTtl}`,      // downstream caches may key on URL only
```

**Reproduction:** Load the budget tool on `xivdyetools.projectgalatine.com`, then within 5 minutes load it on `xivdyetools.app` behind the same caching proxy (corporate proxy, some browser HTTP-cache implementations) → second origin receives `Access-Control-Allow-Origin: https://xivdyetools.projectgalatine.com` → fetch blocked.

**Why it evades testing:** requires two distinct Origins hitting a shared HTTP cache; unit tests and single-origin smoke tests never see it.

**Suggested fix:** Add `c.header('Vary', 'Origin')` in the CORS middleware (both the OPTIONS response and the post-`next()` path). Cheap, standard, no downside.

---

### BUG-W4 — Stale (SWR) responses re-served with full `max-age`, exporting staleness downstream

- **Kind:** BUG
- **Severity:** MEDIUM
- **Location:** `apps/universalis-proxy/src/services/cached-fetch.ts:206-217`; used at `apps/universalis-proxy/src/index.ts:212, 275, 312`

**Description:** `buildCacheHeaders()` always emits `Cache-Control: public, max-age=${config.cacheTtl}` — including when `isStale === true`. A response served from the SWR window (already up to `cacheTtl + swrWindow` = 7 min old for aggregated prices) instructs browsers/downstream caches to treat it as fresh for another full 300 s. Worst-case client-observed price age becomes `cacheTtl + swrWindow + cacheTtl` (~12 min) instead of the intended ~7 min; for worlds/data-centers it's 24 h on top of up to 30 h. The `X-Cache-Stale: true` debug header is informational only — HTTP caches ignore it. (Also note doc drift: `apps/universalis-proxy/CLAUDE.md` claims `X-Cache: HIT-STALE`; code emits `X-Cache: HIT` + separate `X-Cache-Stale` header.)

**Evidence:**

```ts
export function buildCacheHeaders(source, isStale, config) {
  return {
    'X-Cache': source === 'upstream' ? 'MISS' : 'HIT',
    'X-Cache-Source': source,
    'X-Cache-Stale': isStale ? 'true' : 'false',
    'Cache-Control': `public, max-age=${config.cacheTtl}`,   // ← same TTL even when stale
  };
}
```

**Reproduction:** Prime cache, wait 6 min (inside SWR window), fetch → response is stale but tells the browser `max-age=300`; the browser will not revalidate for 5 more minutes even though the edge already refreshed.

**Why it evades testing:** service tests assert `isStale` flag and header presence, not the *semantic interaction* of `max-age` with the age of the payload; only wall-clock, multi-layer cache tests would catch it.

**Suggested fix:** For stale hits, emit `Cache-Control: public, max-age=0, must-revalidate` (or a small value like 30 s), or better: emit `max-age=<remaining freshness>` computed from `X-Cached-At`, plus `stale-while-revalidate=<swrWindow>` on fresh responses so downstream caches implement SWR natively.

---

### BUG-W5 — Datacenter/world whitelist is stale: EU "Shadow" DC and its worlds are rejected

- **Kind:** BUG
- **Severity:** MEDIUM
- **Location:** `apps/universalis-proxy/src/config/datacenters.ts:19-140`

**Description:** `VALID_DATACENTERS` lists 11 DCs ending at Materia and `VALID_WORLDS` lists 84 worlds. The EU **Shadow** datacenter (added to the live game in 2024 with worlds Innocence, Pixie, Titania, Tycoon) is absent from both sets, so legitimate queries like `/api/v2/aggregated/Shadow/5729` or `/api/v2/aggregated/Innocence/5729` return `400 Invalid datacenter or world name` even though Universalis serves them. Any future world/DC additions (SE adds them roughly yearly) will silently break the same way. (Korean/Chinese DCs are also absent — acceptable if intentional since the web-app doesn't target those regions, but worth an explicit comment.)

**Evidence:**

```ts
export const VALID_DATACENTERS = new Set([
  // Japan
  'elemental', 'gaia', 'mana', 'meteor',
  // North America
  'aether', 'crystal', 'dynamis', 'primal',
  // Europe
  'chaos', 'light',          // ← no 'shadow'
  // Oceania
  'materia',
]);
```

**Reproduction:** `curl "https://proxy.xivdyetools.app/api/v2/aggregated/Innocence/5729"` → 400; same request direct to `universalis.app/api/v2/aggregated/Innocence/5729` → 200.

**Why it evades testing:** the whitelist test fixtures were written from the same list; nothing cross-checks against the live `/data-centers` endpoint the worker itself proxies.

**Suggested fix:** Add `'shadow'` + `'innocence', 'pixie', 'titania', 'tycoon'`. Longer-term: on whitelist miss, fall back to a check against the (24 h-cached) `/api/v2/data-centers` + `/worlds` payloads the worker already caches, so the list self-heals; keep the static set as the fast path.

---

### BUG-W6 — og-worker: failed resvg-wasm init permanently poisons the isolate (rejected promise cached forever)

- **Kind:** BUG
- **Severity:** MEDIUM
- **Location:** `apps/og-worker/src/services/renderer.ts:20-52`

**Description:** `initRenderer()` caches `wasmInitPromise` before awaiting it, but never clears it on rejection. If the first `initWasm(resvgWasm)` call fails for a transient reason (isolate memory pressure at cold start is the realistic case for an ~8 MiB-bundle worker), `wasmInitialized` stays `false` and every subsequent request awaits the **same rejected promise** — the isolate serves 500 (`Image generation failed`) for every image request until Cloudflare happens to recycle it.

**Evidence:**

```ts
let wasmInitialized = false;
let wasmInitPromise: Promise<void> | null = null;

export async function initRenderer(): Promise<void> {
  if (wasmInitialized) return;
  if (wasmInitPromise) {
    await wasmInitPromise;   // ← rejected promise is re-awaited forever
    return;
  }
  wasmInitPromise = (async () => {
    try {
      await initWasm(resvgWasm);
      wasmInitialized = true;
    } catch (error) {
      ...
      throw new Error(...);  // promise rejects; wasmInitPromise never reset
    }
  })();
  await wasmInitPromise;
}
```

**Reproduction:** Hard to force naturally; simulate by stubbing `initWasm` to reject once — all subsequent `renderSvgToPng` calls fail even though a retry would succeed.

**Why it evades testing:** tests either mock the renderer or run in an environment where init always succeeds; the failure mode only exists across *multiple requests to the same isolate after one bad init*.

**Suggested fix:** In the catch (or via `.catch` on the stored promise), reset `wasmInitPromise = null` before rethrowing so the next request retries. Note: `initWasm` throws "Already initialized" if called twice after a *partial* success — keep the `wasmInitialized` flag as-is and only retry when init genuinely rejected.

---

### BUG-W7 — api-worker `/v1/match/within-distance`: filters applied after core `limit` truncation → missing results

- **Kind:** BUG
- **Severity:** MEDIUM
- **Location:** `apps/api-worker/src/routes/match.ts:113-131`; `packages/core/src/services/dye/DyeSearch.ts:28-37` (`FindWithinDistanceOptions` has no `excludeIds`)

**Description:** The handler passes `limit` into `dyeService.findDyesWithinDistance()` and only afterwards removes `excludeIds` matches and applies vendor/craft/etc. filters. Core truncates to `limit` *before* the handler's filtering, so excluded/filtered dyes consume result slots. With `limit=20` (the default) and 30 dyes inside `maxDistance`, if 5 of the closest 20 are excluded the client gets 15 results even though 25 qualify — silently, with `resultCount: 15`. `/v1/match/closest` does not have this problem because it pushes `excludeIds` into `FindClosestOptions` (match.ts:52-56); the two endpoints are inconsistent.

**Evidence:**

```ts
const options: FindWithinDistanceOptions = { maxDistance, limit, matchingMethod: method, weights };
let dyes = dyeService.findDyesWithinDistance(hex, options);   // truncated to `limit` here

if (excludeIdsRaw) {
  const excludeInternalIds = new Set(resolveExcludeIds(excludeIdsRaw));
  dyes = dyes.filter((d) => !excludeInternalIds.has(d.id));   // ← removes from an already-truncated list
}
dyes = applyDyeFilters(dyes, filters);
```

**Reproduction:** `GET /v1/match/within-distance?hex=808080&maxDistance=50&limit=5&excludeIds=<the 3 closest itemIDs>` → returns 2 results; the same query without excludeIds returns 5, and dyes ranked 6–8 (which qualify and are not excluded) never appear.

**Why it evades testing:** tests assert "returns ≤ limit results" and "excluded IDs absent" separately; the interaction only shows when exclusions overlap the head of the distance-sorted list.

**Suggested fix:** Call core with `limit: 136` (or omit limit) and apply exclusions/filters first, then `slice(0, limit)`. Dataset is 136 entries — the extra work is negligible.

---

### BUG-W8 — og-worker OG images can misrepresent results: validated `algo`/`ratio` params ignored by generators

- **Kind:** BUG
- **Severity:** MEDIUM
- **Location:** `apps/og-worker/src/services/svg/harmony.ts:58-151` (param named `_algorithm`, unused); `gradient.ts:47-92` (plain RGB lerp); `mixer.ts:69-94` (RGB mix; `mixThreeColors` ignores `ratio` entirely — equal thirds)

**Description:** The routes carefully validate `?algo=oklab|ciede2000|euclidean` (index.ts BUG-002 fix) and mixer `ratio`, then pass them down — but:

- `getHarmonyMatches()` receives `_algorithm` and never uses it; matching is a hand-rolled LAB-hue scan (`harmony.ts:64-148`) rather than core's `HarmonyGenerator` (which the web-app uses). The footer still prints `Algorithm: OKLAB/CIEDE2000/...` (`og-card.ts:132-142`).
- `generateGradientSteps()` interpolates in raw RGB (`gradient.ts:47-64`) regardless of `algo`, while the web-app's gradient tool interpolates per selected algorithm.
- `generateThreeDyeMixerOG` mixes equal thirds, ignoring the `ratio` path param that was range-validated (1–99) and baked into the shared URL.

Net effect: the social-preview image advertises dyes/blends that can differ from what the shared page actually shows, with an explicit (false) algorithm label — a correctness bug in the product's terms, plus drift risk every time web-app algorithms change.

**Evidence:**

```ts
// harmony.ts
function getHarmonyMatches(dye, harmonyType, _algorithm: MatchingAlgorithm = 'oklab') { ... } // never read

// gradient.ts — RGB lerp regardless of algo
const r = Math.round(r1 + (r2 - r1) * ratio);

// mixer.ts — 3-dye ignores ratio
const r = Math.round((rgb1.r + rgb2.r + rgb3.r) / 3);
```

**Reproduction:** Share `xivdyetools.app/harmony/?dye=5771&harmony=tetradic&algo=ciede2000` in Discord — embed image footer says "Algorithm: CIEDE2000" but the four swatches were selected by LAB-hue proximity; open the page and the tool shows different matches.

**Why it evades testing:** the SVG snapshot tests assert layout, not that the pictured dyes match the web-app's algorithm output; nothing diff-tests og-worker output against `HarmonyGenerator`.

**Suggested fix:** Use core's `DyeService.findTriadicDyes / findComplementaryPair / ...` (`HarmonyOptions` supports algorithm + color space) so OG images share the web-app's engine; thread `algo` into gradient interpolation via `ColorService.mixColors*`; implement weighted 3-dye mixing or drop `ratio` from the 3-dye route and URL. At minimum stop printing an algorithm name that wasn't used.

---

### BUG-W9 — universalis-proxy: 5 MB response cap only enforced when upstream sends `Content-Length`

- **Kind:** BUG
- **Severity:** LOW
- **Location:** `apps/universalis-proxy/src/services/cached-fetch.ts:119-138`

**Description:** `fetchFromUpstream` checks `Content-Length` and throws `ResponseTooLargeError` above 5 MB, but Universalis responses delivered with `Transfer-Encoding: chunked` (no Content-Length) bypass the check entirely; `response.json()` (`cached-fetch.ts:100`) will then buffer an arbitrarily large body. PROXY-HIGH-002's protection is advisory-only against the exact class of response (unexpectedly huge aggregated payloads) it was written for — though `?listings=5&entries=5` (index.ts:204) and the ≤100-item cap keep realistic payloads small. Also note `ResponseTooLargeError` is not `instanceof UpstreamError`, so it surfaces as the generic 502 branch in `index.ts:240-250` — acceptable, but a dedicated 502 message would aid debugging.

**Suggested fix:** Stream-read with a byte budget: `response.body.getReader()` accumulating into chunks, aborting past `MAX_RESPONSE_SIZE_BYTES`, then `JSON.parse` — or at least `const text = await response.text()` behind a `TextDecoder` loop with the same cap.

**Why it evades testing:** tests mock `fetch` with Content-Length set; real chunked upstream behavior never appears in unit tests.

---

### BUG-W10 — universalis-proxy rate limiting is per-isolate (MemoryRateLimiter), effectively advisory in production

- **Kind:** BUG
- **Severity:** LOW (documented design tradeoff, but worth restating with numbers)
- **Location:** `apps/universalis-proxy/src/services/rate-limiter.ts:40` (module-scope `new MemoryRateLimiter()`); `apps/universalis-proxy/src/index.ts:138` (`X-Forwarded-For` fallback)

**Description:** The production limit (30 req/60 s) is tracked in a per-isolate `Map`. Cloudflare spins up isolates per PoP and per load; a single client routed across N isolates gets N×30 req/min, and isolate recycling resets counters. Additionally the client-IP extraction falls back to `X-Forwarded-For` (attacker-controlled) when `CF-Connecting-IP` is absent — `@xivdyetools/rate-limiter`'s own `getClientIp` deliberately ignores XFF for this reason (SEC-002 in that package), so the proxy's hand-rolled extraction is weaker than the shared util it already depends on. In practice CF always sets `CF-Connecting-IP`, so the XFF path is dev-only — but it's dead-weight risk.

**Suggested fix:** Either accept and document (the Cache API + coalescer are the real upstream protection), or switch to `KVRateLimiter` like api-worker. Replace the manual header logic with `getClientIp(c.req.raw)` from `@xivdyetools/rate-limiter`.

---

### BUG-W11 — api-worker: Facewear dyes silently never localize (`getDyeName` keyed by synthetic negative itemID)

- **Kind:** BUG
- **Severity:** LOW
- **Location:** `apps/api-worker/src/routes/dyes.ts:62, 111-113, 180-182, 216-218, 296-298`; `apps/api-worker/src/routes/match.ts:80-82, 138-140`; `packages/core/src/services/LocalizationService.ts:329-338`

**Description:** All handlers resolve localized names via `LocalizationService.getDyeName(dye.itemID)`. Facewear entries carry synthetic hash-based negative itemIDs (domain fact), which are not keys in the locale dye-name maps (docstring: "itemID (5729-48227)"), so lookups return `null` and `localizedName` is omitted for every Facewear dye at every `?locale≠en` — no error, no fallback marker. If ko/zh/ja Facewear names exist in the locale data under another key (e.g. stainID or name), they are unreachable through this path.

**Suggested fix:** If locale data has Facewear names, add a lookup path (e.g. by `dye.id`/name) in core's `TranslationProvider`; otherwise document in api-docs that `localizedName` is absent for Facewear entries so consumers don't treat it as a data bug.

---

### BUG-W12 — og-worker `/og/default.png`: "7 days" comment actually produces a 49-day edge TTL

- **Kind:** BUG
- **Severity:** LOW
- **Location:** `apps/og-worker/src/index.ts:545`; `apps/og-worker/src/services/renderer.ts:123-124`

**Description:** `renderOGImage(svg, 604800)` sets `Cache-Control: public, max-age=604800, s-maxage=4233600` and `CDN-Cache-Control: max-age=4233600` because `renderOGImage` multiplies its argument by 7 for the edge TTL. The route comment says "Cache for 7 days"; the edge actually caches for 49 days. For a static branding card that's mostly harmless — until the branding changes and the old card lingers for weeks.

**Evidence:**

```ts
'Cache-Control': `public, max-age=${cacheMaxAge}, s-maxage=${cacheMaxAge * 7}`,
'CDN-Cache-Control': `max-age=${cacheMaxAge * 7}`,
...
return renderOGImage(svg, 604800); // Cache for 7 days   ← edge gets 49 days
```

**Suggested fix:** Make `renderOGImage` take explicit `{ browserTtl, edgeTtl }` (or document the ×7 contract) and pass `86400` for default.png if 7-day edge is the intent.

---

### BUG-W13 — og-worker catch-all/`fetch(request)` pass-through can self-fetch on the `og.` custom domain

- **Kind:** BUG
- **Severity:** LOW (needs infra confirmation)
- **Location:** `apps/og-worker/src/index.ts:171-175, 584-605`

**Description:** For non-crawler requests, both the tool handlers and the `app.all('*')` catch-all do `return fetch(request)`. On the zone-routed patterns (`xivdyetools.app/harmony/*` etc., wrangler.toml:6-13) a same-zone subrequest bypasses the worker and hits the origin — fine. But the `/og/*` image endpoints are served from `og.xivdyetools.app`, which (matching api-worker/proxy convention) is a **Workers custom domain**, i.e. the worker *is* the origin. A human (non-crawler UA) hitting any unknown path on `og.xivdyetools.app` reaches the catch-all's `fetch(c.req.raw)` → the worker fetches its own hostname → Cloudflare error 1042 (worker cannot fetch its own custom domain), surfacing as a 5xx instead of a 404. Low traffic, but it turns every stray human/bot-without-known-UA request on the og domain into an error.

**Suggested fix:** In the catch-all, detect when `url.hostname === new URL(c.env.OG_IMAGE_BASE_URL).hostname` and return a 404 (or redirect to `APP_BASE_URL`) instead of `fetch(request)`.

---

### BUG-W14 — api-worker: `parseBooleanParam` silently drops invalid values instead of 400 (inconsistent validation contract)

- **Kind:** BUG
- **Severity:** LOW
- **Location:** `apps/api-worker/src/lib/validation.ts:231-236`

**Description:** Every other parser (`parseEnumParam`, `parseIntParam`, `parseHex`) throws a structured 400 on bad input, but `parseBooleanParam('yes')` returns `undefined` — the filter is silently ignored and the client gets an unfiltered result set with a 200. A consumer sending `?metallic=yes` believes they filtered and receives wrong data with no signal. (Also `?minPrice=` (empty string) at `routes/dyes.ts:234` throws `MISSING_PARAMETER` for a parameter that *was* supplied — misleading error code, same contract-consistency theme.)

**Suggested fix:** Throw `VALIDATION_ERROR` for any value not in `{'true','1','false','0'}` (keep `undefined`/`''` → undefined), mirroring the docs; map empty-provided numerics to `VALIDATION_ERROR` instead of `MISSING_PARAMETER`.

---

### BUG-W15 — api-worker: `marketItemID` values returned by the API are not resolvable via the API

- **Kind:** BUG (API contract gap)
- **Severity:** LOW
- **Location:** `apps/api-worker/src/lib/dye-serializer.ts:51`; `apps/api-worker/src/routes/dyes.ts:192-222` (`/:id`); `apps/api-worker/src/lib/validation.ts:50-55`

**Description:** Every serialized dye exposes `marketItemID` (52254/52255/52256 for consolidated dyes). Those IDs fall in the `id >= 5729` item range, so `GET /v1/dyes/52254` resolves as an item lookup — and 404s, because the consolidated itemIDs are not entries in the dye database (legacy itemIDs remain the keys). A consumer that round-trips the field the API itself returned gets `NOT_FOUND` with no hint. `/v1/dyes/consolidation-groups` exists but nothing links the failure to it.

**Suggested fix:** In `/:id`'s not-found branch, special-case `CONSOLIDATED_IDS` values: return the consolidation group (or a 404 whose message points to `/v1/dyes/consolidation-groups?type=...`). Document in api-docs that `marketItemID` is a market-board identifier, not a lookup key.

---

### REFACTOR-W1 — og-worker's `services/svg/base.ts` is a drifted fork of `@xivdyetools/svg` `base.ts`

- **Kind:** REFACTOR
- **Severity:** MEDIUM
- **Location:** `apps/og-worker/src/services/svg/base.ts` (entire file) vs `packages/svg/src/base.ts`; also `apps/og-worker/src/services/svg/mixer.ts:50-64` (third copy of `hexToRgb`/`rgbToHex`), `apps/og-worker/src/services/fonts.ts:67-78` (`FONT_FAMILIES` duplicates `FONTS` in base.ts)

**Description:** `escapeXml`, `hexToRgb`, `rgbToHex`, `getLuminance`, `getContrastTextColor`, `createSvgDocument`, `rect`, `circle`, `line`, `text`, `group`, `linearGradient`, `THEME`, `FONTS` are byte-for-byte (or near) duplicates of the published `@xivdyetools/svg` package that og-worker does **not** depend on. The fork has already drifted in a user-visible way: the package added CJK-aware `estimateTextWidth`/`truncateText` (CJK counted 2× width, U+2026 ellipsis), while og-worker generators truncate localized dye names by raw `.length` with `'..'`:

```ts
// harmony.ts:295-296 (same pattern swatch.ts:262-263, gradient.ts:187-188)
const truncatedName =
  matchDisplayName.length > 14 ? matchDisplayName.slice(0, 12) + '..' : matchDisplayName;
```

A 10-character Japanese name is ~2× the pixel width of a 10-char Latin name, so CJK names overflow their 110 px swatch columns in OG images while the Discord bot (using the package) truncates correctly. Every future THEME/FONTS/primitive fix must now be made twice.

**Benefits:** single source of truth for primitives + CJK truncation; og-worker inherits package fixes (and its snapshot-test coverage). **Effort:** small-medium — add `@xivdyetools/svg` dependency, delete local base.ts, swap `FONTS.primaryCjk` refs (names already match), replace `.length` truncation with `truncateText`/`estimateTextWidth`. The og-card/tool generators themselves are og-specific and stay. **Risk:** low; identical function signatures. Bundle impact ~0 (same code, one copy).

---

### REFACTOR-W2 — api-worker handlers re-parse `?locale` in every route despite `localeMiddleware` already storing it

- **Kind:** REFACTOR
- **Severity:** LOW
- **Location:** `apps/api-worker/src/routes/dyes.ts:53, 93, 173, 214, 229`; `apps/api-worker/src/routes/match.ts:38, 101`; provider: `apps/api-worker/src/middleware/locale.ts:23` (`c.set('locale', locale)`)

**Description:** Seven call sites do `const locale = parseLocale(c.req.query('locale'))` even though the middleware validated and stashed the value at `c.var.locale`. Redundant validation, and a second place to forget if locale semantics change (this is exactly the duplication OPT-001/2026-04-28 was meant to remove — it removed the `setLocale` calls but left the parses). Replace with `const locale = c.get('locale')`. If BUG-W1 is fixed by moving to explicit-locale lookups, do this in the same pass. **Effort:** trivial. **Risk:** none (middleware runs on all `/v1/*`).

---

### REFACTOR-W3 — og-worker CLAUDE.md / code drift: stale font claims, duplicate `DyeService` instances, duplicate locale resolution

- **Kind:** REFACTOR
- **Severity:** LOW
- **Location:** `apps/og-worker/CLAUDE.md` ("Three brand fonts", "fonts are Latin-only"); `apps/og-worker/src/og-data-generator.ts:79` + `apps/og-worker/src/services/svg/dye-helpers.ts:17` (two `new DyeService(dyeDatabase)`); `apps/og-worker/src/index.ts:147-151` (`resolveLocale`) vs 7 inline `extractLocaleCode(c.req.query('lang') ?? '') ?? 'en'` copies (223, 266, 310, 355, 399, 444, 472)

**Description:** (a) CLAUDE.md describes the pre-CJK font state — misleads the "if fonts changed" deployment checklist item. (b) Two module-scope `DyeService` instances double the isolate init cost (validation, three indexes, hue buckets, k-d tree — ×2) for zero benefit; `og-data-generator.ts` should import the one from `dye-helpers.ts`. (c) The `resolveLocale` helper exists but only `createToolHandler` uses it; the 7 image routes inline the same expression. **Effort:** trivial. **Risk:** none.

---

### OPT-W1 — universalis-proxy: every coalesced waiter re-writes the same cache entry

- **Kind:** OPT
- **Severity:** LOW
- **Location:** `apps/universalis-proxy/src/services/cached-fetch.ts:92-104` (miss path), `:155-166` (revalidate path)

**Description:** `coalescer.coalesce()` correctly deduplicates the upstream fetch, but `cacheService.storeAsync(cacheKey, data, config)` runs **after** the coalesce in every caller — N coalesced requests produce 1 upstream fetch but N identical `cache.put()`s (each serializing the payload via `JSON.stringify` and burning a `waitUntil` slot; workers allow limited concurrent `waitUntil` tasks). Same shape in `revalidateInBackground`.

**Expected improvement:** under burst (the exact scenario coalescing targets), reduces Cache API writes and JSON serializations from N to 1. **Trade-off:** none — move the `storeAsync` call *inside* the `fetchFn` passed to `coalesce` (after `response.json()`), so only the winner stores.

---

### OPT-W2 — universalis-proxy: cache-key normalization computed but not applied to the upstream URL; no de-duplication

- **Kind:** OPT
- **Severity:** LOW
- **Location:** `apps/universalis-proxy/src/index.ts:114-121 (normalizeItemIds), 195-204`

**Description:** `normalizeItemIds` sorts but does not de-duplicate (`"5729,5729"` → key `"5729,5729"` ≠ `"5729"`), and the upstream request uses the **raw** `itemIds` string (line 204) rather than the normalized one. Consequences: (a) permutations of the same set share a cache entry but the coalescer key = cache key while upstream sees different URLs — harmless; (b) duplicated IDs fragment the cache (two entries, two upstream fetches for identical data); (c) upstream URL length/content varies for identical queries, reducing any upstream-side caching.

**Expected improvement:** marginally better cache hit rate; single canonical upstream URL. **Trade-off:** none. Add `unique()` to `normalizeItemIds` and pass `normalizedIds` in the upstream URL.

---

### OPT-W3 — og-worker: swatch OG without `sheet` does up to 64 sequential character-color sheet scans per request

- **Kind:** OPT
- **Severity:** MEDIUM
- **Location:** `apps/og-worker/src/services/svg/dye-helpers.ts:70-137` (`findCharacterColorByHex`); caller `apps/og-worker/src/services/svg/swatch.ts:150-158`

**Description:** For every `/og/swatch/:color/:limit` request without a `?sheet=` param, `findCharacterColorByHex` linearly scans 7 shared sheets, then **sequentially awaits** `getHairColors`/`getSkinColors` for 16 subraces × 2 genders × 2 sheets (64 awaited calls), each doing a linear `.find` — and the worst case (color is *not* a character color, i.e. most arbitrary swatch colors) always runs the full scan. Per-request CPU on a route that is already paying the resvg render cost.

**Expected improvement:** Build a module-scope `Map<hexUpper, CharacterColorLookup>` once (lazy, on first swatch request) covering all sheets — lookups become O(1); eliminates 64 awaits per request. Character-color data is static bundle data, so the map is safe to cache per isolate. **Trade-off:** one-time init cost (~thousands of entries) + a small retained map; both trivial next to the wasm/font footprint.

---

### OPT-W4 — og-worker: O(n) dye lookups via `getAllDyes().find()` and per-candidate LAB conversions in harmony scan

- **Kind:** OPT
- **Severity:** LOW
- **Location:** `apps/og-worker/src/services/svg/dye-helpers.ts:184-187` (`getDyeByItemId`), `apps/og-worker/src/og-data-generator.ts:88-100` (`getDyeInfo`); `apps/og-worker/src/services/svg/harmony.ts:116-148` (recomputes `hexToLab` + `getDeltaE_Oklab` for every candidate × every target hue)

**Description:** `getAllDyes()` returns a fresh array each call and both helpers linear-scan it per lookup (comparison route does this up to 16×/request). The harmony hue scan recomputes each candidate's LAB (already precomputed on `dye.lab` by `DyeDatabase.initialize()`) and an OKLAB ΔE for every candidate on every target hue even though only the winner's ΔE is used. With 136 dyes none of this is a hot spot in absolute terms, but it stacks on a CPU-billed worker doing wasm rasterization.

**Expected improvement:** use `dye.lab`, compute ΔE only for the selected match, and index dyes by itemID once at module scope. **Trade-off:** none.

---

### OPT-W5 — og-worker bundle / cold-start: two DyeServices, six eagerly-loaded locales, wasm + 5 fonts

- **Kind:** OPT
- **Severity:** LOW (informational sizing)
- **Location:** `apps/og-worker/src/services/translator.ts:14-21` (eager 6-locale preload), `apps/og-worker/src/services/fonts.ts:52-58` (~770 KB fonts: SC 290 KiB + KR 176 KiB + Onest 120 KiB + SpaceGrotesk 131 KiB + Habibi 33 KiB), `@resvg/resvg-wasm` (~2.4 MiB), `CharacterColorService` data (skin/hair JSONs, ~1 MiB-class per workspace memory), dual `DyeService` (REFACTOR-W3)

**Description:** Cold start pays: wasm module + font `Uint8Array` copies + full dye DB init ×2 + all 6 locale JSONs parsed eagerly + character-color JSONs. The eager locale preload is the right call for the concurrency-safety pattern (REFACTOR-001) — keep it — but the double DyeService and any unused `character_colors` sheets are free wins. Fonts are already near-optimal post-OPT-001. If bundle pressure ever matters (paid-plan 10 MiB ceiling; discord-worker memory notes ~8 MiB there), the wasm is the dominant, irreducible term; next-largest levers are the character-color data (import per-race split files only for what swatch actually renders) and Habibi (hex digits could be subset to ~2 KiB).

**Expected improvement:** modest cold-start reduction (single dye-DB init, fewer JSON parses); a few hundred KiB bundle if character-color data is trimmed. **Trade-off:** per-race dynamic composition adds code complexity — only worth it if the bundle approaches limits.

---

### OPT-W6 — api-worker: static endpoint responses recomputed per request

- **Kind:** OPT
- **Severity:** LOW
- **Location:** `apps/api-worker/src/routes/dyes.ts:75-84` (`/categories` runs `searchByCategory` per category per request), `:128-155` (`/consolidation-groups` refilters all dyes per request); `apps/api-worker/src/lib/validation.ts:369-373` (`buildFilterExcludeIds` rescans all dyes per match request)

**Description:** These are pure functions of the static dye DB (plus `isConsolidationActive()`, which is date-dependent). With 136 dyes the absolute cost is small, but the responses are fully memoizable at module scope (`consolidation-groups` keyed by the `isConsolidationActive()` boolean), and `buildFilterExcludeIds` is memoizable by the 8-flag filter tuple (2^8·tristate ⇒ tiny LRU). Since responses already carry `s-maxage=86400`, edge caching absorbs most of this in production; this is a micro-win for origin CPU.

**Expected improvement:** shaves per-request allocation/CPU; mainly tidiness. **Trade-off:** memoization must respect the `isConsolidationActive()` date flip.

---

## Notes / non-findings verified

- **universalis-proxy request coalescer:** the deferred-promise pattern (`request-coalescer.ts:111-163`) is correct — entry stored synchronously before any await, unhandled-rejection suppressed (`promise.catch(() => {})`), error path deletes the entry before rethrow, success path delays deletion 100 ms via `waitUntil` (intentional micro-cache). The 60 s stale sweep can in theory drop a still-in-flight entry and allow one duplicate upstream request — acceptable safety valve, not a bug.
- **cache-service.ts:** SWR metadata via `X-Cached-At`/`X-Cache-TTL`/`X-SWR-Window` headers with `max-age = ttl + swr` on the stored entry is correct; expired-beyond-SWR entries are deleted via `waitUntil`.
- **api-worker rate limiting:** per-request `KVRateLimiter` construction is deliberate (BUG-004 comment) and cheap; fail-open is documented.
- **og-worker renderer concurrency:** double-guard (`wasmInitialized` + `wasmInitPromise`) correctly prevents the concurrent-first-request race (BUG-W6 is only about the *failure* path).
- **`itemIds` regex edge cases** (`"5,"`, `",5"`, `","`): `Number('') = 0` fails the `id >= 1` range check → clean 400, no NaN leakage.
- **Domain facts honored:** synthetic negative Facewear itemIDs are a feature, not a bug; `itemID > 0` filtering is respected in the proxy's ID validation path (callers filter before the `^[\d,]+$` regex).
- **Emoji/dingbats in OG SVGs** (`'✦'` og-card.ts:73, `'🎨'` og-card.ts:123, `'→'` gradient.ts:218): rendered through Latin-only bundled fonts; if Onest/Space Grotesk lack these glyphs resvg draws `.notdef` tofu. Not verified visually — spot-check one rendered PNG; if tofu, replace with SVG shapes or drop the emoji.
