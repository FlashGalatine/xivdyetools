# Deploy units (xivdyetools) — what a finding is tagged with

A *deploy unit* is what ships in one coordinated release; every finding carries one. Release mechanics,
version rule and deploy commands live in `release-mechanics.md` (planner + dead-code read that one).

## Packages (`xivdyetools/packages/`) — ship by npm publish

| Dir | pnpm filter | Published? | Level | Ends with |
|---|---|---|---|---|
| `types` | `@xivdyetools/types` | yes | 0 | version bump → merge → Actions "Publish Packages to npm" |
| `logger` | `@xivdyetools/logger` | yes | 0 | same |
| `auth` | `@xivdyetools/auth` (incl. `/encoding`) | yes | 0 | same |
| `worker-kit` | `@xivdyetools/worker-kit` (incl. `/rate-limiter`) | yes | 1 | same |
| `core` | `@xivdyetools/core` (incl. `/blending`) | yes | 1 | same; `build` regenerates `src/data/locales/` |
| `svg` | `@xivdyetools/svg` | yes | 2 | same |
| `bot-logic` | `@xivdyetools/bot-logic` (incl. `/i18n`) | yes | 3 | same |
| `test-utils` | `@xivdyetools/test-utils` | **no** (private) | — | merge only |


## Apps (`xivdyetools/apps/`) — ship by deploy

| Dir | pnpm filter | Kind | Production release | Notes |
|---|---|---|---|---|
| `web-app` | `xivdyetools-web-app` | Pages (Vite+Lit) | merge to `main` → `deploy-web-app.yml` (bundle-size check + smoke test) | beta = `deploy-web-app-beta.yml` (`--branch=beta`, load-bearing); beta writes to PRODUCTION preset data |
| `discord-worker` | `xivdyetools-discord-worker` | CF Worker | `deploy:production` (= `wrangler deploy --env production`) via `deploy-discord-worker.yml` on `main`; `register-commands` runs in CI on merge | bare `deploy` = `…-dev` = the **beta bot** |
| `moderation-worker` | `xivdyetools-moderation-worker` | CF Worker | `deploy:production` via workflow | bare `deploy` = routeless dev; register-commands is user-run |
| `presets-api` | `xivdyetools-presets-api` | CF Worker + D1 + R2 | `deploy:production` via workflow | D1 migrations: `d1_migrations` dir is empty — apply by hand per runbook, never `migrations apply` |
| `oauth` | `xivdyetools-oauth-worker` | CF Worker + D1 | **bare `wrangler deploy` IS production** (no `[env.production]`) | `deploy:production` is the same command |
| `api-worker` | `xivdyetools-api-worker` | CF Worker + KV + static docs | `deploy:production` via workflow | bare `deploy` = routeless dev |
| `og-worker` | `xivdyetools-og-worker` | CF Worker | `deploy:production` via workflow | bare `deploy` = the **routed beta** (`beta.xivdyetools.app`) — live too |
| `image-worker` | `xivdyetools-image-worker` | CF Worker (service-binding only) | `deploy:production` via workflow | no public routes; consumers: discord-worker `/extract`, presets-api `/thumbnail` |
| `stoat-worker` | `xivdyetools-stoat-worker` | Node (revolt.js) | parked — no active investment | findings: file, tag P3 unless security |
