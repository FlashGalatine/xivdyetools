# Security Audit Report: xivdyetools-discord-worker

**Audit Date:** January 5, 2026  
**Project:** XIV Dye Tools Discord Bot - Cloudflare Workers  
**Auditor:** GitHub Copilot  

---

## Executive Summary

This security audit covers the xivdyetools-discord-worker, a Cloudflare Worker that handles Discord bot interactions. The codebase demonstrates **strong security practices** overall, with proper Discord signature verification, SSRF protections, timing-safe comparisons, and well-implemented rate limiting. However, there are some areas that require attention.

**Overall Security Posture:** ✅ **Good** (with minor improvements recommended)

---

## Findings Summary

| Severity | Count | Description |
|----------|-------|-------------|
| 🔴 Critical | 0 | None found |
| 🟠 High | 0 | None found |
| 🟡 Medium | 3 | Input sanitization, error message details, collection name validation |
| 🔵 Low | 5 | Minor improvements recommended |
| ℹ️ Informational | 6 | Best practice recommendations |

---

## Detailed Findings

### 🟡 MEDIUM SEVERITY

---

#### M-001: Preset Name/Description Not Sanitized Before Display in Embeds

**Location:** `src/handlers/commands/preset.ts#L166-L180`, `src/index.ts#L164-L185`

**Description:** User-provided preset names and descriptions are directly embedded into Discord embeds without sanitization. While Discord's API escapes most HTML/markdown, certain Unicode characters, zalgo text, or excessively long inputs could cause display issues or be used for social engineering.

**Impact:** Medium - Could allow visual spoofing or social engineering attacks within Discord embeds.

**Code:**
```typescript
// src/index.ts L175-177
embeds: [
  {
    title: '🟡 Preset Awaiting Moderation',
    description: `**${preset.name}**\n\n${preset.description}`,  // Direct user input
```

**Recommendation:**
- Implement input length validation for name (max 100 chars) and description (max 500 chars) before storage
- Consider stripping or escaping unusual Unicode characters (zalgo, invisible characters)
- The preset API likely handles this, but defense-in-depth suggests validating on both ends

---

#### M-002: Collection/Favorite Names Not Validated for Special Characters

**Location:** `src/services/user-storage.ts#L271-L295`

**Description:** Collection names are validated for length (`MAX_COLLECTION_NAME_LENGTH`) but not for content. Users could create collection names with control characters, newlines, or special characters that might cause issues when displayed.

**Impact:** Medium - Could cause display issues or be used for log injection if names appear in logs.

**Code:**
```typescript
// src/services/user-storage.ts L273-280
export async function createCollection(
  kv: KVNamespace,
  userId: string,
  name: string,
  description?: string,
  logger?: ExtendedLogger
): Promise<{ success: boolean; collection?: Collection; reason?: string }> {
  // Only length validation, no character validation
  if (name.length > MAX_COLLECTION_NAME_LENGTH) {
```

**Recommendation:**
Add character validation:
```typescript
function sanitizeCollectionName(name: string): string {
  return name
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .replace(/\s+/g, ' ')             // Normalize whitespace
    .trim();
}
```

---

#### M-003: Error Messages May Leak Internal Details

**Location:** `src/services/preset-api.ts#L161-L169`

**Description:** When the preset API request fails, error details from the response are passed directly to the PresetAPIError and may eventually be shown to users. This could expose internal API paths or error details.

**Code:**
```typescript
// src/services/preset-api.ts L161-169
if (!response.ok) {
  throw new PresetAPIError(
    response.status,
    data.message || data.error || `API request failed with status ${response.status}`,
    data  // Full data object preserved - could contain sensitive details
  );
}
```

**Recommendation:**
Sanitize error messages before showing to users:
```typescript
// Only expose safe, generic error messages to end users
const safeMessage = response.status === 404 ? 'Preset not found'
  : response.status === 403 ? 'Permission denied'
  : response.status === 409 ? 'Conflict: This already exists'
  : 'An error occurred. Please try again.';
```

---

### 🔵 LOW SEVERITY

---

#### L-001: Rate Limit Bypass via User ID Absence

**Location:** `src/index.ts#L300-L305`

**Description:** The code correctly guards against missing userId, but the check happens after the rate limit check location in the flow. However, reviewing the code shows the guard is properly placed.

**Status:** ✅ Already Fixed - Code at line 300-305 properly handles this:
```typescript
if (!userId) {
  logger.error('Unable to identify user from interaction', { commandName });
  return ephemeralResponse('Unable to identify user. Please try again.');
}
```

---

#### L-002: KV Rate Limit Fail-Open Policy

