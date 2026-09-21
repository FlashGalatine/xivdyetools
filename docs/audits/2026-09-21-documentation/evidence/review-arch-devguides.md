# architecture + developer-guides cluster review

| cand-id | sev | file:line | one-line claim | evidence pointer |
|---|---|---|---|---|
| cand-001 | MEDIUM | docs/architecture/api-contracts.md:532-631 | "OAuth API Endpoints" section documents `/auth/discord`, `/auth/callback` (GET+POST), the removed `/auth/refresh`, and `/auth/me` as the endpoint set, but omits the real, live `POST /auth/revoke` route | apps/oauth/src/handlers/token.ts:101 `tokenRouter.post('/revoke', ...)`, mounted at apps/oauth/src/index.ts:286 `app.route('/auth', tokenRouter); // Tokens: /auth/me, /auth/revoke` |
| cand-002 | MEDIUM | docs/developer-guides/contributing.md:65 | Code-style block gives `pnpm --filter <project> run lint:fix` as the fix-lint command, implying it works for any workspace | Only `packages/core/package.json` and `apps/web-app/package.json` define a `lint:fix` script; the other 15 workspaces (e.g. apps/discord-worker/package.json, apps/oauth/package.json — `lint` is `eslint src/ && pnpm run lint:dead`, no `lint:fix`) have no such script, so the command fails with "Missing script: lint:fix" for them |
| cand-003 | LOW | docs/architecture/dependency-graph.md:135,138,141 | Consumer-app "Runtime Dependencies" rows for moderation-worker / og-worker / image-worker list only the `@xivdyetools/*` + hono/photon/resvg packages, omitting `@cloudflare/workers-types` | apps/moderation-worker/package.json, apps/og-worker/package.json and apps/image-worker/package.json all declare `@cloudflare/workers-types` under real `dependencies` (not `devDependencies`) — unlike discord-worker/oauth/presets-api/api-worker, where it correctly sits in `devDependencies` and is rightly left off the same table |

POSITIVE:
- deployment.md's Convention-A/B split and its exact step citations (`deploy-discord-worker.yml:81-83`, `deploy-moderation-worker.yml:74-76` for "Register Discord commands") are byte-exact against the live workflow files.
- Every `wrangler.toml` (discord-worker, presets-api, moderation-worker, oauth, og-worker, api-worker, image-worker) matches service-bindings.md / environment-variables.md's binding names, shared KV/TOKEN_BLACKLIST namespace ids, and rate-limit namespace-id table (prod/dev pairs) exactly.
- dependency-graph.md's shared-package Dependency Matrix (types/logger/auth/worker-kit/test-utils/core/svg/bot-logic rows, "Depends On" + "Used By (declared)") matches every package.json dependency list exactly, including which apps reach a package only transitively.
- api-contracts.md's presets validation rules and verbatim error strings (name 2-50/description 10-200 messages, stainID legacy-itemID messages at the 5000 threshold, the 11-host example-link allowlist, the 8 category slugs with no `community`) match apps/presets-api/src/services/validation-service.ts and schema.sql exactly.
- overview.md's counts (17 Discord registrations/16 distinct commands, 9 web-app tools, 125 dyes, 11 Facewear colors) and data-flow.md's JWT payload fields + OAuth timeout constants (10s token exchange, 5s userinfo) all verified against source.
- discord-worker's webhook surface as stated in api-contracts.md ("no `/webhooks/moderation` route; live surface is `GET /health` plus `POST /`, `POST /webhooks/preset-submission`, `POST /webhooks/github`") matches apps/discord-worker/src/index.ts's actual route list exactly.

SPELLING-EXCEPTION:
- docs/architecture/api-contracts.md:436 — `"description": "...character's own colours"` in the `/categories` example response is correct: it quotes the live `appearance` category description stored verbatim in apps/presets-api/schema.sql:24 (`'Palettes built around a character''s own colours'`).

COVERED: 17/17 — architecture/{api-contracts,data-flow,dependency-graph,index,overview,security-trade-offs,service-bindings}.md; developer-guides/{contributing,deployment,environment-variables,index,local-setup,logging-standards,monorepo-setup,release-process,testing,troubleshooting}.md. Nothing unfinished.
