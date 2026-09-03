# review-moderation-worker — deep-dive 2026-09-02

Unit: `moderation-worker` (CF Worker + Hono, Discord interactions, shares the `xivdyetools-presets` D1
with presets-api). Repo root: the `deep-dive-2026-09-02` worktree at `origin/main` e7ac4042.
Read-only review; no file outside this report was modified.

## 1. Map

| Surface | Module | What it does |
|---|---|---|
| entry | `src/index.ts` | Hono app; requestId → logger → security headers → env gate; `POST /` Ed25519 verify → `safeParseJSON` → PING / command / autocomplete / component / modal; `GET /health`; `app.onError` |
| command | `handlers/commands/preset.ts` | `/preset moderate` (pending, approve, reject, stats), `/preset ban_user`, `/preset unban_user` |
| buttons | `handlers/buttons/index.ts` | routes `preset_approve_` / `preset_reject_` / `preset_revert_` / `ban_confirm_` / `ban_cancel_` |
| buttons | `handlers/buttons/preset-moderation.ts` | approve (deferred update + channel edit), reject/revert (open modal) |
| buttons | `handlers/buttons/ban-confirmation.ts` | confirm → open `ban_reason_modal_<id>`; cancel → UPDATE_MESSAGE |
| modals | `handlers/modals/preset-rejection.ts` | `preset_reject_modal_` / `preset_revert_modal_` |
| modals | `handlers/modals/ban-reason.ts` | `ban_reason_modal_` → `banUser` |
| service | `services/ban-service.ts` | direct D1: ban/unban batches, hide/restore, author search, `moderation_log` rows |
| service | `services/preset-api.ts` | presets-api client (service binding), HMAC v2, `isModerator`, moderator-id cache |
| service | `services/i18n.ts`, `services/bot-i18n.ts` | KV locale preference + `Translator` (all six locales map to `enLocale`) |
| middleware | `middleware/rate-limit.ts` | native `RL_COMMAND`/`RL_AUTOCOMPLETE` tiers, KV fallback, isolate singleton |
| utils | `utils/response.ts` | interaction response builders, `sanitizeErrorMessage`, `isValidUuid`, `rateLimitedResponse` |
| utils | `utils/discord-api.ts` | `editOriginalResponse`, `sendMessage`/`editMessage` + `safe*` wrappers |
| utils | `utils/embed-text.ts`, `utils/sql-helpers.ts`, `utils/safe-json.ts`, `utils/url-sanitizer.ts`, `utils/verify.ts`, `utils/env-validation.ts` | budgets, LIKE escaping, JSON hardening, log redaction, Ed25519 re-export, env gate |
| config | `wrangler.toml` | routeless `…-dev` default env; `[env.production]` on two custom domains; two `[[ratelimits]]` per env (25 / 70 @ 60 s); D1 `xivdyetools-presets`; `PRESETS_API` binding |
| migrations | — | owns none; depends on presets-api `schema.sql` + `migrations/0003` (banned_users) and `0013` (moderation_log user actions) |

## 2. Candidates

---

### moderation-worker-01 — BUG — **HIGH** — `src/handlers/commands/preset.ts:321-324`

**Claim:** `/preset moderate action:stats` renders `undefined` in all four embed fields — the client reads
`*_count` keys that `presets-api` does not return.

**Failing input → wrong outcome:** any moderator running `/preset moderate action:stats`. presets-api's
`GET /api/v1/moderation/stats` returns `{ stats: { pending, approved, rejected, flagged,
actions_last_week } }` (`apps/presets-api/src/handlers/moderation.ts:295-306` — the SQL aliases carry no
`_count` suffix, and its own test asserts `body.stats.pending` at
`apps/presets-api/tests/handlers/moderation.test.ts:1015-1042`). moderation-worker binds the response to
`ModerationStats` (`packages/types/src/api/moderation.ts:55-67`), which declares `pending_count /
approved_count / rejected_count / flagged_count`. `request<T>()` is a bare cast of `await
response.json()` (`src/services/preset-api.ts:128`), so nothing maps or validates the shape and TypeScript
cannot see the drift. Every field therefore evaluates `String(undefined)` → the literal string
`"undefined"`.

