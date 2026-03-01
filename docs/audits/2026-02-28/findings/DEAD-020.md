# DEAD-020: Entire Dead Service/Utility Files (discord-worker)

## Category
Orphaned File

## Location
- `apps/discord-worker/src/utils/css-colors.ts` (169 lines)
- `apps/discord-worker/src/utils/error-response.ts` (439 lines)
- `apps/discord-worker/src/services/color-blending.ts` (14 lines)
- `apps/discord-worker/src/services/image-cache.ts` (431 lines)
- `apps/discord-worker/src/services/pagination.ts` (402 lines)
- `apps/discord-worker/src/services/progress.ts` (310 lines)
- `apps/discord-worker/src/services/user-preferences.ts` (124 lines)

**Total: ~1,889 lines of dead production code**

## Evidence

### css-colors.ts
- **Zero imports anywhere** — not even test files.
- Near-identical duplicate of `packages/bot-logic/src/css-colors.ts`.
- Last touched: monorepo migration commit (`79e945a`).
- The canonical copy is in bot-logic, consumed via `resolveColorInput()`.

### error-response.ts
- Only imported by `error-response.test.ts`.
- Zero production code imports from this file.
- Provides 23 exports (error codes, response builders) that no handler uses.

### color-blending.ts
- Re-export barrel of `@xivdyetools/color-blending`.
- Only imported by `color-blending.test.ts` and `color-blending.integration.test.ts`.
- Production code imports `@xivdyetools/color-blending` directly or uses `bot-logic`.

### image-cache.ts
- R2-based image caching layer with cache key builders for every command.
- Only imported by `image-cache.test.ts`.
- Fully scaffolded but never wired into any command handler.

### pagination.ts
- Complete pagination system (state management, button builders, navigation).
- Only imported by `pagination.test.ts`.
- Never integrated into any command that produces paginated results.

### progress.ts
- Progress tracker with animated spinners, queue position, cooldown messages.
- Only imported by `progress.test.ts`.
- Planned for V4 deferred processing but never used.

### user-preferences.ts
- Legacy world-only preference system using `budget:world:v1:{userId}`.
- Superseded by unified `preferences.ts` (which even migrates old keys).
- Only imported by `user-preferences.test.ts`.

## Why It Exists
These files were scaffolded during V4 development or migrated from the old bot architecture. The functionality either:
- Was superseded by newer implementations (css-colors → bot-logic, user-preferences → preferences)
- Was speculatively built but never integrated (image-cache, pagination, progress)
- Was a re-export convenience never adopted (color-blending, error-response)

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — zero production imports for all 7 files |
| **Runtime Impact** | NONE — these modules are never loaded at runtime |
| **Build Impact** | Reduces bundle size, speeds up TypeScript compilation |
| **Test Impact** | Corresponding test files become orphaned and should also be removed |
| **External Consumers** | None — discord-worker is a private app |

## Recommendation
**REMOVE ALL 7 FILES** and their corresponding test files. This is the single highest-impact cleanup action (~1,889 production lines + ~2,000+ test lines).

### Test files to also remove:
- `src/utils/error-response.test.ts`
- `src/services/color-blending.test.ts`
- `src/services/color-blending.integration.test.ts`
- `src/services/image-cache.test.ts`
- `src/services/pagination.test.ts`
- `src/services/progress.test.ts`
- `src/services/user-preferences.test.ts`
