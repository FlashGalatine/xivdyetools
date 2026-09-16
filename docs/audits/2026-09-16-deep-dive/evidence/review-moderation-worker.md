# Review: moderation-worker

Scope: `apps/moderation-worker/src/**` (all non-test source read in full), `apps/moderation-worker/wrangler.toml` (read-only). Cross-checked (read-only, to verify concrete cross-app/cross-service claims made by comments in scope): `apps/presets-api/src/handlers/moderation.ts` (SQL aliases only), `apps/discord-worker/src/handlers/commands/preset-notifications.ts` (button `custom_id` construction only), `packages/types/src/auth/discord-snowflake.ts` (regex only).

## 1. Map

| Module | Role |
|---|---|
| `index.ts` | Hono app: Ed25519 verify → `safeParseJSON` → route by `InteractionType`; env-validation gate (fail-closed in production on `RL_*`); per-user `command` rate limit shared by commands/buttons/modals (MOD-12); global error handler |
| `handlers/commands/preset.ts` | `/preset moderate\|ban_user\|unban_user`; `MIN_REJECTION_REASON_LENGTH` shared with the modal |
| `handlers/buttons/preset-moderation.ts` | Approve/Reject/Revert buttons — **posted by discord-worker** (a different Discord application), routed here via `MODERATION_BOT_TOKEN` (BUG-009, verified still wired correctly) |
| `handlers/buttons/ban-confirmation.ts` | Yes/No ban-confirm buttons (posted by this worker's own interaction response) |
| `handlers/modals/preset-rejection.ts` | Reject / revert reason modals |
| `handlers/modals/ban-reason.ts` | Ban reason modal; resolves username from D1 at submit time (FINDING-007) |
| `services/ban-service.ts` | Ban/unban D1 writes, batched with `moderation_log` audit rows (FINDING-018) |
| `services/preset-api.ts` | Signed client to presets-api (service binding preferred, HTTP fallback); `isModerator` / cached `MODERATOR_IDS` set |
| `services/bot-i18n.ts` / `services/i18n.ts` | English-only translator (I18N-009, deliberate); locale still resolved via shared `@xivdyetools/bot-logic/i18n` for logging |
| `middleware/rate-limit.ts` | Native `RL_COMMAND`/`RL_AUTOCOMPLETE` bindings when bound, KV fallback otherwise; per-isolate singleton |
| `utils/discord-api.ts` | `safeSendMessage`/`safeEditMessage`/`safeEditOriginalResponse` — all `.ok`-checked, all carry `AbortSignal.timeout(5000)` (BUG-040) |
| `utils/{response,embed-text,safe-json,url-sanitizer,sql-helpers,env-validation,verify}.ts` | Response builders, per-field sanitisation budgets, prototype-pollution-safe JSON parse, log redaction, LIKE-escaping, startup validation, Ed25519 re-export |
| `tests/moderation-stats-contract.test.ts` | File-reading contract test pinning `ModerationStats` keys against presets-api's live SQL aliases |

## 2. Candidates

**moderation-worker-01** — kind OPT, severity MEDIUM — `apps/moderation-worker/src/services/preset-api.ts:112-127`
Claim: the `request()` helper's two `fetch` call sites (service binding and the `PRESETS_API_URL` HTTP fallback) carry no `AbortSignal`/timeout, unlike every Discord-facing call in `utils/discord-api.ts` (all fixed under BUG-040 to carry `AbortSignal.timeout(5000)`).
Failing input → wrong outcome: presets-api (or, in the fallback case, the network) hangs on a `PATCH /moderation/:id/status` call; the `ctx.waitUntil()`-wrapped `processModerateCommand`/`processApproval`/`processRejection`/`processBan` promise never settles, so the moderator's deferred "thinking…"/spinner embed never resolves and, if it outlasts the 15-minute interaction token, the eventual `safeEditOriginalResponse` 404s and is swallowed (logged only, already correctly `.ok`-checked) — the moderator gets no terminal state at all.
Why tests miss it: `preset-api.test.ts` mocks `fetch`/the service binding to resolve immediately; no test simulates a hang.
Covered by test: no (`grep AbortSignal|timeout|signal:` over `preset-api.test.ts` — no matches).
```ts
if (env.PRESETS_API) {
  response = await env.PRESETS_API.fetch(
    new Request(`https://internal${path}`, { method, headers, body: bodyText }),
  );
} else {
  const url = `${env.PRESETS_API_URL}${path}`;
  response = await fetch(url, { method, headers, body: bodyText });
}
```
Fix direction: add `signal: AbortSignal.timeout(...)` to both call sites, mirroring `utils/discord-api.ts`.

**moderation-worker-02** — kind UNTESTED, priority LOW — `apps/moderation-worker/src/middleware/rate-limit.test.ts:236`
Claim: `await expect(incrementRateLimit(errorKV, 'user123', 'command', 1)).resolves.not.toThrow()` is the entire assertion for "KV errors gracefully" — it proves the promise resolves and nothing else.
Failing input → wrong outcome: a regression that swallows the KV error but also silently drops the increment (or double-increments, or logs nothing where a caller expects a log) passes unchanged, because no return value, call count, or side effect is checked.
Why tests miss it: `.resolves.not.toThrow()` alone is satisfied by any non-throwing implementation, including a no-op.
Covered by test: nominally yes, functionally no — matches the brief's "tests that cannot fail" pattern (`not.toThrow()` alone).
```ts
// Should not throw
await expect(incrementRateLimit(errorKV, 'user123', 'command', 1)).resolves.not.toThrow();
```
Fix direction: assert the KVRateLimiter's actual degraded behavior (e.g. that `put` was attempted, or that a subsequent `checkRateLimit` call still returns a sane result) rather than only that the call didn't throw.

## 3. POSITIVE

- Cross-application button routing (BUG-009) verified end-to-end: `discord-worker/src/handlers/commands/preset-notifications.ts` builds `preset_approve_`/`preset_reject_`/`preset_revert_` buttons and posts them with `MODERATION_BOT_TOKEN` specifically so Discord routes the click to moderation-worker's own interaction endpoint (Discord routes `MESSAGE_COMPONENT` interactions to the application that owns the message); moderation-worker's `handlers/buttons/index.ts` prefixes match exactly, and the fallback (no token configured → no buttons, text hint instead) avoids ever advertising a dead affordance. No moderation-worker source constructs these buttons itself — correctly, they are handled-only here.
- `tests/moderation-stats-contract.test.ts` is a genuine cross-deploy-unit contract test: it reads presets-api's live SQL (`apps/presets-api/src/handlers/moderation.ts:379-383`) and asserts the column aliases against `ModerationStats`. Verified by direct read: the aliases (`pending`/`approved`/`rejected`/`flagged`/`actions_last_week`) still match what `handleStatsAction` renders — BUG-010 (the old `*_count` mismatch) cannot silently regress.
- `moderation_log` batch statements (`services/ban-service.ts` — `banLogStatement`/`unbanLogStatement`/`presetActionLogStatement`) were hand-verified placeholder-by-placeholder against `MODERATION_LOG_COLUMNS`; all three bind in the correct column order across ban, unban (conditional on `changes() > 0`), hide and restore paths.
- Every Discord REST call in `utils/discord-api.ts` is both `.ok`-checked and timeout-guarded (`AbortSignal.timeout(5000)`), and every call site in handlers awaits the `safe*` wrapper — no floating promises found anywhere in the scope (`grep` swept all handler/service files for un-awaited `safe(Send|Edit)Message`/`safeEditOriginalResponse` calls).
- `env-validation-gate.test.ts` and `component-gate.test.ts` drive the real Hono app end-to-end (not mocked internals) and assert real HTTP status/headers/body, including that the fail-closed 500 still carries `X-Request-Id` and `nosniff` (middleware ordering regression guard) and that it recurs on a second request in the same isolate (BUG-017).
- Discord snowflake validation is consistent everywhere it appears in scope: the shared `isValidSnowflake` (`@xivdyetools/types`, `/^\d{17,20}$/`) and the two local fallback regexes (`ban-confirmation.ts`, `ban-reason.ts`, both `/^\d{17,20}$/`) agree exactly.
- `custom_id` budgets are safely under Discord's 100-char cap everywhere (longest is `preset_reject_modal_<uuid>` ≈ 56 chars); the FINDING-007 fix (resolving usernames from D1 rather than packing them into `custom_id`) is why.
- `Translator.t()` (`services/bot-i18n.ts`) always returns a string — the miss path returns `key`, never `undefined`/`null`, so no `|| 'x'` dead-fallback pattern exists in this scope.

## 4. REJECTED

- Module-scope `moderatorIdsCache` / rate-limiter `limiterInstance` singletons "going stale" — bindings and secrets are fixed for an isolate's lifetime (a new deploy creates new isolates), so this is the same accepted per-isolate-cache pattern documented elsewhere in the monorepo, not a new bug.
- `getLimiter`'s first-call-wins backend selection (native vs KV) — bindings don't change between requests within one isolate, so there's no scenario where the "wrong" backend gets latched.
- Reason/name field lengths overflowing Discord's 1024/4096 embed limits — traced the worst case (10 pending presets × ~100-char sanitized name + 36-char UUID + author) to ≈2.5k chars, under the 4096 description cap; `sanitizeReason`/`sanitizeName`/`clampChoiceName` all cap at or under the relevant Discord limit.
- `SNOWFLAKE_RE` declared between two `import` statements in `ban-confirmation.ts` — unusual style but semantically inert; ES module imports are hoisted regardless of source position, so this is not a TDZ or evaluation-order bug.
- Banned-author approval bypass via `/preset moderate approve` vs. the approve button — both paths call `banService.isPresetAuthorBanned` before mutating; no asymmetry.
- Rate-limit key sharing between commands/buttons/modals (MOD-12) causing a moderator to be throttled mid-queue-review — real UX friction at 20/min+5 burst, but a deliberate, documented trade-off, not a defect.

## 5. COVERED

27 non-test source files (all of `apps/moderation-worker/src/**/*.ts` excluding `*.test.ts`) read in full, plus `apps/moderation-worker/wrangler.toml`. 8 test files read in full or targeted excerpt (`component-gate.test.ts`, `env-validation-gate.test.ts`, `rate-limit-fail-open.test.ts`, `middleware/rate-limit-binding.test.ts`, `middleware/rate-limit.test.ts` excerpt, `handlers/commands/preset.test.ts` excerpt, `services/ban-service.test.ts` grep sample, `tests/moderation-stats-contract.test.ts`). 3 out-of-scope files read read-only to verify concrete cross-app/cross-service claims made in-scope (`apps/presets-api/src/handlers/moderation.ts` grep, `apps/discord-worker/src/handlers/commands/preset-notifications.ts`, `packages/types/src/auth/discord-snowflake.ts`).

Files:
- apps/moderation-worker/src/index.ts
- apps/moderation-worker/src/handlers/commands/preset.ts
- apps/moderation-worker/src/handlers/commands/index.ts
- apps/moderation-worker/src/handlers/modals/ban-reason.ts
- apps/moderation-worker/src/handlers/modals/preset-rejection.ts
- apps/moderation-worker/src/handlers/modals/index.ts
- apps/moderation-worker/src/handlers/buttons/preset-moderation.ts
- apps/moderation-worker/src/handlers/buttons/ban-confirmation.ts
- apps/moderation-worker/src/handlers/buttons/index.ts
- apps/moderation-worker/src/services/ban-service.ts
- apps/moderation-worker/src/services/preset-api.ts
- apps/moderation-worker/src/services/bot-i18n.ts
- apps/moderation-worker/src/services/i18n.ts
- apps/moderation-worker/src/utils/discord-api.ts
- apps/moderation-worker/src/utils/embed-text.ts
- apps/moderation-worker/src/utils/response.ts
- apps/moderation-worker/src/utils/safe-json.ts
- apps/moderation-worker/src/utils/url-sanitizer.ts
- apps/moderation-worker/src/utils/verify.ts
- apps/moderation-worker/src/utils/sql-helpers.ts
- apps/moderation-worker/src/utils/env-validation.ts
- apps/moderation-worker/src/middleware/rate-limit.ts
- apps/moderation-worker/src/types/env.ts
- apps/moderation-worker/src/types/modal.ts
- apps/moderation-worker/src/types/ban.ts
- apps/moderation-worker/src/types/preset.ts
- apps/moderation-worker/wrangler.toml
- apps/moderation-worker/src/component-gate.test.ts
- apps/moderation-worker/src/env-validation-gate.test.ts
- apps/moderation-worker/src/rate-limit-fail-open.test.ts
- apps/moderation-worker/src/middleware/rate-limit-binding.test.ts
- apps/moderation-worker/src/middleware/rate-limit.test.ts (excerpt)
- apps/moderation-worker/src/handlers/commands/preset.test.ts (excerpt)
- apps/moderation-worker/src/services/ban-service.test.ts (grep sample)
- apps/moderation-worker/tests/moderation-stats-contract.test.ts
- apps/presets-api/src/handlers/moderation.ts (grep, out-of-scope verification)
- apps/discord-worker/src/handlers/commands/preset-notifications.ts (out-of-scope verification)
- packages/types/src/auth/discord-snowflake.ts (out-of-scope verification)
