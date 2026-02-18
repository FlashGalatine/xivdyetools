# Code Audit: Cross-Cutting Concerns

**Date:** 2025-12-14
**Scope:** Patterns spanning multiple xivdyetools-* projects

---

## Overview

This document captures issues and patterns that affect multiple projects in the monorepo, including:
- Shared type definitions
- Error handling patterns
- Authentication flows
- Service binding interfaces
- Testing coverage

---

## 1. Type Safety Patterns

### 1.1 Inconsistent Type Exports

**Affected Projects:** All

**Issue:** Type definitions are duplicated across projects instead of shared from a common source.

| Type | Locations |
|------|-----------|
| `Dye` | core/types/index.ts, discord-worker/types/dye.ts |
| `Preset` | presets-api/types.ts, web-app/types/preset.ts, discord-worker/types/preset.ts |
| `AuthResult` | oauth/types.ts, presets-api/middleware/auth.ts |

**Impact:**
- Type drift between projects
- Breaking changes not caught at compile time
- Maintenance overhead

**Recommendation:**
Create shared `@xivdyetools/types` package:
```
xivdyetools-types/
├── src/
│   ├── dye.ts
│   ├── preset.ts
│   ├── auth.ts
│   └── index.ts
├── package.json
└── tsconfig.json
```

---

### 1.2 Branded Types Underutilized

**Affected Projects:** All

**Issue:** IDs are typed as `string` or `number` without branding, allowing accidental cross-use.

**Evidence:**
```typescript
// presets-api
presetId: string  // Actually a UUID

// discord-worker
userId: string    // Actually a Discord snowflake

// Easy to mix up:
await presetService.get(userId);  // Wrong ID type, no error!
```

**Recommendation:**
```typescript
type PresetId = string & { readonly __brand: 'PresetId' };
type DiscordId = string & { readonly __brand: 'DiscordId' };

function createPresetId(id: string): PresetId {
  return id as PresetId;
}
```

---

## 2. Error Handling Patterns

### 2.1 Inconsistent Error Classes

**Affected Projects:** core, web-app, workers

**Issue:** Different error handling approaches across projects.

| Project | Pattern |
|---------|---------|
| xivdyetools-core | `AppError` class with error codes |
| xivdyetools-web-app | Mix of `AppError` and thrown strings |
| xivdyetools-discord-worker | JSON response with error field |
| xivdyetools-oauth | `jsonResponse({ error: ... })` pattern |
| xivdyetools-presets-api | `c.json({ error: ... })` pattern |

**Impact:**
- No unified error boundary
- Inconsistent error responses to clients
- Hard to implement centralized error logging

**Recommendation:**
Standardize on `AppError` pattern across all projects:
```typescript
// Shared error type
interface ErrorResponse {
  error: string;
  code: ErrorCode;
  details?: Record<string, unknown>;
  requestId?: string;
}

// Error codes enum
enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  RATE_LIMITED = 'RATE_LIMITED',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}
```

---

### 2.2 Missing Request IDs

**Affected Projects:** All workers

**Issue:** No request correlation IDs for debugging distributed requests.

**Impact:**
- Hard to trace errors across service bindings
- No correlation between oauth → presets-api requests
- Debugging production issues difficult

**Recommendation:**
```typescript
// Generate or forward request ID
const requestId = request.headers.get('X-Request-ID') || crypto.randomUUID();

// Include in all responses
response.headers.set('X-Request-ID', requestId);

// Include in error logs
console.error(`[${requestId}] Error:`, error);
```

---

## 3. Authentication Patterns

### 3.1 JWT Secret Sharing

**Affected Projects:** oauth, presets-api

**Issue:** Same `JWT_SECRET` shared between workers via environment variable.

| Concern | Status |
|---------|--------|
| Secret rotation | Not supported |
| Secret versioning | Not implemented |
| Key compromise detection | Not possible |

**Impact:**
- Single point of failure
- Secret rotation requires coordinated deployment
- Compromised key affects all services

**Recommendation:**
Implement secret versioning:
```typescript
// JWT includes key version
{
  "sub": "user_id",
  "kid": "key_v2",  // Key ID
  "exp": ...
}

// Verify with correct key
const key = env[`JWT_SECRET_${header.kid}`];
```

