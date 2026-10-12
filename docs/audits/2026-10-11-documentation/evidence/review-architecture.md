# Review: architecture cluster (2026-10-11)

Baseline: HEAD 42c35e87 == served 16a6123f for every app (only root CHANGELOG-laymans.md differs). Tier: living.

## Coverage

| Path | Tier | Units | Sections reviewed | Result |
|------|------|-------|-------------------|--------|
| docs/architecture/api-contracts.md | living | presets-api, oauth, discord-worker | all (auth, presets, votes, categories, moderation, OAuth, webhooks, error codes) | reviewed; cand-02, 08, 11, spelling |
| docs/architecture/data-flow.md | living | oauth, presets-api, core, api-worker, discord-worker | all 7 flows | reviewed; cand-04, spelling |
| docs/architecture/dependency-graph.md | living | all package.json | graph, matrices, core tree, third-party tables | reviewed; cand-05, 06 |
| docs/architecture/index.md | living | - | all (17 projects = 8 pkgs + 9 apps, correct) | reviewed, no defects |
| docs/architecture/overview.md | living | all workspaces, wrangler.toml | all sections, binding map, og-worker, api-worker | reviewed; cand-01, 07, 09, spelling |
| docs/architecture/security-trade-offs.md | living | worker-kit, auth, presets-api | all 5 trade-offs | reviewed; cand-03 |
| docs/architecture/service-bindings.md | living | wrangler.toml x7, Env types | all | reviewed; cand-07, 09, spelling |

## Candidates (full text in the structured return)

cand-architecture-01 og-worker "nine tools" (overview:329,337); source apps/og-worker/src/index.ts:100-111 lists 10 incl. glamour. Seed CONFIRMED.
cand-architecture-02 api-contracts omits POST /auth/revoke and the XIVAuth routes (supersedes DOC-007).
cand-architecture-03 security-trade-offs:68-73 describes removed KV limiter mechanics.
cand-architecture-04 data-flow:109-111 says duplicate -> 409; source answers 200 with vote_added for approved duplicates.
cand-architecture-05 dependency-graph Consumer Applications table omits @cloudflare/workers-types (supersedes DOC-009).
cand-architecture-06 dependency-graph third-party versions stale (hono ^4.13.5 vs ^4.13.9; vite ^8.2.2 vs ^8.3.1).
cand-architecture-07 "Presets API calls OAuth Worker" (overview:471, service-bindings:256); presets-api never calls oauth.
cand-architecture-08 GET /auth/discord redirect_uri marked Required; optional with FRONTEND_URL default.
cand-architecture-09 binding map omissions (api-worker UNIVERSALIS_* limiters, presets-api cron).
cand-architecture-10 spelling (supersedes DOC-004), 28 confirmed.
cand-architecture-11 POST /presets/:id/preview-image error table omits the 429 daily upload limit.

## Priors
DOC-004 STILL_PRESENT (19/3 now). DOC-007 STILL_PRESENT (api-contracts.md:555-660 has no revoke). DOC-009 STILL_PRESENT (moderation/og/image package.json still carry workers-types under dependencies; table rows dependency-graph.md:135,138,141 omit it).

## Positive controls
- Binding names, namespace ids, limits (RL_COMMAND 25/1031, RL_AUTOCOMPLETE 70/1032, RL_PUBLIC 100/1011, RL_AUTH_10/20/30) match wrangler.toml.
- Presets-api limits (10/20/30 daily, 100 req/min), v2 HMAC window 60 s, botnonce prefix, error codes, tables list all match source.
- Universalis TTLs 300/120, 86400/21600 match universalis/config/cache.ts.
- Tool names match web-app en.json tools.*.title; 18 registry commands; 125 dyes / 85+9+11 consolidation; Facewear 11.
- Only anchor in the cluster (#post-webhookspreset-submission) and the TOC anchors resolve.

## Rejected
- api-contracts.md:444 "colours": verbatim presets-api schema.sql seed (standing rejection).
- Timing-safe snippet (security-trade-offs:236-248) differs from auth/src/timing.ts:27-56 (padding, try/catch): illustrative snippet, behavior claims hold.
- "Service Bindings don't work in wrangler dev" (service-bindings:344): cannot establish from the repo; unverified, not filed.
- Hono CVE / CVSS and Durable Object price figures: external facts, not checkable offline.
- overview binding map vs prod ids: identical names in both envs, confirmed.

## Spelling per document (confirmed)
| Document | Count |
|----------|-------|
| overview.md | 19 (16 sweep rows + 132, 426, 508 from --all) |
| api-contracts.md | 3 (107, 243, 765); 444 rejected |
| dependency-graph.md | 3 (163, 165, 177: ASCII-tree prose) |
| service-bindings.md | 2 (69, 210: prose in comment/tree, code uses 'favorites') |
| data-flow.md | 1 (196) |
| Total | 28 |
No extra British spellings found beyond the dictionary (grep for -ise/-our/-re/-ence forms).
