# Review: root-ci (deploy unit "root (CI/scripts)")

Paths: scripts, .github, knip.jsonc, turbo.json, pnpm-workspace.yaml, package.json, .gitleaks.toml, .agents/skills.

## Commands and results
- Listed tracked files in unit: 15 scripts files, 15 .github files, 38 .agents/skills files.
- Per-export census over scripts/*.ts (grep -lw across scripts/*.ts, split into test / other-prod / self): every export without an other-prod referrer is either used inside its own file or exercised by its `.test.ts`; the exports are a deliberate self-test surface. Type-only exports with no importer: Violation, PathAlias, BlockFrame, BrokenLink, LinkCheckResult, VersionClaim, CheckResult, WorkerLogResult (all used in-file). Exports with zero test refs but in-file use: workspaceOf (check-dead-code.ts:80, 5 refs), extractSpecifiers (:392), specifierBasename (:410), CHECKED_FILES (check-doc-versions.ts:64), findWorkerConfigs (check-worker-logs.ts:123, used by runCheck:139). Only a redundant `export` keyword, not dead lines.
- scripts/markdown-mask.ts: maskBlockCode exported, other-prod=1 (maskCode calls it in-file; one importer of the module).
- PR #233 check-worker-logs.ts: `@entrypoint` tag present with reason (lines 32-33); wired as `workers:check-logs` (package.json) and ci.yml:274; self-test in `test:scripts`. ALLOWED_TO_LOG is an intentionally empty fail-closed allow-list, asserted by test (check-worker-logs.test.ts:27). Not dead.
- coverage-report.ts: no exports, run by `coverage:report`.
- pnpm-workspace.yaml overrides vs pnpm-lock.yaml: typescript (live), rollup (rollup@4.59.0 lock:3551), seroval (seroval@1.6.2 lock:3574), vitepress>vite (vitepress@1.6.4 lock:3946), tsup>esbuild (tsup@8.5.1 lock:3754, bundle-require uses esbuild 0.28.1), miniflare>undici (miniflare 5.20260923.0-alpha lock:3305, depends on undici 7.30.0 lock:6387). **qs: no `qs@` entry anywhere in pnpm-lock.yaml (grep `qs@`, `qs:` only hits the overrides header lines 10), and no package.json depends on it.** The pre-existing advisory (CHANGELOG.md:532, GHSA-q8mj-m7cp-5q26) came through the retired apps/api-docs vitepress chain.
- allowBuilds: esbuild (6 lock entries), msw (2), workerd (2) all still in lockfile.
- turbo.json tasks: build/type-check/lint/test/test:coverage/check-bundle-size (discord-worker, web-app)/clean/dev all have package scripts. `deploy` task defined (turbo.json) with 7 package `deploy` scripts but no `turbo run deploy` anywhere in package.json, workflows, docs or skills (every caller uses `pnpm --filter ... run deploy`).
- package.json scripts: all targets exist (scripts/*.ts, knip). devDependencies: turbo, typescript, eslint, knip, @eslint/js, @types/node, typescript-eslint, prettier, tsx, rimraf:
- knip.jsonc: web-app ignore `src/shared/browser-api-types.ts` exists; root-knip.txt shows exactly the 3 documented items. `apps/*` block reaches og-worker/stoat-worker only (documented). `"tags": ["-public"]` documented inert (not re-filed).
- Workflow path filters (deploy-*.yml, 11 files): every apps/* and packages/* path exists; no workflow for a retired unit (api-docs/universalis-proxy gone); no stoat-worker deploy (parked). ci.yml filters: xivdyetools-oauth-worker/image/presets/moderation/discord names match package.json; the five test files (wrangler-config.test.ts x4, root-changelog.test.ts) all exist; web-app scripts check-bundle-size.js / check-beta-build.js exist; discord-worker upload-emojis script exists. dependabot.yml: directory `/` only.
- .gitleaks.toml: path allowlist is file-shape regexes only (no removed-file paths); regexes target value shapes; comments name apps/web-app/src/services/tool-panel-builders.ts, comparison-tool.ts and apps/oauth handlers/xivauth.ts (historical evidence, not allowlist keys).
- .agents/skills: referenced scripts (american-spelling.mjs, policy-locale-parity.py, members.py, symrefs.sh, manual-check.mjs, cmap-diff, font-coverage, locale-diff, script-inventory) exist under skills; scripts/build-locales.ts reference resolves to packages/core/scripts/build-locales.ts; the only "missing" hits were external URLs and relative prefixes. Skill symrefs.sh is byte-identical to the evidence copy.
- rimraf used by package `clean` scripts (live).

## Candidates
1. pnpm-workspace.yaml:9 `qs: '>=6.15.2'` override, package absent from lock (dead override; docs/developer-guides/monorepo-setup.md:78 and CHANGELOG.md:532 mention it). Trigger-type: a pre-emptive security floor is harmless; deleting means a future transitive qs is unfloored. Rec: verify with `pnpm why qs`, then remove or keep with a reason.
2. turbo.json `deploy` task (dependsOn build,type-check): no `turbo run deploy` caller found. Low value; borderline Dead Path.
3. Redundant `export` keywords on in-file-only helpers (workspaceOf, extractSpecifiers, specifierBasename, CHECKED_FILES, findWorkerConfigs); not removable lines. Not a finding.

## Prior KEEP triggers
DEAD-018/019/020/021 are not in this unit; no trigger evaluated here.

## Files covered
scripts/ (11 files), turbo.json, pnpm-workspace.yaml, package.json, knip.jsonc, .gitleaks.toml, 15 .github files, .agents/skills (38, reference check).
