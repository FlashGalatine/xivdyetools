# Documentation audit — cluster: presets-moderation-oauth

Reviewed against `origin/main` @ `0fec18f4` (worktree `docs-audit-2026-09-18`).

## Coverage

| file | sections reviewed | result |
|---|---|---|
| docs/projects/presets-api/overview.md | all | reviewed |
| docs/projects/presets-api/endpoints.md | all | reviewed |
| docs/projects/presets-api/database.md | all | reviewed |
| docs/projects/presets-api/moderation.md | all | reviewed |
| docs/projects/presets-api/rate-limiting.md | all | reviewed |
| docs/projects/moderation-worker/overview.md | all | reviewed |
| docs/projects/oauth/overview.md | all | reviewed |
| docs/projects/oauth/endpoints.md | all | reviewed |
| docs/projects/oauth/jwt.md | all | reviewed |
| docs/projects/oauth/pkce-flow.md | all | reviewed |

Source read in full or targeted detail: `apps/presets-api/src/{index,types}.ts`, `handlers/{presets,moderation,categories}.ts`,
`middleware/auth.ts`, `services/{preset-service,validation-service,moderation-service,notification-service,rate-limit-service}.ts`,
`utils/api-response.ts`, `schema.sql`, all `migrations/*.sql` (incl. `0014_add_content_revision.sql`), `wrangler.toml`;
`apps/moderation-worker/src/handlers/commands/preset.ts`, `handlers/buttons/preset-moderation.ts`, `wrangler.toml`;
`apps/oauth/src/constants/oauth.ts`, `services/jwt-service.ts`, `handlers/token.ts`, `wrangler.toml`; `packages/auth/src/revocation.ts`;
`packages/worker-kit/src/rate-limiter/presets/configs.ts`. `apps/*/CLAUDE.md` files were read as source-adjacent cross-checks only
(not part of the audited doc set).

## Candidates

| cand-id | sev | kind | file:line | one-line claim vs reality | evidence pointer (source path:line) |
|---|---|---|---|---|---|
| PMO-01 | MEDIUM | MISSING | docs/projects/presets-api/database.md:28-53 (presets table) and :178-194 (migrations table) | `presets` column list and the migration table omit `content_revision` and migration `0014_add_content_revision.sql` entirely — an optimistic-concurrency token + trigger added after the last audit | apps/presets-api/migrations/0014_add_content_revision.sql:1-19; apps/presets-api/schema.sql:56-78 |
| PMO-02 | MEDIUM | MISSING | docs/projects/presets-api/endpoints.md:172-189 (`PATCH /api/v1/presets/:id`) | Owner-edit endpoint doc never mentions the row can now be rejected with `409 CONFLICT "Preset changed concurrently — reload and retry"` when the caller's `content_revision` is stale — a real, newly-added failure mode with no documented shape | apps/presets-api/src/services/preset-service.ts:642-719 (`updatePreset` WHERE `content_revision = ?`); apps/presets-api/src/handlers/presets.ts:788-797 |
| PMO-03 | MEDIUM | WRONG | docs/projects/presets-api/endpoints.md:261-264 | Doc says the moderation-status conflict 409 body is `{"error":"DUPLICATE_RESOURCE","message":"Preset status changed concurrently — reload and retry"}`; source returns `error: "CONFLICT"` (not `DUPLICATE_RESOURCE`, which is a different, already-used code in the same file) and message `"Preset changed concurrently — reload and retry"` (no "status" word) | apps/presets-api/src/handlers/moderation.ts:159-166; apps/presets-api/src/utils/api-response.ts:39-40 (`ErrorCode.CONFLICT = 'CONFLICT'`) |
| PMO-04 | MEDIUM | WRONG | docs/projects/presets-api/endpoints.md:5-6 | Banner claims legacy itemIDs "(≥ 5729)" trigger the "looks like a legacy item ID" rejection; source's actual cutoff is `id >= 5000` | apps/presets-api/src/services/validation-service.ts:217-220 |
| PMO-05 | MEDIUM | MISSING | docs/projects/presets-api/endpoints.md:280-283 (`PATCH /moderation/:presetId/preview-image`) | Doc's request body is `{ action: 'approve' \| 'reject' }` only; source additionally *requires* `preview_image_key` (validated against a `{presetId}/…webp` pattern) and 409s with "This preview image changed or was already moderated" when it doesn't match the stored key/status — a caller following the doc omits a required field and gets an undocumented 400/409 | apps/presets-api/src/handlers/moderation.ts:269-312 |
| PMO-06 | LOW | MISSING | docs/projects/presets-api/moderation.md:63-89 ("Moderation Workflow") | Also lacks any mention of the `content_revision` check on revert (`PATCH /moderation/:id/revert` can now 409 on a stale read, not just "no previous_values") | apps/presets-api/src/services/preset-service.ts:472-499 (`prepareRevert` WHERE `content_revision = ? AND previous_values = ?`); apps/presets-api/src/handlers/moderation.ts:241-248 |

