# DEAD-017: Test fixture module __fixtures__/chara-fixtures ships in the published bot-logic tarball
**Confidence:** HIGH · **Blast radius:** NONE · **Deploy unit:** bot-logic (packaging only; ships with the next bot-logic version bump, no worker redeploy needed) · **Semver:** NONE · **Category:** Legacy

## Location
- `packages/bot-logic/tsconfig.build.json:7`
- `packages/bot-logic/vitest.config.ts:14-20`
- `packages/bot-logic/src/commands/__fixtures__/chara-fixtures.ts (stays as is)`

## Evidence
- npm pack @xivdyetools/bot-logic@4.11.0 --dry-run --json (scratchpad): entryCount 101, includes dist/commands/__fixtures__/chara-fixtures.{js,d.ts,js.map,d.ts.map}. Local dist: 98 files + package.json/README/LICENSE = 101, and npm view gives dist.fileCount 101. tsconfig.build.json exclude lists only node_modules, dist, **/*.test.ts, **/__tests__/**. package.json exports: '.' and './i18n' only, so deep imports are blocked. git grep chara-fixtures: importers are only swatch.test.ts:18, swatch-library.test.ts:34, glamour-library.test.ts:21. No dist file outside __fixtures__ references it. Coverage: the fixture is included (17/17 lines). The total is 99.76% lines, so dropping it leaves the 90% thresholds safe.
- The fixture is test-only data: 71 lines of inlined .chara documents plus canary helpers, imported only by three test files. It reaches the published tarball because the build config excludes __tests__ but not __fixtures__. The exports map makes it unreachable to npm consumers, so leaving it out of the build is not a breaking change. type-check still uses tsconfig.json, which includes it, and tests and knip are unaffected. The file itself is kept.
- Still live: None in production. Test-only importers: packages/bot-logic/src/commands/swatch.test.ts:18, swatch-library.test.ts:34, glamour-library.test.ts:21

## Fix
- **REMOVE** — 1) In packages/bot-logic/tsconfig.build.json, add "**/__fixtures__/**" to exclude. 2) In packages/bot-logic/vitest.config.ts, add 'src/**/__fixtures__/**' to coverage.exclude. 3) Delete stale local dist (pnpm --filter @xivdyetools/bot-logic run clean) and rebuild. Check that dist/commands/__fixtures__ is absent and that npm pack --dry-run lists 97 entries. 4) Gate: pnpm turbo run build type-check lint test --filter=...@xivdyetools/bot-logic. 5) Add a patch-level CHANGELOG note, and ship it on the next version bump.
- Cascade: None. The source file stays as a test fixture. scripts/check-dead-code.ts:69 already treats __fixtures__/ as test-side.
- Published: The files are present in npm 4.11.0, but no exports-map path reaches them, so dropping them from the next tarball changes no public API (semver NONE, can ride a patch).

## Status
OPEN — source prepared; release pending. [A-BOT-LOGIC evidence](../../2026-10-26-security/evidence/remediation-bot-logic-2026-10-27.md).
