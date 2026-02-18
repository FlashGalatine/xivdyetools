# Security Audit: Authentication & Authorization Review

**Project:** xivdyetools-* Monorepo
**Date:** December 15, 2025
**Focus:** OAuth, JWT, Request Signing, Rate Limiting

---

## Overview

The xivdyetools ecosystem implements a multi-layered authentication architecture:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Authentication Flow                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────┐    ┌───────────────┐    ┌──────────────┐                  │
│  │ Web User │───►│ OAuth Worker  │───►│ Discord OAuth│                  │
│  └──────────┘    │ (PKCE Flow)   │    └──────────────┘                  │
│       │          └───────┬───────┘           │                          │
│       │                  │                   │                          │
│       │          ┌───────▼───────┐           │                          │
│       │          │  JWT Issued   │◄──────────┘                          │
│       │          └───────┬───────┘                                      │
│       │                  │                                              │
│       ▼                  ▼                                              │
│  ┌──────────────────────────────────────────────┐                       │
│  │              Presets API Worker              │                       │
│  │  ┌────────────────┐  ┌────────────────────┐  │                       │
│  │  │ JWT Validation │  │ HMAC Signature     │  │                       │
│  │  │ (Web clients)  │  │ (Bot clients)      │  │                       │
│  │  └────────────────┘  └────────────────────┘  │                       │
│  └──────────────────────────────────────────────┘                       │
│                                                                          │
│  ┌──────────────┐    ┌───────────────────────────┐                      │
│  │ Discord User │───►│   Discord Worker          │                      │
│  └──────────────┘    │   (Ed25519 Verification)  │                      │
│                      └───────────────────────────┘                      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 1. OAuth 2.0 Implementation

### 1.1 PKCE (Proof Key for Code Exchange)

**Location:** `xivdyetools-oauth/src/handlers/authorize.ts`, `callback.ts`
**Status:** PROPERLY IMPLEMENTED

#### Flow Analysis

```
1. Frontend generates code_verifier (64 bytes random)
2. Frontend calculates code_challenge = SHA256(code_verifier)
3. Frontend redirects to /auth/discord with code_challenge
4. User authenticates with Discord
5. Discord redirects to /auth/callback with authorization code
6. Worker exchanges code + code_verifier for tokens
7. Worker validates code_challenge = SHA256(code_verifier)
8. JWT issued to frontend
```

#### Code Review

**File:** `xivdyetools-web-app/src/services/auth-service.ts`
```typescript
// Line 45-48: Proper entropy source
const codeVerifier = Array.from(crypto.getRandomValues(new Uint8Array(64)))
  .map(b => b.toString(16).padStart(2, '0'))
  .join('');

// Line 51-55: SHA-256 challenge generation
const hashBuffer = await crypto.subtle.digest(
  'SHA-256',
  new TextEncoder().encode(codeVerifier)
);
```

**Security Assessment:**
| Check | Status | Notes |
|-------|--------|-------|
| Entropy source | PASS | `crypto.getRandomValues()` |
| Verifier length | PASS | 128 hex chars (64 bytes) |
| Challenge algorithm | PASS | SHA-256 |
| Verifier storage | PASS | sessionStorage only |

### 1.2 State Parameter (CSRF Protection)

**Status:** PROPERLY IMPLEMENTED

```typescript
// Random state generated per request
const state = Array.from(crypto.getRandomValues(new Uint8Array(16)))
  .map(b => b.toString(16).padStart(2, '0'))
  .join('');

// State validated on callback
if (callbackState !== storedState) {
  throw new Error('State mismatch');
}
```

### 1.3 Redirect URI Validation

**Status:** PROPERLY IMPLEMENTED

**File:** `xivdyetools-web-app/src/services/auth-service.ts:124-163`

```typescript
function sanitizeReturnPath(path: string): string {
  // Block dangerous protocols
  if (path.includes('javascript:') ||
      path.includes('data:') ||
      path.includes('://') ||
      path.startsWith('//')) {
    return '/';
  }

  // Only allow paths starting with single /
  if (!path.startsWith('/')) {
    return '/';
  }

  return path;
}
```

