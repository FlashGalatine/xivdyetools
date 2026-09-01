# Manual Security Review — `apps/moderation-worker` (moderation-worker 1.5.0)

- **Audit:** 2026-08-29 whole-monorepo security audit (see `REVIEWER_BRIEF.md`)
- **Reviewer:** Claude Code (Fable 5), read-only manual code review in the audit worktree at `4c213248` (= `main`); no source file modified
- **Deploy unit:** `xivdyetools-moderation-worker` → `moderation-bot.xivdyetools.app` (+ `moderation-bot.xivdyetools.projectgalatine.com`), Cloudflare Worker + Hono, Discord HTTP-Interactions bot for community-preset moderation
- **Trust boundary:** Discord → `POST /` (Ed25519 + 5-min freshness) → per-interaction handlers. Outbound: presets-api over the `PRESETS_API` service binding (Bearer `BOT_API_SECRET` + HMAC v1 **and** v2), **direct read/write on the production `xivdyetools-presets` D1** (`e17d68a1…`), **KV namespace `1fcb7e03…` shared with discord-worker production**, Discord REST (bot token). Native `[[ratelimits]]` `RL_COMMAND` 25/60 s and `RL_AUTOCOMPLETE` 70/60 s in `[env.production]`.
- **Delta since 2026-08-21 (`b195723f..HEAD`, 6 commits / 32 files):** `e90922f9` (FINDING-003 native limiter), `8a05949d` (FINDING-006/007), `b5906a21` (FINDING-014/021 + sanitiser), `812d6f8b` (FINDING-019/020/023/034), then two Dependabot bumps (`9610b318`, `8729a0d9`). Every current non-test source file was read in full, the delta commits' intent checked against the code, and the guarding tests read or grepped for their load-bearing assertions.
- **Test run:** `pnpm --filter xivdyetools-moderation-worker exec vitest run` in the main checkout (`C:/dev/XIVProjects/xivdyetools`, same commit): **22 files, 648 tests, all passing** (3.2 s).

## Executive summary

All seven previous-audit fixes that touch this unit are real, in the deployed code path, and have a test that would fail if they regressed (table in *Previous-audit fixes* below). The authorization model is now uniform: `MODERATOR_IDS` is enforced on every slash subcommand, every autocomplete branch, every button (including `ban_cancel_`) and every modal, before any D1/API work; ids are shape-validated at the boundary and URL-encoded in presets-api paths; every user-sourced string is sanitised and every outbound Discord body carries `allowed_mentions: { parse: [] }`. No CRITICAL or HIGH candidate was found.

What is left is small and mostly carried forward:

1. **MOD-01 (MEDIUM, personal data)** — the ban log line writes the target's display name and the moderator's free-text reason into structured Workers logs; neither field is covered by the privacy policy for that purpose (the D1 `banned_users` row is the purposeful store).
2. **MOD-02 (LOW)** — the native rate-limit binding fails **open** and **silently**: the `CloudflareRateLimiter` is constructed without a logger, `env-validation` does not require the two bindings, and the KV fallback is chosen without a log line — so the POST_MERGE_CHECKLIST §3 gate ("no fallback warning in a week of logs") is unobservable for this worker.
3. **MOD-03 (LOW, FINDING-034 carry-forward)** — ban / unban / hide / restore still write no `moderation_log` rows (deliberately deferred to a presets-api-owned decision); accountability survives in `banned_users` itself.
4. Three INFO items: ban-model gaps (moderators/self bannable, banned moderators keep rights, target must own a preset), the v1 HMAC header still emitted (presets-api still accepts v1-only), and the shared KV binding whose only remaining use is a read of a legacy key discord-worker no longer writes.

| Severity | Count | IDs |
|---|---|---|
| CRITICAL | 0 | — |
| HIGH | 0 | — |
| MEDIUM | 1 | MOD-01 |
| LOW | 2 | MOD-02, MOD-03 |
| INFO | 3 | MOD-04, MOD-05, MOD-06 |

---

## Route / command table + authz matrix

Pre-handler chain for every request (`src/index.ts`): first-request env validation (`:56-80`, logs only) → `requestIdMiddleware` → `loggerMiddleware` (`:84-88`, `sanitizePath: sanitizeUrl`, no User-Agent, no IP) → post-handler security headers (`:91-99`: nosniff, DENY, HSTS, `no-store`, CSP `default-src 'none'`, `no-referrer`). `POST /`: `verifyDiscordRequest` over the raw body (`:122-132`; 100 KB header + byte cap, freshness 300 s / 60 s future skew, fail-closed) → `safeParseJSON` (`:135-150`; depth ≤ 10, arrays ≤ 1000, ≤ 1000 keys, prototype-pollution keys rejected, deep-frozen) → dispatch on `interaction.type`. Every other path is a Hono 404; `GET /health` is a static `{status:'ok'}`.

