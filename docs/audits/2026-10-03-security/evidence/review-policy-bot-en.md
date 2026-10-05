# Review: policy-bot-en (bot Privacy Policy + Terms of Service, English) - 2026-10-03

Scope: `apps/discord-worker/PRIVACY_POLICY.md` and `TERMS_OF_SERVICE.md` against discord-worker, presets-api, moderation-worker, bot-logic, image-worker, worker-kit/logger at commit 0ab33466. Read-only. No probe scripts were needed. The six-language siblings were only spot-checked (numbers 180/120/60/30/90 and Last Updated agree in ja/de/fr/ko/zh); full parity is another reviewer's job.

## 1. Entry points and authz matrix (discord-worker, the unit the policy governs)

| Entry | Who can call | Guards before handler | Caps |
|---|---|---|---|
| `GET /health` (index.ts:241) | anyone | CORS, request-id, logger, env validation (index.ts:169-228) | none |
| `POST /` interactions (index.ts:713) | any Discord user (INTERNET-AUTH, Discord-signed) | Ed25519 `verifyDiscordRequest` (:717), then per-user native rate limit `checkRateLimit` (:864) for commands | Discord-bounded body |
| slash commands (registry.ts:27-48): harmony mixer gradient extractor swatch glamour dye comparison contrast accessibility a11y budget preset preferences manual changelog about stats | any Discord user | signature, rate-limit tier per command (worker-kit presets/configs.ts:71-95), first-run flag, trace | `.chara` 1 MiB (chara-attachment.ts:19), image caps in image-worker |
| component / modal (index.ts:1314, 1359) | any Discord user | signature; copy buttons counted (command-trace.ts:184); modal handler is a stub | n/a |
| `POST /webhooks/preset-submission` (:257) | holder of INTERNAL_WEBHOOK_SECRET (presets-api), but the route is on bot.xivdyetools.app | Bearer timing-safe compare | 10 KiB (:279) |
| `POST /webhooks/github` (:500) | GitHub (HMAC) | secret + HMAC + repo allow-list | 1 MiB |
| bindings out: PRESETS_API, IMAGE_WORKER (`POST /extract`), UNIVERSALIS_PROXY (api-worker: market + `/v1/chara/resolve`), KV, ANALYTICS, RL_5..RL_70 | | wrangler.toml | |

## 2. Positive controls
- Analytics datapoint is allowlist-shaped: commandName, userId, `guild`/`dm`, answered flag, 8-value outcome enum, subcommand name (never a value), locale bucket (7 values), kind, latency (analytics.ts:88-105; command-trace.ts:315, 325-332, 346-348). Guild id is derived-then-dropped (analytics.ts:94). The outcome enum matches the policy list one-for-one (analytics.ts:25-33).
- No guild/channel id reaches any KV/D1/AE/log write in discord-worker (grep of guild_id/channel_id: only Discord REST routing and the guild/dm bit).
- Rate limit counters are native bindings in both environments (wrangler.toml); KV fallback key `ratelimit:user:{userId}:{scope}` TTL = 60+60 = 120 s (worker-kit backends/kv.ts:64,211).
- First-run flag TTL 180 d (index.ts:770,791); stats counters and `usertrack` keys TTL 30 d (analytics.ts:131,188,229).
- Dead letters keep only type + preset id (notification-service.ts:78-100), pruned 30 d resolved / 90 d unresolved (:112-125, 270-280) and deleted with the preset (presets.ts:431); submission_events pruned at 30 d (rate-limit-service.ts:155-170).
- `.chara`: nickname stripped on resolve (bot-logic swatch.ts:156-158, glamour.ts:355); producer printed only from a fixed token list (chara-identity.ts:31-45); `/glamour` sends only slot/set/base/variant + glasses id (api-worker chara/router.ts:90-135, glamour.ts:60-62). Image: only the CDN URL crosses the binding; image-worker has no bindings (types.ts:13) and a Discord-CDN-only host allow-list (validators.ts:25-27).
- Settings write logging omits values (preferences.ts:282-290, FINDING-011). Ban log line omits the reason text (ban-reason.ts:208-218).
- Perspective call carries `doNotStore: true` and the key in a header (moderation-service.ts:255-285).

## 3. Rejected items
- Policy "rate-limit counters never written to KV / no third party": TRUE (rate-limiter.ts:1-14; no Upstash reference left in discord-worker; 2026-08-29 FINDING-007 stays fixed).
- `.chara` parse errors echo field values (core chara-parser.ts:231,285,322): only colour / Race / Tribe / Gender values, never TypeName or Nickname, and the output is sanitized (glamour.ts:167). Policy "character names never displayed" holds.
- KV `stats:*` counters refresh their 30-day TTL on every write (analytics.ts:188), so a hot counter never expires: no personal data in them, wording nit only.
- Discord CDN image possibly edge-cached by Cloudflare on image-worker's `fetch` (validators.ts:423): not shown by the repo, no code path stores it. Dropped (UNVERIFIABLE).
- Logging Discord error `body` (discord-api.ts:270,315; index.ts:481): Discord's own error payload, no evidence it echoes user content. Dropped.
- ToS omits /dye /manual /changelog /about /stats from its list: a non-exhaustive list, the intro says "dye exploration"; no false statement.
- Policy numbers 180 d / 120 s / 60 s / 30 d / 90 d / 3 months: all match code (claims table).