**Why tests miss it:** `src/handlers/commands/preset.test.ts:876-880` mocks `getModerationStats` to
resolve the `_count`-suffixed object and then asserts the embed shows exactly those numbers — the mock
supplies the constant the assertion checks, so the test passes on both the working and the broken shape.
`src/services/preset-api.test.ts:455` only asserts the request URL.

**Covered by test:** no.

```ts
// src/handlers/commands/preset.ts:320-325
fields: [
  { name: '🟡 Pending',  value: String(stats.pending_count),  inline: true },
  { name: '🟢 Approved', value: String(stats.approved_count), inline: true },
  { name: '🔴 Rejected', value: String(stats.rejected_count), inline: true },
  { name: '🟠 Flagged',  value: String(stats.flagged_count),  inline: true },
],
```

**Fix direction:** make one side canonical — either alias the SQL columns to `*_count` in presets-api (and
keep `actions_last_week`), or map the response in `getModerationStats`; then pin it with a contract test
that runs the real presets-api handler rather than a mock.

---

### moderation-worker-02 — BUG — **MEDIUM** — `src/utils/discord-api.ts:35-62`

**Claim:** `editOriginalResponse` is fire-and-forget — no `AbortSignal`, no `.ok` check at any of its five
call sites, no `safe*` wrapper — so a Discord rejection leaves the moderator's deferred interaction on
"thinking…" with nothing logged.

**Failing input → wrong outcome:** any `/preset moderate` (pending / approve / reject / stats) or
`/preset unban_user` whose follow-up PATCH Discord refuses — a 400 on an over-long embed, a 404 on an
expired interaction token, a 429. The non-ok `Response` is returned and discarded by every caller
(`src/handlers/commands/preset.ts:119, 599, 616, 623, 651`); the moderator sees the deferral spinner
forever and the logs say nothing. With no `AbortSignal` a stalled connection also holds the `waitUntil`
promise open. `sendMessage` and `editMessage` both carry `signal: AbortSignal.timeout(5000)` and both got
throw-safe, outcome-checked wrappers under BUG-035 (`src/utils/discord-api.ts:99, 135, 146-190`);
`editOriginalResponse` was left out of that pass.

**Why tests miss it:** `src/utils/discord-api.test.ts` has "should include timeout signal" for
`sendMessage` (:131) and `editMessage` (:206) but no equivalent for `editOriginalResponse`, and its
`error handling` block only exercises `sendMessage`. No handler test asserts what happens when the
follow-up PATCH is refused.

**Covered by test:** no.

```ts
// src/utils/discord-api.ts:47-54 — no signal, and the caller never reads the result
  try {
    return await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
```

**Fix direction:** add `signal: AbortSignal.timeout(5000)` and a `safeEditOriginalResponse` that logs
`res.status` + body on `!res.ok`, and route all five call sites through it.

---

### moderation-worker-03 — BUG — **LOW** — `src/utils/safe-json.ts:140-146`

**Claim:** `freezeResult` is silently skipped whenever structure validation produced a warning — the
warning branch returns before Step 4 ever runs.

**Failing input → wrong outcome:** an interaction body containing an array of more than 100 elements
(`validateObjectStructure` pushes `Large array detected: …` at :280-282). `safeParseJSON` then returns at
:141-146 and never reaches the `deepFreeze` at :150-152, so `src/index.ts:171-175` — which asks for
`freezeResult: true` — gets a mutable object while believing it is frozen. Low severity only because the
body is Ed25519-verified before it is parsed, so the array has to come from Discord itself.

**Why tests miss it:** `src/utils/safe-json.test.ts` never asserts `Object.isFrozen` on a result at all
(the only "freeze" test, :195-201, checks a primitive), and the sole large-array test (:220) uses 1001
elements, which takes the *invalid* branch rather than the warning branch.

**Covered by test:** no.

