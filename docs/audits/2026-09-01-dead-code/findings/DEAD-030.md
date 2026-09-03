# DEAD-030: stoat-worker (parked) — one orphaned module and three test-only exports, plus four unused test imports the disabled `noUnusedLocals` hides — 120 lines

**Confidence:** HIGH · **Blast radius:** NONE · **Deploy unit:** apps/stoat-worker · **Semver:** NONE · **Category:** Orphaned File / Unused Export / Stale Test

## Location
- `src/services/loading-indicator.ts` (44 lines) — `withLoadingIndicator`; **no production importer**, one test file
- `src/commands/parser.ts:131-196` — `parseMultiDyeArgs` (66 lines) and its `MultiDyeArgs` type
- `src/config.ts:54-59` — `isAuthorized` (6 lines)
- `src/commands/index.test.ts:14`, `src/services/dye-resolver.test.ts:8,13` — unused imports `CommandContext`, `vi`, `beforeEach`, `DyeResolutionResult`

## Evidence
- `evidence/test-only-modules.sh` → `loading-indicator.ts prodImporters=0 testImporters=1`; `evidence/symrefs-stoat-worker.txt` → `parseMultiDyeArgs prod=1 tests=10`, `withLoadingIndicator prod=1 tests=11`, `isAuthorized prod=1 tests=5` (its "other" hits are discord-worker's own).
- `evidence/tsc-unused.txt`: stoat-worker is the **only** workspace with `TS6133` unused-symbol errors — four of them — because its `tsconfig.json` sets `noUnusedLocals: false` / `noUnusedParameters: false` against the base config (see DEAD-032).
- `apps/stoat-worker` is parked by policy (`audit-shared/units.md`: "no active investment; file findings, tag P3 unless security").

## Fix
**KEEP for now — P3.** Removing code from a parked Revolt bot buys nothing a reader needs, and the whole app is a candidate for retirement rather than pruning.
**Revisit trigger:** the moment stoat-worker is either (a) un-parked for active work — do this cleanup in the first sprint, starting with turning `noUnusedLocals` back on, or (b) formally retired — then the finding is superseded by deleting the app and adding a `DEPRECATIONS.md` entry.

## Status
OPEN (KEEP, P3) — stoat-worker stays parked. Its four unused test imports were removed as part of DEAD-032 (`8c12d0ac`) so the tsconfig override could go.

