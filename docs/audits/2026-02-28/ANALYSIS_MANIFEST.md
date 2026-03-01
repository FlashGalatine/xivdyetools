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
| @xivdyetools/core | v1.17.3 | `packages/core/src/` + `packages/core/scripts/` | DEAD-042 – DEAD-056 |
| @xivdyetools/types | v1.8.0 | `packages/types/src/` | DEAD-057 – DEAD-065 |
| @xivdyetools/logger | v1.2.1 | `packages/logger/src/` | DEAD-066 – DEAD-070 |
| @xivdyetools/auth | v1.x | `packages/auth/src/` | DEAD-071 |
| @xivdyetools/color-blending | v1.0.1 | `packages/color-blending/src/` | DEAD-072 |
| @xivdyetools/rate-limiter | v1.x | `packages/rate-limiter/src/` | DEAD-073 – DEAD-075 |
| @xivdyetools/svg | v1.1.1 | `packages/svg/src/` | DEAD-076 – DEAD-082, DEAD-085 |
| @xivdyetools/test-utils | v1.1.3 | `packages/test-utils/src/` | DEAD-083 – DEAD-084 |
| @xivdyetools/crypto | v1.1.0 | `packages/crypto/src/` | _(none — clean)_ |

**Total Findings:** 85

## Tools Used

| Tool | Purpose | Used For |
|------|---------|----------|
| Knip v5.85.0 | Unused files, exports, dependencies, types | web-app |
| TypeScript `--noUnusedLocals --noUnusedParameters` | Unused local variables and parameters | All projects |
| depcheck | Unused npm dependencies | web-app, discord-worker, core |
| Git log archaeology | Files not modified in 6+ months | All projects |
| Manual import tracing | Cross-referenced every flagged item against actual consumers | All projects |
| Monorepo-wide grep | Cross-package consumer analysis | discord-worker, bot-i18n, bot-logic, core, auth, crypto, color-blending, rate-limiter, svg, test-utils |

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

### @xivdyetools/core (DEAD-042 – DEAD-056)

| Metric | Value |
|--------|-------|
| Production source lines (excl. tests) | 8,984 |
| Total source files | 25 |
| Test files | 32 |
| Test lines | 13,554 |
| Script files (non-build) | 7 |
| External consumers (monorepo) | 8 projects |
| Exported symbols (barrel) | ~129 |
| Symbols consumed externally | ~30 |

### @xivdyetools/types (DEAD-057 – DEAD-065)

| Metric | Value |
|--------|-------|
| Production source lines (excl. tests) | 2,576 |
| Total source files | 30 |
| Test files | 4 |
| Test lines | 1,143 |
| Sub-module entry points | 9 (8 subpaths + main barrel) |
| External consumers (monorepo) | 9 projects (core, svg, test-utils, discord-worker, moderation-worker, presets-api, oauth, web-app, + stoat-worker via core) |
| Exported symbols (barrel) | 88 |
| Symbols consumed by apps | 40 |
| Symbols consumed only by core | 15 |
| Truly dead symbols | 25 |

### @xivdyetools/logger (DEAD-066 – DEAD-070)

| Metric | Value |
|--------|-------|
| Production source lines (excl. tests) | 1,491 |
| Total source files | 13 |
| Test files | 8 |
| Test lines | 2,901 |
| Subpath exports | 3 (./browser, ./worker, ./library) |
| External consumers (monorepo) | 7 projects (core, discord-worker, moderation-worker, presets-api, oauth, stoat-worker, web-app) |
| Exported symbols (barrel) | 23 |
| Symbols consumed externally | 9 |
| Dead symbols (zero consumers) | 14 |

### @xivdyetools/auth (DEAD-071)

| Metric | Value |
|--------|-------|
| Production source lines (excl. tests) | 810 |
| Total source files | 5 |
| External consumers (monorepo) | 3 projects (discord-worker, moderation-worker, presets-api) |
| Exported symbols (barrel) | 20 |
| Symbols consumed externally | 8 |
| Dead symbols (zero external consumers) | 12 |
| Actionable dead code | 0 (all are intentional library API) |

### @xivdyetools/crypto _(no findings — clean)_

| Metric | Value |
|--------|-------|
| Production source lines (excl. tests) | 176 |
| Total source files | 3 |
| External consumers (monorepo) | 1 project (@xivdyetools/auth) |
| Exported symbols (barrel) | 8 |
| Symbols consumed externally | 3 |
| Dead symbols | 0 |

### @xivdyetools/color-blending (DEAD-072)

| Metric | Value |
|--------|-------|
| Production source lines (excl. tests) | 432 |
| Total source files | 4 |
| External consumers (monorepo) | 3 projects (bot-logic, svg, discord-worker) |
| Exported symbols (barrel) | 10 |
| Symbols consumed externally | 5 |
| Dead symbols (zero external consumers) | 5 |
| Actionable dead code | 0 (all are intentional library API) |

### @xivdyetools/rate-limiter (DEAD-073 – DEAD-075)

| Metric | Value |
|--------|-------|
| Production source lines (excl. tests) | 1,213 |
| Total source files | ~10 |
| External consumers (monorepo) | 5 projects (universalis-proxy, presets-api, moderation-worker, oauth, discord-worker) |
| Exported symbols (barrel) | 23 |
| Symbols consumed externally | 9 |
| Dead symbols (zero external consumers) | 14 |
| Actionable findings | 2 (orphaned barrel, duplicate interface) |

### @xivdyetools/svg (DEAD-076 – DEAD-082, DEAD-085)

| Metric | Value |
|--------|-------|
| Production source lines (excl. tests) | 3,764 |
| Total source files | ~15 |
| External consumers (monorepo) | 2 projects (bot-logic, discord-worker) |
| Exported symbols (barrel) | ~60 |
| Symbols consumed externally | 18 |
| Dead symbols (zero external consumers) | 42 |
| Actionable findings | 8 (unused locals, duplicated code, dead re-exports, inconsistent patterns) |
| tsc --noUnusedLocals errors | 5 |

### @xivdyetools/test-utils (DEAD-083 – DEAD-084)

| Metric | Value |
|--------|-------|
| Production source lines (excl. tests) | 3,394 |
| Total source files | ~25 |
| External consumers (monorepo) | 4 projects (presets-api, oauth, moderation-worker, svg) |
| Exported symbols (barrel) | ~35 |
| Symbols consumed externally | ~20 |
| Actionable findings | 2 (deprecated nextId() still consumed, legacy counter infrastructure) |