**Blocked Attacks:**
- `javascript:alert(1)` - Protocol blocked
- `data:text/html,...` - Protocol blocked
- `//evil.com` - Protocol-relative URL blocked
- `https://evil.com` - Absolute URL blocked

---

## 2. JWT Implementation

### 2.1 Token Structure

**Location:** `xivdyetools-oauth/src/services/jwt-service.ts`
**Algorithm:** HS256 (HMAC-SHA256)

#### Token Payload
```typescript
interface JWTPayload {
  sub: string;      // User ID (Discord snowflake)
  iss: string;      // Issuer (OAuth worker URL)
  iat: number;      // Issued at timestamp
  exp: number;      // Expiration timestamp
  type: 'access' | 'refresh';
}
```

### 2.2 Security Analysis

#### Algorithm Verification
**Status:** PROPERLY IMPLEMENTED

```typescript
// Header parsing with algorithm check
const header = JSON.parse(base64UrlDecode(headerB64));
if (header.alg !== 'HS256') {
  throw new Error('Invalid algorithm');
}
```

This prevents the classic "alg: none" attack where attackers remove signature verification.

#### Signature Verification
**Status:** PROPERLY IMPLEMENTED

```typescript
const signatureValid = await crypto.subtle.verify(
  { name: 'HMAC', hash: 'SHA-256' },
  key,
  signature,
  new TextEncoder().encode(`${headerB64}.${payloadB64}`)
);
```

Using Web Crypto API (not deprecated Node.js crypto) ensures:
- Constant-time comparison
- Hardware acceleration where available
- Secure key handling

#### Expiration Checking
**Status:** PROPERLY IMPLEMENTED

```typescript
if (payload.exp < Math.floor(Date.now() / 1000)) {
  throw new Error('Token expired');
}
```

### 2.3 Token Lifecycle

| Token Type | Lifetime | Storage | Revocation |
|------------|----------|---------|------------|
| Access | Short (1 hour) | Memory/sessionStorage | Blacklist in KV |
| Refresh | Long (7 days) | Secure cookie/storage | Blacklist in KV |

#### Token Revocation
**Location:** `xivdyetools-oauth/src/handlers/revoke.ts`

Tokens are revoked by adding to KV blacklist:
```typescript
await env.TOKEN_BLACKLIST.put(
  `revoked:${tokenHash}`,
  '1',
  { expirationTtl: remainingTTL }
);
```

**Assessment:**
| Check | Status | Notes |
|-------|--------|-------|
| Blacklist storage | PASS | KV with TTL auto-cleanup |
| Token hashing | PASS | Tokens hashed before storage |
| Expiration sync | PASS | TTL matches token expiration |

---

## 3. Discord Interaction Verification

### 3.1 Ed25519 Signature Verification

**Location:** `xivdyetools-discord-worker/src/utils/verify.ts`
**Library:** `discord-interactions`

#### Verification Flow
```
1. Discord sends POST with:
   - X-Signature-Ed25519 header
   - X-Signature-Timestamp header
   - JSON body

2. Worker verifies:
   signature = Ed25519.verify(
     publicKey,
     timestamp + body,
     signatureHeader
   )
```

#### Code Review
```typescript
import { verifyKey } from 'discord-interactions';

// Verify Discord request signature
const isValid = verifyKey(
  rawBody,
  signature,
  timestamp,
  env.DISCORD_PUBLIC_KEY
);

if (!isValid) {
  return new Response('Invalid signature', { status: 401 });
}
```

**Security Assessment:**
| Check | Status | Notes |
|-------|--------|-------|
| Algorithm | PASS | Ed25519 (industry standard) |
| Library | PASS | Official discord-interactions |
| Timestamp included | PASS | Prevents replay attacks |
| Early verification | PASS | Before any processing |

### 3.2 Timestamp Validation

Discord's signature includes the timestamp, preventing replay attacks. Additionally, Discord rejects requests with stale timestamps server-side.

---

## 4. Bot-to-API Authentication

### 4.1 HMAC Request Signing

**Location:** `xivdyetools-presets-api/src/middleware/auth.ts`

