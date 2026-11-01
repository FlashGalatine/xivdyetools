# Review: moderation-worker (1.8.2) — 2026-10-26 whole-monorepo security audit

Reviewer key: `moderation-worker`. HEAD 13c386e5. Read-only; every claim below cites a file:line in this checkout.
Base of the previous audit: 0ab33466. Since then 8 commits touched `apps/moderation-worker/src`
(`git log --oneline 0ab33466..HEAD -- apps/moderation-worker/src`): FINDING-008 ban/refresh posts, FINDING-017
review grammar moved to `@xivdyetools/types` (REFACTOR-001), Sprint 17 edge cases, retired-domain route drop.

## Routes

| Method | Path | Auth | Handler | Notes |
|---|---|---|---|---|
| GET | `/health` | none | `src/index.ts:143` | `{status:'ok'}` only; still behind the env gate (`index.ts:94-137`), 500 on missing prod RL bindings |
| POST | `/` | Ed25519 (`verifyDiscordRequest`, `index.ts:160`) | `index.ts:156-224` | 100 KB stream cap + 300 s freshness in `packages/auth/src/discord.ts:42,99-109`; parse only after verify (`index.ts:173`) |
| * | anything else | none | Hono default 404 | no root echo; `onError` hides message/stack unless `ENVIRONMENT=development` (`index.ts:670-685`) |

Middleware order (`index.ts:60-137`): requestId → logger (path via `sanitizeUrl`) → security headers
(`nosniff`, `XFO DENY`, HSTS, `Cache-Control: no-store`, `CSP default-src 'none'`, `no-referrer`) → env gate.

## Interaction authz matrix

| Interaction | Entry | Rate limit | Moderator gate | Channel gate | Input validation |
|---|---|---|---|---|---|
| `/preset moderate` (pending/approve/reject/stats) | `commands/preset.ts:352` | `index.ts:244` (command) | `preset.ts:367` | `preset.ts:362` | `preset_id` UUIDv4 (`preset.ts:148`); action echo sanitized (`preset.ts:440`) |
| `/preset ban_user` | `preset.ts:470` | command | `preset.ts:485` | `preset.ts:480` | `isBanTargetId` (`preset.ts:494`, `utils/response.ts:283`) |
| `/preset unban_user` | `preset.ts:580` | command | `preset.ts:595` | `preset.ts:590` | `isBanTargetId` (`preset.ts:604`) |
| unknown command | `index.ts:258-263` | command | n/a (no action) | n/a | name via `sanitizeEmbedText(…,32)` |
| autocomplete (preset_id / user) | `index.ts:338` | `index.ts:370` (autocomplete) | `index.ts:364` (silent empty list) | none (moderator-only data) | LIKE escaped, 100-char cap (`ban-service.ts:94,172`; `sql-helpers.ts`) |
| button `preset_approve_/reject_/revert_` | `buttons/preset-moderation.ts:97-118` | `index.ts:546` | `preset-moderation.ts:113` | none | strict `parseReviewCustomId` (`packages/types/src/preset/review-custom-id.ts`: ≤100, UUIDv4, int revision, status allowlist); legacy id never acts (`preset-moderation.ts:157,341,362`) |
| button `ban_confirm_` | `buttons/ban-confirmation.ts:55` | command | `ban-confirmation.ts:68` | none | `isBanTargetId` (`:85`) |
| button `ban_cancel_` | `ban-confirmation.ts:124` | command | `ban-confirmation.ts:136` | none | no action |
| modal `preset_reject_modal_/preset_revert_modal_` | `modals/preset-rejection.ts:54-91` | `index.ts:579` | `preset-rejection.ts:81` | none | strict parse, kind match; reason ≥10 trimmed (`:122,:244`) |
| modal `ban_reason_modal_` | `modals/ban-reason.ts:39` | command | `ban-reason.ts:53` | none | `isBanTargetId` (`:73`); reason trimmed ≥10 (`:95-99`) |

