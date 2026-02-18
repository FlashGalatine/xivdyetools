# Security Findings: xivdyetools-presets-api

**Date:** December 7, 2025
**Severity Scale:** CRITICAL > HIGH > MEDIUM > LOW > INFORMATIONAL

---

## Summary

| Severity | Count | Immediate Action |
|----------|-------|------------------|
| CRITICAL | 0 | — |
| HIGH | 5 | Required |
| MEDIUM | 4 | Recommended |
| LOW | 3 | Optional |

---

## HIGH Severity Issues

### 1. CORS Allows All Localhost Ports

**File:** `src/index.ts` (Lines 48-49)
**Risk:** Bypass of CORS protections in development

**Current Code:**
```typescript
origin.startsWith('http://localhost:') ||
origin.startsWith('http://127.0.0.1:')
```

**Problem:** Any origin starting with `http://localhost:` is allowed, meaning:
- `http://localhost:1111` ✓ Allowed
- `http://localhost:9999` ✓ Allowed
- Malicious web apps on any localhost port can make authenticated requests

**Impact:** An attacker running a malicious app on localhost can:
- Access user data through CORS
- Perform actions on behalf of users
- Bypass origin restrictions entirely

**Remediation:**
```typescript
// Restrict to specific development ports
origin === 'http://localhost:5173' || // Web app dev
origin === 'http://127.0.0.1:5173'
```

---

### 2. CORS Returns Wildcard for No-Origin Requests

**File:** `src/index.ts` (Lines 44-51)

**Current Code:**
```typescript
if (
  !origin ||  // ← No origin header
  origin === allowedOrigin ||
  additionalOrigins.includes(origin) ||
  origin.startsWith('http://localhost:') ||
  origin.startsWith('http://127.0.0.1:')
) {
  return origin || '*';  // ← Returns '*' when origin undefined
}
```

**Problem:** Requests without an Origin header receive `Access-Control-Allow-Origin: *`

**Impact:**
- Curl, Postman, mobile apps, backend servers get wildcard access
- Combined with credentials mode, this violates CORS spec
- Opens door for cross-origin attacks

**Remediation:**
```typescript
if (!origin) {
  return null; // Don't allow requests without origin
}
```

---

### 3. Perspective API Key Exposed in URL

**File:** `src/services/moderation-service.ts` (Line 78)

**Current Code:**
```typescript
const response = await fetch(
  `https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${env.PERSPECTIVE_API_KEY}`,
  { method: 'POST', ... }
);
```

**Problem:** API key is passed as URL query parameter instead of header

**Impact:**
- Keys logged in access logs, proxy logs, browser history
- Cloudflare Workers logs may capture full URLs
- Key visible to any intermediary (CDN, load balancer)

**Remediation:**
```typescript
// Note: Perspective API requires key in URL, but consider:
// 1. Using a proxy that adds the key server-side
// 2. Logging redaction if key must be in URL
// 3. Rotating keys regularly
```

---

### 4. Bot Authentication Trusts User-Supplied Headers

**File:** `src/middleware/auth.ts` (Lines 139-146)

**Current Code:**
```typescript
if (token === c.env.BOT_API_SECRET) {
  auth = {
    isAuthenticated: true,
    isModerator: checkModerator(userDiscordId, c.env.MODERATOR_IDS),
    userDiscordId: userDiscordId || undefined,  // From X-User-Discord-ID header
    userName: userName || undefined,            // From X-User-Discord-Name header
    authSource: 'bot',
  };
}
```

**Problem:** When bot API secret is valid, the middleware trusts:
- `X-User-Discord-ID` header (user-controlled)
- `X-User-Discord-Name` header (user-controlled)

**Impact:** An attacker with the bot API secret can:
- Impersonate any Discord user by setting headers
- Become moderator by guessing a moderator's Discord ID
- Submit presets as other users
- Vote as other users

**Remediation:**
```typescript
// Option 1: Bot should always provide verified headers
// Document that headers MUST come from bot's verified user data

// Option 2: Add request signing
const signature = c.req.header('X-Request-Signature');
const expectedSig = hmacSign(userDiscordId + userName, c.env.BOT_SIGNING_SECRET);
if (signature !== expectedSig) {
  return unauthorized;
}
```

---

### 5. JWT Algorithm Not Validated

**File:** `src/middleware/auth.ts` (Lines 47-94)

**Current Code:**
```typescript
async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;

    // No validation of algorithm in header!
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },  // Assumes HS256
      false,
      ['verify']
    );
```

**Problem:** The JWT header's `alg` field is not validated before signature verification

**Attack Vector:** JWT Algorithm Confusion
- Attacker creates token with `{"alg": "none"}` header
- While current code would likely fail verification, edge cases exist
- If header claims different algorithm, confusion attacks possible

**Remediation:**
```typescript
// After decoding header, validate algorithm
const header = JSON.parse(base64UrlDecode(encodedHeader));
if (header.alg !== 'HS256') {
  return null; // Reject non-HS256 tokens
}
```

---

## MEDIUM Severity Issues

### 6. Hardcoded Production Domain in CORS

**File:** `src/index.ts` (Line 42)

**Current Code:**
```typescript
const additionalOrigins = ['https://xivdyetools.projectgalatine.com'];
```

**Problem:**
- Domain hardcoded in source code
- Cannot change without redeployment
- Exposes production URL in codebase

**Remediation:**
```typescript
const additionalOrigins = c.env.ADDITIONAL_CORS_ORIGINS?.split(',') || [];
```

---

### 7. LIKE Wildcards Not Escaped in Search

**File:** `src/services/preset-service.ts` (Lines 75-78)

