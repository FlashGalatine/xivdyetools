# REFACTOR-001: Vitest Version Mismatch Across Monorepo

## Priority
HIGH

## Category
Tooling / Consistency

## Location
- File(s): apps/oauth/package.json, apps/presets-api/package.json (Vitest 3.2) vs all other packages (Vitest 4.0)
- Scope: monorepo-wide

## Current State
The monorepo has two Vitest versions:
- **Vitest 4.0.18** — used by 6+ packages (core, auth, crypto, logger, rate-limiter, discord-worker, web-app, etc.)
- **Vitest 3.2.4** — used by oauth and presets-api (required by `@cloudflare/vitest-pool-workers@^0.12.20`)

The `@cloudflare/vitest-pool-workers` package provides Cloudflare Workers-specific test bindings (D1, KV, R2 mocks running in actual miniflare) and currently only supports Vitest 3.x.

## Issues
- Two different coverage providers: `@vitest/coverage-v8@^4.0.18` vs `@vitest/coverage-v8@^3.2.4`
- Test configuration patterns diverge between Vitest versions
- Developers must be aware which test framework version each project uses
- pnpm may deduplicate incorrectly across version ranges

## Proposed Refactoring
1. **Monitor** `@cloudflare/vitest-pool-workers` for Vitest 4 support (check changelogs/issues)
2. **Document** the constraint explicitly in the root `CLAUDE.md` and affected package `CLAUDE.md` files
3. **When Vitest 4 is supported**: Upgrade oauth and presets-api, unify all coverage dependencies
4. **Alternative**: Consider migrating away from `@cloudflare/vitest-pool-workers` to use `@xivdyetools/test-utils` mocks instead (already exists in the monorepo)

## Benefits
- Unified testing configuration across all projects
- Simpler dependency management
- Consistent coverage reporting

## Effort Estimate
LOW (documentation) / MEDIUM (migration when vitest-pool-workers supports v4)

## Risk Assessment
Low — the current split works, it's just inconvenient. Forced migration could break CF-specific test bindings.
