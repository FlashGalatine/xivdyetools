# Manual Security Review — `apps/moderation-worker` (moderation-worker 1.4.0)

- **Audit:** 2026-08-21 monorepo security audit (see `../AUDIT_MANIFEST.md`)
- **Reviewer:** Claude Code (Fable 5), read-only manual code review — no source files modified
- **Deploy unit:** `xivdyetools-moderation-worker` → `moderation-bot.xivdyetools.app` (Cloudflare Worker + Hono). Discord HTTP-Interactions bot for community-preset moderation.
- **Trust boundary summary:** Discord → `POST /` (Ed25519-verified) → per-interaction handlers. Outbound: presets-api over the `PRESETS_API` service binding (Bearer `BOT_API_SECRET` + HMAC `BOT_SIGNING_SECRET`), **direct read/write D1 access to the production `xivdyetools-presets` database**, KV namespace `1fcb7e03…` **shared with discord-worker production**, Discord REST (bot token).
- **Method:** every non-test file under `src/` read in full (coverage list at the end), `wrangler.toml`, `scripts/register-commands.ts`, `packages/auth/src/*`, plus targeted reads of the presets-api auth/moderation handlers, worker-kit rate-limiter/middleware and discord-worker key layouts to trace call paths end-to-end and confirm/refute each suspected issue.

---

## Executive summary

The worker's privileged surface is small and the core authorization control is sound: **every slash subcommand, every mutating button and every modal submission checks `presetApi.isModerator(env, userId)`** — an allowlist of Discord snowflakes in the `MODERATOR_IDS` secret — and the slash subcommands are additionally pinned to `MODERATION_CHANNEL_ID`. presets-api independently re-checks its own `MODERATOR_IDS` on every moderation route, so a bypass here would still not be able to approve/reject through the API. Signature verification, body-size limits, parameterized SQL, LIKE escaping, security headers and stack-trace suppression are all in place.

Two things break the otherwise consistent model:

1. **Autocomplete is the one interaction type with no authorization at all**, and two of its three branches query the production D1 directly (`searchPresetAuthors`, `searchBannedUsers`). Any Discord user who can see `/preset` (anyone in a guild where the bot is installed, anyone who can DM it, and — if the application is left as a "Public Bot" — anyone who invites it to their own server using the public client ID in `wrangler.toml`) can enumerate preset authors' Discord IDs/usernames and the **currently-banned user list** (MOD-1). The rate limiter guarding that path is best-effort because its increment is fire-and-forget (MOD-3).
2. **The ban flow carries the target's username inside Discord `custom_id`s, which are capped at 100 characters.** A user with a ≥ ~50-byte (≈17 CJK / 13 emoji) display name makes the ban button/modal un-renderable, and this worker is the ecosystem's only ban path — self-selectable moderation evasion (MOD-2).

Everything else is LOW/INFO: integrity gaps from writing D1 directly (no audit log, ban only hides `approved`, approve path ignores bans), missing UUID re-validation on the modal paths, markdown-link injection from author-controlled names into moderator embeds, a stale/unverified `xivdyetools.com` link domain, raw error strings posted to the moderation channel, and the shared-KV / prod-bindings-in-dev hygiene points.

| Severity | Count | IDs |
|---|---|---|
| CRITICAL | 0 | — |
| HIGH | 0 | — |
| MEDIUM | 2 | MOD-1, MOD-2 |
| LOW | 6 | MOD-3, MOD-4, MOD-5, MOD-6, MOD-7, MOD-8 |
| INFO | 8 | MOD-9 … MOD-16 |

---

## Findings

### MOD-1 — Autocomplete handlers run production-D1 searches with no moderator, channel or guild check (enumeration of preset authors and of the banned-user list)

- **Severity:** MEDIUM — information disclosure of moderation data (banned-user blacklist, author Discord IDs) to non-moderators; no write access; reachability beyond the moderation guild depends on a Discord dashboard setting the audit cannot see.
- **CWE:** CWE-285 (Improper Authorization), CWE-200 (Exposure of Sensitive Information to an Unauthorized Actor)
- **Confidence:** CONFIRMED (code path) / PLAUSIBLE for reachability from outside the moderation guild.
- **Location:** `apps/moderation-worker/src/index.ts:254-390` (`handleAutocomplete`, `getBanUserAutocompleteChoices`, `getUnbanUserAutocompleteChoices`); `src/services/ban-service.ts:50-164` (`searchPresetAuthors`, `searchBannedUsers`); `scripts/register-commands.ts:41-108` (no `default_member_permissions`, `contexts`, `integration_types`).

