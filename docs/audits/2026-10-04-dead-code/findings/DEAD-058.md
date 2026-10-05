# DEAD-058: types createDyeId/createHue/createSaturation are untagged published exports reached only by tests: 68 src lines + ~200 test lines
**Confidence:** HIGH · **Blast radius:** HIGH · **Deploy unit:** packages/types · **Semver:** MAJOR · **Category:** Test-only · **Origin:** MAIN

## Location
- `packages/types/src/color/branded.ts:98` — createDyeId / createHue / createSaturation

## Evidence
- No production importer in any workspace, stoat-worker included. Only types' own branded.test.ts and core's types/__tests__/{index,types}.test.ts reach them. They are exported from the root barrel and shipped in npm 3.2.0, but carry no @public tag.
  - Commands: git grep -n -w -e createDyeId -e createHue -e createSaturation -- . ':!docs/audits/**' outside branded.ts = barrels color/index.ts:21, src/index.ts:28, test files, and .md docs only; git show 0d82c5cb (types 3.2.0):packages/types/src/index.ts:28 exports all three
- Re-verified independently in the completeness re-sweep: The only consumers are the types branded.test.ts and two core test files that import them directly from @xivdyetools/types. They are root and /color barrel exports in the published 3.2.0.
- Origin: git diff --stat 8ecb878f HEAD -- packages/ touches no types file; git diff 8ecb878f HEAD -- apps | grep -E 'createDyeId|createHue|createSaturation' empty

## Fix
**KEEP.** Published API in README:287-289. Revisit trigger: the next types major. Meanwhile, tag them explicitly so the exemption is documented.

Steps: Now (optional):
- Add a bare `/** @public */` to each of the three specifiers in packages/types/src/index.ts:28 (and color/index.ts:21).
- Do not write reason prose that names sibling exports (self-reference trap).
- Run pnpm turbo run build type-check lint test --filter=...@xivdyetools/types, then pnpm dead-code:check.
At types 4.0.0:
- Delete branded.ts:78-105, 114-134 and 143-161 and the barrel specifiers.
- Delete the matching tests: types branded.test.ts:98-~306, core index.test.ts:97-243, core types.test.ts:110-~410.

## Status
KEEP (register) — revisit on the trigger above