**Location:** `src/services/rate-limiter.ts#L140-L150`

**Description:** When KV operations fail, the rate limiter fails open (allows the request). This is documented and intentional to prevent KV issues from blocking all commands, but could allow rate limit bypass during KV outages.

**Impact:** Low - Trade-off is acceptable; rate limiting is defense-in-depth, not security-critical.

**Code:**
```typescript
// DISCORD-BUG-002: On KV errors, allow the request (fail open) and flag the error
if (logger) {
  logger.error('Rate limit check failed', error instanceof Error ? error : undefined);
}
return {
  allowed: true,
  remaining: limit,
  resetAt: now + windowMs,
  kvError: true, // Flag for caller to potentially log/alert
};
```

**Recommendation:** This is a reasonable design choice. Consider adding monitoring/alerting for high `kvError` rates to detect ongoing KV issues.

---

#### L-003: Autocomplete Response Data Exposure

**Location:** `src/index.ts#L540-L560`

**Description:** Autocomplete for user's presets reveals preset names and statuses to the user who owns them. This is correct behavior, but there's no validation that the autocomplete request actually came from the same user who owns the presets (relies on Discord's user ID from interaction).

**Impact:** Low - Discord ensures the member.user.id in interactions is authentic (signature-verified).

**Status:** ✅ Acceptable - Discord signature verification ensures the userId is authentic.

---

#### L-004: No Request ID in Some Error Responses

**Location:** `src/index.ts#L80-L87`

**Description:** When environment validation fails critically (missing DISCORD_TOKEN or DISCORD_PUBLIC_KEY), the error response doesn't include the X-Request-ID header since the middleware chain is interrupted.

**Impact:** Low - Makes debugging harder for configuration errors.

**Recommendation:** Include request ID in all error responses for traceability.

---

#### L-005: Button Custom ID Parsing Without Strict Validation

**Location:** `src/handlers/buttons/copy.ts#L45-L60`

**Description:** RGB/HSV button handlers split the custom_id by underscores and parse numbers without strict validation. Invalid inputs result in `NaN` values.

**Code:**
```typescript
// copy.ts L46-50
const parts = customId.replace('copy_rgb_', '').split('_');
if (parts.length !== 3) { /* ... */ }
const [r, g, b] = parts.map(Number);  // Could be NaN
```

**Impact:** Low - Results in displaying "NaN" in response, no security issue.

**Recommendation:** Add validation for parsed numbers:
```typescript
const nums = parts.map(Number);
if (nums.some(isNaN)) {
  return Response.json({ type: 4, data: { content: 'Invalid RGB format.', flags: 64 } });
}
```

---

### ℹ️ INFORMATIONAL

---

#### I-001: ✅ Excellent Discord Signature Verification

**Location:** `src/utils/verify.ts`

**Observation:** The Discord signature verification is properly implemented using the `discord-interactions` library's `verifyKey` function. The implementation includes:
- Ed25519 signature verification
- Request body size limits (100KB)
- Proper error handling with timing-safe responses

---

#### I-002: ✅ Strong SSRF Protection

**Location:** `src/services/image/validators.ts`

**Observation:** Image URL validation includes comprehensive SSRF protections:
- Strict allowlist for Discord CDN hostnames only
- Block all IP address literals
- Block cloud metadata endpoints (AWS, GCP, Azure)
- Block private IP ranges
- Manual redirect following with validation
- Timeout on fetches

---

#### I-003: ✅ Timing-Safe Comparison for Webhook Auth

**Location:** `src/utils/verify.ts#L101-L127`

**Observation:** The webhook authentication function properly uses `crypto.timingSafeEqual` with fallback to manual constant-time comparison. This prevents timing attacks on webhook authentication.

---

#### I-004: ✅ Proper Security Headers

**Location:** `src/index.ts#L93-L102`

**Observation:** Security headers are properly set:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`  
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`

---

#### I-005: ✅ Secrets Properly Managed

**Location:** `wrangler.toml#L80-L85`

**Observation:** Secrets are properly documented for `wrangler secret put`:
- DISCORD_TOKEN
- DISCORD_PUBLIC_KEY
- BOT_API_SECRET
- BOT_SIGNING_SECRET

The `.gitignore` correctly excludes `.dev.vars` and secret files.

---

#### I-006: ✅ CORS Configuration

**Location:** `src/index.ts#L68`

**Observation:** CORS is enabled via `cors()`. This uses Hono's default CORS which is permissive. For a Discord bot webhook endpoint, this is acceptable since:
- Discord interactions are POST requests with signature verification
- The endpoint doesn't expose sensitive data via GET requests

**Note:** If the health endpoint (`/health`) needs to be restricted, consider applying CORS more selectively.

---

## Security Controls Summary

### ✅ Authentication/Authorization
| Control | Status | Notes |
|---------|--------|-------|
| Discord Signature Verification | ✅ Implemented | Ed25519 via discord-interactions |
| Webhook Secret Verification | ✅ Implemented | Timing-safe comparison |
| HMAC Request Signing | ✅ Implemented | For preset API authentication |
| Moderator Authorization | ✅ Implemented | ID-based checks |
| Stats Access Control | ✅ Implemented | Authorized users only |

### ✅ Input Validation
| Control | Status | Notes |
|---------|--------|-------|
| Request Body Size Limits | ✅ Implemented | 100KB for Discord, 10KB for webhooks |
| Image URL Validation | ✅ Implemented | Discord CDN allowlist only |
| Image Size/Dimension Limits | ✅ Implemented | 10MB, 4096x4096, 16MP |
| Image Format Validation | ✅ Implemented | Magic bytes verification |
| Dye Name Input | ✅ Implemented | Lookup validation |
| Locale Validation | ✅ Implemented | Allowlist validation |

### ✅ Rate Limiting
| Control | Status | Notes |
|---------|--------|-------|
| Per-User Rate Limits | ✅ Implemented | Sliding window algorithm |
| Per-Command Limits | ✅ Implemented | Configurable per command |
| KV-Based Storage | ✅ Implemented | With TTL expiration |

### ✅ Error Handling
| Control | Status | Notes |
|---------|--------|-------|
| Structured Logging | ✅ Implemented | Request-scoped with correlation |
| Graceful Error Responses | ✅ Implemented | User-friendly messages |
| Error Details Sanitization | ⚠️ Partial | See M-003 |

---

## Recommendations Summary

### Priority Actions

1. **M-001, M-002**: Add input sanitization for user-provided text (preset names, collection names, descriptions)

2. **M-003**: Sanitize error messages before displaying to users

3. **L-005**: Add numeric validation for button custom_id parsing

### Nice-to-Have Improvements

4. Monitor KV error rates for rate limiter failures
5. Add request ID to all error responses
6. Consider adding Content-Security-Policy header for any HTML responses (currently none)

---

## Files Reviewed

| File | Lines | Status |
|------|-------|--------|
| src/index.ts | 736 | ✅ Reviewed |
| src/utils/verify.ts | 127 | ✅ Reviewed |
| src/utils/response.ts | 160 | ✅ Reviewed |
| src/utils/discord-api.ts | 457 | ✅ Reviewed |
| src/utils/env-validation.ts | 113 | ✅ Reviewed |
| src/middleware/request-id.ts | 52 | ✅ Reviewed |
| src/middleware/logger.ts | 103 | ✅ Reviewed |
| src/services/rate-limiter.ts | 175 | ✅ Reviewed |
| src/services/preset-api.ts | 662 | ✅ Reviewed |
| src/services/user-storage.ts | 504 | ✅ Reviewed |
| src/services/analytics.ts | 207 | ✅ Reviewed |
| src/services/image/validators.ts | 445 | ✅ Reviewed |
| src/services/i18n.ts | 265 | ✅ Reviewed |
| src/services/user-preferences.ts | 118 | ✅ Reviewed |
| src/handlers/commands/preset.ts | 1036 | ✅ Reviewed |
| src/handlers/commands/collection.ts | 670 | ✅ Reviewed |
| src/handlers/commands/harmony.ts | 310 | ✅ Reviewed |
| src/handlers/commands/match-image.ts | 269 | ✅ Reviewed |
| src/handlers/commands/stats.ts | 134 | ✅ Reviewed |
| src/handlers/commands/budget.ts | 408 | ✅ Reviewed |
| src/handlers/buttons/index.ts | 64 | ✅ Reviewed |
| src/handlers/buttons/copy.ts | 178 | ✅ Reviewed |
| src/types/env.ts | 228 | ✅ Reviewed |
| src/types/preset.ts | 119 | ✅ Reviewed |
| wrangler.toml | 133 | ✅ Reviewed |
| package.json | 47 | ✅ Reviewed |
| .gitignore | 35 | ✅ Reviewed |

---

## Conclusion

The xivdyetools-discord-worker demonstrates **mature security practices**. The development team has clearly considered security throughout the implementation:

- Discord signature verification is correctly implemented
- SSRF protections are comprehensive
- Rate limiting is well-designed with appropriate trade-offs
- Secrets management follows best practices
- Error handling uses structured logging

The findings are all medium or low severity, with no critical vulnerabilities identified. The recommended fixes are straightforward input validation enhancements that would strengthen the already solid security posture.
