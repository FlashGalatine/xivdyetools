# Review: ci-supply-chain (CI + repo settings) — 2026-10-26

Reviewer key `ci-supply-chain`. Checkout HEAD `13c386e5`, compared with the 2026-10-03 base `0ab33466`.
Read-only. No deploy, publish, wrangler-remote or mutating command was run. Every `gh` call was a GET.

## Workflow table

| Workflow | Trigger | Job `environment:` | Secrets read (step-scoped) | Notes |
|---|---|---|---|---|
| ci.yml | push main/master/`*-prep`, pull_request, schedule 11:17 | none | `GITHUB_TOKEN` (gitleaks step only) | `contents: read`; audit job: `--prod --audit-level high` blocks, full-tree `--audit-level moderate` is `continue-on-error` (:94-96) |
| deploy-{api,discord,image,moderation,og,presets-api,web-app}.yml, deploy-oauth.yml (8) | push main/master + paths, workflow_dispatch | `production` | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`; discord: `DISCORD_TOKEN` (:94); moderation: `MODERATION_DISCORD_TOKEN` (:87) | `contents: read`; `production` env is main-only |
| deploy-{discord-worker,og-worker,web-app}-beta.yml (3) | push to any branch except main/master/`dependabot/**` + paths, workflow_dispatch | `beta` (deploy job) | `CLOUDFLARE_API_TOKEN_BETA`, `CLOUDFLARE_ACCOUNT_ID`, `BETA_DISCORD_TOKEN`, `BETA_DISCORD_GUILD_ID` | `changes` guard job; no branch policy on `beta` (by design) |
| publish-packages.yml | workflow_dispatch (choice input) | `production` (publish job) | none — OIDC (`id-token: write`, job level :102-104) | `--provenance`; `detect` job has no secrets |
| sync-dye-emojis.yml | workflow_dispatch | `production` | `DISCORD_TOKEN` (:53) | writes Discord app emojis + uploads `emoji-mapping.json` artifact; repo write: none |

Authz matrix (who can reach which credential):

| Actor | production secrets (env) | beta secrets (env) | repository-scope secrets | OIDC npm publish |
|---|---|---|---|---|
| Fork PR (public repo) | no | no | no (pull_request from fork gets none; first-time contributors need approval) | no |
| Dependabot PR | no | no (`dependabot/**` ignored by beta) | no (Dependabot secrets: none) | no |
| Writer push to a feature branch | no (main-only policy) | yes (no branch policy) | **yes** — `DISCORD_TOKEN`, `MODERATION_DISCORD_TOKEN`, `BETA_*` still at repo scope (candidate 01) | no |
| Merge to main | yes | n/a | yes | dispatch only |

Only collaborator: FlashGalatine (admin). No deploy keys. No direct (non-merge) first-parent commits on main since `0ab33466` (`git log --first-parent --no-merges 0ab33466..13c386e5` is empty; 103 merges).

## Candidates

### ci-supply-chain-01 — FINDING-023 still open: production bot tokens remain repository-scope secrets (LOW, LOCAL)
- `gh api repos/FlashGalatine/xivdyetools/actions/secrets` → `BETA_DISCORD_GUILD_ID, BETA_DISCORD_TOKEN, CLOUDFLARE_ACCOUNT_ID, DISCORD_TOKEN (updated 2026-05-26), MODERATION_DISCORD_TOKEN (2026-08-29)`. Environment copies exist (`production`: DISCORD_TOKEN updated 2026-10-05, MODERATION_DISCORD_TOKEN 2026-10-04).
- The stated precondition for deleting the copies (docs/operations/OPEN_ITEMS.md:44-48; 2026-10-03 FINDING-023 Status) is met: PRs #225/#227/#233 merged 2026-10-05; deploy-discord-worker.yml and deploy-moderation-worker.yml ran green on main repeatedly, latest 2026-10-26 20:54Z.
- Docs claim the opposite state: docs/operations/SECRET_ROTATION.md:64 and DEPLOY_ENVIRONMENTS.md:121-124 say no repository-level copy is left.
- Reach: any workflow run that does not declare `environment:` (e.g. a workflow edited on a pushed feature branch) can read the repo copies; only writers can push (one admin). Whether the 2026-05-26 repo `DISCORD_TOKEN` value is still valid (the env copy was updated 2026-10-05) cannot be confirmed from GitHub.
- Fix: delete the four repository copies (Settings → Secrets → Actions), tick OPEN_ITEMS.md. Rotation only if a branch run ever read them.

### ci-supply-chain-02 — `vitepress>vite` override admits vulnerable vite 6.4.3; 5 Dependabot alerts (1 HIGH) open (LOW, LOCAL)
- pnpm-workspace.yaml:26 `'vitepress>vite': '>=6.4.3 <7'`; pnpm-lock.yaml:3839 `vite@6.4.3:` (the only 6.x). Patched 6.4.4 was published 2026-10-06T05:49Z (`npm view vite time`), 6.4.5 on 2026-10-21 — both outside the 24 h `minimumReleaseAge`, so the floor, not the release-age window, keeps the lockfile on 6.4.3. Comment :25 ("Drop this when vitepress ships on Vite >= 6.4.3") is stale.
- `gh api .../dependabot/alerts?state=open`: #13 GHSA-698v-4r3x-3vcv (medium), #14 GHSA-587h-7wmj-h5pm (**high**), #15 GHSA-r825-w8mm-5pxw (medium), #16 GHSA-rq7h-c2jc-7f22 (medium), #17 GHSA-9jrq-w75r-8gcw (low); first opened 2026-10-20. Dependabot's PR #323 (vite → 8.3.4) was closed 2026-10-20, so automated security fixes cannot resolve it.
- Reach: dev server only. `apps/api-worker/package.json:12` `"docs:dev": "vitepress dev docs"` (devDependency :32). vite 6.4.3 registers `/__open-in-editor` unconditionally (node_modules/.pnpm/vite@6.4.3_*/node_modules/vite/dist/node/chunks/dep-Dm0c1Wj2.js:38838). Three of the advisories are launch-editor issues on Windows, which is the maintainer's platform. The deployed docs are static output; production workers do not include vite.
- Detection gap: the nightly `ci.yml` run 40368523212 (2026-10-26) logged `6 vulnerabilities found` in the report-only step and still concluded `success` (ci.yml:94-96 `continue-on-error: true`).
- Fix: `'vitepress>vite': '>=6.4.5 <7'` (or `>=6.4.4`), `pnpm install`, then confirm that `pnpm audit` is clean and the 5 alerts auto-close.