## 4. Claims table (policy-claims.txt rows plus full read)

| doc:line | claim | code evidence | verdict |
|---|---|---|---|
| PRIV:19 | User ID used for prefs, favorites, voting, rate limit, first-run flag, daily marker, counted in stats | `prefs:v1:{id}` (preferences.ts), favorites (preset-favorites.ts:73), votes D1, rate-limiter.ts:240, index.ts:778, analytics.ts:223 | TRUE |
| PRIV:20 | Username attributes preset submissions | code sends `global_name || username` (preset.ts:76-80) -> `X-User-Discord-Name` (preset-api.ts:96) -> `presets.author_name` (schema.sql) | STALE/inexact: display name preferred (c3) |
| PRIV:21 | Locale: stored preference; AE bucket of 6 or other | bucketLocale command-trace.ts:315 | TRUE |
| PRIV:22 | Guild/Channel id not stored; only guild/dm | analytics.ts:94; grep clean | TRUE |
| PRIV:28 | Preferences list (language, blending, matching, count, clan, gender, world, market, colour toggles, theme, 8 filters) | types/preferences.ts:31-100; filters preferences.ts:107-116 | TRUE, but the JSON also carries `updatedAt` and `_version` (preferences.ts:327,541), read back for the `/preferences show` footer (handlers/commands/preferences.ts:255) (c3) |
| PRIV:29 | Favorites: up to 50, id + name | preset-favorites.ts:30,119 | TRUE |
| PRIV:30,150,173 | first-run flag 180 d, not user-manageable | index.ts:770,791 | TRUE |
| PRIV:31 | Preset submissions indefinitely | presets table | TRUE |
| PRIV:32 | Votes until removed | `/preset vote` toggles (preset.ts:642-653); votes.ts:122 | TRUE |
| PRIV:36 | Native counters, 60 s, never KV | rate-limiter.ts; configs 60_000 | TRUE |
| PRIV:37 | KV fallback key has userId + command, 120 s | kv.ts:211 (60+60) | TRUE |
| PRIV:38 | Bot never sees IP | requests come from Discord; logger middleware logs method/path only (worker-kit logger.ts:150-160) | TRUE |
| PRIV:47 | AE row fields + 3 months | analytics.ts:88-105 | TRUE |
| PRIV:48 | KV aggregate counters 30 d | analytics.ts:131,188 | TRUE (rolling) |
| PRIV:49 | `usertrack:{date}:{userId}`, value 1, 30 d | analytics.ts:223-229 | TRUE |
| PRIV:51 | Never message content / option values / server names / channel ids in records | analytics.ts, command-trace.ts | TRUE for records |
| PRIV:55-65 | Section 3 closure list | non-listed sinks exist: banned_users, moderation_log, Discord channel embeds, R2 preview images (c4, c5) | holds for the Bot's own command data; incomplete as a statement about the stack |
| PRIV:63 | Images not stored | extractor -> image-client.ts:53 sends URL only; image-worker decodes in memory (index.ts:100-135) | TRUE for `/extractor image`; presets-api stores uploaded preview images in R2 (c4) |
| PRIV:69-73 | `/extractor image` steps | handlers/commands/extractor.ts, image-worker index.ts:100-135 | TRUE |
| PRIV:77-83 | `/swatch`/`/glamour` file steps; only model numbers + facewear id sent | chara-attachment.ts:84-110; glamour.ts:60-62; router.ts:90-135 (also sends slot names) | TRUE |
| PRIV:89-95 | Section 4 use table | | TRUE |
| PRIV:103 | KV holds prefs, favorites, flag, counters, daily keys, RL fallback | plus legacy keys `i18n:user:`, `budget:world:v1:` read (preferences.ts:59-60,519-526) and `announced:v:{version}` (no user data) | TRUE+; legacy keys never deleted (c1) |
| PRIV:104 | D1: presets, votes, moderation history, dead letters, daily counters | schema.sql; plus `banned_users` (Discord id, username, reason, moderator id) | INCOMPLETE (c5) |
| PRIV:107 | "All data is stored on Cloudflare's infrastructure" | author display name + Discord mention + preset text posted to Discord moderation / submission-log channels (preset-notifications.ts:104-111; index.ts:440-452; preset.ts:1083-1103) | FALSE (c4) |
| PRIV:111-114 | HTTPS, stateless, no passwords | | TRUE |
| PRIV:118 | Only two log lines carry a user id | userId also in preferences.ts:546, preset-favorites.ts:96-99,160,189; moderation-worker index.ts:247,313,365, ban-reason.ts:213, preset.ts:707 | FALSE (c2) |
| PRIV:118 | Logs never include option values | `Handling component` logs customId = colour value (index.ts:1323); `Budget error details` logs a raw message (budget.ts:413) | nit (c2) |
| PRIV:120 | Workers Logs switched off | no `[observability]` block in wrangler.toml; 2026-08-29 audit saw it off on all scripts (image-worker index.ts:70-78) | UNVERIFIABLE from repo (c7) |
| PRIV:128-132 | Third parties: Discord, Cloudflare, Universalis, XIVAPI, Perspective | outbound hosts: discord.com, cdn.discordapp.com / media.discordapp.net, api-worker (-> Universalis, v2.xivapi.com), commentanalyzer.googleapis.com (moderation-service.ts:204), GitHub raw (changelog, no user data), Cloudflare cache purge (no user data) | TRUE; Perspective row undated and non-specific (c6) |
| PRIV:134 | No sale/sharing for marketing | | TRUE |
| PRIV:141-143 | `/preferences show`, `/preset favorite list`, export by contact | schemas.ts:618, 1191-1224 | TRUE (commands exist, options match; `reset key:` = schemas.ts:760-785) |
| PRIV:146 | `/preferences reset` resets all; `key:` one | resetPreference preferences.ts:305-340 | FALSE for users with legacy keys (c1) |
| PRIV:147 | `/preset favorite remove` | preset-favorites.ts:131-195 deletes both v1/v2 keys when empty | TRUE |
| PRIV:148,153-161 | Contact deletion within 30 days | no runbook in docs/ (git grep) | UNVERIFIABLE; handoff |
| PRIV:167-177 | Retention table | RL 60/120 s TRUE; counters/usertrack 30 d TRUE; AE 3 mo TRUE; failed notifications 30/90 d TRUE (notification-service.ts:112-125); daily counters 30 d TRUE (rate-limit-service.ts:155). Prune runs only on write paths (no cron), so rows can outlive the nominal TTL on an idle service (INFO). Moderation history and ban records absent | INCOMPLETE (c5) |
| PRIV:189-196 | Changes announced in Discord for significant changes | announcement flow exists (index.ts:500-700, GitHub changelog push); no hook for a policy-only change | UNVERIFIABLE |
| PRIV:5, TOS:5 | Last Updated 2026-09-28 | last policy commit 2e4cb0cb 2026-09-28; newest relevant code commits the same day, none after | TRUE |
| TOS:23-33 | Service description | commands exist: harmony, comparison, contrast, mixer, gradient, budget, swatch, glamour, accessibility, preset favorite (registry.ts) | TRUE |
| TOS:28 | Real-time market prices via Universalis | budget via UNIVERSALIS_PROXY | TRUE |
| TOS:57 | Auto check; clear -> published and logged; flagged or unresolved -> moderator | presets.ts:625-680, index.ts:432 (fail-closed on Perspective failure) | TRUE |
| TOS:83-85 | Universalis, XIVAPI named | | TRUE |