Outbound: presets-api via service binding (`services/preset-api.ts:157`) with Bearer + v2 HMAC (`:108-130`,
method/path/body/timestamp/nonce/identity), 10 s timeout (`:46,161`), ids path-encoded (`:341`). Discord REST
calls carry 5 s timeouts and default `allowed_mentions: {parse: []}` (`utils/discord-api.ts:28-30`).
D1 direct: `services/ban-service.ts` — every user value bound; only constant fragments interpolated
(`MODERATION_LOG_COLUMNS`, `SQL_UUID_V4`, `restoreGuard(alias)` with literal aliases).

## Candidates

### moderation-worker-01 (LOW, INTERNET-AUTH) — banned-author check is a non-atomic pre-check
`processApproval` checks `isPresetAuthorBanned` (`src/handlers/buttons/preset-moderation.ts:186`) and only then
calls `approvePreset` (`:206`); `processRevert` does the same (`src/handlers/modals/preset-rejection.ts:268` → `:293`).
presets-api's `PATCH /moderation/:id/status` and `/revert` carry no ban check (`git grep -n -i banned
apps/presets-api/src/handlers/moderation.ts` → no hits), and `banUser` hides only presets that are `approved`
at ban time (`src/services/ban-service.ts:688`). A ban committed by a second moderator between the check and
the PATCH leaves the author's just-approved preset public while the ban is active. Precondition: two moderators
acting on the same author within one request's latency; impact bounded to publishing one preset.

## Positive controls

- Ed25519 verify over a stream-capped body with timestamp freshness before any parse (`index.ts:160-177`; `packages/auth/src/discord.ts:42,99-109`).
- `safeParseJSON` depth 10, prototype-key rejection, 1000-element/property caps, deep freeze (`utils/safe-json.ts:119-153,253-300`).
- `MODERATOR_IDS` gate on every command, autocomplete, button and modal (matrix above); `isModerator` rejects non-snowflake ids (`services/preset-api.ts:293-303`).
- Review custom_ids parsed by one shared strict parser; kind must match the handler (`preset-moderation.ts:108-111`, `preset-rejection.ts:73-79`); FINDING-017 holds: legacy ids and 409s refresh, never act (`handlers/review-message.ts:242-333`).
- Ban targets validated (`isBanTargetId`) at command, button and modal; name resolved from D1, not the custom_id (`ban-reason.ts:62-90`).
- FINDING-008 holds: review embed has no author id (`review-message.ts:156-177`), ban channel post has no User ID field (`ban-reason.ts:188-207`); user-id-bearing embeds (ban confirm, unban result) are ephemeral (`preset.ts:571,609`).
- FINDING-005 holds on this side: unban blanks `username`/`reason` in the same UPDATE (`ban-service.ts:604-609`); retention is presets-api's (`apps/presets-api/src/services/moderation-retention-service.ts:83`).
- FINDING-021 holds: `restoreGuard` in both the restore UPDATE and its log INSERT (`ban-service.ts:413-428,452,716`).
- FINDING-018 holds: ban/unban/hide/restore audit rows in the same `db.batch` (`ban-service.ts:497-509,600-613`); unban row gated on `changes() > 0` (`:393`).
- FINDING-011 holds: ban log line carries ids, counts and reason length only (`ban-reason.ts:228-233`).
- FINDING-012/013 hold: fail-open warning on the request logger (`index.ts:308-310,379-381`); prod refuses every request without RL bindings (`index.ts:132-134`; `utils/env-validation.ts:148-155`).
- FINDING-022 holds: `[observability] enabled = false` in both blocks (`wrangler.toml:159-160,214-215`), pinned by `tests/wrangler-config.test.ts`.
- User text sanitized before every embed (`utils/embed-text.ts`: name/description/user/reason budgets via `sanitizeEmbedText`); masked-link label escaped, target is own share URL (`preset.ts:514-517`).
- Error text to channels: 4xx API messages only, 5xx/D1 internals replaced (`utils/response.ts:188-234`; `ban-service.ts:550-557`); presets-api 4xx moderation messages interpolate only numbers/constants (`apps/presets-api/src/services/validation-service.ts`).
- Logged Discord URLs pass `sanitizeUrl` (webhook token redaction, `utils/url-sanitizer.ts:42-66`); `/preset` registered with `default_member_permissions: '32'`, guild-only (`scripts/register-commands.ts:50-53`).
- Secrets only as secrets (`wrangler.toml:199-201` comment; `[vars]` hold env/client id/url); `.dev.vars*` ignored (`.gitignore:11-12`).
- Side effects use `ctx.waitUntil` (`index.ts:323,399`; `preset-moderation.ts:161`; `ban-reason.ts:101`; `preset.ts:389,611`).

## Rejected

- Ids (user / moderator / target) in log lines (`index.ts:247,313,365`; `ban-reason.ts:172`; `preset.ts:646`; custom_id in `index.ts:538`) — re-file of the 2026-10-03 rejected suspicion "moderation-worker logs user / moderator / target ids".
- Dev worker binds the production D1/KV/presets-api (`wrangler.toml:162-173`) — routeless, `workers_dev = false`; shared-data betas are an accepted, documented trade-off (`docs/operations/DEPLOY_ENVIRONMENTS.md:399`).
- `moderatorIdsCache` never invalidated (`services/preset-api.ts:249-283`) — a secret change deploys a new version and new isolates.
- Revert offered on a pending preset with a snapshot whose description is not shown (`review-message.ts:96-101,228-231`) — documented deploy step (presets-api 2.5.0 snapshots only approved text; `apps/moderation-worker/CHANGELOG.md:28-33`); restores text that was already live.
- No-author-name ban stores the id in `banned_users.username` (`ban-reason.ts:88-90`) — the id is already in `discord_id`; posts use a neutral label; blanked on unban.
- `searchPresetAuthors` fallback drops the banned filter on a D1 error (`ban-service.ts:128-153`) — moderator-only correctness; `banUser` still refuses a second ban.
- Discord error bodies logged (`discord-api.ts:92-96,243`) — Discord 4xx bodies carry codes/field paths, not values; Workers Logs are off.
- `logValidationErrors` echoes a malformed `MODERATOR_IDS` entry (`env-validation.ts:104-107`) — an id, not a credential; logs off.
- Unsanitized `subcommand` in `errors.unknownSubcommand` (`preset.ts:92`) — Discord validates subcommand names against the registered schema; ephemeral, no mentions.
- HTTP fallback sends Bearer over the public API URL when the binding is missing (`preset-api.ts:163-170`) — own TLS domain; binding is validated and present in both blocks.
- `pending_preview_image_url` rendered unsanitized (`preset.ts:206-208`) — server-built `${PREVIEW_IMAGE_PUBLIC_BASE}/${row.preview_image_key}` (`apps/presets-api/src/services/preset-service.ts:541-544`), keys server-generated.
- KV fallback limiter key shares `ratelimit:` prefix with discord-worker's KV — production requires native bindings (FINDING-013).

## Files covered

29 in-unit files (all 27 non-test `apps/moderation-worker/src/**/*.ts`, `wrangler.toml`, `scripts/register-commands.ts`) plus
cross-unit excerpts: `packages/types/src/preset/review-custom-id.ts`, `packages/auth/src/discord.ts`,
`packages/worker-kit/src/rate-limiter/backends/cloudflare.ts`, `apps/presets-api/src/handlers/moderation.ts` (revert, ban grep),
`apps/presets-api/src/services/preset-service.ts` (queue builder), `apps/discord-worker/PRIVACY_POLICY.md` §2/§5/§8.
Directories: `apps/moderation-worker/{src,src/handlers/{buttons,commands,modals},src/middleware,src/services,src/types,src/utils,scripts}`.
Not read in full: `src/types/{ban,preset,env}.ts` bodies, `src/utils/safe-json.ts` internals, test files.
