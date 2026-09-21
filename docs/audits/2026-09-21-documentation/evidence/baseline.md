# Baseline — what is currently served (checked 2026-09-21T03:29Z)

| Unit | Environment/channel | Served/published revision | Evidence + checked-at | Local (branch) | Verification limits |
|---|---|---|---|---|---|
| web-app | production (xivdyetools.app, CF Pages) | `59572c0` | deploy-web-app.yml last success on main, 2026-09-21T00:41:59Z | 5.12.3 (branch) / 5.12.2 (main) | revision from workflow run, not from a live asset fetch |
| discord-worker | production | `59572c0` | deploy-discord-worker.yml, 2026-09-21T00:41:59Z | 5.6.3 / 5.6.2 | same |
| og-worker | production | `59572c0` | deploy-og-worker.yml, 2026-09-21T00:41:59Z | 2.8.1 | same |
| api-worker | production (data.xivdyetools.app) | `59572c0` | deploy-api-worker.yml, 2026-09-21T00:41:59Z | 0.14.6 / 0.14.5 | same |
| moderation-worker | production | `59572c0` | deploy-moderation-worker.yml, 2026-09-21T00:41:59Z | 1.7.4 / 1.7.3 | same |
| image-worker | production (service-binding only) | `0fec18f` | deploy-image-worker.yml, 2026-09-18T12:47:33Z | 1.3.2 | path-filtered workflow — no deploy since its paths last changed; not drift |
| oauth | production | `0fec18f` | deploy-oauth.yml, 2026-09-18T12:47:33Z | 3.1.1 | same |
| presets-api | production | `0fec18f` | deploy-presets-api.yml, 2026-09-18T12:47:33Z | 2.3.6 | same |
| stoat-worker | parked | not deployed | units.md: "parked — no active investment" | 1.4.1 | source-only |
| 7 published packages | npm `latest` | see baseline-npm.txt | `npm view` 2026-09-21T03:29Z | all at parity except bot-logic | bot-logic local 4.4.1 vs npm 4.4.0 = this branch's unpublished bump |

**Branch relation:** `origin/main` = `59572c0` (2026-09-20, PR #195). This branch is **3 commits ahead, 0 behind** — the
three American-spelling commits. So the living docs are checked against main's code plus that spelling change; there is
no two-week drift to reason around.

**Caveat recorded:** the first `manual-check.mjs --ref origin/main` run of this audit used a **stale** `origin/main`
(`fb8c10e`, 2026-09-07) and reported 8 registered commands absent from the `/manual` overview. After `git fetch origin main`
the same check reports **none absent**. The stale-ref result is discarded; `evidence/manual-check-origin-main.txt` is the
post-fetch run. Fetch before trusting a `--ref origin/main` baseline.
