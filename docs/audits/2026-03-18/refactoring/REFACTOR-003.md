# REFACTOR-003: Inconsistent Coverage Thresholds Across Apps

## Priority
MEDIUM

## Category
Quality Gates / Consistency

## Location
- File(s): vitest.config.ts in each app/package
- Scope: monorepo-wide

## Current State
Coverage thresholds vary across projects:

| Project | Statements | Branches | Functions | Lines |
|---------|-----------|----------|-----------|-------|
| discord-worker | 85% | 70% | 85% | 85% |
| presets-api | 85% | 80% | 85% | 85% |
| oauth | (none) | (none) | (none) | (none) |
| Other packages | varies | varies | varies | varies |

Additionally, discord-worker excludes significant code from coverage:
- SVG rendering (renderer.ts, dye-info-card.ts, random-dyes-grid.ts, budget-comparison.ts)
- Budget services
- Several command handlers (budget, extractor, swatch, mixer-v4, gradient, preferences)

## Issues
- No baseline quality gate — some apps can merge with 0% coverage
- Branch coverage varies (70% vs 80%) without documented rationale
- Coverage exclusions in discord-worker aren't documented (why those specific files?)
- No Turbo task enforces coverage across all projects

## Proposed Refactoring
1. Define standard thresholds in a shared Vitest preset or root `turbo.json`
2. Recommended baseline: 80% statements, 70% branches, 80% functions, 80% lines
3. Document coverage exclusions with rationale in each project's `CLAUDE.md`
4. Add a `coverage` Turbo task that runs coverage checks for all projects

## Benefits
- Consistent quality gates across the monorepo
- Transparent coverage exclusions with documented reasoning
- Prevents coverage regression when adding new projects

## Effort Estimate
MEDIUM — requires updating configs and documenting exclusions

## Risk Assessment
Low — coverage thresholds only affect CI gates, not runtime behavior. May require writing additional tests for projects currently below threshold.
