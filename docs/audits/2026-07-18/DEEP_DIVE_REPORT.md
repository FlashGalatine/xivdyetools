# Deep-Dive Analysis Report — XIV Dye Tools

## Executive Summary

- **Project:** XIV Dye Tools monorepo (12 packages, 11 apps)
- **Analysis Date:** 2026-07-18
- **Method:** Six parallel area analyses (core / shared packages / bot workers / D1 workers / edge workers / web frontends); every finding verified against source before documentation; cross-area duplicates merged (4 merges)
- **Total findings:** **139** — 81 bugs (1 CRITICAL, 9 HIGH, 33 MEDIUM, 38 LOW), 29 refactoring opportunities, 29 optimizations
- **Prior audit (2026-05-28) items re-verified:** core `APIService` >100 chunking **FIXED**; og-worker enum validation **FIXED** (small residue on crawler-HTML routes); KR font subset **FIXED** (~176 KiB); JWT consolidation **PARTIALLY RESOLVED** (carried forward as [REFACTOR-001](refactoring/REFACTOR-001.md))

### Overall assessment

Core's algorithmic heart remains sound (the k-d tree is unchanged since its prior CORRECT verdict), but this wider pass surfaced substantially more than the narrow 2026-05-28 audit because it covered the full application surface. Three systemic patterns recur across independently-written services and account for a disproportionate share of findings:

1. **Mutable module/singleton state on Cloudflare Workers** — the `LocalizationService` locale race (BUG-006), self-disabling env-validation guards (BUG-017), cached-rejected-promise isolate poisoning (BUG-013), per-isolate in-memory rate limiting (BUG-066, OPT-004). Workers' isolate model makes module state both shared (across requests) and unreliable (across isolates/colos); code written with single-process assumptions fails both ways.
2. **Copy-drift between shared packages and per-app reimplementations** — the JWT verifier (REFACTOR-001), the oauth rate-limit path table (BUG-007 exists in *both* copies), og-worker's forked SVG base (REFACTOR-009), bot API clients (REFACTOR-010), match-quality thresholds (REFACTOR-004). Where a copy exists, it has already drifted.
3. **Moderation/state-machine gaps in presets-api** — self-approval (BUG-001), public exposure of unmoderated content (BUG-014/015), signature poisoning (BUG-003), dead CJK filters (BUG-002).

## Summary by Category

### Hidden Bugs

