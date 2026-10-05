# Review: contract-oauth-origin (#228 oauth origin/route removal, #227 bot. route removal)

Branch preview/integration-2026-10-04 @80262a2f. Read-only review.

## Map: flow and deploy states

| Surface | State on the preview branch | Evidence |
|---|---|---|
| oauth redirect allowlist | Only xivdyetools.app, beta.xivdyetools.app, 4 localhost origins. Retired apex gone (#228). | apps/oauth/src/constants/oauth.ts:14-26; test oauth-constants.test.ts:52 |
| oauth route | `auth.xivdyetools.app` only (top-level block IS production) | apps/oauth/wrangler.toml:9-11; pinned by oauth wrangler-config.test.ts:66-69 |
| discord-worker prod route | `bot.xivdyetools.app` only (#227) | apps/discord-worker/wrangler.toml:129-131; test wrangler-config.test.ts:77-83 |
| web-app callers | oauth/presets/community URLs all default to .app; CSP `connect-src https://*.xivdyetools.app` | auth-service.ts:57,62; preset-submission-service.ts:121; public/_headers:31 |
| presets-api CORS | exactly pages.dev + beta.xivdyetools.app (+CORS_ORIGIN), pinned | apps/presets-api/wrangler.toml:75; tests/wrangler-config.test.ts:101-109 |
| presets-api JWT_ISSUER | https://auth.xivdyetools.app | apps/presets-api/wrangler.toml:75 |
| Retired-domain route still listed: api-worker | `proxy.xivdyetools.projectgalatine.com` | apps/api-worker/wrangler.toml:110 (under [env.production]) |
| Retired-domain route still listed: presets-api | `api.xivdyetools.projectgalatine.com` | apps/presets-api/wrangler.toml:72 |
| Retired-domain route still listed: moderation-worker | `moderation-bot.xivdyetools.projectgalatine.com` | apps/moderation-worker/wrangler.toml:72 |
| Web-app apex redirect (Phase 4) | still present, dead traffic | apps/web-app/functions/_middleware.ts:17 |

Deploy mechanics: deploy-moderation-worker.yml, deploy-presets-api.yml and deploy-api-worker.yml run on push to main (path-filtered) and run `wrangler deploy --env production` (`command:` lines 64, 60, 68). `custom_domain = true` makes wrangler (re)attach every listed hostname on each deploy (DOMAIN_DEPRECATION.md Progress 2026-10-04 documents this for bot. at the 2026-10-04 discord-worker deploy).

Deploy state of the three leads (per docs/operations/DOMAIN_DEPRECATION.md):
- The runbook records only auth., bot. and the old apex as removed in the dashboard (Status lines 3-6, Progress section). moderation-bot., api. and proxy. are recorded as still attached.
- So the next production deploy of each is a no-op re-assert of a still-attached domain. It does NOT re-attach a retired one and does not fail, PROVIDED the dashboard still has them. This was not verified (no dashboard access); it is the one fact to confirm.
- If the maintainer has also removed these three in the dashboard (the task text says "the subdomain" was removed), the next deploy re-creates the DNS record and custom domain on the projectgalatine.com zone (same failure mode the runbook describes for bot./auth.), or fails the whole deploy if the zone is not in the account.
- Scheduling: Phase 2 for moderation-bot. and api. has no date and no owner; Phase 3 (proxy.) is gated on a "public notice window" and Phase 0 check 4 (traffic), which is recorded as "Not yet gathered" (DOMAIN_DEPRECATION.md Phase 0 results, row 4). Nothing in the runbook schedules any of the three.

## Candidates

### contract-oauth-origin-01 | BUG (operational) | MEDIUM | origin MAIN
- File: apps/api-worker/wrangler.toml:110, apps/presets-api/wrangler.toml:72, apps/moderation-worker/wrangler.toml:72
- Claim: three production workers still declare a retired-subdomain custom domain, with no scheduled removal; the order "dashboard removal first, route line second" the runbook used for bot./auth. caused a re-attach race that is documented, and the same trap is armed for these three (any push-to-main deploy of these apps, or of packages/** they depend on, re-attaches).
- Failing state: maintainer removes `api.`/`moderation-bot.`/`proxy.xivdyetools.projectgalatine.com` in the dashboard, then any merge touching apps/presets-api, apps/moderation-worker, apps/api-worker or the shared packages triggers the deploy workflow, which re-adds the hostname (or fails the deploy if the zone is gone).
- Outcome: retired hostname resurrected, or a blocked production deploy. proxy. is the only one with external (third-party) consumers (DOMAIN_DEPRECATION.md Phase 3).
- Tests miss it: no test can see dashboard state; moderation-worker's test requires the route to stay (see -02). Covered by a test: no.
- Excerpt: `{ pattern = "proxy.xivdyetools.projectgalatine.com", custom_domain = true },` (api-worker/wrangler.toml:110)
- Fix direction: do not remove the dashboard domain before the route-line PR merges for these three; schedule Phase 2 (moderation-bot., api.) as one PR per worker that deletes the route line, flips the test, and updates the CLAUDE.md "Custom domains" line, then removes the dashboard domain after the deploy. Record Phase 0 check 4 traffic for proxy. before Phase 3. Confirm in the dashboard now which of the three are still attached.

### contract-oauth-origin-02 | UNTESTED | LOW | origin MAIN
- File: apps/moderation-worker/tests/wrangler-config.test.ts:96-101
- Claim: the test affirmatively requires the retired `moderation-bot.xivdyetools.projectgalatine.com` route and `custom_domain` count of 2, so it fails the moment the route is retired, whereas discord-worker's and oauth's equivalents were converted to "only .app" assertions (discord-worker tests/wrangler-config.test.ts:77-83, oauth wrangler-config.test.ts:66-69). presets-api and api-worker have no pin either way, so a re-added or removed projectgalatine route there is not caught.
- Failing state: removing the moderation route line goes red; adding a projectgalatine route to presets-api/api-worker stays green.
- Tests: covered yes (inverted for moderation), no for presets-api/api-worker.
- Fix direction: when each retirement lands, assert the exact pattern list per worker (as oauth does) so a reappearing line fails.

### contract-oauth-origin-03 | REFACTOR (docs) | LOW | origin MAIN/PR-#227/#228
- Files: docs/operations/OPEN_ITEMS.md:91-92, docs/operations/DOMAIN_DEPRECATION.md:75-80 (inventory), docs/operations/DEPLOY_ENVIRONMENTS.md:192,200-207, apps/api-worker/CLAUDE.md:143 and README.md:197, apps/{moderation-worker,presets-api}/CLAUDE.md custom-domains lines.
- Claim: stale statements. OPEN_ITEMS.md still says "[ ] Start DOMAIN_DEPRECATION Phase 0" although Phase 0 results are recorded and Phase 2 is partly done; the inventory table gives wrangler line numbers 64/62/75 for routes now at 72/72/110 (the doc itself says "current as of 2026-09-05"); DEPLOY_ENVIRONMENTS.md:192 and :200 still show the `bot.xivdyetools.projectgalatine.com` route as part of the discord-worker block (only the trailing note at :212 says it was retired). Not wrong for the three live routes, but the Phase 2 steps cannot be executed from the line numbers.
- Tests: n/a (docs gate checks links and versions only). Covered: no.
- Fix direction: refresh the inventory line numbers and the OPEN_ITEMS entry in the same PR that schedules the Phase 2 work.

## POSITIVE
- #228: the retired origin is removed from `ALLOWED_REDIRECT_ORIGINS`, and the authorize and GET callback handlers share one allowlist (oauth.ts:14-26; oauth-flow.ts:270 comment), with a test that no projectgalatine origin is allowed in production (oauth-constants.test.ts:52).
- discord-worker prod routes and oauth routes are pinned to the exact `.app` pattern list.
- No remaining caller in apps/*/src or packages/*/src builds a redirect URI, CORS origin or API base on `*.xivdyetools.projectgalatine.com` (git grep). Remaining src hits are the web-app apex redirect (_middleware.ts:17) and its test.
- Web-app CSP uses `https://*.xivdyetools.app` only (public/_headers:31); no retired host needs allowing.
- presets-api CORS list and JWT_ISSUER are pinned to .app (tests/wrangler-config.test.ts:101-109).

## REJECTED
- Merge-order re-attach of bot./auth. by a sibling PR: only #227 and #228 touch discord-worker/oauth or the packages that trigger their deploys (pr-delta.txt lines 104-128), and each removes its own route line, so no other PR in the batch can deploy those workers with the route still present. Dropped. (The runbook warning "do not dispatch from main before merge" still applies to manual dispatch.)
- Web-app config/env/CSP still pointing at the retired host: none found.
- oauth `FRONTEND_URL` and Discord redirect URIs: .app only (oauth/wrangler.toml:21); the Discord-side registration was recorded clean on 2026-10-04 (DOMAIN_DEPRECATION.md Phase 0 check 3).
- Moderation interactions endpoint still on the retired host: repointed 2026-08-09 (Phase 0.5 outcome), so route removal there is safe.

## COVERED (22 files read or grepped)
docs/operations/DOMAIN_DEPRECATION.md, DEPLOY_ENVIRONMENTS.md (192-215), OPEN_ITEMS.md (85-100), DEPRECATIONS.md (grep); apps/{api-worker,presets-api,moderation-worker,discord-worker,oauth}/wrangler.toml; apps/oauth/src/constants/oauth.ts, handlers/oauth-flow.ts (diff); tests: oauth wrangler-config + constants, discord-worker, moderation-worker, presets-api wrangler-config tests; apps/web-app public/_headers, functions/_middleware.ts, services (grep); the five app CLAUDE.md files (grep); .github/workflows deploy-{moderation-worker,presets-api,api-worker,oauth}.yml; pr-delta.txt.
