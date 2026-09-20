# Release mechanics (xivdyetools) — how each deploy unit ships

Read with `units.md`. Details age — confirm against `package.json`/`wrangler.toml`; the mechanics are the
stable part. Full context: `xivdyetools/CLAUDE.md` and `docs/operations/DEPLOY_ENVIRONMENTS.md`.

- **Publishing is Actions-only** (npm trusted publishing/OIDC; 2FA-required packages reject local
  `pnpm publish`). A bump is required — the workflow publishes only when local ≠ registry.
- **Version rule for removals/breaking changes:** compare `package.json` version with
  `npm view @xivdyetools/<pkg> version`. If the local version is **already unpublished**, fold the
  change into that version's `[Unreleased]`/pending CHANGELOG entry — no extra bump. If the local
  version **is published**, a public-export removal is MAJOR (bump major), an additive change MINOR.
- Consumers of package exports include every app in this repo *and* npm consumers — "unused in
  this repo" ≠ unused for a published package (`Semver Impact: MAJOR` in dead-code findings).
- Workflows live in `.github/workflows/deploy-*.yml` (prod on push to `main`; `*-beta.yml` on other
  branches). **Merging to `main` is the deploy** for every app — plan sprints so a merge ships a
  coherent unit.
- Exposure classes for security findings: web-app, og-worker, api-worker, oauth, presets-api,
  discord-worker, moderation-worker = **INTERNET** (auth/unauth per route); image-worker =
  **INTERNAL** (service binding); packages inherit the exposure of their consumers.
- Cross-unit changes (a package API used by several apps) are one sprint per *publish*, then one
  sprint per consumer deploy — never "bump core and redeploy everything" in a single sprint.
## Standing verification gate (every sprint boundary)

```bash
pnpm turbo run build type-check lint test --filter=<unit>     # unit and its dependents
pnpm turbo run build type-check lint test                      # whole graph before a merge
pnpm --filter xivdyetools-web-app run build:check              # bundle budget, web-app sprints
```
Publishable package touched → version decision per the rule above; locale text touched →
re-run `scripts/subset-cjk-fonts.py` in og-worker/discord-worker and their `font-coverage.test.ts`.