---

### 3.2 Bot API Authentication Inconsistency

**Affected Projects:** discord-worker, presets-api

**Issue:** Two authentication methods (Service Binding implicit, HTTP with signature) have different security properties.

| Method | Security Level |
|--------|---------------|
| Service Binding | High (implicit CF auth) |
| HTTP with BOT_API_SECRET | Medium (header) |
| HTTP legacy mode | Low (no verification) |

**Impact:**
- Fallback mode is significantly weaker
- Inconsistent security guarantees

**Recommendation:**
Remove legacy mode, require HMAC signature for HTTP fallback.

---

## 4. Service Binding Interfaces

### 4.1 Missing Interface Contracts

**Affected Projects:** discord-worker ↔ presets-api

**Issue:** Service binding calls don't have typed interface contracts.

**Evidence:**
```typescript
// discord-worker: No type for presets-api response
const response = await env.PRESETS_API.fetch(request);
const data = await response.json();  // any type!
```

**Impact:**
- API changes not caught at compile time
- No IDE autocomplete for responses
- Runtime errors on contract mismatch

**Recommendation:**
Create shared interface package:
```typescript
// @xivdyetools/api-contracts
export interface PresetsAPIClient {
  listPresets(options: ListOptions): Promise<PresetListResponse>;
  createPreset(data: CreatePresetRequest): Promise<CreatePresetResponse>;
  // ...
}
```

---

### 4.2 Error Handling Across Service Bindings

**Affected Projects:** discord-worker ↔ presets-api

**Issue:** Error responses from service bindings not properly typed or handled.

**Evidence:**
```typescript
// discord-worker
const response = await env.PRESETS_API.fetch(request);
if (!response.ok) {
  // What's the error format? Unknown!
  const error = await response.json();
}
```

**Recommendation:**
Standardize error response format and create typed error handler.

---

## 5. Logging & Observability

### 5.1 Inconsistent Logging Levels

**Affected Projects:** All

**Issue:** Different projects use different logging patterns.

| Project | Pattern |
|---------|---------|
| core | Custom `logger` with levels |
| web-app | Custom `logger` + console |
| discord-worker | `console.log/warn/error` |
| oauth | `console.log/warn/error` |
| presets-api | `console.log/warn/error` |

**Impact:**
- No unified log format
- Hard to aggregate logs
- Inconsistent verbosity

**Recommendation:**
Create shared logging utility:
```typescript
// @xivdyetools/logger
export const logger = {
  debug: (msg: string, context?: object) => {},
  info: (msg: string, context?: object) => {},
  warn: (msg: string, context?: object) => {},
  error: (msg: string, error?: Error, context?: object) => {}
};
```

---

### 5.2 Missing Structured Logging

**Affected Projects:** All workers

**Issue:** Log messages are unstructured strings, hard to parse in log aggregators.

**Evidence:**
```typescript
console.log('Rate limit exceeded for user:', userId);
// vs structured:
console.log(JSON.stringify({ event: 'rate_limit', userId, action: 'blocked' }));
```

**Recommendation:**
Adopt structured logging for production:
```typescript
function logEvent(event: string, data: object) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    event,
    ...data
  }));
}
```

---

## 6. Testing Patterns

### 6.1 Test Coverage Gaps

**Summary by Project:**

| Project | Unit Tests | Integration Tests | E2E Tests |
|---------|-----------|-------------------|-----------|
| core | ✅ Good | ⚠️ Limited | N/A |
| web-app | ⚠️ Limited | ⚠️ Limited | ✅ Playwright |
| discord-worker | ✅ Good | ❌ Missing | ❌ Missing |
| oauth | ⚠️ Limited | ❌ Missing | ❌ Missing |
| presets-api | ⚠️ Limited | ❌ Missing | ❌ Missing |

**Missing Test Categories:**
- Cross-service integration tests (e.g., oauth → presets-api flow)
- Rate limiting boundary condition tests
- Service binding mock tests
- Concurrent request tests

---

### 6.2 Missing Test Utilities

**Issue:** Each project creates its own mock utilities.

