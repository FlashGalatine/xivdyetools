# Operations

Runbooks and checklists for the maintainer. Everything here needs credentials CI does not have.

| Page | Read it for |
|------|-------------|
| [DEPLOY_ENVIRONMENTS.md](DEPLOY_ENVIRONMENTS.md) | **Which worker a bare `wrangler deploy` / `wrangler secret put` hits** on each app — the dev, beta and production layout, and the beta runbook. Read before any manual deploy |
| [SECRET_ROTATION.md](SECRET_ROTATION.md) | Every secret, who consumes it, and the rotation order |
| [Security remediation — 2026-09-15](security-remediation-2026-09-15.md) | Rollout record: migration 0014, independent auth/bot/API/OG rollouts, and acceptance checks for the six security fixes (executed 2026-09-15) |
| [MODERATION.md](MODERATION.md) | Moderating community presets with the moderation bot |
| [DATA_SUBJECT_REQUESTS.md](DATA_SUBJECT_REQUESTS.md) | Privately verifying, exporting and deleting user data, with identity, ban, session and retention holds |
| [PAGES_RETENTION.md](PAGES_RETENTION.md) | Dry-run Pages history retention, current/retired origin checks and the held apply-activation requirements |
| [Conditional M release preparation](REMEDIATION_M_RELEASE_2026_10.md) | Nine conditional major/adoption cuts; earlier publication and acceptance gates remain open, with merges deferred until October 30 or later, satisfied prerequisites and new explicit authorization |
| [Conditional F preparation and adoption gates](REMEDIATION_F_RELEASE_2026_10.md) | Final text reconciliation, verification-only Discord fonts, locale-aware OG rendering and local native adoption evidence; all merging/publication/deployment/activation remains held |
| [October 2026 remediation release/adoption](REMEDIATION_RELEASE_2026_10.md) | Held A/R/H package/app sequence, production trigger fanout, provider/configuration cuts, migration prerequisites and release receipts; preparation does not authorize activation |
| [Unit acceptance checklists and approvals register](REMEDIATION_UNIT_ACCEPTANCE_2026_10.md) | Per-unit prerequisites, source identities, acceptance checks, flags and stop criteria for every pending release unit, and every authorization the runbooks still lack; preparation only |
| [Held D1 migrations: preflight and recovery](REMEDIATION_SCHEMA_RECOVERY_2026_10.md) | Read-only schema preflight queries, expected definitions, apply order and the recovery facts a maintainer must supply for OAuth 0002 and Presets 0016; nothing was run |
| [Preset-notification callers](REMEDIATION_NOTIFICATION_CALLERS_2026_10.md) | Every caller of the Discord worker's preset-notification surfaces before binding-only activation, and what source cannot establish |
| [External consumers of the planned removals](REMEDIATION_EXTERNAL_CONSUMERS_2026_10.md) | Known external npm users of the Core 6 and Bot Logic 5 removals and the coverage limits of that search |
| [ANALYTICS_QUERIES.md](ANALYTICS_QUERIES.md) | The Analytics Engine datasets (web-app telemetry, bot command traces) and the queries that read them |
| [DOMAIN_DEPRECATION.md](DOMAIN_DEPRECATION.md) | Retiring `*.xivdyetools.projectgalatine.com` in phases (custom domains removed 2026-10-04/05; the apex-redirect code remains) |
| [OPEN_ITEMS.md](OPEN_ITEMS.md) | **The living list of open operational work** — dashboard settings, secrets, manual verifications, gated code removals, recurring audits, accepted residual risks. The 5.0 merge-day record it grew out of is archived at [`historical/20260828-PostMerge5.0/`](../historical/20260828-PostMerge5.0/POST_MERGE_CHECKLIST.md) |
| [IMAGE_WORKER_SPLIT.md](IMAGE_WORKER_SPLIT.md) | The design record for splitting `image-worker` out of `discord-worker` (shipped 2026-08-11); its plan is in [`../superpowers/plans/`](../superpowers/plans/2026-08-09-image-worker-split.md) |

Two hazards worth repeating here because both have bitten before:

- **D1 migrations are applied with `wrangler d1 execute … --file=`, never `wrangler d1 migrations apply`.** The `d1_migrations` table is empty by design; `migrations apply` would replay every file and fail on the first duplicate column.
- **`oauth` inverts the deploy convention.** Its bare `wrangler deploy` is the production deploy (it has no `[env.production]`); every other worker's bare deploy targets a dev or beta worker.
