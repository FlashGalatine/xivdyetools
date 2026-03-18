# REFACTOR-005: getDyesInternal() Returns Mutable Internal Array

## Priority
MEDIUM

## Category
Encapsulation / Leaky Abstraction

## Location
- File(s): packages/core/src/services/dye/DyeDatabase.ts
- Scope: function level

## Current State
`getDyesInternal()` returns `this.dyes` — the actual internal array, not a copy. Callers can accidentally mutate the array (push, pop, sort, splice) and corrupt the database for all subsequent operations within the same isolate.

The method is marked with `@internal` JSDoc but is exported and used by:
- `DyeSearch.searchByName()` — filters but doesn't mutate
- `DyeSearch.searchByCategory()` — filters but doesn't mutate
- Other internal operations

## Issues
- No defensive copy means mutation is possible
- The `@internal` tag is advisory, not enforced by TypeScript
- If any consumer calls `.sort()` or `.reverse()` on the result, the internal order is permanently corrupted
- The k-d tree and hue bucket indices would become inconsistent with a reordered array

## Proposed Refactoring
```typescript
// Option 1: Return readonly type (zero runtime cost)
getDyesInternal(): readonly DyeInternal[] {
  return this.dyes;  // TypeScript prevents .push(), .sort(), etc.
}

// Option 2: Freeze the array during initialization (one-time cost)
this.dyes = Object.freeze(validatedDyes) as DyeInternal[];
```

Option 1 is preferred — it adds compile-time safety without runtime overhead. Callers that need to sort/filter already create new arrays via `.filter()`.

## Benefits
- Compile-time protection against accidental mutation
- Zero runtime cost with `readonly` type
- Makes the API contract explicit

## Effort Estimate
LOW — change return type, fix any type errors in callers

## Risk Assessment
Very low — `readonly` is a TypeScript-only constraint that doesn't affect runtime behavior. Existing code already treats the array as read-only.
