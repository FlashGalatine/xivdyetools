# DEAD-011: BaseLitComponent hasError/errorMessage @state is write-only (10 lines)
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** apps/web-app · **Semver:** NONE · **Category:** Dead Path · **Origin:** MAIN

## Location
- `apps/web-app/src/components/v4/base-lit-component.ts:33` — hasError/errorMessage @state

## Evidence
- hasError and errorMessage are written only in setError (base-lit-component.ts:125-126). No render in the 14 subclasses, no test and no e2e reads either identifier; the only other hasError hits are BaseComponent's own errorState and auth-service.
  - Commands: git grep -E "\bhasError\b|\berrorMessage\b|setError\(" over apps/web-app/src+e2e: writes at 125-126 only; callers are share-button.ts:294,322.; The @state does not reflect to an attribute, so no CSS hook can read it.
- Origin: git grep at 8ecb878f: base-lit-component.ts:34,37,124-126 and share-button.ts:294,322 are identical to HEAD, with no reader.

## Fix
**REMOVE.** After the change, setError only logs when an Error is passed, so the share-button.ts:294 call does nothing. Either inline it as a logger call or delete it. Keep isReady (locale-switch.test.ts:56).

Steps: 1) base-lit-component.ts: delete 30-37 (docblock, two @state fields) and the assignments at 125-126.
2) Decide on share-button.ts:294: replace it with logger.warn or drop it.
3) pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app && pnpm dead-code:check

## Status
OPEN
