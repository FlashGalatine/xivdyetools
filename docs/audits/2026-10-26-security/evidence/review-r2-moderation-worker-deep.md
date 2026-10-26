# Review: moderation-worker second pass (r2-moderation-worker-deep) — 2026-10-26

Reviewer key `r2-moderation-worker-deep`, deploy unit `moderation-worker`, HEAD 13c386e5. Read-only.
Builds on `review-moderation-worker.md` (round 1); its matrix and candidate moderation-worker-01 are not repeated.

## Module table (internals the first round did not read in full)

| Module | Writes / sinks | Trust input | Gate / validation |
|---|---|---|---|
| `src/services/ban-service.ts` | D1 `banned_users`, `presets`, `moderation_log` (direct) | target id (snowflake / lowercase UUID), D1 author_name, moderator typed reason | every value `.bind()`; interpolations are constants only: `MODERATION_LOG_COLUMNS` (:338), `SQL_UUID_V4` (:347), `restoreGuard(alias)` (:413) called only with literals `'p'` (:452) and `'presets'` (:716) — `git grep -n "restoreGuard(" apps/moderation-worker/src` shows no other caller; `${action === 'restore' ? …}` is a literal union (:452) |
| `src/utils/safe-json.ts` | none | Ed25519-verified body (≤100 KB) | prototype keys, depth 10, 1000 elements/properties, deep freeze, warnings no longer skip the freeze (:135-155) |
| `src/utils/url-sanitizer.ts` | log strings | URLs / error text | webhook token ≥64 chars, `token/key/secret/password/api_key` query params, `Bearer` (:42-66) |
| `src/types/modal.ts` | none | modal payload | `extractTextInputValue` matches row type 1 / input type 4 by custom_id (:66-85) |
| `src/handlers/review-message.ts` | Discord message edits / follow-ups | presets-api moderation view | every field through `sanitizeName/Description/UserName`; no author id (:156-177); `content` only constant + status word (:299) |
| `src/handlers/buttons/preset-moderation.ts` | presets-api approve; Discord edits; submission-log post | custom_id | strict parse + kind match (:107-111) → `isModerator` (:113) → legacy refresh (:157) → ban pre-check (:186) |
| `src/handlers/modals/preset-rejection.ts` | presets-api reject / revert; Discord edits; submission-log post | modal custom_id + reason | same preamble (:73-88); reason trimmed ≥10 (:122,:244); revert ban pre-check (:268) |
| `src/handlers/modals/ban-reason.ts`, `buttons/ban-confirmation.ts` | ban via ban-service; moderation-channel post | `ban_*_{id}` custom_id | `isModerator` first (:53 / :68), `isBanTargetId` (:73 / :85), name from D1 not custom_id (:80) |
| `packages/types/src/preset/review-custom-id.ts` | none | custom_id | ≤100 (:139), longest-prefix (:97-103), UUIDv4 (:128), revision `^(0|[1-9][0-9]*)$` + safe integer (:130,:155), status allowlist (:153), exactly 1 or 3 parts (:149-150) |

## Interaction gate order (re-checked)

Ed25519 (`index.ts:160`) → `safeParseJSON` (`:173`) → per type: command RL (`:244`) / autocomplete `isModerator` then RL (`:364,:370`) / component RL (`:546`) / modal RL (`:579`) → handler `isModerator` before any D1, presets-api call, modal open or refresh (preset-moderation.ts:113, preset-rejection.ts:81, ban-confirmation.ts:68,136, ban-reason.ts:53, preset.ts:367,485,595).

## Candidate

### r2-moderation-worker-deep-01 (LOW, INTERNET-AUTH) — a ban keyed on one identity leaves the author's other-identity presets public and approvable

`banUser` hides `WHERE author_discord_id = ? AND status = 'approved'` with the single target id (`ban-service.ts:686-691`) and records `xivauth_id` only when the target itself is a UUID (`:489`); `isPresetAuthorBanned` joins on `p.author_discord_id` only (`:42`). A user who submitted on the web as XIVAuth-only (author = JWT `sub`, `presets-api/src/middleware/auth.ts:71-77`), then linked Discord and submitted through the bot (author = snowflake) before the next web login runs `refresh-author` (`web-app/src/services/auth-service.ts:531`, `presets-api/src/handlers/presets.ts:371-379`) owns presets under two ids. A ban on the snowflake hides only the snowflake rows; the UUID rows stay approved in the gallery, their pending entries pass the MOD-4 approval check, and the re-key that would merge them is now permanently blocked by `NOT_BANNED` (`identity-rekey-service.ts:22-25,50`). The ban-confirmation embed counts only the target id's presets (`ban-service.ts:229-242`), so the moderator is not shown the second identity. Precondition not confirmed from the repo: how often a split identity exists in production. Workaround exists (ban the UUID too).