| Entry point (`src/…`) | Reachable by | Channel pin | `isModerator` | ID validation | Rate limit | Backing store / side effects |
|---|---|---|---|---|---|---|
| `POST /` PING (`index.ts:155`) | Discord, after signature | – | – | – | – | – |
| `/preset moderate` (`commands/preset.ts:336-380`) | any guild member with Manage Server who can see the command | ✔ `MODERATION_CHANNEL_ID` (`:346`, fails closed when unset `:90`) | ✔ `:351` | UUID on approve/reject (`:137`) | ✔ `command`, before dispatch (`index.ts:206`) | presets-api (service binding); approve also D1 read `isPresetAuthorBanned` (`:239`) |
| `/preset ban_user` (`:446-539`) | same | ✔ `:456` | ✔ `:461` | snowflake `:470` | ✔ | D1 read `getUserForBanConfirmation` (`:475`); ephemeral confirm with `ban_confirm_<id>` / `ban_cancel_<id>` (`:525,:532`) |
| `/preset unban_user` (`:546-584`) | same | ✔ `:556` | ✔ `:561` | snowflake `:570` | ✔ | D1 read `getActiveBan` + **write** `unbanUser` batch (`:596,:606`) |
| unknown subcommand (`:81`) / unknown command (`index.ts:223`) | any | – | – | – | ✔ | ephemeral echo; command name sanitised, subcommand name not (see Rejected) |
| Autocomplete `preset_id` for `moderate` (`index.ts:383-391`) | any user who can see the command | ✘ | ✔ `:316` **before** the limiter | – | ✔ `autocomplete` (`:322`) | presets-api `GET /presets?status=pending` with moderator identity |
| Autocomplete `user` for `ban_user` (`:395-396`) | same | ✘ | ✔ | – | ✔ | **D1 `presets` read** (`ban-service.ts:73-137`, LIKE escaped) |
| Autocomplete `user` for `unban_user` (`:397-398`) | same | ✘ | ✔ | – | ✔ | **D1 `banned_users` read** (`:142-187`) |
| Button `preset_approve_<uuid>` (`buttons/preset-moderation.ts:70-98`) | clicker of a message posted with the moderation bot token | ✘ | ✔ `:89` | UUID `:85` | ✔ `command` (`index.ts:482`) | D1 read `:115`, presets-api PATCH `:137`, Discord edit + `SUBMISSION_LOG_CHANNEL_ID` post |
| Button `preset_reject_<uuid>` → modal (`:208-254`) | same | ✘ | ✔ `:226` | UUID `:222` | ✔ | – |
| Button `preset_revert_<uuid>` → modal (`:260-306`) | same | ✘ | ✔ `:278` | UUID `:274` | ✔ | – |
| Button `ban_confirm_<id>` → modal (`buttons/ban-confirmation.ts:56-115`) | owner of the ephemeral confirmation | ✘ | ✔ `:69` | snowflake `:86` | ✔ | – |
| Button `ban_cancel_<id>` (`:125-151`) | same | ✘ | ✔ `:137` (MOD-12 fixed) | – | ✔ | UPDATE_MESSAGE only |
| unknown button / select menu (`buttons/index.ts:111`, `index.ts:491`) | any | – | – | – | ✔ | constant ephemeral |
| Modal `preset_reject_modal_<uuid>` (`modals/preset-rejection.ts:36-73`) | moderator who opened it | ✘ | ✔ `:58` | UUID `:53`; reason ≥ 10 `:64` | ✔ (`index.ts:515`) | presets-api PATCH status; Discord edit + log-channel post |
| Modal `preset_revert_modal_<uuid>` (`:162-198`) | same | ✘ | ✔ `:183` | UUID `:178`; reason ≥ 10 | ✔ | presets-api PATCH revert |
| Modal `ban_reason_modal_<id>` (`modals/ban-reason.ts:33-108`) | same | ✘ | ✔ `:47` | snowflake `:65`; reason ≥ 10 `:89` | ✔ | D1 read `getPresetAuthorName` `:72`; **D1 write** `banUser` batch (`ban-service.ts:305-315`); post to `MODERATION_CHANNEL_ID` |
| unknown modal (`index.ts:534`) | any | – | – | – | ✔ | constant ephemeral |
| `GET /health` (`index.ts:105`) | anyone | – | – | – | – | static |

Outbound targets are constants only: `https://discord.com/api/v10/…` (`utils/discord-api.ts:12`), the `PRESETS_API` service binding at `https://internal<path>` (`services/preset-api.ts:182-187`) or the `PRESETS_API_URL` var (`:190`); user data enters paths only as validated + `encodeURIComponent`-ed segments (`:361-363`) or `URLSearchParams` values (`:337-346`). No SSRF surface.

