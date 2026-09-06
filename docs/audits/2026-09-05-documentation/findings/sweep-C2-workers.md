# Sweep C2 findings — presets-api, image-worker, api-worker, og-worker, oauth, moderation-worker, stoat-worker

Verified against the worktree at 1eb57cda (= origin/main 2026-09-05). Evidence is path:line in the code.

## presets-api & image-worker

| ID | File:line | Claim | Reality (evidence) | Sev | Proposed fix |
|---|---|---|---|---|---|
| PRE-01 | `apps/presets-api/CLAUDE.md:139,144`; `README.md:119-126` | `INTERNAL_WEBHOOK_SECRET` under Optional (omitted from README) | Required in production (`src/utils/env-validation.ts:437-439`; `src/index.ts:74-76`) | HIGH | Move to Required; add `wrangler secret put INTERNAL_WEBHOOK_SECRET` |
| PRE-02 | `README.md:110-117`; `CLAUDE.md:121-127`; `docs/projects/presets-api/overview.md:250` | Bindings: `DB`, `DISCORD_WORKER`, `IMAGE_WORKER`, `THUMBNAILS` | Also `TOKEN_BLACKLIST` KV (`wrangler.toml:41-43,99-101`) and `RL_PUBLIC` (`:46-49,104-107`), production-required (`env-validation.ts:417-422`) | HIGH | Add both |
| PRE-03 | `docs/projects/presets-api/moderation.md:22` | "Fail-open: if the API is slow or unavailable, the submission proceeds with Tier 1 results only." | Fail-closed (FINDING-005): `services/moderation-service.ts:254-261, 308-315, 322-325, 357-361` return `passed:false`; `handlers/presets.ts:915` files it `pending` | HIGH | Rewrite; only an absent key skips the tier |
| PRE-04 | `moderation.md:47` | "If clean, status is set to `pending`." | `passed ? 'approved' : 'pending'` (`handlers/presets.ts:915`) | HIGH | "If clean, auto-approved" |
| PRE-05 | `docs/projects/presets-api/rate-limiting.md:46` | Storage: D1 `rate_limits` table | Dropped (`migrations/0006…:20-21`); cap = `max(presets rows today, submission_events rows today)` (`services/rate-limit-service.ts:223-232`) | HIGH | rewrite |
| PRE-06 | `rate-limiting.md:72` | bots and web app "subject to the same IP-based limits" | Service-binding traffic has no `CF-Connecting-IP` → IP layer skipped (`src/middleware/rate-limit.ts:138-141`); bots bounded by per-user limiter (`:151-162`) | HIGH | explain |
| PRE-07 | `docs/projects/presets-api/database.md:60-66` | votes has `id INTEGER PRIMARY KEY AUTOINCREMENT` | `schema.sql:100-106`: `preset_id`, `user_discord_id`, `created_at`, `PRIMARY KEY (preset_id, user_discord_id)`; `idx_votes_user` | HIGH | rewrite |
| PRE-08 | `overview.md:144-152` | votes DDL with `id TEXT PK` + `vote TEXT ('up'/'down')` | no such columns; no downvotes (`handlers/votes.ts:64-77`) | HIGH | replace / link database.md |
| PRE-09 | `database.md:124-132` | index names | Real: `idx_presets_status_category_vote(status, category_id, vote_count DESC)` etc. (`migrations/002_add_composite_indexes.sql:10-22`); no `idx_votes_preset` (only `idx_votes_user`, `schema.sql:109`); `idx_moderation_log_preset` (`schema.sql:130`) | HIGH | rewrite from migration |
| PRE-10 | `database.md:13` | "6 live tables" | 7 — `submission_events` (`migrations/0011:17-28`, `0012:37-62`, `schema.sql:195-209`) | HIGH | 7 + section |
| PRE-11 | `apps/presets-api/CLAUDE.md:149-159` | table list omits `submission_events` | same | HIGH | add |
| PRE-13 | `docs/projects/presets-api/endpoints.md:209-210` | "state machine; a submitter can never approve their own preset" | No state machine/self-approval check: `handlers/moderation.ts:111` validates membership in four statuses (`validation-service.ts:325-333`); gate is `requireModerator` (`:96`); `prepareStatusUpdate` is optimistic concurrency (`preset-service.ts:446-460`) | HIGH | describe real gate + 409 |
| PRE-14 | `overview.md:252-258` | Secrets block | omits `BOT_SIGNING_SECRET` (`middleware/auth.ts:275-290`) and `INTERNAL_WEBHOOK_SECRET` | HIGH | add |
| PRE-12 | `CLAUDE.md:157` | "`rate_limits` … still present in `schema.sql`" | only a comment at `:134-135` | MED | fix |
| PRE-15 | `moderation.md:16` | "Blocks submission immediately if a match" | still created, as `pending` (`handlers/presets.ts:907-915`) | MED | fix |
| PRE-16 | `moderation.md:21` | attributes incl. "threat" | `TOXICITY`, `SEVERE_TOXICITY`, `IDENTITY_ATTACK`, `INSULT`, `PROFANITY` (`moderation-service.ts:294-300`); threshold 0.7 (`:336-349`) | MED | fix |
| PRE-17 | `moderation.md:72` | "Discord webhook or service binding" | service binding only (`services/notification-service.ts:173-193`) | MED | fix |
| PRE-18 | `moderation.md:104`; `database.md:77` | action list omits `requeue` | `handlers/moderation.ts:410-427`; `schema.sql:122` | MED | add |
| PRE-19 | `moderation.md:119-121` | "Remove control chars, invisible Unicode, Zalgo" | rejected 400 (`validation-service.ts:147-165`); no Zalgo rule; min lengths name 2 / desc 10; `TAG_PATTERN` | MED | rewrite |
| PRE-20 | `moderation.md:125` | `truncateUnicodeSafe()` used in notifications | no caller (`moderation-service.ts:48-52`) | MED | delete/mark unused |
| PRE-21 | `moderation.md:5` | pipeline | omits `text_edit` cap 30/day (`rate-limit-service.ts:45`) before `moderateContent` on PATCH (`handlers/presets.ts:607-640`) | MED | add |
| PRE-22 | `rate-limiting.md:12` | "Memory backend" | `CloudflareRateLimiter` over `RL_PUBLIC` in production (`middleware/rate-limit.ts:57-65`) | MED | fix |
| PRE-23 | `CLAUDE.md:271` | "100 req/min per IP via MemoryRateLimiter (per-isolate)" | same; also `perUserRateLimitMiddleware` 100/min (`:74-82`, `index.ts:175`) | MED | fix |
| PRE-24 | `rate-limiting.md:13`; `endpoints.md:303` | "Scope: All endpoints" | `/api/*` only (`index.ts:155`) | MED | fix |
| PRE-25 | `rate-limiting.md:3` | "two-tier" | three (IP, per-user, per-day quotas) | MED | fix |
| PRE-26 | `rate-limiting.md:30-37` | 429 body with `"success": false` | shared middleware emits no `success` (`packages/worker-kit/src/middleware/rate-limit.ts:209-215`) | MED | fix |
| PRE-27 | `endpoints.md:325-332` | 429 body shape | real: `{error:"Too Many Requests", message:"Rate limit exceeded. Please try again later.", retryAfter}`; quota 429s `{success:false, error:"RATE_LIMITED", …, reset_at}` (`handlers/presets.ts:874-883`) | MED | show both |
| PRE-28 | `rate-limiting.md:48`; `endpoints.md:307-308` | quota scope `POST /api/v1/presets` only | also `text_edit` 30/day, `flagged_edit` 10/day, `preview_upload` 20/day (`rate-limit-service.ts:24-60`) | MED | list |
| PRE-29 | `endpoints.md:127` | duplicate → auto-vote | only when approved; pending duplicates → `vote_added:false` or 409 (`handlers/presets.ts:163-197`) | MED | describe |
| PRE-30 | `endpoints.md:217`, `:231-233` | `reason` 10-200 on `/status` | optional/unvalidated on `/status` (`moderation.ts:103-114,149`); required 10–200 on `/revert` (`:187-198`) | MED | swap |
| PRE-31 | `endpoints.md:27-41` | categories | `GET /api/v1/categories/:id` exists (`handlers/categories.ts:352-398`) | MED | add |
| PRE-32 | `endpoints.md:84-91` | response lacks `has_more` | `preset-service.ts:313-325` | MED | add |
| PRE-33 | `overview.md:3`; `database.md:3`; `endpoints.md:1`; `moderation.md:3`; `rate-limiting.md:1` | "v2.0.0" ×5 | 2.3.0 | MED | DROP per-page version stamps |
| PRE-34 | `overview.md:22,24-25,32-38` | `cd xivdyetools-presets-api` / `npm install` | `apps/presets-api/`; pnpm from root | MED | fix |
| PRE-35 | `overview.md:155-162` | `moderation_log` DDL `preset_id NOT NULL` | nullable since `0013:91-103`; `target_discord_id` (`schema.sql:118-127`) | MED | fix |
| PRE-36 | `overview.md:205-215` | hand-written quota SQL | stale (`rate-limit-service.ts:76-87, 223-232`) | MED | point at `getEffectiveSubmissionCountToday()` |
| PRE-37 | `overview.md:186-195` | flow "[Fail] → Reject" | local-filter hit → `pending` | MED | redraw |
| PRE-38 | `database.md:88`, `:164` | `getSubmissionCountToday` counting presets rows | `max(presets, submission_events)` (`:223-232`; `handlers/presets.ts:969`) | MED | fix |
| PRE-39 | `database.md:138-150` | migrations end at 0011 | 0012, 0013 exist | MED | add |
| PRE-40 | `README.md:95` | `migrations/ (0002 … 0010)` | 0002–0013 + `002_add_composite_indexes.sql` | MED | fix |
| PRE-41 | `CLAUDE.md:149` | "`0002…0010`" | 0013 | MED | fix |
| PRE-42 | `CLAUDE.md:154` | status ∈ {pending, approved, rejected, flagged} | `hidden` (`preset-service.ts:232-237,337`; `handlers/presets.ts:588-590`) | MED | add |
| PRE-43 | `CLAUDE.md:194` | `DELETE /presets/:id` author-only | moderators too (`handlers/presets.ts:392-394`) | MED | fix |
| PRE-44 | `CLAUDE.md:220` | user from `sub` claim | `discord_id` claim; `sub` fallback (`middleware/auth.ts:71-77,361`) | MED | fix |
| PRE-45 | `CLAUDE.md:66`, `:115` | "envValidated check (per-isolate)" | validation every request; only logging once (`index.ts:38-41,60-79`) | MED | fix |
| PRE-46 | `CLAUDE.md:72-76`, `:101` | middleware order | publicRateLimit → bodySizeLimit → jsonDepthLimit → authMiddleware → perUserRateLimit → Content-Type (`index.ts:155,160,163,166,175,179`) | MED | reorder |
| PRE-47 | `README.md:145`; `CLAUDE.md:329,342` | `@xivdyetools/logger` dep | transitive | LOW | mark |
| PRE-48 | `CLAUDE.md:20` | lint = eslint only | + knip | LOW | fix |
| PRE-49 | `README.md:92` | `db:seed` seeds | only prints SQL (`scripts/migrate-presets.ts:8-13`) | LOW | fix |
| PRE-50 | `CLAUDE.md:185` | featured = curated/approved | no curated filter (`preset-service.ts:334-343`) | LOW | fix |
| PRE-51 | `CLAUDE.md:192` | ">254 rejected as legacy item ID" | only ≥5000; 255–4999 different message (`validation-service.ts:217-223`) | LOW | split |
| PRE-52 | `database.md:160` | previous_values append-only | write-once, cleared by revert (`preset-service.ts:473-479`; `handlers/presets.ts:663-670`) | LOW | fix |
| PRE-53 | `endpoints.md:105`, `:175`, `:201` | "require a JWT" | or bot key + v2 HMAC (`middleware/auth.ts:264-351`) | LOW | fix |
| IMG-01 | `apps/image-worker/CLAUDE.md:241-247` | `MAX_PIXEL_COUNT` = 4 MP, 32 MiB budget | `PIXEL_MEMORY_BUDGET_BYTES = 72 MiB` (`src/validators.ts:84`) ⇒ 9,437,184 px (`:107-109`) | HIGH | fix |
| IMG-02 | `apps/image-worker/README.md:43` | discord-worker matches `SSRF`, `Discord CDN`, `too large`, `format`, `timeout` | no message contains `SSRF`; real rejection `Only Discord CDN URLs are allowed for security` (`validators.ts:192-195`); contract is `IMAGE_INPUT_MARKERS` (`apps/discord-worker/src/services/image-input-errors.ts:21-47`) | HIGH | point at the marker table. ALSO fix the source comment at `apps/image-worker/src/index.ts:129` that repeats the wrong list (comment only) |
| IMG-03 | `README.md:11-43` | API documents only `/health`, `/extract` | `POST /thumbnail` (`src/index.ts:182-216`): bytes in, WebP out, 10 MB cap, crop 640×264 + Lanczos3 (`src/photon.ts:277-303`) | MED | add section |
| IMG-04 | `README.md:9`, `:89-91` | only caller discord-worker | presets-api too (`apps/presets-api/wrangler.toml:35-37,84-86`; `services/preview-image-service.ts:164-170`) | MED | name both |
| IMG-05 | `CLAUDE.md:164-166` | `ENVIRONMENT` var set by `[env.production]` | no `vars` block (`wrangler.toml:27-33`) | MED | fix |
| IMG-06 | `CLAUDE.md:144-146` | `computeCropBox` centred | horizontally only; vertical centre for landscape; square/portrait crop from top (`photon.ts:264-266`, `:234-236`) | MED | fix |
| IMG-07 | `CLAUDE.md:45` | lint eslint only | + knip | LOW | fix |

