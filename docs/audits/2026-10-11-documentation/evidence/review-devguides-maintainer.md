# Review: devguides-maintainer (2026-10-11, HEAD 42c35e87)

## Coverage
| path | tier | units | sections | result |
|---|---|---|---|---|
| docs/developer-guides/contributing.md | living | repo-wide, .github/workflows/ci.yml | all | reviewed |
| docs/developer-guides/deployment.md | living | workflows, wrangler.toml x7, package.json scripts | all | reviewed |
| docs/developer-guides/environment-variables.md | living | discord/oauth/presets/moderation/api/og/image/stoat env + wrangler | all (rate-limit table ids verified; web-app VITE_* verified) | reviewed |
| docs/developer-guides/index.md | living | root/app package.json scripts | all | reviewed |
| docs/developer-guides/local-setup.md | living | package.json scripts, wrangler [dev] ports, .vscode | all | reviewed |
| docs/developer-guides/logging-standards.md | living | packages/logger | all | reviewed |
| docs/developer-guides/monorepo-setup.md | living | turbo.json, pnpm-workspace.yaml, tsconfig | all | reviewed |
| docs/developer-guides/release-process.md | living | publish-packages.yml, changelogs | all | reviewed |
| docs/developer-guides/testing.md | living | test-utils, vitest, playwright | all | reviewed |
| docs/developer-guides/troubleshooting.md | living | workflows, discord-worker scripts | all | reviewed |
| docs/maintainer/adding-dyes.md | living | packages/core data + config | all | reviewed |
| docs/maintainer/dye-maintainer-tool.md | living | tombstone | all | reviewed |
| docs/maintainer/index.md | living | core vitest thresholds | all | reviewed |

Anchors: 4 anchored links in cluster (monorepo-setup.md:480 -> troubleshooting.md heading; maintainer/index.md:18-20), all resolve.

## Candidates
1. deployment.md:260 og-worker listed under "Convention A: top level is a -dev worker with no routes". og-worker/wrangler.toml:12 names it -dev but :28 `routes = [` at top level (routed beta worker); doc's own table row :215 and CLAUDE.md say so. MEDIUM inaccurate (deploy-target advice).
2. deployment.md:321-326 "Migrations are applied explicitly: db:migrate / db:migrate:local". Those scripts run schema.sql (presets-api/package.json:12-13; apps/presets-api/CLAUDE.md:23-29 "CREATES ONLY"; migrations/0002..0015 not applied by any script, `wrangler d1 execute --remote --file=./migrations/<name>.sql` by hand). oauth has migrations/0001 and no db script. MEDIUM inaccurate/missing. Same gap in contributing.md:151 (silent) and release-process.md:175.
3. deployment.md:305 cites `deploy-discord-worker.yml:81-83` and `deploy-moderation-worker.yml:74-76`; the Register step is at deploy-discord-worker.yml:90-92 and deploy-moderation-worker.yml:83-85. LOW drift (stale line cites after Sprint 20/BUG edits).
4. environment-variables.md:65 "ENVIRONMENT gates exactly one behaviour". Also gates the INTERNAL_WEBHOOK_SECRET >=32-char floor: apps/discord-worker/src/index.ts:316-322 (503 "Webhook misconfigured") and env-validation.ts:140ff; presets-api env-validation.ts:149ff fails prod if secret <32 (MIN_WEBHOOK_SECRET_LENGTH). The secrets tables (:75, :196) omit the 32-char minimum (FINDING-027). LOW inaccurate/missing.
5. testing.md:219 "~480 test files": `git ls-files` matching *.test|spec.* excluding scripts/ = 565 (549 excluding 16 e2e specs). LOW drift.
6. contributing.md:107 / :144-152: CI description and PR checklist omit the repo-wide gates the pre-commit command in CLAUDE.md names: `pnpm test:scripts`, `dead-code:check`, `docs:check-versions`, `docs:check-links`, `workers:check-logs` (ci.yml steps after Type-check; Workers Logs gate added 3a158847), wrangler-config-invariants step, check-bundle-size. docs:check-* are mentioned only in the doc-convention section. LOW missing.
7. adding-dyes.md:391-398 "entry, in full" shows Soot Black as `"stainID": 38`; dyes.json:48-55 has Soot Black stainID 6 (38 is Millioncorn Yellow, dyes.json:336). LOW inaccurate.
8. adding-dyes.md:316 "FFXIV doesn't expose dye RGB values in its data files" + Step 2 Lodestone color picking, vs same file :205 (Stain sheet gives packed BGR colour) and :182 (hex is single source). Internal contradiction in the "canonical" doc. LOW inaccurate.
9. maintainer/index.md:109 "Test coverage | Core library | Increase from 85% to 90%": packages/core/vitest.config.ts:23-28 thresholds are already 90 across the board. Items :100-118 (React-style error boundaries for Lit, "Deprecated folder remove after 6 months", SVGO) are unverifiable/undated. LOW inaccurate.
10. troubleshooting.md:326 describes logging-standards.md as "how to get useful structured logs out of a worker"; every worker pins Workers Logs off (scripts/check-worker-logs.ts, ci.yml "Workers Logs pinned off", environment-variables.md:65 "Workers Logs are off") and logging-standards.md says nothing about that; also duplicate `## Current Package Status` headings (logging-standards.md:103 and :109) and the 2nd table omits svg/bot-logic/worker-kit/auth. LOW inaccurate/navigation.
11. Spelling (LOW): see table. Supersedes DOC-004/DOC-005 parts.
12. DOC-008 STILL_PRESENT: contributing.md:65.

## Positive controls
Rate-limit namespace_ids (env-vars:373-383) match wrangler.toml for api, presets, oauth, moderation, discord. Four VITE_* keys exact (grep import.meta.env). Dev ports 8787/8788/8790 and no [dev] on discord/moderation/og/image. test-utils surface and consumer count (6) match. 11 deploy workflows each carry the 4 root paths; BUG-154 publish text matches publish-packages.yml:156-210. ci.yml concurrency description matches. DYE_CATEGORIES(8)/DYE_ACQUISITIONS(4) match. All package scripts named in index/local-setup/testing exist (validate:i18n, docs:dev, check-bundle-size, test:e2e*, register-commands).

## Rejected
- deployment.md "any non-main branch" for beta workflows: branches-ignore also excludes `dependabot/**`; immaterial.
- contributing.md:111 "three required checks": cannot verify branch protection from source (OPEN_ITEMS.md:33 is the cited authority); unverified, not filed.
- monorepo-setup "Level" numbering differs from CLAUDE.md (own scheme, internally consistent).
- local-setup `corepack prepare pnpm@latest`: doc itself says packageManager pins exact.

## Spelling table (confirmed)
| document | count | lines |
|---|---|---|
| maintainer/adding-dyes.md | 7 | 24,31,38,40,272(grey, generic category prose, not a dye name),281,385 |
| developer-guides/contributing.md | 4 | 39,48,100,145 |
| developer-guides/environment-variables.md | 2 | 65,229 |
| developer-guides/monorepo-setup.md | 1 | 19 (ASCII-tree prose "Colour algorithms") |
| developer-guides/release-process.md | 1 | 202 |
| developer-guides/troubleshooting.md | 1 | 183 |
Total 16; 0 rejects (no identifiers/quotes). `Neutral` row "grey" kept as ordinary prose.