| ID | Area | Title | Severity |
|----|------|-------|----------|
| [BUG-001](bugs/BUG-001.md) | presets-api | Owner can self-approve rejected/flagged presets via PATCH | **CRITICAL** |
| [BUG-002](bugs/BUG-002.md) | presets-api | CJK profanity lists never match (`\b` has no boundary at CJK chars) | HIGH |
| [BUG-003](bugs/BUG-003.md) | presets-api | Rejected preset permanently poisons its `dye_signature` (UNIQUE vs status-filtered checks) | HIGH |
| [BUG-004](bugs/BUG-004.md) | oauth | XIVAuth account merge hits `UNIQUE(discord_id)` → deterministic login 500 loop | HIGH |
| [BUG-005](bugs/BUG-005.md) | core | `ColorManipulator` mutates HSV objects returned by reference from LRU caches | HIGH |
| [BUG-006](bugs/BUG-006.md) | core + api-worker | `LocalizationService` singleton locale race; wrong-language responses cacheable 24 h *(merged)* | HIGH |
| [BUG-007](bugs/BUG-007.md) | rate-limiter + oauth | `/auth/xivauth/callback` shadowed by `/auth/xivauth` prefix — wrong limit, in both copies *(merged)* | HIGH |
| [BUG-008](bugs/BUG-008.md) | edge workers | Plain `wrangler deploy` targets the production worker (prod domains + dev vars) in all 3 edge workers | HIGH |
| [BUG-009](bugs/BUG-009.md) | discord-worker | Approve/Reject buttons posted by main bot are unroutable (cross-Discord-application) | HIGH |
| [BUG-010](bugs/BUG-010.md) | web-app | Budget & Swatch tools key prices by consolidated market itemID but look up by original dye itemID (105 dyes lose prices) | HIGH |
| [BUG-011](bugs/BUG-011.md) | core | Cache-write failure discards successfully fetched price data | MEDIUM |
| [BUG-012](bugs/BUG-012.md) | core | `buildBatchApiUrl` invalid-ID throw sits outside try → uncaught AppError | MEDIUM |
| [BUG-013](bugs/BUG-013.md) | core + og-worker + discord-worker | Cached rejected init promise poisons the isolate forever (resvg-wasm ×2, lazy JSON) *(merged)* | MEDIUM |
| [BUG-014](bugs/BUG-014.md) | presets-api | `GET /presets/:id` publicly serves hidden/pending/rejected presets (incl. `previous_values`) | MEDIUM |
| [BUG-015](bugs/BUG-015.md) | presets-api | `?status=pending/rejected/flagged` publicly lists unmoderated content | MEDIUM |
| [BUG-016](bugs/BUG-016.md) | presets-api | Pagination unvalidated: `page=abc` → NaN bind 500; `limit=-1` → unbounded dump | MEDIUM |
| [BUG-017](bugs/BUG-017.md) | presets-api + oauth + discord-worker | Env-validation guard disables itself after the first request per isolate *(merged)* | MEDIUM |
| [BUG-018](bugs/BUG-018.md) | oauth | Redirect-URI allowlists disagree across authorize / Discord callback / XIVAuth callback | MEDIUM |
| [BUG-019](bugs/BUG-019.md) | presets-api | Vote insert + `vote_count` update not batched → permanent counter drift | MEDIUM |
| [BUG-020](bugs/BUG-020.md) | presets-api | Moderation log inserted before status update; action derived from stale status (TOCTOU) | MEDIUM |
| [BUG-021](bugs/BUG-021.md) | oauth | `/auth/refresh` never revokes old jti; no absolute session lifetime | MEDIUM |
| [BUG-022](bugs/BUG-022.md) | rate-limiter | `KVRateLimiter` OCC scaffolded but never implemented (version metadata never compared) | MEDIUM |
| [BUG-023](bugs/BUG-023.md) | rate-limiter | `MemoryRateLimiter` cleanup applies current request's `windowMs` to ALL keys | MEDIUM |
| [BUG-024](bugs/BUG-024.md) | logger | Context redaction is exact case-sensitive key match (`Token`/`Authorization` bypass) | MEDIUM |
| [BUG-025](bugs/BUG-025.md) | logger | `sanitizeErrorMessage` bypassed by JSON-style `"token":"…"` and spaced `key = value` | MEDIUM |
| [BUG-026](bugs/BUG-026.md) | logger | Browser preset sends raw unredacted context/error to errorTracker (Sentry) | MEDIUM |
| [BUG-027](bugs/BUG-027.md) | universalis-proxy | Per-origin CORS responses cached `public` without `Vary: Origin` | MEDIUM |
| [BUG-028](bugs/BUG-028.md) | universalis-proxy | Stale SWR responses re-served with full `max-age` (staleness exported downstream) | MEDIUM |
| [BUG-029](bugs/BUG-029.md) | universalis-proxy | Datacenter whitelist missing EU Shadow DC + its 4 worlds (valid queries 400) | MEDIUM |
| [BUG-030](bugs/BUG-030.md) | api-worker | `/v1/match/within-distance` applies excludeIds/filters after core `limit` truncation | MEDIUM |
| [BUG-031](bugs/BUG-031.md) | og-worker | OG generators ignore validated `algo` (and 3-dye `ratio`); images carry false algorithm label | MEDIUM |
| [BUG-032](bugs/BUG-032.md) | discord-worker | `/budget find` accepts Facewear target dye; negative itemID fails the whole Universalis batch | MEDIUM |
| [BUG-033](bugs/BUG-033.md) | discord-worker | Universalis parsing always reads `.dc` scope; world-scoped queries show DC-wide prices | MEDIUM |
| [BUG-034](bugs/BUG-034.md) | discord-worker | `getPresetByName` `limit: 1` defeats exact-match selection | MEDIUM |
| [BUG-035](bugs/BUG-035.md) | discord-worker | Deferred follow-up edits never check `.ok`; catch-path edits can reject unhandled in `waitUntil` | MEDIUM |
| [BUG-036](bugs/BUG-036.md) | discord-worker | KV read-modify-write lost updates on favorites/collections/preferences blobs | MEDIUM |
| [BUG-037](bugs/BUG-037.md) | discord-worker | `/stats` unique users cap at 1000 (KV list pagination ignored) | MEDIUM |
| [BUG-038](bugs/BUG-038.md) | stoat-worker | Reaction context keyed by user's message ID, overwritten on multi-match, listener never registered | MEDIUM |
| [BUG-039](bugs/BUG-039.md) | web-app | Server change doesn't invalidate in-flight price fetch; stale prices repopulate cleared cache | MEDIUM |
| [BUG-040](bugs/BUG-040.md) | web-app | `loadToolContent` race on rapid navigation leaks orphaned tool instances | MEDIUM |
| [BUG-041](bugs/BUG-041.md) | web-app | LanguageService English fallback never loads for non-English users (raw dot-paths render) | MEDIUM |
| [BUG-042](bugs/BUG-042.md) | web-app | Comparison restore filters `!== undefined` but `getDyeById` returns `null` → crash on stale IDs | MEDIUM |
| [BUG-043](bugs/BUG-043.md) | web-app | Changelog modal misrenders when APP_VERSION missing from CHANGELOG-laymans.md | MEDIUM |
| [BUG-044](bugs/BUG-044.md) | core | `samplePixels` divides by zero at `maxSamples===1`; no clamp at ≤0 | LOW |
| [BUG-045](bugs/BUG-045.md) | core | `getNonMetallicDyes` silently returns metallic dyes when no locale ever loaded | LOW |
| [BUG-046](bugs/BUG-046.md) | core | `DefaultRateLimiter` burst-through under concurrency (no slot reservation) | LOW |
| [BUG-047](bugs/BUG-047.md) | core | `findComplementaryPair` never excludes base dye; self-match on near-neutral grays | LOW |
| [BUG-048](bugs/BUG-048.md) | core | `sortByProperty` doc claims undefined→end but comparator treats undefined as equal | LOW |
| [BUG-049](bugs/BUG-049.md) | presets-api | Daily submission limit COUNT-then-INSERT TOCTOU | LOW |
| [BUG-050](bugs/BUG-050.md) | presets-api | Moderation stats compares ISO-`T` timestamps against space-format `datetime('now')` | LOW |
| [BUG-051](bugs/BUG-051.md) | oauth | Refresh grace period NaN-passes for exp-less signed tokens | LOW |
| [BUG-052](bugs/BUG-052.md) | presets-api | `previous_values` overwritten per flagged edit despite append-only-audit-log comment | LOW |
| [BUG-053](bugs/BUG-053.md) | presets-api | `BOT_API_SECRET` compared with non-constant-time `===` | LOW |
| [BUG-054](bugs/BUG-054.md) | presets-api | Content-Type 415 gate trusts Content-Length; chunked bodies bypass it and the JSON depth limit | LOW |
| [BUG-055](bugs/BUG-055.md) | rate-limiter | Upstash `resetAt`/`retryAfter` always report full window, not actual remaining TTL | LOW |
| [BUG-056](bugs/BUG-056.md) | svg | Emoji in SVG text render as tofu in resvg PNGs | LOW |
| [BUG-057](bugs/BUG-057.md) | auth | `JWTPayload.type` (`access`/`refresh`) declared but never validated | LOW |
| [BUG-058](bugs/BUG-058.md) | auth | `verifyJWTSignatureOnly` max-age check silently skipped when `iat` missing/0 | LOW |
| [BUG-059](bugs/BUG-059.md) | auth | Discord body limit counts UTF-16 code units, not bytes (~4× oversize possible) | LOW |
| [BUG-060](bugs/BUG-060.md) | svg | `truncateText` can split surrogate pairs (broken char in PNGs) | LOW |
| [BUG-061](bugs/BUG-061.md) | worker-middleware | Per-request backend factory silently disables `MemoryRateLimiter`; catch discards error detail | LOW |
| [BUG-062](bugs/BUG-062.md) | test-utils | MockD1 `exec()` desynchronizes `_queries` from `_bindings` | LOW |
| [BUG-063](bugs/BUG-063.md) | svg | `generateGradientColors(…, 1)` divides by zero → `#NaNNaNNaN` | LOW |
| [BUG-064](bugs/BUG-064.md) | rate-limiter | KV `check()` can read window N but increment window N+1 across boundary | LOW |
| [BUG-065](bugs/BUG-065.md) | universalis-proxy | 5 MB upstream cap bypassed by chunked responses (Content-Length-only) | LOW |
| [BUG-066](bugs/BUG-066.md) | universalis-proxy | Per-isolate MemoryRateLimiter makes prod 30/min advisory; spoofable XFF fallback | LOW |
| [BUG-067](bugs/BUG-067.md) | api-worker | Facewear dyes never localize (`getDyeName` keyed by synthetic negative itemID) | LOW |
| [BUG-068](bugs/BUG-068.md) | og-worker | `/og/default.png` "7 days" comment yields 49-day edge TTL | LOW |
| [BUG-069](bugs/BUG-069.md) | og-worker | Catch-all `fetch(request)` self-fetches on `og.` custom domain (CF error 1042) | LOW |
| [BUG-070](bugs/BUG-070.md) | api-worker | `parseBooleanParam` silently drops invalid values (200 with unfiltered data) | LOW |
| [BUG-071](bugs/BUG-071.md) | api-worker | API-returned `marketItemID` (52254-6) 404s when round-tripped to `/v1/dyes/:id` | LOW |
| [BUG-072](bugs/BUG-072.md) | discord-worker | `/preset submit` moderation embeds skip sanitization the webhook path applies | LOW |
| [BUG-073](bugs/BUG-073.md) | bot workers | `MODERATOR_IDS` parsed with different grammars in the two workers | LOW |
| [BUG-074](bugs/BUG-074.md) | discord-worker | Webhooks ignore Discord send outcomes; no `app.onError`; changelog fetch lacks timeout | LOW |
| [BUG-075](bugs/BUG-075.md) | discord-worker | component-context: stored token outlives 15-min validity; Cache API per-colo; no userId check | LOW |
| [BUG-076](bugs/BUG-076.md) | web-app | StorageService `\|\|`-defaults drop legitimate falsy values (incl. stored TTLs) | LOW |
| [BUG-077](bugs/BUG-077.md) | web-app | Welcome modal re-shows forever on Escape/backdrop close; suppresses changelog auto-popup | LOW |
| [BUG-078](bugs/BUG-078.md) | web-app | Tutorial prompt setTimeout fires for previous tool after navigation | LOW |
| [BUG-079](bugs/BUG-079.md) | web-app | SecureStorage size-index mutex bypassed by removeFromSizeIndex/enforceSizeLimit | LOW |
| [BUG-080](bugs/BUG-080.md) | web-app | DyeSearchBox "All" chip always styled active even with initial category filter | LOW |
| [BUG-081](bugs/BUG-081.md) | maintainer | `stripDyePrefix` full-width-colon handling is a no-op (ASCII colon twice) | LOW |

