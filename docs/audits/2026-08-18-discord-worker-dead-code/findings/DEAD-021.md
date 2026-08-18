# [DEAD-021]: logger — `perf` (122 lines, test-only), deprecated `getRequestId(request)` (dead; a CHANGELOG claim about it is false), `createSimpleLogger` (dead)

## Category
Unused Export (TEST-ONLY / DEAD)

## Location
- `packages/logger/src/presets/browser.ts:181-302` — `perf` (122 lines; ~200 test lines in `browser.test.ts` + web-app `shared/__tests__/logger.test.ts` §perf). web-app `shared/logger.ts:17` re-exports it, but the only importer of `perf` from `shared/logger` is that file's own test; `__tests__/setup.ts` mocks it. No production code calls `perf.*`
- `packages/logger/src/presets/worker.ts:130-152` — `getRequestId(request)` (`@deprecated`, `@internal`, ~22 lines + `worker.test.ts:248+`). Not on any barrel; **`createRequestLogger` (worker.ts:112-127) never calls it** despite the comment and the CHANGELOG DEAD-070 note ("remains … for internal use by `createRequestLogger`"). Every worker uses worker-kit's different `getRequestId(c)`
- `packages/logger/src/core/base-logger.ts:392-403` — `createSimpleLogger` (`@internal` since DEAD-068, 12 lines + test block); zero callers
- **KEEP**: `BaseLogger`, `ConsoleAdapter`/`JsonAdapter`/`NoopAdapter`, `createBrowserLogger` (README extension points; consumed internally by the presets); root re-exports of `browserLogger`, `perf`, `createRequestLogger`, `NoOpLogger`, `ConsoleLogger` are REDUNDANT-RE-EXPORTs (consumers use `/browser`, `/library`, `/worker`) — harmless public surface; `CORE_REDACT_FIELDS`/`DEFAULT_REDACT_FIELDS` "duplicate export" is an intentional alias used by base-logger; `createWorkerLogger` is INTERNAL-ONLY (the two grep hits in worker-kit `rate-limiter/types.ts:208,243` are JSDoc `@example` blocks)
- Stale docs: `presets/library.ts` examples still say `from 'xivdyetools-core'` (pre-scope name)

## Evidence
`git grep -n "perf\." apps packages --include=*.ts | grep -v test | grep -v packages/logger` → 0. `grep -n getRequestId packages/logger/src/presets/worker.ts` → definition + comment only, no call inside `createRequestLogger`. `git grep -nw createSimpleLogger` outside logger → 0.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH |
| **Blast Radius** | LOW — `perf` removal touches web-app `shared/logger.ts:17` re-export + its test + `setup.ts` mock; `getRequestId` is not on a barrel; `createSimpleLogger` is `@internal` |
| **Reversibility** | EASY |
| **Hidden Consumers** | None (npm-published; DEPRECATIONS.md names workspace consumers only) |

## Recommendation
**REMOVE** all three (+ their tests, the web-app re-export line, and correct the CHANGELOG DEAD-070 sentence).
