# Operations

Runbooks and checklists for the maintainer. Everything here needs credentials CI does not have.

| Page | Read it for |
|------|-------------|
| [DEPLOY_ENVIRONMENTS.md](DEPLOY_ENVIRONMENTS.md) | **Which worker a bare `wrangler deploy` / `wrangler secret put` hits** on each app — the dev, beta and production layout, and the beta runbook. Read before any manual deploy |
| [SECRET_ROTATION.md](SECRET_ROTATION.md) | Every secret, who consumes it, and the rotation order |
| [MODERATION.md](MODERATION.md) | Moderating community presets with the moderation bot |
| [ANALYTICS_QUERIES.md](ANALYTICS_QUERIES.md) | The Analytics Engine datasets (web-app telemetry, bot command traces) and the queries that read them |
| [DOMAIN_DEPRECATION.md](DOMAIN_DEPRECATION.md) | Retiring `*.xivdyetools.projectgalatine.com` in phases |
| [POST_MERGE_CHECKLIST.md](POST_MERGE_CHECKLIST.md) | The ordered follow-up list from the 5.0 merge (2026-08-28) — the dashboard, credential and cleanup items still open live here |
| [IMAGE_WORKER_SPLIT.md](IMAGE_WORKER_SPLIT.md) | The design record for splitting `image-worker` out of `discord-worker` (shipped 2026-08-11); its plan is in [`../superpowers/plans/`](../superpowers/plans/2026-08-09-image-worker-split.md) |

Two hazards worth repeating here because both have bitten before:

- **D1 migrations are applied with `wrangler d1 execute … --file=`, never `wrangler d1 migrations apply`.** The `d1_migrations` table is empty by design; `migrations apply` would replay every file and fail on the first duplicate column.
- **`oauth` inverts the deploy convention.** Its bare `wrangler deploy` is the production deploy (it has no `[env.production]`); every other worker's bare deploy targets a dev or beta worker.