### Refactoring Opportunities

| ID | Area | Title | Priority | Effort |
|----|------|-------|----------|--------|
| [REFACTOR-001](refactoring/REFACTOR-001.md) | oauth + auth | Finish JWT consolidation onto `@xivdyetools/auth` (continues 2026-05-28 REFACTOR-001; parity currently manual) | HIGH | MEDIUM |
| [REFACTOR-002](refactoring/REFACTOR-002.md) | web-app | Nine tool components duplicate lifecycle/pricing/result-card scaffolding (~300–600 lines each; caused BUG-010) | HIGH | HIGH |
| [REFACTOR-003](refactoring/REFACTOR-003.md) | core | Magic RGB candidate thresholds silently bound perceptual-match correctness | MEDIUM | LOW |
| [REFACTOR-004](refactoring/REFACTOR-004.md) | bot-logic + svg | Match-quality thresholds duplicated 4× with inconsistent `<=`/`<` boundaries | MEDIUM | LOW |
| [REFACTOR-005](refactoring/REFACTOR-005.md) | color-blending | Depends on all of `@xivdyetools/core` for one `hexToRgb`; contradicts dependency map | MEDIUM | LOW |
| [REFACTOR-006](refactoring/REFACTOR-006.md) | oauth | Durable Object rate limiter fully dead (no binding/migration/flag; alarm reschedules forever) | MEDIUM | LOW |
| [REFACTOR-007](refactoring/REFACTOR-007.md) | oauth | `verifyState` never checks exp; callers re-implement expiry divergently | MEDIUM | LOW |
| [REFACTOR-008](refactoring/REFACTOR-008.md) | oauth | Discord/XIVAuth handlers ~80% duplicated (allowlist/expiry drift already occurring) | MEDIUM | MEDIUM |
| [REFACTOR-009](refactoring/REFACTOR-009.md) | og-worker | `svg/base.ts` is a drifted fork of `@xivdyetools/svg` (missing CJK-aware truncation) | MEDIUM | MEDIUM |
| [REFACTOR-010](refactoring/REFACTOR-010.md) | bot workers | `preset-api.ts`/`discord-api.ts` clients near-duplicated across both workers (incl. HMAC signer) | MEDIUM | MEDIUM |
| [REFACTOR-011](refactoring/REFACTOR-011.md) | web-app | `fetchPricesForDyes` should return the fanned-out per-dye map (structural fix for BUG-010) | MEDIUM | LOW |
| [REFACTOR-012](refactoring/REFACTOR-012.md) | core | Facewear synthetic char-sum hash collision-prone, no collision detection | LOW | LOW |
| [REFACTOR-013](refactoring/REFACTOR-013.md) | core | `isValidDye` repeats 8-line `idForLog` derivation six times | LOW | LOW |
| [REFACTOR-014](refactoring/REFACTOR-014.md) | core | Hex-normalization block duplicated 3× | LOW | LOW |
| [REFACTOR-015](refactoring/REFACTOR-015.md) | core | Triple static/instance/facade duplication; `getCacheStats` declared type drifted | LOW | MEDIUM |
| [REFACTOR-016](refactoring/REFACTOR-016.md) | presets-api | Duplicate MemoryRateLimiter singletons; `checkPublicRateLimit` dead | LOW | LOW |
| [REFACTOR-017](refactoring/REFACTOR-017.md) | presets-api | 776-line `presets.ts` mixes routing, notification retry, dead-letter, category cache | LOW | MEDIUM |
| [REFACTOR-018](refactoring/REFACTOR-018.md) | presets-api | Unused `rate_limits` table in schema | LOW | LOW |
| [REFACTOR-019](refactoring/REFACTOR-019.md) | svg | SVG primitives interpolate attribute values unescaped/unvalidated | LOW | LOW |
| [REFACTOR-020](refactoring/REFACTOR-020.md) | svg | `estimateTextWidth` misses fullwidth forms and Hangul Jamo | LOW | LOW |
| [REFACTOR-021](refactoring/REFACTOR-021.md) | logger | Browser logger `devOnly` option accepted but dead | LOW | LOW |
| [REFACTOR-022](refactoring/REFACTOR-022.md) | svg | accessibility-comparison `VISION_LABELS` hardcoded English | LOW | LOW |
| [REFACTOR-023](refactoring/REFACTOR-023.md) | api-worker | Handlers re-parse `?locale` ×7 despite middleware-stored `c.var.locale` | LOW | LOW |
| [REFACTOR-024](refactoring/REFACTOR-024.md) | og-worker | Doc/code drift (stale "Latin-only fonts" claim), duplicate DyeService instances | LOW | LOW |
| [REFACTOR-025](refactoring/REFACTOR-025.md) | discord-worker | Moderation-notification embed builder triplicated | LOW | LOW |
| [REFACTOR-026](refactoring/REFACTOR-026.md) | discord-worker | `handleAutocomplete` 130-line monolith; move per-command | LOW | LOW |
| [REFACTOR-027](refactoring/REFACTOR-027.md) | moderation-worker | Bot HMAC signs only `timestamp:userId:userName`; docs claim method/path/body signing | LOW | MEDIUM |
| [REFACTOR-028](refactoring/REFACTOR-028.md) | discord-worker | `preset.ts` (1328 lines) split into subcommand modules | LOW | MEDIUM |
| [REFACTOR-029](refactoring/REFACTOR-029.md) | web-app | ConfigController 12-key list duplicated 4× | LOW | LOW |

