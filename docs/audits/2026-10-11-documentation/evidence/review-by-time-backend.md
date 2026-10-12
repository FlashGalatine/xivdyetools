# By-time sweep (backend) - 2026-10-11

Scope: 100 non-merge commits since 2026-09-21 touching the backend paths. Behavior-changing ones were checked against the living docs tier. Served == HEAD source (16a6123f).

## Candidates

### cand-by-time-backend-01 (LOW, missing)
- Doc: docs/projects/presets-api/database.md:187-198 (migration table ends at 0014, then 002_add_composite_indexes.sql).
- Truth: apps/presets-api/migrations/0015_rewrite_legacy_dead_letters.sql exists. It is a hand-run (wrangler d1 execute --file) post-deploy data rewrite of failed_notifications.payload to the reduced shape. Introduced with presets-api 2.4.0 (f1b54a0f; 12e7f887 "changelog names migration 0015").
- git grep of the living tier for 0015 / rewrite_legacy finds nothing.
- Fix: add a row "0015_rewrite_legacy_dead_letters.sql | Hand-run after the 2.4.0 deploy: rewrites pre-2026-08-30 failed_notifications.payload rows to the reduced { type, preset_id, moderation_status? } shape; idempotent; data only, no schema change".

### cand-by-time-backend-02 (LOW, missing)
- Docs: docs/CLAUDE.md:119-125 ("Documentation Gates" lists only docs:check-versions, docs:check-links, test:scripts); docs/developer-guides/contributing.md (CI section ~107-125); docs/operations/DEPLOY_ENVIRONMENTS.md (inheritable-keys list at :50-56).
- Truth: package.json:13,16 define dead-code:check and workers:check-logs; 3a158847 (FINDING-022) added the Workers Logs gate (every apps/*/wrangler.toml pins [observability] enabled = false, no logpush/tail consumers; escape hatch = the ALLOWED_TO_LOG list in scripts/check-worker-logs.ts). Both run in the required CI job. The living docs tier has no description of either gate or of the observability pin (git grep -i for check-worker-logs / check-logs in docs/ minus archive = 0 hits). Only the root and repo CLAUDE.md describe them. OPEN_ITEMS.md:67 says Workers Logs "stay OFF" but not that a gate enforces it.
- Fix: add one line each to docs/CLAUDE.md "Documentation Gates" (or a repo-gates block) and to contributing.md CI section naming pnpm workers:check-logs and pnpm dead-code:check, with the one-sentence rule above.

### cand-by-time-backend-03 (LOW, spelling)
- docs/projects/discord-worker/commands.md:17 table row "Colour tools". The registry comment (apps/discord-worker/src/commands/registry.ts:28) uses the same spelling, but it is a code comment, not a shipped label (category key is color-tools, registry.ts:29). Prose in a living doc: should read "Color tools".

## Commits assessed (coverage)

| Commit | Tier | Result |
|---|---|---|
| bfd393e7 /glamour feature (+70e2482b, fbdc8c60, 73480209, 8b2eaeeb) | living: discord-worker commands/overview, user-guides command-reference, getting-started | reviewed - command row, ROW_CAP 5 (packages/bot-logic/src/commands/glamour.ts:127), 15/min default tier (worker-kit configs.ts:102), SERVICE_RATE_LIMITER 1300/min (api-worker wrangler.toml:71) all match |
| 641257c5 /manual names Brio, verdicts | commands.md:180, command-reference | reviewed - matches |
| f5e3aac2 / dfa45fd0 / ce296d09 glamour refusal relays | commands.md:199-212 | reviewed - docs say 429 answered as busy (glamour.ts:396); 4xx relay not documented but not contradicted |
| c1f60ec8 / b43e757a Sprint 15 (six-digit hex never a dye id, NOT_ENOUGH_DYES) | commands.md budget/comparison/contrast | partial - docs never describe dye-input resolution, so nothing contradicts; omission only, not filed |
| 7562d177 / 2d353699 / 49e6f31a bot-logic readouts | commands.md | reviewed - no claim touched |
| 412e3884 resvg free after render (5.8.10) | rendering.md | reviewed - no memory-lifecycle claim in living docs |
| 00390333 / fa56ae8a FONT-001 ko/zh/ja item names | rendering.md:44 | reviewed - matches |
| d1fdb89a discord 5.8.0 (revision-bound ids, /stats preferences removed) | commands.md:544-555, moderation overview | reviewed - /stats lists summary/overview/commands/health only; matches |
| c7fd9eba / 10a3b137 / aaa4467b / 3a69828c moderation 1.8.0 | moderation-worker overview:126-160 | reviewed - confirm button, no reason option, revision-bound ids documented |
| 667f3ef9 / e92ea01f / 20587699 moderation 1.8.1, types grammar | moderation overview:87,107,150 | reviewed - docs point to @xivdyetools/types |
| f1b54a0f presets-api 2.4.0 (expected_revision, GET /moderation/:id, retention cron) | api-contracts.md:476-515, presets-api moderation.md:127-139 | reviewed - cron "23 4 * * *" production only (wrangler.toml:125-126) matches |
| e34ea70a retention job | database.md:88,137, moderation.md:135 | reviewed - matches |
| 8c264798 / f1174a47 presets-api 2.5.0 (edited_from) | api-contracts.md:316,739 | reviewed - matches |
| 12e7f887 / 6f2bb05c / b0f01e24 / ee869d55 retired projectgalatine routes | DOMAIN_DEPRECATION.md:41-45, api-worker overview:127 | reviewed - the five wrangler.toml hold only a comment; DEPLOY_ENVIRONMENTS.md:192-207 keeps the pre-removal block but the following paragraph says the lines were removed |
| 35f502db oauth 3.1.3 | oauth endpoints.md:100-110,140, api-contracts.md:607-610, overview:89 | reviewed - 400/415/roster fallback documented |
| d853a765 oauth 3.1.2 | DOMAIN_DEPRECATION.md:44 | reviewed |
| ed460f33 worker-kit 1.5.0 | no living doc claims about reset paging or formatError headers | reviewed |
| 8d2649d7 logger 2.3.0 | docs/projects/logger/overview.md | reviewed - updated in the commit |
| c73b702f test-utils 3.0.0 | docs/projects/test-utils/overview.md, testing.md | reviewed - removals documented; exports map (package.json:11-23) matches subpaths |
| 26e43a64 CI 2.3.2 | deployment.md:44-52, DEPLOY_ENVIRONMENTS.md:324-335, release-process.md:69-75 | reviewed - ci.yml:53-55 matches |
| 3a158847 Workers Logs gate | see cand-02 | missing |
| 6e8c7d81 / 01465700 / 64e1f212 image-worker, stoat-worker | no living stoat project doc; index.md:67 says parked | reviewed - no stale claims |
| d9fdb57c CommandRegistryEntry.deprecated removed | git grep docs = 0 | reviewed |
| 2c07739a, 2e4cb0cb, policy commits | policy docs | out of scope (policy reviewers) |
| Dependabot/chore/CHANGELOG-only commits (215cfa42, 404105f7, b00bd30e, d25f37e4, afce044d, 43ee47e7, 3c597fe7, c50ea318, 48c7dc8b, version-row docs commits) | - | skipped, no behavior change |

## Positive controls
- Every Sprint 8-26 behavior commit also updated its living doc (api-contracts, oauth endpoints, presets-api moderation/database, test-utils overview).
- DOMAIN_DEPRECATION.md rows strike through removed route lines and match the five wrangler.toml comments.
- commands.md rate-limit table equals DISCORD_COMMAND_LIMITS (configs.ts:68-102); glamour falls to default 15.

## Rejected suspicions
- DEPLOY_ENVIRONMENTS.md:192-207 still lists projectgalatine routes: historical "as moved" block followed by text saying the lines were removed.
- commands.md "18 registrations, 17 distinct": consistent with registry (manual-check passed).
- docs/CLAUDE.md filter name xivdyetools-oauth-worker: matches apps/oauth/package.json.
- Missing dye-input resolution rules (BUG-034) in commands.md: no claim made; omission only.

## Spelling per document (raw hits in this scope, before exemptions; identifiers such as favourites KV prefix and quoted material to be removed by the verifier)
docs/architecture/overview.md 14; docs/projects/discord-worker/commands.md 13; docs/projects/discord-worker/overview.md 5; docs/developer-guides/contributing.md 4; docs/projects/types/overview.md 2; docs/developer-guides/environment-variables.md 2; docs/architecture/service-bindings.md 2; docs/projects/discord-worker/interactions.md 2; one each: presets-api/endpoints.md, oauth/endpoints.md, discord-worker/rendering.md, operations/OPEN_ITEMS.md, operations/IMAGE_WORKER_SPLIT.md, developer-guides/troubleshooting.md, release-process.md, monorepo-setup.md.
