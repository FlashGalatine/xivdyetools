# Dead Code Analysis Manifest

- **Project:** xivdyetools-web-app (v4.2.0)
- **Analysis Date:** 2026-02-28
- **Scope:** `apps/web-app/src/` (all TypeScript, JS, CSS source files)
- **Depth:** Exhaustive (automated tools + manual deep analysis + git history archaeology)
- **Analysis Status:** Complete

## Tools Used

| Tool | Purpose |
|------|---------|
| Knip v5.85.0 | Unused files, exports, dependencies, types |
| TypeScript `--noUnusedLocals --noUnusedParameters` | Unused local variables and parameters |
| depcheck | Unused npm dependencies |
| Git log archaeology | Files not modified in 1+ year |
| Manual import tracing | Cross-referenced every flagged item against actual consumers |

## Source Metrics

| Metric | Value |
|--------|-------|
| Production source lines (excl. tests/mockups) | 71,503 |
| Total source files | ~130 |
| Test files | ~65 |
| Mockup files | ~14 |
