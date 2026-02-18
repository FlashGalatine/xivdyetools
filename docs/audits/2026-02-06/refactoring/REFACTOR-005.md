# REFACTOR-005: Legacy Deprecated Commands Add Maintenance Burden

## Priority
LOW

## Category
Architecture / Technical Debt

## Location
- File(s): src/handlers/commands/favorites.ts, src/handlers/commands/collection.ts, src/handlers/commands/match.ts, src/handlers/commands/match-image.ts, src/handlers/commands/mixer.ts
- Scope: module level

## Current State
Five commands are marked as deprecated in v4.0.0:
- `/favorites` → replaced by `/preset`
- `/collection` → replaced by `/preset`
- `/match` → replaced by `/extractor color`
- `/match_image` → replaced by `/extractor image`
- `/mixer` (v2) → replaced by `/mixer` (v4) and `/gradient`

Each deprecated command still has full implementations with deprecation notices. Together they represent ~600+ lines of actively maintained code.

## Issues
- Duplicated `resolveDyeInput` logic (see REFACTOR-001)
- Each deprecated command adds to bundle size (~8 MiB already near 10 MiB paid limit)
- Every deprecated command still requires its handler in the switch statement
- Deprecation notices clutter the user experience

## Proposed Refactoring
Phase out deprecated commands over two releases:
1. **v4.1**: Replace command implementations with redirect messages pointing to new commands
2. **v4.2**: Unregister deprecated commands from Discord

```typescript
// Simplified deprecated handler (replaces full implementation)
export async function handleMatchCommand(interaction, env, ctx) {
  return ephemeralResponse(
    '`/match` has been replaced by `/extractor color`.\n' +
    'Please use the new command for the same functionality.'
  );
}
```

## Benefits
- Reduces bundle size by ~15-20 KiB of source code
- Removes 5 entries from the command switch
- Eliminates duplicated DyeService instantiations and resolveDyeInput functions
- Cleaner codebase

## Effort Estimate
LOW (for redirect stubs), MEDIUM (for full removal including Discord command unregistration)

## Risk Assessment
Low risk for redirect stubs. Medium risk for full removal — need to check if any users still rely on deprecated commands before unregistering.
