# Review: discord-worker slash-command half (label: discord-worker-commands)

Audit 2026-10-03, commit 0ab33466. Read-only review; no probe scripts written.
Scope: apps/discord-worker src/handlers/commands/**, utils/chara-attachment.ts, services/budget/**, services/svg/renderer.ts, fonts.ts, font-coverage.ts, image-input-errors.ts, image-client.ts; plus the Glamour chain in packages/bot-logic (glamour.ts, chara-identity.ts, discord-markdown.ts), packages/core (chara-parser.ts, chara-models.ts), packages/svg (base.ts escapeXml, frame.ts cardText).

## 1. Entry points and authz matrix

Every command arrives through `POST /` (apps/discord-worker/src/index.ts:713). Pre-handler chain, in order: CORS, request id, logger, env validation, security headers (index.ts:169-239); then `verifyDiscordRequest(raw, DISCORD_PUBLIC_KEY)` before `JSON.parse` (index.ts:717-731); then `handleCommand` rejects a missing user id, starts the Tier A trace, and runs the per-user native rate limit for EVERY command (index.ts:864-882) before the dispatch switch. workers_dev=true only on the beta top-level block; production uses custom domains (wrangler.toml:16,114-119). The Ed25519 signature is the only authentication: "caller" below is any Discord user whose interaction Discord signed.

| Command / sub | Caller | Handler guards (beyond the common chain) | Input caps | Outbound |
|---|---|---|---|---|
| /glamour file | any Discord user | checkCharaAttachment: attachment present, size<=1 MiB, https + cdn.discordapp.com / media.discordapp.net (glamour.ts:114, chara-attachment.ts:45-67) | Discord size, then streamed 1 MiB cap, 10 s timeout, redirect:manual (chara-attachment.ts:84-104, read-text-capped.ts:30-58) | Discord CDN GET; POST api-worker /v1/chara/resolve via UNIVERSALIS_PROXY binding (12 s) with {gear[<=12], glasses} only (glamour.ts:56-66) |
| /swatch file, order, slot | any | same attachment guards; slot allowlist (swatch.ts:46-55) | same | Discord CDN GET only |
| /extractor color | any | resolveColorInput | no max_length on `color` | none |
| /extractor image | any | URL forwarded to image-worker, which owns host allowlist / redirects / byte and pixel caps (image-worker validators.ts:159-189, 436-489) | colors clamped (extractor.ts:~467) | IMAGE_WORKER binding POST {url}, 10 s (image-client.ts:53-61) |
| /budget find / quick / set_world | any | world validated against cached Universalis world/DC lists (budget.ts:150-152, universalis-client.ts:342-382); quick preset from a static table | target_dye / world: no max_length in schema | UNIVERSALIS_PROXY binding GET /api/v2/... with canonical world, encodeURIComponent (universalis-client.ts:196-197) |
| /budget autocomplete | any | `autocomplete` limiter tier | 25 choices | cached lists only |
| /preferences show/set/reset/filters | any, self only (key prefs:v1:{ctxUserId}) | option-name allowlist PREFERENCE_ORDER (preferences.ts:326), world shape + canonical lookup (preferences.ts:342) | per-key validators (services/preferences.ts) | KV r/w only |
| /preset list/show/random/submit/vote/edit/favorite* | any | edit checks existing.author_discord_id === userId (preset.ts:775) before the API call; presets-api re-checks; a UUID goes to a path, anything else is a name search (lookupPreset) | name/description max_length in schema (schemas.ts:1028-1037); tags and dye strings unbounded in schema, presets-api validates | PRESETS_API binding, v2-signed (preset-api.ts:104-131) |
| /stats summary | any | public aggregate KV counters | none | none |
| /stats overview / commands / preferences / health | STATS_AUTHORIZED_USERS only (stats.ts:60-67, 98-113); denial is ephemeral | all admin panels flags 64 | KV list capped at 20 pages (stats.ts:387) | none |
| /about /manual /changelog /accessibility /contrast /comparison /gradient /harmony /mixer /dye | any | pure compute / bundled markdown; invalid-input echoes are ephemeral (flags 64) or run through sanitizeEmbedText | numeric ranges enforced by Discord from the registered schema | none (manual spectrum_prices reads cached world lists) |

The only user-controlled large input is the .chara attachment, capped at 1 MiB while streaming.

## 2. Positive controls

- Attachment fetch is allowlisted, https-only, exact hostname match (so `cdn.discordapp.com@evil` and trailing-dot hosts fail closed), no redirect following (`redirect:'manual'`, 3xx refused by `!ok`), a 10 s timeout that also covers the body read, and a 1 MiB cap counted on decoded stream bytes, so a gzip bomb is cut at the cap: chara-attachment.ts:30-67, 84-104; read-text-capped.ts:30-58.
- Parser bounds: input is <=1 MiB JSON; a `JSON.parse` failure (including stack overflow from deep nesting) is caught and reported (core chara-parser.ts:284-288); only 12 fixed slot keys are read, lookups use `Object.hasOwn` (chara-parser.ts:221-225, 241); lanes and stain ids are coerced to finite numbers (chara-parser.ts:495-514). The body sent to api-worker is therefore at most 12 small integer records and api-worker re-validates (400/413/422 mapped to PARSE_FAILED, bot-logic glamour.ts:370-376).
- Nickname is parsed but dropped: executeGlamour keeps only gearModels/gearDyes/glassesId/race/gender/tribe/producer (bot-logic glamour.ts:354-356); executeSwatch strips it on resolve (swatch.ts:153-158, 186-190). `TypeName` reaches a card only as a fixed allowlisted token BRIO/KTISIS/ANAMNESIS (chara-identity.ts:30-41). The attachment filename is never read.
- Parser error text that echoes file field values goes to a public edit only after `sanitizeEmbedText(..., 1024)` (glamour.ts:168, swatch.ts:130-138): strips controls/bidi, defuses @everyone/@here and `<@id>`, escapes markdown and masked links (bot-logic discord-markdown.ts:20-71).
- allowed_mentions `{parse:[]}` on every webhook body built in utils/discord-api.ts (lines 84, 108, 173, 196, 358, 392); no handler under src/handlers/commands writes a `content:` field directly (grep empty); `ephemeralResponse(string)` does put text in `content`, but only in ephemeral replies (which cannot ping) and the user text in them is sanitised or fixed locale text, so public messages carry user text only inside embeds (which never ping).
- Public echoes of user text are sanitised: /dye search query (dye.ts:~96), preset name/description/author/tags (preset.ts:~958-966, utils/sanitize.ts), duplicate-preset names (preset.ts:~545), changelog version (changelog.ts:~82). Raw echoes of invalid colour/dye input exist only in ephemeral replies (flags 64 verified in accessibility, contrast, comparison, gradient, harmony, mixer-v4).
- SVG: all card text goes through `escapeXml` (svg base.ts:29-37; `text()` base.ts:171-190; `cardText()` frame.ts:160-172); resvg-wasm fetches nothing external.
- /budget world: every override and the stored preference go through `validateWorld`, and the CANONICAL name is what reaches the proxy path and the Cache-API key (budget.ts:150-152, universalis-client.ts:196-197, price-cache.ts:41-43); set_world and /preferences set world store the canonical name (budget.ts:450-466, preferences.ts:342-358). FINDING-019/033 fixes hold.
- Logs: handlers log error classes, counts, a dye catalog id, `hasWorld: Boolean` (budget.ts:272) and `{ error: code }` (glamour.ts:166); no option text, no TypeName/Nickname, no world name.
- /stats admin gating is deny-by-default (stats.ts:60-67), ephemeral; /stats preferences returns percentages only.
- Bot to presets-api uses the v2 signature with nonce and 60 s timestamp; v1 header no longer sent (preset-api.ts:104-131). Preset edit passes the API's own id, never the raw option (preset.ts:~836).
- Module-scope state is public data only (world/DC caches universalis-client.ts:93-94, fonts, cmap coverage, wasm).
- Rate limit applies to all commands before dispatch (index.ts:864-882), native `[[ratelimits]]` tiers (wrangler.toml:50-78).
- Policy PRIVACY_POLICY.md §3 "Character Files" matches the code: the api-worker request carries only slot + model numbers + facewear id, headers Content-Type/Accept only, no user or Discord identifier (glamour.ts:56-63).

## 3. Rejected items

- Glamour has no entry in worker-kit DISCORD_COMMAND_LIMITS (configs.ts:68-98), so it takes the 15/min default: same tier as /swatch, and api-worker has its own 1300/min service ceiling (api-worker middleware/rate-limit.ts:56-72) whose comment assumes exactly this per-user cap.
- `attachments['__proto__']`-style key lookup (chara-attachment.ts:50): interaction JSON is Discord-signed; the id is a snowflake and a prototype hit would still fail the URL allowlist closed.
- Numeric options (steps, count, colors) not re-clamped in handlers (gradient.ts:38): Discord enforces the registered min/max on a signed payload. Earlier DW-21 is known.
- Free-text options without max_length (color, dye names, tags, world): linear substring search over 125 dyes, echoes are ephemeral or capped, presets-api validates tags.
- Bare URLs in preset descriptions auto-link in public embeds (sanitizer escapes markup and masked links only): by design; content passes Perspective and moderators.
- `<#channel>`, `</cmd:id>` and custom-emoji syntax not defused by sanitizeEmbedText: render-only, no ping.
- Budget info log carries `targetDyeId`, `method`, `threshold` (budget.ts:272, budget-calculator.ts:180): catalog ids / enum values, no user id on the line, Workers Logs off; accepted outcome of 2026-08-29 FINDING-011 / DW-18. Wording nit is a handoff.
- KV key `prefs:v1:unknown` when no user id: index.ts refuses a command with no user id before any handler.
- Cache-API price key poisoning (price-cache.ts:41-43): key parts are canonical world + numeric ids; values come from the fixed binding.
- Image bomb via /extractor image: delegated to image-worker (dimension header check before decode, byte cap, host allowlist); covered by the image-worker review.
- Accepted trade-offs and prior positive controls not re-filed.

## 4. Files covered (read)

apps/discord-worker/src/handlers/commands/: glamour, swatch, budget, preset (1-1300), preset-notifications, stats, preferences (40-420, 690-802), extractor (140-631), dye (40-200), changelog, manual (300-473), gradient (76-135), about (20-80), accessibility (20-80), comparison (36-70); contrast, harmony, mixer-v4 (grep of echoes and flags). src/utils/: chara-attachment, read-text-capped, sanitize, response, discord-api (1-60 and allowed_mentions sites). src/services/: image-client, image-input-errors, fonts, font-coverage, svg/renderer, preset-api (60-170), preferences (96-210, 420-470), budget/universalis-client, budget/price-cache, budget/budget-calculator (150-220). src/index.ts (165-240, 600-660, 713-1010); wrangler.toml; src/commands/schemas.ts (max_length greps); PRIVACY_POLICY.md (14-135).
Cross-package: bot-logic commands/glamour.ts, commands/chara-identity.ts, discord-markdown.ts, input-resolution.ts (1-140); core services/chara/chara-parser.ts, chara-models.ts; svg base.ts, frame.ts, glamour-card.ts (escape sites); worker-kit presets/configs.ts (60-116); api-worker middleware/rate-limit.ts and wrangler ratelimits; presets-api middleware/auth.ts (245-275); image-worker validators.ts (error strings). Evidence files: pii-sinks, outbound-fetch, wrangler-surface, policy-claims (filtered to discord-worker); prior 2026-08-29 and 2026-09-15 reports.

## 5. Candidate table

| cid | sev | exposure | path:line | claim |
|---|---|---|---|---|
| c1 | LOW | INTERNET-AUTH | apps/discord-worker/src/handlers/commands/budget.ts:272 | /budget info logs carry option-derived values (`targetDyeId` from target_dye; `method` and `threshold` from matching / max_distance at services/budget/budget-calculator.ts:180-185), joinable by requestId to the "Handling command" line that carries userId (index.ts:832); PRIVACY_POLICY §5 promises logs never include command option values. Fix the code (drop the fields). Case 1. |
| c2 | LOW | INTERNET-UNAUTH | apps/discord-worker/src/handlers/commands/preset.ts:76-81 | The preset author name sent to presets-api and stored/published is the free-form display name (`global_name`) when set, else username; PRIVACY_POLICY §1 line 20 and §4 line 92 say "Username". Case 3: CORRECT the wording (six-file edit); alternative is to send `username` only. |
| c3 | INFO | INTERNET-UNAUTH | apps/discord-worker/src/handlers/commands/stats.ts:456-458 | Operator-only `/stats preferences` reads a sample of stored preference records and counts whether clan/gender/world are set; PRIVACY_POLICY §4 line 95 ("Usage statistics (/stats)") lists no preference fields. Counts only, no identity. Case 3: CORRECT (six-file edit). |

No code defect with a reachable exploit was found in this slice. /glamour holds on every checklist item: allowlist, no redirects, streamed cap, timeout, bounded parse; nickname / TypeName / filename never reach a log, datapoint, KV key, outbound body, card or embed.

## 6. Handoffs (non-security)

- Bug (unverified, needs a workerd check): preset-api.ts:96-97 sets `X-User-Discord-Name` to the raw display name. A name with characters above U+00FF may make `new Request(...)` throw if the runtime enforces ByteString headers, surfacing as the generic preset-service failure on /preset submit/edit for such users. presets-api reads the header raw (auth.ts:254). Consider encodeURIComponent on both ends.
- Cosmetic: `sanitizeEmbedText(result.errorMessage)` (glamour.ts:168, swatch.ts:130) runs over the whole localized template, so markdown inside the locale string is escaped literally.
- Hardening: no max_length on `tags` (schemas.ts:1089), colour/dye text options and `world`; Discord would reject oversize input before our code runs.
- Trivial: the preferences record keeps an exact `updatedAt` ISO timestamp (preferences handlers write it), shown back to the user, not named in the policy table row.
