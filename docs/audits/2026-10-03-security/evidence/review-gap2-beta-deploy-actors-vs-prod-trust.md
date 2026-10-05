# review-gap2-beta-deploy-actors-vs-prod-trust (2026-10-03)

Question: who can push a non-main branch / dispatch deploy-web-app-beta.yml, given beta.xivdyetools.app is a PRODUCTION oauth redirect origin (apps/oauth/src/constants/oauth.ts:17) and production presets-api CORS origin (apps/presets-api/wrangler.toml:64)?
Answer: only the owner (FlashGalatine). No candidate.

## 1. Entry points and authz matrix
| Entry | Trigger | Who can reach it | Guards | Caps |
|---|---|---|---|---|
| deploy-web-app-beta.yml | push to any branch except main/master/dependabot/** (paths filtered); workflow_dispatch (:21-31) | repo writers; `collaborators?affiliation=all` returns one user, FlashGalatine (admin); invitations [] | `environment: beta` (no reviewers, deployment_branch_policy null), missing-token guard step | n/a |
| deploy-og-worker-beta.yml / deploy-discord-worker-beta.yml | same triggers | same | same environment | n/a |
| Fork pushes / PRs | none of the three has a pull_request trigger | fork authors cannot trigger push workflows in the base repo | n/a | n/a |

## 2. Positive controls
- Live `gh api` (2026-10-03): sole collaborator is the owner; no pending invitations; no repo rulesets; no org (user-owned repo, no teams).
- Actor evidence: of the last 100 workflow runs, 100 have actor FlashGalatine. Every Deploy Beta * run is push by FlashGalatine. Deployments to `beta` (16) are all by FlashGalatine. Repo PRs: 74 owner, 26 dependabot[bot].
- Dependabot cannot reach beta: `dependabot/**` is in branches-ignore (deploy-web-app-beta.yml:20-21), and Dependabot-triggered runs get no secrets anyway.
- Branch list is only main, claude/glamour-check-prototype, feat/glamour-reader: no copilot/** branch exists. The `copilot` environment (created 2026-09-28) has zero secrets, zero variables, no rules, and no deployments; no workflow references it. A Copilot run could therefore not pull CLOUDFLARE_API_TOKEN_BETA through that environment.
- Copilot coding agent needs a write-access user to assign it; an outside issue author has no write access, so issue text from the public cannot drive it. Default workflow permissions are read, can_approve_pull_request_reviews=false, fork-pr-contributor-approval=first_time_contributors.
- FINDING-028 separation holds: beta uses CLOUDFLARE_API_TOKEN_BETA (environment secret on `beta`); production CF token only in `production` (custom branch policy, main only). Repo secrets carry only CLOUDFLARE_ACCOUNT_ID and Discord tokens.
- main is protected (required status checks; force-push and deletion disallowed); enforce_admins false (owner may bypass).

## 3. Rejected
- Copilot agent harvesting production sessions via beta: no copilot/** branch has ever existed, no run by any actor other than owner/dependabot; outsiders cannot assign it; its Actions runs also need maintainer approval by GitHub default (not verifiable via GET). Dropped. Latent only: if the owner enables the agent, copilot/** pushes match the beta triggers and the agent is then a second actor; revisit at that point (suggested hardening: add `copilot/**` to branches-ignore, or give `beta` a deployment branch policy).
- GitHub Apps/bots: `installation` endpoint needs an app JWT (401, not queryable); hooks list shows only a push-event Discord notification webhook; no deploy keys observed. Dependabot is the only bot in the run history.
- Beta site reading production JWT from localStorage (apps/web-app/src/services/auth-service.ts:67,281,476): true by design while the owner is the only author; the owner already controls production, so no privilege gained. Not re-filed (security-trade-offs INF-06 reasoning still holds: sole collaborator).
- oauth#c1, presets-api pages.dev CORS, FINDING-028: excluded by brief.

## 4. Files covered
.github/workflows/deploy-web-app-beta.yml (full), deploy-og-worker-beta.yml and deploy-discord-worker-beta.yml (headers/triggers), deploy-web-app.yml (trigger), apps/oauth/src/constants/oauth.ts:5-50, apps/presets-api/wrangler.toml:64, apps/web-app/src/services/auth-service.ts (storage greps), docs/architecture/security-trade-offs.md (grep), evidence/review-ci-supply-chain.md (greps). GitHub API GETs: environments (+secrets/variables names), collaborators, invitations, actions/permissions*, rulesets, branch protection, branches, workflow runs, deployments, pulls, hooks.

## 5. Candidates
| cid | sev | exposure | path:line | claim |
|---|---|---|---|---|
| (none) | | | | Only the maintainer can run the beta deploys today. |

## 6. Handoffs
- ops: answers the ci-supply-chain question: Copilot agent has never pushed; consider `copilot/**` in branches-ignore or a branch policy on `beta` before enabling it.
- ops (maintainer, not a repo finding): the repository webhook list (admin-only API) contains a Discord webhook URL including its token; it is not in tracked files. If admin API output is ever logged or shared, rotate that webhook.
- docs: security-trade-offs INF-06 could state the verified actor set (sole collaborator, no rulesets) and that the beta/production trust coupling (oauth/presets-api beta origin) depends on it.
