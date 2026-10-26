# Review: trust-boundaries (cross-unit) — 2026-10-26

HEAD 13c386e5. Read-only. No probe scripts and no test runs. This review builds on the
2026-10-03 `evidence/review-trust-boundaries.md`. It re-checks every edge at HEAD and looks
hardest at what changed since then: presets-api's identity re-key (FINDING-014 fix), the daily
`scheduled` retention job, the `edited_from` webhook payload, the shared review `custom_id`
grammar, and discord-worker `/glamour` → api-worker `POST /v1/chara/resolve`.

## 1. Service-binding edges at HEAD (12 `[[services]]` blocks, unchanged in count since 10-03)

| Caller (env) | Binding → callee | Path used | Callee also public? | Caller authentication at callee | Verdict |
|---|---|---|---|---|---|
| discord-worker (beta top-level and prod) | `PRESETS_API` → `xivdyetools-presets-api` (prod name in BOTH envs, wrangler.toml:29-31, :153-155) | `/api/v1/*` (preset-api.ts:138-147) | yes, `api.xivdyetools.app` | Bearer `BOT_API_SECRET` (SHA-256 constant-time, auth.ts:141-152,269) + v2 HMAC (auth.ts:292-324; hmac.ts:280-292) + single-use nonce (auth.ts:207-236,338) | OK; beta holds the prod path (see TB-01) |
| discord-worker (both) | `UNIVERSALIS_PROXY` → `xivdyetools-api-worker` | `GET /api/v2/aggregated/...` (universalis-client.ts:126), `POST /v1/chara/resolve` (glamour.ts:43,65) | yes, `data.`/`proxy.` | none (anonymous public API); a missing `CF-Connecting-IP` only picks the service bucket (rate-limit.ts:75-77; universalis/router.ts:138-150) | OK |
| discord-worker (both) | `IMAGE_WORKER` → `xivdyetools-image-worker` | `POST /extract` | no (workers_dev/preview_urls false, `*.workers.dev` refused, image-worker index.ts:72-100) | none by design | INTERNAL |
| presets-api (dev and prod) | `DISCORD_WORKER` → `xivdyetools-discord-worker` | `POST /webhooks/preset-submission` (notification-service.ts:274-282) | yes, `bot.xivdyetools.app` + beta `*.workers.dev` | Bearer `INTERNAL_WEBHOOK_SECRET`, `timingSafeEqual`, unset → 401, prod < 32 chars → 503 (discord index.ts:297-329); 10 KiB streamed cap (:335) | OK |
| presets-api (dev and prod) | `IMAGE_WORKER` → image-worker | `POST /thumbnail` | no | none | INTERNAL |
| moderation-worker (dev and prod) | `PRESETS_API` → presets-api | `/api/v1/moderation/*` via `pathSegment()` (preset-api.ts:341,407,436) | yes | same bearer + v2 HMAC + nonce (preset-api.ts:94-130) | OK |

There are no other bindings. oauth, og-worker and api-worker have no outbound bindings.
Nothing binds a `-dev` name, so the routeless dev workers (presets-api, moderation-worker,
api-worker, image-worker) are unreachable. Their production D1/KV/R2 sharing is the accepted
08-29 INF-13/MOD-06 state.

## 2. presets-api authz matrix (how a bot call is told from a user call)

`authMiddleware` (auth.ts:248-385) runs on `*` after the IP limiter, body cap and JSON-depth guard (index.ts:162-173):

| Bearer token | Extra headers | Result (`AuthContext`) |
|---|---|---|
| none / non-Bearer | ignored | `none`, unauthenticated |
| `== BOT_API_SECRET`, prod, no `BOT_SIGNING_SECRET` | ignored | unauthenticated, error logged (auth.ts:286-290); `validateEnv` 500s prod anyway |
| `== BOT_API_SECRET`, signing secret set | valid v2 sig + fresh nonce | `bot`; `userDiscordId`/`userName` = the **signed** `X-User-Discord-*`; `isModerator` = presets-api's own `MODERATOR_IDS` contains that id (auth.ts:339-345) |
| `== BOT_API_SECRET` | invalid/missing sig or replayed nonce | unauthenticated (auth.ts:326-349) |
| anything else, `JWT_SECRET` set | `X-User-*` IGNORED | `web` if HS256 + `exp` + `iss == JWT_ISSUER` + jti not revoked; id = `discord_id` claim else `sub` (auth.ts:71-77,93-115,353-377) |