### Optimization Opportunities

| ID | Area | Title | Impact | Category |
|----|------|-------|--------|----------|
| [OPT-001](optimization/OPT-001.md) | core | Batch price paths lack request deduplication (cold-cache stampede; `AsyncLRUCache` unused) | MEDIUM | I/O |
| [OPT-002](optimization/OPT-002.md) | rate-limiter | Drop KV post-put verification read: −33% KV reads, removes double-count path | MEDIUM | I/O |
| [OPT-003](optimization/OPT-003.md) | oauth | `storeCharacters`: N+1 sequential inserts on login path → `db.batch` | MEDIUM | I/O |
| [OPT-004](optimization/OPT-004.md) | oauth | Per-isolate in-memory rate limiting makes `/auth/*` limits a multiple of configured values | MEDIUM | Architecture |
| [OPT-005](optimization/OPT-005.md) | og-worker | Swatch OG without `?sheet=` runs up to 64 sequential character-color scans per request | MEDIUM | Algorithm |
| [OPT-006](optimization/OPT-006.md) | discord-worker | Price cache per-datacenter; advertised 15-min stale fallback never implemented | MEDIUM | Caching |
| [OPT-007](optimization/OPT-007.md) | discord-worker | Favorites autocomplete: up to 50 service-binding subrequests per keystroke, no rate limit | MEDIUM | I/O |
| [OPT-008](optimization/OPT-008.md) | discord-worker | Analytics ~10–12 KV ops/command; verification-read retry is a no-op | MEDIUM | I/O |
| [OPT-009](optimization/OPT-009.md) | discord-worker | Bundle: photon (~1.6 MiB) to dedicated image worker; 21 MiB unused full fonts in import reach | MEDIUM | Bundle |
| [OPT-010](optimization/OPT-010.md) | web-app | `isAvailable()` does 2 localStorage writes on every get/set (+ cross-tab event noise) | MEDIUM | I/O |
| [OPT-011](optimization/OPT-011.md) | web-app | `extractPalette` runs K-means synchronously on main thread; loading state never paints | MEDIUM | Algorithm |
| [OPT-012](optimization/OPT-012.md) | web-app | Extractor persists up to 2 MB image data-URL in localStorage (~80% of quota) | MEDIUM | Memory |
| [OPT-013](optimization/OPT-013.md) | presets-api | Write-then-re-fetch on all preset mutations; use `RETURNING` + batch (4→2 round trips) | MEDIUM | I/O |
| [OPT-014](optimization/OPT-014.md) | core | `retry()` retries deterministic 4xx with full backoff (~3 s wasted per failure) | LOW | I/O |
| [OPT-015](optimization/OPT-015.md) | core | `findClosestDyes` per-call array copy + full sort for top-3 | LOW | Algorithm |
| [OPT-016](optimization/OPT-016.md) | presets-api | `POST /presets` runs the daily-limit COUNT twice per submission | LOW | I/O |
| [OPT-017](optimization/OPT-017.md) | presets-api | `COUNT(*) OVER()` total reads 0 on out-of-range pages | LOW | I/O |
| [OPT-018](optimization/OPT-018.md) | svg | Contrast matrix computes each symmetric pair twice | LOW | Algorithm |
| [OPT-019](optimization/OPT-019.md) | crypto | `base64UrlEncodeBytes` per-byte string concatenation | LOW | Memory |
| [OPT-020](optimization/OPT-020.md) | logger | `DelegatingLogger.time()` delegates to parent, losing child context on timing logs | LOW | Observability |
| [OPT-021](optimization/OPT-021.md) | universalis-proxy | Every coalesced waiter re-writes the same cache entry (N puts per burst) | LOW | I/O |
| [OPT-022](optimization/OPT-022.md) | universalis-proxy | Cache-key normalization not deduped and not applied to upstream URL | LOW | Caching |
| [OPT-023](optimization/OPT-023.md) | og-worker | O(n) `getAllDyes().find()` lookups + redundant per-candidate LAB/ΔE in harmony scan | LOW | Algorithm |
| [OPT-024](optimization/OPT-024.md) | og-worker | Cold-start: dual DyeService init, eager 6-locale parse; wasm dominates | LOW | Bundle |
| [OPT-025](optimization/OPT-025.md) | api-worker | Static responses (`/categories`, `/consolidation-groups`) recomputed per request | LOW | Caching |
| [OPT-026](optimization/OPT-026.md) | discord-worker | Duplicate KV reads of same prefs keys per command (translator + preferences) | LOW | I/O |
| [OPT-027](optimization/OPT-027.md) | web-app | `priceData` getter clones full price Map per access inside per-card loops | LOW | Memory |
| [OPT-028](optimization/OPT-028.md) | web-app | DyeSearchBox emits per keystroke, no debounce → full grid rebuild per keypress | LOW | Algorithm |
| [OPT-029](optimization/OPT-029.md) | maintainer | 4 XIVAPI locales fetched sequentially (worst case ~40 s) | LOW | I/O |

