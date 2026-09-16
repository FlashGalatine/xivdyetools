# DEAD-017: Inert image-worker environment member — 1 source line
**Confidence:** HIGH · **Blast radius:** NONE · **Deploy unit:** image-worker · **Semver:** NONE · **Category:** Unused Type

## Location
- `apps/image-worker/src/types.ts:12; src/index.ts:59`.

## Evidence
- Wrangler sets no ENVIRONMENT variable and loggerMiddleware has readEnvironmentFromEnv:false. Only index.test.ts:5 and index-limits.test.ts:24 populate it.
- See [tracked references](../evidence/reference-evidence.txt), [syntax survey](../evidence/syntax-survey.json) and [verification](../evidence/verification.md). Test boundaries: [measured spans](../evidence/test-removal-spans.json).

## Fix
- **REFACTOR FIRST** — Replace the one-field Env contract with an explicit empty binding type (for example Record<string, never>) and change the two fixture values to {}. Run lint/type-check; do not introduce an empty-interface lint violation.
- Gate: `pnpm turbo run build type-check lint test --filter=xivdyetools-image-worker`.

## Status
OPEN — recommendation only; no source change made.
