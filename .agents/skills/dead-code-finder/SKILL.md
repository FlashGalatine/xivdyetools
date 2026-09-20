---
name: dead-code-finder
description: Use when asked to find dead, unused, orphaned, legacy, or unreachable code in a xivdyetools package or app — unused exports/imports/types/deps, orphaned files, stale tests, dead CSS or assets, orphaned i18n keys — or to plan a cleanup ("find dead code", "unused exports", "code cleanup", "cleanup plan", "cleanup sprints").
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Agent, Skill
---

# Dead Code Finder (xivdyetools)

Find code that nothing reaches, prove it, grade the removal risk, and produce a catalog the
`remediation-planner` turns into risk-ordered cleanup sprints. **Nothing is removed during the
audit.** Runs from the monorepo root `xivdyetools/`.

Before executing the workflow, read `../audit-shared/model-routing.md` for the Claude/Codex runtime,
model-role, shell, and tool conventions; the primary coordinator applies its routing rules.

## Parameters

| Param | Values |
|---|---|
| SCOPE | one or more deploy units (`apps/og-worker`, `packages/core`, …); a package scope includes its consumers for reference counting |
| DEPTH | `quick` (knip + tsc only) · `standard` (default: + symbol/member/asset/i18n sweeps) · `exhaustive` (+ git archaeology, npm consumer check) |
| OUTPUT | default `docs/audits/YYYY-MM-DD-<scope>-dead-code/` |

## Step 0 — load conventions

Read `../audit-shared/conventions.md` (§1–3, §6–9) + `model-routing.md`, `../audit-shared/units.md` + `release-mechanics.md`
(deploy unit, version rule) and `../audit-shared/traps/shell.md` + `traps/knip-and-dead-verdicts.md`
(grep poisoning, knip limits, verdicts that were wrong before). If a previous dead-code audit exists for the scope, read only its
README + the "follow-ups"/KEEP section — carry-forwards get new IDs.

## Step 1 — setup

```bash
git rev-parse --short HEAD; git branch --show-current; git status --porcelain -- <scope>   # clean tree
mkdir -p <OUT>/{findings,evidence/scripts}
cp "<SKILL_DIR>/scripts/"{symrefs.sh,members.py} <OUT>/evidence/scripts/
```
Write `<OUT>/README.md` stub (scope, branch@commit, depth, versions from `package.json`,
"no source modified").

## Step 2 — automated detection (capture to `evidence/`)

Fixed commands, no verdicts — assign the block to the `collector` role
(`../audit-shared/model-routing.md`) when delegated; it returns the evidence paths plus knip/tsc counts,
not the logs. Follow the coordinator rules for inline versus delegated execution. The *interpretation*
of those counts stays with you (Step 4).

```bash
# knip — root config is monorepo-aware; --workspace filters reporting, consumers still count
pnpm exec knip --workspace <scope> --no-config-hints --no-tag-hints > <OUT>/evidence/knip.txt 2>&1 || true
# apps with their own knip.jsonc (web-app, og-worker): run from the app dir; og-worker also supports --production
pnpm --filter <name> exec knip > <OUT>/evidence/knip-app.txt 2>&1 || true
pnpm --filter xivdyetools-og-worker exec knip --production > <OUT>/evidence/knip-production.txt 2>&1 || true
# unused locals/params (catches units whose tsconfig overrides the base noUnused* flags)
pnpm --filter <name> exec tsc --noEmit --noUnusedLocals --noUnusedParameters > <OUT>/evidence/tsc-unused.txt 2>&1 || true
# i18n orphans (only the sets the scope owns)
pnpm --filter xivdyetools-web-app run i18n:unused -- --json > <OUT>/evidence/i18n-unused.json 2>&1 || true
pnpm --filter @xivdyetools/bot-logic exec vitest run src/i18n > <OUT>/evidence/bot-logic-orphans.txt 2>&1 || true
# baseline gates + bundle size (before), so the cleanup can prove it changed nothing but size
pnpm turbo run type-check lint test --filter=<name> > <OUT>/evidence/gates-before.txt 2>&1 || true
pnpm --filter <name> exec wrangler deploy --dry-run --outdir <OUT>/evidence/bundle-before > /dev/null 2>&1 || true   # workers
```
Do not run ts-prune/depcheck (not installed; depcheck false-positives the postcss/tailwind stack).
knip's "unused dependencies" section covers deps — verify each against `traps/knip-and-dead-verdicts.md` before filing.

`quick` depth stops here and files only what knip/tsc report.

## Step 3 — symbol, member, asset and path sweeps (standard)

knip cannot see **test-only** code or dead **class members** — these were the majority of dead
lines in every previous audit. All scans run over `git ls-files`.

```bash
# every export in scope, then bucketed reference counts: prod / tests / elsewhere in repo
git ls-files '<scope>/src/*.ts' '<scope>/src/**/*.ts' | grep -v '\.test\.ts$' \
  | xargs grep -hoE '^export (const|function|class|type|interface|enum|async function) [A-Za-z0-9_]+' \
  | awk '{print $NF}' | sort -u > <OUT>/evidence/exports.txt
bash <OUT>/evidence/scripts/symrefs.sh <scope> $(cat <OUT>/evidence/exports.txt) > <OUT>/evidence/symrefs.txt
# public methods of the big classes (services, controllers) — external src/test/self usage
python <OUT>/evidence/scripts/members.py <scope>/src/services/foo-service.ts FooService >> <OUT>/evidence/members.txt
```
Then check, recording commands next to results:
- **Barrels vs subpaths** — an unused `index.ts` export can be live via a package subpath
  (`/encoding`, `/rate-limiter`, `/blending`, `/i18n`) → REDUNDANT-RE-EXPORT, not dead.