Every slash command named in either document (`/extractor image`, `/swatch`, `/glamour`, `/stats`, `/preferences show|reset`, `/preset favorite add|remove|list`, `/comparison`, `/contrast`, `/mixer`, `/gradient`, `/budget`) exists in registry.ts and schemas.ts with the same name and option; none is stale.

## 5. Files covered
apps/discord-worker/PRIVACY_POLICY.md, TERMS_OF_SERVICE.md, wrangler.toml, src/index.ts (1-200, 255-300, 355-485, 700-1010, 1225-1400), src/commands/registry.ts, src/commands/schemas.ts (name scan), src/services/{analytics,command-trace,rate-limiter,preferences,preset-favorites,preset-api,image-client}.ts, src/types/preferences.ts, src/handlers/commands/{glamour,stats,preferences,preset,preset-notifications}.ts, src/handlers/buttons/copy.ts, src/utils/chara-attachment.ts, src/utils/discord-api.ts (log sites); apps/image-worker/{wrangler.toml,src/index.ts,src/validators.ts (fetch)}; apps/presets-api/{schema.sql,migrations/0003,0005,src/services/notification-service.ts,rate-limit-service.ts,moderation-service.ts,handlers/presets.ts (delete batch)}; apps/moderation-worker/src/{services/ban-service.ts,handlers/modals/ban-reason.ts,handlers/commands/preset.ts,index.ts (log sites)}; apps/api-worker/src/chara/router.ts; packages/worker-kit/src/middleware/logger.ts, rate-limiter/backends/kv.ts, presets/configs.ts; packages/logger/src/constants.ts; packages/bot-logic/src/commands/{chara-identity,glamour}.ts, i18n/locales/en.json (privacy strings); packages/core/src/services/chara/chara-parser.ts; DEPRECATIONS.md; evidence/policy-claims.txt, pii-sinks.txt, outbound-fetch.txt; apps/web-app/PRIVACY.md (lines 60-80, cross-check only); sibling policies (number spot-check).

