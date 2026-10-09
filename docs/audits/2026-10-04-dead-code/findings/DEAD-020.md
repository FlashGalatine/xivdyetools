# DEAD-020: APIService static formatPrice/getPriceData/isInitialized are test-only — 25 src lines + 72 test lines
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** apps/web-app · **Semver:** NONE · **Category:** Test-only · **Origin:** MAIN

## Location
- `apps/web-app/src/services/api-service-wrapper.ts:239` — APIService.formatPrice/getPriceData/isInitialized (+ initialized flag)

## Evidence
- Production calls only APIService.getInstance() and clearCache() (index.ts:126, market-board-service.ts:108,435, auth-service.ts:772). The initialized flag has no production reader, so isInitialized observes state that exists only for itself. The other formatPrice hits are different symbols.
  - Commands: git grep 'APIService' apps/web-app non-test: getInstance/clearCache only; market-board-service.ts:475 names APIService.formatPrice in a comment; api-service-wrapper.test.ts:68-85, 93-124, 477-498 are the only callers
- Origin: api-service-wrapper.ts unchanged between 8ecb878f and HEAD; the same test-only state holds at 8ecb878f.

## Fix
**REMOVE.** Keep resetInstance (test reset hook over the live singleton) and the .then() debug log. Only the APIService.initialized write goes.

Steps: In apps/web-app/src/services/api-service-wrapper.ts delete the initialized field (183), the APIService.initialized = true write (207), isInitialized (221-227), formatPrice (235-242) and getPriceData (250-259). In api-service-wrapper.test.ts delete describe('formatPrice') 68-85, describe('getPriceData') 93-124 and the APIService.isInitialized block 477-498. Run pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app and pnpm dead-code:check.

Correction from the final adversarial check: The test file is apps/web-app/src/services/__tests__/api-service-wrapper.test.ts; the cited line ranges (68-85, 93-124, 477-498) are correct for it.

## Status
REMOVED, NOT DEPLOYED — `057cba2f` (branch `fix/remediation-2026-10-04-sprint23`, web-app 5.14.7; PR #253, open, stacked on #252).
