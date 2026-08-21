# Manual security review — `apps/presets-api` (community presets REST API)

- **Audit:** 2026-08-21 monorepo security audit (see `../AUDIT_MANIFEST.md`)
- **Unit:** `apps/presets-api` v2.0.0 — Cloudflare Worker (Hono 4.13.1) + D1 `xivdyetools-presets` + R2 `THUMBNAILS` + service bindings `DISCORD_WORKER`, `IMAGE_WORKER`; public at `api.xivdyetools.app` (production env only)
- **Reviewer:** Claude Code (Fable 5), read-only. No source file was modified; this report is the only file written.
- **Method:** every non-test file under `apps/presets-api/src` read in full, plus `wrangler.toml`, `schema.sql`, all `migrations/*.sql`, the `@xivdyetools/auth` and `@xivdyetools/worker-kit` sources presets-api consumes, and the three peers that define the trust boundary (discord-worker / moderation-worker `services/preset-api.ts` clients, discord-worker `/webhooks/preset-submission`, image-worker `/thumbnail`, oauth JWT minting). Installed Hono `cors` and `body-limit` middleware were read from `node_modules` to confirm runtime behaviour. Coverage list at the end.

## Summary

No CRITICAL or HIGH findings. The authentication model (HMAC-signed bot identity **and** a bearer secret for bots; HS256 JWT with `discord_id` → snowflake resolution for the web) is sound, every `.prepare()` uses bound parameters, ownership/moderator checks are present on every mutating route, and CORS is a strict allowlist. The substantive weaknesses are **abuse controls** (the per-user daily cap counts rows rather than events, so it is bypassed by self-delete; flagged edits and image uploads are unthrottled and each fans out a Discord moderation embed), a **visibility gap** on the duplicate-submission path (returns a full pending preset incl. the audit snapshot), and several **moderation-completeness** gaps (votes on unapproved presets, tags never moderated, deleted images cached at the edge for a year, ban check fails open). 1 MEDIUM, 9 LOW, 8 INFO.

| ID | Severity | Location | Title |
|---|---|---|---|
| PAPI-1 | MEDIUM | `rate-limit-service.ts:27-66`, `handlers/presets.ts:227-281, 454-473, 786-800` | Per-user abuse controls are bypassable: daily cap counts surviving rows (self-delete resets it); flagged PATCH edits and preview uploads have no per-user limit; every one fans out a Discord moderation embed |
| PAPI-2 | LOW | `handlers/presets.ts:558-568, 599-607`; `preset-service.ts:290-302` | Duplicate-dye submission path returns the full **pending** preset (incl. `previous_values`, `author_discord_id`) and votes on it — bypasses the BUG-014 visibility gate |
| PAPI-3 | LOW | `handlers/presets.ts:713-731`; `middleware/body-validation.ts:63-68`; `preview-image-service.ts:61-71` | Preview upload buffers the whole request body before the 5 MB check; bytes then reach image-worker `/thumbnail`, which has no dimension/pixel guard |
| PAPI-4 | LOW | `preview-image-service.ts:80-96`; `handlers/moderation.ts:242-255`; `handlers/presets.ts:848-858` | Rejected/deleted/replaced preview images stay in edge and browser caches for up to a year (`max-age=31536000, immutable`, no purge on takedown) |
| PAPI-5 | LOW | `handlers/votes.ts:157-166`; `handlers/presets.ts:561, 601` | Votes are accepted on pending / rejected / flagged / hidden presets (existence check only) |
| PAPI-6 | LOW | `handlers/presets.ts:376-380, 571-575`; `validation-service.ts:253-272` | Tags (and `example_link`, `author_name`) never pass content moderation and tags have no charset rule; discord-worker renders `tags.join(', ')` into embeds unsanitized |
| PAPI-7 | LOW | `middleware/auth.ts:177-206`; `packages/auth/src/hmac.ts:237-277` | Bot HMAC covers only `timestamp:userId:userName` — no method/path/body, no nonce (5-min replay window), unescaped `:` delimiter |
| PAPI-8 | LOW | `middleware/rate-limit.ts:17-32`; `worker-kit/src/rate-limiter/ip.ts:53-79` | IP limiter is per-isolate and fail-open; service-binding traffic has no `CF-Connecting-IP`, so every Discord-bot user shares one `unknown` bucket of 100 req/min |
| PAPI-9 | LOW | `middleware/ban-check.ts:82-86, 155-158`; `handlers/presets.ts:227, 821`; `handlers/votes.ts:183` | Ban check fails open on D1 error and is not applied to DELETE preset / DELETE vote / DELETE preview-image / refresh-author; bans are per-identity (Discord snowflake **or** XIVAuth UUID) |
| PAPI-10 | LOW | `middleware/auth.ts:71-84, 210-228`; `packages/auth/src/jwt.ts:173-202` | JWT revocation (oauth `TOKEN_BLACKLIST` jti list) is never consulted and `iss` is not checked — a revoked token stays valid here until `exp` |
| PAPI-11 | INFO | `handlers/presets.ts:249, 310, 702, 837`; `handlers/votes.ts:158-164` | 403-vs-404 existence oracle for non-approved preset IDs (UUIDv4, so low value) |
| PAPI-12 | INFO | `preset-service.ts:524-600, 397-421`; `handlers/presets.ts:372-418`; `handlers/moderation.ts:170-183` | Owner-edit `status` write and moderator `revert` are unconditional (TOCTOU vs concurrent moderation; revert forces `approved` even on a hidden row); approve/revert can hit the partial UNIQUE `dye_signature` index → unhandled 500 |
| PAPI-13 | INFO | `handlers/moderation.ts:60-125, 198-258`; `handlers/presets.ts:227-281` | Audit gaps: preview-image approve/reject and moderator DELETE write no `moderation_log` row; `reason` on `PATCH …/status` is unvalidated (type/length) |
| PAPI-14 | INFO | `preset-service.ts:106`; `index.ts:210-229` | `author_discord_id` on every public preset; `/` reveals `environment`; `/__force-error` test route ships in the production bundle |
| PAPI-15 | INFO | `index.ts:94-147`; `handlers/categories.ts:86-92` | No `Cache-Control: no-store` on authenticated/privileged JSON; `credentials: true` is unnecessary for a bearer-token API; legacy origin `xiv-colorexplorer.pages.dev` in the allowlist should be confirmed still owned |
| PAPI-16 | INFO | `moderation-service.ts:210-281, 336-405`; `data/profanity/en.ts` | `notifyModerators` / `MODERATION_WEBHOOK_URL` / `OWNER_DISCORD_ID` / `DISCORD_BOT_TOKEN` are dead; Perspective key sent as `?key=` query; Perspective fails open; local EN list has one entry |
| PAPI-17 | INFO | `handlers/presets.ts:110-111, 205-211`; `preset-service.ts:445-471`; `validation-service.ts:219-245` | Robustness: `refresh-author` can bind `undefined` → D1 500; `page` has no upper bound (float OFFSET → 500); `/moderation/pending` unbounded; `failed_notifications` never pruned; dye IDs not checked for uniqueness/existence |
| PAPI-18 | INFO | `wrangler.toml:12-42` | Top-level (dev) env binds the **production** D1 `database_id` and R2 bucket under `ENVIRONMENT=development` semantics (unsigned bot auth allowed when `BOT_SIGNING_SECRET` unset, stack traces in 500s, loopback CORS); safe only because that worker has no routes and `workers_dev=false` |

