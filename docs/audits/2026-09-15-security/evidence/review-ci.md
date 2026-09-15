# CI and supply-chain review — 2026-09-15

## Surface / authority

- Reviewed all 14 tracked workflow files via `git grep -n` for actions, permissions, secrets, environments, trigger branches, conditionals and commands; read CI, publish, production deploy and beta guard sections. Also reviewed `.gitleaks.toml`, `pnpm-workspace.yaml`, `.gitignore` checks and every worker's collected route/binding surface.
- Production deployment jobs and npm publish run in the `production` GitHub environment. Read-only GitHub API checks succeeded: custom deployment branch policy contains only `main`. Evidence: `github-production-environment.json`, `github-production-branches.json`; commands were `gh api repos/FlashGalatine/xivdyetools/environments/production` and the `/deployment-branch-policies` child endpoint.

## Positive controls

- Referenced actions are pinned to full commit SHAs; default token permission is `contents: read`. npm publication uses job-scoped `id-token: write` and OIDC; no npm token is referenced.
- CI includes a production dependency audit on push/PR and nightly schedule, and Gitleaks 8.30.1 on event commits. Secret scanning uses the project allowlist config; test-shaped fixtures/public IDs are intentionally excluded.
- Beta workflows use the separate beta environment/token and check availability without echoing secrets; production workflows use production credentials. Deploys are serialized, time-bounded, and run tests/builds. No `pull_request_target` or untrusted PR title/body interpolation found in shell steps.
- Dependency install scripts require explicit policy; configured `allowBuilds` rejects esbuild/msw/workerd postinstalls. A 1,440-minute release-age window and security overrides are configured. Production dependency audit returned zero known advisories across 27 dependencies.
- `.dev.vars` and suffix variants are ignored. Checked tracked Wrangler variables contain public configuration rather than credential values. D1 migrations remain explicitly runbook-managed rather than silently automated by deployment.

## Rejected / unverified

- Manual `workflow_dispatch` bypass of a source branch filter is not an open production-deploy issue: live environment policy permits only `main`. This check establishes the current policy, not immutability of administrator settings.
- Public client IDs, KV/D1 namespace IDs, routes and the Cloudflare account identifier are not bearer credentials. Their presence in tracked config is not a credential leak.
- Gitleaks binary unavailable locally: tree/history JSON artifacts record BLOCKED, not zero findings. CI configuration is not evidence that this local checkout/history was freshly scanned. Manual pattern review is narrower.
- Cloudflare WAF rules, token scopes, active deployments, database contents/migrations and log retention were not inspected. No assertion that source configuration exactly matches every live Worker.

No source changes, commits, pushes, secrets writes or deployments were made.