```ts
// index.ts:318-335 — no isModerator / isInModerationChannel / guild_id check anywhere in this function
if (commandName === 'preset') {
  const focusedName = focusedOption?.name;
  if (focusedName === 'preset_id') { … }
  else if (focusedName === 'user') {
    if (subcommandName === 'ban_user') {
      choices = await getBanUserAutocompleteChoices(env, query, logger);   // → banService.searchPresetAuthors(env.DB, query)
    } else if (subcommandName === 'unban_user') {
      choices = await getUnbanUserAutocompleteChoices(env, query, logger); // → banService.searchBannedUsers(env.DB, query)
    }
  }
}
// index.ts:355-358 — choice text leaks "<username> (discord:<id>) - <n> presets"
// index.ts:377-385 — choice text leaks "<username> (discord:<id>|xivauth:<id>)" for every ACTIVE ban
```

```ts
// ban-service.ts:142 — the banned-user search also matches on discord_id, so a specific ID can be probed
AND (username LIKE ? ESCAPE '\\' OR discord_id LIKE ? ESCAPE '\\')
```

- **Who can reach it:** Discord delivers `APPLICATION_COMMAND_AUTOCOMPLETE` interactions to whoever can *see* the command. `register-commands.ts` registers `/preset` globally with no `default_member_permissions` (so every member sees it), no `contexts` (default = guild + bot-DM + private channel), and the application ID is public (`wrangler.toml:33`, also in `CLAUDE.md`/README). Therefore: (a) every non-moderator member of the moderation guild; (b) anyone sharing *any* server with the bot, via bot DM; (c) if the Discord application's **"Public Bot"** toggle is on (Discord's default for new apps — not verifiable from the repo), anyone on the internet via `https://discord.com/oauth2/authorize?client_id=1453806659708129374&scope=bot+applications.commands` into their own guild. The slash-command handlers are protected by `MODERATION_CHANNEL_ID` + `MODERATOR_IDS`; the autocomplete is not.
- **Exploit scenario:** attacker types `/preset unban_user user:` followed by `a`, `e`, `i`, … (or `1`, `2`, … to probe IDs). Each keystroke returns up to 25 `username (discord:123…)` entries from `banned_users WHERE unbanned_at IS NULL` — the live blacklist. `/preset ban_user user:<letters>` enumerates every preset author with their Discord ID and submission count (`ORDER BY preset_count DESC`). At 60+10 req/min per user (and see MOD-3) the whole table is dumped in minutes; multiple Discord accounts multiply it. A banned user can also confirm their own ban status and identify who else was banned (harassment/retaliation vector).
- **Note on the third branch:** `preset_id` autocomplete (`presetApi.searchPresetsForAutocomplete`) is *not* a leak — `request()` is called without `userDiscordId`, presets-api's `GET /api/v1/presets?status=pending` then 403s for non-moderators (`apps/presets-api/src/handlers/presets.ts:99`) and the helper swallows the error into `[]`. That makes it a functional bug (always empty), see MOD-13.
- **Fix:**
  1. In `handleAutocomplete`, return `{ choices: [] }` unless `presetApi.isModerator(env, userId)` — the check is an O(1) Set lookup and should precede any D1/API work. Optionally also require `interaction.channel_id === env.MODERATION_CHANNEL_ID` (same as the slash subcommands).
  2. Add a guild allowlist (`MODERATION_GUILD_ID` secret; reject interactions whose `guild_id` differs, and reject `guild_id === undefined` DMs) at the top of `POST /` for every non-PING interaction.
  3. In `register-commands.ts`, set `default_member_permissions: "0"` (administrator-only by default; guild admins can then grant a moderator role), `contexts: [0]` (guild only), `integration_types: [0]` (guild install only), and `dm_permission: false` for legacy clients.
  4. Confirm in the Discord developer portal that **Public Bot** is disabled for application `1453806659708129374` (out of repo scope).

### MOD-2 — Ban flow fails for users with long/multibyte display names because the username is embedded in `custom_id` (Discord cap = 100 chars); this is the ecosystem's only ban mechanism

