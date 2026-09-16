# DEAD-016: CacheConfigKey belongs to its test — 1 source line
**Confidence:** HIGH · **Blast radius:** NONE · **Deploy unit:** api-worker · **Semver:** NONE · **Category:** Unused Type

## Location
- `apps/api-worker/src/universalis/config/cache.ts:49`.

## Evidence
- Only cache.test.ts:6,120 imports/uses it. Runtime configuration already satisfies Record<string, CacheConfig>; separate Object.entries tests inspect actual entries.
- See [tracked references](../evidence/reference-evidence.txt), [syntax survey](../evidence/syntax-survey.json) and [verification](../evidence/verification.md). Test boundaries: [measured spans](../evidence/test-removal-spans.json).

## Fix
- **REFACTOR FIRST** — Move the alias into cache.test.ts or inline keyof typeof CACHE_CONFIGS there, then delete its source export/import. Preserve the existing key and runtime-entry assertions.
- Gate: `pnpm turbo run build type-check lint test --filter=xivdyetools-api-worker`.

## Status
DONE — removed in `6fce09cf` (2026-09-16, branch cleanup/dead-code-2026-09-15).
