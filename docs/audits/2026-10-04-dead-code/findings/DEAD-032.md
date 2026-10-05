# DEAD-032: ErrorCode.BAD_REQUEST and ErrorCode.DATABASE_ERROR in presets-api api-response.ts are never read: 2 lines
**Confidence:** HIGH · **Blast radius:** NONE · **Deploy unit:** apps/presets-api · **Semver:** NONE · **Category:** Dead Path · **Origin:** MAIN

## Location
- `apps/presets-api/src/utils/api-response.ts:33` — ErrorCode.BAD_REQUEST / ErrorCode.DATABASE_ERROR

## Evidence
- No code reads ErrorCode.BAD_REQUEST or ErrorCode.DATABASE_ERROR, and nothing uses ErrorCode dynamically (no typeof/Object.values). BAD_REQUEST is still a live wire code, emitted as a string literal in body-validation.ts:73; DATABASE_ERROR is never emitted.
  - Commands: git grep -o 'ErrorCode\.[A-Z_]*' -- apps/presets-api | sort | uniq -c -> 11 members used, not these 2; no 'typeof ErrorCode' or Object.values(ErrorCode); git grep -w DATABASE_ERROR -> api-response.ts:47 + docs/architecture/api-contracts.md:759 ('Reserved') only; BAD_REQUEST -> body-validation.ts:73 literal
- Origin: git grep @8ecb878f -> api-response.ts:33,47 members, body-validation.ts:73 already uses the 'BAD_REQUEST' literal

## Fix
**REFACTOR FIRST.** BAD_REQUEST: do not delete it. Make it live by using ErrorCode.BAD_REQUEST at body-validation.ts:73; api-contracts.md documents it in the ErrorCode table. DATABASE_ERROR: delete it together with its 'Reserved' row at docs/architecture/api-contracts.md:759, since no gate catches a stale symbol in that table.

Steps: 1) apps/presets-api/src/middleware/body-validation.ts: import { ErrorCode } from '../utils/api-response.js' and replace the literal 'BAD_REQUEST' at line 73 with ErrorCode.BAD_REQUEST. 2) apps/presets-api/src/utils/api-response.ts: delete line 47 (DATABASE_ERROR). 3) docs/architecture/api-contracts.md: delete the DATABASE_ERROR row at line 759. 4) pnpm turbo run build type-check lint test --filter=...xivdyetools-presets-api && pnpm dead-code:check && pnpm docs:check-links

## Status
OPEN
