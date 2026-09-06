# Design specs and implementation plans

**One spec/plan pair per feature**, written by the planning skills before the build. The spec
(`specs/`) is the agreed design; the plan (`plans/`) is the task list a worker executed. Both are
**frozen once the feature ships** — they record what was decided and why, not the current code.
Every plan carries a `**Status:**` line under its title.

For the investigation that preceded a decision, see [`../research/`](../research/index.md).

| Feature | Spec | Plan | Status |
|---------|------|------|--------|
| Beta web app deployment (`beta.xivdyetools.app`) | [spec](specs/2026-08-09-beta-web-app-deployment-design.md) | [plan](plans/2026-08-09-beta-web-app-deployment.md) | Shipped — second Pages project, `deploy-web-app-beta.yml`, `check-beta-build.js` |
| image-worker split out of discord-worker | — (design record: [`operations/IMAGE_WORKER_SPLIT.md`](../operations/IMAGE_WORKER_SPLIT.md)) | [plan](plans/2026-08-09-image-worker-split.md) | Shipped 2026-08-11 — `apps/image-worker` |
| Pages smoke test | [spec](specs/2026-08-10-pages-smoke-test-design.md) | [plan](plans/2026-08-10-pages-smoke-test.md) | Shipped — `apps/web-app/scripts/smoke-test-pages.js` |
| Audit CI additions | [spec](specs/2026-08-10-audit-ci-additions-design.md) | — | Superseded — the knip and dead-code gates landed through the 2026-09-01 guardrails plan below |
| Preset preview images | [spec](specs/2026-08-10-preset-glamour-thumbnails-design.md) | [plan](plans/2026-08-10-preset-preview-images.md) | Shipped — presets-api 2.0.0 (migration 0009, R2, image-worker `/thumbnail`) |
| Preset categories + preview-image editing | [spec](specs/2026-08-11-preset-categories-and-image-editing-design.md) | [plan](plans/2026-08-11-preset-categories-and-image-editing.md) | Shipped — presets-api 2.0.0 (migration 0010, 1 primary + ≤2 secondary categories) |
| Local presets (web-app 5.1) | [spec](specs/2026-08-16-local-presets-5-1-design.md) | [plan](plans/2026-08-16-local-presets-5-1.md) | **Parked** — not implemented; no `LocalPresetService` in the web app |
| Bot analytics, Tier A | [spec](specs/2026-08-29-bot-analytics-tier-a-design.md) | [plan](plans/2026-08-29-bot-analytics-tier-a.md) | Shipped — PR #150, `services/command-trace.ts` |
| Web analytics (Enable Analytics made real) | [spec](specs/2026-08-29-web-analytics-design.md) | [plan](plans/2026-08-29-web-analytics.md) | Shipped — PR #149, api-worker 0.9.0 `POST /v1/telemetry` |
| Dead-code guardrails | [spec](specs/2026-09-01-dead-code-guardrails-design.md) | [plan](plans/2026-09-01-dead-code-guardrails.md) | Shipped — PR #157, `knip.jsonc` + `scripts/check-dead-code.ts` |
| Selectable harmony colour wheels | [spec](specs/2026-09-04-harmony-color-wheels-design.md) | [plan](plans/2026-09-04-harmony-color-wheels.md) | Shipped 2026-09-05 — PR #167 (+ #168 docs restyle, #169 API endpoints) |

## Conventions

- File names are `YYYY-MM-DD-<slug>-design.md` (spec) and `YYYY-MM-DD-<slug>.md` (plan).
- When a feature ships, update the spec's `**Status:**` line, the plan's `**Status:**` line and
  this table in the same PR. Do not rewrite the body.
- Plans that are parked stay here with `Status: parked` so the next attempt starts from them.