#### Signature Format
```
signature = HMAC-SHA256(timestamp:userId:userName, BOT_API_SECRET)
```

#### Headers Required
```http
X-User-Discord-ID: 123456789
X-User-Discord-Name: Username
X-Request-Timestamp: 1702600000
X-Request-Signature: <base64 signature>
```

#### Verification Code
```typescript
const expectedSignature = await generateHMAC(
  `${timestamp}:${userId}:${userName}`,
  env.BOT_API_SECRET
);

// Timing-safe comparison
if (!timingSafeEqual(signature, expectedSignature)) {
  return new Response('Invalid signature', { status: 401 });
}
```

### 4.2 Anti-Replay Protection

**Status:** PROPERLY IMPLEMENTED

```typescript
const timestamp = parseInt(headers.get('X-Request-Timestamp') || '0');
const now = Math.floor(Date.now() / 1000);

// 2-minute window
if (Math.abs(now - timestamp) > 120) {
  return new Response('Request expired', { status: 401 });
}
```

**Window Analysis:**
| Window | Protection | Trade-off |
|--------|------------|-----------|
| 120 seconds | Allows clock skew | Replay possible within window |

**Recommendation:** Consider reducing to 60 seconds for stricter protection.

### 4.3 Timing-Safe Comparison

**Location:** `xivdyetools-discord-worker/src/utils/verify.ts:118-148`

```typescript
// Constant-time comparison prevents timing attacks
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }

  return diff === 0;
}
```

**Assessment:** Properly prevents timing side-channel attacks.

---

## 5. Rate Limiting

### 5.1 Implementation Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Rate Limiting Layers                   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Layer 1: Cloudflare (DDoS protection)                  │
│     ├── Automatic bot detection                         │
│     └── Global rate limits                              │
│                                                          │
│  Layer 2: Application (per-user limits)                 │
│     ├── KV-backed sliding window                        │
│     ├── Command-specific limits                         │
│     └── Daily submission quotas                         │
│                                                          │
│  Layer 3: Business Logic (resource protection)          │
│     ├── Max favorites per user                          │
│     ├── Max collections per user                        │
│     └── Max presets per day                             │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 5.2 Discord Worker Rate Limits

**Location:** `xivdyetools-discord-worker/src/services/rate-limit.ts`

| Category | Limit | Window | Storage |
|----------|-------|--------|---------|
| Image processing | 5 req | 1 minute | KV |
| Standard commands | 15 req | 1 minute | KV |
| Favorites | 20 max | - | KV |
| Collections | 50 max | - | KV |

#### Implementation
```typescript
const COMMAND_LIMITS: Record<string, RateLimitConfig> = {
  'match-image': { perMinute: 5, perHour: 30 },
  'harmony': { perMinute: 15, perHour: 100 },
  'dye': { perMinute: 20, perHour: 200 },
  // ...
};

async function checkRateLimit(
  userId: string,
  command: string
): Promise<RateLimitResult> {
  const key = `ratelimit:${userId}:${command}`;
  const current = await env.KV.get(key);
  // ... sliding window logic
}
```

### 5.3 Presets API Rate Limits

**Location:** `xivdyetools-presets-api/src/middleware/rate-limit.ts`

| Endpoint | Limit | Window | By |
|----------|-------|--------|-----|
| Public GET | 100 req | 1 minute | IP |
| Authenticated | 50 req | 1 minute | User |
| Submissions | 10 | 1 day | User |

### 5.4 OAuth Worker Rate Limits

**Location:** `xivdyetools-oauth/src/index.ts:127-133`

```typescript
// Rate limit headers exposed
response.headers.set('X-RateLimit-Limit', limit);
response.headers.set('X-RateLimit-Remaining', remaining);
response.headers.set('X-RateLimit-Reset', resetTime);
```

### 5.5 Rate Limit Bypass Analysis

**Potential Vectors:**
| Vector | Risk | Mitigation |
|--------|------|------------|
| Multiple accounts | Medium | Discord's responsibility |
| IP rotation | Low | Per-user limits primary |
| Clock manipulation | Very Low | Server-side timestamps |

---

## 6. Authorization (Access Control)

### 6.1 Role-Based Access Control

