# REFACTOR-004: Deduplicate Checksum Utility

## Priority
**LOW**

## Category
Code Duplication

## Location
- xivdyetools-core/src/utils/index.ts (lines 736-745)
- xivdyetools-web-app/src/shared/utils.ts (was lines 14-23)

## Current State
Two implementations of `generateChecksum()` with a subtle difference:
- **core**: Uses `hash | 0` (bitwise OR with 0)
- **web-app**: Used `hash & hash` (bitwise AND with itself)

Both achieve the same result (convert to 32-bit integer), but `|0` is more idiomatic.

## Issues
- Minor code duplication
- Risk of divergent behavior if one is updated

## Fix Applied
web-app now re-exports `generateChecksum` from @xivdyetools/core:

```typescript
// REFACTOR-004: Re-export generateChecksum from @xivdyetools/core
export { generateChecksum } from '@xivdyetools/core';
```

## Benefits
- Single source of truth
- Uses the more robust implementation (with `|0`)
- Reduced bundle size (deduplication)

## Effort Estimate
**LOW** (~15 minutes)

## Risk Assessment
- Very low risk: Simple re-export, no behavioral change
- web-app already depends on @xivdyetools/core

## Status
**COMPLETED** (2026-01-25)

**Resolution Notes:**
- Replaced local implementation with re-export from @xivdyetools/core
- Type-check verified passing
- No behavioral change expected (both implementations are functionally equivalent)