---

## Route table

The worker is publicly routed (production) at `api.xivdyetools.app`, so **every** route is reachable by any external HTTP client; "bot" identity is only obtainable with both `BOT_API_SECRET` and a fresh `BOT_SIGNING_SECRET` HMAC. `authMiddleware` runs on `*` and sets `auth` (`authSource: none|bot|web`), then each handler calls the guard it wants. Moderator = `MODERATOR_IDS` (env secret, whitespace/comma list of snowflakes) contains the resolved user id — for bot callers the signed `X-User-Discord-ID`, for web callers the JWT `discord_id` claim (fallback `sub`).

| Method | Path | Auth requirement / guards (in order) | Who can reach it |
|---|---|---|---|
| GET | `/` | none — returns name, `API_VERSION`, `ENVIRONMENT` | anyone |
| GET | `/health` | none | anyone |
| GET | `/__force-error` | none; 404 in production, throws elsewhere | anyone |
| GET | `/api/v1/presets` | none; `status` ∉ {pending,approved,rejected,flagged} → 400; `status≠approved` → `isModerator` else 403; `hidden` never listable; `limit` clamped 1–50 | anyone (moderators see `previous_values`) |
| GET | `/api/v1/presets/featured` | none | anyone |
| GET | `/api/v1/presets/mine` | `requireAuth` → `requireUserContext` | any authenticated user (own rows, all statuses, `rejection_reason`) |
| GET | `/api/v1/presets/rate-limit` | `requireAuth` → `requireUserContext` | any authenticated user |
| PATCH | `/api/v1/presets/refresh-author` | `requireAuth` → `requireUserContext` (no ban check) | any authenticated user, own rows only (`WHERE author_discord_id = ?`) |
| DELETE | `/api/v1/presets/:id` | `requireAuth` → `requireUserContext` → owner **or** moderator (no ban check, no audit log) | owner / moderator |
| PATCH | `/api/v1/presets/:id` | `requireAuth` → `requireUserContext` → `requireNotBannedCheck` → owner only → `hidden` → 403 | owner |
| GET | `/api/v1/presets/:id` | none; non-approved → 404 unless owner/moderator; `previous_values` stripped for non-privileged | anyone |
| POST | `/api/v1/presets` | `requireAuth` → `requireUserContext` → `requireNotBannedCheck` → 10/day (rows) → validate → dedupe → moderate | any authenticated user |
| POST | `/api/v1/presets/:id/preview-image` | `requireAuth` → `requireUserContext` → `requireNotBannedCheck` → owner only; raw bytes ≤5 MB, magic-byte sniff | owner |
| DELETE | `/api/v1/presets/:id/preview-image` | `requireAuth` → `requireUserContext` → owner only (no ban check) | owner |
| POST | `/api/v1/votes/:presetId` | `requireAuth` → `requireUserContext` → `requireNotBannedCheck` → preset exists (any status) | any authenticated user, votes as self |
| DELETE | `/api/v1/votes/:presetId` | `requireAuth` → `requireUserContext` (no ban check) | any authenticated user, own vote |
| GET | `/api/v1/votes/:presetId/check` | `requireAuth` → `requireUserContext` | any authenticated user, own vote |
| GET | `/api/v1/categories` | none; `Cache-Control: public, s-maxage=60` | anyone |
| GET | `/api/v1/categories/:id` | none; same cache header | anyone |
| GET | `/api/v1/moderation/pending` | `requireModerator` | moderators |
| PATCH | `/api/v1/moderation/:presetId/status` | `requireModerator`; status ∈ {approved,rejected,flagged,pending}; conditional UPDATE on observed status + batched log | moderators |
| PATCH | `/api/v1/moderation/:presetId/revert` | `requireModerator`; reason 10–200 chars; requires `previous_values` | moderators |
| PATCH | `/api/v1/moderation/:presetId/preview-image` | `requireModerator`; `action` ∈ {approve,reject} (no log row) | moderators |
| GET | `/api/v1/moderation/:presetId/history` | `requireModerator` | moderators |
| GET | `/api/v1/moderation/stats` | `requireModerator` | moderators |
| GET | `/api/v1/moderation/failed-notifications` | `requireModerator` | moderators |
| PATCH | `/api/v1/moderation/failed-notifications/:id/resolve` | `requireModerator` | moderators |
| OPTIONS | any | answered by Hono `cors()` before rate-limit/auth (204) | anyone |

Global middleware order (`index.ts:48-204`): requestId → logger → env validation (500 in prod if misconfigured) → security headers → CORS → `/api/*` IP rate limit (100/min) → `/api/*` body limit (100 KB, preview-image exempt) → `/api/*` JSON depth/prototype check → `authMiddleware` (`*`) → `/api/*` Content-Type gate for POST/PATCH/PUT with a body.

Internal-call authentication answer (asked in the brief): discord-worker and moderation-worker send `Authorization: Bearer <BOT_API_SECRET>` **plus** `X-Request-Timestamp` / `X-Request-Signature = HMAC-SHA256(BOT_SIGNING_SECRET, "ts:userId:userName")` / `X-User-Discord-ID` / `X-User-Discord-Name` over the service binding (`discord-worker/src/services/preset-api.ts:97-132`, `moderation-worker/src/services/preset-api.ts:111-151`). presets-api verifies the bearer constant-time (`auth.ts:110-121,154`) and then **requires** a valid signature in production (`auth.ts:160-206`; `env-validation.ts:86-90` makes `BOT_SIGNING_SECRET` mandatory in prod). An external caller to `api.xivdyetools.app` cannot forge bot identity without both secrets; a leak of `BOT_API_SECRET` alone is insufficient. Replay/cross-endpoint reuse of a captured signed request within 5 minutes is possible (PAPI-7) but capture requires access to binding traffic.

---

## Findings