Route guards: every `/moderation/*` handler calls `requireModerator` first (moderation.ts:150,163,260,370,473,495,524,540,566). Every preset/vote mutation passes the router-level `requireNotBanned` (presets.ts:131, votes.ts:30). `GET /presets?status≠approved` needs a moderator (presets.ts:235-240). The per-user limiter keys only on the authenticated id (rate-limit.ts:109-113,152-162). CORS `allowHeaders` stays `Content-Type, Authorization`, so a browser cannot send the bot identity headers (index.ts:149).

## 3. Candidates

### TB-01 — The beta bot, deployed from any unreviewed branch, can hold production's moderator-equivalent presets-api credential (LOW · LOCAL · precondition unconfirmed)

- **Claim:** presets-api has exactly one `BOT_API_SECRET`/`BOT_SIGNING_SECRET` pair (types.ts:136-137). Whoever holds it can name any `X-User-Discord-ID` and receives `isModerator` for any id in `MODERATOR_IDS` (auth.ts:339-345). The beta discord-worker binds the **production** `xivdyetools-presets-api` (wrangler.toml:29-31). `deploy-discord-worker-beta.yml:17-22` deploys it on any push to any non-main branch, with no review. `DEPLOY_ENVIRONMENTS.md:284-287` accepts that "`/preset submit` from beta writes a genuine row into the live moderation queue". In production that write is only possible when the beta worker carries the production signing pair (auth.ts:275-290). So the accepted risk, as worded, implies that code from any pushed branch runs with a credential equal to "any user, including any moderator" against production presets (approve, reject, revert, delete any preset, the dead-letter queue). Branch code can also read `env.BOT_SIGNING_SECRET` and send it anywhere.
- **Contradiction:** discord-worker `wrangler.toml:92-96` says "Beta needs only DISCORD_TOKEN + DISCORD_PUBLIC_KEY", and `DEPLOY_ENVIRONMENTS.md:324` says the bot secrets "may be omitted". Neither forbids them, and nothing enforces their absence: `validateEnv` on a `development` worker does not reject a present `BOT_API_SECRET`.
- **Precondition (not confirmable from the repo):** `wrangler secret list` on `xivdyetools-discord-worker-dev` shows `BOT_API_SECRET` and `BOT_SIGNING_SECRET` with the production values. If they are absent, beta is read-only against presets-api, and TB-01 drops to doc wording (the "accepted residual risk" sentence is then false).
- **Relation to prior work:** 08-29 DW-14 (INFO) and 10-03 trust-boundaries both rejected "beta shares prod bindings" as accepted. Neither weighed that the accepted sentence implies the moderator-equivalent signing pair sits in a branch-deployed worker. 08-29 FINDING-028 fixed the same class for the Cloudflare token: production credentials reachable from unreviewed branch pushes.
- **Fix direction:** confirm that beta has no bot secrets and state in wrangler.toml and DEPLOY_ENVIRONMENTS.md that it must not have them. Rewrite the accepted-risk sentence. If beta writes are wanted, give presets-api a second, non-moderator signing key: reject `isModerator` for that key, or allow only a route allowlist.

### TB-02 — `docs/architecture/service-bindings.md` misdescribes the inter-worker contract (INFO · INTERNAL)

- Usage example `:268-276` sends `Authorization: Bearer ${BOT_API_SECRET}` + `X-User-Discord-ID/Name` with no `X-Request-Timestamp`, `X-Request-Nonce` or `X-Request-Signature-V2`. presets-api treats such a request as **unauthenticated** in production (auth.ts:291-337). The discord-worker Env excerpt `:85` lists only `BOT_API_SECRET` and omits `BOT_SIGNING_SECRET`. (api-contracts.md:18-33 is correct.)
- Benefits table `:336` "Security: Internal only". presets-api (`api.`), discord-worker's webhooks (`bot.` and beta `*.workers.dev`) and api-worker (`data.`/`proxy.`) are all publicly routed. The binding authenticates nothing; secrets and HMAC do.
- `:65` and `:203` describe `UNIVERSALIS_PROXY` as "/budget (the /universalis routes)". Reality: `/api/v2/aggregated/...` (universalis-client.ts:126) **and** `POST /v1/chara/resolve` for `/glamour` (glamour.ts:43,65), on api-worker's shared `SERVICE_RATE_LIMITER` key (rate-limit.ts:61-77).
- `:30` notes that the beta block uses the same binding names. It does not say that beta's bindings point at the production callees, which is the fact a reader most needs.

