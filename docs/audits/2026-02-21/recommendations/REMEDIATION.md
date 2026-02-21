# Remediation Recommendations

## Overview

This document provides prioritized recommendations based on the combined Deep-Dive Analysis and Security Audit conducted on 2026-02-21.

## Tier 1: Immediate (Critical Path)

These items should be addressed before next deployment:

### 1. Fix moderation-worker `safeParseJSON` (BUG-002)
**Effort:** 5 minutes | **Risk:** None
```typescript
// Change: if (key in obj) → if (Object.hasOwn(obj, key))
```

### 2. Fix moderation-worker HTTP 429 → 200 (BUG-003)
**Effort:** 5 minutes | **Risk:** None
```typescript
// Change: status: 429 → status: 200
```

### 3. Fix CSRF fail-open in web-app (FINDING-001)
**Effort:** 5 minutes | **Risk:** None
```typescript
// Change: if (csrf && storedState && csrf !== storedState)
// To: if (!csrf || !storedState || csrf !== storedState)
```

### 4. Fix Upstash atomic EXPIRE (FINDING-002)
**Effort:** 30 minutes | **Risk:** Low — requires Redis 7.0+ for `NX` flag
```typescript
pipeline.incr(redisKey);
pipeline.expire(redisKey, ttlSeconds, 'NX');
```

## Tier 2: Short-Term (Next Sprint)

### 5. Require `exp` in `verifyJWT` (FINDING-003)
```typescript
if (!payload.exp || payload.exp < now) return null;
```

### 6. Validate hex input in `hexToBytes` (FINDING-004)
Add length and character validation.

### 7. Fix `trustXForwardedFor` default (FINDING-006)
Change default to `false`.

### 8. Fix logger redaction issues (FINDING-007, FINDING-008)
- Recurse into array elements
- Merge custom fields with defaults

### 9. Add HMAC minimum key length (FINDING-009)
32-byte minimum enforcement.

### 10. Fix double escaping in SVG (BUG-001)
Remove outer `escapeXml()` from all `text()` callers.

### 11. Align rate limiter `remaining` semantics (BUG-004, BUG-005)
Consistent computation across Memory, KV, and Upstash backends.

## Tier 3: Medium-Term (Next Release)

### 12. Consolidate duplicated utilities (REFACTOR-001, REFACTOR-002)
Extract shared `getColorDistance()` and `getMatchQuality()`.

### 13. Add OKLAB cache (OPT-001)
Add LRU cache to `rgbToOklab()`.

### 14. Cache CryptoKey (OPT-002)
Module-level key cache for HMAC operations.

### 15. Add NaN guards to OG worker (FINDING-011)
Validate all parseInt'd route parameters.

### 16. Apply `escapeHtml` to `themeColor` (FINDING-013)
Defense-in-depth for OG metadata.

## Tier 4: Technical Debt Backlog

### 17. Build OKLAB k-d tree (OPT-003)
Secondary tree for perceptual matching.

### 18. Fix test-utils D1 mock (BUG-006, BUG-007)
Move binding recording to execution time; return batch results.

### 19. Use branded type for `Dye.hex` (BUG-009)
Major version change.

### 20. Deduplicate JWT verification (REFACTOR-003)
Shared signature verification helper.

### 21. Fix SVG truncation inconsistency (REFACTOR-005)
Standardize on Unicode ellipsis.

### 22. Fix CJK badge widths (BUG-012)
Implement CJK-aware text width estimation.

## Testing Strategy

For each fix:
1. Write a failing test that demonstrates the bug
2. Apply the fix
3. Verify the test passes
4. Run the full test suite: `pnpm turbo run test`
5. Type-check: `pnpm turbo run type-check`

## Notes

- Items #1-4 are zero- or low-risk changes that can be deployed independently
- Items #5-11 should be batched in a single PR for review
- Items #12-16 can be individual PRs
- Items #17-22 are tracked as technical debt for future sprints
