# Review: ci-supply-chain (2026-10-03, commit 0ab33466)

Scope: .github/ (14 workflows + dependabot.yml), pnpm-workspace.yaml, .npmrc, root package.json, turbo.json, .gitleaks.toml, every apps/*/wrangler.toml, package publish config, scripts CI runs. No probe scripts written.

## 1. Entry points and authz matrix

| Workflow | Trigger | Who can start it | Guards before secrets | Token / secrets | Notes |
|---|---|---|---|---|---|
| ci.yml (audit, secret-scan, ci, e2e) | push main/master/*-prep, any pull_request, nightly cron | anyone who can open a PR (forks get no secrets, read-only token) | top `permissions: contents: read` (ci.yml:35); no pull_request_target / workflow_run anywhere | only GITHUB_TOKEN (gitleaks step ci.yml:101) | `audit` runs `pnpm audit --prod --audit-level high` (ci.yml:73); cron runs only `audit` (other jobs have `if: github.event_name != 'schedule'`) |
| deploy-{api,discord,image,moderation,oauth,og,presets}-worker.yml, deploy-web-app.yml (8 prod) | push main/master + path filter, workflow_dispatch | repo writers | `environment: production` -> live branch policy = main only (gh api below) | `secrets.CLOUDFLARE_API_TOKEN` (production-environment secret) step-scoped in wrangler-action `with:`; discord adds `DISCORD_TOKEN`, moderation `MODERATION_DISCORD_TOKEN` (repo secrets) | each re-runs type-check + test before deploy; `--env production` except oauth (bare deploy = prod by design) and web-app (`pages deploy`) |
| deploy-{discord-worker,og-worker,web-app}-beta.yml | push to any branch except main/master/dependabot/**, workflow_dispatch | repo writers (sole collaborator = owner) | `environment: beta` (no branch policy, no reviewers) | `CLOUDFLARE_API_TOKEN_BETA` (beta-environment secret); `BETA_DISCORD_TOKEN`/`BETA_DISCORD_GUILD_ID` repo secrets, step-scoped | guard step fails fast if the beta token is missing; job env holds only booleans |
| publish-packages.yml | workflow_dispatch (choice input) | repo writers | `environment: production` (main only) on `publish`; `id-token: write` only on that job (publish-packages.yml:104) | no npm token; OIDC + `--provenance` (:166) | `detect` job has no environment, read-only |
| sync-dye-emojis.yml | workflow_dispatch | repo writers | `environment: production` | `secrets.DISCORD_TOKEN` (repo scope) step-scoped :52 | rewrites main-bot application emojis |

Body/param caps: n/a (CI). Wrangler surface (reachability):

| Worker | Public hosts | workers_dev / preview | Secrets in [vars]? | Native rate limits |
|---|---|---|---|---|
| oauth (top level IS prod) | auth.xivdyetools.app, auth.*.projectgalatine.com (custom domains) | not set; routes present so off; `[env.development]` D1 id is placeholder `TODO_RUN_WRANGLER_D1_CREATE` (cannot deploy) | no (client ids public) | RL_AUTH_10/20/30 (wrangler.toml:25-37) |
| discord-worker | prod: bot.xivdyetools.app (+projectgalatine); beta (top level): workers.dev ON (:16), preview_urls unset | prod `workers_dev=false` (:116) | no | RL_5..RL_70 both envs |
| moderation-worker | moderation-bot.* (prod only) | top-level false (:17), prod inherits | no | RL_COMMAND / RL_AUTOCOMPLETE |
| presets-api | api.xivdyetools.app (+projectgalatine) | false (:16), prod inherits | no (zone id only) | RL_PUBLIC |
| api-worker | data./proxy./developers. (prod) | `workers_dev=false`, `preview_urls=false` (:18-19), test-guarded | no | API/TELEMETRY/SERVICE_RATE_LIMITER (new SERVICE bucket :64, prod :119) |
| og-worker | xivdyetools.app/<tool>/* routes + og.; beta twin on beta./og-beta. | false both (:27, :66) | no | none (documented earlier) |
| image-worker | none | false + preview_urls false, both envs (:24-25, :32-33) | no | none (binding-only) |

Delta since 0332fcc5: only the wrangler-action bump (SHA still pinned), api-worker SERVICE_RATE_LIMITER bucket, og-worker `/glamour/*` routes (both envs, symmetrical), devDependency bumps. No workflow logic changed.

### Live GitHub reads (gh api, GET only; the first seven are the brief's list, the rest are extra read-only GETs I added and flag here)

| Command (repos/FlashGalatine/xivdyetools/...) | Result |
|---|---|
| environments | 3 envs: `beta` (no protection rules, deployment_branch_policy null), `copilot` (created 2026-09-28, no rules), `production` (custom branch policy) |
| environments/production/deployment-branch-policies | exactly one policy: branch `main` |
| actions/permissions | enabled, allowed_actions `all`, sha_pinning_required `false` |
| actions/permissions/workflow | default_workflow_permissions `read`, can_approve_pull_request_reviews `false` |
| branches/main/protection | required checks: "Lint, Type-check, Test, Build", "Security audit (production dependencies)", "E2E (Playwright, chromium)"; strict false; enforce_admins false; no required_pull_request_reviews; signatures not required; force-push and deletion blocked |
| dependabot/alerts?state=open | 403 "Dependabot alerts are disabled for this repository" |
| code-scanning/alerts?state=open | 404 "no analysis found" (no CodeQL) |
| environments/beta/deployment-branch-policies | 404 (no policy) |
| actions/secrets (names only) | BETA_DISCORD_GUILD_ID, BETA_DISCORD_TOKEN, CLOUDFLARE_ACCOUNT_ID, DISCORD_TOKEN, MODERATION_DISCORD_TOKEN |
| environments/production/secrets, environments/beta/secrets (names only) | production: CLOUDFLARE_API_TOKEN; beta: CLOUDFLARE_API_TOKEN_BETA |
| repo (visibility, security_and_analysis); rulesets; collaborators | public repo; secret scanning + push protection enabled; dependabot_security_updates disabled; rulesets `[]`; sole collaborator = owner (admin) |

## 2. Positive controls

- All 56 `uses:` lines (6 distinct actions) are 40-hex SHA pinned with a version comment (`git grep uses:` minus the 40-hex filter returns only a dependabot.yml comment); dependabot github-actions ecosystem keeps them current (.github/dependabot.yml:30-38).
- `permissions: contents: read` at top of every workflow (ci.yml:35, publish-packages.yml:22, each deploy-*.yml); repo default token read-only and cannot approve PRs (gh api actions/permissions/workflow).
- `id-token: write` appears once, on the publish job only (publish-packages.yml:104); OIDC trusted publishing with `--provenance`, no NPM_TOKEN, `registry-url` deliberately omitted (publish-packages.yml:109-120); `.npmrc` carries no token.
- All 10 production-affecting jobs (8 deploys, publish, emoji sync) have `environment: production`, whose live policy is main-only; manual dispatch from another branch is blocked.
- Beta workflows (3) use `CLOUDFLARE_API_TOKEN_BETA` from the `beta` environment with a named guard step and no fallback (deploy-*-beta.yml `apiToken`); the production CF token lives only in the `production` environment (FINDING-028 holds, verified live). Beta deploys only bare `deploy` / `pages --branch=beta`, never `--env production`.
- Secrets are step-scoped; job-level env holds only boolean `HAS_*` (deploy-discord-worker-beta.yml:56-61). No `set -x`, no echo of secrets.
- No `pull_request_target`, no `workflow_run`, no privileged trigger touching PR head. `${{ }}` inside `run:` limited to `inputs.package` (choice type) and the wrangler-action `deployment-url` output.
- Gate jobs: `audit` is its own job, required on main, plus nightly cron (ci.yml:36-37, 61-79); gitleaks job pins scanner 8.30.1 with the repo config (ci.yml:90-130); tree + history scans clean this audit (evidence/gitleaks.md); GitHub secret scanning + push protection enabled.
- pnpm-workspace.yaml: `minimumReleaseAge: 1440`, `allowBuilds` all false (esbuild, msw, workerd), security-floor overrides (rollup, qs, seroval, vitepress>vite, tsup>esbuild); `pnpm install --frozen-lockfile` in every workflow; lockfile has no git/tarball/file resolutions (only workspace `link:`); `pnpm audit --prod`: 0 advisories (evidence/pnpm-audit-summary.txt).
- wrangler is a lockfile-pinned devDependency in all 8 deployable apps (^4.140.0), so wrangler-action does not fetch an unpinned CLI at deploy time.
- Publish config: 7 public packages with `files` allowlists; test-utils private; only `prepublishOnly` lifecycle scripts, no install-time hooks in any package.json.
- Wrangler: no secrets in `[vars]` (client ids, zone id, URLs only); secrets enumerated as comments; `.dev.vars*`, `.env*`, `.npmrc.local` gitignored (.gitignore:11-12, 28-31; `git check-ignore` confirmed); image-worker and api-worker pin `workers_dev`/`preview_urls`; routes explicit per env; native `[[ratelimits]]` on every public worker with per-env namespace ids.
- No D1 migration step in any workflow (grep); migrations stay user-run per the contributing guide.
- `.gitleaks.toml`: only `.test.ts` / `.spec.ts` / `__tests__/` path exemptions and three value-anchored regexes with `regexTarget = "match"`; the broad directory exemptions of 2026-08-29 FINDING-029 are gone.

## 3. Rejected

- `inputs.package` interpolated into run (publish-packages.yml:45-48): choice-typed input validated by GitHub on dispatch; dispatch needs write access; not injectable.
- `steps.deploy.outputs.deployment-url` in smoke-test args (deploy-web-app*.yml): produced by wrangler-action from Cloudflare's response, quoted; no attacker input.
- Cache poisoning via setup-node `cache: pnpm` / actions/cache (ci.yml e2e job): PR caches are ref-scoped, the pnpm store is integrity-hashed; publish restores only default-branch or own caches.
- Beta workflows run branch code on any push: only the owner can push; forks never get secrets on `push`. Fixed class (2026-08-29 FINDING-028); residual INF-06 unchanged.
- Beta bot workers.dev with unset `preview_urls` (apps/discord-worker/wrangler.toml:16): previously recorded residual g (Ed25519 verification makes it inert); unchanged, not re-filed.
- moderation/presets dev (top-level) envs bound to production D1/KV/R2: previously accepted (INF-13, DW-14); unreachable (workers_dev false, no routes); guard tests exist.
- oauth top-level production with no explicit `workers_dev`: routes with custom_domain make wrangler default it off; hardening only.
- `master` in push triggers: production env policy allows main only, so a master push cannot deploy.
- Dependabot `cooldown` absence, `persist-credentials` default on `ci`/`e2e` checkout, no CODEOWNERS, `--audit-level high`: recorded as 2026-08-29 INF-04/INF-06 residuals, no change.
- `register-commands` going global with an empty `DISCORD_GUILD_ID`: beta step is gated on non-empty secrets (`HAS_BETA_REGISTRATION_SECRETS` checks `!= ''`).
- `copilot` GitHub environment (created 2026-09-28): no workflow references it; Copilot agent branch pushes would match the beta triggers but its runs need maintainer approval by GitHub default (not verifiable via the allowed GETs). In handoffs.

## 4. Files covered

.github/workflows/{ci,deploy-api-worker,deploy-discord-worker,deploy-discord-worker-beta,deploy-image-worker,deploy-moderation-worker,deploy-oauth,deploy-og-worker,deploy-og-worker-beta,deploy-presets-api,deploy-web-app,deploy-web-app-beta,publish-packages,sync-dye-emojis}.yml; .github/dependabot.yml; pnpm-workspace.yaml; .npmrc; .gitleaks.toml; package.json; turbo.json (head); packages/*/package.json and apps/*/package.json (scripts and publish fields); apps/{oauth,discord-worker,api-worker,image-worker,moderation-worker,presets-api,og-worker}/wrangler.toml; apps/discord-worker/scripts/register-commands.ts; apps/discord-worker/scripts/upload-emojis.ts (token handling); scripts/ (listing + grep for network/secret use: only execFileSync in the two doc/dead-code gates); evidence/{wrangler-surface.txt,gitleaks.md,pnpm-audit-summary.txt}; prior reports 2026-09-15 SECURITY_AUDIT_REPORT.md and 2026-08-29 review-infra-stoat.md (dedupe); pnpm-lock.yaml (resolution-type grep only).

## 5. Candidates

| cid | sev | exposure | path:line | claim |
|---|---|---|---|---|
| c1 | LOW | LOCAL | .github/workflows/deploy-discord-worker.yml:85 | Production bot tokens `DISCORD_TOKEN` and `MODERATION_DISCORD_TOKEN` are repository-scope secrets, not production-environment secrets |
| c2 | LOW | LOCAL | .github/workflows/ci.yml:90 | main protection requires no PR/review, is not enforced on admins, and does not require the gitleaks job; a push to main is the production deploy |
| c3 | INFO | LOCAL | .github/workflows/ci.yml:73 | Repo settings: sha_pinning_required false, allowed_actions all, Dependabot alerts and security updates disabled, no code scanning; only `pnpm audit --prod --audit-level high` watches advisories |
| c4 | INFO | LOCAL | .gitleaks.toml:44-47 | `__tests__/` path exemption still hides 15 non-test files (mocks, fixtures, a JSON allowlist) from every gitleaks rule |

Evidence
- c1: `gh api .../actions/secrets` lists DISCORD_TOKEN and MODERATION_DISCORD_TOKEN at repo scope; `.../environments/production/secrets` lists only CLOUDFLARE_API_TOKEN. Used at deploy-discord-worker.yml:85 (`DISCORD_TOKEN: ${{ secrets.DISCORD_TOKEN }}`), deploy-moderation-worker.yml:78 (`${{ secrets.MODERATION_DISCORD_TOKEN }}`), sync-dye-emojis.yml:52. Trigger: a collaborator (or a compromised collaborator credential) pushes a branch containing a workflow that exfiltrates the secret; repo-scope secrets are available to every ref, unlike environment secrets gated by the main-only policy. Same class FINDING-028 fixed for the Cloudflare token. Fix: move both to the `production` environment. Policy NONE, case 0, rotation NONE (no exposure observed).
- c2: protection JSON above (no `required_pull_request_reviews`, `enforce_admins.enabled=false`, contexts omit "Secret scan (gitleaks)"); ci.yml:90 defines that job. Trigger: the sole owner pushes a secret-bearing commit straight to main; secret-scan runs but cannot block, deploy workflows fire in parallel. Mitigations: push protection enabled, solo maintainer. Fix: add the secret-scan context to required checks; optionally require PRs.
- c3: gh results above; ci.yml:73 is the only advisory gate (dev dependencies and moderate severity pass). Fix: enable `sha_pinning_required` and Dependabot alerts; consider an all-deps audit in the nightly job.
- c4: `git ls-files | grep __tests__/ | grep -v .test.ts` = 15 files (e.g. apps/web-app/src/__tests__/mocks/handlers.ts, apps/oauth/src/__tests__/mocks/cloudflare-test.ts, 5 .chara fixtures); tree and history scans are clean today, so latent only. Fix: narrow to `__tests__/.*\.test\.ts$`.

## 6. Handoffs

- docs: docs/operations/DEPLOY_ENVIRONMENTS.md / secret rotation runbook should state that DISCORD_TOKEN and MODERATION_DISCORD_TOKEN live at repo scope today (or reflect the move once c1 is fixed).
- ops: `copilot` GitHub environment (created 2026-09-28) has no matching workflow; confirm the Copilot agent is intended and that its non-main branches may trigger the three beta deploy workflows.
- plain bug (minor): oauth `[env.development]` D1 id is the placeholder `TODO_RUN_WRANGLER_D1_CREATE` (apps/oauth/wrangler.toml); a deploy to that env fails, harmless.
- discord-worker reviewer: the beta bot is reachable on workers.dev with `ENVIRONMENT=development` (apps/discord-worker/wrangler.toml:16); my grep found no dev-mode branch in discord-worker src that relaxes signature checks, but confirm.
- privacy reviewer: five `.chara` fixtures under packages/core/src/services/chara/__tests__/fixtures/ are exempt from gitleaks; confirm they hold no real TypeName/Nickname data.
