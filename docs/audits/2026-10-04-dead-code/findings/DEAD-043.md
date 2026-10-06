# DEAD-043: randomStainId in test-utils factories/dye.ts is test-only — 9 lines + 6-line test
**Confidence:** HIGH · **Blast radius:** NONE · **Deploy unit:** packages/test-utils · **Semver:** NONE · **Category:** Test-only · **Origin:** MAIN

## Location
- `packages/test-utils/src/factories/dye.ts:72` — randomStainId

## Evidence
- Reached only by its own self-test (dye.test.ts:272). Other hits are comments (dye.ts:70, factories/index.ts:9) and docs. test-utils is private:true, so it has no npm consumers.
  - Commands: git grep -n -w randomStainId -- . ':!docs/audits/**': def dye.ts:72; test dye.test.ts:5,272; rest are comments/docs/CHANGELOG; packages/test-utils/package.json:4 "private": true
- Origin: `git grep -n -w randomStainId 8ecb878f -- apps packages` gives the same set: def dye.ts:72, comments :70 and index.ts:9, test dye.test.ts:5,272. No PR touches the file.

## Fix
**REMOVE.** MAX_STAIN_ID stays live (dye.ts:47,49). No other workspace imports it through @xivdyetools/test-utils.

Steps: Delete packages/test-utils/src/factories/dye.ts 66-74 (JSDoc and fn) and the blank line after it. Delete the test 'exposes an opt-in random draw' at dye.test.ts 270-275, and drop randomStainId from the import on line 5. Reword the comment at factories/index.ts:9. Update docs/developer-guides/testing.md:50 and docs/projects/test-utils/overview.md:132,140. Add a new test-utils CHANGELOG entry and leave the old one at line 20 as is. Run `pnpm turbo run build type-check lint test --filter=...@xivdyetools/test-utils && pnpm dead-code:check && pnpm docs:check-links`.

## Status
REMOVED, NOT DEPLOYED — `c73b702f` (branch `fix/remediation-2026-10-04-sprint19`, test-utils 3.0.0; PR #274, open).
