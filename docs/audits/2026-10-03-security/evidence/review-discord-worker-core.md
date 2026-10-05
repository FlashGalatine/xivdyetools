# Review: discord-worker-core (2026-10-03, commit 0ab33466)

Scope: apps/discord-worker interaction entry + infrastructure half. Read-only; no probe scripts written.

## 1. Entry points and authz matrix

| Entry | Reachable by | Guards before handler (in order) | Body / param caps |
|---|---|---|---|
| GET /health (index.ts:219) | anyone (bot.xivdyetools.app, projectgalatine.com alias; beta also *.workers.dev) | CORS allowlist (index.ts:142), request-id, logger, validateEnv (500 if DISCORD_TOKEN/PUBLIC_KEY/prod RL_* missing, :160-185), security headers | none (GET) |
| POST / (index.ts:709) interactions | Discord (any Discord user via Discord) | all of above; then verifyDiscordRequest = Content-Length cap, header presence, timestamp freshness (300 s, +60 s skew), bounded stream read, Ed25519 over the exact bytes (packages/auth/src/discord.ts:70-140); JSON.parse only after isValid | 100 000 B |
| POST /webhooks/preset-submission (:259) | presets-api (service binding), but also public via the custom domain | Bearer INTERNAL_WEBHOOK_SECRET via timingSafeEqual, missing secret -> 401 (:266-277); then readTextCapped 10 240 B (:283); type allowlist (submission / preview_image); preview key must be a 78-char UUID/UUID.webp and start with `preset.id/` (:304-309) | 10 KiB (declared + streamed) |
| POST /webhooks/github (:499) | GitHub (public URL) | secret + channel configured; Content-Length > 1 MiB -> 413; streamed 1 MiB cap on raw bytes BEFORE HMAC (:524-545); HMAC-SHA256 constant-time (utils/github-verify.ts:35-84); X-GitHub-Event allowlist (ping/push only, :569-576); repository.full_name pinned (:586); ref main only; changelog touched; fetch of a pinned URL (10 s timeout); KV memo `announced:v:<ver>` (90 d) | 1 MiB |
| Slash commands (handleCommand :815) | any Discord user | signature (above); userId required; per-user rate limit on every command incl. /about, /manual, /changelog, /stats (:850-885); aliases share a bucket | Discord option limits; schemas max_length |
| Autocomplete (handleAutocomplete :902) | any Discord user | signature; `autocomplete` RL_70 tier (fail-soft, empty choices); preset autocomplete lists status:'approved' only, own presets by signed userId | n/a |
| Components: copy_hex/rgb/hsv | any Discord user | signature; component_type===2; ephemeral reply to the clicker | custom_id <= 100 (Discord) |
| Components: previewimg_approve_/reject_ (handlers/buttons/preview-image.ts) | MODERATOR_IDS only | signature; parseCustomId (UUID or 78-char key), isValidPresetId, userId present, presetApi.isModerator (isModeratorId: snowflake + parsed list, fail closed) BEFORE any API call (:123-135); then v2-signed PATCH with the clicker identity; presets-api re-checks | custom_id 97 chars |
| Modal submit (:1355) | any | signature | static "unknown modal" reply |
| Bindings out | PRESETS_API (v2 signed, 10 s), IMAGE_WORKER (/extract, 10 s), UNIVERSALIS_PROXY, KV, ANALYTICS, RL_5..RL_70 (both envs) | | |

Admin gates in scope: preview-image buttons (MODERATOR_IDS). /stats admin sub-commands (STATS_AUTHORIZED_USERS) and /preset moderate live in the commands half (other reviewer).

## 2. Positive controls

