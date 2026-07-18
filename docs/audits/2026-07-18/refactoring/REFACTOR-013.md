# [REFACTOR-013]: isValidDye repeats an 8-line idForLog derivation six times

## Priority
LOW

## Category
Duplication

## Location
`packages/core/src/services/dye/DyeDatabase.ts:114-119, 126-134, 152-159, 166-174, 188-196, 199-208` (inside `isValidDye`)

## Current State
The identical nested-ternary block appears six times (with one minor variant) inside a single ~110-line validator:

```ts
const idForLog =
  typeof dye.id === 'number'
    ? String(dye.id)
    : typeof dye.itemID === 'number'
      ? String(dye.itemID)
      : String(dye.name ?? 'unknown');
this.logger.warn(`Dye ${idForLog} has invalid ...`);
```

The repeated block accounts for roughly 40% of `isValidDye`'s length.

## Issues
1. Every new validation rule copy-pastes the block again.
2. The six copies have already drifted slightly (the first occurrence at `:114-119` omits the `dye.name` fallback the others have).
3. The validation logic itself — the part that matters — is buried in logging boilerplate.

## Proposed Refactoring
Compute once at the top of `isValidDye` (or extract a private helper):
```ts
private dyeIdForLog(dye: Record<string, unknown>): string {
  if (typeof dye.id === 'number') return String(dye.id);
  if (typeof dye.itemID === 'number') return String(dye.itemID);
  return String(dye.name ?? 'unknown');
}

private isValidDye(dye: Record<string, unknown>): boolean {
  const idForLog = this.dyeIdForLog(dye);
  ...
  this.logger.warn(`Dye ${idForLog} has invalid hex format: ${hexForLog}`);
  ...
}
```

## Benefits
- `isValidDye` shrinks to a readable checklist of rules.
- The drift between copies disappears; future rules stop duplicating the block.

## Effort Estimate
LOW (mechanical extraction; existing tests cover the warn paths)

## Risk Assessment
Minimal — log-string derivation only; no behavioral logic touched.

> Source: evidence/core-analysis.md (2026-07-18 deep-dive, core area)