```ts
// src/utils/safe-json.ts:140-146 — early return before the freeze step
    if (validation.warnings && validation.warnings.length > 0) {
      return { success: true, data: parsed as T, warnings: validation.warnings };
    }
  }
  if (freezeResult && typeof parsed === 'object' && parsed !== null) { deepFreeze(parsed); }
```

**Fix direction:** hoist the warnings into a local and fall through to the freeze step; add an
`Object.isFrozen(result.data)` assertion covering both the clean and the warning path.

---

### moderation-worker-04 — BUG — **LOW** — `src/index.ts:334-337` vs `src/services/preset-api.ts:434-439`

**Claim:** the `preset_id` autocomplete branch never clamps choice names to Discord's 100-character cap,
although the helper written for exactly that hazard is applied to the two ban branches.

**Failing input → wrong outcome:** `searchPresetsForAutocomplete` builds
`` `${preset.name} (${preset.vote_count}★) by ${preset.author_name}` `` with no cap. presets-api caps
`name` at 50 (`validation-service.ts:22`) but stores `author_name` verbatim from the
`X-User-Discord-Name` header with **no** length rule (`apps/presets-api/src/handlers/presets.ts:977`;
`apps/presets-api/src/middleware/auth.ts:249` reads the header raw). A 60-plus-character author name
pushes one choice past 100 chars and Discord rejects the whole autocomplete response — the moderator's
`preset_id` list goes blank, which is precisely what `clampChoiceName`'s own comment says must not happen.
Even in the ordinary case (50-char name + 32-char Discord name) the string lands at ~94 chars, six from
the cliff.

**Why tests miss it:** `src/autocomplete.test.ts:187` exercises the clamp through the `ban_user` branch
only (`searchPresetAuthors` mocked with a 200-char username); no test drives a long name through the
`preset_id` branch.

**Covered by test:** no.

```ts
// src/index.ts:479-485 — clamped …            // src/services/preset-api.ts:434-439 — not clamped
name: clampChoiceName(                          name: preset.author_name
  `${user.username} (discord:${user.discordId}) …`  ? `${preset.name} (${preset.vote_count}★) by ${preset.author_name}`
),                                                : `${preset.name} (${preset.vote_count}★)`,
```

**Fix direction:** apply `clampChoiceName` (or move it into `searchPresetsForAutocomplete`) on the
`preset_id` branch too; optionally add a length rule to `author_name` in presets-api.

---

### moderation-worker-05 — BUG — **LOW** — `src/handlers/commands/preset.ts:276-307`

**Claim:** `/preset moderate action:reject` is the only moderation action that never reaches
`SUBMISSION_LOG_CHANNEL_ID`.

**Failing input → wrong outcome:** rejecting from the slash command. `handleApproveAction` posts to the
submission log (:259-270), `processRejection` does (`handlers/modals/preset-rejection.ts:114-126`),
`processApproval` does (`handlers/buttons/preset-moderation.ts:161-172`), `processRevert` does — only
`handleRejectAction` does not. The Discord-visible record of rejections is therefore incomplete depending
on which surface the moderator used. The durable trail is unaffected: presets-api still writes the
`moderation_log` row in its status batch.

**Why tests miss it:** `preset.test.ts:633` asserts the *approve* path posts to the log channel; there is
no matching "reject sends log message" test, so the omission is simply never asked about.

**Covered by test:** no.

**Fix direction:** mirror the approve branch's `if (ctx.env.SUBMISSION_LOG_CHANNEL_ID) safeSendMessage(…)`
block in `handleRejectAction`.

---

### moderation-worker-06 — BUG — **LOW** — `src/handlers/commands/preset.ts:287` vs `src/handlers/modals/preset-rejection.ts:64`

**Claim:** the rejection-reason floor depends on the entry point — the modal demands ten characters, the
slash command accepts one.

**Failing input → wrong outcome:** `/preset moderate action:reject preset_id:<uuid> reason:x` is accepted
and stored as the `moderation_log.reason` for that rejection, while the modal path refuses anything under
10 characters with "Please provide a valid rejection reason (at least 10 characters)." presets-api does
not close the gap: `validateModerationReason` (10-200) is applied to `/revert` only, never to
`/:presetId/status` (`apps/presets-api/src/handlers/moderation.ts:77, 148-152`).

