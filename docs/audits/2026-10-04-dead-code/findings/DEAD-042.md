# DEAD-042: createMockD1 in test-utils cloudflare/d1.ts is reached only by its own unit test: 22 src lines + 18 test lines
**Confidence:** HIGH · **Blast radius:** NONE · **Deploy unit:** packages/test-utils · **Semver:** NONE · **Category:** Test-only · **Origin:** MAIN

## Location
- `packages/test-utils/src/cloudflare/d1.ts:477` — createMockD1

## Evidence
- The only code reference is tests/cloudflare/d1.test.ts:5,466,475. Every app uses createMockD1Database. The gate missed it because the @example at d1.ts:466 counts as a raw-text self-reference. Private package, so no npm consumers.
  - Commands: git grep -n -w createMockD1 -- . ':!docs/audits/**' = d1.ts:466(JSDoc),477; d1.test.ts:5,464,466,475; prose only in discord-worker CHANGELOG and docs; barrel: cloudflare/index.ts:14 `export * from './d1.js'`
- Origin: git diff --stat 8ecb878f HEAD -- packages/ touches no test-utils file; app-side diff grep for createMockD1 empty

## Fix
**REMOVE.** Private test-only package. A plain removal is safe.

Steps: 1. Delete d1.ts:458-479 (docblock + function).
2. In tests/cloudflare/d1.test.ts, remove createMockD1 from the line-5 import and delete only the two `it` blocks at 465-482. Keep the nested 'mutation meta and batch atomicity (BUG-099)' describe (487+), which uses createMockD1Database, and rename or re-parent the outer describe('createMockD1').
3. Update the living docs docs/developer-guides/testing.md:36 and docs/projects/test-utils/overview.md:56. Leave docs/research alone.
4. Run pnpm turbo run build type-check lint test --filter=...@xivdyetools/test-utils, then pnpm dead-code:check.

## Status
REMOVED, NOT DEPLOYED — `c73b702f` (branch `fix/remediation-2026-10-04-sprint19`, test-utils 3.0.0; PR #274, open).