## Positive controls (checked and correct)

- presets-api rate limits: 100/min per-IP and per-user (`RL_PUBLIC`, `[[ratelimits]] simple.limit=100/60s`), daily quotas 10/10/20/30 for submission/flagged_edit/preview_upload/text_edit — doc matches `rate-limit-service.ts` constants and `wrangler.toml` exactly (docs/projects/presets-api/rate-limiting.md vs apps/presets-api/src/services/rate-limit-service.ts:24-45, apps/presets-api/wrangler.toml:46-49).
- Perspective API pipeline: 5 attributes (no `THREAT`), 0.7 threshold, 5 s `AbortSignal.timeout`, `x-goog-api-key` header (not query string), `doNotStore: true`, fail-closed `moderationUnavailable()` on error/timeout/malformed body — matches docs/projects/presets-api/moderation.md exactly (apps/presets-api/src/services/moderation-service.ts:216-333).
- Notification retry: 3 retries, 1–10 s exponential backoff with jitter — matches (apps/presets-api/src/services/notification-service.ts:135-139).
- Categories cache headers: 60 s edge / 30 s browser — matches (apps/presets-api/src/handlers/categories.ts:17-20).
- `toPublicPreset` author-visibility table (anonymous/web-own/web-other/moderator/bot) in endpoints.md matches `preset-service.ts:169-193` exactly, including "bot responses unchanged."
- moderation-worker: `/preset moderate` action set (pending/approve/reject/stats), rate limits (`RL_COMMAND` 25/60s → 20+5 burst; `RL_AUTOCOMPLETE` 70/60s → 60+10 burst), English-only i18n design — all match `wrangler.toml` and `preset.ts`.
- oauth: redirect-origin allowlist, `STATE_EXPIRY_SECONDS=600`, JWT claim set (9 for XIVAuth-only / 10 with `discord_id`), `iss` pinning to `WORKER_URL`, `/auth/refresh` 404 removal, `REFRESH_GRACE_SECONDS=900` with 60 s TTL floor, `/auth/revoke` 503-vs-200 two-outcome shape — all verified byte-for-byte against `constants/oauth.ts`, `jwt-service.ts`, `token.ts`, and `packages/auth/src/revocation.ts`.
- oauth rate limits 10/10/20/20/30/30 across `/auth/discord`, `/auth/xivauth`, `/auth/callback` (GET+POST), `/auth/xivauth/callback`, `/auth/me`, `/auth/revoke` — matches `packages/worker-kit/src/rate-limiter/presets/configs.ts:19-33` and `wrangler.toml`.
- All relative links checked in these 10 files (CHANGELOG.md paths, versions.md, DEPLOY_ENVIRONMENTS.md, SECRET_ROTATION.md, sibling doc cross-links) resolve to tracked files.

## Rejected items

- Considered flagging database.md's "There are 7 live tables" as stale given migration 0014 — rejected: 0014 only adds a column + trigger to the existing `presets` table, no new table, so the count is still correct today.
- Considered flagging presets-api overview.md's architecture diagram (Auth Middleware → Handler → D1, with Moderation Pipeline branching off) as incomplete vs. the real middleware chain (request-id → logger → env-validate → security-headers → CORS → public-rate-limit → body-size → json-depth → auth → per-user-rate-limit → content-type-assert) — rejected as a candidate: the doc explicitly labels the diagram as a simplified request flow, not a middleware-order reference, and does not make a false claim about ordering.
- Considered flagging oauth's `OAUTH_LIMITS` still containing a `/auth/refresh: 30/min` entry in `packages/worker-kit` after the route's 3.0.0 removal — rejected: the docs never claim `/auth/refresh` still has a rate limit; the stray config entry is dead code, not a documentation contradiction, and oauth/endpoints.md explicitly and correctly states the route 404s.