**Why tests miss it:** `preset.test.ts:822` only covers the *missing* reason; no test supplies a short one.

**Covered by test:** no.

**Fix direction:** apply the same `reason.length < 10` guard in `handleRejectAction`, or move the rule
into presets-api's status route so both writers inherit it.

---

### moderation-worker-07 — BUG — **LOW** — `src/services/ban-service.ts:550-573`

**Claim:** the two writers of `presets.status` disagree on `updated_at` — presets-api always bumps it,
moderation-worker's ban/unban never does.

**Failing input → wrong outcome:** ban a user, then read one of their presets as a moderator. Its `status`
is `hidden` but `updated_at` still reports the last presets-api write. `prepareStatusUpdate` sets
`status = ?, updated_at = ?` (`apps/presets-api/src/services/preset-service.ts:447-453`) and so do the
preview-image and vote writes; `hideUserPresetsStatement` / `restoreUserPresetsStatement` set only
`status`. `updated_at` is on the public preset object (`packages/types/src/preset/community.ts:81`).
Latent today: nothing sorts or caches on it (`sort` uses `created_at` / `vote_count`,
`preset-service.ts:264-276`), so the field is merely wrong rather than load-bearing.

**Why tests miss it:** `ban-service.test.ts` asserts the UPDATE text (`SET status = 'hidden'`) rather than
comparing the two writers' column sets; there is no cross-worker invariant test.

**Covered by test:** no.

**Fix direction:** bind `updated_at = ?` with the batch's existing `now` in both statements.

---

### moderation-worker-08 — BUG — **LOW** — `src/services/ban-service.ts:79, 148`

**Claim:** the ban and unban user pickers show nothing until the moderator types a character, so active
bans cannot be browsed.

**Failing input → wrong outcome:** Discord sends an autocomplete interaction with `value: ''` as soon as
the option is focused (`src/index.ts:434` turns it into `''`). `validateAndEscapeQuery(query, { maxLength:
100, minLength: 1 })` fails length validation for the empty string
(`src/utils/sql-helpers.ts:120-126`) and both `searchPresetAuthors` and `searchBannedUsers` return `[]`.
For `unban_user` this is the whole feature: a moderator who does not remember the banned user's stored
display name has no way to list who is currently banned.

**Why tests miss it:** every autocomplete test passes a non-empty query (`autocomplete.test.ts`'s
`autocompleteInteraction` helper and `ban-service.test.ts:62-244`); the empty-query case is never asked.

**Covered by test:** no.

**Fix direction:** drop `minLength` (or special-case `''`) so an empty query returns the top-N rows, with
the existing `LIMIT 25` doing the bounding.

---

### moderation-worker-09 — BUG — **LOW** — `src/handlers/modals/ban-reason.ts:97-107, 110-198`

**Claim:** the ban acknowledges with "⏳ Processing Ban…" and never resolves that message — the outcome
goes only to the moderation channel.

**Failing input → wrong outcome:** submit the ban reason modal. `handleBanReasonModal` returns
`updateMessageResponse` with the "Processing Ban…" embed, and `processBan` reports success *and* failure
solely via `safeSendMessage(env.DISCORD_TOKEN, env.MODERATION_CHANNEL_ID, …)`. It never touches
`interaction.token` — the parameter is literally named `_interaction` (:111). If the channel post is
refused (missing permission, wrong id) `safeSendMessage` returns `false` and nobody checks it, so the
moderator's only feedback is a permanent spinner-shaped embed that gives no clue whether the ban landed.

**Why tests miss it:** `ban-reason.test.ts:397` asserts that *no message is sent* when the channel is not
configured, treating the silent outcome as the expected behaviour rather than a gap.

**Covered by test:** no.

**Fix direction:** have `processBan` edit the interaction's original response (or send an ephemeral
follow-up) with the final outcome, keeping the channel post as the public record.

---

