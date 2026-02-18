# BUG-001: Base64URL Decode Duplication Leading to Inconsistent Implementations

## Severity
**HIGH**

## Type
Code Duplication / Maintenance Risk

## Location
- **File:** xivdyetools-oauth/src/utils/state-signing.ts (lines 111-129)
- **File:** xivdyetools-oauth/src/services/jwt-service.ts (lines 49-67)
- **File:** xivdyetools-presets-api/src/middleware/auth.ts (lines 117-129)
- **File:** xivdyetools-test-utils/src/utils/crypto.ts (lines 71-74)

## Description
Four independent implementations of `base64UrlDecode()` exist across the ecosystem with subtle inconsistencies. This creates maintenance burden and risk of divergent behavior in authentication flows.

## Reproduction Scenario
1. A bug is discovered in one base64UrlDecode implementation
2. Developer fixes it in one location
3. Other 3 implementations remain buggy
4. Authentication may fail inconsistently across projects

## Evidence
```typescript
// state-signing.ts line 113
let base64 = str.replace(/-/g, '+').replace(/_/g, '/');

// auth.ts line 118 - Nearly identical duplicate
let base64 = str.replace(/-/g, '+').replace(/_/g, '/');

// test-utils line 71 - Cleaner implementation
return new TextDecoder().decode(base64UrlDecodeBytes(str));
```

## Suggested Fix
Consolidate to single implementation in `@xivdyetools/test-utils` or create new `@xivdyetools/crypto` package:

```typescript
// @xivdyetools/crypto/src/base64.ts
export function base64UrlDecode(str: string): string {
  return new TextDecoder().decode(base64UrlDecodeBytes(str));
}

export function base64UrlDecodeBytes(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = base64.length % 4;
  if (padding) base64 += '='.repeat(4 - padding);
  return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
}
```

## Why It's Hidden
- Each implementation works correctly in isolation
- No cross-project integration tests
- Code review doesn't typically compare across repositories

## Status
**TRACKED** - This is a code duplication issue, not a runtime bug. See [REFACTOR-001](../refactoring/REFACTOR-001-consolidate-base64-utils.md) for the consolidation plan.

**Resolution Notes:** All implementations are functionally correct. Consolidation is recommended for maintainability but is not a security or stability issue.