## Prior Audit (2026-05-28) Re-Verification

| Prior item | Status |
|------------|--------|
| BUG-001: `APIService` batch methods don't chunk >100 | **FIXED** — recursive 100-item chunking at `APIService.ts:646-660`. Residual edge documented as [BUG-012](bugs/BUG-012.md) |
| BUG-002: og-worker enum params cast without validation | **FIXED** on all `/og/*` image routes. Residue: crawler-HTML route casts (`og-data-generator.ts:466,500-502,525`), swatch `sheet`/`gender` casts, validate-raw/use-lowercased mismatch |
| OPT-001: KR subset font ~595 KiB oversized | **FIXED 2026-05-29** — subset script scopes KR to Hangul+ASCII; KR now ~176 KiB, SC ~290 KiB. og-worker CLAUDE.md still claims Latin-only fonts ([REFACTOR-024](refactoring/REFACTOR-024.md)) |
| REFACTOR-001: dual JWT verifiers | **PARTIALLY RESOLVED** — presets-api/discord-worker/moderation-worker consume `@xivdyetools/auth`; oauth's hand-rolled verifier remains, hand-aligned (HS256 pin, `sub` required) but parity is manual. Carried forward as [REFACTOR-001](refactoring/REFACTOR-001.md); residual divergence [BUG-051](bugs/BUG-051.md) |
| k-d tree | Unchanged since prior CORRECT verdict (no commits since 2026-05-28) |

