# REFACTOR-006: @internal Exports Not Hidden from TypeScript Consumers

## Priority
MEDIUM

## Category
API Design / Encapsulation

## Location
- File(s): Multiple packages — auth, core, rate-limiter
- Scope: package-level API design

## Current State
28+ symbols are marked with `@internal` JSDoc tags but remain fully accessible to consumers:
- `getOrCreateHmacKey()` in `@xivdyetools/auth` (used by jwt.ts internally)
- `getDyesInternal()` in `@xivdyetools/core` (see REFACTOR-005)
- Various utility functions across packages

TypeScript's `@internal` JSDoc tag only has an effect when `stripInternal: true` is set in `tsconfig.json`, which removes internal declarations from `.d.ts` output. This is NOT currently enabled.

## Issues
- Consumers can import and depend on internal APIs that may change without notice
- API surface area is larger than intended
- No compile-time enforcement of the internal/public boundary
- If an internal API changes, external consumers may break

## Proposed Refactoring
Three options (in order of preference):

### Option A: Use package.json `exports` field (recommended)
```json
{
  "exports": {
    ".": "./dist/index.js",
    "./color": "./dist/services/ColorService.js"
    // Internal modules NOT listed → inaccessible to consumers
  }
}
```

### Option B: Enable `stripInternal` in tsconfig.build.json
```json
{
  "compilerOptions": {
    "stripInternal": true
  }
}
```
This removes `@internal` declarations from `.d.ts` files, making them invisible to TypeScript consumers.

### Option C: Use `_` prefix convention
Rename internal exports with `_` prefix (e.g., `_getOrCreateHmacKey`) and document the convention.

## Benefits
- Clear public API boundary
- Consumers can't accidentally depend on unstable internals
- Easier to refactor internal implementation

## Effort Estimate
MEDIUM — Option A requires auditing all exports; Option B is a config change but may break consumers

## Risk Assessment
Medium — if consumers already depend on internal APIs, any enforcement will break them. Requires a semver major bump.
