# REFACTOR-007: Phase 2 TODO Commands Cluttering Stoat Worker Router

## Priority
LOW

## Category
Code Smell / Dead Code

## Location
- File(s): apps/stoat-worker/src/router.ts (lines 85-95)
- Scope: function level

## Current State
The stoat-worker router has ~10 commented-out Phase 2 command registrations:
```typescript
// TODO: Phase 2 commands
// 'dye.search': handleSearchCommand,
// 'dye.info': handleInfoCommand,
// ...
```

These have been present since the initial implementation and represent planned but unimplemented features.

## Issues
- Commented-out code clutters the router and obscures the active command list
- No timeline or tracking for when Phase 2 will be implemented
- Developers may waste time investigating these stubs

## Proposed Refactoring
1. Remove the commented-out commands from the router
2. Track Phase 2 features in a GitHub issue or project board instead
3. If Phase 2 is indefinitely deferred, note it in the stoat-worker `CLAUDE.md`

## Benefits
- Cleaner router code
- Features tracked in proper issue tracker rather than code comments

## Effort Estimate
LOW

## Risk Assessment
None — removing comments has no runtime impact
