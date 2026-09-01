# Review — `apps/discord-worker` (+ `packages/bot-logic/src`) — 2026-08-29 whole-monorepo security audit

- **Commit:** `4c213248` (`main` = branch `security-audit-2026-08-29`), discord-worker 5.0.1, bot-logic 3.0.0, auth 1.4.0, worker-kit 1.1.0
- **Reviewer:** discord-worker unit reviewer (read-only; this file is the only write)
- **Method:** delta `b195723f..HEAD` read commit-by-commit (`git log`: 41 commits touching the unit — Tier A analytics PR #150, chara-name privacy PR #151, `/changelog` bundling, stainID rewrite, static fonts, merge-day fixes), then every non-test source file under `src/`, `scripts/`, `wrangler.toml`, `PRIVACY_POLICY.md`, `CHANGELOG-laymans.md` and `packages/bot-logic/src` read in full; tests grep-verified for each previous-audit fix; call paths traced into `packages/auth`, `packages/worker-kit`, `packages/logger`, `packages/core` (chara parser), `packages/svg` (swatch card), `apps/presets-api` (auth middleware, webhook payload), `apps/image-worker` (`/extract` contract), `apps/api-worker` (proxy error text).
- **Checklist rows applied:** Every Worker (Hono) · Discord bots · Personal data (primary PII surface).

## Executive summary

No CRITICAL or HIGH. All eight previous-audit fixes touching this unit (FINDING-003/014/019/020/021/022/023/033) are real and guarded by tests, with two residuals now due: FINDING-033's world validation is bypassable through the stored preference (DW-04), and FINDING-014's v1 signature is still emitted and still accepted after the rollover condition was met (DW-07). The Tier A analytics datapoint reconciles field-for-field against `PRIVACY_POLICY.md` §2 — no option value, guild/channel id, message, error text, IP, UA or request id reaches Analytics Engine, and the `.chara` character name is type-erased before it can reach a card, embed, log or datapoint. The material findings are policy-vs-implementation gaps on personal data: production rate-limit counters keyed by Discord user id live in **Upstash Redis**, a processor the policy neither names nor describes (DW-01); a permanent per-user `firstrun:v5:{userId}` KV flag is undisclosed and un-expiring (DW-02); and the policy still points users at deletion commands that were removed in 5.0 (DW-08). Two LOW resource/abuse items (DW-05, DW-06) and one LOW log-hygiene item (DW-03) complete the list.

| ID | Sev | Exposure | Title |
|---|---|---|---|
| DW-01 | MEDIUM | INTERNET-AUTH | Rate-limit counters keyed by Discord user id are stored in Upstash Redis; policy says "Cloudflare KV" and never lists Upstash as a processor |
| DW-02 | MEDIUM | INTERNET-AUTH | `firstrun:v5:{userId}` — permanent per-user KV record not in the policy, no TTL (promotes DW-17) |
| DW-03 | LOW | INTERNET-AUTH | Option values / user free text in structured logs (`world`, preference `value`, preset name) |
| DW-04 | LOW | INTERNET-AUTH | FINDING-033 residual: `/preferences set world:` stores any string (no length cap) and `/budget` uses it unvalidated |
| DW-05 | LOW | INTERNET-AUTH | Limiter-exempt `/about`/`/manual`/`/changelog` still cost 3 KV counter writes + KV reads per call; their configured 30/min tiers are dead code |
| DW-06 | LOW | INTERNET-AUTH (HMAC) | GitHub webhook: repository not pinned, no `X-GitHub-Event` allowlist, `html_url` becomes an announcement link — route is now live in production (promotes DW-12) |
| DW-07 | LOW | INTERNAL | FINDING-014 residual: v1 `X-Request-Signature` still sent by the bot and still accepted by presets-api when v2 is absent — rollover gate already met |
| DW-08 | LOW | INTERNET-AUTH | `PRIVACY_POLICY.md` describes retired features (`/favorites`, `/collection`, `/match_image`) as the access/deletion controls and mis-describes the live per-user KV records |

INFO carry-overs (DW-13/14/15/18/19/21, not promoted) are listed after the candidates.

## Route / command table + authz matrix

### HTTP routes (`src/index.ts`)

| Route | Verification / auth (file:line) | Who can reach it | Size cap | Writes / side effects |
|---|---|---|---|---|
| `OPTIONS *` | `hono/cors` exact origins `https://xivdyetools.app`, `https://www.xivdyetools.app`, methods GET/POST/OPTIONS (`index.ts:125-131`) | anyone | — | none |
| `GET /health` | none (`index.ts:182-188`) | anyone | — | none |
| `POST /` | **Ed25519** over the raw body via `verifyDiscordRequest` (`index.ts:551`; `packages/auth/src/discord.ts:70-143`): Content-Length pre-check ≤100 000 B, both signature headers required, **timestamp window −300 s/+60 s checked before the body is read** (`discord.ts:99-110`), byte-accurate body cap, `verifyKey`; same raw string then `JSON.parse`d (`index.ts:563`) | Discord (or holder of the app's private key) | 100 KB | dispatch below |
| `POST /webhooks/preset-submission` | `Authorization: Bearer <INTERNAL_WEBHOOK_SECRET>` via `timingSafeEqual`; 401 when the secret is unset (`index.ts:202-217`); Content-Length ≤10 KB, header only (`:220-225`) | presets-api over `DISCORD_WORKER` service binding; anyone on `bot.xivdyetools.app` holding the secret | 10 KB (header) | Discord `sendMessage` to `MODERATION_CHANNEL_ID` / `SUBMISSION_LOG_CHANNEL_ID`; logs `presetName` (DW-03) |
| `POST /webhooks/github` | `X-Hub-Signature-256` HMAC-SHA256, constant-time (`utils/github-verify.ts:35-83`); 401 when `GITHUB_WEBHOOK_SECRET` unset, 500 when `ANNOUNCEMENT_CHANNEL_ID` unset (`index.ts:435-443`); Content-Length **and** post-read cap 1 MiB (`:93, 446-461`); only `refs/heads/main` + a commit touching `CHANGELOG-laymans.md` proceeds (`:481-498`) | GitHub / secret holder | 1 MiB | `fetch` `raw.githubusercontent.com/<full_name>/main/CHANGELOG-laymans.md` (10 s timeout); `sendMessage` to `ANNOUNCEMENT_CHANNEL_ID` (DW-06) |
| anything else | Hono 404; `app.onError` → shaped `{error:'Internal Server Error'}` 500, error logged with path only (`index.ts:1181-1189`) | — | — | — |

Middleware order: `cors` → `requestIdMiddleware` → `loggerMiddleware` (`readEnvironmentFromEnv:false`, `logUserAgent` default **false**, path only — `packages/worker-kit/src/middleware/logger.ts:104-160`) → per-request env validation (500 when `DISCORD_TOKEN`/`DISCORD_PUBLIC_KEY` missing, `index.ts:146-165`) → security headers (`nosniff`, `X-Frame-Options: DENY`, HSTS, `:169-177`) → handlers. Nothing consumes the body before `verifyDiscordRequest`.

### Interaction dispatch (all behind Ed25519; `userId` = `member.user.id ?? user.id` from the signed payload)

| Interaction | Gate / rate limit (per user, `ratelimit:user:{userId}:{scope}`) | Reads | Writes (KV / AE / presets-api / other) |
|---|---|---|---|
| `handleCommand` (`index.ts:643-822`) | `userId` required (`:653-658`) → **trace started** (`:668-679`) → limiter unless `about|manual|changelog` (`:686-706`, Upstash primary, KV fallback, fail-open) | prefs blob (`prefs:v1:{userId}`, legacy `i18n:user:`, `budget:world:v1:`) | `firstrun:v5:{userId}` get/put (`:609-638`); one AE datapoint + `stats:*`/`usertrack:` KV counters after the handler's `waitUntil` work drains (`command-trace.ts:167-247`); rate-limited → AE row only (`analytics.ts:253`) |
| `/about` | **no limiter** (configured `about` 30/min tier at `configs.ts:98` never consulted — DW-05) | prefs, `package.json` | KV counters + AE |
| `/manual [topic]` | **no limiter** | prefs; `UNIVERSALIS_PROXY` `/api/v2/worlds`, `/data-centers` (1 h isolate cache) for `spectrum_prices` | KV counters + AE; ephemeral |
| `/changelog [version]` | **no limiter**; ephemeral; `version` echoed sanitised ≤64 (`changelog.ts:82-88`) | bundled `CHANGELOG-laymans.md` (10 472 B) parsed per call, description cut at 4 000 | KV counters + AE |
| `/stats summary` | `default` 15/min (FINDING-033 ✓, `index.test.ts:800`) — public | `kv.list({prefix:'stats:'})` + paginated `usertrack:{today}:` walk (`analytics.ts:273-342`) | KV counters + AE |
| `/stats overview\|commands\|preferences\|health` | `STATS_AUTHORIZED_USERS` allowlist (`stats.ts:62-69, 96-109`), ephemeral | `preferences` panel reads ≤100 `prefs:v1:*` blobs (`stats.ts:375-407`) | KV counters + AE |
| `/harmony`, `/gradient`, `/mixer`, `/comparison`, `/contrast`, `/swatch` | 15/min each (`configs.ts:86-91`) | prefs; `/swatch` fetches `resolved.attachments[file].url` — HTTPS + `cdn.discordapp.com`/`media.discordapp.net` allowlist, `redirect:'manual'`, 10 s, Content-Length + streamed 1 MiB cap (`swatch.ts:47-50, 69-120, 143-153, 186-218`) | deferred PNG edit via Discord REST |
| `/accessibility` = `/a11y` | one shared bucket 10/min (`rate-limiter.ts:103-105, 118-127`) | prefs | deferred PNG |
| `/dye search\|info\|list\|random` | 20/min; public embeds, query sanitised ≤100 (`dye.ts:117`) | — | `info`/`random` deferred PNG; text fallbacks marked `render`+`served` |
| `/extractor color` / `/extractor image` | 15/min / **5/min** (`extractor:image`, `configs.ts:75-76`) | `image`: `IMAGE_WORKER` `POST /extract` `{url}` (attachment URL from `resolved.attachments`; 10 s; `image-client.ts:39-80`) | deferred PNG |
| `/preferences show\|set\|reset\|filters set\|show\|reset` | 20/min; **ephemeral** | prefs | `prefs:v1:{userId}` put/delete (`services/preferences.ts:142-276`, `handlers/commands/preferences.ts:655-659, 721-727`) |
| `/preset list\|show\|random` | 10/min; public | presets-api `GET /api/v1/presets[?search=…]`, `/presets/{uuid}` — UUID gate + `encodeURIComponent`, typed names go to `?search=` (`preset.ts:952-957`, `preset-api.ts:266, 276`) | deferred embed + PNG |
| `/preset submit\|edit\|vote` | 10/min | presets-api `POST /presets`, `PATCH /presets/{uuid}`, `GET /votes/{uuid}/check`, `POST\|DELETE /votes/{uuid}` with `X-User-Discord-ID` (+ `X-User-Discord-Name` = `global_name ?? username` on submit/edit) + bearer + **v1 and v2** signatures (`preset-api.ts:121-166`) | presets-api D1 writes (authorised there); moderation/submission-log embeds |
| `/preset favorite add\|remove\|list` | 10/min; **ephemeral** | presets-api `GET /presets/{uuid}` or `?search=` | `xivdye:preset_favorites:v1\|v2:{userId}` (`preset-favorites.ts:105-121`) |
| `/budget find\|quick` | 10/min | prefs (`world`); `UNIVERSALIS_PROXY` `GET /api/v2/aggregated/{encodeURIComponent(world)}/{ids}` (`universalis-client.ts:214-224`); Cache API price entries (`price-cache.ts:40-42`) | Cache API puts; deferred PNG |
| `/budget set_world` | 10/min; `validateWorld()` (`budget.ts:411-441`) | proxy worlds/DCs | `prefs:v1:{userId}.world` |
| Autocomplete (`index.ts:827-970`) | 60/min + 10 burst, fail-soft `[]` (`:838-855`) | dye names (local); `/preset` → presets-api `?search=` (approved), `/presets/mine` (own; `X-User-Discord-ID`), favourites (KV; lazy v1→v2 migration writes); clans (local); worlds (proxy, cached) | `xivdye:preset_favorites:*` (migration only) |
| Component `copy_hex_\|copy_rgb_\|copy_hsv_*` | **no limiter**; anyone who can see the message; ephemeral self-echo of the bot-authored `custom_id` (`copy.ts:34-113`) | — | AE `kind=button` row **before** the handler, no KV (`index.ts:1126-1132`, `command-trace.ts:184-207`) |
| Component `previewimg_approve_\|reject_{uuid}` | `isValidPresetId` **then** `MODERATOR_IDS` (snowflake-validated `isModeratorId`) before any API call (`preview-image.ts:126-137`); presets-api `requireModerator` re-checks | — | presets-api `PATCH /moderation/{uuid}/preview-image` signed as the clicking moderator; `editMessage` on the moderation post |
| Unknown button / any modal / select menu | static ephemeral error (`buttons/index.ts:94-98`, `index.ts:1135-1138, 1159-1171`) | — | none |

### Personal-data reconciliation (Analytics Engine, `analytics.ts:88-106`, one row per command or copy click)

| Column | Value written | Source | Policy §2 "Usage Analytics" | Status |
|---|---|---|---|---|
| `index1`, `blob1` | command name (`extractor_image`/`extractor_color`; `a11y` as typed; `button`) | `trackedCommandName` (`command-trace.ts:335-343`) | "Command name and subcommand" | ✓ |
| `blob2` | Discord user id | signed payload | "your Discord User ID (used only to count unique users)" | ✓ |
| `blob3` | `'guild'` \| `'dm'` — **never the id** (`analytics.ts:93-94`; test `analytics.test.ts:132-146`) | `interaction.guild_id` presence | "whether it ran in a server or a DM — never the server's ID" | ✓ FINDING-022 holds |
| `blob4`, `double1` | answered `1/0` | trace | "whether it was answered" | ✓ |
| `blob5` | `ok\|rejected\|rate_limited\|upstream_universalis\|upstream_presets\|image_input\|render\|unknown` — enum only (`analytics.ts:25-33`); the error **message** is never written (`classifyError`, `command-trace.ts:295-312`) | classifier | the seven listed classes, "never an error message" | ✓ |
| `blob6` | subcommand name from a Discord-**typed** `SUB_COMMAND`/`SUB_COMMAND_GROUP` option (`command-trace.ts:325-332`) or copy-button **kind** prefix only (`buttonKindOf`, `:346-348`) | option structure | "and subcommand", "which copy button you pressed (hex / RGB / HSV)" | ✓ never an option value |
| `blob7` | `en\|ja\|de\|fr\|ko\|zh\|other` (`bucketLocale`, `:315-317`; `discordLocaleToLocaleCode` maps 8 tags, else `other`) | `interaction.locale` | "Discord client language (one of the six the Bot supports, or 'other')" | ✓ not the full tag |
| `blob8` | `command` \| `button` | — | implied by "for each command you run or copy button you press" | ✓ |
| `double2` | latency ms (dispatcher start → drain) | trace | "how long it took" | ✓ |
| `double3` | `1` | — | — | ✓ |
| absent | IP, UA, request id, username, guild/channel id, option values, hex, world, file names, `.chara` `TypeName`/`Nickname`, message text | — | "never include message content, command option values, server names or channel IDs" | ✓ |

Gating: no datapoint for an unsigned request (401 before dispatch), for an interaction with no `userId` (`index.ts:653-658` returns before `startCommandTrace`), or with no command name (`:668-669`; test `index.test.ts:1657`). A **rate-limited** request writes exactly one AE row (`rate_limited`) and touches no KV (`analytics.ts:251-253`; tests `analytics.test.ts:381-384`, `index.test.ts:1626-1638`). The drain deadline writes `unknown`, never the pending error (`command-trace.ts:232-247`).

### KV / Cache / third-party inventory vs policy

| Store | Key → value | TTL | Policy row | Status |
|---|---|---|---|---|
| KV | `prefs:v1:{userId}` → language, blending, matching, count, clan, gender, world, market, show*, theme, dyeFilters, updatedAt (`types/preferences.ts:58-112`) | none | §5 "Preferences" (§4 says "User ID, Locale" only) | ✓ (under-described, DW-08) |
| KV | `i18n:user:{userId}`, `budget:world:v1:{userId}` — legacy, read-only migration (`services/preferences.ts:428-481`) | none | "Preferences" | ✓ |
| KV | `xivdye:preset_favorites:v1:{userId}` → uuid[]; `…:v2:{userId}` → `{id,name}[]` ≤50 (`preset-favorites.ts:21-34`) | none | §2 says "Favorite Dyes … up to 20 favorite dye IDs" | ✗ misdescribed (DW-08) |
| KV | `firstrun:v5:{userId}` → `'1'` (`index.ts:615-619`) | **none** | — | ✗ undisclosed (DW-02) |
| KV | `stats:total\|success\|failure\|cmd:{name}` → count (+metadata) (`analytics.ts:166-192`) | 30 d | ✓ §2 | ✓ |
| KV | `usertrack:{YYYY-MM-DD}:{userId}` → `'1'` (`analytics.ts:218-230`) | 30 d | ✓ §2 | ✓ |
| **Upstash Redis** (production primary) / KV (fallback) | `ratelimit:user:{userId}:{command[:sub]}` → counter (`rate-limiter.ts:40, 184-185`; `worker-kit …/backends/upstash.ts:72-77, 154`) | window (60 s +) | §2 "stored in Cloudflare KV", §6 lists no Upstash | ✗ (DW-01) |
| Cache API | `https://cache.xivdyetools.internal/prices/v1/{world}/{itemId}` → price data (no user data) | 15 min | n/a | ✓ |
| Third-party bodies | Discord REST (embeds/PNG, `allowed_mentions: {parse: []}`); presets-api (user id, display name, preset text — first-party); api-worker/Universalis (world + item ids only); image-worker (attachment URL — carries Discord channel id + attachment filename, **not logged here**; cross-ref image-worker reviewer for its own logging); GitHub raw (nothing) | | §6 Discord, Cloudflare, Universalis, Perspective | ✓ except Upstash |

### Structured-log inventory (`pii-sinks.txt` reconciled; Workers Logs persistence is **not** enabled — no `[observability]` in `wrangler.toml`, so these reach `wrangler tail` only unless enabled in the dashboard)

Pseudonymous ids at info: `index.ts:660, 700` (`userId`), `preferences.ts:465-468` (`userId`, pref key names), `preset-favorites.ts:96-99, 160-163, 189-192` (`userId`, `presetId`) — INFO (DW-18). Option values / free text: `budget.ts:247` (`world`), `services/preferences.ts:218-221` (`value` of any preference on the error path), `index.ts:308-312` (`presetName`) — DW-03. Never logged: usernames, `interaction.member`/`user` objects, guild names, attachment URLs/filenames, `.chara` content (`swatch.ts:238` logs the enum `result.error` only), Discord bodies beyond status/body of a failed edit (`discord-api.ts:270`). `customId` at info (`index.ts:1123`, `buttons/index.ts:65, 96`) is bot-authored.

## Candidates

### DW-01 — Rate-limit counters keyed by Discord user id are stored in Upstash Redis, an undisclosed third-party processor; the policy says "Cloudflare KV"

- **Severity:** MEDIUM · **Exposure:** INTERNET-AUTH (every command by every user) · **Rotation:** none
- **CWE:** CWE-359 (policy/implementation mismatch on personal data), CWE-200
- **Where:**
  - `apps/discord-worker/src/services/rate-limiter.ts:40, 73-80, 184-185`
    ```ts
    const KEY_PREFIX = 'ratelimit:user:';
    …
      if (config.upstashUrl && config.upstashToken) {
        limiterInstance = new UpstashRateLimiter({ url: config.upstashUrl, token: config.upstashToken, keyPrefix: KEY_PREFIX });
    …
      const scope = subcommand && commandName ? `${commandName}:${subcommand}` : commandName;
      const key = scope ? `${userId}:${scope}` : `${userId}:global`;
    ```
  - `packages/worker-kit/src/rate-limiter/backends/upstash.ts:72-77, 154` — `pipeline.incr(redisKey)` on `` `${this.keyPrefix}${key}` `` → Redis key `ratelimit:user:<snowflake>:<command>` persisted in Upstash for the window.
  - `apps/discord-worker/PRIVACY_POLICY.md:31-34` — "Rate Limiting Data — Per-user, per-command counters stored in **Cloudflare KV** … Retention: 70 seconds"; `:101-110` — third parties listed: Discord, Cloudflare, Universalis, Perspective (no Upstash). `docs/operations/POST_MERGE_CHECKLIST.md:66-69, 82-83` confirms `UPSTASH_REDIS_REST_URL/TOKEN` are set on the **production** worker and that Upstash is the design.
- **Trigger:** any slash command or autocomplete keystroke from any user → one Upstash `INCR` carrying the user's Discord id in the key.
- **Impact:** the Discord user id (the one personal field the policy governs) and the command they ran are transmitted to and held by a processor the policy does not name, in a location it misstates; Upstash's region/retention/sub-processors are not disclosed. Pseudonymous and short-lived, but the promise is wrong on its face and the audit rule treats an undisclosed personal-data flow as MEDIUM.
- **Fix:** either (a) disclose — §2 row "stored in Upstash Redis (primary) / Cloudflare KV (fallback), key = user id + command, expires with the window", §6 row for Upstash, Inc.; or (b) stop sending the raw id — key the limiter on `HMAC-SHA256(BOT_SIGNING_SECRET-derived salt, userId)` truncated (keeps atomic per-user limiting, removes the snowflake from the third party; the KV fallback and `/stats` are unaffected). Add a test that the Upstash key never contains the raw snowflake if (b).

### DW-02 — `firstrun:v5:{userId}` is a permanent per-user KV record the policy does not disclose (promotes DW-17)

- **Severity:** MEDIUM (audit rule: field keyed by the personal id, absent from the policy) · **Exposure:** INTERNET-AUTH · **Rotation:** none
- **CWE:** CWE-359, CWE-770 (unbounded growth)
- **Where:** `apps/discord-worker/src/index.ts:609-622`
  ```ts
  const flagKey = `firstrun:v5:${userId}`;
  const seen = await env.KV.get(flagKey);
  if (seen) return;
  // Flag before sending — a failed send must never become a repeat notice
  await env.KV.put(flagKey, '1');
  const prefs = await env.KV.get(`prefs:v1:${userId}`);
  if (prefs) return; // existing user — suppressed by decision
  ```
  Runs on **every** command via `ctx.waitUntil` (`index.ts:711-715`), including limiter-exempt ones. No `expirationTtl`; not in `PRIVACY_POLICY.md` §2/§5/§8 (KV row lists "Favorites, Collections, Preferences, Rate limits, usage counters and daily-activity keys"). No test references `firstrun` (`index.test.ts` grep: none).
- **Trigger:** first command by any user.
- **Impact:** one undisclosed, never-expiring record per Discord account that has ever used the bot ("this user has run a command since 5.0"), outside the deletion story (§7 gives email as the only channel and does not know about this key). Harmless content, but exactly the class the Personal-data row flags.
- **Fix:** `expirationTtl: 365 * 86400` (product behaviour preserved), add a policy row (or fold the flag into the disclosed `prefs:v1:{userId}` blob as `firstRunSeen: true`), and assert the TTL in `index.test.ts`.

### DW-03 — Option values and user free text reach structured logs

- **Severity:** LOW · **Exposure:** INTERNET-AUTH · **Rotation:** none
- **CWE:** CWE-532
- **Where:**
  - `apps/discord-worker/src/handlers/commands/budget.ts:247` — `logger.info('Budget: building ledger', { targetDyeId, world })` on every `/budget find|quick` (`world` = the user's chosen game server, from the option or the stored preference; the same request already logs `userId` at `index.ts:660`, so the two are joinable by request id).
  - `apps/discord-worker/src/services/preferences.ts:218-221` — `logger.error('Failed to set preference', …, { key, value })` — `value` is the raw option value for any preference (world, clan, …) on the error path.
  - `apps/discord-worker/src/index.ts:308-312` — `logger.info('Received preset webhook', { presetName: preset.name, presetId, source })` — user-authored preset name (unsanitised free text) on every submission webhook.
- **Trigger:** normal use (first and third at info level).
- **Impact:** the policy's "never option values" promise is made for analytics records, not logs, and Workers Logs persistence is off (`wrangler.toml` has no `[observability]`), so today this is visible only in `wrangler tail`; enabling Workers Logs (one dashboard toggle) would make it a 7-day-retained store of world + user id pairs and preset text. Cheap to fix now.
- **Fix:** log `hasWorld: true` / `worldSource: 'option'|'pref'` instead of the name; log `{ key }` only (or `valueType`) in `setPreference`; log `presetId` + `source` only in the webhook. Leave DW-18 (ids at info) as INFO unless Workers Logs is enabled.

### DW-04 — FINDING-033 residual: `/preferences set world:` accepts any string (no length cap) and `/budget` forwards the stored value unvalidated

- **Severity:** LOW · **Exposure:** INTERNET-AUTH · **Rotation:** none · **Cross-link:** FINDING-033 (its Status line lists "`/preferences set world:` validation" as *not done*)
- **CWE:** CWE-20
- **Where:**
  - `apps/discord-worker/src/services/preferences.ts:374-380`
    ```ts
    case 'world':
      if (typeof value !== 'string' || value.length === 0) {
        return { valid: false, reason: 'invalidWorld' };
      }
      // Note: Full world validation would require a list of valid FFXIV worlds
      // For now, we accept any non-empty string
    ```
  - `apps/discord-worker/src/commands/schemas.ts:656-662` — the `preferences set world` option has no `max_length` (Discord default 6 000); same for `budget find|quick|set_world world` (`:1186-1192, 1234-1240, 1263-1269`).
  - `apps/discord-worker/src/handlers/commands/budget.ts:129-139` — `resolveWorld`: an override is validated, but `return prefs.world || undefined;` is not; `budget.test.ts:145` pins this ("uses the stored preference without validating when no override is given"). The legacy `budget:world:v1:` migration (`services/preferences.ts:444-456`) imports whatever was stored too.
  - Sinks: `services/budget/universalis-client.ts:222` (`/api/v2/aggregated/${encodeURIComponent(world)}/…` → api-worker → Universalis), `services/budget/price-cache.ts:40-42` (`world.toLowerCase()` in the shared Cache API key).
- **Trigger:** `/preferences set world:<up to 6 000 arbitrary chars>` then `/budget find target_dye:Jet Black` (no `world:`).
- **Impact:** the exact DW-9 path FINDING-033 closed for the override reopens through the preference: arbitrary strings reach the Universalis proxy on every ledger (proxy load / 404s, `budget.errors.apiError` for the user), pollute the Cache API key space under the user's own string, and the 6 000-char value is echoed back to the user in `/preferences show` (`String(value)`, ephemeral, unsanitised). No injection (percent-encoded), no cross-user effect.
- **Fix:** in `handleSetSubcommand` route `world` through `validateWorld()` exactly like `/budget set_world` does (`budget.ts:425-431`), or validate in `resolveWorld` for the stored value; add `max_length: 32` to the four `world` options; flip the `budget.test.ts:145` assertion.

### DW-05 — Limiter-exempt utility commands still cost KV writes per call; the configured `about`/`manual` tiers are dead code

- **Severity:** LOW · **Exposure:** INTERNET-AUTH · **Rotation:** none
- **CWE:** CWE-770
- **Where:**
  - `apps/discord-worker/src/index.ts:686` — `if (commandName && !['about', 'manual', 'changelog'].includes(commandName))` skips `checkRateLimit`.
  - `packages/worker-kit/src/rate-limiter/presets/configs.ts:98-99` — `about: { maxRequests: 30 … }`, `manual: { maxRequests: 30 … }` — never reached.
  - Per exempt call: `maybeSendFirstRunNotice` KV get (`index.ts:616`), `createUserTranslator` 1–2 KV gets (`services/i18n.ts:104-121`), then `trackCommandWithKV` → three `incrementCounter` read-modify-write puts on the shared hot keys `stats:total`, `stats:cmd:<name>`, `stats:success` plus `usertrack` get/put (`services/analytics.ts:256-263, 166-192`). The Tier A amendment made *rate-limited* requests AE-only precisely because "each KV counter is a read-modify-write on a shared hot key … capped at one write per second — routing rejected spam through them would 429 the writes, burn the daily KV write budget" (`analytics.ts:236-242`) — but the three exempt commands are not rate-limited and go through the full KV path.
- **Trigger:** one user scripting `/about` (Discord's own per-user interaction ceiling is far above KV's 1 write/s/key).
- **Impact:** hot-key `put` failures (lost counters, `Analytics tracking failed` error logs from `command-trace.ts:227`), KV write-budget consumption, and a public `/stats summary` total/success rate that one user can inflate at will. Availability/cost, not confidentiality.
- **Fix:** delete the skip list (the three commands then get their configured 30/min tiers, `default` for `changelog`), or route exempt commands through the AE-only path like `rate_limited`. Update `apps/discord-worker/CLAUDE.md` ("skipped only for about, manual and changelog") accordingly.

### DW-06 — GitHub release webhook: repository not pinned, no event allowlist, payload URL becomes an announcement link (promotes DW-12 — route is now live)

- **Severity:** LOW · **Exposure:** INTERNET-AUTH (HMAC-gated) · **Rotation:** `GITHUB_WEBHOOK_SECRET` only if a leak is suspected
- **CWE:** CWE-20 / CWE-918 (host-bounded) / CWE-451
- **Where:** `apps/discord-worker/src/index.ts:481-535`
  ```ts
  if (payload.ref !== 'refs/heads/main') { … }
  const changelogModified = payload.commits.some(touchesChangelog) || touchesChangelog(payload.head_commit);
  …
  const changelogUrl = `https://raw.githubusercontent.com/${payload.repository.full_name}/main/CHANGELOG-laymans.md`;
  const changelogResponse = await fetch(changelogUrl, { signal: AbortSignal.timeout(10_000) });
  …
  await sendAnnouncement(env.DISCORD_TOKEN, env.ANNOUNCEMENT_CHANNEL_ID, latestEntry, payload.repository.html_url);
  ```
  `services/announcements.ts:57-70` renders `html_url` as a masked link (`[full release notes](${repoUrl}/blob/main/CHANGELOG-laymans.md)`) and in the footer. No `X-GitHub-Event` header check anywhere in the route (`:430-536`); `payload.commits` is dereferenced unguarded (`:494`), so a signed non-push event that happens to carry `ref: 'refs/heads/main'` without `commits` becomes a logged 500. `utils/github-verify.ts:35-44` — no minimum secret length (documented DEAD-019 decision). What changed since 2026-08-21: the hook was wired to production on 2026-08-28 (`POST_MERGE_CHECKLIST.md:276-280`) and the cap rose from 10 KB to 1 MiB (`index.ts:93`); tests `index.test.ts:539-560` cover the cap, none cover the repository.
- **Trigger:** a holder of `GITHUB_WEBHOOK_SECRET` — or the same secret configured on a webhook of a fork — sends a push payload with `repository.full_name = attacker/repo`, `html_url = https://github.com/attacker/repo`.
- **Impact:** the production announcement channel posts an attacker-authored "🆕 XIV Dye Tools vX" embed whose body is the attacker's changelog file and whose "full release notes" link goes to the attacker's URL (`allowed_mentions` none, so no pings). Requires the secret; defence in depth for a secret whose only other guard is a length-free HMAC.
- **Fix:** `if (payload.repository?.full_name !== 'FlashGalatine/xivdyetools') return c.json({ success: true, message: 'Not the canonical repository' })` (the constant already exists in `handlers/commands/changelog.ts:40-41`); require `c.req.header('X-GitHub-Event') === 'push'`; build `repoUrl` from the pinned name, not the payload; guard `Array.isArray(payload.commits)`.

### DW-07 — FINDING-014 residual: v1 bot signature still emitted by the bot and still accepted by presets-api when the v2 header is absent — the rollover gate is already met

- **Severity:** LOW · **Exposure:** INTERNAL (needs a captured signed request from service-binding traffic or presets-api logs) · **Rotation:** none unless a capture is suspected · **Cross-link:** FINDING-014 ("v1 acceptance to be removed after both bots deploy"); `docs/operations/POST_MERGE_CHECKLIST.md:367` (§3 removal row, gate = both bots + presets-api on v2 code — deployed 2026-08-28)
- **CWE:** CWE-294, CWE-757 (algorithm downgrade)
- **Where:**
  - `apps/discord-worker/src/services/preset-api.ts:147-148`
    ```ts
    headers['X-Request-Timestamp'] = String(timestamp);
    headers['X-Request-Signature'] = signature; // v1 — kept during rollover
    ```
  - `apps/presets-api/src/middleware/auth.ts:228-239` — `else { isValidSignature = await verifyBotSignature(signature, timestamp, userDiscordId, userName, …) }` whenever `X-Request-Signature-V2` is **absent** (5-minute window, `ts:id:name` only, unbound to method/path/body).
  - `preset-api-v2.test.ts:59` still asserts the v1 header ("v1 during rollover").
- **Trigger:** replay a captured header set minus `X-Request-Signature-V2` against any presets-api route within 5 minutes.
- **Impact:** the downgrade path FINDING-014 was opened for still exists; every bot request continues to hand out a route-independent 5-minute credential. Nothing new is exposed, but the mitigation's second half is overdue.
- **Fix (two commits, order matters):** drop the v1 header from discord-worker and moderation-worker (`preset-api.ts:148`, flip the test), deploy; then delete the v1 branch in presets-api (`auth.ts:228-239`) and deprecate `verifyBotSignature` in `@xivdyetools/auth`.

### DW-08 — `PRIVACY_POLICY.md` describes retired features as the access/deletion controls and mis-describes the live per-user records

- **Severity:** LOW · **Exposure:** INTERNET-AUTH (every user relies on it) · **Rotation:** none
- **CWE:** CWE-359 (transparency), CWE-1059
- **Where:** `apps/discord-worker/PRIVACY_POLICY.md` ("Last Updated: August 29, 2026"):
  - `:26-27` — "Favorite Dyes … up to 20 favorite dye IDs", "Collections … up to 50 custom collections" — `/favorites` and `/collection` were deleted in 5.0 (`handlers/commands/about.ts:67 REMOVED_IN_V5`), their KV keys purged (`POST_MERGE_CHECKLIST.md:249-252`); the live record is **preset favourites** (`xivdye:preset_favorites:v2:{userId}`, ≤50 `{id,name}` entries, `services/preset-favorites.ts:21-34`), which the policy never names.
  - `:63` — "When you use `/match_image` …" — the command is `/extractor image`.
  - `:117-126` — "Use `/favorites` … `/collection list` … `/favorites remove` … `/collection delete`" as the self-service access/deletion controls — none exist; the only working channels are email/DM (`:132-135`). The real self-service controls (`/preset favorite remove`, `/preferences reset`, `/preset favorite list`, `/preferences show`) are not mentioned.
  - `:73-74` — "Save your preferences | User ID, Locale" while `prefs:v1:` also holds clan, gender, world, theme, matching, blending, count, display flags, dye filters (`types/preferences.ts:58-112`).
- **Trigger:** a user following §7 to exercise access/deletion.
- **Impact:** the published policy sends users to commands that answer "not implemented", and describes stores that no longer exist while omitting one that does. The Tier A analytics rows (PR #150) are accurate; the rest of the document was not re-read.
- **Fix:** rewrite §2 "Information You Provide" (Preset favourites ≤50, Preferences fields, Preset submissions, Votes), §3 image paragraph (`/extractor image`), §4 preferences row, §7 with the live commands; add the DW-02 row and the DW-01 correction in the same edit.

### INFO — carried forward from 2026-08-21, not promoted (verified still present, still not material)

| Old ID | Where (current lines) | Status |
|---|---|---|
| DW-13 | `index.ts:220-233` (Content-Length-only cap, then `c.req.json()`), `:267-269` (`preview_image_key` unvalidated into `https://shots.xivdyetools.app/…`), `:281, 288` (`preset.id` into `custom_id`; the click side refuses non-UUIDs, `preview-image.ts:129`) | INFO — authenticated caller (presets-api) only |
| DW-14 | `wrangler.toml:18-39` beta shares production `PRESETS_API`/`UNIVERSALIS_PROXY`/`IMAGE_WORKER`; `docs/operations/DEPLOY_ENVIRONMENTS.md:234-235` says the bot secrets "may be omitted" on beta rather than *must not be set*; presets-api keys service-binding callers on one `unknown` IP bucket (PAPI-8), so beta users share the production bot's presets-api limiter bucket | INFO — hinges on the beta app's install policy; tighten the doc wording |
| DW-15 | `rate-limiter.ts:187-214`, worker-kit `upstash.ts:97-107`, `kv.ts:161-173` fail-open; no `failOpen:false` on the `extractor:image` tier | accepted trade-off (`docs/architecture/security-trade-offs.md:87-133`) |
| DW-18 | user ids at info level — `index.ts:660, 700`, `preferences.ts:465-468`, `preset-favorites.ts:96-99, 160, 189` | INFO while Workers Logs is off (no `[observability]`); revisit with DW-03 if enabled |
| DW-19 | `handlers/buttons/copy.ts:36-39, 70, 104` — `custom_id` suffix echoed / `Number()`-parsed without validation | INFO — `custom_id`s are bot-authored and the reply is ephemeral |
| DW-21 | `handlers/commands/gradient.ts:38` (`|| 6`), `packages/bot-logic/src/commands/gradient.ts:144` loop — relies on `schemas.ts:361-362` `min_value:2/max_value:12` (Discord-enforced) | INFO |

## Positive controls (verified in the delta — do not re-file)

1. **Ed25519 + freshness before parsing** — `packages/auth/src/discord.ts:70-143` (Content-Length pre-check, both headers, −300 s/+60 s window checked *before* the body is read, byte-accurate 100 KB cap, `verifyKey`); consumer `index.ts:551-566`; tests `packages/auth/src/discord-freshness.test.ts:34-64` (stale, far-future, non-numeric, caller window). FINDING-021 ✓.
2. **Analytics allowlist** — every AE column is an enum, an id from the signed payload, or a number (table above); `'guild'|'dm'` context blob (`analytics.ts:93-94`, `analytics.test.ts:132-146`); locale bucketed (`command-trace.ts:315-317`, test `command-trace.test.ts:325-330`); subcommand only from Discord-typed options (`:325-332`); button rows carry the kind prefix only; rate-limited rows are AE-only (`analytics.ts:253`; `index.test.ts:1626-1638`); no row for unsigned / user-less / nameless interactions; drain deadline → `unknown`, never the message. `CommandEvent` doc comment is the never-list (`analytics.ts:38-42`). FINDING-022 ✓; AE retention "3 months" matches `docs/operations/ANALYTICS_QUERIES.md:10, 138`.
3. **`.chara` name privacy (PR #151)** — nickname removed at the type level (`SwatchCharacter = Omit<ResolvedCharaCharacter,'nickname'>`, `withoutNickname` at resolve time, `packages/bot-logic/src/commands/swatch.ts:80, 174-178, 225-230`); neutral localized title (`:219-221`, `card.swatchTitle` = "Character swatch"); `TypeName` reduced to an allowlisted producer token (`:187-197`); the parser reads `Nickname`/`TypeName` with `typeof` guards and never echoes them in errors (`packages/core/src/services/chara/chara-parser.ts:190-275, 404, 409`); the worker forwards only `attachment.url` — no filename — (`swatch.ts:155-167`, test `swatch.test.ts:220-222`); the svg card has no name option (`packages/svg/src/swatch-card.ts:72-73`, test `swatch-card.test.ts:167-186`); bot-logic tests assert the nickname fixture never reaches title/embed/result (`swatch.test.ts:120-151, 167-177`). Logs carry only the error enum (`swatch.ts:238`).
4. **Sanitiser + `allowed_mentions` everywhere (FINDING-019)** — one shared `sanitizeEmbedText` (`packages/bot-logic/src/discord-markdown.ts:37-71`: controls/zero-width/bidi stripped, `@everyone`/`@here`/`<@…>` defused, markdown + masked links escaped, capped) applied at every user-text embed sink: `/preset` list/show/submit-dup/edit-dup/favorites/submission-log (`preset.ts:240-243, 524, 833, 870, 977-980, 1065-1067, 1215, 1291`), webhook author/tags/name (`index.ts:253, 342, 363-366`), `/dye search` (`dye.ts:117`), `/swatch` public parse error (`swatch.ts:244`, ≤1 024), `/budget` echoes (`budget.ts:193, 204, 429, 470, 478`), `/changelog version` (`changelog.ts:86`); `allowed_mentions: {parse: []}` on all four REST helpers incl. multipart `payload_json` (`utils/discord-api.ts:31-33, 84, 108, 173, 196, 313, 347`; 15 assertions in `discord-api.test.ts`); tests `preset.test.ts:1802-1925`, `dye.test.ts:706-742`, `sanitize.test.ts:164-205`, `discord-markdown.test.ts`.
5. **Path encoding + UUID gate (FINDING-020)** — `encodeURIComponent` on all six presets-api id segments (`preset-api.ts:276, 380, 399, 412, 430, 472`); `isValidPresetId` UUID-v4 regex (`types/preset.ts:149-160`); non-UUID input is a NAME → `?search=` (`preset.ts:952-957, 633-635`); preview buttons refuse non-UUIDs before authz (`preview-image.ts:129`); test `preset-api.test.ts:760-778` (`../moderation/pending?x=1#frag` never reaches the path).
6. **Bot→presets-api v2 signature (FINDING-014, sender side)** — method + path + body-hash + timestamp + nonce + identity, 60 s window (`preset-api.ts:150-165`, `packages/auth/src/hmac.ts:326-381`), same serialised bytes signed and sent (`:134`); `BOT_SIGNING_SECRET` ≥32 chars enforced (`utils/env-validation.ts:63-71`); 10 s `AbortSignal.timeout` on every presets-api and image-worker call (`preset-api.ts:174`, `image-client.ts:26, 58`); tests `preset-api-v2.test.ts`.
7. **`/swatch` download hardening (FINDING-033)** — HTTPS + Discord-CDN host allowlist, `redirect:'manual'` (workerd rejects `'error'`), 10 s timeout, Content-Length pre-check + streamed 1 MiB cap not trusting Discord's `size` (`swatch.ts:47-50, 69-120, 143-153, 186-218`); tests `swatch.test.ts:137-210`. `/stats` under the per-user limiter (`index.ts:684-686`; `index.test.ts:800`). `/budget` override validated (`budget.ts:129-139`; `budget.test.ts:68-170`). Links from core `PRODUCT_LINKS`/`XIVDYETOOLS_DOCS_URL`/`SOCIAL_LINKS` (FINDING-023; `stats.ts:48-53`; `stats.test.ts:386-390`).
8. **Authorization** — `MODERATOR_IDS` via snowflake-validated `isModeratorId` on the preview buttons before any API call (`preview-image.ts:129-137`; presets-api re-checks); `STATS_AUTHORIZED_USERS` on the four admin panels (ephemeral); `/preset edit` ownership checked client-side (`preset.ts:777`) and server-side; identity headers only ever from the signed payload (`preset.ts:74-80`); autocomplete for own presets/favourites keyed by the signed `userId` (`index.ts:922-934`).
9. **Rate limiting** — Upstash atomic `INCR` primary, KV fallback with a once-per-isolate warning (`rate-limiter.ts:168-179`; `rate-limiter-fallback.test.ts`); per-user, per-command keys from the signed id; alias canonicalised (`/a11y`→`accessibility`), `extractor:image` 5/min, autocomplete 60/min + burst fail-soft (`index.ts:838-855`). discord-worker intentionally has no `[[ratelimits]]` binding (FINDING-003 status; `POST_MERGE_CHECKLIST.md:82-83`).
10. **Webhook auth** — timing-safe bearer with a separate "unset" branch (`index.ts:202-217`); GitHub HMAC constant-time (`github-verify.ts:63-82`) with header **and** post-read 1 MiB cap (`index.ts:446-461`; `index.test.ts:539-560`). Both fail closed when unconfigured.
11. **Surface hygiene** — CORS exact-match + pinned methods; `nosniff`/`DENY`/HSTS; shaped `onError`; `errors.commandFailed`/`getSafeMessageKey` generic user errors (`types/preset.ts:118-138`); `Unknown interaction type` echo is a number from a verified payload; secrets only as secrets (`wrangler.toml` holds client ids and channel ids only), `.dev.vars*`/`.env*` gitignored; `scripts/upload-emojis.ts` and `register-commands.ts` read `DISCORD_TOKEN` from env and print only status/body of Discord responses (`upload-emojis.ts:88-102, 141-165`, `register-commands.ts:44-62, 82-95`); logger redacts `Bearer …`, `*token`/`*secret`/`*password` keys and JSON-shaped secrets (`packages/logger/src/core/base-logger.ts:160-192, 216-221`); `loggerMiddleware` logs path only, no UA (`logUserAgent` default false).
12. **Module-scope state** reviewed: `envErrorsLogged`, `limiterInstance`/`configuredBackend`/`kvFallbackWarned`, `worldsCache`/`dataCentersCache`, `fontBuffersCache`, `wasmInitPromise`, `localeInstances`, `characterColors`, `cryptoKeyCache` (keyed by secret), `traces` (`WeakMap<DiscordInteraction,…>` — per request) — nothing user-specific survives a request. Every side effect rides `waitUntil` (handlers on the traced ctx, tracking/first-run on the real ctx).
13. **image-worker `/extract` contract** — discord-worker sends `{ url }` only (default `maxDimension` 256 in image-worker → ≤262 KB RGBA), reads `arrayBuffer()` from a first-party binding with a 10 s timeout; k-means bounded (`maxSamples: 10000`, `extractor.ts:525-530`); the attachment URL (channel id + filename) is never logged here.
14. **`/changelog`** — bundled repo-controlled markdown (10 472 B), parsed per call, description cut at 4 000 on a line boundary, ephemeral, `version` echo sanitised ≤64; contract test keeps the newest entry inside the budget (`changelog.test.ts:216`).
15. **Beta isolation** — own Discord app, own KV, own AE dataset `xivdyetools_bot_analytics_beta`, no routes (`wrangler.toml:12-27`); beta deploy workflow never passes `--env`, registers guild-scoped only, step-scopes the bot token (`deploy-discord-worker-beta.yml:48-104`); production deploy SHA-pinned, `permissions: contents: read`, `environment: production` (`deploy-discord-worker.yml:24-77`).

## Rejected (checked and dropped)

- **Analytics: rate-limited/unauthenticated datapoints leak** — unsigned → 401 before dispatch; no `userId` → return before `startCommandTrace` (`index.ts:653-658`); rate-limited → AE-only with the policy-listed class. Nothing beyond the policy.
- **`interaction.locale` full tag in AE** — bucketed to six codes or `other` (`command-trace.ts:315-317`); tested (`pt-BR` → `other`).
- **`.chara` field values / `Nickname` / `TypeName` in a public embed via parser errors** — only colour/identity fields are echoed (`chara-parser.ts:190-275`), `Nickname`/`TypeName` are read with `typeof` guards and never thrown (`:404, 409`); echo is sanitised and capped (`swatch.ts:244`). FINDING-019 holds.
- **Attachment filename to `/swatch` or the PNG name** — `SwatchInput` has no filename field (`bot-logic/commands/swatch.ts:58-72`); output file is the constant `swatch.png`.
- **Copy-button click spam (no component rate limit)** — `trackButtonClick` writes an AE-only row (`command-trace.ts:184-207`), no KV; handlers are pure CPU; the preview buttons gate on `MODERATOR_IDS` before any call. Negligible.
- **Interaction-callback responses lack `allowed_mentions` (`utils/response.ts:88-123`)** — every callback that carries user text is ephemeral (`flags: 64`) or embed-only (`/dye search|list`, sanitised); no `content` sink with user text. Add `allowed_mentions` centrally if a public `content` reply is ever introduced.
- **`errors.invalidColor {input}` / `errors.dyeNotFound {name}` / `dye.list.noDyesInCategory {category}` unsanitised** (`accessibility.ts:74`, `comparison.ts:56-61`, `contrast.ts:61`, `gradient.ts:61, 73`, `harmony.ts:61`, `mixer-v4.ts:54, 62`, `dye.ts:179, 305`, `extractor.ts:257`) — all `flags: 64` self-echoes; markdown renders only to the author. Robustness nit.
- **`manual.ts:327` `topic in TOPIC_KEYS` (prototype `in`)** — `topic` is a Discord choice list (`schemas.ts:511-524`), Discord rejects out-of-list values; worst case an ephemeral embed with a raw key.
- **`searchPresetsForAutocomplete` choice names can exceed Discord's 100 chars** (`preset-api.ts:517-523`) — Discord rejects the whole autocomplete response; robustness, not security.
- **`X-User-Discord-Name` = `global_name ?? username` sent to presets-api** — policy §2 "Discord Username — attribute community preset submissions"; sent only on submit/edit/preview moderation, never on vote/check.
- **`preset-notifications.ts:102, 114` `<@author_discord_id>` / `preview-image.ts:164` `<@moderatorId>`** — inside embeds (no ping) and under `allowed_mentions: none`; moderator-channel only.
- **`index.ts:601` echoes `interaction.type`** — a number from a verified payload.
- **Beta bot writing production preset data** — requires `BOT_API_SECRET` + `BOT_SIGNING_SECRET` on the `-dev` worker; presets-api rejects unsigned bot auth (`auth.ts:186-201`); doc wording noted under DW-14.
- **`budget.ts:388` logs the Universalis error message** — api-worker's messages are fixed strings (`Invalid datacenter or world name`, `Failed to fetch worlds`, `Universalis API error: <status>`, `Request timeout`), no world echo (`apps/api-worker/src/universalis/router.ts:125, 310`; `universalis-client.ts:155-179`).
- **Discord interaction token in logs via fetch errors** — URLs are not part of workerd fetch error messages; Discord error bodies (`discord-api.ts:270`) carry no token; `Bearer …` is redacted anyway.
- **SSRF / SQLi / open redirect / secrets in repo / `Math.random`** — unchanged since 2026-08-21 (attachment URLs from `resolved.attachments`; image-worker allowlist; no D1 here; `gitleaks` evidence clean); not re-chased.
- **`apps/discord-worker/CLAUDE.md` says both webhooks enforce 10 KB caps** — stale after the 1 MiB change (`index.ts:93`); doc nit for the maintainer, not a finding.

## Files covered

**Read in full (96):** `apps/discord-worker/{wrangler.toml, PRIVACY_POLICY.md, CHANGELOG-laymans.md, CLAUDE.md}`; `src/index.ts`; `src/types/{env,preset,preferences,budget,github,markdown.d}.ts`; `src/commands/{schemas,registry,localize}.ts`; `src/handlers/commands/{about,accessibility,budget,changelog,comparison,contrast,dye,extractor,gradient,harmony,index,manual,mixer-v4,preferences,preset,preset-notifications,stats,swatch}.ts`; `src/handlers/buttons/{index,copy,preview-image}.ts`; `src/services/{analytics,announcements,bot-i18n,changelog-parser,command-trace,emoji,fonts,i18n,image-client,image-input-errors,preferences,preset-api,preset-favorites,rate-limiter}.ts`; `src/services/svg/renderer.ts`; `src/services/budget/{index,universalis-client,price-cache,budget-calculator,quick-picks}.ts`; `src/utils/{discord-api,sanitize,text,github-verify,env-validation,response,brand}.ts`; `scripts/{upload-emojis,register-commands,test-font-rendering}.ts`; `src/services/{preset-api-v2,rate-limiter-fallback}.test.ts`; `packages/bot-logic/src/{index,input-resolution,moderators,localization,discord-markdown,discord-markdown.test}.ts`, `i18n/{translator,types}.ts`, `commands/{types,dye-info,swatch}.ts`; `packages/auth/src/{discord,hmac}.ts`; `packages/worker-kit/src/rate-limiter/presets/configs.ts`, `middleware/logger.ts`; `apps/presets-api/src/middleware/auth.ts`; `.github/workflows/deploy-discord-worker{,-beta}.yml`; `docs/superpowers/specs/2026-08-29-bot-analytics-tier-a-design.md`; `docs/audits/2026-08-21-security/evidence/review-discord-worker.md` + `findings/FINDING-{003,014,019,020,021,022,023,033}.md`; `docs/audits/2026-08-29-security/evidence/REVIEWER_BRIEF.md`.

**Grep-verified (targeted lines):** `apps/discord-worker/src/index.test.ts`, `services/{analytics,command-trace,preset-api,preferences,preferences.exhaustive}.test.ts`, `handlers/commands/{swatch,stats,budget,preset,dye,changelog}.test.ts`, `utils/{discord-api,discord-api.safe,sanitize}.test.ts`, `package.json`; `packages/bot-logic/src/commands/{swatch.test,gradient,harmony}.ts`, `i18n/locales/en.json`; `packages/auth/src/{index}.ts`, `discord-freshness.test.ts`; `packages/worker-kit/src/rate-limiter/backends/{upstash,kv}.ts`; `packages/logger/src/{constants}.ts`, `core/base-logger.ts`; `packages/core/src/services/chara/{chara-parser (l.180-320), chara-resolver}.ts`, `config/product-links.ts`; `packages/svg/src/swatch-card.ts`, `swatch-card.test.ts`; `apps/image-worker/src/{index,photon,validators}.ts`; `apps/api-worker/src/universalis/router.ts`; `apps/presets-api/src/services/notification-service.ts`; `docs/operations/{DEPLOY_ENVIRONMENTS,POST_MERGE_CHECKLIST,SECRET_ROTATION,ANALYTICS_QUERIES}.md`, `docs/architecture/security-trade-offs.md`; `docs/audits/2026-08-29-security/evidence/{delta-files-by-unit,pii-sinks,pii-sources,wrangler-surface}.txt`.

**Skipped by scope:** locale JSON beyond key checks, font binaries, `src/data/emoji-mapping.json`, `scripts/*.py`, `src/test-utils*.ts`, remaining `*.test.ts`.