### PAPI-1 — Per-user abuse controls bypassable; unthrottled Discord moderation fan-out
- **Severity:** MEDIUM — a single authenticated account can generate unlimited submissions/flagged edits/image uploads (bounded only by the soft, per-isolate 100 req/min IP limit), each one producing a Discord embed in the moderation or submission-log channel, a Perspective API call, image-worker CPU, R2 writes and dead-letter rows; the stated "10 per day" control does not hold.
- **CWE:** CWE-770 (Allocation of Resources Without Limits or Throttling), CWE-799 (Improper Control of Interaction Frequency)
- **Where:**
  - `apps/presets-api/src/services/rate-limit-service.ts:27-48` — the daily cap is `SELECT COUNT(*) FROM presets WHERE author_discord_id = ? AND created_at >= ? AND created_at < ?`, i.e. it counts **surviving rows**, not submission events.
  - `apps/presets-api/src/handlers/presets.ts:227-281` — `DELETE /presets/:id` (owner) hard-deletes the row (`DELETE FROM presets WHERE id = ?`), so the count drops back.
  - `apps/presets-api/src/handlers/presets.ts:454-473` — every edit whose name/description is flagged (`moderationStatus === 'pending'`) calls `notifyDiscordBot`; there is no per-user limit on `PATCH`.
  - `apps/presets-api/src/handlers/presets.ts:786-800` — every preview upload calls `notifyDiscordBot` (`type: 'preview_image'`); no per-user limit.
  - `apps/presets-api/src/middleware/rate-limit.ts:17-32` + `packages/worker-kit/src/rate-limiter/backends/memory.ts` — the only throttle on these routes is the in-memory 100/min/IP limiter (per isolate, fail-open).
  - Fan-out target: `apps/discord-worker/src/index.ts:174-398` posts one embed per notification (moderation channel for pending/preview, submission-log channel for auto-approved).
- **Excerpt:**
  ```ts
  // rate-limit-service.ts:34-39
  const query = `SELECT COUNT(*) as count FROM presets
    WHERE author_discord_id = ? AND created_at >= ? AND created_at < ?`;
  // presets.ts:260-263 (owner delete)
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM votes WHERE preset_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM presets WHERE id = ?').bind(id),
  ]);
  ```
- **Exploit:** with any web JWT (free Discord login): loop `{ POST /api/v1/presets {name:"<slur>", description:…, dyes:[random 3 of 125]} → DELETE /api/v1/presets/<id> }`. Each POST passes the cap (count is always <10 after the delete), is flagged → `pending`, and `waitUntil` posts a moderation embed with approve/reject buttons. ~50 embeds/min per isolate; Discord then 429s the bot, `notifyDiscordBot` retries with backoff and dead-letters into `failed_notifications` (never pruned). Variant without delete: create one preset, then `PATCH /api/v1/presets/<id> {name:"<slur>"}` 100×/min — each is re-flagged and re-notified (`moderationStatus==='pending'` regardless of current status). Variant: `POST /api/v1/presets/<id>/preview-image` 100×/min with a tiny valid PNG → 100 image embeds/min + image-worker decodes + R2 put/delete churn.
- **Fix:** (1) Count submission *events* — keep a lightweight `submission_events (author_id, created_at)` table or a KV/DO counter keyed by user+UTC day that is incremented on create and never decremented; or soft-delete presets (`status='deleted'`) so the count survives. (2) Add per-user (not per-IP) limits on `PATCH /presets/:id` and `POST …/preview-image` (e.g. 10/hour), and a per-user cooldown on notification emission. (3) Consider requiring `moderationStatus` transitions to notify only once per preset per hour. (4) Use a distributed backend (KV/DO/Upstash `write` preset) for the public limiter on mutating routes.
- **Confidence:** CONFIRMED (full path traced; no compensating control in middleware or handlers).

### PAPI-2 — Duplicate-submission path leaks full non-approved preset and votes on it
- **Severity:** LOW — bypasses the BUG-014 rule that non-approved presets (incl. content held for profanity/toxicity review) and the `previous_values` audit snapshot are visible only to owner/moderators; requires knowing the exact dye combination (3–6 stainIDs), so mostly targeted rather than blind.
- **CWE:** CWE-200 (Exposure of Sensitive Information), CWE-862 (Missing Authorization)
- **Where:** `apps/presets-api/src/handlers/presets.ts:558-568` and `:599-607` (race branch); `apps/presets-api/src/services/preset-service.ts:290-302` (`findDuplicatePreset` matches `status IN ('approved','pending')` and returns `rowToPreset(row)` unstripped).
- **Excerpt:**
  ```ts
  // presets.ts:558-567
  const duplicate = await findDuplicatePreset(c.env.DB, body.dyes);
  if (duplicate) {
    const voteResult = await addVote(c.env.DB, duplicate.id, auth.userDiscordId!);
    return c.json({ success: true, duplicate, vote_added: … });
  ```
- **Exploit:** Attacker saw preset P while it was approved (knows its dyes). Owner later edits P with text the filter flags → P becomes `pending` (hidden from `GET /presets/:id` → 404 and from listings). Attacker `POST /api/v1/presets {…, dyes: P.dyes}` → 200 `{duplicate: {name, description (the flagged text), tags, author_discord_id, author_name, status:'pending', previous_values:{…}, example_link, …}}` and a vote is registered on the hidden preset. Blind probing of 3-dye pending combos is also possible because this path is not counted by the daily cap (no row created) — ~100 probes/min.
- **Fix:** In the duplicate branch return only `{id, name}` for approved duplicates and a neutral 409/`{duplicate:null, vote_added:false}` for pending ones (or only vote when `duplicate.status==='approved'`); always pass the object through `stripAuditData`. Same for the race branch at `:602-606` and the 409 body in `PATCH` (`:350-354`, `:433-439`).
- **Confidence:** CONFIRMED.

### PAPI-3 — Preview upload buffers the full body before the size check; downstream decode has no dimension guard
- **Severity:** LOW — only the preset's owner (any authenticated user can create a preset) reaches the read, but they can then push bodies far above 5 MB (Workers accepts up to the plan's request-body cap, 100 MB+) into isolate memory 100×/min; and a ≤5 MB PNG/WebP with huge dimensions makes image-worker decode to hundreds of MB.
- **CWE:** CWE-400 (Uncontrolled Resource Consumption), CWE-770
- **Where:** `apps/presets-api/src/handlers/presets.ts:713-731` (`new Uint8Array(await c.req.arrayBuffer())` then `if (bytes.byteLength > MAX_PREVIEW_IMAGE_BYTES)`); `apps/presets-api/src/middleware/body-validation.ts:63-68` (the 100 KB `bodyLimit` deliberately exempts this route and nothing replaces it); `apps/presets-api/src/services/preview-image-service.ts:61-71` (bytes forwarded to `IMAGE_WORKER /thumbnail`); `apps/image-worker/src/photon.ts:273-297` (`loadImage → crop → resize`, no `validateDimensions`/`MAX_PIXEL_COUNT` on this path — the `/extract` path has them).
- **Excerpt:**
  ```ts
  // presets.ts:713-722
  const bytes = new Uint8Array(await c.req.arrayBuffer());
  …
  if (bytes.byteLength > MAX_PREVIEW_IMAGE_BYTES) {
  ```