- **Orphaned files** — zero importers; verify against entries outside `src/` (`scripts/`, `functions/`,
  `e2e/`, `packages/test-utils/integration/`), dynamic imports, wrangler `main`, workflows.
- **Dead paths** — unreachable after return/throw, always-true flags, `@deprecated`/`TODO remove`/
  `LEGACY` markers (`git ls-files '<scope>/**/*.ts' | xargs grep -n -E '@deprecated|TODO.*remov|LEGACY|OBSOLETE|HACK'`),
  routes defined but never emitted (og-worker image routes vs web-app share URLs), feature flags.
- **Types** — never-constructed types hidden by `import type`; over-broad unions.
- **Stale tests** — `it.skip|xit|describe.skip|it.todo`, tests for removed modules, unused helpers/mocks, snapshots.
- **CSS** (web-app) — class selectors with zero template references; apply the shadow-DOM rule in
  `traps/knip-and-dead-verdicts.md` before calling anything "unreachable"; tool CSS is loaded in both scopes by design.
- **Assets** — `git ls-files '<scope>/public/**' '<scope>/assets/**'` vs references in src/html/
  manifest/og-worker; Vite `publicDir` is `../public`.
- **Deps** — each knip "unused dependency" checked for config-only use (postcss, tailwind, wrangler pin).
- `DEPRECATIONS.md` cross-reference — things listed there as retired must actually be gone.

`exhaustive` adds: `git log --since="1 year ago" --name-only` staleness per file, and for
published packages `npm view @xivdyetools/<pkg>` + a grep of the other apps for each public
export (downstream consumers you cannot see count as consumers).

Scope > 1 deploy unit → fan out per `conventions.md` §7 using the `worker` role per unit; it
runs Steps 2–3 for its unit and returns the candidate table. Single unit → inline unless the
coordinator rules require delegation. Every **"this is dead"** verdict —
the `symrefs.sh`/`members.py` results read against `traps/knip-and-dead-verdicts.md` — is a
`verifier` task, inline or delegated according to the coordinator rules. Eight verdicts in the
2026-09-01 run were wrong as filed; this is the step that catches that.

## Step 4 — findings (`findings/DEAD-XXX.md`, skeleton in `conventions.md` §3)

Header line fields: **Confidence** HIGH|MEDIUM|LOW · **Blast radius** NONE|LOW|MEDIUM|HIGH ·
**Deploy unit** · **Semver** NONE (internal) | MINOR (exported, provably unconsumed in and out
of repo) | MAJOR (public export of a *published* version — apply the version rule) ·
**Category** Unused Export | Orphaned File | Dead Path | Unused Dep | Legacy | Unused Type |
Stale Test | Dead CSS | Dead Asset | Orphan i18n | Test-only | Redundant Re-export.

`## Fix` = **REMOVE** | **REMOVE WITH CAUTION** (what to verify first) | **KEEP** (+ the
concrete *revisit trigger* — a KEEP without one is an unowned suspicion) | **REFACTOR FIRST**,
then the exact removal steps (`git rm …`, barrel lines, test files, gate command). Lines removed
go in the title (`— 191 lines + 418-line test`).

## Step 5 — `DEAD_CODE_REPORT.md` (skeleton `conventions.md` §4)

Catalog columns: `| ID | Title | Conf | Blast | Semver | Deploy unit | Rec |`. Add after the
catalog: **Quick wins** (HIGH/NONE-or-LOW, REMOVE), **KEEP register** (`| ID | Item | Reason |
Revisit trigger |`), **Dependency cleanup**, lines/files/bundle-before totals. Recommendations =
guardrails to add (knip gate for the unit, `--production` with `!` globs, orphan/reverse-key tests,
`noUnusedLocals` on). No by-category files, no health grade.

## Step 6 — hand off + confirm

Hand off to `remediation-planner` through the available skill loader (or read its `SKILL.md` if no
loader is available), passing `<OUT>/DEAD_CODE_REPORT.md --output <OUT>/CLEANUP_PLAN.md` — pass
other open catalogs too (fix-vs-delete conflicts resolve only in merged mode). The planner
applies the dead-code rules (Confidence × Blast first, KEEP unscheduled, MAJOR isolated,
cascades after their trigger, verification gate per sprint). Then the confirmation gate
(`conventions.md` §8) — nothing is deleted before an explicit yes.

## Rules

- Full catalog before any removal; removal follows the plan, one commit per task, gate at every
  sprint boundary (`release-mechanics.md` → Standing verification gate).
- `git ls-files` for every reference count; re-grep each symbol immediately before `git rm`;
  `git commit --only -- <paths>` (another session shares the checkout).
- "Unused in this repo" ≠ unused for a published export — MAJOR needs its own sprint.
- Commented-out code is dead code; KEEP needs a trigger; when unsure, KEEP with a trigger beats a
  premature removal.
- Removing fully-covered dead code lowers coverage — report the ratchet effect, never lower web-app's.
