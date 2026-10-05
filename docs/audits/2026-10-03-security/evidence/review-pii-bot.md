# Review: pii-bot (personal-data reconciliation, bot side) - 2026-10-03

Scope: apps/discord-worker, apps/moderation-worker, apps/presets-api, apps/image-worker, apps/stoat-worker, packages/bot-logic.
Governing documents: apps/discord-worker/PRIVACY_POLICY.md (Last Updated 2026-09-28; no code change under these units since, `git log --since` empty), docs/superpowers/specs/2026-08-29-bot-analytics-tier-a-design.md.
No probe scripts were written.

## 1. Entry points and authz matrix (data-flow relevant)

| Entry | Who | Guards before handler | Caps |
|---|---|---|---|
| discord-worker POST / (index.ts:709-766) | any Discord user via signed interaction | Ed25519 verify (index.ts:722), rate limit per user+command (index.ts:850-880) | Discord-defined |
| discord-worker POST /webhooks/preset-submission (index.ts:~265-480) | presets-api (service binding) + Bearer secret | secret check (index.ts:268-274), 10 KB streamed cap (index.ts:282) | 10240 B |
| discord-worker POST /webhooks/github (index.ts:~500-700) | GitHub | HMAC (index.ts:558), repo allow-list (index.ts:592), byte cap (index.ts:538) | capped |
| discord-worker GET /health | anyone | none | none |
| 18 slash commands + 3 copy buttons + preview-image buttons | any Discord user (preview-image: moderators) | signature + rate limit; stats admin subcommands gated by STATS_AUTHORIZED_USERS (stats.ts:69-84,100-111) | Discord-defined |
| moderation-worker POST / | Discord users where the app is installed | signature (index.ts:160), rate limit (index.ts:300-325), MODERATOR_IDS gate on commands/buttons/modals/autocomplete (index.ts:362) | safeParseJSON depth 10 |
| presets-api REST | web (JWT) / both bots (HMAC v2 + nonce) / anonymous reads | auth middleware, nonce replay cache KV (auth.ts:208-232), RL_PUBLIC per IP or per user | per route |
| image-worker /extract, /thumbnail | service binding only | no routes, workers_dev false | see review-image-worker.md |
| stoat-worker | Revolt gateway | see review-stoat-worker.md | n/a |
Bindings of interest: discord-worker KV + ANALYTICS (wrangler.toml:21-27, prod 135-153); moderation-worker KV + D1; presets-api D1 + R2 THUMBNAILS + TOKEN_BLACKLIST KV; image-worker none.
Observability: no `[observability]`, logpush or tail_consumers key in any wrangler.toml of these units (git grep over apps/*.toml: no hit).

## 2. Positive controls
- Analytics datapoint is allow-list shaped: `CommandEvent` fields only; guild id reduced to `guild|dm` before write (analytics.ts:88-107); locale bucketed to 6+other (command-trace.ts:~300 `bucketLocale`); outcome is a closed enum (analytics.ts:23-31); subcommand comes from the Discord-typed option tree, never an option value (command-trace.ts `subcommandOf`); button kind from `COPY_BUTTON_KINDS` only (command-trace.ts `buttonKindOf`). Only `writeDataPoint` call in these units (git grep).
- KV TTLs match the policy: stats counters and `usertrack:` keys 30 d (analytics.ts:134 STATS_TTL, :188, :229); first-run flag 180 d (index.ts:770,791); KV rate-limit fallback = window 60 s + 60 s buffer = 120 s (worker-kit rate-limiter/backends/kv.ts:64,234; presets all 60_000 ms windows); announcement memo 90 d has no personal data (index.ts:123,692).
- Dead letters store only `{type, preset_id, moderation_status}` (notification-service.ts:93-101), pruned 30 d resolved / 90 d unresolved on every write path (notification-service.ts:108-115, 258-290, callers at 307/418/464 and presets.ts:1056); deleted with the preset in the same batch (presets.ts:425-436). `submission_events` pruned at 30 d on each reservation (rate-limit-service.ts:146-165, called at :188,:292). Both match PRIVACY_POLICY §8.
- Log hygiene fixes verified: preset name not logged (index.ts:374-380), pref values not logged (preferences.ts:282-290), ban log line is ids and lengths only (ban-reason.ts:203-219), nonce and D1 error text kept out of presets-api logs (auth.ts:228-233; notification-service.ts catch), stoat command text swapped for placeholders (message-handler.ts:93-100,116-125,139-145).
- No logger call in these units interpolates an `interaction`, `member`, `user`, request body or attachment: all logged contexts are scalars (checked every non-test logger line in pii-sinks.txt for the five apps; bot-logic has three, all fixed strings/enum names: harmony.ts:189, locale-resolution.ts:123, translator.ts:86).
- loggerMiddleware logs method, pathname (no query), requestId, status, duration only; UA logging off by default (worker-kit middleware/logger.ts:117-165). discord-worker and image-worker use defaults (index.ts:179-185).
- Preset author identity redaction: anonymous viewers never get `author_discord_id` (preset-service.ts:135-190).
- `/glamour` sends only gear model numbers and glasses id to api-worker (glamour.ts:49-52; bot-logic glamour.ts:355-359 keeps nickname local); `/swatch` strips nickname (swatch.ts:156-160, 186-191); `.chara` and images never written (no put/cache of file content; image-worker has no bindings).
- Presets-api rate limiting uses native binding or in-memory only (middleware/rate-limit.ts:57-80), so IP/user id are not written to KV/D1.

## 3. Rejected (one line each)
- harmony.ts:189 logs `input.wheel` text: discord-worker normalises via parseColorWheelId before calling (handlers/commands/harmony.ts:40), so the warn is unreachable from user text.
- discord-api.ts:270/315 log Discord error `body`: Discord validation bodies describe field paths/limits, not submitted content; status+body only on failure; Workers Logs off. No concrete echo found.
- "Handling component"/"Handling button" log `customId` (index.ts:1323, buttons/index.ts:65): custom ids carry dye-DB colour values (copy.ts:146-158, only built by /dye info, dye.ts:214), preset ids or preview keys, never user text.
- `Budget error details: ${errorMsg}` (budget.ts:413): UniversalisError messages are fixed strings or the proxy's `error` field; no world echo (universalis-client.ts:112,161,172,179,215).
- `Discord worker returned 4xx: <body>` stored in failed_notifications.error (notification-service.ts:204, 312-316): discord-worker 4xx bodies are fixed `{error: ...}` strings (index.ts:295-303,310).
- presets-api warn lines carry `err.message` (rate-limit-service.ts:307,318,330): D1 errors do not echo bound values; user id is not in them. Retention prune runs on writes only, not by cron, so a quiet period leaves rows past 30 d until the next submission activity: bounded, noted not filed.
- /stats preferences subcommand reads up to 100 users' prefs blobs (stats.ts:419-452): counts presence of keys only, admin gated (stats.ts:100-111), ephemeral; nothing personal leaves.
- First-run flag key `firstrun:v5:<userId>` and `usertrack:<date>:<userId>` carry the user id in the key: both disclosed in §2 and §8.
- moderation-worker `Generated HMAC signature` debug line (preset-api.ts:113-117): userId only, debug level; falls under finding c1.
- Perspective request body (moderation-service.ts:255-275): name+description only, `doNotStore: true`, key in header; no identity sent.
- Beta analytics dataset (wrangler.toml:27): same schema, no new field.

## 4. Files covered
apps/discord-worker: PRIVACY_POLICY.md (+ all five locale files checked by grep for TTL numbers and Last Updated), TERMS_OF_SERVICE.md (grep), wrangler.toml, src/index.ts (160-300, 355-395, 474-490, 765-1000, 1235-1390), src/services/analytics.ts, command-trace.ts, preferences.ts (120-135, 270-345, 495-565), preset-favorites.ts (100-195), rate-limiter.ts (225-300), preset-api.ts (60-200, 500-530), budget/universalis-client.ts (100-222), budget/price-cache.ts, budget/budget-calculator.ts (176-192), image-client.ts (30-110), src/types/preferences.ts (55-140), handlers/buttons/index.ts, copy.ts, handlers/commands/stats.ts (60-160, 410-520), glamour.ts (30-190), preferences.ts (700-800), preset.ts (70-90), budget.ts (405-416), utils/chara-attachment.ts (55-120), utils/discord-api.ts (255-330).
apps/moderation-worker: wrangler.toml, src/index.ts (160-330, 355-415, 528-580), handlers/modals/ban-reason.ts (200-230), handlers/commands/preset.ts (695-720), services/ban-service.ts (425-470), services/preset-api.ts (95-125, 465-485).
apps/presets-api: wrangler.toml, migrations (0003, 0005, 0011, 0012, 0013, 0009 grep), src/services/notification-service.ts (1-330), rate-limit-service.ts (120-335), preview-image-service.ts (100-215), moderation-service.ts (185-290), middleware/auth.ts (195-240), middleware/rate-limit.ts (30-175), handlers/presets.ts (340-440, 995-1015, 1205-1225), services/preset-service.ts (135-195 grep).
apps/image-worker: wrangler.toml, grep of src; reviewed in review-image-worker.md.
apps/stoat-worker: src/index.ts (45-75), message-handler.ts (85-160); reviewed in review-stoat-worker.md.
packages/bot-logic: git grep of every logger/console/put/writeDataPoint call; commands/glamour.ts (340-375), harmony.ts (175-195), i18n/locale-resolution.ts (105-140), i18n/translator.ts (60-100).
packages/worker-kit: middleware/logger.ts, rate-limiter/backends/kv.ts (partial).
Docs: DEPRECATIONS.md (1-50), tier-A spec (grep), web-app/PRIVACY.md (60-85, grep), evidence pii-sinks.txt, outbound-fetch.txt, policy-locale-parity.txt.

### Sink table
| path:line | sink kind | fields | listed in policy? (§) | verdict |
|---|---|---|---|---|
| discord-worker services/analytics.ts:88 | Analytics Engine | command, user id, guild/dm, answered flag, outcome class, subcommand, locale bucket, kind, latency ms, counts | yes: §2 Usage Analytics | OK; 3-month retention matches §8 |
| analytics.ts:188 | KV `stats:*` TTL 30 d | counters (no user data) | yes §2/§8 | OK |
| analytics.ts:229 | KV `usertrack:<date>:<userId>` 30 d | user id (key), date | yes §2/§8 | OK |
| index.ts:791 | KV `firstrun:v5:<userId>` 180 d | user id (key) | yes §2/§8 | OK |
| index.ts:692 | KV announced-version memo 90 d | version | n/a no personal data | OK |
| services/preferences.ts:277,333,543; commands/preferences.ts:723,788 | KV `prefs:v1:<userId>` no TTL | prefs listed in §2, plus `updatedAt`, `_version` | yes §2 (updatedAt is a last-modified timestamp, not listed) | OK, trivial; reset leaves legacy keys, see c2 |
| services/preset-favorites.ts:119-120 | KV favourites v2 + v1 | user id (key), preset id, preset name at save time | yes §2 | OK |
| services/rate-limiter.ts / worker-kit kv.ts:234 | KV fallback counter 120 s (not bound in prod/beta) | user id + command | yes §2 Rate Limiting | OK |
| index.ts:832 | log info | command name, user id | yes §5 | OK |
| index.ts:877 | log info | user id, command | yes §5 | OK |
| services/preferences.ts:546 | log info | user id, pref key names | partly: §5 says only two lines carry the id | c1 |
| services/preset-favorites.ts:160,189 | log error | user id, preset id | same | c1 |
| index.ts:1323,1366, buttons/index.ts:65,96 | log | custom_id (preset id / preview key / dye colour) | n/a, no personal field | OK |
| index.ts:284,362,377,480,675 | log | content-length, status, preset id, source, Discord error body | n/a | OK |
| index.ts:826,990,1384, other command logger.error | log | command name, path, Error | n/a | OK |
| utils/discord-api.ts:270,315 | log error | status, Discord body | n/a | OK (rejected 2) |
| services/preset-api.ts:93-97 (outbound to presets-api) | service binding headers | user id, display name (global_name else username) | §2 lists "Discord Username" | c4 (naming) |
| presets-api handlers/presets.ts:354-364, preset-service.ts:395 | D1 `presets` | author_discord_id, author_name, name, description, dyes, tags, category | §2 Preset Submissions + Username | OK; display name vs username c4 |
| presets-api votes.ts:66-71 | D1 `votes` | preset id, user id, created_at | yes §2/§8 | OK |
| presets-api rate-limit-service.ts:192,301 | D1 `submission_events` 30 d | user id, kind, preset id, timestamp | yes §5/§8 | OK |
| presets-api notification-service.ts:312 | D1 `failed_notifications` 30/90 d | preset id, type, moderation status, error text, attempts | yes §8 | OK |
| presets-api moderation.ts:146,230; moderation-worker ban-service.ts:353-404 | D1 `moderation_log` no retention | moderator id, action, free-text reason, target user id, preset id, timestamp | only "Moderation history" in §5 | c3 |
| moderation-worker ban-service.ts:452 | D1 `banned_users` no retention | discord id, username at ban, moderator id, reason, banned_at, unbanned_at | not listed in §2/§8 | c3 |
| presets-api preview-image-service.ts:158 | R2 THUMBNAILS | author-uploaded WebP, key `<presetId>/<uuid>.webp` | §3 says images not stored; R2 absent from §5 | c6 |
| presets-api auth.ts:228 | KV `botnonce:<nonce>` 120 s | random nonce only | n/a not personal | OK |
| presets-api moderation-service.ts:255 | third-party request (Perspective) | preset name + description, doNotStore | §6 lists Perspective, not what is sent; sunsets 2026-12-31 | c5 |
| discord-worker universalis-client.ts / glamour.ts:49-67 | service-binding requests to api-worker | item ids, world/dc name; gear model numbers + glasses id | §6, §3 glamour paragraph | OK |
| discord-worker image-client.ts:53 -> image-worker | service binding | Discord CDN attachment URL | not stored; image-worker no storage | OK |
| moderation-worker index.ts:247,313,365,384; preset.ts:707; ban-reason.ts:213 | log | moderator/target user id, command, ids and counts | §5 describes "the Bot" only | c1 |
| stoat-worker src | log | command placeholder only | none stored | OK (see review-stoat-worker.md) |
| bot-logic (3 log lines) | log | fixed strings / key names | n/a | OK |

Retention checks: KV 30/180/120 s as above; D1 30/90/30 d as above; votes, favourites, prefs, presets: until removed (matches §8); AE "3 months" is Cloudflare's window (accurate). `moderation_log` / `banned_users` indefinite (c3).
Workers observability: no `[observability]` block anywhere in the five wrangler.toml files; §5 "Workers Logs switched off" is true only if the dashboard setting stays off (c7).
Locale parity: all five locale files carry Last Updated 2026-09-28, 180/120/60/30/90 numbers and the 3-month note identically (greps above; policy-locale-parity.txt PASS). Last Updated is current (no later change to described code).

## 5. Candidates
| cid | sev | exposure | path:line | claim |
|---|---|---|---|---|
| c1 | LOW | INTERNET-AUTH | apps/discord-worker/src/services/preferences.ts:546 | Log lines carry the Discord user id beyond the "two" lines PRIVACY_POLICY §5 names: preferences.ts:546 (id + pref keys), preset-favorites.ts:160,189 (id + preset id), moderation-worker index.ts:247,313,365,384, ban-reason.ts:213, preset.ts:707, preset-api.ts:113. Persistent logs are off, so impact is low; fix code first (drop userId from the three discord-worker lines), else CORRECT §5 wording. |
| c2 | LOW | INTERNET-AUTH | apps/discord-worker/src/services/preferences.ts:315 | `/preferences reset` (all or one key) never deletes the legacy keys `i18n:user:<id>` and `budget:world:v1:<id>`; the next read re-migrates language and world from them (preferences.ts:127,497-560, "Legacy keys are NOT deleted"). For a legacy user §7's "reset all your preferences" does not remove world or language and the legacy keys have no TTL in current code. |
| c3 | MEDIUM | INTERNET-AUTH | apps/moderation-worker/src/services/ban-service.ts:452 | Ban and moderation records (`banned_users`: discord id, username at ban time, moderator id, free-text reason, timestamps; `moderation_log`: moderator id, action, reason, target id) are kept indefinitely; PRIVACY_POLICY §2 lists no such data and §8 has no retention row, only "Moderation history" in §5. |
| c4 | LOW | INTERNET-UNAUTH | apps/discord-worker/src/handlers/commands/preset.ts:76 | §2 says "Discord Username"; code sends and stores the display name (`global_name`) first, username as fallback (preset.ts:76-80 -> preset-api.ts:96-97 -> presets.ts:364), and re-syncs it on each action. Document should say display name (or username). |
| c5 | LOW | INTERNET-UNAUTH | apps/presets-api/src/services/moderation-service.ts:255 | §6 lists Perspective API without saying that preset name and description are sent (doNotStore), and the entry expires with the 2026-12-31 shutdown (DEPRECATIONS.md:15, moderation-service.ts:202-214); the policy will be stale from 2027-01-01. |
| c6 | LOW | INTERNET-UNAUTH | apps/presets-api/src/services/preview-image-service.ts:158 | §3 states images are "processed in-memory, not stored" and §5's storage table lists no R2, but presets-api stores author-uploaded preview images in R2 (served from shots.xivdyetools.app, posted to the moderation channel by discord-worker index.ts:~340). Web PRIVACY.md:73 covers it; the bot policy does not. |
| c7 | INFO | LOCAL | apps/discord-worker/wrangler.toml:12 | "Workers Logs off" (§5) is not pinned in config: none of the five wrangler.toml files declares `[observability] enabled = false`, so the claim depends on dashboard state a later toggle could silently flip. Pin it and add to the wrangler invariants test. |

## 6. Handoffs (non-security)
- moderation-worker is a second Discord application with its own logs and KV counters; PRIVACY_POLICY.md never mentions it by name (documentation-audit).
- presets-api per-IP rate limit key (CF-Connecting-IP, native binding) is a web-policy matter: verify web-app/PRIVACY.md mentions it (other reviewer, pii-web).
- discord-worker preferences.ts:546 comment "Legacy keys are NOT deleted" and preferences.ts:723/788 write `prefs:v1:` with a hand-built key instead of `buildPrefsKey` (plain refactor).
- stoat about.ts advertising unrouted commands: see review-stoat-worker.md handoffs.