## Priority Matrix

### Immediate Action (high impact, low effort)
- **BUG-001** — status-transition guard on owner PATCH (one conditional). The only CRITICAL.
- **BUG-014 / BUG-015** — visibility guards on public preset reads (small WHERE-clause fixes, same class as BUG-001).
- **BUG-008** — add proper wrangler env separation so plain `wrangler deploy` can't hit production (config-only).
- **BUG-007** — reorder/exact-match the oauth rate-limit path branches (both copies).
- **BUG-017** — set `envValidated` only after validation passes (three files, one-line each).
- **BUG-013** — `.catch`-reset the cached init promises (three sites, same pattern).
- **BUG-029** — add missing EU Shadow DC + worlds to the proxy whitelist (data-only).
- **BUG-016** — clamp/validate pagination params.
- **BUG-032** — filter `itemID > 0` on `/budget find` target selection.
- **BUG-042** — `!= null` filter on comparison restore.

### Plan for Next Sprint (high impact, higher effort)
- **BUG-010 + REFACTOR-011** — fix the consolidated-itemID price-lookup mismatch structurally (105 dyes affected in two tools).
- **BUG-006** — remove the mutable locale singleton (pass locale explicitly through DyeService/LocalizationService); unblocks correct 24 h caching in api-worker.
- **BUG-002** — replace `\b`-based profanity matching for CJK (substring or segmenter-based).
- **BUG-003** — migrate `dye_signature` UNIQUE to a status-filtered partial index.
- **BUG-004** — handle `UNIQUE(discord_id)` conflict in XIVAuth account merge.
- **BUG-005** — clone-on-return (or freeze) LRU-cached conversion results in core.
- **BUG-009** — route moderation buttons to the worker that can handle them (or register handlers in the main worker).
- **REFACTOR-001** — finish JWT consolidation (extend `@xivdyetools/auth` with jti/iss support first).
- **REFACTOR-002** — extract shared tool-scaffolding base for the nine web-app tools (prevents the BUG-010 class recurring).

