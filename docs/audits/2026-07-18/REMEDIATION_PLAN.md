# Remediation Plan — 2026-07-18 Deep-Dive Audit

**Status basis:** 12 findings completed 2026-07-18 (BUG-001, 007, 008, 013, 014, 015, 016, 017, 029 [refuted as stated; structural fix applied], 032, 042 — see each finding's Status section). **128 findings outstanding:** 70 bugs, 28 refactors (REFACTOR-011 counted with its bug), 29 optimizations + REFACTOR-011.

**Ordering principles**

1. **User-facing integrity first** — moderation/auth holes and wrong-data bugs before performance.
2. **One deploy unit per sprint** — each sprint clusters work in the same package/worker so it ends with one coordinated publish + deploy instead of many partial ones.
3. **Refactors ride with the bugs they prevent** — e.g. the JWT consolidation ships in the same sprint as the refresh-token bugs it subsumes.
4. **The big structural refactor last** — REFACTOR-002 (nine-tool scaffolding) reshapes files most other web-app fixes touch, so it goes after those fixes, not before.

---

## Sprint 0 — Ship what's already fixed (prerequisite, ~half a day)

Not findings — the completed fixes only reach production once these happen:

- [ ] Version-bump + npm publish `@xivdyetools/rate-limiter` (BUG-007) and `@xivdyetools/core` (BUG-013)
- [ ] Deploy: presets-api, oauth, discord-worker, og-worker, universalis-proxy, web-app
- [ ] Note: first plain `wrangler deploy` after BUG-008 creates new `-dev` workers (expected)

## Sprint 1 — presets-api moderation & data integrity

**✅ COMPLETED 2026-07-19** — all 15 items below fixed (see each finding's Status section). Deploy needs: apply `migrations/0006_partial_dye_signature_drop_rate_limits.sql` to D1, then deploy presets-api. Also touched `@xivdyetools/test-utils` (D1 mock batch/RETURNING fidelity, v1.1.8 — publish with the next batch).

The remaining moderation state-machine gaps plus the D1 atomicity cluster; ends with one presets-api deploy and a schema migration.

| ID | Sev/Pri | Item |
|----|---------|------|
| BUG-002 | HIGH | CJK profanity lists never match (`\b` has no CJK boundary) — segmenter/substring matching |
| BUG-003 | HIGH | Rejected preset poisons `dye_signature` — migrate UNIQUE to status-filtered partial index |
| BUG-019 | MED | Vote insert + `vote_count` update not batched (counter drift) |
| BUG-020 | MED | Moderation log written before status update; action from stale status (TOCTOU) |
| BUG-049 | LOW | Daily submission COUNT-then-INSERT TOCTOU |
| BUG-050 | LOW | Moderation stats ISO-`T` vs `datetime('now')` format mismatch |
| BUG-052 | LOW | `previous_values` overwritten despite append-only intent |
| BUG-053 | LOW | `BOT_API_SECRET` non-constant-time comparison |
| BUG-054 | LOW | Content-Type gate trusts Content-Length (chunked bypass) |
| OPT-013 | MED | `RETURNING` + batch on preset mutations (same handlers as BUG-019/020) |
| OPT-016 | LOW | Double daily-limit COUNT per submission |
| OPT-017 | LOW | `COUNT(*) OVER()` total is 0 on out-of-range pages |
| REFACTOR-016 | LOW | Duplicate MemoryRateLimiter singletons; dead `checkPublicRateLimit` |
| REFACTOR-017 | LOW | Split 776-line `presets.ts` (do while the files are open) |
| REFACTOR-018 | LOW | Drop unused `rate_limits` table (same migration as BUG-003) |

## Sprint 2 — oauth: JWT consolidation & session security

**✅ COMPLETED 2026-07-19** — all 12 items fixed (see each finding's Status section). Deploy needs: publish `@xivdyetools/auth` 1.2.0 (+ `@xivdyetools/types` bump for `orig_iat`) with the next batch, then deploy oauth. REFACTOR-006 resolved by deleting the DO limiter; OPT-004 via KV-backed limits on TOKEN_BLACKLIST (`rl:` prefix). REFACTOR-008 scoped to authorize + GET-callback factories (POST exchanges stay provider-specific).

REFACTOR-001 is the anchor: extend `@xivdyetools/auth` (jti/iss/revocation), migrate oauth onto it, and fix the session bugs in the same pass. Ends with an auth-package publish + oauth deploy.

| ID | Sev/Pri | Item |
|----|---------|------|
| REFACTOR-001 | HIGH | Finish JWT consolidation onto `@xivdyetools/auth` (carried from 2026-05-28) |
| BUG-004 | HIGH | XIVAuth merge hits `UNIQUE(discord_id)` → deterministic login 500 loop |
| BUG-021 | MED | `/auth/refresh` never revokes old jti; no absolute session lifetime |
| BUG-018 | MED | Redirect-URI allowlists disagree across the three handlers |
| BUG-051 | LOW | Refresh grace period NaN-passes for exp-less tokens (closed by consolidation) |
| BUG-057 | LOW | `JWTPayload.type` never validated (fix in auth package while extending it) |
| BUG-058 | LOW | `verifyJWTSignatureOnly` skips max-age when `iat` missing |
| REFACTOR-007 | MED | `verifyState` exp check centralized (callers diverge) |
| REFACTOR-008 | MED | Dedupe Discord/XIVAuth handlers (~80% identical; fixes BUG-018 structurally) |
| REFACTOR-006 | MED | Decide the dead Durable Object rate limiter: wire it up or delete it |
| OPT-004 | MED | Per-isolate in-memory `/auth/*` limits (resolve with the REFACTOR-006 decision) |
| OPT-003 | MED | `storeCharacters` N+1 → `db.batch` on the login path |

## Sprint 3 — web-app: pricing correctness & UX bugs

**✅ COMPLETED 2026-07-19** — all 15 items fixed (see each finding's Status section). Deploy needs: one web-app release (version bump + `npm run build:check` + Pages deploy).

BUG-010 is the last open HIGH with direct user impact (105 dyes lose prices in two tools). Ends with one web-app release.

| ID | Sev/Pri | Item |
|----|---------|------|
| BUG-010 | HIGH | Budget/Swatch price lookup keyed by original vs consolidated itemID |
| REFACTOR-011 | MED | `fetchPricesForDyes` returns fanned-out per-dye map (structural fix for BUG-010) |
| BUG-039 | MED | Server change doesn't invalidate in-flight price fetch |
| BUG-040 | MED | `loadToolContent` navigation race leaks tool instances |
| BUG-041 | MED | English locale fallback never loads for non-English users |
| BUG-043 | MED | Changelog modal misrenders when APP_VERSION missing from laymans changelog |
| BUG-076 | LOW | StorageService `\|\|`-defaults drop falsy values |
| BUG-077 | LOW | Welcome modal re-shows forever on Escape; suppresses changelog popup |
| BUG-078 | LOW | Tutorial setTimeout fires for previous tool |
| BUG-079 | LOW | SecureStorage size-index mutex bypassed |
| BUG-080 | LOW | DyeSearchBox "All" chip always active |
| OPT-010 | MED | `isAvailable()` 2 localStorage writes per get/set |
| OPT-027 | LOW | `priceData` getter clones Map in per-card loops |
| OPT-028 | LOW | DyeSearchBox debounce |
| REFACTOR-029 | LOW | ConfigController key-list duplication |

## Sprint 4 — core: locale race, color correctness, api-worker

**✅ COMPLETED 2026-07-19** — all items fixed (see each finding's Status section). Deploy needs: publish `@xivdyetools/core` 2.7.0 + `@xivdyetools/bot-logic` 1.2.1 with the batch, then deploy api-worker (and redeploy core consumers as their CI picks up the bump). Notable: the REFACTOR-003 parity test CONFIRMED real wrong-winner matches — perceptual methods now use an exact scan. All 8 core-consumer test suites re-verified green.

BUG-006 is an API-shape change (explicit locale instead of singleton `setLocale`) — the largest-blast-radius item, so it gets a dedicated sprint with a coordinated core publish and api-worker/og-worker/bot updates. api-worker items ride along because they consume the new API.

| ID | Sev/Pri | Item |
|----|---------|------|
| BUG-006 | HIGH | `LocalizationService` singleton locale race (24h-cacheable wrong-language responses) |
| BUG-005 | HIGH | `ColorManipulator` mutates LRU-cached HSV objects (clone-on-return) |
| BUG-011 | MED | Cache-write failure discards fetched price data |
| BUG-012 | MED | `buildBatchApiUrl` throw outside try |
| BUG-030 | MED | `/v1/match/within-distance` filters after limit truncation |
| BUG-044–048 | LOW | Core edge cases (samplePixels ÷0, metallic-locale, limiter burst, complementary self-match, sortByProperty doc) |
| BUG-067 | LOW | Facewear dyes never localize in api-worker (design with BUG-006) |
| BUG-070 | LOW | `parseBooleanParam` silently drops invalid values |
| BUG-071 | LOW | `marketItemID` round-trip 404s on `/v1/dyes/:id` |
| REFACTOR-023 | LOW | api-worker `?locale` re-parsing (falls out of BUG-006 redesign) |
| REFACTOR-003 | MED | Magic RGB candidate thresholds in DyeSearch |
| REFACTOR-012–015 | LOW | Core internals (facewear hash guard, isValidDye dedup, hex-normalization dedup, facade drift) |
| OPT-001 | MED | Batch price request deduplication (cold-cache stampede) |
| OPT-014 | LOW | `retry()` skips deterministic 4xx |
| OPT-015 | LOW | `findClosestDyes` copy+sort |
| OPT-025 | LOW | api-worker static responses cached |

## Sprint 5 — Discord/stoat bots: reliability & bundle headroom

**✅ COMPLETED 2026-07-19** (4 items partial/deferred with rationale in their Status sections: REFACTOR-010/026/027/028 partial; BUG-036 deferred-documented; OPT-009 photon-split deferred). Deploy needs: publish `@xivdyetools/bot-logic` 1.3.0 + `@xivdyetools/rate-limiter` 1.5.0 with the batch, deploy discord-worker + moderation-worker + stoat, and set the new `MODERATION_BOT_TOKEN` secret on discord-worker to make approve/reject buttons live (BUG-009).

BUG-009 needs a design decision first (register the moderation button handlers in the main worker vs. re-route). Ends with discord-worker + moderation-worker + stoat deploys.

| ID | Sev/Pri | Item |
|----|---------|------|
| BUG-009 | HIGH | Approve/Reject buttons unroutable (cross-Discord-application) |
| BUG-035 | MED | Deferred follow-ups never check `.ok`; unhandled waitUntil rejections (systemic) |
| BUG-036 | MED | KV read-modify-write lost updates (favorites/collections/preferences) |
| BUG-033 | MED | Universalis parsing always reads `.dc` scope for world queries |
| BUG-034 | MED | `getPresetByName` `limit: 1` defeats exact match |
| BUG-037 | MED | `/stats` unique-users 1000 cap (KV pagination) |
| BUG-038 | MED | stoat reaction context broken (key, overwrite, no listener) |
| BUG-072–075 | LOW | Sanitization skip, MODERATOR_IDS grammar drift, webhook outcomes, component-context lifetime |
| REFACTOR-010 | MED | Extract shared bot API client (preset-api/discord-api duplicated; fixes BUG-073 class) |
| REFACTOR-025–028 | LOW | Embed builder triplication, autocomplete monolith, HMAC scope/doc drift, preset.ts split |
| OPT-006 | MED | Price cache stale fallback actually implemented |
| OPT-007 | MED | Favorites autocomplete fan-out (50 subrequests/keystroke) |
| OPT-008 | MED | Analytics KV ops per command |
| OPT-009 | MED | Bundle: photon to image worker, unused fonts out of import reach (do before 10 MiB limit bites) |
| OPT-026 | LOW | Duplicate KV prefs reads per command |

## Sprint 6 — Shared packages: logger redaction, rate-limiter, svg

**✅ COMPLETED 2026-07-19** (REFACTOR-022 package half done; bot-i18n locale keys + discord-worker wiring remain as consumer follow-up). Deploy needs: batch npm publish of the touched packages — types 1.15.0, crypto 1.1.1, logger 1.3.0, auth 1.2.0, rate-limiter 1.5.0, color-blending 1.1.0, svg 1.2.0, bot-logic 1.3.0, worker-middleware 1.2.0, test-utils 1.1.8 — then redeploy consumers (all CF workers + web-app release + stoat).

Cross-cutting library hardening; ends with a batch npm publish (logger, rate-limiter, svg, auth, crypto, color-blending, worker-middleware, test-utils as touched).

| ID | Sev/Pri | Item |
|----|---------|------|
| BUG-024 | MED | Logger redaction case-sensitive key match |
| BUG-025 | MED | `sanitizeErrorMessage` JSON-style/spacing bypasses |
| BUG-026 | MED | Browser preset sends unredacted context to errorTracker |
| BUG-022 | MED | KVRateLimiter OCC never implemented |
| BUG-023 | MED | MemoryRateLimiter cleanup uses wrong windowMs |
| OPT-002 | MED | Drop KV post-put verification read (design together with BUG-022) |
| BUG-055 | LOW | Upstash resetAt reports full window |
| BUG-064 | LOW | KV check/increment window-boundary mismatch |
| BUG-056 | LOW | Emoji tofu in resvg PNGs |
| BUG-060 | LOW | `truncateText` splits surrogate pairs |
| BUG-063 | LOW | `generateGradientColors(…, 1)` → `#NaNNaNNaN` |
| BUG-059 | LOW | Discord body limit counts UTF-16 units |
| BUG-061 | LOW | Middleware factory silently disables MemoryRateLimiter |
| BUG-062 | LOW | MockD1 `exec()` desync |
| REFACTOR-004 | MED | Consolidate match-quality thresholds (4 copies, inconsistent boundaries) |
| REFACTOR-005 | MED | color-blending's dependency on all of core |
| REFACTOR-019–022 | LOW | SVG attr escaping, estimateTextWidth coverage, dead devOnly, VISION_LABELS i18n |
| OPT-018–020 | LOW | Contrast matrix symmetry, base64 concat, DelegatingLogger.time context |

## Sprint 7 — Edge workers: cache semantics & og-worker fidelity

**✅ COMPLETED 2026-07-19** (BUG-031 note: harmony target selection stays hue-scan-based, matching the web-app's own approach; metric/interpolation/ratio now honor `?algo=`/`ratio`). Deploy needs: deploy universalis-proxy 1.5.0 and og-worker (new `@xivdyetools/svg` workspace dep — publish the Sprint 6 package batch first or deploy from the workspace).


| ID | Sev/Pri | Item |
|----|---------|------|
| BUG-027 | MED | CORS responses cached `public` without `Vary: Origin` |
| BUG-028 | MED | Stale SWR responses re-served with full `max-age` |
| BUG-065 | LOW | 5 MB cap bypassed by chunked responses |
| BUG-066 | LOW | Per-isolate proxy rate limit; spoofable XFF fallback |
| OPT-021 | LOW | Coalesced waiters re-write same cache entry |
| OPT-022 | LOW | Cache-key normalization gaps |
| BUG-031 | MED | OG generators ignore validated `algo`/`ratio` (false labels on shared images) |
| BUG-068 | LOW | default.png 49-day TTL vs "7 days" comment |
| BUG-069 | LOW | Catch-all self-fetch on og. domain (CF 1042) |
| REFACTOR-009 | MED | Reunify og-worker's forked svg base with `@xivdyetools/svg` (fixes CJK truncation drift) |
| REFACTOR-024 | LOW | og-worker doc drift + duplicate DyeService |
| OPT-005 | MED | Swatch OG 64 sequential character scans |
| OPT-023 | LOW | O(n) dye lookups + redundant ΔE in harmony scan |
| OPT-024 | LOW | Cold-start: dual DyeService, eager locale parse |

## Sprint 8 — Structural: tool scaffolding extraction & heavy web perf

**✅ COMPLETED 2026-07-19** (REFACTOR-002 step 1 of 4 landed — base-class SubscriptionManager with guaranteed cleanup, all seven hand-rolled tools converted; steps 2-4 (price mixin / renderResultCards / drawer builder) remain open as independently shippable follow-ups, one tool per PR. OPT-011 tiers 1+2 landed, Web Worker tier deferred.) Deploy needs: web-app release (its normal release flow); maintainer is local-only, no deploy.

REFACTOR-002 rewrites the nine tool components' shared skeleton — deliberately last so it doesn't conflict with Sprint 3's targeted fixes, and it's the prevention layer for the BUG-010 class. The two heavy extractor optimizations belong inside that rewrite.

| ID | Sev/Pri | Item |
|----|---------|------|
| REFACTOR-002 | HIGH | Extract shared lifecycle/pricing/result-card scaffolding for the nine tools (~300–600 dup lines each) |
| OPT-011 | MED | `extractPalette` K-means off the main thread (Web Worker) |
| OPT-012 | MED | Stop persisting 2 MB image data-URLs in localStorage (IndexedDB) |
| OPT-029 | LOW | maintainer: parallelize 4 XIVAPI locale fetches |
| BUG-081 | LOW | maintainer `stripDyePrefix` full-width colon no-op |

---

## Standing guidance while executing

- Verify audit claims against reality before coding — BUG-029 was refuted this way; treat each finding's Evidence as a lead, not gospel.
- Every sprint that touches `packages/*` ends with a version bump; batch the publishes.
- Add the CI guards from the report's recommendations as they become relevant: moderation state-machine tests (Sprint 1), JWT contract test (Sprint 2), wrangler env-separation check (done via BUG-008 config).
