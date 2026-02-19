# [REFACTOR-003]: Deprecation Timeline Documentation

## Priority
LOW

## Category
Maintainability

## Location
- File(s): Various files across the codebase
- Scope: Project-wide

## Current State
Several features and code paths are marked as "deprecated" in comments but lack explicit removal timelines:

1. **`STATE_TRANSITION_PERIOD`** flag in OAuth worker (see FINDING-007)
2. **`LocalStorageCacheBackend`** in web-app (IndexedDB backend is preferred)
3. Legacy code paths in various workers for backward compatibility

Without removal dates, deprecated code accumulates indefinitely, increasing maintenance burden and potential security surface.

## Issues
- Deprecated code may contain security vulnerabilities that are never patched
- No automated enforcement of deprecation timelines
- Developers may unknowingly depend on deprecated features

## Proposed Refactoring
1. Add a `DEPRECATIONS.md` file to the project root listing all deprecated features with:
   - What is deprecated
   - When it was deprecated
   - Target removal date
   - Migration guide
2. Add `@deprecated` JSDoc tags with removal dates to all deprecated APIs
3. Consider adding a lint rule that warns on usage of deprecated APIs

## Benefits
- Clear visibility into technical debt
- Scheduled cleanup prevents accumulation
- Migration guides help consumers update proactively

## Effort Estimate
LOW

## Risk Assessment
No risk - documentation-only change
