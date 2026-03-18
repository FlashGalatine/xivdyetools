# REFACTOR-010: Hardcoded Category Cache TTL in Presets API

## Priority
LOW

## Category
Configuration / Magic Numbers

## Location
- File(s): apps/presets-api/src/handlers/presets.ts (line 519+)
- Scope: constant level

## Current State
```typescript
// presets.ts
const CATEGORY_CACHE_TTL = 60000; // 1 minute
let cachedCategories: string[] | null = null;
let categoryCacheTime = 0;
```

The category cache TTL is a magic number that can't be adjusted without redeployment. In development, a shorter TTL would be useful for testing; in production, a longer TTL would reduce database queries.

## Issues
- Not configurable per environment
- Magic number without documented rationale for the 1-minute value
- Module-level mutable state (cachedCategories, categoryCacheTime) — see also OPT-001

## Proposed Refactoring
```typescript
// Use environment variable with sensible default
const CATEGORY_CACHE_TTL = parseInt(c.env.CATEGORY_CACHE_TTL_MS, 10) || 60_000;
```

Or move to wrangler.toml vars:
```toml
[vars]
CATEGORY_CACHE_TTL_MS = "60000"
```

## Benefits
- Tunable per environment
- Self-documenting with named constant
- Can extend cache TTL in production if categories change infrequently

## Effort Estimate
LOW

## Risk Assessment
None — the default value maintains current behavior
