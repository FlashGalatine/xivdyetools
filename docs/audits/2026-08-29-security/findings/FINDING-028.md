# FINDING-028: the beta deploy workflows run on any non-main branch push with the repository-scoped `CLOUDFLARE_API_TOKEN` and no `environment:` — an edited workflow on a branch can deploy `--env production` without the `production` gate
**Severity:** LOW · **Exposure:** LOCAL (needs push access) · **Deploy unit:** CI (`.github/workflows`) · **Rotation:** NONE · **CWE:** CWE-269 (improper privilege management)

## Location
- `.github/workflows/deploy-og-worker-beta.yml:18-32` (trigger: every branch except main/dependabot), `:46-47`, `:74-82` (`secrets.CLOUDFLARE_API_TOKEN`, no `environment:`); same shape in `deploy-discord-worker-beta.yml:13-29,43-53,76-83` and `deploy-web-app-beta.yml:19-32,46-47,89-94`

## Evidence
- 2026-08-21/FINDING-009 gated the *production workflows* on `environment: production` (deploy branches = `main`), but the credential itself is a repository secret readable by any workflow run, so the gate constrains YAML, not the token. Single-maintainer repo today; `docs/operations/POST_MERGE_CHECKLIST.md:62-65` (no required reviewers) and `:331-332` (main ruleset) remain open.

## Fix
- Give beta its own `beta` environment with its own, separate Cloudflare token (scoped to the beta Worker names / Pages project via the environment), and keep the production token only in the `production` environment.

## Status
PARTIAL — code FIXED 2026-08-31 (`ae9ef136`, `892f1b0e`, `2277ff35`, `febf54ce`, `1c8a5725`);
**OPEN until the maintainer creates the environment and token.**

The three beta workflows now declare `environment: beta` and authenticate with
`secrets.CLOUDFLARE_API_TOKEN_BETA`, with **no fallback** to the production credential — a
fallback would have left the beta job able to read it, which is the finding, silently and
probably forever. So beta deploys fail until the secret exists, by design, and a guard step fires
before checkout naming the missing secret and warning against reusing the production token
(wrangler's own error names `CLOUDFLARE_API_TOKEN`, the env var, which invites exactly that
"fix"). Verified live rather than predicted: the branch push fired
`deploy-discord-worker-beta.yml` (run `33365469624`), which failed in 54 s and skipped everything
downstream.

**Two corrections to the remediation as originally written**, both found in review: the documented
token scope omitted **Zone → Workers Routes: Edit on `xivdyetools.app`**, which og-worker's beta
worker needs (ten zone routes plus a custom domain, reconciled on every deploy) — so following it
would have produced two green beta deploys and one red; and "limited to the beta Worker names and
the beta Pages project" describes a control Cloudflare does not have (token policies scope to
User, Account or Zone only). The docs now state the real minimum and say plainly what the split
buys: **a separate, independently revocable credential that the production workflows do not use —
not a token incapable of touching production.**

**The deeper half is the maintainer's**, and is written up in `POST_MERGE_CHECKLIST.md` §0:
`CLOUDFLARE_API_TOKEN` is still a **repository** secret (verified live), so the
`environment: production` gate the 2026-08-21 audit added does not constrain the credential for
the other eight production workflows either. Homing it in the `production` environment — and
deleting the repository copy, which is the load-bearing half — is what makes both gates real.
Note GitHub has already auto-created an empty, unprotected `beta` environment (2026-08-31
06:45:16Z, one second after that first run), so the name will already be there.
