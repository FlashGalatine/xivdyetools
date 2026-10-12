# Served baseline — collected 2026-10-11 (2026-10-11T04:26:00Z)

Checkout: branch claude/documentation-audit-787779 @ 42c35e87 == origin/main after git fetch (clean).
HEAD vs served 16a6123f:  1 file changed, 27 insertions(+), 101 deletions(-) — CHANGELOG-laymans.md (root) only; no deploy workflow's paths: include it and no app bundles it (discord-worker bundles apps/discord-worker/CHANGELOG-laymans.md).

## Apps — headSha of the last successful deploy-<app>.yml run on main

| Unit | Environment | Served revision | Evidence + checked-at | Local version | Limits |
|---|---|---|---|---|---|
| api-worker | production | 16a6123f | gh run list deploy-api-worker.yml success, run 2026-10-09T14:07:38Z; checked 04:26Z | 0.18.0 | inferred from the deploy run, not from a live version stamp (see baseline-live.txt) |
| discord-worker | production | 16a6123f | gh run list deploy-discord-worker.yml success, run 2026-10-09T14:07:38Z; checked 04:26Z | 5.8.11 | inferred from the deploy run, not from a live version stamp (see baseline-live.txt) |
| image-worker | production | 16a6123f | gh run list deploy-image-worker.yml success, run 2026-10-09T14:07:38Z; checked 04:26Z | 1.3.4 | inferred from the deploy run, not from a live version stamp (see baseline-live.txt) |
| moderation-worker | production | 16a6123f | gh run list deploy-moderation-worker.yml success, run 2026-10-09T14:07:38Z; checked 04:26Z | 1.8.2 | inferred from the deploy run, not from a live version stamp (see baseline-live.txt) |
| oauth | production | 16a6123f | gh run list deploy-oauth.yml success, run 2026-10-09T14:07:38Z; checked 04:26Z | 3.1.3 | inferred from the deploy run, not from a live version stamp (see baseline-live.txt) |
| og-worker | production | 16a6123f | gh run list deploy-og-worker.yml success, run 2026-10-09T14:07:38Z; checked 04:26Z | 2.12.0 | inferred from the deploy run, not from a live version stamp (see baseline-live.txt) |
| presets-api | production | 16a6123f | gh run list deploy-presets-api.yml success, run 2026-10-09T14:07:38Z; checked 04:26Z | 2.6.1 | inferred from the deploy run, not from a live version stamp (see baseline-live.txt) |
| web-app | production | 16a6123f | gh run list deploy-web-app.yml success, run 2026-10-09T14:07:38Z; checked 04:26Z | 5.15.0 | inferred from the deploy run, not from a live version stamp (see baseline-live.txt) |
| stoat-worker | parked (Node, no deploy workflow) | — | no deploy workflow exists | 0.3.3 | source-only |

## Packages — npm dist-tags.latest vs local

| Package | npm latest | local | Parity |
|---|---|---|---|
| @xivdyetools/types | 3.3.0 | 3.3.0 | yes |
| @xivdyetools/logger | 2.3.0 | 2.3.0 | yes |
| @xivdyetools/auth | 2.0.2 | 2.0.2 | yes |
| @xivdyetools/worker-kit | 1.5.0 | 1.5.0 | yes |
| @xivdyetools/core | 5.10.0 | 5.10.0 | yes |
| @xivdyetools/svg | 4.4.0 | 4.4.0 | yes |
| @xivdyetools/bot-logic | 4.8.3 | 4.8.3 | yes |
| @xivdyetools/test-utils | (private, unpublished) | 3.0.0 | n/a |
