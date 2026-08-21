# FINDING-010: Secret-rotation runbook is stale — bare `wrangler secret put` now rotates the dev/beta worker, and 14 of 24 secrets are not covered

## Severity
**MEDIUM** (operational) — during an incident the documented procedure would set the new value on the wrong worker for discord-worker, moderation-worker and presets-api (their top-level wrangler block is the routeless `-dev` worker; production needs `--env production`), leaving the compromised secret live in production. Reviewer ID: INF-4. Coordinator-verified (`SECRET_ROTATION.md:61-262` uses bare `wrangler secret put` and pre-monorepo `cd xivdyetools-oauth` paths).

## Category
CWE-1059 Insufficient Technical Documentation · operational security

## Location
- `docs/operations/SECRET_ROTATION.md` — last revised Dec 2025 ("review overdue" per its own header), pre-monorepo directory names (`xivdyetools-oauth`, `xivdyetools-presets-api`), retired domain references, every `wrangler secret put` without `--env production` (lines 61, 68, 105, 112, 119, 154, 175, 204, 259, 262).
- Secrets inventory in `../evidence/review-infra-stoat.md` — 24 secret names referenced by worker code (`env.X` not present in `[vars]`); 14 have no rotation procedure (incl. `BOT_SIGNING_SECRET`, `MODERATOR_IDS`, `GITHUB_WEBHOOK_SECRET`, `PERSPECTIVE_API_KEY`, `UPSTASH_*`, `MODERATION_BOT_TOKEN`, `BETA_*`, and all CI secrets).

## Recommendation
- Rewrite the runbook for the monorepo: per-worker table of secret → `pnpm --filter <app> exec wrangler secret put NAME --env production` (note oauth's inverted layout), rotation order for shared secrets (`JWT_SECRET`, `BOT_API_SECRET`/`BOT_SIGNING_SECRET` must be rotated on both sides), verification step (health/smoke), and CI secrets (`CLOUDFLARE_API_TOKEN`, `DISCORD_TOKEN`, `BETA_DISCORD_TOKEN`).
- Add the missing 14 secrets; add a "last rotated" column and a review date; link from `DEPLOY_ENVIRONMENTS.md`.

## References
- Evidence: `../evidence/review-infra-stoat.md` (INF-4, secrets inventory)

## Status
**FIXED 2026-08-21** — `docs(ops): rewrite SECRET_ROTATION.md for the monorepo (FINDING-010)`: per-app `pnpm --filter … exec wrangler secret put … --env production` (oauth inverted), the 24-secret inventory incl. CI secrets and shared-secret ordering, rotation schedule, emergency steps, verification checklist and a rotation log.
