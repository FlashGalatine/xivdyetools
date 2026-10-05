# DEAD-056: logger BaseLogger.child() and the DelegatingLogger class have no non-test caller anywhere: 79 src lines + ~128 test lines
**Confidence:** HIGH · **Blast radius:** HIGH · **Deploy unit:** packages/logger · **Semver:** MAJOR · **Category:** Test-only · **Origin:** MAIN

## Location
- `packages/logger/src/core/base-logger.ts:439` — BaseLogger.child + DelegatingLogger (narrowed; setContext/time are live)

## Evidence
- Only logger's own tests call .child(): 7 test files, no apps, no stoat-worker. setContext is live (createRequestLogger, worker.ts:120, calls createWorkerLogger, which calls setContext at worker.ts:78; worker-kit middleware/logger.ts:17 uses it). time() is live via timeAsync. child is a required member of the published ExtendedLogger interface.
  - Commands: git grep -n -E '\.(child|setContext|time|timeAsync)\(' -- apps packages ':!packages/logger/src' = README/CLAUDE prose only; git grep -E '\.child\(' -- packages/logger/src = *.test.ts only; git show 4f8a281b (release logger 2.2.1):base-logger.ts:439 child, :484 class DelegatingLogger
- Re-verified independently in the completeness re-sweep: child + DelegatingLogger and is not a new finding. Every `.child(` call is in logger tests or docs, yet child is a member of the published ExtendedLogger (types.ts:135) and DelegatingLogger.timeAsync is tagged @public (base-logger.ts:530).
- Origin: git diff --stat 8ecb878f HEAD -- packages/ touches no logger file; git diff 8ecb878f HEAD -- apps | grep '\.child\(' empty

## Fix
**KEEP.** Part of the published ExtendedLogger contract (types.ts:120-135), shipped in npm 2.2.1. Revisit trigger: the next logger major, where child() could leave the interface. Do not remove DelegatingLogger on its own, because child() constructs it.

Steps: Only at the logger 3.0.0 major:
1. Remove child from ExtendedLogger (types.ts:120-135), BaseLogger.child (base-logger.ts:439-443) and class DelegatingLogger (474-547).
2. Delete the tests at base-logger.test.ts:523-571 and 666-744, plus the child cases in the adapter/preset tests (console-adapter.test.ts:260, json-adapter.test.ts:197,209, noop-adapter.test.ts:129-147, browser.test.ts:424, worker.test.ts:185,300-304).
3. Update README:348 and CLAUDE.md:172.
4. Run pnpm turbo run build type-check lint test --filter=...@xivdyetools/logger, then pnpm dead-code:check.

## Status
KEEP (register) — revisit on the trigger above