- Ed25519 verified on the bounded body before parse, with freshness: packages/auth/src/discord.ts:70-140; consumer index.ts:712-731 (2026-09-15 FINDING-001 holds).
- GitHub hook: independent 1 MiB raw-byte cap before HMAC (index.ts:524-545), constant-time compare (github-verify.ts:62-76), event allowlist (:569-576), repo pinned (:586), changelog URL and link constants (:106-107), version memo written only after a successful send (:664-696). 2026-09-15 FINDING-003 and 2026-08-29 FINDING-021 hold.
- Preset webhook: timingSafeEqual on padded buffers (packages/auth/src/timing.ts:27-55), secret absence checked first, streamed 10 KiB cap, preview key strictly validated (types/preset.ts:163-168) so the embed image URL and `custom_id` cannot carry attacker text.
- Every outbound Discord message in utils/discord-api.ts carries `allowed_mentions: {parse: []}` unless overridden (:25-31, :89, :143, :172, :228, :351, :387); user-authored preset text goes through sanitizeEmbedText (utils/sanitize.ts:56-72, index.ts:299, 445-449).
- v2 bot signature (method, pathname, body hash, nonce, identity, 60 s) and no v1 header (services/preset-api.ts:96-123); every path segment encodeURIComponent'd; 10 s timeouts.
- Rate limiter: native RL_* tiers keyed `<userId>:<cmd>`; production refuses requests when a tier is unbound (env-validation.ts:132-147, index.ts:176-184); KV fallback warned once. Fail-open is an accepted trade-off.
- Analytics datapoint (services/analytics.ts:88-103): command, user id, `guild`/`dm`, answered flag, outcome class, subcommand, locale bucket, kind, latency. Matches the tier-A spec and policy section 2 *Usage Analytics*; the guild id is never written. `usertrack:` and `stats:` keys 30 d TTL; `firstrun:v5:` 180 d (index.ts:773-801); all match policy sections 2 and 8.
- Preferences: world capped at 32 chars with control-char check (preferences.ts:75-100); failure log carries key/type/length, not values (:283-292).
- Logger middleware does not log User-Agent (worker-kit logger.ts, logUserAgent=false); no `[observability]` block in wrangler.toml (consistent with the policy's "Workers Logs off"; dashboard state not verifiable offline).
- Secrets: none in [vars] (DISCORD_CLIENT_ID and channel id are not secret); `.dev.vars` is ignored (.gitignore:11); CORS exact-match origins (index.ts:142-148); onError returns a generic 500 (index.ts:1380-1389).
- Chara download: Discord CDN host allowlist, redirect:'manual', 10 s, 1 MiB streamed cap (utils/chara-attachment.ts).

## 3. Rejected items

- Replay of a captured signed interaction within 5 min: needs traffic capture over TLS; the freshness window is the intended control.
- GitHub announce memo TOCTOU (get at index.ts:654, put at :692): only a simultaneous double delivery could double-post; effect is a duplicate announcement, INFO.
- messageResponse/ephemeralResponse (utils/response.ts) have no allowed_mentions field: every current non-follow-up caller sends embeds or ephemeral text only (checked preset.ts, dye.ts, extractor.ts, stats.ts, mixer-v4.ts: no `content:`), so nothing can ping. Hardening only.
- Unauthenticated hammering of /webhooks/*: auth runs before parse and work; secret strength is operational.
- Copy-button custom_id contents (copy.ts): produced by the bot, users cannot edit component ids, output is an ephemeral code block.
- Discord error body logged in discord-api.ts:270,315: error JSON carries field paths, not user content.
- `prefs.updatedAt` ISO timestamp: shown to the user in /preferences show, part of the disclosed Preferences record.
- validateEnv comma-only MODERATOR_IDS split vs the shared grammar: non-fatal, fail-closed direction.
- Query string outside the v2 signature (preset-api.ts:107 signs pathname only): read-only GET filters, nonce single-use, internal binding; passed to presets-api reviewer.
- Accepted trade-offs (KV limiter race, fail-open limiter) not re-filed.

## 4. Files covered

apps/discord-worker: src/index.ts; src/utils/{discord-api,env-validation,github-verify,read-text-capped,response,sanitize,brand,text,chara-attachment}.ts; src/handlers/buttons/{index,copy,preview-image}.ts; src/services/{preset-api,image-client,rate-limiter,announcements,analytics,command-trace,preferences (1-345, 480-565),preset-favorites,changelog-parser,emoji,bot-i18n,i18n}.ts; src/commands/{registry.ts, schemas.ts (grep for limits/permissions), localize.ts (header)}; src/types/{env,github,preset,preferences}.ts; wrangler.toml; PRIVACY_POLICY.md.
Cross-reads: packages/auth/src/{discord,timing}.ts; packages/bot-logic/src/{moderators,discord-markdown,localization}.ts and src/i18n/locale-resolution.ts; packages/worker-kit/src/middleware/{logger,request-id}.ts; apps/presets-api/src/middleware/auth.ts (bot-auth section); apps/discord-worker/src/handlers/commands/{preset-notifications,preferences,stats}.ts (targeted); docs/superpowers/specs/2026-08-29-bot-analytics-tier-a-design.md. Evidence inventories filtered to discord-worker: pii-sinks, outbound-fetch, wrangler-surface, potential-secrets.

## 5. Candidates

| cid | sev | exposure | path:line | claim |
|---|---|---|---|---|
| c1 | MEDIUM | INTERNET-AUTH | apps/discord-worker/src/services/preferences.ts:313-317 (+ :499-545, packages/bot-logic/src/i18n/locale-resolution.ts:141-168) | `/preferences reset` (and last-key reset) deletes only `prefs:v1:<id>`; legacy `i18n:user:<id>` and `budget:world:v1:<id>` are never deleted, so the next read re-migrates language and home world, and resolveUserLocale keeps honoring the legacy language. Policy section 7 promise of reset is untrue for legacy users. |
| c2 | LOW | INTERNET-AUTH | apps/discord-worker/src/services/preferences.ts:546; src/services/preset-favorites.ts:99,160,189 | Four log lines carry `userId` (three with presetId) beyond the two the policy names in section 5 "Operational Logs" (command start, rate limited). Persistent logs are off, so impact is a live tail only, but it contradicts the stated list. |

### c1 evidence
```
preferences.ts:313-317  if (!key) { // Reset all - delete the entire preferences object
                          await kv.delete(buildPrefsKey(userId)); return true; }
preferences.ts:499      * Legacy keys are NOT deleted - they serve as fallback during transition.
preferences.ts:518-533  kv.get(`${LEGACY_I18N_PREFIX}${userId}`) ... kv.get(`${LEGACY_WORLD_PREFIX}${userId}`)
locale-resolution.ts:141 legacy per-user key (`i18n:user:<id>`) is step 2 of resolveUserLocale
```
No code deletes either legacy key (git grep for `i18n:user` / `budget:world` finds only these readers). Trigger: a user whose preferences predate v4 runs `/preferences reset`, then any command; world and language return. Fix the code: delete both legacy keys in resetPreference (all-keys path and the empty-after-delete path) and after a successful migration write. Policy NONE.

### c2 evidence
```
preferences.ts:546  logger.info('Migrated legacy preferences to unified format', { userId, keys: Object.keys(prefs) });
preset-favorites.ts:160,189  logger.error('Failed to add|remove preset favorite', ..., { userId, presetId });
preset-favorites.ts:99  { userId } on 'Failed to get preset favorite entries'
```
Fix the code (drop userId; presetId alone suffices). Policy NONE.

## 6. Handoffs

- presets-api: the bot sends `X-User-Discord-Name` for moderator actions (preset-api.ts, getPendingPreviewImage and setPreviewImageStatus) though presets-api authorizes from the id; confirm it is not persisted and consider dropping it.
- presets-api: the v2 signature path excludes the query string (preset-api.ts:107).
- commands-half reviewer: /stats admin gate splits STATS_AUTHORIZED_USERS on comma only; response.ts builders cannot carry allowed_mentions if a non-ephemeral `content` reply is ever added.
- Ops: confirm in the Cloudflare dashboard that Workers Logs are off for both discord-worker scripts (policy section 5 depends on it); wrangler.toml has no observability block.
- Plain bugs: first-run follow-up (index.ts:889-893) can race the initial interaction response; validateEnv MODERATOR_IDS grammar differs from isModeratorId (newline separators flagged invalid).
- Docs: preferences.ts header comment about legacy keys "during transition" is stale once c1 is fixed.
