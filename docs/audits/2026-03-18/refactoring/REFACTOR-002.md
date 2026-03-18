# REFACTOR-002: Inconsistent Test File Locations

## Priority
HIGH

## Category
Code Organization / Consistency

## Location
- File(s): All packages and apps
- Scope: monorepo-wide

## Current State
Test files are organized differently across projects:
- **Colocated** (`src/**/*.test.ts`): discord-worker, web-app, most packages
- **Separated** (`tests/**/*.test.ts`): presets-api
- **Mixed**: Some packages have tests in both locations

This inconsistency means:
- Vitest `include` patterns differ per project
- Developers must check each project's config to find tests
- CI glob patterns must account for both conventions

## Issues
- No single convention documented or enforced
- Finding tests for a given source file requires checking multiple locations
- Coverage configuration must account for both patterns
- New contributors don't know which pattern to follow

## Proposed Refactoring
Standardize on **colocated tests** (`*.test.ts` next to source files):
1. Move `presets-api/tests/**/*.test.ts` → `presets-api/src/**/*.test.ts`
2. Update `presets-api/vitest.config.ts` include pattern
3. Document the convention in root `CLAUDE.md`

## Benefits
- One test pattern to learn
- Tests are discoverable next to the code they test
- IDE file navigation: source file ↔ test file side-by-side
- Consistent Vitest configuration

## Effort Estimate
LOW — presets-api is the only outlier; moving test files is straightforward

## Risk Assessment
Low — test content doesn't change, only file locations. Import paths may need updating.
