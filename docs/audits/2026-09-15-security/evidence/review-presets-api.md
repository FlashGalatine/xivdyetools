# Presets API worker review

**Scope:** `apps/presets-api` at `0332fcc5`; source-only review. Production is `[env.production]`; the top-level worker is routeless development.

## Route and authorization matrix
| Route group | Gate / validation | Result |
|---|---|---|
| public GET presets/categories | IP limit, CORS, visibility gate | approved rows public; hidden states 404 |
| preset submit/edit/delete/image | JWT or v2 bot auth, user context, router-wide ban check, user quota | author-only mutations except bot submit |
| votes | same auth and ban check, approved-row gate, unique vote key | authenticated vote mutations |
| moderation/* | `requireModerator` on every route | moderator-only state/history/dead-letter actions |
| bot service-binding paths | v2 method/path/body/timestamp/nonce/identity HMAC; 60 s freshness | only authenticated bot identity |

## Candidates
| candidate | severity / exposure | file:line | claim | evidence |
|---|---|---|---|---|
| Preview approval acts on a replacement image | MEDIUM / INTERNET-AUTH | `src/handlers/moderation.ts:271-284` | An author can replace the image after the moderation request reads image key/status and before its id-only approval update; the replacement becomes `approved` without review. | Event order: moderator request reads K1; owner authenticated upload stores K2 and writes `pending` at `handlers/presets.ts:1126-1151`; approval writes by id only. Rejection similarly clears K2 while deleting stale K1 at `288-308`. |
| Owner text edit can override a fresh moderator state | LOW / INTERNET-AUTH | `src/handlers/presets.ts:523-535,463-501`; `src/services/preset-service.ts:634-708` | An owner edit calculated from `approved`/`rejected` can write `pending` after a moderator changes the row to `hidden` or `flagged`. | Event order: owner reads allowed old state; a moderator conditionally changes status; owner supplies text that moderation flags (approved) or resubmits (rejected), then id-only `updatePreset` writes its stale `pending`. This reopens a moderator-closed item but does not publish it. |
| Moderator revert can override a fresh moderator state | LOW / INTERNET-AUTH | `src/handlers/moderation.ts:200-230`; `src/services/preset-service.ts:467-490` | A stale revert restores previous content and `approved` after another moderator has changed the item. | Event order: moderator A reads row plus `previous_values`; moderator B conditionally changes status; A's `prepareRevert` has no expected-status/snapshot predicate and unconditionally writes `approved`. This can re-expose the old content. |

## Positive controls
- Production validation requires JWT issuer/secret, revocation KV, native limiter, v2 secret, bot/image service bindings, R2 and notification secret (`utils/env-validation.ts`).
- Auth order is edge IP limit, body/depth cap, v2/JWT authentication, then authenticated-user limit (`index.ts:150-216`); v2 includes a nonce cache and no v1 fallback (`middleware/auth.ts:186-235,270-347`).
- All moderator handlers call `requireModerator`; preset/vote mutation routers apply fail-closed ban checking. SQL uses prepared bindings; owner/non-approved visibility and `author_discord_id` projection are centralized.
- Preview input has stream cap (5 MB), magic sniff, image-worker conversion timeout, server-generated `{presetId}/{UUID}.webp` R2 keys, and only exposes URLs for approved status. Perspective uses header key, `doNotStore`, 5 s timeout, and queues any configured-service failure.
- Quotas use append-only events; public and per-user native rate limits are separated; notification dead letters retain only preset id and are pruned. Logs avoid raw ids/text/nonce; no analytics sink found.

## Rejected suspicions
- v1 bot signing, unsigned production bot identity, client-selected R2 keys, unbounded binary upload, unsupported image media, D1 interpolation, public author id exposure, and moderation endpoint omission were not reachable.
- KV nonce replay protection is best-effort across colos and intentionally skips during a KV error; the still-required v2 signature/freshness remains, so this is not filed separately.
- Fail-open rate limiting is an accepted documented trade-off; configured Perspective failure is fail-closed.
- Shared revocation-read fail-open is an accepted current OAuth README residual risk: production binding validation and removal of refresh confine it to an outage and the token's remaining lifetime; it is not duplicated as a preset finding.

## Covered files and limits
- Covered 20 production TypeScript files, `wrangler.toml`, schema/migrations, target CLAUDE/README, prior-audit README plus Positive controls/Rejected suspicions, and security trade-offs. No tests, installs, production probes, or source changes.
- Limits: no live D1/R2/KV or service-binding behavior was exercised.