## api-worker & og-worker

| ID | File:line | Claim | Reality (evidence) | Sev | Proposed fix |
|---|---|---|---|---|---|
| API-1 | `apps/api-worker/README.md:11-21` | 9 `/v1` rows | +7: `/v1/wheels`, `/v1/wheels/:id` (`routes/wheels.ts:26,40`), `/v1/harmony/types`, `/v1/harmony` (`routes/harmony.ts:42,93`), `POST /v1/chara/resolve`, `GET /v1/chara/icon/:iconId` (`chara/router.ts:195,271`), `POST /v1/telemetry` (`telemetry/router.ts:53`); `src/index.ts:165-177` | HIGH | add |
| API-3 | `README.md:122` | `rate-limit.ts` KVRateLimiter | `CloudflareRateLimiter` on `API_RATE_LIMITER` (`src/middleware/rate-limit.ts:38-49`; `wrangler.toml:48-51,99-102`) | HIGH | fix |
| API-4 | `README.md:159-166` | bindings `RATE_LIMIT`, `ASSETS`, vars | also `API_RATE_LIMITER`, `TELEMETRY_RATE_LIMITER` (`:48-58,99-108`), `ANALYTICS` (`:62-64,112-114`), `XIVAPI_BASE`/`XIVAPI_VERSION` (`:43-44,78`), `XIVAPI_SCHEMA` (`src/types.ts:41`) | HIGH | copy table from `apps/api-worker/CLAUDE.md:124-134` |
| API-11 | `docs/projects/api-worker/overview.md:62` | "60 req/min per IP, KV-backed sliding window +5" | native `API_RATE_LIMITER` 65/60 s (`wrangler.toml:48-51`; `rate-limit.ts:39-44`) | HIGH | fix; telemetry 240/60 s fail-closed |
| API-12 | `overview.md:73` | `rate-limit.ts # KV-backed` | same | HIGH | fix |
| API-13 | `overview.md:104-111` | bindings | missing four (API-4) | HIGH | add |
| API-2 | `README.md:7` | "9 `/v1` endpoints" | 17 (15 GET, 2 POST) | MED | fix |
| API-5 | `README.md:81-82` | `X-RateLimit-Limit: 60` / `Remaining: 59` | 65 / 64 (`packages/worker-kit/.../cloudflare.ts:186-191`; `kv.ts:133,146`) | MED | fix |
| API-6 | `README.md:117-143` | source tree | missing `routes/wheels.ts`, `routes/harmony.ts`, `chara/`, `telemetry/`, `lib/harmony.ts`, `lib/bounded-body.ts`, `scripts/build-item-names.mjs` | MED | sync with `CLAUDE.md:54-89` |
| API-9 | `apps/api-worker/CLAUDE.md:92` | "Phase 1: 9 under `/v1`" | 17 | MED | fix |
| API-10 | `CLAUDE.md:173` | `KVRateLimiter` per-request | fallback; memoised (`packages/worker-kit/src/middleware/rate-limit.ts:122-133`) | MED | fix |
| API-14 | `overview.md:71` | `types.ts` bindings list | six more (`src/types.ts:2-42`) | MED | extend |
| API-15 | `overview.md:75-87` | tree | missing (see API-6) | MED | add |
| API-16 | `overview.md:100` | `spectral.js` dep | not a dep (`package.json:29-34`) | MED | delete |
| API-18 | `overview.md:143` | "9 endpoints, anonymous, bundled data only" | 17; `/v1/chara/*` XIVAPI-backed | MED | fix |
| API-19 | `overview.md:153` | "Phase 3 (Planned): palette generation" | shipped 0.14.0 | MED | move |
| API-20 | `docs/projects/api-worker/endpoints.md` | "Full API reference" | `POST /v1/telemetry` absent | MED | add "Internal routes" section |
| API-7 | `README.md:141` | tests/middleware content | only `rate-limit.test.ts` | LOW | fix |
| API-8 | `README.md:152` | `@xivdyetools/logger` dep | transitive | LOW | mark |
| API-17 | `overview.md:98` | same | same | LOW | mark |
| API-21 | `endpoints.md:499` | `X-RateLimit-Remaining` | synthetic with native binding (`cloudflare.ts:188`, `:37-38`) | LOW | caveat |
| OG-2 | `docs/projects/og-worker/overview.md:31-40` | `cd xivdyetools-og-worker` / `npm install` | `apps/og-worker/`; pnpm | HIGH | fix |
| OG-3 | `overview.md:135-136` | only `lang`, `frame`, `algo` allowed | `OG_ALLOWED_QUERY_KEYS = ['lang','frame','algo','mode','wheel']` (`src/index.ts:218`) | HIGH | fix |
| OG-4 | `overview.md:139-143` | query table | `mode` (`:91-96`, `:276-279`), `wheel` (`:285-288`) missing | HIGH | add |
| OG-5 | `overview.md:248-252` | "None required — stateless" | `ANALYTICS` (`wrangler.toml:45-47,84-86`), vars `APP_BASE_URL`/`OG_IMAGE_BASE_URL` (`:54-56,80-82`; `isOgImageHost` `src/index.ts:463-468`) | HIGH | use table from `apps/og-worker/CLAUDE.md:219-223` |
| OG-17 | `apps/og-worker/CLAUDE.md:56-59` | `fonts/` 6 TTFs incl. `*-VariableFont_wght.ttf` | 10 static instances (`src/services/fonts.ts:31-49`) | HIGH | rewrite |
| OG-1 | `overview.md:3` | "v2.1.0" | 2.10.0 | MED | DROP stamp |
| OG-6 | `overview.md:61` | iMessage `AppleWebKit` | `/Applebot/i` (`src/crawler-detector.ts:47`); WhatsApp (`:40`) missing | MED | fix |
| OG-7 | `overview.md:76` | "No → 302 to web app" | app host: `fetch(request)` pass-through (`src/index.ts:518-519`); 302 off-host (`:515-517,1220-1222`); og-image host 404 (`:1215-1217`) | MED | describe |
| OG-8 | `overview.md:218` | "six TTFs" | ten | MED | fix |
| OG-9 | `overview.md:236-237` | cache key composition | also `v`=`CARD_VERSION` (`:334,77`), `mode` (`:343-346`), `wheel` on `/og/harmony/*` (`:359-362`) | MED | fix |
| OG-10 | `overview.md:258-262` | analytics tracks dye IDs, cache hit ratio | `blobs:[event,tool,crawler]`, `doubles:[timestamp]`, `indexes:[tool]` (`src/index.ts:433-437`); crawler hits only | MED | fix |
| OG-11 | `overview.md:103` | `/harmony` params | reads `harmony`, `dye`, `algo`, `wheel` (`src/og-data-generator.ts:812-821`); `perceptual` ignored (test `:583-589`) | MED | fix |
| OG-12 | `overview.md:105` | `/mixer` params | also `mode` (`:840`) | MED | add |
| OG-18 | `CLAUDE.md:279` | "six TTFs" | ten | MED | fix |
| OG-21 | `apps/og-worker/README.md:42` | accepts `?lang`, `?frame=x` | also `algo`, `mode`, `wheel`; any other key 404s (`src/index.ts:218,261-290`) | MED | fix |
| OG-13 | `overview.md:106` | `/swatch` params | also `slot` (primary; `sheet` alias), `i` (`og-data-generator.ts:854,861`) | LOW | add |
| OG-14 | `overview.md:82` | `/og/harmony/:dyeId.png` | `/og/harmony/:dyeId/:harmonyType` (`src/index.ts:737`) | LOW | fix |
| OG-15 | `overview.md:229` | static assets row | none | LOW | delete |
| OG-16 | `overview.md:13-17` | Recent Changes to v2.2.0 | link CHANGELOG | LOW | replace with link |
| OG-19 | `CLAUDE.md:148` | "any other host → 302" | og-image host 404s | LOW | split |
| OG-20 | `CLAUDE.md:51-83` | tree | `src/og-params.ts`, `src/services/character-cells.ts` missing | LOW | add |
| OG-22 | `README.md:26-40` | endpoint table | `GET /` routed (`src/index.ts:1180-1197`) | LOW | add |