Ban / unban semantics (direct D1, bypassing presets-api): `banUser` = `INSERT banned_users` + `UPDATE presets SET status='hidden' WHERE author_discord_id=? AND status='approved'` in one `db.batch` (`ban-service.ts:305-315`, `:415-425`); `unbanUser` = close the ban row + `hidden → approved` in one batch (`:374-385`, `:428-438`); a concurrent second ban hits the unique partial index `idx_banned_users_discord_active` (`presets-api/migrations/0003_add_banned_users.sql:29-31`) and is mapped to a fixed message (`:334-340`). presets-api treats `hidden` as unlistable/404 (`preset-service.ts:169-173`, `presets.ts:475`) and never sets it itself (`validation-service.ts:436`), so restore-on-unban cannot un-hide anything hidden for another reason. Both approve paths refuse a banned author (`preset.ts:239`, `preset-moderation.ts:115`). `requireNotBanned` on presets-api guards submit/edit/delete/vote (`presets.ts:100`, `votes.ts:22`) by `discord_id` only.

### Previous-audit fixes touching this unit — status

| Finding | Code (current) | Guarding test | Status |
|---|---|---|---|
| FINDING-003 native limiter | `middleware/rate-limit.ts:134-153` builds `CloudflareRateLimiter` tiers 25/70 from `RL_COMMAND`/`RL_AUTOCOMPLETE`; bindings in `wrangler.toml:76-84` (prod) and `:33-41` (dev); `checkOnly` consumes, `increment` no-op | `middleware/rate-limit-binding.test.ts:44-71` (binding called with `ratelimit:command:<uid>`, denies on `success:false`, **KV `_store.size === 0`**) | FIXED — but fail-open + silent, see MOD-02 |
| FINDING-006 autocomplete gate | `index.ts:316-319` before any D1/API work | `autocomplete.test.ts:89-101` (non-moderator → `[]`, `searchBannedUsers`/`searchPresetAuthors` **never called**) | FIXED |
| FINDING-007 `custom_id` ≤ 100 | `preset.ts:525,:532`, `ban-confirmation.ts:94` carry the snowflake only; name resolved from D1 at submit (`ban-reason.ts:72`) | `commands/preset.test.ts:1189-1223` (32-char CJK name → `custom_id.length ≤ 100`), `ban-confirmation.test.ts:222-260`, `ban-reason.test.ts:243` | FIXED. No other flow embeds free text in a `custom_id` (all remaining ids are `preset_*_<uuid>` / `ban_*_<snowflake>`) |
| FINDING-014 v2 signature | `preset-api.ts:149-164` (`X-Request-Signature-V2` + nonce over method/path/body-hash/ts/nonce/identity; canonical string length-prefixed, `auth/hmac.ts:326-337`) | `services/preset-api-v2.test.ts:36-84` (verifies against method/path/body; tampered body fails) | FIXED; v1 header still sent (MOD-05) |
| FINDING-019 sanitiser + `allowed_mentions` | `utils/embed-text.ts`, `utils/response.ts:91-95`, `utils/discord-api.ts:28-30`; all embeds in the three handler files | `utils/response.test.ts` + `utils/discord-api.test.ts` (30 `allowed_mentions` assertions), `utils/embed-text.test.ts` | FIXED |
| FINDING-020 id validation + encoding | `preset-api.ts:361-363` `pathSegment`; UUID gates on both modals (`preset-rejection.ts:53,:178`); snowflake gates (`preset.ts:470,:570`, `ban-confirmation.ts:86`, `ban-reason.ts:65`) | `services/preset-api.test.ts:710` (`../../presets/abc` → `..%2F..%2Fpresets%2Fabc`), `preset-rejection.test.ts:71,:663`, `preset.test.ts:1774,:1783` | FIXED |
| FINDING-021 freshness | defaults 300 s / 60 s in `packages/auth/src/discord.ts:99-110`; this worker calls with defaults (`index.ts:122-125`) | `packages/auth/src/discord-freshness.test.ts` (shared package; no local test needed) | FIXED |
| FINDING-023 `.app` links | `preset.ts:39` | `preset.test.ts:1790-1798` | FIXED |
| FINDING-034 (MOD-4/5/8/12/13/14) | batch writes, approve-refusal, modal UUID gates, channel-safe errors, component limiter, moderator identity on autocomplete, xivauth filter — all present (lines in the matrix) | `component-gate.test.ts`, `autocomplete.test.ts:118-199`, `ban-service.test.ts`, `preset-moderation.test.ts` | FIXED except the `moderation_log` part — MOD-03 |

---

## Candidates

### MOD-01 — Ban audit log line writes the target's display name and the moderator's free-text reason into structured Workers logs (CWE-532 / CWE-359)