### moderation-worker-10 — BUG — **LOW** — `src/services/ban-service.ts:196-245` + `src/handlers/commands/preset.ts:475-483`

**Claim:** a user who has never submitted a preset cannot be banned at all.

**Failing input → wrong outcome:** `/preset ban_user user:<snowflake of a vote-only abuser>`.
`getUserForBanConfirmation` derives the identity from `SELECT … FROM presets WHERE author_discord_id = ?
GROUP BY author_discord_id` and returns `null` when the user has no presets, so the command answers "User
not found or has no presets." The ban itself is meaningful for such a user — presets-api's
`requireNotBanned` guards POST/PATCH/DELETE on both the presets and the votes routers
(`apps/presets-api/src/handlers/presets.ts:121`, `handlers/votes.ts:30`) — but there is no path to create
the ban, because `banUser` also needs a `username` that only a preset can supply.

**Why tests miss it:** `preset.test.ts:1101` asserts exactly this behaviour ("should return error when
user not found"), so the limitation is pinned as intended rather than surfaced.

**Covered by test:** the behaviour is tested; the gap is a product decision nobody re-examined.

**Fix direction:** fall back to the raw snowflake as `username` (as the modal already does at
`ban-reason.ts:83-85`) and let the confirmation embed show "no presets" instead of refusing.

---

### moderation-worker-11 — BUG — **LOW** — `src/handlers/modals/preset-rejection.ts:64-66`, `src/handlers/commands/preset.ts:303`

**Claim:** the rejection reason the bot insists on collecting has no path to the submitter.

**Failing input → wrong outcome:** the modal's placeholder reads "Please provide a clear reason for
rejecting this preset…" and enforces a 10-character minimum, but the reason only ever lands in (a) the
moderator-facing embed edit, (b) `SUBMISSION_LOG_CHANNEL_ID`, and (c) `moderation_log`. presets-api's
`PATCH /:presetId/status` sends no notification (`apps/presets-api/src/handlers/moderation.ts:59-122` —
`notifyDiscordBot` is used only for submission and preview-image events), and
`GET /api/v1/moderation/:presetId/history`, the only reader of `moderation_log.reason`, is gated by
`requireModerator` (:264-266). The author is never told their preset was rejected, let alone why.

**Why tests miss it:** every rejection test asserts the moderator-facing surfaces; no test asserts an
author-facing one, because none exists.

**Covered by test:** no.

**Fix direction:** product decision — either notify the author (a DM through discord-worker, reusing the
existing dead-letter queue) or drop the copy that implies the reason is for them.

---

### moderation-worker-12 — REFACTOR — **LOW** — `src/utils/response.ts:262-289`

**Claim:** `rateLimitedResponse`'s JSDoc contradicts its implementation. The doc promises "Response with
429 status and Retry-After header" and documents a `resetTime` parameter; the function returns HTTP 200
with a `CHANNEL_MESSAGE_WITH_SOURCE` body, no `Retry-After`, and ignores `_resetTime` entirely. The 200 is
correct (Discord needs an interaction response), so the doc — and the dead parameter — are what is wrong.
`response.test.ts:296` only checks `allowed_mentions` and `flags`, so nothing pins the status.
**Fix:** rewrite the doc to describe the interaction-response contract and drop `_resetTime`, or use it to
render "try again in Ns" in the message.

---

### moderation-worker-13 — REFACTOR — **LOW** — `src/handlers/commands/preset.ts:181`

**Claim:** the review queue has no pagination. `handlePendingAction` renders `presets.slice(0, 10)` with
no page option and no "showing 10 of N" line — the count line reports the true total, but presets 11+ can
only be acted on through `preset_id` autocomplete, which itself caps at 25 and only matches on a typed
search. A backlog above 25 has entries no surface can reach.
**Fix:** add a `page` option to the `moderate` subcommand, or render "showing 1-10 of N — refine with
`preset_id`".

---

### moderation-worker-14 — OPT — **LOW** — `src/handlers/commands/preset.ts:596-606` + `src/services/ban-service.ts:489`

**Claim:** three sequential D1 round trips per unban where one batch answers everything. `processUnban`
calls `getActiveBan` (`SELECT *`) for the username, then `unbanUser` re-asks with
`isUserBannedByDiscordId` (`SELECT 1`), then runs the batch — whose `updateResult.meta.changes` already
distinguishes "was not banned" from "unbanned". `banUser` has the same redundant pre-check (:398), which
the `idx_banned_users_discord_active` UNIQUE index and the catch at :461-467 already cover.
**Fix:** drop `isUserBannedByDiscordId` from both operations and derive the message from
`meta.changes === 0`; keep `getActiveBan` (it supplies the display name).

---

## 3. POSITIVE — do not re-file

- Ban and unban each run as **one** `db.batch()` with the `moderation_log` rows ordered ahead of the
  UPDATE they mirror, and the `unban` row gated on `changes() > 0`; `ban-service.test.ts:884-1082` asserts
  the statement order and bindings structurally and states plainly where the mock cannot evaluate SQL.
- The env-validation gate re-validates on **every** request and latches only the reporting
  (`src/index.ts:91-135`); `env-validation-gate.test.ts:120` pins the second request in the isolate and
  `/health` alongside it. The 2026-08-29 middleware reorder (gate after requestId/logger/headers) holds.
- Authorization is uniform: `isModerator` is re-checked at every entry point — slash command, autocomplete
  (`index.ts:370`), both ban buttons, all three modals — and ids are re-validated at each boundary
  (`isValidUuid` for presets, `/^\d{17,20}$/` / `isValidSnowflake` for users) instead of trusted from the
  `custom_id`.
- `custom_id`s carry ids only (FINDING-007), with legacy base64 username suffixes tolerated and ignored,
  so no user-controlled text can push one past Discord's 100-char cap.
- Cross-application routing is coherent: discord-worker posts the moderation embed with
  `MODERATION_BOT_TOKEN` and drops the buttons entirely when it lacks it
  (`apps/discord-worker/src/handlers/commands/preset-notifications.ts:59-64, 120-123`), so every button
  moderation-worker receives is on a message its own token can edit.
- HMAC v2 signing and verification agree on scope: both sides sign `new URL(...).pathname`
  (`services/preset-api.ts:88` vs `apps/presets-api/src/middleware/auth.ts:310`).
- Every user-sourced string that reaches an embed goes through the shared `sanitizeEmbedText` budgets
  (`utils/embed-text.ts`), and every outbound body carries `ALLOWED_MENTIONS_NONE` by default.

## 4. REJECTED

- **Rate-limit tier mis-routing.** `selectTier` picks the smallest tier ≥ `maxRequests + burstAllowance`;
  command (20+5=25) → `RL_COMMAND` (limit 25), autocomplete (60+10=70) → `RL_AUTOCOMPLETE` (limit 70), and
  `wrangler.toml:33-41, 89-97` matches. Keys are `command:<id>` / `autocomplete:<id>`, so no bucket sharing.
- **`moderatorIdsCache` module-scope singleton (`preset-api.ts:192`).** A `wrangler secret put` restarts
  the isolate, so it cannot serve a stale allowlist; `env.MODERATOR_IDS` is constant within an isolate.
- **`unbanUser`'s unconditional restore beside a `changes() > 0`-gated audit row.** The asymmetry is real
  (statements 3-4 of the batch are not gated), but I could not construct an interleaving in which the
  restore flips a row while the `banned_users` UPDATE matches none — losing the race means the winner
  already set those rows to `approved`.
- **Unban restoring presets hidden for a non-ban reason.** `validStatuses` excludes `hidden`
  (`apps/presets-api/src/services/validation-service.ts:49`), so the ban path is the only writer of that
  status and `restoreUserPresetsStatement` cannot un-hide anything a moderator hid individually.
- **ISO-`T` vs `datetime('now')` space format.** Both writers bind JS ISO strings and
  `/moderation/stats` compares with `strftime('%Y-%m-%dT%H:%M:%fZ', …)`; the table DEFAULTs are never
  reached (BUG-050 already fixed this).
- **Pending-queue embed exceeding the 4096-char description limit.** Worst case is 10 entries ×
  (100-char name + 64-char author + 36-char id + a ~90-char R2 URL) ≈ 3.5 K.
- **`banUser` TOCTOU between `isUserBannedByDiscordId` and the batch.** `idx_banned_users_discord_active`
  makes the losing insert fail and :461-467 maps UNIQUE → "User is already banned."
- **Floating promises in `ctx.waitUntil`.** Every `process*` body sits inside a try whose catch calls only
  the throw-safe `safeSendMessage` / `safeEditMessage`; `sanitizeEmbedText` cannot throw
  (`packages/bot-logic/src/discord-markdown.ts:61-71`).
- **`safeParseJSON` rejecting real Discord payloads.** `__proto__` / `constructor` / `prototype` never
  appear as Discord keys, and interactions nest ≤6 deep against `maxDepth: 10`.
- **`searchPresetAuthors`' `catch` fallback dropping the banned filter.** Deliberate and documented (a D1
  without `banned_users`); the worst outcome is offering an already-banned user, which `banUser` then
  refuses.
