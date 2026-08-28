# Manual security review — `apps/discord-worker` (+ `packages/bot-logic/src`)

- **Audit:** 2026-08-21 monorepo security audit (see `../AUDIT_MANIFEST.md`)
- **Branch / commit:** `monorepo-2.0-prep` @ `08a8f522`
- **Unit version:** discord-worker 5.0.0, bot-logic 2.0.0, auth 1.3.0 (verification helper), worker-kit 1.0.0 (rate limiter), svg 2.0.0 (text escaping)
- **Reviewer:** Claude Code (Fable 5) — read-only manual review; no source files modified
- **Method:** every non-test file under `apps/discord-worker/src` was read in full (see Coverage); call paths were traced through `packages/auth`, `packages/bot-logic`, `packages/worker-kit/src/rate-limiter`, `packages/svg/src/{base,frame,preset-swatch}.ts`, `apps/image-worker/src/{index,validators}.ts`, `apps/presets-api/src/middleware/auth.ts` and the presets-api route tables where a claim depended on the far side of a service binding.
- **Severity scale:** CRITICAL / HIGH / MEDIUM / LOW / INFO. Confidence: CONFIRMED (read at the cited lines, exploit path traced end-to-end) or PLAUSIBLE (depends on deployment state or external facts not verifiable from the repo).

## Executive summary

No CRITICAL, HIGH or MEDIUM findings. The interaction endpoint is correctly Ed25519-verified over the raw body on the only route that accepts Discord traffic; both webhook routes authenticate (timing-safe bearer / HMAC-SHA256) and fail closed when their secret is unset; admin and moderation actions are gated on explicit ID allowlists and re-checked server-side; image fetching is delegated to image-worker, which owns a strict Discord-CDN allowlist; SVG card text is XML-escaped; and rate limiting is per-user, per-command with tighter tiers on the expensive paths.

What remains is a cluster of LOW defence-in-depth items, mostly in the "user text → bot output" and "user string → URL path" classes:

