# FINDING-028: the beta deploy workflows run on any non-main branch push with the repository-scoped `CLOUDFLARE_API_TOKEN` and no `environment:` — an edited workflow on a branch can deploy `--env production` without the `production` gate
**Severity:** LOW · **Exposure:** LOCAL (needs push access) · **Deploy unit:** CI (`.github/workflows`) · **Rotation:** NONE · **CWE:** CWE-269 (improper privilege management)

## Location
- `.github/workflows/deploy-og-worker-beta.yml:18-32` (trigger: every branch except main/dependabot), `:46-47`, `:74-82` (`secrets.CLOUDFLARE_API_TOKEN`, no `environment:`); same shape in `deploy-discord-worker-beta.yml:13-29,43-53,76-83` and `deploy-web-app-beta.yml:19-32,46-47,89-94`

## Evidence
- 2026-08-21/FINDING-009 gated the *production workflows* on `environment: production` (deploy branches = `main`), but the credential itself is a repository secret readable by any workflow run, so the gate constrains YAML, not the token. Single-maintainer repo today; `docs/operations/POST_MERGE_CHECKLIST.md:62-65` (no required reviewers) and `:331-332` (main ruleset) remain open.

## Fix
- Give beta its own `beta` environment with its own, separate Cloudflare token (scoped to the beta Worker names / Pages project via the environment), and keep the production token only in the `production` environment.

## Status
OPEN
