# Dead Code Analysis Manifest

- **Project:** `xivdyetools-discord-worker` 5.0.0 + the workspace packages it depends on
- **Analysis Date:** 2026-08-18
- **Branch / commit:** `monorepo-2.0-prep` @ `84b6cf1` (clean tree)
- **Scope:**
  - `apps/discord-worker` (15,278 src lines / 61 files; 15,953 test lines)
  - `packages/bot-logic` (2,975 / 19; incl. `/i18n`)
  - `packages/svg` (5,201 / 17)
  - `packages/core` (13,511 / 40; incl. `/blending`)
  - `packages/worker-kit` (1,977 / 15; incl. `/rate-limiter`)
  - `packages/auth` (1,128 / 9; incl. `/encoding`)
  - `packages/logger` (1,588 / 13)
  - `packages/types` (2,719 / 32)
  - `packages/test-utils` (3,797 / 32; devDependency, workspace-private)
- **Depth:** standard — symbol-level
- **Consumer rule for packages:** a package export is only "dead" if **no workspace in the monorepo** (all 9 apps + all packages, tests included) imports it. Packages are npm-published, so public-API removals are flagged one confidence tier lower and cross-checked against `DEPRECATIONS.md`.
- **Analysis Status:** Complete — 37 findings, report at `DEAD_CODE_REPORT.md`; Cleanup executed 2026-08-18 (waves 1–4, commits 9bbf889f..994804e8)
