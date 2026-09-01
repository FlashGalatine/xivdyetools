# DEAD-031: root `scripts/coverage-report.ts` — 245 lines that cannot be run by the command in its own header

**Confidence:** HIGH · **Blast radius:** NONE · **Deploy unit:** repo tooling (no deploy) · **Semver:** NONE · **Category:** Orphaned File

## Location
- `scripts/coverage-report.ts` — the only file in the repo-root `scripts/` directory; header says `Usage: pnpm tsx scripts/coverage-report.ts`

## Evidence
- No script: the root `package.json` has `build/test/lint/lint:dead/type-check/format/format:check/clean` and nothing for coverage.
- No CI: `grep -n "coverage-report\|coverage:report" .github/workflows/*.yml` → nothing; only `ci.yml` mentions coverage at all, via the per-workspace `--coverage` flags.
- No runner: `tsx` is not a root devDependency (root devDeps are turbo, typescript, eslint, knip, @eslint/js, typescript-eslint, prettier, rimraf), so the documented command fails on a clean install.
- Its only mention anywhere is `DEPRECATIONS.md:164`, recording that its *skip-list* was cleaned up on 2026-07-31 — so it was maintained a month ago and then left unreachable.

## Fix
**REFACTOR FIRST (adopt or delete) — one decision, not a deletion.** The code is generic (it walks `packages/*/coverage/coverage-summary.json` and `apps/*/…` against 90 %/80 % baselines) and would still work. Either:
- adopt: add `"coverage:report": "tsx scripts/coverage-report.ts"` and `tsx` to the root devDependencies, and call it after the coverage job in `ci.yml`; or
- delete: `git rm scripts/coverage-report.ts`, remove the `DEPRECATIONS.md:164` reference, and note in the root CLAUDE.md that per-workspace `vitest --coverage` thresholds are the only coverage gate.
The `coverage-testing` skill assumes an aggregate view exists, which argues for adopt.

## Status
OPEN