### ci-supply-chain-03 — publish job exposes the OIDC token request to install/build/test steps (INFO, LOCAL)
- publish-packages.yml:102-104 grants `id-token: write` to the whole `publish` job, which also runs `pnpm install` (:123), `turbo run build` (:125-133) and `turbo run test` (:135-143). With `id-token: write`, the runner gives every step `ACTIONS_ID_TOKEN_REQUEST_URL`/`_TOKEN`, so dev-tree code executed during build/test (vitest, tsx, turbo, test files) could mint the npm trusted-publishing token for this workflow + `production` environment.
- Mitigations already present: `allowBuilds` blocks install scripts, `minimumReleaseAge: 1440`, `--frozen-lockfile`, manual dispatch, main-only environment.
- Hardening: build + test + `pnpm pack` in a job without `id-token`, then publish the tarballs in a minimal job that runs no repo code.

### ci-supply-chain-04 — secret scanning non-provider patterns and validity checks off (INFO, LOCAL)
- `gh api repos/FlashGalatine/xivdyetools --jq .security_and_analysis` → `secret_scanning_non_provider_patterns: disabled`, `secret_scanning_validity_checks: disabled` (secret scanning + push protection enabled). Generic high-entropy secrets (HMAC/JWT secrets, e.g. `BOT_SIGNING_SECRET`-style values) rely on gitleaks alone, which scans only the event's commits.
- Fix: enable both (free on public repositories).

