# DEAD-057: logger createBrowserLogger's errorTracker branch never runs in-repo (published extension point): ~90 src lines + 207 test lines
**Confidence:** HIGH · **Blast radius:** HIGH · **Deploy unit:** packages/logger · **Semver:** MAJOR · **Category:** Unused Export · **Origin:** MAIN

## Location
- `packages/logger/src/presets/browser.ts:102` — createBrowserLogger errorTracker branch + ErrorTracker + BaseLogger.redactContext/sanitizeMessage (narrowed)

## Evidence
- No caller passes errorTracker: web-app shared/logger.ts:71,74 passes only {isDev}. redactContext/sanitizeMessage are called only inside that branch. devOnly and prefix are NOT dead, since their defaults are read on every call (lines 85, 92, 95).
  - Commands: git grep -n -w -e errorTracker -e ErrorTracker -- apps packages ':!*.md' (non-test) = browser.ts + types.ts:203 + index.ts:86 only; createBrowserLogger callers = web-app logger.ts:71,74; git grep -E '\.(redactContext|sanitizeMessage)\(' non-test = browser.ts:111-137 only; git show 4f8a281b (logger 2.2.1): browser.ts has 8 errorTracker refs, base-logger.ts:399 redactContext
- Origin: git diff --stat 8ecb878f HEAD -- packages/ touches no logger file; git diff 8ecb878f HEAD -- apps | grep errorTracker empty

## Fix
**KEEP.** A documented, published extension point (Sentry integration; @public createBrowserLogger, exported ErrorTracker type), and it carries BUG-026/FINDING-026 redaction. Revisit trigger: the next logger major, or a decision that no consumer will ever wire an error tracker.

Steps: Only at a logger major:
1. Remove the errorTracker option and branch (browser.ts:23-24 and 101-139), the ErrorTracker interface (types.ts ~197-235) with its index.ts:86 export, and BaseLogger.redactContext/sanitizeMessage (base-logger.ts:394-405).
2. Delete the 'error tracking integration' describe at browser.test.ts:189-395.
3. Run pnpm turbo run build type-check lint test --filter=...@xivdyetools/logger, then pnpm dead-code:check.

## Status
KEEP (register) — revisit on the trigger above
