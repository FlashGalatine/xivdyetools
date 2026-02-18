# REFACTOR-001: Consolidate Base64URL Encoding/Decoding

## Priority
**HIGH**

## Category
Code Duplication

## Location
~~Original locations (now migrated):~~
- ~~xivdyetools-oauth/src/services/jwt-service.ts~~
- ~~xivdyetools-oauth/src/utils/state-signing.ts~~
- ~~xivdyetools-presets-api/src/middleware/auth.ts~~
- ~~xivdyetools-test-utils/src/utils/crypto.ts~~

**New canonical location:**
- `@xivdyetools/crypto` package

## Current State
~~4 independent implementations of base64URL encode/decode functions spread across projects.~~

**RESOLVED**: All implementations consolidated into `@xivdyetools/crypto` package.

## Issues (Resolved)
- ~~Maintenance burden (4 places to fix bugs)~~ → Single source of truth
- ~~Risk of inconsistent behavior~~ → All projects import from same package
- ~~\~200 lines of duplicated code~~ → Reduced to ~15 lines in crypto package
- ~~No single source of truth~~ → `@xivdyetools/crypto` is canonical

## Implementation (Completed)
Created `@xivdyetools/crypto` module:

```typescript
// @xivdyetools/crypto/src/index.ts
export { base64UrlEncode, base64UrlEncodeBytes, base64UrlDecode, base64UrlDecodeBytes } from './base64';
export { hexToBytes, bytesToHex } from './hex';
```

## Benefits Realized
- Single source of truth for crypto utilities
- Easier to audit security-critical code
- Consistent behavior across all projects
- Reduced total duplicated code by ~130 lines

## Effort
**Actual:** ~2 hours (as estimated)

## Risk Assessment
- Low risk confirmed: Existing tests pass
- Projects updated imports successfully

## Status
**✅ COMPLETED** (2026-01-25)

### Migration Timeline:
1. **Phase 1** (earlier today): Internal deduplication within oauth
   - Exported `base64UrlDecode` from jwt-service.ts
   - Updated state-signing.ts to import from jwt-service
2. **Phase 2** (this session): Full consolidation
   - Created `@xivdyetools/crypto` package (v1.0.0)
   - Migrated oauth to import from crypto package (v2.3.3)
   - Migrated presets-api to import from crypto package (v1.4.9)
   - Migrated test-utils to re-export from crypto package (v1.1.1)

### Affected Versions:
| Project | Version | Changes |
|---------|---------|---------|
| @xivdyetools/crypto | 1.0.0 | New package |
| xivdyetools-oauth | 2.3.3 | Imports from crypto |
| xivdyetools-presets-api | 1.4.9 | Imports from crypto |
| @xivdyetools/test-utils | 1.1.1 | Re-exports from crypto |

### Note on NPM Publishing:
Current implementation uses `file:` references for local development.
When publishing to NPM:
1. Publish `@xivdyetools/crypto` to NPM
2. Update references from `file:../xivdyetools-crypto` to `^1.0.0`