**Current Code:**
```typescript
if (search) {
  conditions.push('(name LIKE ? OR description LIKE ? OR tags LIKE ?)');
  const searchPattern = `%${search}%`;
  params.push(searchPattern, searchPattern, searchPattern);
}
```

**Problem:** SQL LIKE wildcards (`%` and `_`) in user input are not escaped

**Attack Examples:**
- `?search=%` → Returns ALL presets
- `?search=a%b` → Matches 'aXb' where X is any string
- `?search=_____` → Matches any 5-character string

**Impact:** Information disclosure, database enumeration

**Remediation:**
```typescript
function escapeLikePattern(str: string): string {
  return str.replace(/[%_\\]/g, '\\$&');
}

const searchPattern = `%${escapeLikePattern(search)}%`;
```

---

### 8. Race Condition in Vote Duplicate Check

**File:** `src/handlers/votes.ts` (Lines 25-30)

**Current Code:**
```typescript
// Check if already voted
const existingVote = await db
  .prepare('SELECT 1 FROM votes WHERE preset_id = ? AND user_discord_id = ?')
  .bind(presetId, userDiscordId)
  .first();

if (existingVote) {
  return { success: false, error: 'Already voted' };
}

// ... later: INSERT INTO votes
```

**Problem:** Time-of-check to time-of-use (TOCTOU) race condition

**Attack:** User sends two vote requests simultaneously:
1. Request A: Check → No existing vote
2. Request B: Check → No existing vote
3. Request A: Insert vote
4. Request B: Insert vote (duplicate!)

**Impact:**
- Primary key violation (if constraint exists) → Error
- Or duplicate votes inflating vote_count

**Remediation:**
```typescript
// Use INSERT ... ON CONFLICT instead of check-then-insert
await db.prepare(`
  INSERT INTO votes (preset_id, user_discord_id, created_at)
  VALUES (?, ?, ?)
  ON CONFLICT(preset_id, user_discord_id) DO NOTHING
`).bind(presetId, userDiscordId, now).run();
```

---

### 9. Error Details Logged in Production

**File:** `src/index.ts` (Lines 108-122)

**Current Code:**
```typescript
app.onError((err, c) => {
  console.error('Unhandled error:', err);  // Full error to logs

  const isDev = c.env.ENVIRONMENT === 'development';
  return c.json({
    error: 'Internal Server Error',
    message: isDev ? err.message : 'An unexpected error occurred',
  }, 500);
});
```

**Problem:** While response is sanitized, `console.error(err)` logs full stack traces

**Impact:**
- Internal paths, line numbers exposed in logs
- Potential for sensitive data in error messages
- Logs may be accessible to more people than intended

**Remediation:**
```typescript
// Sanitize logs in production
const logMessage = isDev ? err : { message: err.message, name: err.name };
console.error('Unhandled error:', logMessage);
```

---

## LOW Severity Issues

### 10. Missing Security Headers

**File:** `src/index.ts`

**Missing Headers:**
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security: max-age=31536000`
- `Content-Security-Policy` (for error responses)

**Remediation:**
```typescript
app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
});
```

---

### 11. No Rate Limiting on Public Endpoints

**Files:** Various handlers

**Problem:** `GET /presets`, `GET /featured`, `GET /categories` have no rate limiting

**Impact:** Denial of service, resource exhaustion

**Note:** Comments in `wrangler.toml` mention rate limiting, but it's not implemented for public GET endpoints.

---

### 12. No Audit Logging for Authentication Failures

**File:** `src/middleware/auth.ts`

**Problem:** Failed authentication attempts are not logged

**Impact:**
- Cannot detect brute force attacks
- No visibility into failed access attempts
- Missing security audit trail

**Remediation:**
```typescript
if (!isValid) {
  console.warn('Auth failure:', {
    ip: c.req.header('CF-Connecting-IP'),
    path: c.req.path,
    reason: 'Invalid signature'
  });
  return null;
}
```

---

## Summary Table

| # | Issue | Severity | File | Lines | Effort |
|---|-------|----------|------|-------|--------|
| 1 | CORS localhost wildcard | HIGH | index.ts | 48-49 | 5 min |
| 2 | CORS no-origin wildcard | HIGH | index.ts | 44-51 | 5 min |
| 3 | API key in URL | HIGH | moderation-service.ts | 78 | 15 min |
| 4 | Bot auth header trust | HIGH | auth.ts | 139-146 | 30 min |
| 5 | JWT algo not validated | HIGH | auth.ts | 47-94 | 10 min |
| 6 | Hardcoded CORS domain | MEDIUM | index.ts | 42 | 10 min |
| 7 | LIKE not escaped | MEDIUM | preset-service.ts | 75-78 | 10 min |
| 8 | Vote race condition | MEDIUM | votes.ts | 25-30 | 20 min |
| 9 | Error details in logs | MEDIUM | index.ts | 108-122 | 10 min |
| 10 | Missing security headers | LOW | index.ts | — | 10 min |
| 11 | No public rate limits | LOW | Various | — | 1 hour |
| 12 | No auth failure logging | LOW | auth.ts | — | 15 min |

---

## Remediation Priority

### Immediate (This Week)
1. Fix CORS localhost and no-origin issues (#1, #2)
2. Add JWT algorithm validation (#5)
3. Escape LIKE wildcards (#7)

### Short-term (This Month)
4. Document or fix bot auth header trust (#4)
5. Address Perspective API key exposure (#3)
6. Move CORS domain to env var (#6)
7. Add security headers (#10)

### Long-term
8. Implement proper rate limiting (#11)
9. Add auth failure logging (#12)
10. Fix vote race condition with upsert (#8)
11. Sanitize production logs (#9)