## POSITIVE controls

- All 69 `uses:` lines are pinned to 40-hex SHAs (7 distinct actions); `actions/permissions` → `sha_pinning_required: true`.
- Every workflow declares top-level `permissions: contents: read`; `default_workflow_permissions: read`, `can_approve_pull_request_reviews: false`. Only publish-packages adds `id-token: write`, at job level.
- No `pull_request_target`, `workflow_run`, or `github.event.*` / `head_ref` interpolation into `run:`. publish-packages interpolates `inputs.package` (a `choice` input, validated by GitHub, writer-only) at :45-48. deploy-web-app-beta.yml:201 interpolates `steps.deploy.outputs.deployment-url` (a Cloudflare-produced URL).
- OIDC trusted publishing: no NPM token anywhere (`.npmrc` has comments only; `registry-url` deliberately omitted :110-118). All 7 published packages have SLSA provenance at their current versions, and those versions match local (types 3.3.0, logger 2.3.0, auth 2.0.2, worker-kit 1.5.0, core 5.15.0, svg 4.4.0, bot-logic 4.11.0).
- `production` environment: custom branch policy `main` only. 8 deploys, publish, and sync-dye-emojis all bind to it. `CLOUDFLARE_API_TOKEN` exists only as a `production` env secret; `CLOUDFLARE_API_TOKEN_BETA` exists only on `beta`. The beta workflows guard by name against a missing beta token and never pass `--env production`.
- Secrets are step-scoped (`apiToken:` / step `env:`); the beta job exposes only booleans at job scope. Bot scripts never print the token (apps/discord-worker/scripts/register-commands.ts:82-94, upload-emojis.ts:102-174 log status + Discord error body only).
- No D1 migration step in any workflow (hand-run per contributing.md), and no `wrangler secret`, `kv` or `d1` commands in CI.
- Branch protection on main requires 4 checks, including `Secret scan (gitleaks)` and `Security audit (production dependencies)`; force-push and deletion are blocked. Private vulnerability reporting is now enabled (it was off on 2026-10-04). Dependabot alerts and security updates are on. Secret scanning and push protection are on, with 0 open secret-scanning alerts.
- gitleaks pinned to 8.30.1 with `persist-credentials: false`; `.gitleaks.toml` unchanged since 0ab33466.
- pnpm policy: `allowBuilds` rejects esbuild/msw/workerd (the only install-script packages in node_modules; sharp 0.35.5 has none); `.modules.yaml` `pendingBuilds: []`; `minimumReleaseAge: 1440`, no standing exclusion; all 717 lockfile resolutions are registry sha512 integrity hashes, with no tarball or git sources.
- Overrides in effect: `miniflare>undici >=7.29.1` (2026-10-03 FINDING-025 resolved: full-tree audit lists only vite), `seroval >=1.6.3`, `source-map-js >=1.2.2`, `rollup >=4.59.0`, `tsup>esbuild >=0.28.1`. `pnpm audit --prod`: no known vulnerabilities (evidence/pnpm-audit-summary.txt).
- New since 0ab33466: 6 package names (`xivcharakit`, `@msw/url`, `@dual-bundle/import-meta-resolve`, `@types/debug`, `@types/ms`, `get-east-asian-width`) plus platform binaries. `xivcharakit@0.1.0-beta.4` is exact-pinned (packages/core/package.json:78), has no scripts and no dependencies, is published by the same maintainer with an SLSA provenance attestation, and its npm integrity equals pnpm-lock.yaml:4049. It was published 2026-10-25T11:31Z, more than 24 h before merge #327 (2026-10-26T20:09Z).
- `workers:check-logs` passes for all 7 wrangler.toml (run locally). The gate fails on any `enabled = true`, `logpush = true`, or tail consumers.
- Workflow invariants self-test (scripts/check-workflows.test.ts) pins the beta guard shape, path filters, and ci.yml concurrency.
- Repo GitHub→bot webhook has a secret set; Dependabot has no secrets; fork PRs from first-time contributors need approval.

## REJECTED

