# FINDING-009: CI/CD hardening gaps — mutable action tags, no `permissions:` blocks, job-level secret env, production deploys dispatchable from any ref

## Severity
**MEDIUM** — supply-chain exposure of the credentials that deploy every production worker. The repo is **public**. Reviewer IDs: INF-1, INF-2, INF-3, INF-10. Coordinator-verified in the workflow files.

## Category
CWE-829 Inclusion of Functionality from Untrusted Control Sphere · CWE-250 Execution with Unnecessary Privileges · OWASP CI/CD-SEC-3/4

## Location
- All 13 workflows in `.github/workflows/` — every `uses:` is a mutable major tag: `actions/checkout@v7`, `actions/setup-node@v7`, `pnpm/action-setup@v5`, `cloudflare/wrangler-action@v4` (the last receives `CLOUDFLARE_API_TOKEN`; the discord-worker jobs also expose `DISCORD_TOKEN`/`BETA_DISCORD_TOKEN`). `.github/dependabot.yml` covers `github-actions` monthly but ignores `pnpm/action-setup` majors.
- 12 of 13 workflows have no top-level or job `permissions:` block (only `publish-packages.yml:91-93` scopes the publish job); `GITHUB_TOKEN` therefore runs at the repository default and `actions/checkout` persists it.
- `deploy-discord-worker-beta.yml:41-46` — `BETA_DISCORD_TOKEN` is declared at job-level `env:`, visible to every step including third-party actions (production `DISCORD_TOKEN` is correctly step-scoped in `deploy-discord-worker.yml:58-63`).
- All 8 production deploy workflows + `publish-packages.yml` have `workflow_dispatch` with no `environment:` protection, so a collaborator can deploy/publish from any branch ref (push-triggered deploys are correctly main-only; beta deploys cannot reach production).

## Description
A compromised or hijacked action tag (cf. the 2025 `tj-actions/changed-files` incident) would execute in a job holding the Cloudflare API token — full control of every worker, KV, D1 and R2 in the account — and could also use a write-capable `GITHUB_TOKEN`. SHA pinning and least-privilege token permissions are the standard mitigations (OpenSSF Scorecard "Pinned-Dependencies"/"Token-Permissions").

## Recommendation
1. Pin every `uses:` to a full commit SHA (keep the version as a trailing comment); let Dependabot bump the SHAs (remove the stale `pnpm/action-setup` ignore).
2. Add `permissions: contents: read` at the top of every workflow (publish job keeps `id-token: write`; add `pull-requests: write` only where needed).
3. Move `BETA_DISCORD_TOKEN` to step-level `env:` on the register-commands step only.
4. Put production deploy/publish jobs behind a GitHub `environment:` (`production`) with required reviewers/branch restriction (`main` only), so `workflow_dispatch` from an arbitrary ref cannot deploy.
5. Minor: `timeout-minutes` on deploy jobs; `persist-credentials: false` on checkout where the token is not needed.

## References
- OpenSSF Scorecard checks; GitHub "Security hardening for GitHub Actions"
- Evidence: `../evidence/review-infra-stoat.md` (INF-1, INF-2, INF-3, INF-10, INF-11, INF-16)
