# REFACTOR-003: Consolidate Shared Authentication Patterns

## Priority
**MEDIUM**

## Category
Code Duplication / Architecture

## Location
- xivdyetools-oauth/src/services/jwt-service.ts (JWT creation/verification)
- xivdyetools-presets-api/src/middleware/auth.ts (JWT verification, HMAC signing)
- xivdyetools-discord-worker/src/utils/verify.ts (Ed25519 verification)
- xivdyetools-moderation-worker/src/middleware/rate-limit.ts (auth context)

## Current State
Multiple projects implement authentication patterns with different approaches:
- JWT creation/verification duplicated between oauth and presets-api
- HMAC signing patterns duplicated
- Auth context types defined separately

## Issues
- JWT verification logic is duplicated
- HMAC signing patterns similar but not shared
- No shared types for auth context
- Testing burden multiplied

## Proposed Refactoring
Create `@xivdyetools/auth` package:

```typescript
// JWT utilities
export { verifyJWT, createJWT, decodeJWT } from './jwt';

// HMAC utilities
export { hmacSign, hmacVerify } from './hmac';

// Types
export type { AuthContext, JWTPayload } from './types';
```

## Benefits
- Consistent authentication across ecosystem
- Single place for security-critical code
- Easier security audits
- Shared types

## Effort Estimate
**MEDIUM** (4-6 hours)

## Risk Assessment
- Medium risk: Auth is security-critical
- Requires careful migration
- Good test coverage essential

## Status
**DEFERRED** (2026-01-25)

**Analysis Notes:**
- Similar complexity to REFACTOR-002 (requires new package)
- Lower priority than rate limiting consolidation
- Current implementations work correctly
- Would benefit from REFACTOR-001 completion first (base64 utilities)

**Recommended Path:**
- Phase 3 (2+ weeks): Create shared auth package after rate limiter
- For now: Document patterns and ensure test coverage
