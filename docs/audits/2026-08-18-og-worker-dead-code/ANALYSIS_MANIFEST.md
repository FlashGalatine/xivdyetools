# Dead Code Analysis Manifest

- **Project:** `xivdyetools-og-worker` 2.0.0 (`apps/og-worker`)
- **Analysis Date:** 2026-08-18
- **Branch / commit:** `monorepo-2.0-prep` @ `e6eccf83` (clean tree)
- **Scope:** `apps/og-worker` — `src/**` (4,283 non-test lines / 24 files), `tests/**`, `scripts/**` (1 Python font-subset script), `wrangler.toml`, `vitest.config.ts`, `package.json`, docs (`README.md`, `CLAUDE.md`, `CHANGELOG.md`).
  Package-side symbols (`@xivdyetools/svg`, `core`, `worker-kit`, `types`) are **out of scope** here — they were covered by the 2026-08-18 discord-worker + packages audit; this audit only checks that og-worker's *imports* of them are live.
- **Depth:** standard — symbol-level (exports, class members, dead branches, config, deps, fonts/assets, docs drift)
- **Analysis Status:** Complete — 28 findings, report at `DEAD_CODE_REPORT.md`. **Cleanup executed 2026-08-18** in four commits on `monorepo-2.0-prep`: wave 1 `a8201b32`, wave 2 `ebcac54c`, wave 3 `f3ad612c`, wave 4 (this commit); og-worker → 2.1.0. See the report's "Cleanup executed" section for the deviations.
