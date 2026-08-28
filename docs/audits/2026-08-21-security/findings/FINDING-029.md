# FINDING-029: oauth `[env.preview]` binds production D1 + KV behind a stale frontend origin; `[env.development]` D1 id is a TODO placeholder

## Severity
**LOW** — dormant today (`auth-preview.xivdyetools.app` is NXDOMAIN), but the config is one `wrangler deploy --env preview` away from a second token issuer on production data whose allowed frontend (`v4-ui-migration.xiv-colorexplorer.pages.dev`) may no longer be under the project's control, and whose fail-closed gates key on `ENVIRONMENT === 'production'` and therefore fail open. Reviewer IDs: OAUTH-6, INF-6. Coordinator-verified in `wrangler.toml`.

## Category
CWE-1188 Insecure Default Initialization of Resource · configuration drift

## Location
- `apps/oauth/wrangler.toml:27-47` — `[env.preview]` shares `xivdyetools-users` D1 (`6e97b759…`) and `TOKEN_BLACKLIST` KV (`0d6f3be3…`) with production; `FRONTEND_URL` stale; `apps/oauth/src/constants/oauth.ts:34` adds that origin to the redirect allowlist.
- `apps/oauth/wrangler.toml:68` — `database_id = "TODO_RUN_WRANGLER_D1_CREATE"`.
- `apps/oauth/src/index.ts:44-65, 132-135` — production-only checks.

## Recommendation
Delete `[env.preview]` (or give it its own D1/KV and a current frontend), remove the stale origin from the allowlist, create the dev D1 or drop the env block, and make the env-validation gates apply to every non-`development` environment.

## References
- Evidence: `../evidence/review-oauth.md` (OAUTH-6), `../evidence/review-infra-stoat.md` (INF-6)

## Status
**FIXED 2026-08-21** (oauth 2.7.0)
- oauth 2.7.0: `[env.preview]` deleted from `wrangler.toml`; `ENVIRONMENT` must be `development` | `production` and every URL HTTPS outside `development` (500 fail-closed), HSTS on non-development; dev D1 placeholder annotated; docs (SECRET_ROTATION, DEPLOY_ENVIRONMENTS, projects/oauth/overview, README, CLAUDE) updated. Deploy note: delete any `xivdyetools-oauth-preview` worker / `auth-preview.xivdyetools.app` domain if one ever existed (DNS is NXDOMAIN today).