## 4. Positive controls (verified at HEAD)

- v2 canonical string is length-prefixed and binds `v2`, the method, the path, sha256(body), the timestamp, the nonce, the id and the name (hmac.ts:280-292). The window is 60 s past and 60 s future (hmac.ts:317-334). The nonce must match `[A-Za-z0-9._-]{1,64}`, is written only after the signature verifies, and expires after 120 s (auth.ts:166-236,338). Both signers sign `new URL('https://internal'+path).pathname`, the same normalization as the verifier (discord preset-api.ts:120; moderation :122; auth.ts:315). No v1 is left anywhere.
- Bot body bytes are read through Hono's cache after `bodySizeLimit` (index.ts:167; auth.ts:310), so signature verification cannot read an unbounded body.
- `INTERNAL_WEBHOOK_SECRET`: presence and length are checked before the constant-time compare. The body is stream-capped at 10 KiB before parse. The type is allowlisted (`submission | preview_image`). For `preview_image`, `isValidPreviewImageKey` runs plus a `presetId/` prefix check before the key reaches a URL or `custom_id` (discord index.ts:297-362).
- GitHub webhook: 1 MiB raw-byte stream cap, then HMAC over the exact bytes before decoding (github-verify.ts:35-84, index.ts:605-653). Event allowlist; repository pinned, never taken from the payload; branch pinned; changelog fetched from a constant URL with a 10 s timeout (index.ts:661-713).
- Preview-image moderation buttons re-check `isModerator` on the clicker (preview-image.ts:161). presets-api then re-checks its own `MODERATOR_IDS` (moderation.ts:370), so there are two independent gates.
- JWT/state domain separation: oauth's signed state is a 2-part `base64url(json).hmac` (state-signing.ts:35-41,60), and `verifyState` accepts only 2 parts. A JWT is 3 parts and signs `header.payload`, so neither can stand in for the other even though both use `JWT_SECRET`.
- XIVAuth → `discord_id` (the presets-api identity and moderator key): oauth accepts only a snowflake-shaped `external_id` (xivauth.ts:343-353). Upstream XIVAuth (other-sources/XIVAuth @ a4e6693) builds that identity only from an OmniAuth callback `uid` (app/models/concerns/omniauth_authenticable.rb:6-19). It is unique per provider (app/models/user/social_identity.rb:3) and filtered by the app's permissible policy (app/controllers/api/v1/users_controller.rb:57-62). A user cannot self-assert another person's Discord id.
- Identity re-key (new since 10-03): runs only for `authSource === 'web'` with both JWT-proven ids, `sub !== discord_id`, after a ban check. Every one of its 5 statements carries the `NOT_BANNED` guard and binds all parameters. `fromId === toId` is a no-op (presets.ts:371-384; identity-rekey-service.ts:22-71).
- `toPublicPreset` strips `author_discord_id` for anonymous viewers and for web viewers who are not the owner and not a moderator. Only `bot` callers receive it, and the bots use it only for owner checks (preset-service.ts:169-192; discord preset.ts:782).
- The bots build presets-api paths with `encodeURIComponent` / `pathSegment` and filters with `URLSearchParams` (discord preset-api.ts:220-239,367,380; moderation :341).
- api-worker binding detection uses `CF-Connecting-IP` absence only to pick a bucket, never to grant anything (rate-limit.ts:61-77). `getClientIp` never trusts `X-Forwarded-For` by default (ip.ts:59-81).
- New `scheduled` retention job: cron in production only, not externally triggerable. It logs counts and prune names only (retention-job.ts:31-40,60-75).

## 5. Rejected