- **Exploit:** Owner of preset X sends `POST /api/v1/presets/X/preview-image` with `Content-Type: image/png` and a 90 MB body, repeatedly → each request allocates ~90 MB in the 128 MB isolate before being rejected. Or sends a 2 MB PNG declaring 20000×20000 → image-worker attempts a 1.6 GB RGBA decode → WASM OOM (request fails as 400 "Image could not be processed", but the image-worker isolate is churned; no signature/rate limit exists on image-worker by design).
- **Fix:** Apply `bodyLimit({maxSize: MAX_PREVIEW_IMAGE_BYTES})` to this route (Hono's bodyLimit checks `Content-Length` first and otherwise counts the stream — both cheaper than `arrayBuffer()`); in image-worker `/thumbnail` reject when `width*height > MAX_PIXEL_COUNT` or either side > `MAX_IMAGE_DIMENSION` immediately after `loadImage` (cross-unit note for the image-worker reviewer).
- **Confidence:** CONFIRMED for the buffering; PLAUSIBLE for the concrete memory impact (Workers' body cap and OOM behaviour not exercised).

### PAPI-4 — Rejected / deleted preview images remain cached at the edge and in browsers for up to a year
- **Severity:** LOW — moderation/legal takedown is incomplete: after a moderator rejects an image (or an author deletes/replaces one), the R2 object is deleted but any Cloudflare edge or browser that already fetched `https://shots.xivdyetools.app/<preset>/<uuid>.webp` serves it for up to 365 days; nothing purges.
- **CWE:** CWE-459 (Incomplete Cleanup), CWE-525 (Use of Web Browser Cache Containing Sensitive Information)
- **Where:** `apps/presets-api/src/services/preview-image-service.ts:80-87` (`cacheControl: 'public, max-age=31536000, immutable'`), `:93-96` (`deletePreviewImage` = plain `R2.delete`); callers `apps/presets-api/src/handlers/moderation.ts:242-255`, `apps/presets-api/src/handlers/presets.ts:771-779, 854-858`. No `purge` anywhere in `src/`.
- **Excerpt:**
  ```ts
  await env.THUMBNAILS.put(key, webp, { httpMetadata: { contentType: 'image/webp',
    cacheControl: 'public, max-age=31536000, immutable' } });
  ```
- **Exploit:** An image is approved and its URL appears in `preview_image_url` on a popular preset (cached by many edges/browsers). It is later found to be abusive/infringing and a moderator rejects it (`PATCH /moderation/:id/preview-image {action:'reject'}`). The API stops advertising the URL and R2 deletes the object, but the URL keeps resolving from cache wherever it was fetched — the takedown is not effective.
- **Fix:** On reject/delete/replace, purge the URL via the Cloudflare cache-purge API (`purge_cache` with `files:[url]`) or front the bucket with a Worker that checks a "tombstone" KV; alternatively use a short `s-maxage` (e.g. 1 h) with long browser `max-age` only after approval. Keep the UUID-key immutability but don't rely on it for takedown.
- **Confidence:** PLAUSIBLE (R2 custom domains honour object `Cache-Control` for edge caching; exact edge behaviour not exercised).

### PAPI-5 — Votes accepted on non-approved presets
- **Severity:** LOW — lets authors farm votes on a pending preset (launches "popular"), re-inflate a banned author's hidden preset so it ranks on un-hide, and the duplicate path (PAPI-2) votes on pending presets; `vote_count` feeds `popular` ordering and `/featured`.
- **CWE:** CWE-284 (Improper Access Control)
- **Where:** `apps/presets-api/src/handlers/votes.ts:157-166` (`SELECT id FROM presets WHERE id = ?` — no status predicate), `apps/presets-api/src/handlers/presets.ts:561, 601`.
- **Excerpt:**
  ```ts
  const preset = await c.env.DB.prepare('SELECT id FROM presets WHERE id = ?').bind(presetId).first();
  if (!preset) return notFoundResponse(c, 'Preset');
  const result = await addVote(c.env.DB, presetId, auth.userDiscordId!);
  ```
- **Exploit:** Author submits a preset that lands `pending`, shares the UUID with friends; each `POST /api/v1/votes/<id>` succeeds (200) although `GET /presets/<id>` 404s for them. When approved it starts at N votes. Hidden (banned) presets can be voted the same way by anyone who kept the URL.
- **Fix:** `SELECT id FROM presets WHERE id = ? AND status = 'approved'` (404 otherwise, matching the GET gate); skip/neutralise the vote in the duplicate branch unless the duplicate is approved.
- **Confidence:** CONFIRMED.

### PAPI-6 — Tags bypass content moderation and have no charset rule; rendered raw in Discord embeds
- **Severity:** LOW — publishes unmoderated free text on auto-approved presets (public JSON + gallery) and, via discord-worker, injects raw markdown (masked links) into the moderation/submission-log embeds; impact is content-policy/phishing-in-staff-channel rather than code execution.
- **CWE:** CWE-20 (Improper Input Validation), CWE-116 (Improper Encoding or Escaping of Output — cross-unit)
- **Where:** `apps/presets-api/src/handlers/presets.ts:571-575` (`moderateContent(body.name, body.description, …)`) and `:376-380` (edit: only when name/description change); `apps/presets-api/src/services/validation-service.ts:253-272` (tags: array ≤10 of strings ≤30, nothing else); `apps/discord-worker/src/index.ts` webhook: `value: preset.tags.join(', ')` and `value: preset.author_name || 'Unknown'` (only name/description go through `sanitizePresetName/Description`, and that helper strips control/invisible chars, not markdown).
- **Excerpt:**
  ```ts
  if (tags.some((tag) => typeof tag !== 'string' || tag.length > rules.itemMaxLength)) {
  ```
- **Exploit:** `POST /api/v1/presets {name:"Nice", description:"A calm palette.", tags:["<slur>", "[Verify bot](https://evil.tld)"], …}` → local + Perspective check only sees "Nice A calm palette." → `approved` → tags are public immediately; the submission-log embed shows a clickable "Verify bot" masked link to staff. Editing tags on an approved preset (`PATCH` with only `tags`) never triggers moderation at all.
- **Fix:** Include tags (joined) in `moderateContent`; restrict tags to a conservative charset (e.g. `^[\p{L}\p{N}][\p{L}\p{N} _'-]{0,29}$`u), trim and dedupe; in discord-worker, sanitise tags and author_name and escape markdown (or wrap in inline code) before embedding.
- **Confidence:** CONFIRMED for the moderation bypass; PLAUSIBLE for the embed rendering (masked links in embed field values is documented Discord behaviour, not exercised).

### PAPI-7 — Bot HMAC binds identity + time only; replayable across endpoints; unescaped delimiter
- **Severity:** LOW — the scheme gives weaker guarantees than it appears to (any captured header set is a 5-minute bearer for *every* route as that user), but capture requires access to service-binding traffic (or the documented `PRESETS_API_URL` HTTPS fallback), which an external attacker does not have. Already tracked as REFACTOR-027.
- **CWE:** CWE-294 (Authentication Bypass by Capture-replay), CWE-347 (Improper Verification of Cryptographic Signature)
- **Where:** `apps/presets-api/src/middleware/auth.ts:177-206`; `packages/auth/src/hmac.ts:237-277` (`message = \`${timestamp}:${userDiscordId ?? ''}:${userName ?? ''}\``, no nonce, `maxAgeMs` 5 min, `clockSkewMs` 1 min); signer `apps/discord-worker/src/services/preset-api.ts:52-60`.
- **Excerpt:**
  ```ts
  const message = `${timestamp}:${userDiscordId ?? ''}:${userName ?? ''}`;
  return hmacVerifyHex(message, signature, secret);
  ```
- **Exploit:** A signed `GET /api/v1/moderation/pending` from moderator M (headers: ts, sig, `X-User-Discord-ID: M`) captured within 5 min can be re-sent as `PATCH /api/v1/moderation/<id>/status {status:'approved'}` — the signature validates because method/path/body are not covered and there is no nonce. Canonicalisation: id=`111`, name=`222:x` and id=`111:222`, name=`x` produce the same message (a Discord display name may contain `:`); not exploitable for a *real* snowflake, but shows the format is ambiguous.
- **Fix:** Sign `ts:method:path:sha256(body):userId:userName` with length-prefixed or JSON-encoded fields; add a per-request nonce with a short KV/DO replay cache; keep the 5-minute window.
- **Confidence:** CONFIRMED (scheme), impact bounded by transport.

### PAPI-8 — Per-isolate, fail-open IP limiter; bot traffic shares one `unknown` bucket
- **Severity:** LOW — availability: the only throttle on writes is advisory (state per isolate, 10k-entry LRU, fail-open), and because service-binding requests carry no `CF-Connecting-IP` (discord-worker builds `new Request(...)` with explicit headers only, `preset-api.ts:97-145`), **every** Discord-bot user's preset traffic is keyed `'unknown'` and collectively capped at 100 req/min per presets-api isolate → bot users get 429s under modest aggregate load; conversely an attacker from many IPs/colos is not meaningfully limited (see PAPI-1).
- **CWE:** CWE-770, CWE-693 (Protection Mechanism Failure)
- **Where:** `apps/presets-api/src/middleware/rate-limit.ts:17-32`; `packages/worker-kit/src/rate-limiter/ip.ts:53-79` (`return 'unknown'` when `CF-Connecting-IP` absent and XFF not trusted); `packages/worker-kit/src/middleware/rate-limit.ts:119, 153-156` (`onError: 'fail-open'` default); `packages/worker-kit/src/rate-limiter/backends/memory.ts:13-14` ("State is not shared across Workers isolates").
- **Excerpt:**
  ```ts
  export const publicRateLimitMiddleware = rateLimitMiddleware({
    backend: ipRateLimiter, keyExtractor: (c) => getClientIp(c.req.raw), config: PUBLIC_API_LIMITS.default });
  ```
- **Exploit:** 11 Discord users each run `/preset` commands ~10/min (the bot's own per-user cap) → >100 binding calls/min to one isolate → the 101st returns 429 to an unrelated user. Separately, a scripted attacker rotating egress IPs (or simply landing on different isolates) sidesteps the 100/min meant to bound PAPI-1.
- **Fix:** Skip the IP limiter for `authSource==='bot'` or key it by `X-User-Discord-ID` once the signature is verified (move the limiter after `authMiddleware`), and forward `CF-Connecting-IP` from the bots; back the limiter with KV/Upstash/DO (`PUBLIC_API_LIMITS.write` for POST/PATCH/DELETE) with `onError:'fail-closed'` on write routes.
- **Confidence:** PLAUSIBLE (the absence of `CF-Connecting-IP` on binding requests is standard Workers behaviour but was not exercised).

### PAPI-9 — Ban check fails open and is not applied uniformly; bans are per-identity
- **Severity:** LOW — a D1 error (or the acknowledged "table missing" case) silently admits a banned user to submit/edit/vote; banned users can still delete presets/votes and rename themselves; a user with both a Discord and an XIVAuth-only login has two identities and a ban on one does not touch the other (the `xivauth_id` column of `banned_users` is never read or written by any code path).
- **CWE:** CWE-636 (Not Failing Securely), CWE-284
- **Where:** `apps/presets-api/src/middleware/ban-check.ts:82-86, 155-158` (`catch … console.error … return next()/null`); absent on `handlers/presets.ts:227` (DELETE), `:188` (refresh-author), `:821` (DELETE preview-image), `handlers/votes.ts:183` (DELETE vote). Identity model: `auth.ts:59-65` (`discord_id` claim else `sub` UUID); `moderation-worker/src/services/ban-service.ts:254-262, 350-355` (bans and hides by `author_discord_id` only).
- **Excerpt:**
  ```ts
  } catch (error) {
    // Log error but don't block the request if the check fails
    console.error('Ban check failed:', error);
  }
  return next();
  ```
- **Exploit:** During a D1 incident, a banned account's `POST /api/v1/presets` passes the ban check (and may succeed if the write lands on retry). Identity: user banned as XIVAuth UUID `U` logs in with Discord (JWT `discord_id=S`) → `S` is not in `banned_users` → full access; the reverse also holds.
- **Fix:** Fail closed on ban-check errors in production (return 503) and only fail open when `ENVIRONMENT !== 'production'`; apply `requireNotBannedCheck` to all mutating routes; when oauth links an XIVAuth account to a Discord account, have moderation-worker (or oauth) mirror bans across both identifiers, and populate/consult `banned_users.xivauth_id`.
- **Confidence:** CONFIRMED (fail-open, route coverage); identity-evasion PLAUSIBLE (depends on oauth account-merge behaviour, `apps/oauth/src/services/user-service.ts`).

### PAPI-10 — JWT revocation never consulted; `iss` not validated
- **Severity:** LOW — oauth maintains a jti blacklist (`TOKEN_BLACKLIST`, `apps/oauth/src/handlers/refresh.ts:104-105, 171-172, 286-291`) used on refresh/logout, but presets-api has no KV binding and never calls `isTokenRevoked`, so a logged-out or rotated token stays valid here until `exp` (`JWT_EXPIRY`, default 3600 s per `apps/oauth/src/services/jwt-service.ts:111-112`). `iss` is ignored, so any HS256 token signed with `JWT_SECRET` is accepted regardless of issuer.
- **CWE:** CWE-613 (Insufficient Session Expiration)
- **Where:** `apps/presets-api/src/middleware/auth.ts:71-84, 210-228`; `packages/auth/src/jwt.ts:173-202`.
- **Excerpt:**
  ```ts
  const payload = await sharedVerifyJWT(token, secret);   // no revocation store, no iss check
  ```
- **Exploit:** Victim's token is exfiltrated (it lives in `localStorage`, `web-app/src/services/auth-service.ts:433-438`); victim logs out → oauth revokes the jti; the attacker still calls `POST /api/v1/presets`, `DELETE /api/v1/presets/<victim's>` etc. for up to `JWT_EXPIRY`.
- **Fix:** Bind the same `TOKEN_BLACKLIST` KV into presets-api and call `isTokenRevoked(payload.jti, env.TOKEN_BLACKLIST)` after signature verification (fail-open semantics of the helper are acceptable here); pass `expectedIssuer` (oauth `WORKER_URL`) — add an `iss` check to `verifyJWT` options; keep `JWT_EXPIRY` short.
- **Confidence:** CONFIRMED.

### PAPI-11 — Existence oracle for non-approved preset IDs (INFO)
- **Severity:** INFO — IDs are `crypto.randomUUID()` so enumeration is infeasible; only matters if an ID leaks.
- **CWE:** CWE-203 (Observable Discrepancy)
- **Where:** `handlers/presets.ts:249-251` (DELETE → 403 "Cannot delete another user's preset"), `:310-311` (PATCH → 403 before the hidden check at `:365`), `:702-711`, `:837-838` (preview-image → 403), `handlers/votes.ts:158-164` (vote → 200/409 vs 404). `GET /presets/:id` correctly returns 404 (`:502-504`).
- **Exploit:** Knowing a UUID, `DELETE /api/v1/presets/<id>` → 403 confirms a hidden/pending preset exists while GET says 404.
- **Fix:** Return the same 404 as GET when the caller is neither owner nor moderator and the preset is not approved.
- **Confidence:** CONFIRMED.

### PAPI-12 — Unconditional status writes on owner edit and moderator revert; UNIQUE-index 500s (INFO)
- **Severity:** INFO — narrow TOCTOU windows and moderator-only/robustness effects.
- **CWE:** CWE-367 (TOCTOU), CWE-755 (Improper Handling of Exceptional Conditions)
- **Where:** `services/preset-service.ts:580-596` (`updatePreset` sets `status = ?` with `WHERE id = ?` only — an owner edit that read `approved` re-writes `approved` over a concurrent moderator reject/flag); `:397-421` (`prepareRevert` forces `status='approved'` and is not conditional on observed status — reverting a `hidden` (banned-author) or `rejected` row publishes it); `handlers/moderation.ts:97-107` / `:170-178` — approving a rejected/hidden preset whose `dye_signature` is now held by another approved/pending row violates the partial UNIQUE index → unhandled → generic 500 (no 409 recovery as on the owner paths).
- **Fix:** Make the owner edit's status clause conditional (`WHERE id = ? AND status = ?` with the status it read; 409 on zero rows); make `prepareRevert` preserve `hidden`/`rejected` or require an explicit flag; catch `UNIQUE constraint failed … dye_signature` in the moderation handlers and return 409.
- **Confidence:** CONFIRMED.

### PAPI-13 — Moderation audit gaps; `reason` unvalidated on status change (INFO)
- **Severity:** INFO — moderators only.
- **CWE:** CWE-778 (Insufficient Logging), CWE-20
- **Where:** `handlers/moderation.ts:198-258` — preview-image approve/reject writes no `moderation_log` row (the comment at `handlers/presets.ts:807-809` claims it does); `handlers/presets.ts:227-281` — a moderator deleting someone else's preset leaves no log row and sends no notification; `handlers/moderation.ts:69-106` — `body.reason` is bound as-is (`body.reason || null`): non-string → D1 type error → 500; length unbounded (≤100 KB body).
- **Fix:** Log `preview_image_approve` / `preview_image_reject` / `delete` actions with moderator id; run `validateModerationReason` (optional variant) on `status` changes.
- **Confidence:** CONFIRMED.

### PAPI-14 — Identifier/metadata exposure (INFO)
- **Severity:** INFO.
- **CWE:** CWE-200
- **Where:** `services/preset-service.ts:106` — `author_discord_id` is serialised on every public preset (`GET /presets`, `/featured`, `/:id`); the web app needs it only for the owner's own edit gate (`web-app/src/components/preset-edit-form.ts:86`). `index.ts:210-217` — `/` returns `environment`; `index.ts:224-229` — `/__force-error` is compiled into the production bundle (guarded to 404).
- **Fix:** Return `author_discord_id` only to the owner/moderators (or replace with an opaque `is_owner` flag computed server-side); drop `environment` from `/`; tree-shake the test route behind a build flag.
- **Confidence:** CONFIRMED.

### PAPI-15 — Cache and CORS hygiene (INFO)
- **Severity:** INFO — CORS itself is correct (see positive controls); these are hardening nits.
- **CWE:** CWE-525, CWE-942 (Permissive Cross-domain Policy — nit only)
- **Where:** `index.ts:94-147` — `credentials: true` is set although the web app authenticates with `Authorization: Bearer` from `localStorage` (no cookies) — harmless with the exact-match allowlist but unnecessary; the allowlist (`wrangler.toml:50`) still includes the legacy `https://xiv-colorexplorer.pages.dev` — if that Pages project were ever deleted the subdomain could be re-registered by a third party (dangling allowlisted origin). No route sets `Cache-Control: no-store` on authenticated responses (`/mine`, `/rate-limit`, `/moderation/*`, privileged `GET /presets/:id`); `handlers/categories.ts:86-92` marks public data `public, s-maxage=60` (fine, and `Vary: Origin` is appended by Hono).
- **Fix:** Drop `credentials: true`; prune unused origins; add `Cache-Control: no-store` (and `Referrer-Policy: no-referrer`) via the security-headers middleware for any response where `auth.isAuthenticated`.
- **Confidence:** CONFIRMED.

### PAPI-16 — Dead notification path, Perspective key in URL, fail-open moderation, thin local list (INFO)
- **Severity:** INFO.
- **CWE:** CWE-561 (Dead Code), CWE-598 (Use of GET Request Method With Sensitive Query Strings — analogous), CWE-636
- **Where:** `services/moderation-service.ts:336-405` — `notifyModerators` (and with it `MODERATION_WEBHOOK_URL`, `OWNER_DISCORD_ID`, `DISCORD_BOT_TOKEN`) has no caller in `src/` (only tests); the URL is env-only, never user-controlled, so no SSRF. `:221-222` — `?key=${env.PERSPECTIVE_API_KEY}` in the request URL (would appear in any outbound request logging/tracing); `:240-243, 277-280` — any Perspective failure/timeouts → `null` → content passes on the local list alone; `data/profanity/en.ts` contains a single entry (`'ai slop'`), so without `PERSPECTIVE_API_KEY` essentially everything auto-approves.
- **Fix:** Delete `notifyModerators` and the three unused secrets from `Env`/docs (or wire it as the fallback it was meant to be); send the key via the `X-Goog-Api-Key` header; consider failing *to pending* (not approved) when Perspective is configured but unavailable; document that the local list is intentionally minimal.
- **Confidence:** CONFIRMED.

### PAPI-17 — Robustness nits (INFO)
- **Severity:** INFO.
- **CWE:** CWE-20, CWE-400
- **Where:** `handlers/presets.ts:205-211` — `.bind(auth.userName, …)` with `userName` possibly `undefined` (bot caller without `X-User-Discord-Name`, or a JWT lacking both `global_name`/`username`) → D1 `D1_TYPE_ERROR` → 500. `:110-111` — `page` is lower-clamped but not upper-bounded; `page=100000000000000000000` → `offset` becomes a non-integer double → D1/SQLite datatype error → 500. `services/preset-service.ts:445-471` — `/moderation/pending` has no LIMIT (amplifies PAPI-1); `services/notification-service.ts:156-177` — `failed_notifications` grows without bound. `services/validation-service.ts:219-245` — dye IDs are checked for range 1–254 but not uniqueness (`[5,5,5]` accepted) or existence (only 125 stainIDs exist), which yields empty palettes client-side.
- **Fix:** Coerce `userName ?? null`; clamp `page` (e.g. ≤ 10 000); paginate the moderation queue; add a retention job for resolved dead-letter rows; require distinct dye IDs and validate against the core dye set.
- **Confidence:** CONFIRMED (the D1 `undefined` bind behaviour is documented, not exercised).

### PAPI-18 — Dev environment shares production D1/R2 under development semantics (INFO)
- **Severity:** INFO today — the top-level worker `xivdyetools-presets-api-dev` has no routes and `workers_dev=false`, so it is unreachable; but it binds the **production** `database_id e17d68a1-…` and the production thumbnails bucket with `ENVIRONMENT=development`, under which `auth.ts:158-170` accepts **unsigned** bot identity (if `BOT_SIGNING_SECRET` is absent on that worker), `index.ts:262-279` returns `err.message`+stack, and loopback origins are reflected. A future `workers_dev=true`/route on that worker, or `wrangler dev --remote`, would expose production data with dev-grade controls.
- **CWE:** CWE-489 (Active Debug Code), CWE-1188 (Insecure Default Initialization)
- **Where:** `apps/presets-api/wrangler.toml:12-42` vs `:44-67`.
- **Fix:** Point the dev env at a separate D1/R2 (or local only), or require `BOT_SIGNING_SECRET` whenever `DB` is the production database; keep `workers_dev=false` under test (a deploy-time assertion).
- **Confidence:** CONFIRMED (configuration), impact conditional.

---

## Cross-unit notes (for the other reviewers / coordinator)

- **image-worker:** `/thumbnail` (`apps/image-worker/src/photon.ts:273-297`) decodes with no dimension/pixel cap, unlike `/extract` — see PAPI-3.
- **discord-worker:** webhook embeds interpolate `preset.tags.join(', ')` and `preset.author_name` without `sanitizePresetName` and without markdown escaping — see PAPI-6. Also, `searchPresetsForAutocomplete` in both bots calls `GET /presets?status=pending` with **no** user headers; since BUG-015 that returns 403 (non-moderator), so moderator autocomplete against the pending queue returns `[]` (functional, not security).
- **oauth:** presets-api trusts the `discord_id` claim absolutely for both identity and `MODERATOR_IDS` membership; for XIVAuth logins that claim comes from the XIVAuth social link (`apps/oauth/src/handlers/xivauth.ts:278-286`). If XIVAuth ever lets a user self-assert a Discord ID without an OAuth proof, that is a moderator-escalation path here. Also note the jti blacklist is oauth-only (PAPI-10).
- **moderation-worker:** bans are keyed by `author_discord_id` only; `banned_users.xivauth_id` is dead (PAPI-9).

## Reviewed and rejected (no finding)

- **SQL injection:** every `.prepare()` in `handlers/*`, `services/*`, `middleware/ban-check.ts` binds user input; `getPresets` builds only static fragments (`sort` via `switch`, `status` pre-validated, `category`/`search`/`is_curated`/`limit`/`offset` bound; LIKE wildcards escaped with `ESCAPE '\'`); `updatePreset` SET clauses are static column names with bound values; `json_each(...)` compares against a bound value. `getValidCategories` reads ids from D1 and only uses them for `includes()`.
- **Prototype pollution / JSON abuse:** `jsonDepthLimit` rejects depth >10 and any own `__proto__`/`constructor`/`prototype` key at any depth; no recursive merges anywhere; unknown body fields are ignored (no mass assignment — `createPreset`/`updatePreset` pick fields explicitly; `status`, `is_curated`, `author_*`, `vote_count` cannot be set by clients).
- **SSRF:** outbound `fetch` targets are fixed (Perspective, dead Discord paths) or service bindings with fixed paths; `example_link` is validated (https, allowlisted host incl. subdomains, ≤300 chars, parsed with WHATWG `URL`) and **never fetched**; image bytes (not URLs) go to image-worker.
- **IDOR:** edit/delete/preview upload-delete compare `author_discord_id` to the resolved identity; curated rows (`author_discord_id NULL`) are never owner-editable; `/mine`, `/rate-limit`, `/votes/:id/check`, `refresh-author` are scoped to the caller; all `/moderation/*` routes call `requireModerator`.
- **Bot identity spoofing from outside:** requires `BOT_API_SECRET` **and** a fresh HMAC with `BOT_SIGNING_SECRET`; constant-time bearer compare; `BOT_SIGNING_SECRET` mandatory in production (env validation fails every request otherwise). JWT path ignores `X-User-*` headers.
- **JWT:** HS256 enforced (alg confusion rejected), signature via `crypto.subtle.verify`, `exp` and `sub` required, ≥32-byte secret enforced; no separate refresh-token type exists (oauth refreshes the same token with a grace period), so the unused `type` claim is not a confusion vector.
- **CORS:** origin callback returns the request origin only on exact match against `CORS_ORIGIN` + `ADDITIONAL_CORS_ORIGINS` (production) or four loopback origins (development only, FINDING-002 fix verified); `null` otherwise → Hono sets no ACAO; `Vary: Origin` is set on preflight and appended on responses (Hono 4.13.1 source read); preflight (204) is answered before rate-limit/auth; `allowHeaders` limited to `Content-Type, Authorization`.
- **R2 key traversal/overwrite:** key is `${presetId}/${randomUUID()}.webp` where `presetId` must match an existing row (`getPresetImageState`) and rows are created with `crypto.randomUUID()` (app and seed script); R2 keys are opaque; the old key is captured before the UPDATE so a replace can never delete the new object.
- **Image content:** magic-byte sniff (PNG/JPEG/WebP with RIFF+WEBP check) + full re-encode to WebP by image-worker, so polyglots/EXIF never reach the bucket; unapproved images are never serialised by the API (`preview_image_url` only when `status==='approved'`, single gate in `rowToPreset`).
- **Error handling / logs:** production `onError` returns a generic message + request id only; dev exposes stack only when `ENVIRONMENT==='development'`; no tokens, secrets or JWTs are logged (logger logs method/path/UA; signature failures log booleans and path; `X-Request-ID` accepted only if UUID-shaped).
- **Vote/duplicate races:** `INSERT … ON CONFLICT DO NOTHING` + recount in one batch; UNIQUE partial index on `dye_signature` with 409 recovery on both submit and edit; post-insert daily recount with self-rollback; status updates conditional on observed status and batched with the log row (`changes()>0`).
- **Body limits:** 100 KB on `/api/*` via Hono `bodyLimit` (Content-Length or streamed count) with only `POST …/preview-image` exempt (method+path anchored regex); Content-Type gate for JSON mutations detects bodies from the stream (chunked-safe).
- **Timing:** bearer compare via SHA-256 digests then XOR fold; HMAC/JWT via WebCrypto verify.

## Positive controls verified

1. Dual-secret bot authentication with mandatory HMAC in production and constant-time comparison (`auth.ts:110-121, 154-206`; `env-validation.ts:86-90`).
2. JWT identity resolution to the Discord snowflake with UUID fallback, moderator check on the resolved id (`auth.ts:59-65, 218-226`).
3. Every moderation route guarded by `requireModerator`; every mutating preset/vote route guarded by `requireAuth` + `requireUserContext`; ownership enforced on edit/delete/preview (`handlers/*`).
4. Parameterised SQL everywhere; LIKE escaping; whitelisted sort; clamped pagination (`preset-service.ts`, `handlers/presets.ts:96-113`).
5. Prototype-pollution and depth guard on JSON bodies; 100 KB body cap; JSON Content-Type gate (`middleware/body-validation.ts`, `index.ts:153-204`).
6. Strict CORS allowlist with environment-gated loopback origins, `Vary: Origin`, preflight before auth (`index.ts:94-147`).
7. Security headers (`nosniff`, `X-Frame-Options: DENY`, HSTS in prod) (`index.ts:80-91`).
8. Non-approved presets hidden from listing/detail for non-privileged callers; audit snapshot stripped (`handlers/presets.ts:71-79, 93-101, 494-506`).
9. Preview image: magic-byte sniff, 5 MB cap, re-encode via image-worker, single-use UUID keys, DB-before-R2 ordering, approved-only URL gate (`preview-image-service.ts`, `preset-service.ts:116-126`).
10. Atomic D1 batches for vote/counter, delete, status+log, revert+log; optimistic concurrency on moderation status (`votes.ts`, `moderation.ts`, `preset-service.ts:376-390`).
11. Generic production error responses with request id; structured logging without secrets (`index.ts:257-283`).
12. Notification fan-out authenticated to discord-worker with `INTERNAL_WEBHOOK_SECRET`, retried with backoff, dead-lettered on failure (`notification-service.ts`).
13. `example_link` allowlist (https + host suffix match, never fetched) (`validation-service.ts:379-443`).
14. Wrangler: production config isolated under `[env.production]`; secrets via `wrangler secret` only; no secrets in repo.

## Coverage — files read in full

`apps/presets-api`: `src/index.ts`, `src/types.ts`, `src/handlers/presets.ts`, `src/handlers/votes.ts`, `src/handlers/categories.ts`, `src/handlers/moderation.ts`, `src/middleware/auth.ts`, `src/middleware/ban-check.ts`, `src/middleware/body-validation.ts`, `src/middleware/rate-limit.ts`, `src/services/preset-service.ts`, `src/services/moderation-service.ts`, `src/services/validation-service.ts`, `src/services/notification-service.ts`, `src/services/preview-image-service.ts`, `src/services/rate-limit-service.ts`, `src/services/category-service.ts`, `src/utils/api-response.ts`, `src/utils/env-validation.ts`, `src/data/profanity/index.ts`, `src/data/profanity/en.ts` (other locale lists are 15-line string arrays, spot-checked), `wrangler.toml`, `schema.sql`, `migrations/0002…0010` + `002_add_composite_indexes.sql`, `package.json`, `CLAUDE.md`; `scripts/migrate-presets.ts` (id generation only).
`packages/auth/src`: `index.ts`, `jwt.ts`, `hmac.ts`, `timing.ts`, `revocation.ts` (non-test).
`packages/worker-kit/src`: `middleware/rate-limit.ts`, `middleware/logger.ts`, `middleware/request-id.ts`, `rate-limiter/ip.ts`, `rate-limiter/backends/memory.ts`, `rate-limiter/presets/configs.ts` (+ `index.ts`/`types.ts` skimmed).
`packages/types/src/auth/provider.ts` (AuthContext).
Peers (trust-boundary only): `apps/discord-worker/src/services/preset-api.ts`, `apps/discord-worker/src/index.ts:160-400` (webhook), `apps/discord-worker/src/utils/sanitize.ts`, `apps/moderation-worker/src/services/preset-api.ts`, `apps/moderation-worker/src/services/ban-service.ts` (ban/hide SQL), `apps/image-worker/src/index.ts`, `apps/image-worker/src/validators.ts`, `apps/image-worker/src/photon.ts:77-122, 273-297`, `apps/image-worker/wrangler.toml`, `apps/oauth/src/services/jwt-service.ts:90-150`, `apps/oauth/src/handlers/refresh.ts` (head + revocation calls), `apps/web-app/src/services/auth-service.ts` + `community-preset-service.ts` + `preset-submission-service.ts` (fetch/credentials grep only).
Runtime libs: `node_modules/hono/dist/middleware/cors/index.js`, `node_modules/hono/dist/middleware/body-limit/index.js` (Hono 4.13.1).
Not reviewed: `apps/presets-api/tests/**` (out of scope per brief), `coverage/`, `.wrangler/`.