| ID | Sev | Location | Title |
|----|-----|----------|-------|
| DW-1 | LOW | `handlers/commands/preset.ts:953-960, 234-238, 1001-1012` | Stored preset name/description/tags/author rendered unsanitized and markdown-unescaped in public bot embeds (and the submission-log path skips the sanitizer that the moderation path uses) |
| DW-2 | LOW | `handlers/commands/swatch.ts:76-78, 113-121` + `packages/core/src/services/chara/chara-parser.ts:196-202, 240-246, 258-268` | `.chara` field values are echoed verbatim into a **public** error embed — any user can make the bot post arbitrary text/masked links |
| DW-3 | LOW | `services/preset-api.ts:237, 341, 360, 373, 390, 433` | User-controlled preset IDs interpolated unencoded into presets-api URL paths (route steering / path traversal under the caller's own bot-auth identity) |
| DW-4 | LOW | `handlers/commands/swatch.ts:54-62, 92, 104` | `/swatch` fetches the attachment URL with no host allowlist, no timeout and no post-download size check (trusts Discord-supplied `size`) |
| DW-5 | LOW | `packages/auth/src/discord.ts:58-118`, `src/index.ts:518` | No freshness window on `X-Signature-Timestamp` — a captured signed interaction can be replayed indefinitely |
| DW-6 | LOW | `services/analytics.ts:49-66, 179-191`; `PRIVACY_POLICY.md:17-20` | Discord user IDs and guild IDs written to Analytics Engine/KV while the privacy policy says guild IDs are "Not stored (ephemeral)" |
| DW-7 | LOW | `src/index.ts:632` + `handlers/commands/stats.ts:144-188` + `services/analytics.ts:221-290` | Public `/stats summary` is exempt from rate limiting yet runs paginated KV `list()` scans per call |
| DW-8 | LOW (PLAUSIBLE) | `handlers/commands/stats.ts:175-177` | Hardcoded links to `xivdyetools.com` / `docs.xivdyetools.com` / `discord.gg/xivdyetools` diverge from `PRODUCT_LINKS` (`xivdyetools.app`) — dangling-domain risk if those are no longer owned |
| DW-9 | LOW | `handlers/commands/budget.ts:136, 167, 419, 431` | `/budget find|quick world:` override bypasses `validateWorld()` (only `set_world` validates) — arbitrary strings reach api-worker/Universalis and the shared Cache API key space |
| DW-10 | INFO | `utils/discord-api.ts:60-73, 147-150, 283-297` | No `allowed_mentions` on any outbound Discord payload (no current user-text→`content` sink, but no safety net either) |
| DW-11 | INFO | `services/preset-api.ts:52-60`, `packages/auth/src/hmac.ts:237-277` | Bot HMAC signature binds only `timestamp:userId:userName`, not method/path/body |
| DW-12 | INFO | `src/index.ts:467-474` | GitHub webhook builds the raw-changelog URL from `payload.repository.full_name` without pinning to the expected repository |
| DW-13 | INFO | `src/index.ts:196-209, 243-247, 257, 264, 350` | `/webhooks/preset-submission`: Content-Length-only size check, `preview_image_key` / `preset.id` interpolated unvalidated into an image URL and `custom_id`s, `author_name` unsanitized in the submission-log embed |
| DW-14 | INFO | `wrangler.toml:12-39` | Beta worker is on public `workers.dev` and shares the PRODUCTION presets-api / api-worker / image-worker bindings; safety hinges on beta not holding `BOT_API_SECRET`/`BOT_SIGNING_SECRET` and on the beta app's install policy |
| DW-15 | INFO | `services/rate-limiter.ts:172-198`; `packages/worker-kit/src/rate-limiter/backends/{kv.ts:161-180, upstash.ts:97-113}` | Rate limiter fails open on backend errors; KV fallback is best-effort non-atomic (documented design) |
| DW-16 | INFO | `handlers/commands/dye.ts:112-121, 134-141` | `/dye search` echoes the raw query into a public embed title (bounded, no link rendering) |
| DW-17 | INFO | `src/index.ts:582-586` | `firstrun:v5:{userId}` KV flags written without TTL (unbounded key growth) |
| DW-18 | INFO | `src/index.ts:627, 1079`; `handlers/buttons/index.ts:65`; `services/preferences.ts:465-468` | Discord user IDs / `custom_id`s logged at info level (pseudonymous PII in logs) |
| DW-19 | INFO | `handlers/buttons/copy.ts:50-62, 84-96` | `custom_id` numeric parts parsed with `Number()` without validation (NaN echoed ephemerally) |
| DW-20 | INFO | `services/preset-api.ts:140-155` | presets-api service-binding fetch has no timeout/AbortSignal (the Universalis client does) |
| DW-21 | INFO | `handlers/commands/gradient.ts:37`; `packages/bot-logic/src/commands/gradient.ts:144` | `steps` not clamped in handler or bot-logic — relies solely on Discord's schema `min_value/max_value` (harmony/extractor/budget clamp theirs) |

---

## Route table — `src/index.ts`

| Method / path | Verification / auth | Who can reach it | Notes |
|---|---|---|---|
| `OPTIONS *` | CORS preflight (`hono/cors`, origins `https://xivdyetools.app`, `https://www.xivdyetools.app`; methods GET/POST/OPTIONS) — `index.ts:101-107` | anyone | preflight only |
| `GET /health` | none — `index.ts:158-164` | anyone | returns `{status, service, timestamp}`; no secrets |
| `POST /` | **Ed25519** via `verifyDiscordRequest(c.req.raw, env.DISCORD_PUBLIC_KEY)` — `index.ts:518`; `packages/auth/src/discord.ts:58-118` (Content-Length ≤100 KB pre-check, byte-accurate body cap, both signature headers required, raw body passed to `discord-interactions.verifyKey`, same raw string then `JSON.parse`d at `index.ts:530`) | Discord only (or a holder of the app's private key) | PING→PONG; APPLICATION_COMMAND → `handleCommand` (rate-limited per user/command, `index.ts:632-649`); AUTOCOMPLETE → `handleAutocomplete` (60/min+burst, `index.ts:801-816`); MESSAGE_COMPONENT → `handleComponent` (no rate limit; buttons only); MODAL_SUBMIT → static "unknown modal" |
| `POST /webhooks/preset-submission` | `Authorization: Bearer <INTERNAL_WEBHOOK_SECRET>` compared with `timingSafeEqual`; **401 when the secret is unset** — `index.ts:178-193` | presets-api (service binding) — but the path is also reachable by any HTTP client on `bot.xivdyetools.app` that knows the secret | Content-Length ≤10 KB (`196-201`); discriminated payload `submission` / `preview_image` (`211-216`) |
| `POST /webhooks/github` | `X-Hub-Signature-256` HMAC-SHA256 over the raw body, constant-time compare (`utils/github-verify.ts:35-83`); **401 when `GITHUB_WEBHOOK_SECRET` unset**, 500 when `ANNOUNCEMENT_CHANNEL_ID` unset — `index.ts:406-441` | GitHub (or a holder of the webhook secret) | Content-Length ≤10 KB **and** post-read byte check (`416-432`); only `refs/heads/main` + `CHANGELOG-laymans.md` touches proceed |
| anything else | — | — | Hono default 404; `app.onError` returns a shaped generic 500 (`index.ts:1132-1140`) |

No route bypasses verification: the only route that parses Discord interactions is `POST /`, and the two webhook routes each carry their own independent secret. Nothing in the middleware chain (`cors` → `requestIdMiddleware` → `loggerMiddleware` → env validation → security headers) consumes the request body before `verifyDiscordRequest` reads it.

**Internal endpoints called by presets-api:** only `/webhooks/preset-submission` (over the `DISCORD_WORKER` service binding, `apps/presets-api/src/services/notification-service.ts:94-110`, `Authorization: Bearer ${INTERNAL_WEBHOOK_SECRET}`). Because the worker has custom domains, the same URL is reachable from the public internet — the bearer secret is the only gate, and it is timing-safe and fail-closed. Acceptable; see DW-13 for the residual input-handling nits on that route.

**`index.ts:472` changelog fetch:** reachable only after a valid GitHub HMAC signature; URL is `https://raw.githubusercontent.com/${payload.repository.full_name}/main/CHANGELOG-laymans.md` with `full_name` taken from the signed payload (see DW-12); host is fixed, 10 s timeout.

---

## Findings

### DW-1 — Stored preset text rendered unsanitized / markdown-unescaped in public bot embeds; submission-log path skips the sanitizer

- **Severity:** LOW — content spoofing through a trusted bot identity (masked links, bold/markdown, zalgo) in public channels; mitigated by the presets-api moderation pipeline, author attribution on the embed, Discord's external-link interstitial for masked links, and the fact that embed text cannot ping (`@everyone`/role mentions in embeds do not notify).
- **CWE:** CWE-116 (Improper Encoding or Escaping of Output)
- **Confidence:** CONFIRMED
- **Where:**
  - `apps/discord-worker/src/handlers/commands/preset.ts:950-978` (`sendPresetEmbed`, used by `/preset show` and `/preset random`, **public** deferred response):
    ```ts
    title: `${categoryDisplay?.icon || '🎨'} ${preset.name}`,
    description: [
      preset.description,
      ...
      preset.tags.length > 0 ? `**${t.t('preset.tags')}:** ${preset.tags.join(', ')}` : '',
    ```
  - `preset.ts:234-238` (`/preset list`): `` `**${index + 1}.** ${catIcon} ${preset.name} (${preset.vote_count}★)${author}` `` — `author` interpolates `preset.author_name`.
  - `preset.ts:998-1025` (`notifySubmissionChannel`, the auto-approved path posted to `SUBMISSION_LOG_CHANNEL_ID`): `` title: `${statusDisplay.icon} New Preset: ${preset.name}` ``, `description: preset.description`, `value: preset.author_name || 'Unknown'` — none sanitized, whereas the sibling webhook path (`index.ts:336-337`) and `preset-notifications.ts:77-79` do call `sanitizePresetName/Description` (BUG-072 was fixed for moderation embeds only).
  - presets-api validates name/description **by length only** (`apps/presets-api/src/services/validation-service.ts:177-211`) — no charset/markdown/URL restriction — so `[text](https://…)`, `**`, `||spoiler||`, zero-width/zalgo characters are all storable.
- **Exploit scenario:** a user submits a preset whose description is clean of profanity but contains `Claim free Mog Station codes → [here](https://phish.example)`; content moderation auto-approves; anyone running `/preset show` / `/preset random` / `/preset list` in any guild gets a public embed, authored by the bot, rendering a clickable masked link. Zalgo/invisible characters in the name also reach the public embed title and the auto-approved submission log (the code's own `sanitizeDisplayText` exists precisely to strip them but is not applied on these paths).
- **Fix:** route all user-authored preset text through one display helper before embedding: `sanitizePresetName/Description` (already present) **plus** markdown escaping (`\` before `*_~|`` `>` and `[`/`]`), strip or neutralise URLs / masked-link syntax (or render names in code spans ``` `name` ```), apply to `sendPresetEmbed`, the `/preset list` lines, `notifySubmissionChannel`, and the duplicate-name echoes at `preset.ts:511, 828`. Consider `allowed_mentions: { parse: [] }` on every outbound payload as a belt-and-braces (DW-10).

### DW-2 — `.chara` field values echoed verbatim into a public error embed (`/swatch`)

- **Severity:** LOW — "bot as megaphone": any user can make the bot post attacker-chosen text (incl. masked links) in a public channel; no privilege gain, no pings (embed), but the bot's identity lends authority and the text is not attributed to the user the way a normal message is.
- **CWE:** CWE-116 / CWE-209 (error message carrying untrusted data)
- **Confidence:** CONFIRMED
- **Where:**
  - `apps/discord-worker/src/handlers/commands/swatch.ts:76-78` — `deferredResponse()` is **non-ephemeral**; `swatch.ts:115-121`:
    ```ts
    if (!result.ok) {
      ...
      await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
        embeds: [errorEmbed(t.t('common.error'), result.errorMessage)],
    ```
  - `packages/bot-logic/src/commands/swatch.ts:184-194` wraps the parser error: `errorMessage: t.t('card.swatchParseError', { message })` with `message = error.message`.
  - `packages/core/src/services/chara/chara-parser.ts:196-202, 240-246, 258-268` build that message from the file: `` `.chara field ${field}: unparseable float colour "${value}"` ``, `` `... expected a numeric palette index, got ${JSON.stringify(value)}` ``, `` `... unrecognised value "${value}" (...)` `` — `value` is attacker-controlled file content (up to the 1 MiB cap at `swatch.ts:24-25`).
- **Exploit scenario:** upload a 2 KB `.chara` JSON with `"SkinColor": "[Free gil — click](https://phish.example) … "` → `/swatch file:<that>` → the bot edits its public "thinking…" message into an error embed whose description contains the masked link (embed description limit 4096; longer payloads just fail the edit).
- **Fix:** send parse failures ephemerally (`deferredResponse(true)` for the whole command, or a separate ephemeral follow-up for the error path); and/or have bot-logic map parser errors to a localized, value-free message (keep the field *name*, drop the value, or truncate + code-span it). Same treatment for the `download failed (${status})` branch at `swatch.ts:94-101` (harmless today).

### DW-3 — User-controlled preset IDs interpolated unencoded into presets-api URL paths

- **Severity:** LOW — route steering is confined to the caller's own identity (presets-api re-authorises every write on `X-User-Discord-ID`, and `getPreset`/`searchPresets…` carry no user at all), so no cross-user impact was found; but it is an injection sink and the requests carry `BOT_API_SECRET` + a valid HMAC.
- **CWE:** CWE-74 (Improper Neutralization of Special Elements in Output Used by a Downstream Component) — path-traversal flavour (CWE-22)
- **Confidence:** CONFIRMED (sink); PLAUSIBLE (any concrete abuse — none with cross-user impact was found)
- **Where:** `apps/discord-worker/src/services/preset-api.ts`
  ```ts
  237  return await request<CommunityPreset>(env, 'GET', `/api/v1/presets/${id}`);
  341  return request<PresetEditResponse>(env, 'PATCH', `/api/v1/presets/${presetId}`, {
  360  return request<VoteResponse>(env, 'POST', `/api/v1/votes/${presetId}`, {
  373  return request<VoteResponse>(env, 'DELETE', `/api/v1/votes/${presetId}`, {
  390  `/api/v1/votes/${presetId}/check`,
  433  `/api/v1/moderation/${presetId}/preview-image`,
  141  new Request(`https://internal${path}`, { method, headers, body })
  ```
  `id` / `presetId` arrive straight from slash-command options (`handlers/commands/preset.ts:281, 591, 669, 1114, 1188` — free-typed strings when the user ignores autocomplete) and from button `custom_id`s (`handlers/buttons/preview-image.ts:85-93`). WHATWG URL parsing resolves `..`, `?` and `#`, so `name:"../moderation/pending"` becomes `GET /api/v1/moderation/pending`, `preset:"x?status=pending"` adds a query string, etc.
- **Exploit scenario (verified as *not* harmful, but reachable):** `/preset show name:"../moderation/pending"` → presets-api receives a bot-authenticated GET with no user context → `requireModerator` 403 → user sees "load failed". `/preset vote preset:"<id>/../../presets/<id2>"` normalises consistently for the check/POST/DELETE pair, and every mutating route re-checks ownership, so the worst found is invoking own-scope routes the bot never exposes (e.g. `DELETE /api/v1/presets/<ownId>` via a crafted vote target once `hasVoted` is true for that path — which it cannot be, since the `/check` suffix normalises elsewhere). Defence-in-depth only.
- **Fix:** `encodeURIComponent()` every path segment in `preset-api.ts`, and validate IDs against the presets-api UUID format (`/^[0-9a-f-]{36}$/`) before issuing the request (autocomplete values are UUIDs; free-typed names should go through `getPresetByName` only, as `resolvePresetByIdOrName` already half-does).

### DW-4 — `/swatch` downloads the attachment with no host allowlist, timeout, or post-download size check

- **Severity:** LOW — the URL comes from `interaction.data.resolved.attachments` inside the Discord-signed payload, so an outsider cannot supply it; this is a missing defence layer relative to the image path, not a live SSRF.
- **CWE:** CWE-400 (Uncontrolled Resource Consumption) / CWE-20
- **Confidence:** CONFIRMED
- **Where:** `apps/discord-worker/src/handlers/commands/swatch.ts`
  ```ts
  58   if (attachment.size > MAX_FILE_BYTES) {       // Discord-reported size only
  92   const fileResponse = await fetch(fileUrl);     // no AbortSignal, no host check, follows redirects
  104  input.fileText = await fileResponse.text();    // unbounded read
  ```
  Contrast `/extractor image`, which hands `attachment.url` to image-worker (`services/image-client.ts:44-50`) where `validateImageUrl` enforces HTTPS + `cdn.discordapp.com`/`media.discordapp.net`, blocks IP literals/private hosts, validates redirect targets, caps 10 MB and checks magic bytes (`apps/image-worker/src/validators.ts:91-171, 316-395`).
- **Exploit scenario:** none external. Internally, a Discord-side bug or a future change that lets a handler be invoked with a non-Discord URL would fetch arbitrary hosts with default redirect-following; a slow CDN response holds the `waitUntil` until the platform limit.
- **Fix:** reuse the image-worker validation rules locally (or a shared helper): assert `new URL(fileUrl).hostname` ∈ {`cdn.discordapp.com`, `media.discordapp.net`}, `redirect: 'error'`, `AbortSignal.timeout(10_000)`, and cap the body by `Content-Length` plus a streamed byte counter (≤1 MiB) before `.text()`.

### DW-5 — No freshness window on `X-Signature-Timestamp` (interaction replay)

- **Severity:** LOW — requires capturing a signed request (Discord→Cloudflare TLS; not logged); replay would re-execute a command (re-toggle a vote, re-submit a preset edit, burn the user's rate-limit budget, re-post a public card). Discord's own reference implementation also omits the window, but it is a common hardening.
- **CWE:** CWE-294 (Authentication Bypass by Capture-replay)
- **Confidence:** CONFIRMED
- **Where:** `packages/auth/src/discord.ts:76-117` — the timestamp header is only required to be present and is fed to `verifyKey(body, signature, timestamp, publicKey)`; no `|now − timestamp| ≤ N` check. Consumer: `apps/discord-worker/src/index.ts:518`.
- **Fix:** in `verifyDiscordRequest`, after signature success reject when `Math.abs(Date.now()/1000 − Number(timestamp)) > 300` (configurable); optionally keep a short-lived KV/memory set of seen `interaction.id`s for idempotency on mutating commands.

### DW-6 — Discord user IDs and guild IDs written to Analytics Engine / KV; privacy policy says guild IDs are not stored

- **Severity:** LOW — pseudonymous identifiers, bounded retention (KV 30 d TTL; Analytics Engine default retention), but the published policy is contradicted.
- **CWE:** CWE-359 (Exposure of Private Personal Information)
- **Confidence:** CONFIRMED
- **Where:** `apps/discord-worker/src/services/analytics.ts:49-66`
  ```ts
  blobs: [ event.commandName, event.userId /* blob2 */, event.guildId || 'dm' /* blob3 */, ... ]
  ```
  called from `index.ts:766-779` with `guildId: interaction.guild_id`; `analytics.ts:179-191` writes `usertrack:{date}:{userId}` (30 d TTL). `PRIVACY_POLICY.md:20`: "Guild ID / Channel ID | Process commands in context | **Not stored (ephemeral)**"; the policy also never mentions Analytics Engine.
- **Fix:** either drop `guildId` from the data point (or hash it with a per-deployment salt) or amend the policy to disclose Analytics Engine telemetry (user/guild IDs, retention). Also consider hashing `userId` in `blob2` — unique-user counts survive hashing.

### DW-7 — Public `/stats summary` is exempt from rate limiting yet runs KV `list()` scans

- **Severity:** LOW — per-call cost is a prefix `list()` over `stats:` plus a full cursor walk over `usertrack:{today}:*` (1000 keys/page); unauthenticated users can call it in a loop (only Discord's own per-app interaction limits apply).
- **CWE:** CWE-770 (Allocation of Resources Without Limits or Throttling)
- **Confidence:** CONFIRMED
- **Where:** `apps/discord-worker/src/index.ts:632` — `if (commandName && !['about', 'manual', 'stats', 'changelog'].includes(commandName))` skips `checkRateLimit` for `/stats`; `handlers/commands/stats.ts:144-149` → `getStats(env.KV)`; `services/analytics.ts:234` (`kv.list({prefix: STATS_PREFIX})`) and `:266-272` (paginated list over `usertrack:{today}:`).
- **Fix:** remove `stats` from the skip list (give it the `default` 15/min bucket), or cache `getStats()` output in memory/KV for ~60 s so the public summary is O(1).

### DW-8 — Hardcoded external links in `/stats summary` point at domains that differ from the product's canonical links

- **Severity:** LOW (PLAUSIBLE) — if `xivdyetools.com` / `docs.xivdyetools.com` / `discord.gg/xivdyetools` are not (or no longer) controlled by the project, the bot is advertising takeover-able destinations; if they are owned, this is a consistency nit.
- **CWE:** CWE-1357-class dangling reference (domain/invite takeover); not a code vulnerability per se
- **Confidence:** PLAUSIBLE — ownership cannot be verified from the repo; the rest of the suite uses `xivdyetools.app` (`packages/core/src/config/product-links.ts:45-51`, `handlers/commands/manual.ts:230-232` uses `https://discord.gg/5VUSKTZCe5`).
- **Where:** `apps/discord-worker/src/handlers/commands/stats.ts:175-177`
  ```ts
  `[${t.t('stats.summary.webApp')}](https://xivdyetools.com)`,
  `[${t.t('stats.summary.documentation')}](https://docs.xivdyetools.com)`,
  `[${t.t('stats.summary.supportServer')}](https://discord.gg/xivdyetools)`,
  ```
  (same stale constants also live in `apps/moderation-worker/src/handlers/commands/preset.ts:34` and `apps/stoat-worker/src/commands/about.ts:26` — noted for the other reviewers.)
- **Fix:** source these from `PRODUCT_LINKS` / `SOCIAL_LINKS` in `@xivdyetools/core` (as `/about` already does) and confirm the `.com` zone and the vanity invite are owned; also `BOT_VERSION = '4.0.0'` at `stats.ts:38` should come from `package.json` like `/about` does.

### DW-9 — `/budget find|quick world:` override bypasses world validation

- **Severity:** LOW — the value is `encodeURIComponent`-ed before it reaches api-worker (`services/budget/universalis-client.ts:222`), so there is no path injection; but arbitrary strings are forwarded to the Universalis proxy on every call (cost/abuse) and are lower-cased into the shared Cache API key (`services/budget/price-cache.ts:40-42`), and `/preferences set world:` stores any non-empty string (`services/preferences.ts:374-380`).
- **CWE:** CWE-20 (Improper Input Validation)
- **Confidence:** CONFIRMED
- **Where:** `apps/discord-worker/src/handlers/commands/budget.ts:136, 167` (`const world = worldOverride ?? prefs.world;` — no `validateWorld`), `:419, 431` (quick), versus `:385` where `set_world` does call `validateWorld(env, worldInput)`.
- **Fix:** run `validateWorld()` (already cached for an hour) on the override and on `/preferences set world:` before use; reject unknown names with the existing `budget.errors.worldNotFound` copy.

### DW-10 — No `allowed_mentions` on outbound Discord payloads (INFO)

- **CWE:** CWE-116 · **Confidence:** CONFIRMED
- `apps/discord-worker/src/utils/discord-api.ts:60-73` (`sendFollowUp`), `:147-150` (`editOriginalResponse`), `:283-297` (`sendMessage`), `:317-320` (`editMessage`) never set `allowed_mentions`. Today the only user-influenced `content` sinks are the ephemeral copy buttons (`handlers/buttons/copy.ts`) and everything else rides in embeds (which do not ping), so there is no live mention-injection path — but a future `content:` interpolation of a preset name or username would ping. Add `allowed_mentions: { parse: [] }` centrally in the four helpers.

### DW-11 — Bot HMAC signature does not bind method/path/body (INFO)

- **CWE:** CWE-345 · **Confidence:** CONFIRMED
- `apps/discord-worker/src/services/preset-api.ts:52-60` signs `` `${timestamp}:${userDiscordId || ''}:${userName || ''}` ``; `packages/auth/src/hmac.ts:237-277` verifies the same, with a 5-minute window and 60 s skew. A signature captured (e.g. from a compromised presets-api log) is therefore valid for **any** route/body as that user for up to 5 minutes, and identical for all routes. Cross-cutting with presets-api/auth; include method + path (+ body hash) in the signed string, or a nonce.

### DW-12 — GitHub webhook does not pin the repository (INFO)

- **CWE:** CWE-20 / CWE-918 (host-bounded) · **Confidence:** CONFIRMED
- `apps/discord-worker/src/index.ts:472`: `` `https://raw.githubusercontent.com/${payload.repository.full_name}/main/CHANGELOG-laymans.md` ``. Reachable only with a valid HMAC, and the host is fixed, but `full_name` is not compared with the expected `FlashGalatine/xivdyetools` (`handlers/commands/changelog.ts:19-20` hardcodes it). A webhook configured on a fork with the same secret (or a leaked secret) could make the bot announce a fork's changelog. Compare `full_name` to an allowlist (or `env.GITHUB_REPO`) and reject otherwise.

### DW-13 — `/webhooks/preset-submission` input-handling nits (INFO)

- **CWE:** CWE-20 · **Confidence:** CONFIRMED · **Where:** `apps/discord-worker/src/index.ts`
  - `:196-209` — size enforced via `Content-Length` only, then `c.req.json()`; the GitHub route (`:416-432`) additionally measures the read body. Authenticated callers only, so low impact.
  - `:243-247` — `` image: { url: `https://shots.xivdyetools.app/${payload.preview_image_key}` } `` with the key unvalidated (could carry `?`/`#`/`..`); `:257, 264` — `preset.id` interpolated into `custom_id`s (≤100 chars, not validated against UUID).
  - `:350` — `value: preset.author_name || 'Unknown'` unsanitized in the submission-log embed while `:336-337` sanitizes name/description (same BUG-072 family as DW-1).
  - Fix: validate `preview_image_key` (`/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/` per presets-api's key shape) and `preset.id` (UUID), sanitize `author_name`, and add the post-read byte check.

### DW-14 — Beta worker on public `workers.dev` with production service bindings (INFO)

- **CWE:** CWE-668 · **Confidence:** CONFIRMED (config), PLAUSIBLE (impact)
- `apps/discord-worker/wrangler.toml:12-39`: `workers_dev = true`, bindings `PRESETS_API = xivdyetools-presets-api`, `UNIVERSALIS_PROXY = xivdyetools-api-worker`, `IMAGE_WORKER = xivdyetools-image-worker` (no `-dev` variants). `POST /` on the beta host only accepts interactions signed by the **beta** Discord application, and the webhook routes 401 without their secrets (the file's comment says beta holds only `DISCORD_TOKEN` + `DISCORD_PUBLIC_KEY`). Residual risk: if `BOT_API_SECRET`/`BOT_SIGNING_SECRET` are ever set on beta, every user of the beta bot writes to production preset data; presets-api (production) rejects unsigned bot auth, so today beta can only read. Keep the beta application private / allowlisted and never add the bot secrets to the `-dev` worker (or point it at a `presets-api-dev` binding).

### DW-15 — Rate limiter fail-open and best-effort KV fallback (INFO)

- **CWE:** CWE-636 · **Confidence:** CONFIRMED
- `apps/discord-worker/src/services/rate-limiter.ts:187-198` returns `allowed: true` on any thrown error; `packages/worker-kit/src/rate-limiter/backends/kv.ts:161-180` and `upstash.ts:97-113` also fail open (`config.failOpen !== false`), and the KV backend is explicitly non-atomic (`kv.ts:12-21, 97-106`). Documented availability-over-strictness decision; noted so that the `/extractor image` 5/min tier is understood to be soft under backend outage. Consider `failOpen: false` for the image tier only, or alerting on `backendError`.

### DW-16 — `/dye search` echoes the query into a public embed title (INFO)

- **CWE:** CWE-116 · **Confidence:** CONFIRMED
- `apps/discord-worker/src/handlers/commands/dye.ts:112-121` (`dye.search.noResults {query}`) and `:134-141` (`dye.search.resultsTitle {query}`) are `messageResponse` **without** `flags: 64`. Titles do not render links or pings and Discord caps them at 256 chars, so this is cosmetic "bot says X"; make the no-results branch ephemeral or truncate/code-span the query.

### DW-17 — `firstrun:v5:{userId}` flags without TTL (INFO)

- **CWE:** CWE-770 · `apps/discord-worker/src/index.ts:582-586` writes one permanent KV key per user who ever runs a command. Tiny, but unbounded; an `expirationTtl` of ~1 year preserves the product behaviour.

### DW-18 — Discord IDs in info-level logs (INFO)

- **CWE:** CWE-532 · `index.ts:627` (`logger.info('Handling command', { command, userId })`), `:646, 1079`, `handlers/buttons/index.ts:65` (`customId`), `services/preferences.ts:465-468` (`userId`). Logger redaction covers secret-named fields only. Pseudonymous, but worth hashing/dropping at info level if logs are retained or shipped externally; loggerMiddleware also records `user-agent` (`packages/worker-kit/src/middleware/logger.ts:143`).

### DW-19 — `copy_*` custom_id parsing without validation (INFO)

- **CWE:** CWE-20 · `handlers/buttons/copy.ts:50-62, 84-96` — `parts.map(Number)` then interpolated into an ephemeral code block; `copy_hex_` echoes the suffix with no hex check (`:27-31`). Only ephemeral self-echo; add `/^\d{1,3}$/` / `/^[0-9A-F]{6}$/i` guards for robustness against persisted/forged component IDs.

### DW-20 — presets-api service-binding fetch has no timeout (INFO)

- **CWE:** CWE-400 · `services/preset-api.ts:140-155` — no `AbortSignal`; the Universalis client (`universalis-client.ts:122-134`) and all Discord calls do have one. Add `signal: AbortSignal.timeout(10_000)`.

### DW-21 — `gradient steps` not clamped outside the Discord schema (INFO)

- **CWE:** CWE-20 · `handlers/commands/gradient.ts:37` (`(options.find(...)?.value as number) || 6`) and `packages/bot-logic/src/commands/gradient.ts:144` (`for (let i = 0; i < stepCount; i++)`) rely on `schemas.ts:356-361` (`min_value: 2, max_value: 12`, enforced by Discord). Harmony clamps companions (`bot-logic/commands/harmony.ts:201`), extractor clamps count/colors, budget clamps matchLine; gradient should clamp too (`Math.min(12, Math.max(2, …))`).

---

## Reviewed and not raised (for the coordinator)

- **SSRF via `/extractor image`:** discord-worker passes `attachment.url` (Discord-signed) to image-worker as a URL (`services/image-client.ts:39-50`); image-worker enforces HTTPS + Discord-CDN host allowlist, IP-literal/private-host block, one validated redirect hop, 10 MB and magic-byte checks (`apps/image-worker/src/validators.ts`). Not a finding here (see DW-4 for the `/swatch` gap).
- **Preset author spoofing:** `X-User-Discord-ID`/`X-User-Discord-Name` are taken from the signed interaction's `member.user`/`user` (`handlers/commands/preset.ts:71-77`), HMAC-bound (`preset-api.ts:122-132`) and presets-api derives authorship from those headers; no option lets a user supply another ID. Edit additionally checks ownership client-side (`preset.ts:749`) and server-side.
- **Moderation buttons:** `handlers/buttons/preview-image.ts:131` refuses non-moderators before any API call; presets-api `requireModerator` re-checks. `custom_id` prefixes are distinct from moderation-worker's (`previewimg_*` vs `preset_*`).
- **`/stats` admin panels:** `stats.ts:47-54, 82-94` gate on `STATS_AUTHORIZED_USERS`, responses ephemeral; `MODERATOR_IDS` parsed with snowflake validation (`packages/bot-logic/src/moderators.ts:31-47`).
- **SVG text injection:** every `text()` call escapes content and attributes (`packages/svg/src/base.ts:12-19, 153-175`, `frame.ts:164-171`); `generatePresetSwatch` (preset name/description/author) and `generateSwatchCard` (`.chara` nickname) go through those helpers.
- **Universalis URL construction:** world `encodeURIComponent`-ed, item IDs numeric, ≤100 per batch, 10 s timeout (`universalis-client.ts:79-82, 214-222`).
- **Error leakage:** `PresetAPIError.getSafeMessageKey()` (`types/preset.ts:118-138`) on submit/edit; generic `errors.commandFailed` in the dispatcher (`index.ts:749-756`); generic 500 in `onError`. `response.error` strings from presets-api's own `success:false` envelopes are shown verbatim (`preset.ts:526, 635, 842`) — these are API-authored messages, not internals.
- **Secrets:** none in `wrangler.toml` (only client IDs / channel IDs); scripts read `DISCORD_TOKEN` from env/dotenv and never print it (`scripts/register-commands.ts:44-62, 82-89`, `scripts/upload-emojis.ts:88-102`); `.env*` gitignored (`.gitignore:25-27`).
- **KV keys:** all user-scoped keys derive from the signed `userId` (`prefs:v1:`, `xivdye:preset_favorites:v1|v2:`, `usertrack:`, `firstrun:v5:`, `ratelimit:user:`); no user string is used as a key component.
- **bot-logic parsing:** hex regexes are anchored fixed-length (`input-resolution.ts:76-89`); dye search is substring over 125 entries; `Translator.t` keys are code constants; `parseCharaFile` is `JSON.parse` on a ≤1 MiB text with explicit type checks — no ReDoS / unbounded loops found (other than the schema-dependent `steps`, DW-21).

## Positive controls verified

1. Ed25519 verification on the single interaction route, raw body, both headers required, byte-accurate 100 KB cap, library `verifyKey` (WebCrypto / constant-time) — `packages/auth/src/discord.ts:58-118`, `index.ts:514-533`.
2. Webhook auth: timing-safe bearer (`index.ts:184-193`, `packages/auth/src/timing.ts`), GitHub HMAC-SHA256 with constant-time compare (`utils/github-verify.ts`), both fail closed when unconfigured; 10 KB caps.
3. Per-request critical-secret check returning 500 when `DISCORD_TOKEN`/`DISCORD_PUBLIC_KEY` are missing (`index.ts:122-141`); `BOT_SIGNING_SECRET` ≥32 chars enforced (`utils/env-validation.ts:67-71`).
4. CORS allowlist + pinned methods (`index.ts:101-107`); `nosniff`, `X-Frame-Options: DENY`, HSTS on every response (`index.ts:145-153`).
5. Authorization: `STATS_AUTHORIZED_USERS` / `MODERATOR_IDS` allowlists, snowflake-validated, re-checked server-side by presets-api; `userId` required before any command runs (`index.ts:620-625`).
6. Rate limiting per user per command with tiers (`packages/worker-kit/src/rate-limiter/presets/configs.ts:68-116`), alias canonicalisation (`/a11y`→`accessibility`), `extractor:image` 5/min, autocomplete 60/min+burst.
7. Image pipeline delegated to image-worker with SSRF allowlist, size/dimension/format validation (`apps/image-worker/src/validators.ts`).
8. Discord option constraints (`min_value`/`max_value`, choice lists) for numeric/enumerated inputs; handler-side clamps for extractor count/colors, budget matchLine, harmony companions.
9. Output escaping in SVG generators; HTML-free Discord embeds; `sanitizePresetName/Description` applied on every moderation-channel embed (`preset-notifications.ts:77-79`, `index.ts:229, 336-337`).
10. Timeouts on all Discord REST calls (5 s / 10 s), Universalis proxy (10 s), GitHub/changelog fetch (10 s).
11. Generic error surfaces (`getSafeMessageKey`, `errors.commandFailed`, shaped `onError`); secret redaction in the shared logger.
12. Secrets outside source control; `.env` ignored; commands registered by CI.

## Coverage — files read in full

`apps/discord-worker/wrangler.toml`, `package.json`, `PRIVACY_POLICY.md` (data sections), `CLAUDE.md`;
`src/index.ts`; `src/types/{env,preset,github,budget,preferences}.ts`; `src/utils/{discord-api,env-validation,github-verify,response,sanitize,brand}.ts`; `src/services/{analytics,announcements,bot-i18n,changelog-parser,emoji,fonts,i18n,image-client,preferences,preset-api,preset-favorites,rate-limiter}.ts`, `src/services/svg/renderer.ts`, `src/services/budget/{index,universalis-client,price-cache,budget-calculator,quick-picks}.ts`; `src/handlers/commands/{index,about,accessibility,budget,changelog,comparison,contrast,dye,extractor,gradient,harmony,manual,mixer-v4,preferences,preset,preset-notifications,stats,swatch}.ts`; `src/handlers/buttons/{index,copy,preview-image}.ts`; `src/commands/{registry,localize,schemas}.ts`; `scripts/{register-commands,upload-emojis,cleanup-v4-kv,test-font-rendering}.ts`.
`packages/bot-logic/src/{index,input-resolution,moderators,localization,css-colors}.ts`, `i18n/translator.ts`, `commands/{types,swatch}.ts` (+ grep of `gradient.ts`/`harmony.ts` bounds).
`packages/auth/src/{discord,hmac,timing,index,jwt}.ts`; `packages/worker-kit/src/rate-limiter/presets/configs.ts`, `backends/{kv,upstash}.ts`, `middleware/{request-id,logger}.ts` (grep); `packages/svg/src/{base,frame}.ts` (escaping), `preset-swatch.ts` (imports/authorName); `packages/core/src/services/chara/chara-parser.ts` (error construction), `config/product-links.ts`.
Cross-checked: `apps/image-worker/src/{index,validators}.ts`; `apps/presets-api/src/middleware/auth.ts`, `handlers/{presets,votes}.ts` (route auth for DW-3), `services/validation-service.ts` (name/description rules), `services/notification-service.ts:94-110` (webhook caller).
Skipped by scope: locale JSON, font binaries, `*.test.ts`, `src/data/emoji-mapping.json`, `src/test-utils*.ts`.
