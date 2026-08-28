# [DEAD-031]: core orphan tooling — `test-build.mjs`, the unwired TypeDoc setup (`typedoc.json` + `docs` script + 2 devDeps), and the `VERSION` build step nobody reads

## Category
Orphaned File / Dead Config / Unused Dependency

## Location
- `packages/core/test-build.mjs` (117 lines) — smoke script importing from `./dist/index.js`; referenced by no package.json script, turbo task or workflow (`git ls-files | xargs grep -l test-build` → nothing); last touched in the monorepo-migration commit `e823275`
- `packages/core/typedoc.json` (25 lines) + `package.json` `"docs": "typedoc"` + devDeps `typedoc`, `typedoc-plugin-markdown` — the `docs` script is not in `turbo.json`, not in any workflow, its `docs/api` output is not gitignored, and the public developer docs are VitePress in `api-worker`. `typedoc.json` has no `plugin` key and `theme: default`, so the markdown plugin is never loaded (knip was right; the 2026-02-28 audit's "keep" was wrong). `packages/core/CLAUDE.md:20` still advertises `pnpm --filter @xivdyetools/core run docs # TypeDoc → markdown`
- `packages/core/src/version.ts` (generated) + `scripts/generate-version.ts` (38 lines) + `build:version` script — exist to export `VERSION`, which has zero importers in the monorepo (web-app's `VERSION` hits are an unrelated locale label). README/CLAUDE document it → DOCUMENTED-PUBLIC-API with 0 consumers (~45 lines incl. build wiring)

## Evidence
See `evidence/track-B-core.md` §0.4–0.6, §7.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH (test-build, typedoc); HIGH-unused / MEDIUM-keep-decision (VERSION — a package exposing its own version is a conventional API) |
| **Blast Radius** | LOW; removing `build:version` shortens the core build; removing typedoc drops 2 devDeps |
| **Reversibility** | EASY |

## Recommendation
**REMOVE** `test-build.mjs` and the TypeDoc setup (script, json, 2 devDeps, CLAUDE.md line). **REMOVE WITH CAUTION** the `VERSION` machinery — or keep it deliberately as public API and note that nothing in-repo reads it; either way stop calling it a build step nobody uses without saying so.
