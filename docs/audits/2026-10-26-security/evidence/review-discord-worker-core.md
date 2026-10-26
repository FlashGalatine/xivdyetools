# Review: discord-worker-core (deploy unit: discord-worker 5.9.0)

Reviewer key `discord-worker-core`, HEAD 13c386e5, 2026-10-26. Scope: `apps/discord-worker/src` outside `src/commands/`
(entry, router, component/modal/autocomplete handlers, middleware, services, webhook receivers, utils). Command handlers
under `handlers/commands/` were read only where an admin gate or webhook builder lives (`stats.ts`, `preset-notifications.ts`).

## Route table and authz matrix

| Route | Auth | Order of checks | Body cap | Rate limit | Notes |
|---|---|---|---|---|---|
| `GET /health` | none | env-validation mw, then handler | n/a | none | static JSON + timestamp (index.ts:277-283) |
| `POST /` (interactions) | Ed25519 (`verifyDiscordRequest`) | verify BEFORE `JSON.parse` (index.ts:807-822) | 100 KB streamed, cancel above cap (packages/auth/src/discord.ts:42,119-128) | per user per command (native `RL_*`) | timestamp window 300 s (discord.ts:45,99-109) |
| `POST /webhooks/preset-submission` | Bearer `INTERNAL_WEBHOOK_SECRET`, `timingSafeEqual` | secret-present -> prod length floor 32 (503) -> compare -> capped read -> parse (index.ts:303-350) | 10 KiB streamed (`readTextCapped`, index.ts:335) | none (FINDING-027 open, not re-filed) | preview key validated (78 chars, uuid/uuid.webp, prefix = preset id) before custom_id built (index.ts:360-362; types/preset.ts:205-210) |
| `POST /webhooks/github` | HMAC-SHA256 `X-Hub-Signature-256` | declared-length 413 -> streamed 1 MiB raw-byte cap -> HMAC over undecoded bytes -> event allowlist -> parse -> pinned repo (index.ts:605-684) | 1 MiB | none (HMAC cannot be guessed online) | changelog fetched from pinned raw.githubusercontent URL, 10 s timeout (index.ts:711-713); memo `announced:v:<ver>` after successful send |

Interaction sub-router (all behind Ed25519):

| Interaction | Handler | Authz | Rate limit |
|---|---|---|---|
| PING | pong | - | - |
| APPLICATION_COMMAND | `handleCommand` switch (index.ts:905-1095) | missing userId -> refuse (index.ts:915); `/stats overview|commands|health` gated by `STATS_AUTHORIZED_USERS`, allow-list switch (stats.ts:71-77,106-118) | every command incl. `/stats`, `/about`, `/manual`, `/changelog` (index.ts:952-973) |
| AUTOCOMPLETE | `handleAutocomplete` (index.ts:1100-1250) | `/preset edit` -> caller's own presets via `X-User-Discord-ID`; `favorite remove` -> caller's KV favourites; others approved-only | `autocomplete` tier (index.ts:1111-1128) |
| MESSAGE_COMPONENT | `handleButtonInteraction` | copy_* (no authz needed, ephemeral, ids built from dye DB); `previewimg_*` -> custom_id parsed to UUID/key BEFORE authz, then `isModerator` (MODERATOR_IDS, snowflake-validated, fail-closed when unset) BEFORE any API call (preview-image.ts:155-163; bot-logic moderators.ts:44-48); presets-api re-checks | none (see DCORE-02) |
| MODAL_SUBMIT | `handleModal` | none registered; fixed ephemeral reply (index.ts:1516-1528) | none (no work done) |

## Candidates (leads)

- **DCORE-01 (INFO, INTERNAL)** v2 bot signature binds `URL.pathname` only, so a GET's query string (`status`, `search`, `sort`, `page`, `limit`) is outside the HMAC. `services/preset-api.ts:120` signs `new URL(\`https://internal${path}\`).pathname` while `getPresets` puts the filters in `?…` (preset-api.ts:219-229); presets-api verifies against the same pathname (`apps/presets-api/src/middleware/auth.ts:315`), so the two sides agree and the request travels only over the `PRESETS_API` service binding (no interceptor). No reachable attacker today; recorded so the "binds the request" positive control is read precisely.
- **DCORE-02 (INFO, INTERNET-AUTH)** Message-component interactions skip the per-user limiter. `handleComponent` (index.ts:1471-1490) dispatches straight to `handleButtonInteraction` with no `checkRateLimit`; each copy-button click costs an Analytics Engine write (`trackButtonClick`, command-trace.ts:184-207) plus a KV preference read for rgb/hsv (`buttons/index.ts:74-84`). Bounded: AE-only (no KV writes, analytics.ts:255), Discord throttles clients, preview buttons are moderator-gated.

## Positive controls (verified in this checkout)

