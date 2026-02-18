# REFACTOR-002: Multiple DyeService Singleton Instantiations

## Priority
LOW

## Category
Code Smell / Inconsistency

## Location
- File(s): src/index.ts:60, src/handlers/commands/favorites.ts:36, src/handlers/commands/collection.ts:42, src/services/budget/budget-calculator.ts:41, src/utils/color.ts (assumed)
- Scope: module level

## Current State
At least 5 files create their own `const dyeService = new DyeService(dyeDatabase)` singleton. While `DyeService` is stateless and lightweight, having multiple instances is wasteful and inconsistent.

## Issues
- Memory: Each instance holds references to the same dye data
- Inconsistency: Some files import from `utils/color.ts`, others create their own
- If DyeService initialization changes (e.g., custom options), updates needed in 5+ places

## Proposed Refactoring
Export a single shared instance from a central location:

```typescript
// utils/color.ts (or a new services/dye.ts)
import { DyeService, dyeDatabase } from '@xivdyetools/core';
export const dyeService = new DyeService(dyeDatabase);
```

All other files import from this single source.

## Benefits
- Single instance, consistent behavior
- One place to change initialization
- Slightly less memory usage

## Effort Estimate
LOW

## Risk Assessment
Minimal risk — DyeService is stateless; replacing instances with imports is mechanical.
