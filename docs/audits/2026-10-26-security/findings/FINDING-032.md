# FINDING-032: oauth [env.development] inherits the production auth.xivdyetools.app custom-domain route
**Severity:** LOW · **Exposure:** LOCAL · **Deploy unit:** oauth (only oauth; every other wrangler.toml keeps routes solely under [env.production], or overrides them there in og-… · **Rotation:** NONE · **Policy:** NONE (config fix). docs/operations/DEPLOY_ENVIRONMENTS.md (oauth row :163) needs no change beyond optionally noting the routes override. · **CWE:** n/a

## Location
- `apps/oauth/wrangler.toml:59` — oauth [env.development] inherits the production auth.xivdyetools.app custom-domain route

## Evidence
- wrangler.toml:9-11 routes = [{ pattern = "auth.xivdyetools.app", custom_domain = true }]; :59-61 [env.development] name = "xivdyetools-oauth-dev", vars = { ENVIRONMENT = "development", FRONTEND_URL = "http://localhost:5173", ... } (no routes); :84 database_id = "TODO_RUN_WRANGLER_D1_CREATE"
- Reach: A maintainer or agent runs `wrangler deploy --env development` from apps/oauth once the dev D1 id is filled in. The dev env has no `routes` override, so it inherits `routes = [{ pattern = "auth.xivdyetools.app", custom_domain = true }]` (:9-11) and tries to attach the production auth domain to xivdyetools-oauth-dev.
- `routes` is an inheritable wrangler key, and the repo's own comments in presets-api/discord-worker/moderation-worker/og-worker wrangler.toml:7-11 say so. `[env.development]` (:59-61) sets only name and vars, so it would take the production custom domain while running dev vars: ENVIRONMENT=development turns on unsigned state (oauth-flow.ts:93, :250), localhost CORS and redirect origins (constants/oauth.ts:48, index.ts:79), err.message echo (index.ts:314), and warn-only env validation (index.ts:156-164). Today this is blocked only by the placeholder D1 id (:84), and wrangler-config.test.ts:56-68 asserts routes only on the whole file,… Preconditions: The dev D1 database_id placeholder (:84) has been replaced with a real id, and someone runs a deploy with --env development. Wrangler's handling of a custom domain already owned by xivdyetools-oauth is unverified: it may prompt, refuse, or reassign the domain in non-interactive mode.
- Live state (read-only Cloudflare query 2026-10-26, [evidence](../evidence/live-state-cloudflare-2026-10-26.md)): no `xivdyetools-oauth-dev` worker and no dev D1 database exist (the account has four D1 databases, none a dev copy), so the trap is latent: it needs `wrangler d1 create`, the placeholder at `apps/oauth/wrangler.toml:84` filled in, and a deliberate `--env development` deploy.

## Fix
- Add `routes = []` and `workers_dev = false` (or an explicit dev route) under [env.development] in apps/oauth/wrangler.toml, or delete the env block. Extend apps/oauth/src/__tests__/wrangler-config.test.ts to assert the dev env overrides routes.

## Status
OPEN