## oauth, moderation-worker, stoat-worker

| ID | File:line | Claim | Reality (evidence) | Sev | Proposed fix |
|---|---|---|---|---|---|
| OAU-1 | `apps/oauth/CLAUDE.md:114,116-117` | `rate-limit-do.ts`; `durable-objects/rate-limiter.ts` | neither exists (`src/services/rate-limit.ts:8-9`) | HIGH | delete |
| OAU-2 | `CLAUDE.md:131` | `RATE_LIMITER` Durable Object binding | no `durable_objects` block; `src/types.ts:53-79` | HIGH | replace with `RL_AUTH_10/20/30` rows |
| OAU-3 | `CLAUDE.md:147` | `USE_DO_RATE_LIMITING` | doesn't exist | HIGH | delete |
| OAU-4 | `CLAUDE.md:211-213` | "In-memory (default) … Durable Object (opt-in)" | native → KV → memory (`rate-limit.ts:101-118`; `index.ts:176-180`) | HIGH | fix |
| OAU-5 | `CLAUDE.md:301` | step 8 DO switch | same | HIGH | replace with `RL_AUTH_*` presence check (`env-validation.ts:239-251`) |
| OAU-6 | `CLAUDE.md:93,106,171` | `/auth/xivauth/cb` | `/auth/xivauth/callback` (`src/handlers/xivauth.ts:49,59,77,153`). ALSO fix the source comments at `apps/oauth/src/index.ts:262,275` (comments only) | HIGH | replace |
| OAU-7 | `apps/oauth/README.md:20`; `CLAUDE.md:168` | `/auth/callback` "exchanges the code and issues a JWT" | GET does NOT exchange (`callback.ts:19-22`); it verifies state and bounces `code`+`csrf`+`state` (`oauth-flow.ts:416-420,482-489`); the POST does the exchange | HIGH | rewrite |
| OAU-18 | `docs/projects/oauth/endpoints.md:58-63` | POST body `{ code, code_verifier }` | `state` required (`callback.ts:95-103`, `:105`) | HIGH | add |
| OAU-19 | `endpoints.md:82-91` | POST error table | missing `400 Missing state`, `400 Invalid state`/`PKCE verification failed` (`:106-114`), `413` (`middleware/body-validation.ts:24-35`) | HIGH | add |
| OAU-20 | `endpoints.md:45` | 302 → `?code=&csrf=&return_path=` | also `state=` (`oauth-flow.ts:489`); `return_path` only when non-`/` (`:493`) | HIGH | fix |
| OAU-24 | `docs/projects/oauth/pkce-flow.md:90-92` | Discord validates the challenge | worker verifies binding first (`callback.ts:105`; `utils/pkce-binding.ts:229-232`) | HIGH | fix |
| OAU-25 | `pkce-flow.md:73`, `:82-88` | steps omit `state` | `oauth-flow.ts:489`; `callback.ts:95-103` | HIGH | add |
| OAU-26 | `pkce-flow.md:125` | `code_challenge // For logging/debugging` | PKCE binding anchor (`pkce-binding.ts:225-232`) | HIGH | fix |
| OAU-27 | `pkce-flow.md:145-150` | Production allowlist `FRONTEND_URL` only, exact origin | `ALLOWED_REDIRECT_ORIGINS` + `FRONTEND_URL` incl. beta + projectgalatine (`src/constants/oauth.ts:101-113,131-139`); path must be exactly `/auth/callback` (`utils/oauth-validation.ts:87-93`) | HIGH | fix |
| OAU-28 | `pkce-flow.md:165,167` | "Merges with Discord account if linked" | removed (FINDING-013): refused + audit-logged (`services/user-service.ts:157-172`, `:186-199`) | HIGH | rewrite |
| OAU-8 | `CLAUDE.md:103-107` | handlers tree | missing `handlers/oauth-flow.ts` | MED | add |
| OAU-9 | `CLAUDE.md:127-133`; `README.md:85-95` | bindings | `RL_AUTH_10/20/30` (`wrangler.toml:25-38,78-91`), production-required (`env-validation.ts:239-251`) | MED | add |
| OAU-10 | `CLAUDE.md:113` | `rate-limit.ts # In-memory legacy` | backend selector (`:76-118`) | MED | fix |
| OAU-11 | `README.md:125`; `CLAUDE.md:266,286` | `@xivdyetools/logger` dep | transitive | MED | mark |
| OAU-13 | `docs/projects/oauth/overview.md:3` | "v2.6.0" | 3.1.0 | MED | DROP stamp |
| OAU-15 | `overview.md:131-153` | JWT sample/claims | missing `jti`, `auth_provider` (`services/jwt-service.ts:228-244`) | MED | add |
| OAU-16 | `overview.md:160-167` | `[vars]` sample | `XIVAUTH_CLIENT_ID` required (`env-validation.ts:167-176`; `wrangler.toml:18`) | MED | add |
| OAU-21 | `endpoints.md:189` | revoke: TTL = expiry; KV unavailable → `revoked:false` | TTL + 900 s (`packages/auth/src/revocation.ts:87-92`); failed write → 503 (`handlers/token.ts:159-171`); 200 only when KV unbound / no jti (`:174-182`) | MED | rewrite |
| OAU-22 | `endpoints.md:231` | per-IP sliding window | native per-colo counters (`rate-limit.ts:101-110`; `cloudflare.ts:38-45`) | MED | note |
| OAU-23 | `endpoints.md:286` | HSTS production only, no includeSubDomains | `ENVIRONMENT !== 'development'`, `; includeSubDomains` (`src/index.ts:162-164`) | MED | fix |
| OAU-12 | `README.md:98-104` | `XIVAUTH_CLIENT_SECRET` Required | optional (`src/types.ts:64`; `xivauth.ts:158`) | LOW | move |
| OAU-14 | `overview.md:16,18` | `cd xivdyetools-oauth` / `npm install` | `apps/oauth/`; pnpm | LOW | fix |
| OAU-17 | `overview.md:76-85` | tree | omits `xivauth.ts`, `oauth-flow.ts`, `constants/`, `middleware/`, `services/{rate-limit,user-service}.ts`, four utils | LOW | sync |
| OAU-29 | `pkce-flow.md:102-108` | step 5 user object | also `avatar` (`callback.ts:246`) | LOW | add |
| OAU-30 | `docs/projects/oauth/jwt.md:165` | TTL = expiry | + 900 s | LOW | add |
| OAU-31 | `jwt.md:143-149` | verification steps | issuer pinned (`jwt-service.ts:283-285`; `token.ts:53-58`) | LOW | add step |
| MOD-3 | `docs/projects/moderation-worker/overview.md:222` | "Moderator-only (no limits)" | command 20/min +5, autocomplete 60/min +10 (`src/middleware/rate-limit.ts:94-97`; `configs.ts:127-141`; `index.ts:298-328, 369-407`) | HIGH | fix |
| MOD-10 | `apps/moderation-worker/CLAUDE.md:236-241` | "6 languages" | English-only since 1.7.0 (`src/services/bot-i18n.ts:103-115`) | HIGH | rewrite |
| MOD-1 | `overview.md:3` | "v1.4.0" | 1.7.0 | MED | DROP stamp |
| MOD-2 | `overview.md:16-20` | Recent Changes end v1.4.0 | link CHANGELOG | MED | replace |
| MOD-4 | `overview.md:115` | `locales/` dir | doesn't exist; `bot-i18n.ts:30,115` | MED | fix |
| MOD-5 | `overview.md:105` | `rate-limit.ts # KVRateLimiter` | `CloudflareRateLimiter` when bound (`:166-169`) | MED | fix |
| MOD-6 | `overview.md:184-192` | `BOT_API_SECRET` required; `BOT_SIGNING_SECRET` absent | `BOT_API_SECRET` optional (`src/types/env.ts:20`); `BOT_SIGNING_SECRET` checked (`env-validation.ts:116-120`) | MED | fix |
| MOD-7 | `overview.md:174-178` | bindings | `RL_COMMAND`/`RL_AUTOCOMPLETE` (`wrangler.toml:33-41,89-97`), production-required (`env-validation.ts:148-155`; `index.ts:131-133`) | MED | add |
| MOD-11 | `CLAUDE.md:154` | KV sliding-window | native first (`rate-limit.ts:153-171`) | MED | fix |
| MOD-12 | `CLAUDE.md:113-118` | bindings omit RL | same | MED | add |
| MOD-13 | `CLAUDE.md:119` | vars | `ENVIRONMENT` too (`wrangler.toml:52,71`; `env-validation.ts:148`; `index.ts:659`) | MED | add |
| MOD-15 | `apps/moderation-worker/README.md:71-75` | Required Secrets | `MODERATION_CHANNEL_ID` required (`env-validation.ts:53-58`; `handlers/commands/preset.ts:99-104`) | MED | add |
| MOD-8 | `overview.md:41,44` | `cd xivdyetools-moderation-worker` / `npm install` | `apps/moderation-worker/`; pnpm | LOW | fix |
| MOD-9 | `overview.md:93,111-114` | buttons; utils list | `handlePresetRevertButton` (`handlers/buttons/index.ts:11-14,82-84`); five more utils | LOW | add |
| MOD-14 | `CLAUDE.md:156-159` | "TTL 120s" column | window 60 s (`configs.ts:127-141`) | LOW | fix |
| MOD-16 | `README.md:18`; `CLAUDE.md:221` | `/preset moderate` approve/reject | four actions `pending`, `approve`, `reject`, `stats` (`scripts/register-commands.ts:65-70`) | LOW | fix |
| MOD-17 | `CLAUDE.md:97-103` | utils tree | `embed-text.ts`, `sql-helpers.ts` missing | LOW | add |
| STO-1 | `apps/stoat-worker/README.md:13` | "Loading Indicators" feature | `withLoadingIndicator` has no production caller (`src/services/loading-indicator.ts:25`) | MED | tag "(helper written, not yet wired)" |
| STO-2 | `README.md:14` | "6 Languages" | `src/commands/info.ts:38` hard-codes `'en'` | MED | caveat |
| STO-3 | `README.md:111-129` | tree | omits `src/message-handler.ts`, `src/services/command-throttle.ts` | MED | add |
| STO-4 | `apps/stoat-worker/CLAUDE.md:144-151` | loading indicator pattern | not wired | LOW | note |

## Structural (apply)

1. `docs/projects/universalis-proxy/overview.md` — keep as a redirect stub (verified true); the orchestrator links it from `docs/projects/index.md`. Do not touch.
2. Per-page version stamps: drop them in every `docs/projects/<app>/*.md` you touch (versions live only in docs/versions.md).
3. Where a `docs/projects/<app>/overview.md` has a "Recent Changes" list, replace it with one line linking the app's `CHANGELOG.md`.
4. For api-worker/og-worker/oauth/moderation-worker, the app's own `CLAUDE.md` tables (bindings, endpoints) are the accurate source — copy from them into README/overview rather than re-deriving.
5. Two source-comment fixes are in scope (comments only, no behaviour): `apps/oauth/src/index.ts:262,275` (`/auth/xivauth/cb` → `/auth/xivauth/callback`) and `apps/image-worker/src/index.ts:129` (the wrong `'SSRF'` substring list → point at `IMAGE_INPUT_MARKERS`). Verify they are comments before editing.
