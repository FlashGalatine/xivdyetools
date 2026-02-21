# REFACTOR-006: ColorConverter Static+Instance Dual API Pattern

## Priority
LOW

## Category
API Design / Maintenance Burden

## Location
- File: `packages/core/src/services/color/ColorConverter.ts` (~1472 lines)

## Current State
Every method in `ColorConverter` exists in both instance and static form (e.g., `hexToRgb()` and `static hexToRgb()`), with the static version simply delegating to a singleton. This doubles the public API surface and adds ~300 lines of pure delegation code.

The same pattern appears in `LocalizationService`.

## Proposed Refactoring
- Deprecate the static API in favor of direct instance usage
- Or auto-generate the static delegation

## Benefits
- Reduced API surface and LOC
- Easier discoverability

## Effort Estimate
MEDIUM (requires updating all callsites)

## Risk Assessment
Medium — widely used API. Should be a major version bump.