- Ed25519 verification before any parse, streamed 100 KB cap with cancel, 300 s freshness window (`packages/auth/src/discord.ts:42-147`; index.ts:807-822).
- Env middleware refuses every request on missing `DISCORD_TOKEN`/`DISCORD_PUBLIC_KEY` or a production `RL_*` gap (index.ts:226-260).
- CORS pinned to the two web origins and GET/POST/OPTIONS (index.ts:205-211); security headers on every response (index.ts:264-272); shaped `onError` returns a generic 500 (index.ts:1538-1546).
- preset-submission webhook: config-missing and wrong-secret both 401; production 32-char floor answered 503 before comparison, independent of the header (index.ts:303-329); auth precedes body read; every user string sanitized (`sanitizePresetName`/`Description`, tags, author) in both embeds (index.ts:374,496,517-520; preset-notifications.ts:153-183); log line carries only preset id/source/isEdit (index.ts:433-437).
- GitHub webhook: hand-rolled HMAC compares fixed-length hex with `crypto.subtle.timingSafeEqual` or XOR fallback (utils/github-verify.ts:64-83); repo and announce URL are constants; rejected repo name never logged (index.ts:681-684).
- `previewimg_*` custom_id: exact 78-char `uuid/uuid.webp` key, 19+78=97 <= 100 chars; legacy UUID-only id only triggers a refresh, never an action (preview-image.ts:103-120,165-172). Moderator display name sanitized, never a `<@id>` mention (preview-image.ts:279).
- presets-api client: every user-influenced path segment `encodeURIComponent`-ed; 10 s `AbortSignal.timeout`; v2 HMAC with fresh nonce, length-prefixed canonical string (preset-api.ts:106-129,137; packages/auth/src/hmac.ts:280-292).
- Outbound targets are fixed: `https://discord.com/api/v10` (discord-api.ts:12), service bindings (`https://internal…`, `https://image-worker/extract`), pinned GitHub raw URL; `.chara` downloads https-only to `cdn.discordapp.com`/`media.discordapp.net`, `redirect: 'manual'`, 10 s, 8 KiB counted cap, filename must end `.chara` (utils/chara-attachment.ts:42-58,79-127). All REST bodies default `allowed_mentions: { parse: [] }` (discord-api.ts:31,84,108,173,196,417,451).
- Logging: only the two policy-named lines carry userId (index.ts:922,967; PRIVACY_POLICY.md:129); preference/favourite failures log key names, types and lengths only (preferences.ts:353-362,679-683); KV keys derive solely from the signed interaction user id (`prefs:v1:`, `firstrun:v5:`, `xivdye:preset_favorites:v2:`).
- Analytics: blobs are command/subcommand names (Discord-registered enums), `guild|dm`, locale bucket, outcome class; never option values (analytics.ts:90-106; command-trace.ts:334-357).
- Module-scope state holds no per-user secrets: limiter instance + warning flags (rate-limiter.ts:102-112), public world/DC caches, fonts, a capped (10k) per-isolate user-id memo of empty legacy keys (preferences.ts:600-611), a WeakMap of traces keyed by the interaction object (command-trace.ts:73).
- World input validated against the Universalis world list before it reaches a cache key or path; path segment `encodeURIComponent`-ed (universalis-client.ts:222; budget.ts:175,567).

## Rejected (one-line reasons)

- `handleComponent`/`handleModal`/unknown-button log the raw custom_id (index.ts:1480,1523; buttons/index.ts:96) - custom_ids are bot-built (dye hex from DB, preset ids, preview keys); none personal, and Discord only delivers ids of components the bot posted.
- Submission-log failure logs Discord's error body (index.ts:572) / safe* helpers log body (discord-api.ts:270,315) - Discord validation errors carry codes/messages, not field values; INFO at most.
- GitHub webhook secret has no length floor / no failed-auth limit - HMAC-SHA256 tag cannot be guessed online; secret never leaves the box.
- preset-submission webhook has no failed-auth limit - already 2026-10-03 FINDING-027 (OPEN, presets-api part); not re-filed.
- `/webhooks/github` answers 500 "Not configured" before auth when `ANNOUNCEMENT_CHANNEL_ID` is unset (index.ts:600-603) - var declared in both wrangler blocks; unreachable.
- Interaction replay within the 300 s window - needs a TLS-position capture of a Discord-signed request; prior positive control.
- Changelog `text()` unbounded (index.ts:720) - pinned to the project's own repository on raw.githubusercontent.com.
- `validateEnv` echoes a malformed `MODERATOR_IDS` entry to console (env-validation.ts:105) - staff config, live-tail only, Workers Logs off.
- `/stats` admin gate splits on commas only (stats.ts:76) - mis-parse fails closed; allow-list switch rejects unknown subcommands.
- Autocomplete skips the limiter when no user id (index.ts:1112) - Discord always sends one on autocomplete.

## Not covered

- `handlers/commands/*` beyond the gate checks above (budget/glamour/swatch/preset logging of option values belongs to the command reviewer); in particular, whether any command logs `UniversalisError.message` that could echo a typed world through api-worker's 404 text (`apps/api-worker/src/index.ts:199`).
- Beta worker (`workers_dev = true`, `ENVIRONMENT = "development"`) shares the production `PRESETS_API` binding and skips the 32-char webhook floor; whether beta holds production `BOT_SIGNING_SECRET` / a real `MODERATION_CHANNEL_ID` / an `INTERNAL_WEBHOOK_SECRET` is secret config not visible in the repo.
- `services/announcements.ts`, `changelog-parser.ts`, `svg/renderer.ts`, `fonts.ts`, `font-coverage.ts`, `emoji.ts`, `budget/budget-calculator.ts`, `quick-picks.ts` read only by grep.

## Files covered

27 files opened or grepped: `apps/discord-worker/src/` (index.ts; handlers/buttons/{index,copy,preview-image}.ts; services/{preset-api,rate-limiter,preferences,analytics,command-trace,image-client,preset-favorites}.ts; services/budget/{universalis-client,price-cache}.ts; utils/{github-verify,read-text-capped,chara-attachment,discord-api,env-validation,response}.ts; types/preset.ts; handlers/commands/{stats,preset-notifications}.ts), `apps/discord-worker/{wrangler.toml,PRIVACY_POLICY.md}`, `packages/auth/src/{discord,hmac}.ts`, `packages/bot-logic/src/moderators.ts`, `apps/presets-api/src/middleware/auth.ts` (grep), `apps/api-worker/src/universalis/router.ts` (grep).