### Technical Debt Backlog
- Remaining MEDIUM bugs (KV/D1 atomicity: BUG-019/020/036; logger redaction gaps: BUG-024/025/026; proxy cache semantics: BUG-027/028).
- LOW bugs (BUG-044…081) — batch by area during routine work in those files.
- MEDIUM/LOW refactors and optimizations per tables above; OPT-009 (bundle) is worth doing before the discord-worker outgrows the 10 MiB limit.

## Recommendations

1. **Kill the mutable-singleton pattern on Workers.** BUG-006/013/017 and OPT-004 are one design lesson: on Cloudflare Workers, module-level state is concurrently shared within an isolate and silently non-shared across isolates. Prefer per-request context (Hono `c.var`) and idempotent lazy-init with failure reset.
2. **Treat every per-app copy of shared-package logic as a defect.** All five copies found (JWT, rate-limit paths, SVG base, bot API clients, match thresholds) have drifted, and the rate-limit copy drifted into the *same bug twice* (BUG-007). Extend the shared package rather than aligning copies by hand.
3. **Add a moderation state-machine test suite to presets-api.** BUG-001/003/014/015/020/052 are all transitions or visibility rules with no test coverage of the disallowed paths.
4. **CI guards:** wrangler env-separation lint (BUG-008), the previously-recommended font-coverage check, and a JWT contract test (REFACTOR-001) remain worth automating.
5. No code was modified by this analysis — review and approve before remediation.

## Next Steps

1. Review findings with the team; confirm severity calls.
2. Approve the "Immediate Action" batch (all small, low-risk fixes).
3. Create tracking issues for the sprint-sized items.
4. Proceed with approved modifications.