## 6. Candidates

| cid | sev | exposure | path:line | claim |
|---|---|---|---|---|
| c1 | MEDIUM | INTERNET-AUTH | apps/discord-worker/src/services/preferences.ts:305-340,502-545 | `/preferences reset` (all, or the last remaining key) deletes only `prefs:v1:{id}`; legacy keys `i18n:user:{id}` and `budget:world:v1:{id}` are "NOT deleted" (:502) and the next `getUserPreferences` (:120-128, any command) re-migrates language and world into a fresh `prefs:v1` key. The policy's user right (PRIV:146) silently fails for pre-4.0 users and they cannot clear the data. Number of surviving legacy keys unknown. Fix the code, not the document. |
| c2 | LOW | INTERNET-UNAUTH (document) | apps/discord-worker/PRIVACY_POLICY.md:118 | "Two of them include your Discord User ID" is false: also preferences.ts:546, preset-favorites.ts:96,160,189 (with presetId), moderation-worker index.ts:247/313/365, ban-reason.ts:213, preset.ts:707 (target user). Button customIds (colour values) are logged at index.ts:1323. Mitigated while logs are unpersisted (c7). |
| c3 | LOW | INTERNET-UNAUTH (document) | apps/discord-worker/PRIVACY_POLICY.md:20,28 | §2 names "Discord Username", but the code sends the Discord display name first (preset.ts:76-80; display names are often real names), and the preferences record also holds `updatedAt` (last-change timestamp, preferences.ts:327). Neither is listed. |
| c4 | MEDIUM | INTERNET-UNAUTH (document) | apps/discord-worker/PRIVACY_POLICY.md:107 (also :101-105, :63) | "All data is stored on Cloudflare's infrastructure" is false: submission author display name, Discord mention and preset text are posted into Discord moderation and submission-log channels (preset-notifications.ts:104-111; index.ts:440-452; preset.ts:1083-1103), which Discord retains. The §5 table also omits R2 preview images (presets-api wrangler r2_buckets; web PRIVACY.md:73 discloses them), and §3 says "Images ... not stored" without scoping it to `/extractor image`. |
| c5 | MEDIUM | INTERNET-UNAUTH (document) | apps/discord-worker/PRIVACY_POLICY.md:104,165-177 | Silent on `banned_users` (Discord id, username, moderator-written free-text reason, moderator id, timestamps; presets-api/schema.sql, moderation-worker ban-service.ts:450-456) and on `moderation_log` contents and retention: both are indefinite and absent from §8. ToS §10 already warns of bans, so the data is justified: document it (reconcile 3, no new commitment). |
| c6 | LOW | INTERNET-UNAUTH (document) | apps/discord-worker/PRIVACY_POLICY.md:132 | Perspective row is undated and says nothing about what is sent; Google shuts the API 2026-12-31 (DEPRECATIONS.md:10-20, moderation-service.ts:204-215). Name + description of each submitted/edited preset go to Google with `doNotStore` (moderation-service.ts:255-285); the web policy says so (web PRIVACY.md:68-72), the bot policy does not. After the secret is deleted the row is false. Six-file edit, to ship with the key removal. |
| c7 | LOW | LOCAL | apps/discord-worker/wrangler.toml (no `[observability]` block) | PRIV:120 "Workers Logs switched off" depends on a dashboard setting no file pins; enabling it would make the c2 user-id lines persistent and the policy false. Add an explicit `[observability] enabled = false` and pin it in the wrangler-invariants test. policy NONE. |

## 7. Handoffs (non-security)
- documentation: no data-access/deletion runbook exists although PRIV:153-161 promises 30-day handling; it should list every store (KV `prefs:v1`, legacy keys, `xivdye:preset_favorites:v1/v2`, `firstrun:v5`, `usertrack:*` via date scan; D1 presets/votes/moderation_log/submission_events/banned_users; Discord channel copies; Analytics Engine undeletable).
- documentation: "Votes ... Until removed or account deletion" (PRIV:175) - the bot has no accounts; reword.
- documentation: ToS service list could name `/dye`, `/manual`, `/changelog`, `/about`, `/stats`.
- plain bug: `Budget error details: ${errorMsg}` (budget.ts:413) logs a raw message beside the structured error; redundant.
- documentation: PRIV:48 "30 days" for KV stats counters is a rolling TTL refreshed on each write.