- **Cross-application `custom_id` collision** between the `preset_reject_` button prefix and the
  `preset_reject_modal_` modal id. They arrive as different interaction types (3 vs 5) and are routed by
  separate dispatchers (`index.ts:210, 215`).

## 5. COVERED

**30 non-test files read in full** (moderation-worker unless noted):

`src/index.ts`; `src/handlers/commands/index.ts`; `src/handlers/commands/preset.ts`;
`src/handlers/buttons/index.ts`; `src/handlers/buttons/preset-moderation.ts`;
`src/handlers/buttons/ban-confirmation.ts`; `src/handlers/modals/index.ts`;
`src/handlers/modals/preset-rejection.ts`; `src/handlers/modals/ban-reason.ts`;
`src/services/ban-service.ts`; `src/services/preset-api.ts`; `src/services/i18n.ts`;
`src/services/bot-i18n.ts`; `src/middleware/rate-limit.ts`; `src/types/env.ts`; `src/types/ban.ts`;
`src/types/preset.ts`; `src/types/modal.ts`; `src/utils/response.ts`; `src/utils/discord-api.ts`;
`src/utils/embed-text.ts`; `src/utils/sql-helpers.ts`; `src/utils/safe-json.ts`;
`src/utils/url-sanitizer.ts`; `src/utils/verify.ts`; `src/utils/env-validation.ts`;
`scripts/register-commands.ts`; `wrangler.toml`; `package.json`; `vitest.config.ts`.