## POSITIVE controls

- No template SQL with user input anywhere in the worker: `git grep -n '\${' apps/moderation-worker/src/services/ban-service.ts` hits only the constants above and bound `LIKE` patterns (`:120,:145,:198`). `sql-helpers.ts` escapes `%`, `_`, `\` with a 100-char cap.
- Unban restore can only re-publish ban-hidden rows: nothing else sets `status = 'hidden'` (`git grep -n "'hidden'" apps/presets-api/src` — only filters; `moderation.ts:127` refuses `hidden` as a target status).
- Uppercase-UUID forgery does not bypass the MOD-4 ban check: `isPresetAuthorBanned` would miss, but presets-api compares `id` binary with no lowercasing (`git grep -n -i "toLowerCase|COLLATE NOCASE" apps/presets-api/src/handlers/moderation.ts` → none), so the approve 404s. Ban target UUIDs are lowercase-only (`utils/response.ts:270`).
- Review custom_id: stale/legacy ids never act (refresh only), 409 refresh, kind mismatch refused; refresh itself is moderator-gated before it fetches anything.
- Mentions: every outbound Discord body starts with `allowed_mentions: ALLOWED_MENTIONS_NONE` (`utils/discord-api.ts:27-29`); embeds use `sanitizeEmbedText` (mention defusing, masked-link escaping); `sanitizeReason` caps 1024 and keeps per-line sanitising (`embed-text.ts:49-61`).
- No author-supplied URL is ever rendered: the only links are `${PRESETS_WEB_URL}/presets/${D1 uuid}` (`preset.ts:40,516`; `ban-service.ts:283`) and the server-built preview URL.
- Persistent people-data matches the policies: ban post = author name or neutral label + moderator name + reason + count, no id (`ban-reason.ts:188-207`); unban blanks D1 username/reason (`ban-service.ts:605`); reasons kept in `moderation_log` and channel posts are disclosed (`discord-worker/PRIVACY_POLICY.md:57-58,116,189-192`; `web-app/PRIVACY.md:147-174`).
- Moderator identity sent to presets-api is signed v2 (method, path, body hash, nonce, identity) (`services/preset-api.ts:108-130`); preset ids path-encoded (`:342`).

## REJECTED

- `hasPrototypePollution` recurses without a depth cap before the depth check (`safe-json.ts:120,214`) — only reachable after Ed25519, i.e. from Discord; 100 KB body; a throw ends in the generic 500.
- `processApproval` copies `interaction.message.embeds[0]` into the edited post (`preset-moderation.ts:209-224`) — the message is part of the Discord-signed payload, so it is Discord's copy of the bot's own message.
- Modal reasons have no server-side max (ban-reason.ts:95, preset-rejection.ts:120) — moderator-only, Discord enforces the modal's `max_length`, rendering is capped by `sanitizeReason`.
- Malformed custom_id logged (`preset-rejection.ts:75`, `ban-confirmation.ts:86`, `index.ts:538,571`) — ids only, re-file of the 2026-10-03 rejected "moderation-worker logs ids"; Workers Logs off.
- Ban/rejection posts persist after unban/deletion of D1 copies — disclosed retention (`PRIVACY_POLICY.md:192`).
- Ban buttons/modal carry no channel gate — reachable only from the ephemeral, channel-gated `/preset ban_user` reply; moderator gate applies regardless.
- Moderator forging a revision-bound id for a preset they never opened — moderators are the trust boundary; presets-api still enforces the revision/status match.

## FILES COVERED

16 files read in full or in the relevant span: `apps/moderation-worker/src/services/ban-service.ts`, `src/utils/{safe-json,url-sanitizer,embed-text}.ts`, `src/types/modal.ts`, `src/handlers/review-message.ts`, `src/handlers/buttons/{preset-moderation,ban-confirmation,index}.ts`, `src/handlers/modals/{preset-rejection,ban-reason,index}.ts`, `src/handlers/commands/preset.ts` (140-700), `src/index.ts` (150-600), `src/services/preset-api.ts` (95-135, isModerator), `packages/types/src/preset/review-custom-id.ts`; cross-unit spans: `apps/presets-api/src/middleware/{ban-check,auth}.ts`, `src/services/identity-rekey-service.ts`, `src/handlers/presets.ts:360-384`, `apps/web-app/src/services/auth-service.ts:525-545`, both privacy policies (moderation sections).
Directories: `apps/moderation-worker/src/{services,utils,types,handlers,handlers/buttons,handlers/modals,handlers/commands}`, `packages/types/src/preset`.
Not read in full: `src/types/{ban,env,preset}.ts` (grepped for the conflict error only), `src/utils/{response,discord-api,env-validation,sql-helpers}.ts` beyond the cited spans, tests.
