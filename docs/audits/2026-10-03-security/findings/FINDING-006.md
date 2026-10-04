# FINDING-006: oauth ALLOWED_REDIRECT_ORIGINS still trusts the retired https://xivdyetools.projectgalatine.com origin for the code/state bounce and for CORS
**Severity:** LOW · **Exposure:** INTERNET-UNAUTH · **Deploy unit:** oauth · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-183

## Location
- apps/oauth/src/constants/oauth.ts:17 — 'https://xivdyetools.projectgalatine.com' left in ALLOWED_REDIRECT_ORIGINS with the 'Transition period - remove after migration complete' TODO
- apps/oauth/src/handlers/oauth-flow.ts:95,150,278 + apps/oauth/src/index.ts:73 — getAllowedRedirectOrigins() feeds both validateRedirectUri (where the ?code&state bounce is sent) and the CORS origin check
- apps/oauth/wrangler.toml:8 — auth.xivdyetools.projectgalatine.com is still bound as a production custom domain

## Evidence
- oauth.ts:10-17: export const ALLOWED_REDIRECT_ORIGINS = [ 'https://xivdyetools.app', ... 'https://beta.xivdyetools.app', 'https://xivdyetools.projectgalatine.com', // Transition period - remove after migration complete
- docs/operations/DOMAIN_DEPRECATION.md Phase 1: 'Remove the xivdyetools.projectgalatine.com entry from apps/oauth/src/constants/oauth.ts:17' — 'Landable immediately; nothing reachable changes' and 'The allowlist entries are already dead in practice'. Status line: 'Phase 0 not yet run'
- apps/web-app/functions/_middleware.ts:17-21: the old apex is 301-redirected to xivdyetools.app, so no real browser ever presents this Origin. The entry only matters if someone else gains control of the domain, and in that case they would receive authorization codes from a login flow they start, using their own PKCE challenge

## Fix
- Remove 'https://xivdyetools.projectgalatine.com' from ALLOWED_REDIRECT_ORIGINS (DOMAIN_DEPRECATION Phase 1), together with the matching entry in presets-api's ADDITIONAL_CORS_ORIGINS, and update the docs that list it (apps/oauth/CLAUDE.md, docs/projects/oauth/*.md)
- Afterwards, carry out Phase 2: remove the auth.xivdyetools.projectgalatine.com route and its dashboard custom domain, then unregister the two old-domain redirect URIs on Discord app 1447108133020369048
- Add a test asserting that the production getAllowedRedirectOrigins() returns exactly the xivdyetools.app origins plus FRONTEND_URL

## Status
OPEN — code parts committed: presets-api CORS in `f1b54a0f` (PR #224); oauth allowlist in `d853a765` (branch `fix/security-2026-10-03-sprint6`, oauth 3.1.2; PR #228, open), with a test pinning the exact production allowlist. On 2026-10-04 the maintainer removed the `auth.xivdyetools.projectgalatine.com` custom domain (and the old apex's and `bot.`'s). Neither hostname resolves any more. Their route lines come out in `ee869d55` (PR #228) and `b0f01e24` (PR #227), so the next deploy cannot re-attach them. Remaining, maintainer-only: unregister the two old-domain redirect URIs on Discord app 1447108133020369048.
