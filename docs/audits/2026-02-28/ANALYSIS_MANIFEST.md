# Dead Code Analysis Manifest

- **Analysis Date:** 2026-02-28
- **Depth:** Exhaustive (automated tools + manual deep analysis + git history archaeology)
- **Analysis Status:** Complete

## Projects Analyzed

| Project | Version | Scope | Findings |
|---------|---------|-------|----------|
| xivdyetools-web-app | v4.2.0 | `apps/web-app/src/` | DEAD-001 – DEAD-019 |
| discord-worker | v4.1.0 | `apps/discord-worker/src/` | DEAD-020 – DEAD-031 |
| @xivdyetools/bot-i18n | v1.0.1 | `packages/bot-i18n/src/` | DEAD-032 – DEAD-035 |
| @xivdyetools/bot-logic | v1.1.0 | `packages/bot-logic/src/` | DEAD-036 – DEAD-041 |

**Total Findings:** 41

## Tools Used

| Tool | Purpose | Used For |
|------|---------|----------|
| Knip v5.85.0 | Unused files, exports, dependencies, types | web-app |
| TypeScript `--noUnusedLocals --noUnusedParameters` | Unused local variables and parameters | All projects |
| depcheck | Unused npm dependencies | web-app, discord-worker |
| Git log archaeology | Files not modified in 6+ months | All projects |
| Manual import tracing | Cross-referenced every flagged item against actual consumers | All projects |
| Monorepo-wide grep | Cross-package consumer analysis | discord-worker, bot-i18n, bot-logic |

## Source Metrics

### web-app (DEAD-001 – DEAD-019)

| Metric | Value |
|--------|-------|
| Production source lines (excl. tests/mockups) | 71,503 |
| Total source files | ~130 |
| Test files | ~65 |
| Mockup files | ~14 |

### discord-worker (DEAD-020 – DEAD-031)

| Metric | Value |
|--------|-------|
| Production source lines (excl. tests) | ~12,000 |
| Total source files | ~80 |
| Test files | ~50 |

### bot-i18n (DEAD-032 – DEAD-035)

| Metric | Value |
|--------|-------|
| Production source lines | ~800 |
| Total source files | ~10 |
| Locale JSON files | 6 |

### bot-logic (DEAD-036 – DEAD-041)

| Metric | Value |
|--------|-------|
| Production source lines | ~2,500 |
| Total source files | ~20 |
