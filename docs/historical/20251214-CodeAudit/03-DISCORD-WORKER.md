# Code Audit: xivdyetools-discord-worker

**Version:** 2.0.2
**Date:** 2025-12-14
**Total Findings:** 17 (2 CRITICAL, 6 HIGH, 8 MEDIUM, 1 LOW)

---

## Summary Table

| ID | Title | Severity | Category | File |
|----|-------|----------|----------|------|
| DISCORD-PERF-001 | Discord 3-Second Timeout Risk | CRITICAL | Reliability | index.ts, discord-api.ts |
| DISCORD-SEC-001 | Missing /stats Command Authorization | CRITICAL | Security | index.ts |
| DISCORD-BUG-001 | Rate Limiter Window Boundary | HIGH | Bug | rate-limiter.ts |
| DISCORD-BUG-002 | KV Error Fallback Masking | HIGH | Bug | rate-limiter.ts |
| DISCORD-SEC-002 | Image URL SSRF Incomplete | HIGH | Security | validators.ts |
| DISCORD-SEC-003 | Signature Timing Not Constant | HIGH | Security | verify.ts |
| DISCORD-SEC-004 | Preset API Auth Missing Signature | HIGH | Security | preset-api.ts |
| DISCORD-BUG-003 | Deferred Ephemeral Not Honored | HIGH | Bug | match-image.ts |
| DISCORD-PERF-002 | Rate Limiter KV Roundtrip | MEDIUM | Performance | rate-limiter.ts |
| DISCORD-PERF-003 | Photon WASM Cold Start | MEDIUM | Performance | photon.ts |
| DISCORD-PERF-004 | SVG Rendering Not Cached | MEDIUM | Performance | harmony.ts |
| DISCORD-PERF-005 | Repeated i18n Initialization | MEDIUM | Performance | match-image.ts |
| DISCORD-BUG-004 | Analytics Fire-and-Forget | MEDIUM | Bug | index.ts |
| DISCORD-BUG-005 | User Storage Keys Predictable | MEDIUM | Security | user-storage.ts |
| DISCORD-REF-001 | Command Handler Duplication | MEDIUM | Refactoring | handlers/commands/* |
| DISCORD-REF-002 | Response Wrapper Inconsistency | MEDIUM | Refactoring | response.ts |
| DISCORD-REF-003 | i18n File Separation Unclear | LOW | Maintenance | bot-i18n.ts, i18n.ts |

---

## CRITICAL Findings

### DISCORD-PERF-001: Discord 3-Second Timeout Risk

**Severity:** CRITICAL
**Category:** Reliability

**Location:**
- **Files:**
  - `src/index.ts:191-242` (command handling)
  - `src/utils/discord-api.ts:34-60, 123-148` (response functions)
- **Function:** `processMatchImageCommand()`, `editOriginalResponse()`, `sendFollowUp()`

**Description:**
Commands that process images (match_image, accessibility) defer response but don't enforce Discord's 3-second deadline. If background processing takes longer than ~2.9 seconds before the follow-up is sent, Discord marks the interaction as failed.

**Evidence:**
```typescript
// index.ts - No timeout enforcement
case 'match_image':
  // Defers, but no deadline tracking
  return await handleMatchImage(interaction, env, ctx);

// discord-api.ts - No timing check before sending
export async function sendFollowUp(...): Promise<void> {
  // Sends follow-up without checking if deadline passed
  await fetch(url, { method: 'POST', ... });
}
```

**Impact:**
- Users see "This interaction failed" even though response was computed
- Poor user experience on slow image processing
- No retry mechanism for failed interactions

**Recommendation:**
```typescript
// Add deadline tracking
const interactionStart = Date.now();
const DISCORD_DEADLINE_MS = 2800; // 200ms buffer

async function sendFollowUpSafe(...): Promise<boolean> {
  const elapsed = Date.now() - interactionStart;
  if (elapsed > DISCORD_DEADLINE_MS) {
    console.warn(`Deadline exceeded: ${elapsed}ms`);
    // Optionally send a delayed message via webhook
    return false;
  }
  await sendFollowUp(...);
  return true;
}

// In image processing:
if (!await sendFollowUpSafe(result)) {
  // Queue for retry or notify user another way
}
```

**Effort:** Medium (1-2 hours)

---

### DISCORD-SEC-001: Missing /stats Command Authorization

**Severity:** CRITICAL
**Category:** Security

**Location:**
- **File:** `src/index.ts`
- **Lines:** 319-320
- **Pattern:** Authorization check missing

**Description:**
The `/stats` command checks `STATS_AUTHORIZED_USERS` environment variable but never validates if the requesting user's ID is in that list.

**Evidence:**
```typescript
// STATS_AUTHORIZED_USERS contains comma-separated IDs
// But handler never checks if userId is in that list!
case 'stats':
  return await handleStats(interaction, env);  // No auth check
```

**Impact:**
- Anyone can access bot statistics
- Potential information disclosure
- Usage patterns revealed to attackers

**Recommendation:**
```typescript
// In handlers/commands/stats.ts
export async function handleStats(
  interaction: DiscordInteraction,
  env: Env
): Promise<Response> {
  const userId = interaction.member?.user?.id || interaction.user?.id;
  const authorizedUsers = (env.STATS_AUTHORIZED_USERS || '').split(',').map(s => s.trim());

  if (!authorizedUsers.includes(userId)) {
    return ephemeralResponse('You are not authorized to view stats.');
  }

  // ... rest of handler
}
```

**Effort:** Low (15 minutes)

---

## HIGH Findings

### DISCORD-BUG-001: Rate Limiter Window Boundary Edge Case

**Severity:** HIGH
**Category:** Bug

**Location:**
- **File:** `src/services/rate-limiter.ts`
- **Lines:** 116-127
- **Function:** `checkRateLimit()`

**Description:**
When the rate limit window expires, the counter resets. But if two requests arrive within milliseconds of the window boundary, both get count=1 instead of the second getting count=2.

**Evidence:**
```typescript
// Window boundary race condition
if (Date.now() > record.windowEnd) {
  // Window expired, reset
  record.count = 1;
  record.windowStart = Date.now();
  record.windowEnd = Date.now() + WINDOW_MS;
} else {
  record.count++;
}
```

**Scenario:**
1. Request at t=59.9s: count=max (rate limited)
2. Window expires at t=60s
3. Request at t=60.1s: count=1 (allowed)
4. Request at t=60.15s: also count=1 (should be 2)

**Impact:**
- Brief burst of requests possible at window boundaries
- Rate limit can be exceeded by ~2x in edge cases

**Recommendation:**
Use atomic timestamp-based sliding window:
```typescript
const now = Date.now();
// Filter out old timestamps and add new one atomically
record.timestamps = record.timestamps
  .filter(t => now - t < WINDOW_MS)
  .concat(now);

if (record.timestamps.length > MAX_REQUESTS) {
  return { allowed: false };
}
```

**Effort:** Medium (1 hour)

---

### DISCORD-BUG-002: KV Error Fallback Masking

**Severity:** HIGH
**Category:** Bug

**Location:**
- **File:** `src/services/rate-limiter.ts`
- **Lines:** 153-162
- **Function:** Error handling in `checkRateLimit()`

**Description:**
On KV failure, `checkRateLimit` returns `allowed: true` (fail-open). This is correct for availability, but abuse patterns won't be detected if KV is briefly unavailable.

**Evidence:**
```typescript
} catch (error) {
  console.error('Rate limiter error:', error);
  // Fail open - allow request if rate limiter fails
  return { allowed: true, remaining: maxRequests, resetAt: Date.now() + WINDOW_MS };
}
```

**Impact:**
- KV outage allows unlimited requests
- No alerting on KV failures
- Abuse during outage undetected

**Recommendation:**
```typescript
} catch (error) {
  console.error('CRITICAL: Rate limiter KV failure:', error);

  // Track KV failures in analytics
  ctx.waitUntil(trackKVFailure(env, error));

  // Consider using Durable Objects as fallback
  // Or implement in-memory fallback with conservative limits
  return {
    allowed: true,
    remaining: 1,  // Conservative fallback
    resetAt: Date.now() + WINDOW_MS,
    kvError: true  // Signal to caller
  };
}
```

**Effort:** Medium (1 hour)

---

### DISCORD-SEC-002: Image URL SSRF Incomplete

**Severity:** HIGH
**Category:** Security

**Location:**
- **File:** `src/services/image/validators.ts`
- **Lines:** 91-100 (URL validation)
- **Also:** Lines 27-30 (hostname whitelist)
- **Function:** `validateImageUrl()`

**Description:**
SSRF validation only checks hostname against whitelist, but doesn't validate:
- Query parameters that might bypass Discord proxy auth
- Redirect attacks (Discord CDN might redirect to external host)
- IPv4/IPv6 address literals

**Evidence:**
```typescript
// Only hostname check
const allowedHosts = ['cdn.discordapp.com', 'media.discordapp.net'];
if (!allowedHosts.includes(url.hostname)) {
  return { valid: false, error: 'Invalid image host' };
}
// Missing: redirect validation, IP literal check
```

**Impact:**
- Attacker could craft URL that redirects to internal service
- Potential for SSRF to internal Cloudflare services
- Could bypass proxy authentication

**Recommendation:**
```typescript
async function validateImageUrl(urlString: string): Promise<ValidationResult> {
  const url = new URL(urlString);

  // Check hostname
  if (!ALLOWED_HOSTS.includes(url.hostname)) {
    return { valid: false, error: 'Invalid host' };
  }

  // Block IP literals
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(url.hostname)) {
    return { valid: false, error: 'IP addresses not allowed' };
  }

  // Fetch with redirect disabled
  const response = await fetch(urlString, {
    method: 'HEAD',
    redirect: 'error'  // Fail on any redirect
  });

  // Validate content-type
  const contentType = response.headers.get('content-type');
  if (!contentType?.startsWith('image/')) {
    return { valid: false, error: 'Not an image' };
  }

  return { valid: true };
}
```

**Effort:** Medium (1 hour)

---

### DISCORD-SEC-003: Signature Timing Not Constant-Time

**Severity:** HIGH
**Category:** Security

**Location:**
- **File:** `src/utils/verify.ts`
- **Lines:** 134-147 (timingSafeEqual fallback)
- **Function:** `timingSafeEqual()`

**Description:**
The fallback comparison when `crypto.subtle.timingSafeEqual` is unavailable uses bitwise XOR but doesn't properly handle different-length inputs.

**Evidence:**
```typescript
// Fallback implementation
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;  // Early return leaks length info!
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}
```

**Impact:**
- Timing attack can determine signature length
- Potentially reveal partial signature information

**Recommendation:**
```typescript
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  const maxLength = Math.max(a.length, b.length);

  // Pad shorter array to prevent timing leak
  const aPadded = new Uint8Array(maxLength);
  const bPadded = new Uint8Array(maxLength);
  aPadded.set(a);
  bPadded.set(b);

  let result = a.length ^ b.length;  // Include length in comparison
  for (let i = 0; i < maxLength; i++) {
    result |= aPadded[i] ^ bPadded[i];
  }
  return result === 0;
}
```

**Effort:** Low (30 minutes)

---

### DISCORD-SEC-004: Preset API Auth Missing Signature

**Severity:** HIGH
**Category:** Security

**Location:**
- **File:** `src/services/preset-api.ts`
- **Lines:** 56-100
- **Function:** `callPresetAPI()`

**Description:**
When using Service Binding (primary path), auth is implicit. But if `PRESETS_API_URL` fallback is used, only sends `Authorization: Bearer` header without HMAC signature that presets-api expects.

**Evidence:**
```typescript
// Service Binding path - implicit auth
if (env.PRESETS_API) {
  return await env.PRESETS_API.fetch(request);
}

// Fallback HTTP path - weak auth
const response = await fetch(url, {
  headers: {
    'Authorization': `Bearer ${env.BOT_API_SECRET}`,
    'X-User-Discord-ID': userId,  // No signature!
  }
});
```

**Impact:**
- Fallback mode vulnerable to header injection
- If BOT_API_SECRET leaked, full API access

**Recommendation:**
Add HMAC signature for fallback mode:
```typescript
const timestamp = Math.floor(Date.now() / 1000);
const message = `${timestamp}:${userId}:${method}:${path}`;
const signature = await signHMAC(env.BOT_SIGNING_SECRET, message);

headers.set('X-Timestamp', String(timestamp));
headers.set('X-Signature', signature);
```

**Effort:** Medium (1 hour)

---

### DISCORD-BUG-003: Deferred Response Ephemeral Not Honored

**Severity:** HIGH
**Category:** Bug

**Location:**
- **File:** `src/handlers/commands/match-image.ts`
- **Line:** 114
- **Function:** `handleMatchImage()`

**Description:**
`deferredResponse()` accepts `ephemeral` parameter but the image processing handler never passes it. Results are public by default.

**Evidence:**
```typescript
// Line 114: Never passes ephemeral flag
return deferredResponse();  // Default: public

// But function signature supports it:
function deferredResponse(ephemeral?: boolean): Response
```

**Impact:**
- Image processing results visible to everyone in channel
- Users might expect private response for image analysis

**Recommendation:**
```typescript
// Check if user requested ephemeral via option
const ephemeral = interaction.data.options?.find(
  o => o.name === 'ephemeral'
)?.value as boolean ?? false;

return deferredResponse(ephemeral);
```

**Effort:** Low (15 minutes)

---

## MEDIUM Findings

### DISCORD-PERF-002: Rate Limiter KV Roundtrip

**Severity:** MEDIUM
**Category:** Performance

**Location:**
- **File:** `src/services/rate-limiter.ts`
- **Lines:** 95-163
- **Function:** `checkRateLimit()`

**Description:**
Every command triggers sequential KV `get()` then `put()` operations. With sliding window stored as JSON, this adds 50-100ms latency.

**Impact:**
- Added latency on every command
- KV operation costs accumulate

**Recommendation:**
Consider Durable Objects for high-frequency rate limiting, or batch operations.

**Effort:** High (4+ hours)

---

### DISCORD-PERF-003: Photon WASM Cold Start

**Severity:** MEDIUM
**Category:** Performance

**Location:**
- **File:** `src/services/image/photon.ts`
- **Pattern:** Lazy WASM initialization

**Description:**
Photon WASM module loads on first image command, causing 500-800ms delay on cold starts.

**Impact:**
- First `/match_image` command significantly slower
- Cold start + image processing may exceed 3s

**Recommendation:**
Pre-initialize WASM at worker startup:
```typescript
// index.ts
let photonReady = false;
export default {
  async fetch(request, env, ctx) {
    if (!photonReady) {
      ctx.waitUntil(initializePhoton().then(() => { photonReady = true; }));
    }
    // ...
  }
}
```

**Effort:** Low (30 minutes)

---

### DISCORD-PERF-004: SVG Rendering Not Cached

**Severity:** MEDIUM
**Category:** Performance

**Location:**
- **File:** `src/handlers/commands/harmony.ts`
- **Lines:** 125-239
- **Function:** `handleHarmony()`

**Description:**
resvg WASM initialization happens per command invocation instead of being cached.

**Recommendation:**
Cache initialized resvg instance in module scope.

**Effort:** Low (30 minutes)

---

### DISCORD-PERF-005: Repeated i18n Initialization

**Severity:** MEDIUM
**Category:** Performance

**Location:**
- **File:** `src/handlers/commands/match-image.ts`
- **Line:** 135
- **Function:** `initializeLocale()`

**Description:**
`initializeLocale()` called per command even though xivdyetools-core caches locale internally.

**Recommendation:**
Remove redundant initialization or check if already initialized.

**Effort:** Low (10 minutes)

---

### DISCORD-BUG-004: Analytics Fire-and-Forget

**Severity:** MEDIUM
**Category:** Bug

**Location:**
- **File:** `src/index.ts`
- **Lines:** 266-274
- **Pattern:** `ctx.waitUntil()` usage

**Description:**
`ctx.waitUntil(trackCommandWithKV(...))` has no error handler. Analytics failures are silently ignored.

**Evidence:**
```typescript
ctx.waitUntil(trackCommandWithKV(env, commandName, userId));
// No .catch() handler
```

**Recommendation:**
```typescript
ctx.waitUntil(
  trackCommandWithKV(env, commandName, userId)
    .catch(error => console.error('Analytics failed:', error))
);
```

**Effort:** Low (5 minutes)

---

### DISCORD-BUG-005: User Storage Keys Predictable

**Severity:** MEDIUM
**Category:** Security

**Location:**
- **File:** `src/services/user-storage.ts`
- **Pattern:** KV key construction

**Description:**
KV keys follow predictable pattern `xivdye:collections:{userId}`. While Discord user IDs aren't sequential, pattern is discoverable.

**Impact:**
- If KV namespace leaked, collection structure known
- Aids targeted attacks

**Recommendation:**
Add namespace salt or hash user IDs:
```typescript
const hashedId = await hashUserId(userId, env.KV_SALT);
const key = `xivdye:collections:${hashedId}`;
```

**Effort:** Medium (1 hour)

---

### DISCORD-REF-001: Command Handler Duplication

**Severity:** MEDIUM
**Category:** Refactoring

**Location:**
- **Files:** `src/handlers/commands/*` (all command files)
- **Pattern:** Repeated boilerplate

**Description:**
Each handler implements the same pattern: extract options, get translator, check rate limit, defer response, process in background, send follow-up.

**Impact:**
- 300+ lines of duplicated boilerplate across 15+ handlers
- Changes require updating multiple files

**Recommendation:**
Create `BaseCommandHandler` or decorator pattern.

**Effort:** High (4+ hours)

---

### DISCORD-REF-002: Response Wrapper Inconsistency

**Severity:** MEDIUM
**Category:** Refactoring

**Location:**
- **File:** `src/utils/response.ts`
- **Lines:** 86-102
- **Function:** `ephemeralResponse()`

**Description:**
`ephemeralResponse()` only accepts string, not embeds. Other response functions are more flexible.

**Recommendation:**
Extend to accept `InteractionResponseData`.

**Effort:** Low (20 minutes)

---

### DISCORD-REF-003: i18n File Separation Unclear

**Severity:** LOW
**Category:** Maintenance

**Location:**
- **Files:**
  - `src/services/bot-i18n.ts`
  - `src/services/i18n.ts`

**Description:**
Two separate i18n files with unclear separation of responsibilities.

**Recommendation:**
Document or consolidate i18n handling.

**Effort:** Low (30 minutes)

---

## Recommendations Summary

### Immediate (Day 1)
1. Add /stats command authorization (DISCORD-SEC-001)
2. Fix timing-safe comparison (DISCORD-SEC-003)

### This Sprint
3. Implement 3-second timeout deadline (DISCORD-PERF-001)
4. Fix rate limiter boundary edge case (DISCORD-BUG-001)
5. Complete SSRF validation (DISCORD-SEC-002)
6. Add signature to preset API fallback (DISCORD-SEC-004)
7. Fix ephemeral flag passthrough (DISCORD-BUG-003)

### Next Sprint
8. Add KV error alerting (DISCORD-BUG-002)
9. Pre-initialize WASM modules (DISCORD-PERF-003, DISCORD-PERF-004)
10. Add analytics error handling (DISCORD-BUG-004)

### Backlog
11. Consider Durable Objects for rate limiting (DISCORD-PERF-002)
12. Extract command handler boilerplate (DISCORD-REF-001)
13. Standardize response wrappers (DISCORD-REF-002)