**Roles:**
| Role | Capabilities |
|------|-------------|
| Anonymous | Read public presets |
| Authenticated | Create/vote/manage own presets |
| Moderator | Approve/reject presets, view pending |

### 6.2 Moderator Validation

**Location:** `xivdyetools-presets-api/src/utils/env-validation.ts`

```typescript
// Moderator IDs validated at startup
function validateModeratorIds(ids: string): string[] {
  const moderatorIds = ids.split(/[,\s]+/).filter(Boolean);

  for (const id of moderatorIds) {
    // Discord snowflake validation (17-19 digits)
    if (!/^\d{17,19}$/.test(id)) {
      throw new Error(`Invalid moderator ID format: ${id}`);
    }
  }

  return moderatorIds;
}
```

### 6.3 Resource Ownership

**Location:** `xivdyetools-presets-api/src/handlers/presets.ts`

```typescript
// Users can only modify their own presets
async function updatePreset(userId: string, presetId: string) {
  const preset = await getPreset(presetId);

  if (preset.createdBy !== userId) {
    return new Response('Forbidden', { status: 403 });
  }

  // ... update logic
}
```

---

## 7. Secrets Management

### 7.1 Secret Inventory

| Secret | Used By | Rotation Frequency |
|--------|---------|-------------------|
| JWT_SECRET | OAuth, Presets API | Manual |
| DISCORD_TOKEN | Discord Worker | On compromise |
| DISCORD_PUBLIC_KEY | Discord Worker | Never (public) |
| BOT_API_SECRET | Discord Worker, Presets API | Quarterly recommended |
| DISCORD_CLIENT_SECRET | OAuth Worker | On compromise |
| MODERATOR_IDS | Presets API | As needed |

### 7.2 Storage Method

All secrets stored via Cloudflare wrangler secrets:
```bash
wrangler secret put JWT_SECRET
```

**Security Properties:**
- Encrypted at rest
- Not visible in dashboard after creation
- Injected at runtime
- Never in source code or config files

### 7.3 Environment Separation

```toml
# wrangler.toml
[env.production]
name = "xivdyetools-oauth"
# Production KV bindings, D1 bindings

[env.development]
name = "xivdyetools-oauth-dev"
# Development bindings
```

---

## 8. Security Headers

### 8.1 Headers Implemented

**Location:** All worker `index.ts` files

| Header | Value | Purpose |
|--------|-------|---------|
| X-Content-Type-Options | nosniff | Prevent MIME sniffing |
| X-Frame-Options | DENY | Prevent clickjacking |
| Strict-Transport-Security | max-age=31536000 | Force HTTPS |
| X-Request-ID | uuid | Request correlation |

### 8.2 CORS Configuration

**Location:** `xivdyetools-oauth/src/index.ts:62-103`

```typescript
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://xivdyetools.projectgalatine.com',
  // ...
];

function handleCORS(request: Request): Headers {
  const origin = request.headers.get('Origin');

  if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
    return new Response('Forbidden', { status: 403 });
  }

  // ... set CORS headers
}
```

---

## 9. Summary

### Authentication Strengths

| Component | Implementation | Rating |
|-----------|---------------|--------|
| OAuth 2.0 + PKCE | Proper | Excellent |
| JWT Validation | Proper | Excellent |
| Ed25519 Signatures | Proper | Excellent |
| HMAC Request Signing | Proper | Excellent |
| Rate Limiting | Multi-layer | Excellent |
| Secrets Management | Cloudflare Secrets | Excellent |

### Areas for Improvement

| Component | Current | Recommendation |
|-----------|---------|----------------|
| Anti-replay window | 120 seconds | Consider 60 seconds |
| Secret rotation | Manual | Document procedures |
| Moderator audit | Basic | Add audit logging |

### Overall Assessment

**Rating:** EXCELLENT

The authentication and authorization implementation follows industry best practices:
- Modern OAuth 2.0 with PKCE
- Proper cryptographic implementations
- Defense in depth with multiple validation layers
- Well-designed rate limiting
- Secure secrets management

---

**Document Owner:** XIV Dye Tools Team
**Classification:** Internal Use
