# DEAD-067: 7 type exports with zero external consumers

## Category
Unused Exports (Types)

## Location
- File(s): `packages/logger/src/types.ts`, `packages/logger/src/presets/browser.ts`, `packages/logger/src/presets/worker.ts`
- Symbol(s): `LogLevel`, `LogContext`, `LogEntry`, `LoggerConfig`, `ErrorTracker`, `BrowserLoggerOptions`, `WorkerLoggerOptions`

## Evidence
Monorepo-wide grep for each type name as an import (excluding `packages/logger/`):

| Symbol | External Import Hits | Notes |
|--------|---------------------|-------|
| `LogLevel` | 0 | Workers use string literals `'info'`, `'debug'`, etc. |
| `LogContext` | 0 | Workers pass plain objects, never typed as `LogContext` |
| `LogEntry` | 0 | Internal to logger's write pipeline |
| `LoggerConfig` | 0 | Factory functions accept `Partial<LoggerConfig>` — consumers never import the type |
| `ErrorTracker` | 0 | Only `createBrowserLogger` accepts it; web-app passes Sentry SDK without typing |
| `BrowserLoggerOptions` | 0 | Consumers pass object literals to `createBrowserLogger()` without typing |
| `WorkerLoggerOptions` | 0 | Only `createWorkerLogger` accepts it, but consumers use `createRequestLogger` instead (DEAD-069) |

**Contrast with consumed types:**
- `Logger` (from `/library`) — consumed by core's re-export
- `ExtendedLogger` — consumed by 50+ files across 4 worker apps

## Why They Exist
Standard TypeScript practice: export the types for function parameters so consumers can type-annotate their own variables. In practice, TypeScript's structural typing means consumers pass object literals and let inference handle the typing.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — type names are specific enough for reliable search |
| **Blast Radius** | NONE — types have no runtime cost |
| **Reversibility** | EASY |
| **Hidden Consumers** | UNLIKELY |

## Recommendation
**KEEP** (zero cost, good DX practice)

### Rationale
Exporting types alongside their consuming functions is good TypeScript practice — it enables consumers to opt-in to explicit typing. The fact that current consumers don't use them doesn't mean future consumers won't. Types have zero runtime cost, so there's no benefit to removing them.

Consider adding `@internal` to `LogEntry` (purely internal to the write pipeline) but keep the others as part of the public API surface.
