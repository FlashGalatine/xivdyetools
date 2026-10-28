# FINDING-039: Public /webhooks/preset-submission has no failed-auth throttle or binding-only check (FINDING-027 optional hardening not done)
**Severity:** INFO · **Exposure:** INTERNET-UNAUTH · **Deploy unit:** discord-worker · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-307
**Supersedes:** 2026-10-03-security/FINDING-027 (optional hardening not done)

## Location
- `apps/discord-worker/src/index.ts:293` — Public /webhooks/preset-submission has no failed-auth throttle or binding-only check (FINDING-027 optional hardening not done)

## Evidence
- index.ts:325-328: if (!(await timingSafeEqual(authHeader, expectedAuth))) { logger.error('Webhook authentication failed'); return c.json({ error: 'Unauthorized' }, 401); }. No limiter and no CF-Connecting-IP check precede it.
- Reach: Any internet client can POST to https://bot.xivdyetools.app/webhooks/preset-submission (wrangler.toml:122-129, custom_domain route) with arbitrary Authorization headers. Each guess passes CORS/requestId/logger/validateEnv/security-header middleware (index.ts:205-272), none of which throttles, and reaches timingSafeEqual at index.ts:325, which answers 401 with no limiter.
- The code matches the claim: the only gates are the non-empty check (index.ts:303), the production length floor of 32 (index.ts:315-322, MIN_WEBHOOK_SECRET_LENGTH at utils/env-validation.ts:33) and the constant-time bearer compare (index.ts:325). checkRateLimit is used only for interactions (index.ts:954,1113), and no CF-Connecting-IP / binding-only check exists. With the 64-character secret rotated on 2026-10-03, online brute force is infeasible, so this is residual hardening only: the optional second bullet of 2026-10-03 FINDING-027's fix. Preconditions: An attacker would need to guess a 64-character bearer secret online, one HTTP request per guess, which is impractical. The beta worker (top-level, workers_dev=true, wrangler.toml:16) gets no length floor, because that check runs only when ENVIRONMENT=production. Its exposure therefore depends on th…
- Live state the repo cannot show: The production INTERNAL_WEBHOOK_SECRET is documented as 64 characters (rotated 2026-10-03), but it cannot be read back. The beta worker's secret length is unknown. Any Cloudflare zone-level WAF or rate-limiting rule on bot.xivdyetools.app is not visible from the repo.

## Fix
- Reject requests that carry CF-Connecting-IP before the auth check, since presets-api reaches this route only through the DISCORD_WORKER service binding. Alternatively, put a worker-kit limiter keyed on IP in front of timingSafeEqual. Confirm first that no non-binding caller (for example a manual retry script) depends on the public route.

## Status
OPEN — private named notification provider and separate presets binding companion prepared; default-false gate requires provider/consumer verification and separately authorized public cutover. [A-DISCORD evidence](../evidence/remediation-discord-2026-10-27.md).
