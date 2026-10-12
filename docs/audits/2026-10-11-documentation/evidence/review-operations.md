# Review: operations cluster (2026-10-11)

Baseline: HEAD 42c35e87 == served 16a6123f for all app code. Source of truth is HEAD.
Sources read: apps/*/wrangler.toml (all 7 workers), .github/workflows (beta/prod deploy), apps/moderation-worker/src + scripts, apps/presets-api (migrations, ban-check, retention), apps/image-worker/src, apps/discord-worker (analytics, wrangler, env), apps/api-worker/src/telemetry, pnpm-workspace.yaml. `gh api` (read-only) used for repo secret names and branch protection.

## Coverage

| Path | Tier | Units | Sections reviewed | Result |
|---|---|---|---|---|
| docs/operations/ANALYTICS_QUERIES.md | living | api-worker telemetry, discord-worker analytics | all (columns, events, outcome classes, anchors, datasets) | reviewed (1 spelling only) |
| docs/operations/DEPLOY_ENVIRONMENTS.md | living | all wrangler.toml, beta workflows | all | reviewed (cand-06, cand-07) |
| docs/operations/DOMAIN_DEPRECATION.md | living | wrangler.toml routes, oauth, presets-api, web-app functions | all | reviewed (cand-10) |
| docs/operations/IMAGE_WORKER_SPLIT.md | living (design record, Status line present) | image-worker | wire contract, guard, config test | reviewed (spelling only) |
| docs/operations/MODERATION.md | living | moderation-worker, presets-api ban-check | all | reviewed (cand-01..04) |
| docs/operations/OPEN_ITEMS.md | living | repo-wide | every row 1-7 | reviewed (cand-05, cand-11) |
| docs/operations/SECRET_ROTATION.md | living | env.ts of 7 workers, workflows | inventory, procedures, log | reviewed (cand-09) |
| docs/operations/index.md | living | - | table + 2 hazards | reviewed, accurate |
| docs/operations/security-remediation-2026-09-15.md | living (executed one-time procedure) | presets-api migration 0014, workflows | all | reviewed (cand-08) |

## Candidates (full evidence is in the structured return; summary)

- cand-operations-01 MEDIUM inaccurate: MODERATION.md:15 "web moderation queue" does not exist; `/preset moderate` (pending/approve/reject/stats) and the review buttons are undocumented.
- cand-operations-02 MEDIUM inaccurate: data handling described pre FINDING-005/008/011 (ban post "User ID", "Ban history is preserved", logged reason).
- cand-operations-03 LOW inaccurate: autocomplete "ban date", ban message text, channel-restriction text, "restores all hidden", banned_at DDL.
- cand-operations-04 MEDIUM inaccurate (supersedes DOC-018): XIVAuth-only authors / `user` is a username search.
- cand-operations-05 MEDIUM inaccurate (supersedes DOC-019): OPEN_ITEMS still says the moderation-worker side "follows in Sprint 4".
- cand-operations-06 LOW inaccurate: DEPLOY_ENVIRONMENTS "x9" routes, "true right now" beta-token failure.
- cand-operations-07 LOW inaccurate: DEPLOY_ENVIRONMENTS says the beta discord-worker has a shared D1 binding.
- cand-operations-08 LOW drift: executed 2026-09-15 rollout procedure has no status; migration 0015 not covered.
- cand-operations-09 LOW inaccurate: SECRET_ROTATION "Last updated August 21, 2026"; `docs/incidents/` does not exist.
- cand-operations-10 LOW inaccurate: DOMAIN_DEPRECATION stale line refs / pre-5.0 sequencing.
- cand-operations-11 LOW inaccurate: OPEN_ITEMS header date, "two scoped overrides", future tense for done work, KV-fallback log string.
- cand-operations-12 LOW spelling: 5 confirmed.

## Priors

- DOC-018 STILL_PRESENT (MODERATION.md:37,100 unchanged; no XIVAuth mention).
- DOC-019 PARTLY (OPEN_ITEMS.md:145-150 now credits the presets-api side but calls the moderation side future; it shipped in moderation-worker 1.8.0).

## Positive controls

- OPEN_ITEMS "delete the four repository copies" is still true: `gh api repos/FlashGalatine/xivdyetools/actions/secrets` lists DISCORD_TOKEN, MODERATION_DISCORD_TOKEN, BETA_DISCORD_TOKEN, BETA_DISCORD_GUILD_ID, CLOUDFLARE_ACCOUNT_ID.
- Branch protection text (OPEN_ITEMS:31-36) matches `gh api .../branches/main/protection`: linear history off, strict off, enforce_admins off, four required contexts incl. Secret scan.
- DEPLOY_ENVIRONMENTS bare-deploy table per worker matches every wrangler.toml (top-level names, workers_dev, routes under env.production, oauth no [env.production], og-worker routed beta).
- Beta/prod client ids, KV id, dataset names match wrangler.toml. Beta and prod workflow triggers, environments, tokens, cancel-in-progress match.
- SECRET_ROTATION inventory matches `env.X` reads in all worker sources (no unlisted secret).
- ANALYTICS_QUERIES column layouts and outcome classes match schema.ts and analytics.ts; both anchors resolve.
- IMAGE_WORKER_SPLIT wire contract, preview_urls pin, workers.dev guard match image-worker.
- Migration guidance uses `wrangler d1 execute --file` everywhere; no `migrations apply` advice.

## Rejected suspicions

- OPEN_ITEMS:36 "strict and enforce_admins stay off until the 2026-10-03 PRs are merged": state matches gh; whether the condition is now met is a maintainer decision.
- DEPLOY_ENVIRONMENTS "Problem"/"Evidence" present tense: the Status line frames it as a record and the 2026-08-12 update corrects og-worker.
- IMAGE_WORKER_SPLIT figures (bundle sizes, extractor.ts:45): historical measurements, Status line says design record.
- presets-api migration 0015 applied or not: cannot be established from the repo.

## Spelling per document

| Document | Confirmed | Words (line) |
|---|---|---|
| IMAGE_WORKER_SPLIT.md | 3 | behaviour (5), defence (181), rasterisation (198) |
| OPEN_ITEMS.md | 1 | behaviour (73) |
| ANALYTICS_QUERIES.md | 1 | unrecognised (74) |
| Total | 5 | dictionary found 3; 2 extra by hand (rasterisation, unrecognised) |