**Recommendation:**
Create shared test utilities package:
```typescript
// @xivdyetools/test-utils
export function mockDyeService(): DyeService { ... }
export function mockKVNamespace(): KVNamespace { ... }
export function mockD1Database(): D1Database { ... }
export function createTestPreset(): Preset { ... }
```

---

## 7. Configuration Patterns

### 7.1 Environment Variable Sprawl

**Combined Environment Variables Across Projects:**

| Variable | Projects |
|----------|----------|
| JWT_SECRET | oauth, presets-api |
| BOT_API_SECRET | discord-worker, presets-api |
| BOT_SIGNING_SECRET | discord-worker, presets-api |
| DISCORD_CLIENT_ID | oauth, discord-worker |
| DISCORD_CLIENT_SECRET | oauth |
| MODERATOR_IDS | presets-api |
| STATS_AUTHORIZED_USERS | discord-worker |
| ENVIRONMENT | oauth, presets-api |

**Issue:** No central documentation of required env vars per project.

**Recommendation:**
Add `env.example` to each project and document in CLAUDE.md.

---

### 7.2 Missing Validation

**Issue:** Environment variables not validated at startup.

**Evidence:**
```typescript
// Just uses env.JWT_SECRET directly without checking
const token = await signJWT(payload, env.JWT_SECRET);
// If JWT_SECRET is undefined: runtime error
```

**Recommendation:**
```typescript
// Validate at worker startup
function validateEnv(env: Env): void {
  const required = ['JWT_SECRET', 'DISCORD_CLIENT_ID', ...];
  const missing = required.filter(key => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}
```

---

## 8. Security Patterns

### 8.1 Secrets in Error Messages

**Affected Projects:** All

**Issue:** Some error handlers might leak secret information.

**Evidence:**
```typescript
catch (error) {
  console.error('Auth failed:', error);  // Error might contain secret
  return { error: error.message };  // Could leak to client
}
```

**Recommendation:**
Sanitize all error messages before logging or returning:
```typescript
function sanitizeError(error: Error): string {
  // Remove any potential secrets
  return error.message
    .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/secret[:\s]+\S+/gi, 'secret: [REDACTED]');
}
```

---

### 8.2 Missing Security Headers

**Affected Projects:** oauth, presets-api

**Issue:** API responses don't include security headers.

**Recommendation:**
Add security headers middleware:
```typescript
app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Strict-Transport-Security', 'max-age=31536000');
});
```

---

## 9. Performance Patterns

### 9.1 Cold Start Optimization

**Affected Projects:** All workers

**Issue:** WASM modules and services initialized on first request.

| Module | Cold Start Impact |
|--------|-------------------|
| resvg-wasm | ~500ms |
| Photon | ~500ms |
| Core DyeService | ~100ms |

**Recommendation:**
Pre-initialize critical modules at worker startup.

---

### 9.2 Caching Strategy Inconsistency

**Issue:** Different caching approaches across projects.

| Project | Cache Type |
|---------|-----------|
| core | LRU in-memory (per-instance) |
| web-app | localStorage, IndexedDB |
| discord-worker | KV (global) |
| presets-api | None |

**Recommendation:**
Document caching strategy in architecture docs, ensure consistency.

---

## 10. Documentation Patterns

### 10.1 Missing API Documentation

**Affected Projects:** All workers

**Issue:** No OpenAPI/Swagger specs for REST APIs.

**Recommendation:**
Generate OpenAPI specs from route handlers or add manual specs.

---

### 10.2 Missing Architecture Decision Records

**Issue:** No ADRs explaining key architectural decisions.

**Recommendation:**
Add ADR directory with decisions like:
- Why PKCE for OAuth?
- Why D1 instead of external database?
- Why Service Bindings vs HTTP?

---

## Recommendations Summary

### High Priority
1. Create shared types package
2. Standardize error handling
3. Implement request correlation IDs
4. Remove legacy bot auth mode
5. Add env var validation

### Medium Priority
6. Create shared logging utility
7. Add cross-service integration tests
8. Document environment variables
9. Add security headers
10. Pre-initialize WASM modules

### Low Priority
11. Add branded types for IDs
12. Generate OpenAPI specs
13. Write architecture decision records
14. Standardize caching strategy