- `strict: false` / `enforce_admins: false` on main — carried, deliberately deferred 2026-10-03 FINDING-024; no direct pushes to main since 0ab33466.
- Code scanning `not-configured` — the optional remainder of 2026-10-03 FINDING-030; unchanged.
- The beta token has the same Cloudflare grants as production, and `beta` has no branch policy — documented and accepted (SECRET_ROTATION.md:156, :169; DEPLOY_ENVIRONMENTS.md:89). The 2026-10-03 report rejected "CI secret separation has no automated guard".
- `ci`/`e2e`/deploy checkouts persist GITHUB_TOKEN — it is `contents: read` on a public repo, and the uploaded artifacts (playwright-report, emoji-mapping.json) exclude `.git`.
- actions/cache / setup-node pnpm cache poisoning from fork PRs — PR-run caches are scoped to `refs/pull/N/merge` and are not restored on main.
- `copilot` environment (created 2026-09-28) — it has no secrets or variables; there are no copilot branches or runs.
- Discord push webhook config — it is admin-visible repo configuration and not in the tree. Its URL embeds a webhook token, which is redacted here.
- Deploys do not `needs:` CI — merges require the 4 checks and main has no direct pushes (same as the FINDING-024 rationale).

## gh commands run (all GET)

```
gh api repos/FlashGalatine/xivdyetools/{environments,actions/secrets,actions/variables,environments/production/secrets,environments/beta/secrets,actions/permissions,actions/permissions/workflow,branches/main/protection,rulesets,automated-security-fixes,private-vulnerability-reporting,code-scanning/default-setup}
gh api repos/FlashGalatine/xivdyetools/{environments/production/deployment-branch-policies,environments/copilot/secrets,environments/copilot/variables,vulnerability-alerts,"dependabot/alerts?state=open",secret-scanning/alerts?state=open,collaborators,actions/permissions/fork-pr-contributor-approval,actions/permissions/access,actions/permissions/artifact-and-log-retention,hooks,keys,installations}
gh api repos/FlashGalatine/xivdyetools --jq .security_and_analysis,.visibility,.allow_forking,.default_branch
gh api "repos/FlashGalatine/xivdyetools/code-scanning/analyses?per_page=1"   (404 no analysis)
gh api repos/FlashGalatine/xivdyetools/dependabot/secrets
gh api "repos/FlashGalatine/xivdyetools/deployments?environment=production&per_page=5"
gh api "repos/FlashGalatine/xivdyetools/branches?per_page=100" --paginate
gh pr list --author app/dependabot --state all -L 5
gh pr view {225,227,233} --json number,state,mergedAt
gh run list -w {deploy-discord-worker.yml,deploy-moderation-worker.yml,sync-dye-emojis.yml} -L 3
gh run list -w ci.yml --event schedule -L 5 ; gh run view 40368523212 --log (grep vulnerabilit)
gh run list -L 200 (filter copilot branches)
```
Also: `npm view vite time`, `npm view xivcharakit@0.1.0-beta.4`, and `npm view @xivdyetools/<7 pkgs>` (read-only registry metadata), plus a local `pnpm workers:check-logs`.

## FILES COVERED (31)

- `.github/workflows/` — all 14 workflows; `.github/dependabot.yml`
- `scripts/` — check-worker-logs.ts, check-workflows.test.ts
- `apps/discord-worker/scripts/` — register-commands.ts, upload-emojis.ts; `apps/moderation-worker/scripts/register-commands.ts`
- Root — pnpm-workspace.yaml, package.json, .npmrc, pnpm-lock.yaml (diff vs 0ab33466), .gitleaks.toml (diff only)
- `packages/core/package.json`, `apps/api-worker/package.json`, all workspace package.json files (lifecycle-script grep)
- `docs/operations/` — DEPLOY_ENVIRONMENTS.md, SECRET_ROTATION.md, OPEN_ITEMS.md (secret sections)
- `docs/audits/2026-10-03-security/` — report sections, FINDING-023/024/030, evidence/gh-settings-2026-10-04.txt