**Tests skimmed (all 25):** full `it`/`describe` listings for every test file, with bodies read for
`ban-service.test.ts` (:884-1082), `preset.test.ts` (:870-932), `autocomplete.test.ts` (:119-199),
`component-gate.test.ts` (:74-140), `env-validation-gate.test.ts` (:106-140),
`discord-api.test.ts` (:238-262), `safe-json.test.ts` (:191-221), `response.test.ts` (:296-315),
`tests/wrangler-config.test.ts`.

**Cross-unit files read to confirm claims (read-only):**
`apps/presets-api/src/handlers/moderation.ts`, `.../handlers/votes.ts` (head),
`.../handlers/presets.ts` (excerpts), `.../services/preset-service.ts` (excerpts),
`.../services/validation-service.ts` (excerpts), `.../services/notification-service.ts` (exports),
`.../middleware/ban-check.ts`, `.../middleware/auth.ts` (excerpts), `.../schema.sql`,
`.../migrations/0003_add_banned_users.sql`, `.../migrations/0013_moderation_log_user_actions.sql`,
`.../tests/handlers/moderation.test.ts` (excerpt);
`packages/worker-kit/src/rate-limiter/backends/cloudflare.ts`,
`packages/worker-kit/src/rate-limiter/presets/configs.ts`;
`packages/types/src/api/moderation.ts`; `packages/bot-logic/src/discord-markdown.ts`;
`apps/discord-worker/src/handlers/commands/preset-notifications.ts`.