- **Severity:** MEDIUM — denial of the sole moderation control, selectable by the very users being moderated; no data exposure.
- **CWE:** CWE-693 (Protection Mechanism Failure), CWE-130 (Improper Handling of Length Parameter Inconsistency)
- **Confidence:** PLAUSIBLE (arithmetic is deterministic and Discord's 100-char `custom_id` limit is documented; not executed live against Discord within this audit).
- **Location:** `apps/moderation-worker/src/handlers/commands/preset.ts:487` (button), `src/handlers/buttons/ban-confirmation.ts:99` (modal), `src/utils/response.ts:253-260` (`encodeBase64Url`).

```ts
// preset.ts:487
custom_id: `ban_confirm_${targetUserId}_${encodeBase64Url(user.username)}`,
// ban-confirmation.ts:99
custom_id: `ban_reason_modal_${targetUserId}_${encodeBase64Url(targetUsername)}`,
```

- **Arithmetic:** `ban_reason_modal_` (17) + snowflake (17–20) + `_` (1) = 35–38 chars, leaving ≤ 65 base64url chars ≈ **48 bytes** of UTF-8 username; `ban_confirm_` leaves ≈ 51 bytes. `author_name` is the author's Discord `global_name || username` (`apps/presets-api/src/handlers/presets.ts:647` ← discord-worker `handlers/commands/preset.ts:73-75`), up to 32 code points of arbitrary Unicode. 17 CJK characters (51 bytes) or 13 emoji (52 bytes) overflow the modal id; 32 CJK characters produce a 161-char `custom_id`. Discord rejects the interaction callback (`BASE_TYPE_MAX_LENGTH` on `custom_id`), the moderator sees "This interaction failed", and `banUser` is never reached.
- **Exploit scenario:** an abusive submitter sets a 20-character Japanese display name before submitting presets. Moderators can reject each preset but cannot ban the account through `/preset ban_user` → Yes → reason modal; no other ban path exists (`INSERT INTO banned_users` appears only in this worker; discord-worker's `/preset` explicitly delegates `ban_user` here — `apps/discord-worker/src/commands/schemas.ts:1147`). In a JP-heavy FFXIV community a qualifying name is not even suspicious.
- **Fix:** stop carrying the username in `custom_id` — carry only the snowflake (`ban_confirm_<id>` / `ban_reason_modal_<id>`) and re-read `author_name` from D1 in `processBan` (it is already available via `getUserForBanConfirmation`). If a display string must travel, truncate the *encoded* form to a fixed budget (e.g., ≤ 40 chars) and treat it as cosmetic. Add a unit test that a 32-character CJK username yields a `custom_id` ≤ 100.

### MOD-3 — Autocomplete rate-limit increment is fire-and-forget (not awaited, not in `waitUntil`) — the only throttle on the unauthenticated D1 path is best-effort

- **Severity:** LOW — weakens the mitigation for MOD-1 and the D1 flood protection the middleware claims; no direct compromise.
- **CWE:** CWE-770 (Allocation of Resources Without Limits or Throttling)
- **Confidence:** CONFIRMED (code) — whether the runtime actually cancels the pending KV put after the Response is returned is PLAUSIBLE/intermittent (Workers may terminate unawaited I/O once the handler returns; `handleCommand` itself uses `ctx.waitUntil` for the same call at `index.ts:222-226`).
- **Location:** `apps/moderation-worker/src/index.ts:292-295`.

```ts
// index.ts:292-295 — contrast with index.ts:222-226 (command path wraps this in ctx.waitUntil)
incrementRateLimit(env.KV, userId, 'autocomplete').catch((err) => {
  logger.error('Failed to increment autocomplete rate limit', …);
});
```

- **Impact:** counters may never be written, so `checkOnly` keeps returning `allowed: true` for the MOD-1 enumeration; plus KV's read-modify-write increment is already lossy under concurrency (documented in `packages/worker-kit/src/rate-limiter/backends/kv.ts:190-196`).
- **Fix:** pass `c.executionCtx` into `handleAutocomplete` and wrap the increment in `ctx.waitUntil(...)` (or use `limiter.check()` which increments inline). Independently of this, apply MOD-1's authorization so the limiter is not the only guard.

### MOD-4 — Direct D1 writes bypass presets-api's invariants: no `moderation_log` rows for ban/unban/hide/restore, ban hides only `approved` presets, the approve path never checks the author's ban status, and ban + hide are not atomic

- **Severity:** LOW — integrity/audit gaps that need a moderator action to surface; not attacker-driven on their own.
- **CWE:** CWE-778 (Insufficient Logging), CWE-841 (Improper Enforcement of Behavioral Workflow), CWE-662 (Improper Synchronization)
- **Confidence:** CONFIRMED.
- **Location:** `apps/moderation-worker/src/services/ban-service.ts:231-284` (`banUser`), `:289-338` (`unbanUser`), `:347-378` (`hideUserPresets`/`restoreUserPresets`); `src/handlers/commands/preset.ts:217-251` (`handleApproveAction`); presets-api contrast: `apps/presets-api/src/handlers/moderation.ts:88-120` (conditional UPDATE + `moderation_log` in one `DB.batch`), `apps/presets-api/src/services/validation-service.ts:327` (`hidden` not settable via API).

```ts
// ban-service.ts:251-261 — two separate statements; banned_users row can exist with presets still visible if hide fails
await db.prepare(`INSERT INTO banned_users (…) VALUES (?, ?, ?, ?, ?, ?)`).bind(…).run();
const presetsHidden = await hideUserPresets(db, discordId);
// ban-service.ts:351-354 — only approved presets are hidden
UPDATE presets SET status = 'hidden' WHERE author_discord_id = ? AND status = 'approved'
```

- **Consequences:**
  - presets-api's `moderation_log` is the audit trail shown by `/api/v1/moderation/:id/history` and counted in `/stats`; ban/unban/hide/restore leave no row there (only a structured log line in the worker).
  - A banned user's `pending`/`flagged` presets stay in the queue (`GET /moderation/pending` does not exclude banned authors) and `/preset moderate approve <id>` / the approve button happily publish them — presets-api's `requireNotBanned` only guards *submission/edit/vote*, not approval. `hidden → approved` is also accepted by the API's conditional update if a moderator approves a hidden preset by ID.
  - `banUser`/`unbanUser` are non-atomic and there is no unique partial index on `banned_users(discord_id) WHERE unbanned_at IS NULL` (`apps/presets-api/migrations/0003_add_banned_users.sql`), so two moderators confirming simultaneously can create two active ban rows (harmless for `unbanUser`, which updates all).
- **Fix:** run INSERT + UPDATE in one `db.batch([...])`; hide `pending`/`flagged` too (or set a dedicated `banned` marker) and make `handleApproveAction`/`processApproval` refuse when `isUserBannedByDiscordId(author)`; write `moderation_log` rows (`action: 'ban'|'unban'|'hide'|'restore'`) or, better, move ban/unban behind a presets-api endpoint so one service owns the invariants.

### MOD-5 — Modal handlers skip the UUID validation the button/command paths apply; `presetId` from `custom_id` is interpolated unencoded into the presets-api request path

- **Severity:** LOW — reachable only by an authenticated moderator, and Discord echoes the bot-issued `custom_id`; defense-in-depth inconsistency.
- **CWE:** CWE-20 (Improper Input Validation), CWE-99 (Improper Control of Resource Identifiers)
- **Confidence:** CONFIRMED (inconsistency); exploitability PLAUSIBLE-to-unlikely (requires a moderator with a modified client, and Discord-side validation of modal ids).
- **Location:** `apps/moderation-worker/src/handlers/modals/preset-rejection.ts:37,169` vs. `src/handlers/buttons/preset-moderation.ts:79,187,239` and `src/handlers/commands/preset.ts:132`; sink `src/services/preset-api.ts:376,397,448`; `src/handlers/modals/ban-reason.ts:72` / `src/handlers/buttons/ban-confirmation.ts:78` (no snowflake check on `targetUserId`).

```ts
// preset-rejection.ts:37 — no isValidUuid(presetId) here …
const presetId = customId.replace('preset_reject_modal_', '');
// preset-api.ts:397 — … and the value lands raw in the path over the service binding
`/api/v1/moderation/${presetId}/status`
```

- **Scenario:** a `custom_id` of `preset_reject_modal_../../presets/<uuid>` would normalise to `/api/v1/presets/<uuid>/status` carrying the bot's Bearer + HMAC headers. Only a moderator can reach the handler, so this is a containment/consistency issue, not privilege escalation.
- **Fix:** apply `isValidUuid` in both modal handlers (and `isValidSnowflake` on `targetUserId` in the ban button/modal), and `encodeURIComponent()` path segments in `preset-api.ts`.

### MOD-6 — Author-controlled preset names are rendered as Discord markdown (including masked links) in moderator-facing embeds

- **Severity:** LOW — phishing/defacement of moderators' ephemeral embeds; no pings (embeds never trigger mentions) and no write impact.
- **CWE:** CWE-79 variant (Improper Neutralization of input in output used by a downstream renderer) / CWE-1021-style UI deception
- **Confidence:** CONFIRMED (Discord renders masked links in embed descriptions/field values; presets-api validates names for length only — `validation-service.ts:177-190`, 2–50 chars, no charset rule).
- **Location:** `apps/moderation-worker/src/handlers/commands/preset.ts:454-457` (masked link built from `p.name`), `:180` (pending list), `src/services/preset-api.ts:486-488` (autocomplete labels), plus `author_name` in the same places.

```ts
// preset.ts:456
? recentPresets.map((p) => `• [${p.name}](${p.shareUrl})`).join('\n')
```

- **Scenario:** a preset named `Nice palette](https://evil.example/login) [x` becomes a clickable "Nice palette" link to the attacker's site inside the *Confirm User Ban* embed; `**`, `||`, backticks in names/author names break the layout of the pending list.
- **Fix:** escape Discord markdown (`\`, `*`, `_`, `~`, `` ` ``, `|`, `[`, `]`, `(`, `)`, `>`) for user-supplied strings before embedding, or render names in code spans; prefer a separate `ID` line over masked links.

### MOD-7 — Moderator-facing preset links are hard-coded to `https://xivdyetools.com`, not the canonical `xivdyetools.app`

- **Severity:** LOW — if the `.com` zone is not (or ceases to be) project-controlled, every link in the ban-confirmation embed points moderators at an attacker-registrable domain; otherwise a stale config.
- **CWE:** CWE-601-adjacent (untrusted link target) / CWE-1188 (Insecure Default)
- **Confidence:** PLAUSIBLE — ownership of `xivdyetools.com` cannot be established from the repo (all 5.0 production hosts are `*.xivdyetools.app`; `.com` survives only here, in discord-worker `/stats`, and in pre-5.0 planning docs).
- **Location:** `apps/moderation-worker/src/handlers/commands/preset.ts:34` → `ban-service.ts:219` (`${baseUrl}/presets/${p.id}`).
- **Fix:** source the web base URL from a var (`WEB_APP_URL = "https://xivdyetools.app"`) and verify DNS/registrar control of `xivdyetools.com` (keep it as a 301 if owned).

### MOD-8 — Raw D1/API error strings are posted into Discord channels

- **Severity:** LOW — audience is moderators in a private channel; still leaks SQL/table names and upstream 5xx bodies.
- **CWE:** CWE-209 (Generation of Error Message Containing Sensitive Information)
- **Confidence:** CONFIRMED.
- **Location:** `apps/moderation-worker/src/services/ban-service.ts:268-282` (`error: errorMessage` — raw D1 message) → `src/handlers/modals/ban-reason.ts:146-153` (`errorEmbed('Ban Failed', result.error)` to `MODERATION_CHANNEL_ID`); `src/handlers/commands/preset.ts:405` (`error instanceof PresetAPIError ? error.message : …` — 5xx bodies included; `sanitizeErrorMessage` in `utils/response.ts:190-227` would filter them but is not used on this path); `src/handlers/commands/preset.ts:570` (`result.error`).
- **Fix:** route all three through `sanitizeErrorMessage(error, fallback)` and map known D1 errors to fixed strings.

### MOD-9 — KV namespace is shared with discord-worker production, and the dev env block binds production D1/KV/service binding (INFO)

- **Severity:** INFO — hygiene / least privilege; no collision or exploit found.
- **CWE:** CWE-250 (Execution with Unnecessary Privileges)
- **Confidence:** CONFIRMED.
- **Location:** `apps/moderation-worker/wrangler.toml:19-31` (top-level/dev env) and `:51-63` (production) — identical `KV` id `1fcb7e03…`, D1 `e17d68a1…`, service `xivdyetools-presets-api`.
- **Analysis:** moderation-worker writes only `ratelimit:command:<uid>|<window>` / `ratelimit:autocomplete:<uid>|<window>` (`middleware/rate-limit.ts:105,132` + worker-kit `buildKey`) and reads `i18n:user:<uid>` (`services/i18n.ts:44`). discord-worker uses `ratelimit:user:…`, `prefs:v1:…`, `xivdye:preset_favorites:…` and writes `i18n:user:` — no key overlap; the shared language preference is intentional. The binding nonetheless grants this worker full R/W over the main bot's user data, and a `wrangler dev --remote` / dev deploy mutates production presets and KV (documented as deliberate — there is no staging). 
- **Fix (optional):** give moderation-worker its own KV (rate limits + a copy of the language key), or at least a dedicated preview D1/KV for the dev block; if separation is kept as-is, keep the note in `CLAUDE.md` that bare `wrangler dev --remote` touches production.

### MOD-10 — No freshness window on the Discord signature timestamp (replay of captured interactions) (INFO)

- **Severity:** INFO — requires capturing a TLS-protected Discord→worker request; impact bounded by presets-api's conditional status updates (409 on stale state) and `banUser`'s "already banned" idempotency.
- **CWE:** CWE-294 (Authentication Bypass by Capture-replay)
- **Confidence:** CONFIRMED (code): `packages/auth/src/discord.ts:58-118` passes `timestamp` into `verifyKey` (it is part of the signed message) but never compares it to the clock; `apps/moderation-worker/src/index.ts:116-184` adds no check.
- **Fix:** reject `|now - X-Signature-Timestamp| > 5 min` in `verifyDiscordRequest` (option `maxSkewMs`), which also caps replay of modal submits.

### MOD-11 — Bot→presets-api HMAC covers only `timestamp:userId:userName`, not method/path/body (INFO)

- **Severity:** INFO — documented (REFACTOR-027 in the worker's `CLAUDE.md`); only matters on the HTTPS `PRESETS_API_URL` fallback, which `validateEnv` flags as a misconfiguration; the service binding never leaves Cloudflare.
- **CWE:** CWE-347 (Improper Verification of Cryptographic Signature — insufficient coverage)
- **Location:** `apps/moderation-worker/src/services/preset-api.ts:76-86,130-151`; verifier `packages/auth/src/hmac.ts:237-277`.
- **Fix:** v2 scheme binding `method:path:sha256(body)` (already planned).

### MOD-12 — Button/modal interactions are not rate limited; `ban_cancel_` skips the moderator check (INFO)

- **Severity:** INFO — all mutating paths check `isModerator` before any D1/API work, so the unthrottled paths are cheap rejections; `ban_cancel_` only returns an `UPDATE_MESSAGE` on an ephemeral message the caller already owns.
- **Location:** `apps/moderation-worker/src/index.ts:395-444` (no `checkRateLimit` for `MESSAGE_COMPONENT`/`MODAL_SUBMIT`); `src/handlers/buttons/ban-confirmation.ts:126-145`.
- **Fix (optional):** apply the `command` limiter to components/modals keyed by user; add `isModerator` to `ban_cancel_` for uniformity.

### MOD-13 — `preset_id` autocomplete always returns empty because no moderator identity is sent (INFO, functional)

- **Severity:** INFO — fails safe (presets-api returns 403 → `[]`), but the feature is dead.
- **Location:** `apps/moderation-worker/src/services/preset-api.ts:464-500` (`searchPresetsForAutocomplete` → `getPresets` → `request()` with no `userDiscordId`); presets-api gate `apps/presets-api/src/handlers/presets.ts:96-100`.
- **Fix:** pass `userDiscordId` (after MOD-1's moderator check) so the HMAC message and `X-User-Discord-ID` identify the moderator.

### MOD-14 — Ban/unban keyed on `discord_id` only; XIVAuth-only authors are uncoverable and the unban autocomplete can emit an `xivauth` id that `unbanUser` cannot match (INFO)

- **Location:** `apps/moderation-worker/src/services/ban-service.ts:72` (`author_discord_id IS NOT NULL`), `:295-315`; `src/index.ts:377-385` (`value: user.discordId || user.xivAuthId || ''`) — `getActiveBan(db, xivAuthId)` queries `discord_id = ?`.
- **Fix:** either drop the `xivauth` branch from the autocomplete or add `xivauth_id` support to `getActiveBan`/`unbanUser`/`hideUserPresets`.

### MOD-15 — Moderator allowlist is cached per isolate; rotating `MODERATOR_IDS` needs a redeploy/isolate recycle (INFO)

- **Location:** `apps/moderation-worker/src/services/preset-api.ts:243-278` (`moderatorIdsCache`).
- **Fix:** acceptable; document that removing a moderator requires `wrangler deploy --env production` (or cache with a short TTL).

### MOD-16 — Cross-unit note: discord-worker holds `MODERATION_BOT_TOKEN` so that its moderation embeds' buttons route to this worker (INFO; for the discord-worker reviewer)

- **Location:** `apps/discord-worker/src/handlers/commands/preset-notifications.ts:15,60-63,153-169`.
- **Why it matters here:** the README's isolation argument ("compromising one bot's token doesn't affect the other", `docs/projects/moderation-worker/overview.md:32-35`) is weakened — the moderation application's bot token lives in two workers. It is also the reason `preset_approve_/preset_reject_/preset_revert_` clicks reach this worker at all (Discord routes component interactions to the application whose bot posted the message).

---

## Reviewed and rejected (no finding)

| Suspicion | Why rejected |
|---|---|
| SQL injection in `sql-helpers.ts` / `ban-service.ts` | Every statement is `prepare().bind()`; user text only ever reaches a bound `LIKE ? ESCAPE '\'` argument after `escapeLikePattern` (escapes `%`, `_`, `\`) and a 100-char cap; `limit` is a bound integer; no dynamic column/ORDER BY/IN lists. `ESCAPE '\\'` inside the template literal is a single backslash in SQL — correct. |
| Missing `isModerator` on a mutating path | Checked every handler — see matrix below. All approve/reject/revert/ban/unban entry points (slash, button, modal) enforce it before any D1/API work. |
| Cross-guild "admin of my own server" escalation | Authorization is a hard-coded snowflake allowlist (`MODERATOR_IDS`), never `member.permissions`/roles, so installing the bot elsewhere grants nothing on the command/button/modal paths; channel pinning uses globally-unique channel IDs. Only autocomplete is exposed (MOD-1). |
| `url-sanitizer.ts` bypasses (`javascript:`, `data:`, `//`, userinfo…) | The module is a **log-redaction** helper (webhook tokens, `?token=`, Bearer) wired into `loggerMiddleware({ sanitizePath })` and `discord-api.ts` catch blocks; its output never reaches an embed, link or fetch. No URL-safety role to bypass. The one user-influenced URL in embeds is `pending_preview_image_url`, which presets-api builds from a server-side R2 key (`preset-service.ts:461-463`). |
| SSRF via user-influenced fetch URLs | Outbound URLs are constants (`DISCORD_API_BASE`, `https://internal`, `PRESETS_API_URL` var); user data enters only as validated UUID/snowflake path segments (with the modal caveat in MOD-5) or as `URLSearchParams`-encoded query values. |
| Stack-trace disclosure via `app.onError` | Gated on `c.env.ENVIRONMENT === 'development'`; `ENVIRONMENT` is set in neither env block, so production and the dev worker both return the generic body. |
| Token logging | `DISCORD_TOKEN` only appears in `Authorization: Bot` headers; failure logs use `sanitizeUrl`/`sanitizeErrorMessage`; HMAC debug log records `hasSignature: true`, not the signature; `loggerMiddleware` logs method/path/user-agent only. |
| Unverified routes / internal notification endpoints | Only `GET /health` (static `{status:'ok'}`) and `POST /` exist; presets-api notifications target discord-worker, not this worker. |
| `@everyone`/mention injection | All user-influenced text is placed in embeds (which never ping); `content` strings are constants or Discord-registered command names. `allowed_mentions` is not set but currently unneeded — keep in mind if `content` ever carries user text. |
| `custom_id` forgery to act on another preset | Discord only delivers component/modal interactions for messages/modals this application created; IDs are validated (UUID) on button paths and re-authorised (`isModerator`) at click time; presets-api re-checks moderator status and uses conditional updates. Residual inconsistency recorded as MOD-5. |
| `safeParseJSON` false-positive DoS (`constructor` key) | Discord payloads never contain those keys at object-key position; values are not inspected. |

---

## Positive controls verified

1. **Ed25519 on every interaction** — `verifyDiscordRequest` (`packages/auth/src/discord.ts`) checks `Content-Length` ≤ 100 KB, then the actual UTF-8 byte length, requires both signature headers, verifies over `timestamp + rawBody` with `discord-interactions`' `verifyKey`, and fails closed (try/catch → `false`, including when `DISCORD_PUBLIC_KEY` is undefined). PING is only answered after verification.
2. **Minimal route surface** — `GET /health`, `POST /`; Hono 404 elsewhere; strict headers (`nosniff`, `DENY`, HSTS, `no-store`, `CSP default-src 'none'`, `no-referrer`).
3. **Hardened JSON parsing** — depth ≤ 10, array ≤ 1000, property count ≤ 1000, prototype-pollution keys rejected, result deep-frozen.
4. **Authorization model** — `MODERATOR_IDS` secret parsed by the shared `parseModeratorIds` grammar with snowflake validation, O(1) `Set` lookup; enforced on all 3 slash subcommands, all 4 mutating buttons, all 3 modals; slash subcommands additionally pinned to `MODERATION_CHANNEL_ID` and fail closed when it is unset.
5. **Defense in depth at presets-api** — every `/api/v1/moderation/*` route calls `requireModerator`, which re-derives moderator status from presets-api's own `MODERATOR_IDS` and accepts bot identity only behind a valid HMAC (`BOT_SIGNING_SECRET`); status updates are conditional on the observed status and logged atomically.
6. **Input validation** — UUID v4 regex on slash approve/reject and all three preset buttons; 10-char minimum on modal reasons; ban target must exist as a preset author in D1.
7. **SQL hygiene** — all parameterized; LIKE wildcards escaped; query length capped; `LIMIT` bound.
8. **HMAC hygiene** — `hmacSignHex` via Web Crypto; ≥ 32-byte secret enforced by `validateEnv` and by `createHmacKey`; timestamps in seconds; presets-api verifies with 5-min age / 60-s skew.
9. **Rate limiting** — per-user KV sliding window on commands (20+5/min, in `waitUntil`) and autocomplete (60+10/min; see MOD-3); fail-open documented.
10. **Discord REST hygiene** — 5-s `AbortSignal.timeout` on channel sends/edits; BUG-035 throw-safe wrappers prevent unhandled rejections inside `waitUntil`; webhook tokens redacted in logs; ephemeral responses for denials and the ban confirmation.
11. **Error handling** — global `onError` hides stacks outside development; `sanitizeErrorMessage` (4xx-only passthrough, pattern blocklist) on button/modal failure edits.
12. **Secrets/config** — all secrets via `wrangler secret put`; `.dev.vars`/`.env*` gitignored; `register-commands.ts` reads the token from env/.env and prints only command names/IDs; dev and production workers have distinct names and only production carries routes; placeholder `DISCORD_CLIENT_ID` detection.

---

## Authorization matrix

| Entry point (`src/…`) | Reachable by | Channel check | `isModerator` | ID validation | Rate limit | Backing store |
|---|---|---|---|---|---|---|
| `POST /` — PING | Discord | n/a | n/a | n/a | – | – |
| `/preset moderate` → `handleModerateSubcommand` (`commands/preset.ts:315`) | any user seeing the command | ✔ `MODERATION_CHANNEL_ID` | ✔ | UUID on approve/reject (`:132`) | ✔ command | presets-api (service binding) |
| `/preset ban_user` (`commands/preset.ts:416`) | any user | ✔ | ✔ | target must exist in D1; **no snowflake check** | ✔ command | D1 read |
| `/preset unban_user` (`commands/preset.ts:509`) | any user | ✔ | ✔ | none (bound param) | ✔ command | D1 read/write |
| Autocomplete `preset_id` (`index.ts:323-327`) | any user | ✘ | ✘ | – | ✔ autocomplete (best-effort, MOD-3) | presets-api → 403 → `[]` (MOD-13) |
| Autocomplete `user` for `ban_user` (`index.ts:330-331`) | any user | ✘ | ✘ | – | ✔ best-effort | **D1 `presets` (authors)** — MOD-1 |
| Autocomplete `user` for `unban_user` (`index.ts:332-333`) | any user | ✘ | ✘ | – | ✔ best-effort | **D1 `banned_users`** — MOD-1 |
| Button `preset_approve_*` (`buttons/preset-moderation.ts:64`) | clicker of a message posted with the moderation bot token | ✘ | ✔ | UUID ✔ | ✘ | presets-api |
| Button `preset_reject_*` → modal (`:173`) | same | ✘ | ✔ | UUID ✔ | ✘ | – |
| Button `preset_revert_*` → modal (`:225`) | same | ✘ | ✔ | UUID ✔ | ✘ | – |
| Button `ban_confirm_*` → modal (`buttons/ban-confirmation.ts:53`) | owner of the ephemeral confirmation | ✘ | ✔ | **no snowflake check** | ✘ | – |
| Button `ban_cancel_*` (`:126`) | same | ✘ | ✘ (cosmetic) | – | ✘ | – |
| Modal `preset_reject_modal_*` (`modals/preset-rejection.ts:30`) | moderator who opened it | ✘ | ✔ | **no UUID check** (MOD-5); reason ≥ 10 | ✘ | presets-api |
| Modal `preset_revert_modal_*` (`:162`) | same | ✘ | ✔ | **no UUID check**; reason ≥ 10 | ✘ | presets-api |
| Modal `ban_reason_modal_*` (`modals/ban-reason.ts:28`) | same | ✘ | ✔ | **no snowflake check**; reason ≥ 10 | ✘ | **D1 write** (`banUser`) |
| Unknown command / component type / button / modal | any user | – | – | – | command RL for slash | ephemeral "not supported" |
| `GET /health` | anyone | – | – | – | – | static |

---

## Coverage — files read in full

`apps/moderation-worker/`: `wrangler.toml`, `package.json` (scripts), `CLAUDE.md`, `scripts/register-commands.ts`, `src/index.ts`, `src/handlers/commands/index.ts`, `src/handlers/commands/preset.ts`, `src/handlers/buttons/index.ts`, `src/handlers/buttons/preset-moderation.ts`, `src/handlers/buttons/ban-confirmation.ts`, `src/handlers/modals/index.ts`, `src/handlers/modals/preset-rejection.ts`, `src/handlers/modals/ban-reason.ts`, `src/middleware/rate-limit.ts`, `src/services/ban-service.ts`, `src/services/preset-api.ts`, `src/services/i18n.ts`, `src/services/bot-i18n.ts`, `src/types/env.ts`, `src/types/ban.ts`, `src/types/modal.ts`, `src/types/preset.ts`, `src/utils/verify.ts`, `src/utils/safe-json.ts`, `src/utils/url-sanitizer.ts`, `src/utils/response.ts`, `src/utils/discord-api.ts`, `src/utils/env-validation.ts`, `src/utils/sql-helpers.ts`.

`packages/auth/src/`: `index.ts`, `discord.ts`, `hmac.ts`, `timing.ts`, `encoding/base64.ts`, `encoding/hex.ts` (`jwt.ts`/`revocation.ts` not used by this worker — skipped). `node_modules/discord-interactions@4.4.0/dist/index.js` (`verifyKey`).

Targeted reads for call-path confirmation (not full reviews — they belong to other reviewers): `packages/bot-logic/src/moderators.ts` (`parseModeratorIds`), `packages/types/src/auth/discord-snowflake.ts`, `packages/worker-kit/src/rate-limiter/backends/kv.ts` (check/increment), `packages/worker-kit/src/rate-limiter/presets/configs.ts` (`MODERATION_LIMITS`), `packages/worker-kit/src/middleware/{logger,request-id}.ts` (grep), `apps/presets-api/src/middleware/{auth,ban-check}.ts`, `apps/presets-api/src/handlers/{moderation,presets}.ts` (moderator gates, status handler, list-status gate), `apps/presets-api/src/services/{preset-service,validation-service}.ts` (hidden handling, name rules, `pending_preview_image_url`), `apps/presets-api/migrations/0003_add_banned_users.sql`, `apps/discord-worker/src/services/rate-limiter.ts` + `services/{i18n,preferences,preset-favorites}.ts` (KV key prefixes), `apps/discord-worker/src/handlers/commands/preset-notifications.ts` + `handlers/buttons/preview-image.ts` (who posts the moderation buttons), `apps/discord-worker/src/commands/schemas.ts:1147`.

Not reviewed: `*.test.ts`, `coverage/`, `.turbo/`, `README.md` body beyond the isolation claims cited in MOD-16.
