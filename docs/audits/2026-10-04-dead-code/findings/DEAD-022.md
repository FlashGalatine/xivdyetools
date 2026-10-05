# DEAD-022: shared/__tests__/types.test.ts tests @xivdyetools/types, not web-app — 361 test lines
**Confidence:** HIGH · **Blast radius:** NONE · **Deploy unit:** apps/web-app · **Semver:** NONE · **Category:** Stale Test · **Origin:** MAIN

## Location
- `apps/web-app/src/shared/__tests__/types.test.ts:1` — types.test.ts

## Evidence
- It imports createHexColor/AppError/ErrorCode from @xivdyetools/types only (line 12). src/shared/types.ts neither defines nor re-exports any of them (it holds Theme/World/DataCenter types and is istanbul-ignored). packages/types has app-error.test.ts (35 its) and branded.test.ts (44 its).
  - Commands: grep 'from ' types.test.ts: vitest + '@xivdyetools/types' only; grep -n export apps/web-app/src/shared/types.ts: ThemeName/ThemePalette/Theme/DataCenter/World only
- Origin: git cat-file -e 8ecb878f:apps/web-app/src/shared/__tests__/types.test.ts succeeds; untouched by the PRs.

## Fix
**REMOVE WITH CAUTION.** First check that its toJSON/severity/prototype-chain/ErrorCode-enum cases have counterparts in packages/types/src/error/app-error.test.ts, and port any that do not. Web-app coverage does not move.

Steps: Delete apps/web-app/src/shared/__tests__/types.test.ts after porting any uncovered case into packages/types/src/error/app-error.test.ts or color/branded.test.ts. Run pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app (and --filter=@xivdyetools/types if ported), then pnpm dead-code:check.

Correction from the final adversarial check: Port the 8-digit alpha case ('#FF0000FF') to packages/types branded.test.ts first; every other case already has a counterpart in the package tests.

## Status
OPEN