- **Severity:** MEDIUM (per brief rule: personal fields reaching a log for a purpose the policy does not list; audience and retention are the mitigations, see below — coordinator may calibrate to LOW)
- **Exposure:** INTERNET-AUTH (fires on a moderator's ban submission)
- **Rotation:** none
- **Location:** `apps/moderation-worker/src/handlers/modals/ban-reason.ts:169-175`

```ts
// ban-reason.ts:169-175
logger.info('User banned', {
  targetUserId,
  targetUsername,      // author-controlled display name from presets.author_name (or legacy custom_id)
  moderatorId,
  presetsHidden: result.presetsHidden,
  reason,              // moderator-typed modal text, ≤ 500 chars, may quote the offending content / describe the person
});
```

- **Trigger:** a moderator completes `/preset ban_user` → *Yes, Ban User* → reason modal. Every successful ban emits the line.
- **Why it matters:** `apps/discord-worker/PRIVACY_POLICY.md` §2 lists the Discord username only "to attribute community preset submissions" and lists no moderation-reason text anywhere; §5 names "Moderation history" as D1 data but §8 gives it no retention row. The `banned_users` row (`ban-service.ts:309-313`) is the purposeful store for exactly these fields; the log line is a second, purpose-less copy in Cloudflare Workers Logs (account-wide readers, Cloudflare's retention). The unban line (`commands/preset.ts:641-645`) already shows the right shape — ids and counts only. All other log calls in the worker carry ids, command names, `custom_id`s or fixed strings (checked: `index.ts:130,142,147,201,209,257,307,317,331,349,428,454,474,477,507,510,610`; `preset-api.ts:170-174`; `i18n.ts:93`).
- **Fix:** drop `targetUsername` and `reason` from the log context (keep `targetUserId`, `moderatorId`, `presetsHidden`, optionally `reasonLength`); the moderation channel post (`:148-165`) already gives moderators the readable record. Related doc gap (policy owner, cross-unit): add a retention/deletion row for `banned_users` (username + reason kept indefinitely, including after unban) to PRIVACY_POLICY §8.

### MOD-02 — Native rate-limit binding fails open silently: limiter built without a logger, bindings not required by env validation, KV fallback selected without a log line

- **Severity:** LOW — the throttled paths are all moderator-gated or O(1) rejections, so a silent fail-open costs little; the operational point is that the §3 removal gate cannot be observed from this worker
- **Exposure:** INTERNET-AUTH (limits apply after Ed25519; the `command` limiter also runs for non-moderators before the moderator check, `index.ts:206` vs `preset.ts:351`, but that path is cheap)
- **Rotation:** none
- **Location:** `apps/moderation-worker/src/middleware/rate-limit.ts:134-153`; `packages/worker-kit/src/rate-limiter/backends/cloudflare.ts:159-175`; `apps/moderation-worker/src/utils/env-validation.ts:110-123`

```ts
// rate-limit.ts:147-150 — no `logger`, no `failOpen`
limiterInstance =
  tiers.length > 0
    ? new CloudflareRateLimiter({ tiers, keyPrefix: 'ratelimit:' })
    : new KVRateLimiter({ kv, keyPrefix: 'ratelimit:' });
// cloudflare.ts:160-164 — binding error → allowed; warning only if a logger was supplied
if (config.failOpen !== false) {
  this.logger?.warn('Rate limiter fail-open: rate-limit binding error, allowing request', …);
```

- **Trigger:** (a) the `RL_*` binding throws (runtime/quota error) → `allowed: true`, nothing logged; (b) a production deploy whose `[env.production]` lost the `[[ratelimits]]` blocks → `validateEnv` passes (it checks only `KV`/`DB`/`PRESETS_API`, `:110-123`), the KV limiter is chosen for the isolate's lifetime (`limiterInstance` is module-scope, `:121`), nothing logged, and KV "cannot throttle a fast client" (accepted trade-off, but the brief's check is whether the native path *actually* runs).
- **Impact:** an autocomplete flood by a compromised moderator account against production D1 (`searchPresetAuthors` is a `LIKE` scan over `presets`) would not be throttled during a binding outage, and `docs/operations/POST_MERGE_CHECKLIST.md:368` gates KV-fallback removal on "one week of production logs with no fallback warning" — this worker emits no such warning in either failure mode. `moderationRateLimitBindings()` is also evaluated per call while the singleton is fixed on the first one (harmless in prod, but the two disagree by design).
- **Fix:** pass a logger into `CloudflareRateLimiter` (the request logger via a parameter, or a module logger); log once when the KV fallback is selected; add `RL_COMMAND`/`RL_AUTOCOMPLETE` to `validateEnv`'s required bindings for production; consider `failOpen: false` for the `autocomplete` config only (moderators-only path, D1 behind it). Add a test that a throwing binding produces the warning (there is none — `rate-limit-binding.test.ts` covers deny/allow/fallback only).

### MOD-03 — Ban / unban / hide / restore still write no `moderation_log` rows (FINDING-034 carry-forward, deliberately deferred)

- **Severity:** LOW — accountability for the ban itself is intact; per-preset history is blind to ban-driven status flips
- **Exposure:** INTERNET-AUTH
- **Rotation:** none
- **Cross-link:** FINDING-034 (MOD-4 in the 2026-08-21 review); deferral recorded in `apps/moderation-worker/CHANGELOG.md` (1.5.0, "Not done from FINDING-034") and `docs/operations/POST_MERGE_CHECKLIST.md:381-383`
- **Location:** `apps/moderation-worker/src/services/ban-service.ts:305-315` (`banUser` batch: insert + hide, no log row), `:374-385` (`unbanUser` batch: update + restore, no log row)
- **Current state:** who/when/why survive in `banned_users` (`moderator_discord_id`, `reason`, `banned_at`, `unban_moderator_discord_id`, `unbanned_at` — `migrations/0003_add_banned_users.sql:12-25`), so the ban is auditable. What is missing: (a) `GET /api/v1/moderation/:id/history` shows no entry when a preset went `approved → hidden → approved` through a ban cycle; (b) `/moderation/stats` does not count bans; (c) `moderation_log.preset_id` is `NOT NULL` so a ban-scoped row does not fit the schema — hence the presets-api-owned decision.
- **Fix (unchanged recommendation):** route ban/unban through a presets-api endpoint that owns the batch and writes one `moderation_log` row per hidden/restored preset (`action: 'hide' | 'restore'`, `reason: 'ban:<ban id>'`), or extend the schema with a nullable `preset_id` + `ban_id`. Until then, keep the CHANGELOG note so the next audit does not re-chase it.

### MOD-04 — Ban model gaps: no guard against banning a `MODERATOR_IDS` member (including self); a banned moderator keeps moderation rights; a target must already own a preset

- **Severity:** INFO — no privilege boundary is crossed (moderators are peers; a rogue moderator can do all of this anyway) and every action is attributed to the acting moderator id
- **Exposure:** INTERNET-AUTH
- **Rotation:** none
- **Location:** `apps/moderation-worker/src/handlers/commands/preset.ts:466-483` (no `targetUserId === userId` / `isModerator(env, targetUserId)` check), `src/services/preset-api.ts:313-323` (`isModerator` never consults `banned_users`), `src/services/ban-service.ts:196-218` (`getUserForBanConfirmation` returns `null` unless the target has a `presets` row → "User not found")
- **Behaviour:** a moderator can ban another moderator (hides their approved presets; presets-api then 403s their submissions/votes) or themselves; the banned moderator can still approve/reject/ban/unban here and via presets-api's `requireModerator` (which also checks `MODERATOR_IDS` only). A user who only votes (or has never submitted) cannot be banned from this bot at all, and XIVAuth-only authors remain uncoverable (`author_discord_id IS NOT NULL`, `:95`; FINDING-017 deferred in POST_MERGE_CHECKLIST `:383`).
- **Fix (optional):** refuse `targetUserId ∈ MODERATOR_IDS` (and self) with a fixed message; decide whether an active ban should suspend moderation rights (then `isModerator` needs the D1 lookup, or the ban flow must remove the id from the allowlist); allow pre-emptive bans by snowflake when the target has no presets.

### MOD-05 — v1 HMAC header still emitted alongside v2; presets-api still accepts a v1-only request (cross-unit, FINDING-014 rollover not closed)

- **Severity:** INFO for this unit (the actionable change is presets-api's acceptance; this worker just needs to stop sending the header afterwards)
- **Exposure:** INTERNAL (service binding) — the v1 tuple is only capturable on the HTTPS `PRESETS_API_URL` fallback, which production does not use
- **Rotation:** none (optional `BOT_SIGNING_SECRET` rotation is already listed in POST_MERGE_CHECKLIST `:357-358`)
- **Location:** `apps/moderation-worker/src/services/preset-api.ts:146-147` (`X-Request-Timestamp` + `X-Request-Signature` "kept during rollover"); acceptance at `apps/presets-api/src/middleware/auth.ts:228-239` (v1 path taken whenever `X-Request-Signature-V2` is absent)
- **Why it is still open:** the gate in `docs/operations/POST_MERGE_CHECKLIST.md:367` ("both bots and presets-api production deploys carry the v2 code") has been true since the 2026-08-29/30 deploys, so the removal can proceed now: presets-api drops the `else` branch, then both bots delete the two v1 headers (`generateRequestSignature` at `:81-91` becomes dead). Until then a captured v1 tuple stays valid for 5 min on any route — only reachable if someone ever pointed this worker at the HTTPS URL without the binding.

### MOD-06 — KV namespace shared with discord-worker production; the only remaining production use is a read of a legacy key discord-worker no longer writes (MOD-9 carry-forward, current state)

- **Severity:** INFO — no key collision, no write, no new code path; least-privilege hygiene only. Not promoted.
- **Exposure:** LOCAL (dev worker binds production D1/KV/service binding) + INTERNAL
- **Rotation:** none
- **Location:** `apps/moderation-worker/wrangler.toml:19-21,62-64` (same id `1fcb7e037ccd…` in both envs), `:23-30` (dev block binds production D1 + presets-api); reads at `src/services/i18n.ts:44,86` (`i18n:user:<uid>`); fallback writes would be `ratelimit:<type>:<uid>|<window>` (`middleware/rate-limit.ts:149-150,177` + `packages/worker-kit/src/rate-limiter/backends/kv.ts:283-286`)
- **Collision check:** discord-worker's KV limiter uses `ratelimit:user:` (`apps/discord-worker/src/services/rate-limiter.ts:40`), preferences `prefs:v1:`, favourites `xivdye:preset_favorites:*`, analytics `usertrack:*` — disjoint from this worker's `ratelimit:command:` / `ratelimit:autocomplete:` prefixes. discord-worker only *migrates from* `i18n:user:` (`services/preferences.ts:59,437`) and writes `prefs:v1:` now, so the "shared language preference" this binding was kept for is dead: this worker reads a key nothing writes any more (and it has English strings only, `bot-i18n.ts:112-119`). In production the native limiter never touches KV (`rate-limit-binding.test.ts:58-59`), so the binding is read-only in practice while still granting full R/W over the main bot's user data.
- **Fix (optional):** remove the `KV` binding altogether when the §3 KV-fallback removal lands (replace `createUserTranslator` with the Discord client locale), and give the dev block a preview D1/KV or document that `wrangler dev --remote` touches production (CLAUDE.md does not say so today).

---

## Positive controls

Verified against current code; do not re-file next time unless the lines change.

1. **Ed25519 before parsing, fail-closed, fresh** — `packages/auth/src/discord.ts:70-143`: `Content-Length` pre-check and byte-length re-check at 100 KB, both signature headers required, `X-Signature-Timestamp` must parse and sit within 300 s past / 60 s future **before the body is read** (`:99-110`), `verifyKey` over `timestamp + rawBody`, any exception (including an undefined `DISCORD_PUBLIC_KEY`) → `isValid:false`. PING is answered only after verification (`index.ts:155`). 401/400 bodies are fixed strings.
2. **Uniform moderator gate** — `presetApi.isModerator` (`preset-api.ts:313-323`; snowflake-validated input, `parseModeratorIds` shared grammar `bot-logic/src/moderators.ts:31-39`, O(1) `Set`) on all 3 subcommands, all 3 autocomplete branches (`index.ts:316`, ahead of the limiter and any D1), all 5 buttons and all 3 modals; slash subcommands additionally pinned to `MODERATION_CHANNEL_ID` and failing closed when it is unset. presets-api re-derives moderator status from its own `MODERATOR_IDS` behind the HMAC (`presets-api/src/middleware/auth.ts:253`). Command registration narrowed to Manage Server / guild-only / guild-install (`scripts/register-commands.ts:50-53`) and re-PUT on every production deploy (`.github/workflows/deploy-moderation-worker.yml:74-79`).
3. **Native per-user rate limiting is what runs in production** — `[env.production.ratelimits]` `RL_COMMAND` 25 / `RL_AUTOCOMPLETE` 70 per 60 s (`wrangler.toml:76-84`) match `effectiveLimit()` from the shared `MODERATION_LIMITS` preset (`worker-kit/.../presets/configs.ts:127-140`), tier selection by effective limit (`cloudflare.ts:123-126`); the key is `<type>:<verified member.user.id>`; slash, autocomplete, buttons and modals all pass through it; increments run under `ctx.waitUntil`; `rateLimitedResponse` is an HTTP 200 ephemeral (Discord discards non-200). Test proves KV is untouched when bindings exist.
4. **SQL hygiene** — every statement in `ban-service.ts` is `.prepare(…).bind(…)`; the two `LIKE` searches use `validateAndEscapeQuery` (100-char cap, `minLength: 1`, `%`/`_`/`\` escaped) with `ESCAPE '\'`; `LIMIT` is a bound integer; no dynamic identifiers. Ban + hide and unban + restore are single `db.batch` calls; the active-ban unique partial index resolves the double-confirm race.
5. **Identifier discipline** — `custom_id`s carry only a UUID or a snowflake (100-char cap provably respected for a 32-char CJK name); every id is shape-checked at the handler boundary and `encodeURIComponent`-ed before it becomes a presets-api path segment; option values `action` go through a closed `switch` with a sanitised default.
6. **Bot → presets-api** — Bearer + v1 + **v2** (`X-Request-Signature-V2` + `X-Request-Nonce`; canonical string `v2\nMETHOD\npath\nsha256(body)\nts\nnonce\nuid\nname` length-prefixed per field, 60 s window) on every call; the same serialised bytes are signed and sent (`preset-api.ts:136,153-164,186`); moderator identity travels on pending/stats/approve/reject/revert/autocomplete; `X-User-Discord-Name` is never populated by this worker; `BOT_SIGNING_SECRET` ≥ 32 chars enforced (`env-validation.ts:104-108`).
7. **Output hygiene** — every author-/moderator-sourced string is routed through `sanitizeEmbedText` budgets (`utils/embed-text.ts`: control/zero-width/bidi stripping, `@everyone`/`<@…>` defusing, markdown + masked-link escaping, caps 100/64/1024); every response/follow-up/channel post carries `allowed_mentions: { parse: [] }` by default (`response.ts:91-95`, `discord-api.ts:28-30`); `sanitizeErrorMessage` blocks 5xx bodies, stack/file refs and D1/SQLite internals (`response.ts:228-274`), and `BanResult`/`UnbanResult.error` are fixed strings with the raw cause log-only; presets-api's own 4xx messages on the moderation routes are fixed strings (`presets-api/src/handlers/moderation.ts:115,188`), so the 4xx passthrough carries no author text.
8. **Logging / errors** — no `logger.*` call interpolates `interaction.member` / user objects; `loggerMiddleware` logs method + sanitised path only (no UA, no IP); webhook tokens redacted by `sanitizeUrl`; the bot token appears only in `Authorization` headers; `app.onError` returns a generic body because `ENVIRONMENT` is set in neither env block (`wrangler.toml:43-45,58-60`); `safeSendMessage`/`safeEditMessage` are throw-safe inside `waitUntil`; Discord REST calls carry a 5 s `AbortSignal.timeout`.
9. **Config / CI** — all seven secrets are `wrangler secret` only (none in `[vars]`); `.dev.vars*` / `.env*` gitignored (`.gitignore:11-13,28-30`); dev worker is routeless with `workers_dev = false`, routes only under `[env.production]`; deploy workflow SHA-pinned, `permissions: contents: read`, `environment: production`, `MODERATION_DISCORD_TOKEN` exposed to the register step only, health smoke test after deploy. No emoji-sync script exists in this unit (that is discord-worker's).
10. **Personal-data surface is small** — no Analytics Engine binding, no KV writes in production, no third-party request bodies; D1 writes are `banned_users` (username copied from `presets.author_name`, moderator id, reason, timestamps) and preset status flips; autocomplete/embeds show author name + Discord id to moderators only (purpose-bound). The one excess is MOD-01.

## Carried-forward INFO items from the 2026-08-21 review (current state)

| Old id | State now | Promoted? |
|---|---|---|
| MOD-9 shared KV + prod bindings in dev | unchanged; production KV use is now a single legacy read → MOD-06 | no |
| MOD-10 no freshness window | **fixed** (FINDING-021) | — |
| MOD-11 HMAC scope | **fixed** (v2); v1 header still sent → MOD-05 | no |
| MOD-12 buttons/modals unlimited, `ban_cancel_` ungated | **fixed** (`component-gate.test.ts`, `ban-confirmation.ts:137`) | — |
| MOD-13 `preset_id` autocomplete always empty | **fixed** (`autocomplete.test.ts:141-171`) | — |
| MOD-14 xivauth ids offered for unban | **fixed** (`index.ts:447-448`) | — |
| MOD-15 allowlist cached per isolate | unchanged (`preset-api.ts:269,289-303`); `wrangler secret put` redeploys the worker so isolates recycle — not material | no |
| MOD-16 `MODERATION_BOT_TOKEN` also in discord-worker | unchanged (`apps/discord-worker/src/handlers/commands/preset-notifications.ts:60-61`); rotation must hit both (POST_MERGE_CHECKLIST `:144-145`); for the discord-worker reviewer | no |

---

## Rejected

| Suspicion | Why rejected |
|---|---|
| SQL injection (`ban-service.ts`, `sql-helpers.ts`) | Re-verified after the delta: every statement bound; `LIKE` inputs escaped + capped; no dynamic SQL. |
| SSRF | Fixed hosts only (`discord.com`, service binding `https://internal`, `PRESETS_API_URL` var); user data only in encoded segments / `URLSearchParams`. |
| Unsanitised subcommand-name echo (`commands/preset.ts:81`) | Ephemeral to the sender, `allowed_mentions` none, Discord rejects option names not in the registered schema — no victim other than the sender. |
| presets-api 4xx message passthrough (`sanitizeErrorMessage` → embed, unescaped) | Moderation-route 4xx messages are fixed strings; nothing author-controlled reaches them. |
| Legacy `ban_*_<id>_<base64 name>` suffix parsing (`ban-confirmation.ts:79-81`, `ban-reason.ts:56-59,76-82`) | Moderator-only; suffix ignored (button) or sanitised fallback (modal); pre-fix ephemeral confirmations expired long ago — dead code, safe to delete together with `encode/decodeBase64Url`. |
| `interaction.message.embeds` re-posted in edits | Supplied by Discord from its own store, not client-controlled. |
| Stack traces via `app.onError` | `ENVIRONMENT` unset in both env blocks → generic body. |
| Token/PII leakage in Discord API failure logs | Only status + Discord's error JSON (field paths, no content); URLs pass `sanitizeUrl`. |
| Rate-limit key forgery / bypass | Key derived from the Ed25519-verified body; missing `userId` is refused before the limiter. |
| Cross-guild escalation | Authorization is a snowflake allowlist, never roles/permissions; channel pin uses a global channel id. |
| `getRateLimitInfo` / `rateLimitMiddleware` (`rate-limit.ts:238-287`) | Dead exports with no caller (would pick the KV limiter if called first — moot). Dead-code cleanup, not security. |
| Non-string `focused.value` from a modified client | `validateAndEscapeQuery` throws inside the autocomplete `try` → `[]`; Discord validates option types anyway. |
| KV `i18n:user:` value injection | Allowlisted by `isValidLocale` before use. |
| Missing channel pin on buttons/modals | Buttons exist only on messages the moderation app posted; the moderator gate is the control (unchanged, accepted in the previous review). |
| `/health` fingerprinting | Static `{status:'ok'}`. |
| Webhook secret constant-time checks (`INTERNAL_WEBHOOK_SECRET`, `GITHUB_WEBHOOK_SECRET`) | This worker has no webhook routes. |
| Emoji-sync token handling | No such script in this unit. |

---

## Files covered

**`apps/moderation-worker/` (read in full):** `wrangler.toml`, `package.json`, `CHANGELOG.md` (1.5.0 / 1.4.0 entries), `CLAUDE.md`, `scripts/register-commands.ts`, `src/index.ts`, `src/handlers/commands/index.ts`, `src/handlers/commands/preset.ts`, `src/handlers/buttons/index.ts`, `src/handlers/buttons/ban-confirmation.ts`, `src/handlers/buttons/preset-moderation.ts`, `src/handlers/modals/index.ts`, `src/handlers/modals/ban-reason.ts`, `src/handlers/modals/preset-rejection.ts`, `src/middleware/rate-limit.ts`, `src/services/ban-service.ts`, `src/services/preset-api.ts`, `src/services/bot-i18n.ts`, `src/services/i18n.ts`, `src/types/env.ts`, `src/types/ban.ts`, `src/types/modal.ts`, `src/types/preset.ts`, `src/utils/verify.ts`, `src/utils/env-validation.ts`, `src/utils/response.ts`, `src/utils/safe-json.ts`, `src/utils/sql-helpers.ts`, `src/utils/url-sanitizer.ts`, `src/utils/discord-api.ts`, `src/utils/embed-text.ts`.

**Tests:** read in full — `src/autocomplete.test.ts`, `src/component-gate.test.ts`, `src/middleware/rate-limit-binding.test.ts`; grepped for load-bearing assertions — `src/handlers/commands/preset.test.ts`, `src/handlers/buttons/ban-confirmation.test.ts`, `src/handlers/modals/ban-reason.test.ts`, `src/handlers/modals/preset-rejection.test.ts`, `src/services/preset-api.test.ts`, `src/services/preset-api-v2.test.ts`, `src/utils/verify.test.ts`, `src/utils/response.test.ts`, `src/utils/discord-api.test.ts`. Full suite executed in the main checkout (22 files / 648 tests green).

**CI:** `.github/workflows/deploy-moderation-worker.yml`.

**Shared packages (call-path confirmation):** `packages/auth/src/discord.ts`, `packages/auth/src/hmac.ts` (v2 canonical/verify section), `packages/auth/src/discord-freshness.test.ts` (grep), `packages/worker-kit/src/rate-limiter/backends/cloudflare.ts`, `packages/worker-kit/src/rate-limiter/backends/kv.ts` (key construction), `packages/worker-kit/src/rate-limiter/presets/configs.ts` (`MODERATION_LIMITS`), `packages/worker-kit/src/middleware/logger.ts`, `packages/bot-logic/src/discord-markdown.ts`, `packages/bot-logic/src/moderators.ts`.

**Cross-unit (targeted):** `apps/presets-api/src/middleware/auth.ts:150-280`, `apps/presets-api/src/middleware/ban-check.ts` (grep), `apps/presets-api/src/handlers/moderation.ts` (grep), `apps/presets-api/src/services/preset-service.ts` + `handlers/presets.ts` + `services/validation-service.ts` (grep `'hidden'`), `apps/presets-api/migrations/0003_add_banned_users.sql`, `apps/discord-worker/src/services/rate-limiter.ts` + `services/preferences.ts` + `services/i18n.ts` + `handlers/commands/preset-notifications.ts` (grep, KV keys / `MODERATION_BOT_TOKEN`), `apps/discord-worker/PRIVACY_POLICY.md`.

**Docs / evidence:** `evidence/REVIEWER_BRIEF.md`, `evidence/delta-files-by-unit.txt`, `evidence/pii-sinks.txt` + `evidence/pii-sources.txt` (moderation-worker rows), `evidence/wrangler-surface.txt`, `evidence/potential-secrets.txt`, `docs/audits/2026-08-21-security/evidence/review-moderation-worker.md`, `docs/operations/POST_MERGE_CHECKLIST.md` (§2–§3), `docs/architecture/security-trade-offs.md` (grep), root `.gitignore`.

Not reviewed: `coverage/`, `.turbo/`, `README.md`, `LICENSE`, `tsconfig.json`, `vitest.config.ts`; the Dependabot bumps (`hono`, `wrangler`, `@cloudflare/workers-types`, `@types/node`, `vitest`) belong to the supply-chain reviewer.
