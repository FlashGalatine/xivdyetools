# Deep-Dive Analysis Manifest

- **Project:** xivdyetools-discord-worker
- **Analysis Date:** 2026-02-06
- **Scope:** Full src/ directory — all handlers, services, utilities, types, middleware
- **Files Analyzed:** 40+ TypeScript source files
- **Analyzer:** Claude Opus 4.6 Deep-Dive Analysis Skill

## Files Read in Full

### Entry Point & Routing
- `src/index.ts` (928 lines)

### Command Handlers
- `src/handlers/commands/harmony.ts`
- `src/handlers/commands/extractor.ts`
- `src/handlers/commands/budget.ts`
- `src/handlers/commands/preferences.ts`
- `src/handlers/commands/favorites.ts`
- `src/handlers/commands/collection.ts`

### Button Handlers
- `src/handlers/buttons/index.ts`

### Services
- `src/services/analytics.ts`
- `src/services/rate-limiter.ts`
- `src/services/user-storage.ts`
- `src/services/preset-api.ts`
- `src/services/i18n.ts`
- `src/services/bot-i18n.ts`
- `src/services/preferences.ts`
- `src/services/fonts.ts`
- `src/services/svg/renderer.ts`
- `src/services/budget/universalis-client.ts`
- `src/services/budget/budget-calculator.ts`
- `src/services/budget/price-cache.ts`

### Utilities
- `src/utils/discord-api.ts`
- `src/utils/sanitize.ts`

### Types (via exploration agent)
- `src/types/env.ts`
- `src/types/budget.ts`
- `src/types/preferences.ts`
- `src/types/preset.ts`
- `src/types/github.ts`

## Findings Summary
- **Hidden Bugs:** 7
- **Refactoring Opportunities:** 5
- **Optimization Opportunities:** 4
- **Total Findings:** 16