- **Query string outside the v2 signature:** 08-29 FINDING-015/PKG-03, deliberately INFO; code unchanged (auth.ts:315).
- **Missing `CF-Connecting-IP` skips the presets-api IP limiter / is used as the service bucket:** Cloudflare sets the header on every external request, including cross-zone Worker subrequests. 10-03 rejected this; code unchanged (rate-limit.ts:121-140).
- **Beta shares the production api-worker service bucket and image-worker:** 08-29 DW-14 / INF accepted (DEPLOY_ENVIRONMENTS.md). Only the credential aspect is raised, as TB-01.
- **One shared signing pair lets discord-worker (large parser surface) act as a moderator:** discord-worker legitimately calls the moderator route `PATCH /moderation/:id/preview-image` (preset-api.ts:458), so it needs that scope. Exploiting this needs a code-execution compromise of the worker, and no reachable path exists. Kept only as TB-01's fix direction for beta.
- **Nonce TTL (120 s) vs a 60 s past + 60 s future window:** the worst case (first accepted at `ts-60`) expires exactly when the signature does. The put happens after acceptance, so the entry outlives it.
- **XIVAuth-linked Discord id self-assertable → moderator escalation:** refuted by the upstream source (see Positive controls). The 08-21 OAUTH-9 caveat is resolved.
- **Re-key moves rows between different people:** `sub` and `discord_id` come from one server-minted token, and oauth refuses to attach a Discord id another row owns (user-service.ts:180-197).
- **State ↔ JWT cross-protocol confusion under `JWT_SECRET`:** part counts and signed input differ (see Positive controls).
- **`notifyDiscordBot` has no `AbortSignal`:** 10-03 bug handoff; reliability, not a trust issue.
- **`moderation-worker` debug log carries the moderator id:** 10-03 coordinator-rejected "moderation-worker logs user/moderator/target ids".
- **`MODERATION_BOT_TOKEN` held by discord-worker:** 08-21 MOD-16 (INFO), by design for button routing.
- **Webhook payload with `edited_from` could exceed 10 KiB and dead-letter:** the maximum field sizes (name 50, desc 200, tags 10×30, three copies, UTF-8 ≤ 3 bytes per unit) stay under the cap (validation-service.ts:22-47). Even if exceeded, the preset stays pending (no auto-publish), so the effect is a lost notification, not a security issue.
- **Dev-worker relaxations (unsigned bot auth, ban-check fail-open, stack echo) on production D1:** 08-29 INF-13 / PAPI-11; the dev workers are unreachable.

## 6. Files covered (39)

- apps/presets-api: `wrangler.toml`; `src/index.ts`; `src/middleware/auth.ts`; `src/middleware/rate-limit.ts` (80-175); `src/handlers/presets.ts` (225-306, 330-408, 957-983 + route grep); `src/handlers/moderation.ts` (route/guard grep); `src/services/preset-service.ts` (150-215); `src/services/notification-service.ts` (250-340 + grep); `src/services/identity-rekey-service.ts`; `src/services/validation-service.ts` (limits grep); `src/retention-job.ts` (grep); `src/types.ts` (grep).
- apps/discord-worker: `wrangler.toml`; `src/index.ts` (200-728); `src/services/preset-api.ts` (60-300 + grep); `src/handlers/commands/glamour.ts` (30-110); `src/handlers/buttons/preview-image.ts` (1-80 + grep); `src/services/budget/universalis-client.ts` (105-135); `src/utils/github-verify.ts`.
- apps/moderation-worker: `wrangler.toml`; `src/services/preset-api.ts` (76-175 + grep).
- apps/api-worker: `wrangler.toml` (1-28); `src/middleware/rate-limit.ts` (40-130); `src/universalis/router.ts` (100-175).
- apps/image-worker: `wrangler.toml` (1-30); `src/index.ts` (grep).
- apps/oauth: `src/utils/state-signing.ts`; `src/utils/pkce-binding.ts` (30-110); `src/handlers/xivauth.ts` (330-400); `src/services/user-service.ts` (36-110).
- packages: `auth/src/hmac.ts` (240-340); `worker-kit/src/rate-limiter/ip.ts`.
- docs and CI: `docs/architecture/service-bindings.md`; `docs/architecture/api-contracts.md` (grep); `docs/operations/DEPLOY_ENVIRONMENTS.md` (270-330); `docs/architecture/security-trade-offs.md` (headings); `.github/workflows/deploy-discord-worker-beta.yml` (1-60 + grep); the 2026-10-03 and 2026-10-15 report sections (Positive controls / Rejected); 2026-10-03 `evidence/review-trust-boundaries.md`.
- External, read-only: other-sources/XIVAuth `app/controllers/api/v1/users_controller.rb`, `app/models/concerns/omniauth_authenticable.rb`, `app/models/user/social_identity.rb` (grep).

Directories: apps/{presets-api,discord-worker,moderation-worker,api-worker,image-worker,oauth}, packages/{auth,worker-kit}, docs/architecture, docs/operations, docs/audits, .github/workflows.
