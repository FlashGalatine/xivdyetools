# DEAD-024: api-worker declares `spectral.js` directly but never imports it — same redundancy web-app removed in 2026-08-16 DEAD-007

**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** apps/api-worker · **Semver:** NONE · **Category:** Unused Dependency

## Location
- `apps/api-worker/package.json:26` — `"spectral.js": "^3.0.0"` in `dependencies`

## Evidence
- knip *Unused dependencies* (`evidence/knip-root.txt`).
- `git ls-files apps/api-worker | xargs grep -ln spectral` → `CLAUDE.md`, `README.md`, `package.json`, `vitest.config.ts`. No source import.
- The `vitest.config.ts:9` hit is `deps.inline: ['@xivdyetools/core', '@xivdyetools/test-utils', 'spectral.js']` — a transform directive, not a resolution requirement.
- The real owner declares it: `packages/core/package.json:66`. api-worker reaches spectral only through `@xivdyetools/core/blending`, and under pnpm the import resolves from core's own `node_modules`.
- Precedent: web-app carried the identical redundant declaration; 2026-08-16 DEAD-007 removed it and the suite stayed green.

## Fix
**REMOVE WITH CAUTION** — delete the dependency line, `pnpm install`, then run the api-worker suite specifically (the `deps.inline` entry stays; it is harmless either way, but confirm the blending tests still transform). api-worker CHANGELOG `### Removed`.
Gate: `pnpm turbo run build type-check lint test --filter=xivdyetools-api-worker`.

## Status
FIXED 2026-09-01 `4d4ec7aa` — verified against the real bundler: with the dependency gone, `wrangler deploy --dry-run` still bundles spectral from `packages/core/node_modules`. The CLAUDE.md/README rationale was wrong and both rows went too.

