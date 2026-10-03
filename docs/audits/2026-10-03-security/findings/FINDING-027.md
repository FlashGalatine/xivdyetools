# FINDING-027: discord-worker POST /webhooks/preset-submission is public (bot.xivdyetools.app) and gated only by a bearer INTERNAL_WEBHOOK_SECRET, which has no length floor in either worker and no failed-auth rate limit
**Severity:** INFO · **Exposure:** INTERNET-UNAUTH · **Deploy unit:** discord-worker + presets-api · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-307

## Location
- apps/discord-worker/src/index.ts:257-276 — the POST /webhooks/preset-submission handler. Its only gate is timingSafeEqual(Authorization, `Bearer ${INTERNAL_WEBHOOK_SECRET}`). It has no rate limit and does not check that the caller is a service binding.
- apps/discord-worker/src/utils/env-validation.ts:78-84 — BOT_SIGNING_SECRET is the only secret with a length floor (>=32). INTERNAL_WEBHOOK_SECRET is not validated here at all.
- apps/presets-api/src/utils/env-validation.ts:112-135 — in production JWT_SECRET needs >=32 characters, but INTERNAL_WEBHOOK_SECRET only needs to be non-empty (`!env.INTERNAL_WEBHOOK_SECRET || ...trim() === ''`).

## Evidence
- apps/discord-worker/wrangler.toml:116-119 — production sets `workers_dev = false` with routes `{ pattern = "bot.xivdyetools.app", custom_domain = true }` and bot.xivdyetools.projectgalatine.com, so the handler is reachable from the internet and not only through the DISCORD_WORKER binding.
- apps/discord-worker/src/index.ts:169-236 — the global middleware is CORS, requestId, logger, env validation and security headers. There is no limiter, so repeated 401 guesses are never throttled. The handler's only response is `logger.error('Webhook authentication failed'); return c.json({ error: 'Unauthorized' }, 401);`
- Prior audits list this route as reachable by anyone who holds the secret (2026-08-29 review-discord-worker.md:34), but they file no finding or trade-off about how strong the secret must be. The missing length floor is new; the absence of a GitHub-secret floor is a documented decision (apps/discord-worker/src/utils/github-verify.ts:26-28).

## Fix
- Add a `length < 32` check for INTERNAL_WEBHOOK_SECRET to the production block in presets-api and discord-worker env-validation. **Precondition:** Cloudflare secrets cannot be read back and discord-worker answers 500 to every request on a production env error (`index.ts:190-221`), so first confirm the length from the stored copy or set a known ≥ 32-character value on both workers back-to-back.
- Optionally make the route binding-only by rejecting requests that carry CF-Connecting-IP (service-binding callers have none), or put the existing worker-kit limiter in front of the auth check.
- No rotation is needed: no secret value was exposed.

## Status
OPEN — the Sprint 0 precondition (`INTERNAL_WEBHOOK_SECRET` ≥ 32 characters on presets-api and discord-worker) is the maintainer's; code is Sprints 1 and 3.
