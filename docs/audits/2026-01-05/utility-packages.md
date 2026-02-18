# 🔐 Security Audit Report: Utility Packages

**Audit Date:** January 5, 2026  
**Packages Reviewed:**
- xivdyetools-logger
- xivdyetools-types
- xivdyetools-test-utils

---

## Overview

These three utility packages are internal packages used across the xivdyetools ecosystem. Overall, they are well-structured with good security practices.

| Package | Security Rating | Notes |
|---------|----------------|-------|
| **xivdyetools-logger** | ⭐⭐⭐⭐⭐ Excellent | Built-in sanitization and redaction |
| **xivdyetools-types** | ⭐⭐⭐⭐⭐ Excellent | Pure types, no runtime risk |
| **xivdyetools-test-utils** | ⭐⭐⭐⭐ Good | Test secrets exported as expected, could add production guard |

---

## xivdyetools-logger

### ✅ Positive Findings

#### Comprehensive Sensitive Data Redaction
**Location:** `src/utils/redact.ts`

Default fields redacted:
- `password`
- `secret`
- `token`
- `authorization`
- `cookie`
- `api_key`
- `apiKey`
- `accessToken`

```typescript
const DEFAULT_SENSITIVE_FIELDS = [
  'password',
  'secret',
  'token',
  'authorization',
  'cookie',
  'api_key',
  'apiKey',
  'accessToken',
  // ... more fields
];
```

#### Error Message Sanitization
**Location:** `src/utils/sanitize.ts`

Handles Bearer tokens and key=value patterns:
```typescript
// Sanitizes error messages to prevent sensitive data leaks
function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/Bearer\s+[^\s]+/gi, 'Bearer [REDACTED]')
    .replace(/([a-z_]+key|token|secret|password)=[^\s&]+/gi, '$1=[REDACTED]');
}
```

#### Production-Safe Stack Traces
**Location:** `src/logger.ts`

Stack traces are excluded in production when `includeStack: false` (default for production).

#### Worker-Specific Extensions
**Location:** `src/presets/worker.ts`

Extends redaction list with worker-specific secrets like `BOT_API_SECRET`, `JWT_SECRET`, etc.

---

## xivdyetools-types

### ✅ Positive Findings

- **Pure type definitions** with no runtime code that could leak data
- **No sensitive default values** in types
- **No dependencies** - zero supply chain risk
- All types are compile-time only

**Security Assessment:** This package poses no runtime security risks as it contains only TypeScript type definitions.

---

## xivdyetools-test-utils

### ✅ Positive Findings

#### Clear Warning About Test Secrets
**Location:** `src/secrets.ts`

```typescript
/**
 * Test-only secrets - NEVER use in production!
 * These are intentionally weak/predictable for testing purposes.
 */
export const TEST_JWT_SECRET = 'test-jwt-secret-do-not-use-in-production';
export const TEST_BOT_API_SECRET = 'test-bot-api-secret-do-not-use-in-production';
```

#### No Dangerous Patterns
- No use of `eval()`, `Function()`, or other dangerous patterns
- No file system operations
- No network operations

### ⚠️ Low Severity Issues

#### Test Secrets Exported from Package
**Location:** `src/secrets.ts`  
**Severity:** Low

Hardcoded test secrets (`TEST_JWT_SECRET`, `TEST_BOT_API_SECRET`) are exported from the package.

**Risk:** If consuming apps accidentally import from `@xivdyetools/test-utils` in production bundles, these weak secrets could be exposed.

**Recommendation:**
```typescript
// At top of secrets.ts
if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
  throw new Error('@xivdyetools/test-utils should not be imported in production');
}
```

#### Stack Trace in AppError.toJSON()
**Location:** `src/errors/app-error.ts`  
**Severity:** Low

The `toJSON()` method includes stack trace by default.

**Risk:** Stack traces may expose internal paths.

**Recommendation:** Consider making stack inclusion conditional:
```typescript
toJSON(includeStack = false): Record<string, unknown> {
  return {
    name: this.name,
    code: this.code,
    message: this.message,
    severity: this.severity,
    ...(includeStack && { stack: this.stack }),
  };
}
```

---

## 📦 Dependency Analysis

All three packages have minimal, well-maintained dependencies:

| Package | Dependencies | Dev Dependencies | Vulnerabilities |
|---------|-------------|------------------|-----------------|
| **logger** | None | vitest, typescript, rimraf | ✅ None |
| **types** | None | vitest, typescript, rimraf | ✅ None |
| **test-utils** | @xivdyetools/types | vitest, typescript, @cloudflare/workers-types | ✅ None |

**No known vulnerabilities** detected in the dependency list. All packages use current TypeScript 5.9.3 and Vitest 4.0.15.

---

## Recommendations

### Priority 1: Quick Wins

1. **Add production guard to test-utils** (Optional enhancement)
   ```typescript
   // At top of secrets.ts
   if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
     throw new Error('@xivdyetools/test-utils should not be imported in production');
   }
   ```

### Priority 2: Consider

2. **Make stack trace conditional in AppError.toJSON()**
   ```typescript
   toJSON(includeStack = false): Record<string, unknown> {
     return {
       name: this.name,
       code: this.code,
       message: this.message,
       severity: this.severity,
       ...(includeStack && { stack: this.stack }),
     };
   }
   ```

3. **Document redaction configuration** - The `sensitiveFields` config can be overridden by caller. If a consumer passes empty array, no redaction occurs. Document this behavior clearly.

---

## Summary

**Overall: These packages are well-designed with security in mind.**

- The logger has robust sensitive data handling with comprehensive redaction
- Types package is purely declarative with no runtime risk
- Test-utils appropriately documents its test-only nature

No critical or high-severity issues found.
