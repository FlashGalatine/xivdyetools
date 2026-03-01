# @xivdyetools/logger — Unused Exports Summary

## Overview
- **Package:** @xivdyetools/logger v1.2.1
- **Total Exports:** 23 (9 types, 4 classes, 6 functions, 4 const instances)
- **Externally Consumed:** 9 (39.1%)
- **Dead (zero external consumers):** 14 (60.9%)
- **Findings:** DEAD-066 – DEAD-070

## Finding Summary

| ID | Title | Dead Symbols | Recommendation |
|----|-------|:---:|----------------|
| DEAD-066 | Internal implementation classes in barrel | 4 | Mark @internal |
| DEAD-067 | Type exports with zero consumers | 7 | Keep (good DX) |
| DEAD-068 | createSimpleLogger | 1 | Mark @internal |
| DEAD-069 | createWorkerLogger (no direct consumers) | 1 | Mark @internal |
| DEAD-070 | getRequestId (superseded by app-local) | 1 | Remove from barrel |

## Consumed vs Dead by Category

| Category | Consumed | Dead | Example Consumed | Example Dead |
|----------|:---:|:---:|:---:|:---:|
| Types | 2 | 7 | `ExtendedLogger`, `Logger` | `LogLevel`, `LogEntry`, `ErrorTracker` |
| Classes | 0 | 4 | — | `BaseLogger`, `ConsoleAdapter`, `JsonAdapter`, `NoopAdapter` |
| Factory Functions | 3 | 3 | `createRequestLogger`, `createBrowserLogger`, `createLibraryLogger` | `createSimpleLogger`, `createWorkerLogger`, `getRequestId` |
| Const Instances | 4 | 0 | `NoOpLogger`, `ConsoleLogger`, `browserLogger`, `perf` | — |

## Key Pattern: Consumers Use Abstractions, Not Implementations
Logger exports form two layers:
1. **Public API** (all consumed): Factory functions + pre-configured instances + `ExtendedLogger`/`Logger` types
2. **Implementation** (all dead): Base classes, adapter classes, configuration types, low-level factories

This is healthy architecture — the dead exports are implementation details that happen to be in the barrel. Marking them `@internal` is the right fix, not deletion.

## Barrel Size Analysis
The logger barrel (`src/index.ts`) re-exports **23 symbols**. After marking 14 as `@internal`:
- **Public API surface:** 9 symbols (clean, focused)
- **Internal/extensibility:** 14 symbols (available but signaled as non-public)

## Subpath Export Health

| Subpath | Status | Consumers |
|---------|--------|-----------|
| `./browser` | Healthy | web-app |
| `./worker` | Healthy | 4 worker apps |
| `./library` | Consumed | core (re-exports `Logger`, `NoOpLogger`, `ConsoleLogger`) |

All 3 subpath exports have active consumers. No dead subpaths.

## Health Score: A-
Logger has a healthy architecture with clear separation between public API and internals. The "dead" exports are implementation details, not speculative code. The only truly unnecessary export is `getRequestId` (superseded by app patterns). Test coverage is excellent (1.95:1 test-to-source ratio).
