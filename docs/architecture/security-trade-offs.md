# Security Trade-Offs

**Documented architectural decisions that prioritize specific properties over others**

This document explains security-related design decisions where we've consciously chosen one property (availability, simplicity, cost) over another (strict consistency, atomicity). Each trade-off is documented with its rationale and mitigations.

---

## Table of Contents

1. [KV Race Condition in Rate Limiting](#kv-race-condition-in-rate-limiting)
2. [Fail-Open Rate Limiting](#fail-open-rate-limiting)
3. [JWT Algorithm Restrictions](#jwt-algorithm-restrictions)
4. [Timing-Safe Comparison Fallback](#timing-safe-comparison-fallback)
5. [Summary Matrix](#summary-matrix)

---

## KV Race Condition in Rate Limiting

**ID:** BUG-002 | **Status:** ACCEPTED | **Severity:** HIGH (documented)

### The Trade-Off

Cloudflare KV doesn't support atomic increment operations. Our rate limiting implementation uses optimistic concurrency with retries, which can allow lost increments under high concurrency.

```
Scenario: Two concurrent requests
─────────────────────────────────
Time T1: Process A reads count = 5
Time T2: Process B reads count = 5  (stale)
Time T3: Process A writes count = 6
Time T4: Process B writes count = 6  (overwrites)

Result: Count should be 7, is 6 (lost increment)
```

### Why We Accept It

| Factor | Assessment |
|--------|------------|
| **Race window** | ~10ms (very small) |
| **Impact** | Allows ~2x burst occasionally |
| **Frequency** | Rare (requires exact timing) |
| **Consequence** | Minor over-allowance, not security bypass |

### Alternative Considered

**Durable Objects** would provide atomic guarantees:

```typescript
export class RateLimiter implements DurableObject {
  private count = 0;

  async increment(): Promise<number> {
    return ++this.count; // Atomic within DO
  }
}
```

**Why rejected:**
- Adds ~$0.15/million requests cost
- Adds deployment complexity (DO routing)
- Adds latency (~5-10ms for DO creation)
- Overkill for rate limiting (not protecting financial transactions)

### Mitigations

1. **Version metadata**: Track writes with version numbers to detect conflicts
2. **Retry logic**: 3 retries with exponential backoff (10ms, 20ms, 30ms)
3. **Write verification**: Read-after-write to confirm success
4. **Conservative limits**: Set limits with small buffer for occasional over-allowance

### Code References

```typescript
// @xivdyetools/rate-limiter/src/backends/kv.ts
// MOD-BUG-001 FIX: Optimistic concurrency with retries

// Labels in codebase:
// - DISCORD-BUG-001: Rate limiter race condition
// - MOD-BUG-001: KV atomic increment limitation
```

---

## Fail-Open Rate Limiting

**ID:** Design Decision | **Status:** INTENTIONAL | **Priority:** Availability

### The Trade-Off

When KV operations fail, rate limiting allows requests through ("fail-open") rather than blocking them ("fail-closed").

```
KV Read → Success → Normal rate limiting
        → Failure → Allow request (backendError: true)
```

### Why We Accept It

| Property | Fail-Open | Fail-Closed |
|----------|-----------|-------------|
| **Availability** | High | Degraded during KV issues |
| **User experience** | Seamless | Errors during outages |
| **Attack surface** | Brief window during KV failure | None |
| **Recovery** | Automatic when KV recovers | Manual intervention may be needed |

**Our priority order:**
1. Availability (users can access the service)
2. Rate limiting (abuse prevention)

For a dye color tool, availability is more important than strict rate limiting.

### Risk Assessment

**Threat scenario:** Attacker times requests during KV outage to bypass limits.

**Assessment:**
- KV outages are rare (<0.01% of requests)
- Attacker would need to detect KV failure state
- Even during outage, request processing still has natural limits
- No financial or sensitive data at risk

### Mitigations

1. **Logging/Alerting**: `backendError: true` flag + structured logging (v1.1.0)
2. **Monitoring**: Operators can detect fail-open events via logs
3. **Circuit breaker ready**: Architecture supports adding circuit breaker if needed

### Configuration

Fail-open is the default but can be disabled:

```typescript
const result = await limiter.check(key, {
  maxRequests: 100,
  windowMs: 60_000,
  failOpen: false, // Throws on KV error instead
});
```

---

## JWT Algorithm Restrictions

**ID:** Security Hardening | **Status:** INTENTIONAL

### The Trade-Off

Our JWT implementation only accepts `HS256` algorithm, rejecting all others including `none`.

```typescript
// @xivdyetools/auth/src/jwt.ts
if (header.alg !== 'HS256') {
  return { valid: false, error: 'Invalid algorithm' };
}
```

### Why This Matters

**Algorithm confusion attacks** occur when:
1. Token is signed with `alg: "none"` (no signature)
2. Server accepts any algorithm the token claims
3. Attacker forges tokens without knowing the secret

CVE history: Hono <=4.11.3 had this vulnerability (CVSS 8.2).

### Our Approach

| Approach | Security | Flexibility |
|----------|----------|-------------|
| Accept any algorithm | Low | High |
| Allowlist (`RS256`, `HS256`) | Medium | Medium |
| **Single algorithm (`HS256`)** | **High** | Low |

We chose single algorithm because:
- Simplest to audit
- No algorithm negotiation attacks possible
- Sufficient for our use case (single service issuing tokens)

### Code References

```typescript
// @xivdyetools/auth - Algorithm validation
export async function verifyJWT(token: string, secret: string) {
  // Step 1: Validate algorithm BEFORE signature
  if (header.alg !== 'HS256') {
    return { valid: false, error: 'Invalid algorithm' };
  }
  // Step 2: Then verify signature
}
```

---

## Timing-Safe Comparison Fallback

**ID:** Security Hardening | **Status:** INTENTIONAL

### The Trade-Off

We use `crypto.subtle.timingSafeEqual()` for constant-time string comparison, with a manual XOR fallback for environments where it's unavailable.

```typescript
export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  // Prefer native (constant-time guaranteed)
  if (crypto?.subtle?.timingSafeEqual) {
    return crypto.subtle.timingSafeEqual(encA, encB);
  }

  // Fallback: Manual XOR (best-effort constant-time)
  let result = 0;
  for (let i = 0; i < encA.length; i++) {
    result |= encA[i] ^ encB[i];
  }
  return result === 0;
}
```

### Why This Matters

**Timing attacks** measure response time to guess secrets character-by-character:

```
// Vulnerable (early return)
if (input[0] !== secret[0]) return false; // Fast rejection
if (input[1] !== secret[1]) return false; // Slightly slower
// ... attacker learns correct characters by timing
```

### Risk Assessment

| Scenario | Risk |
|----------|------|
| **Cloudflare Workers** | Low - Uses native `timingSafeEqual` |
| **Node.js fallback** | Medium - XOR is best-effort |
| **Practical exploitation** | Low - Network jitter masks timing differences |

### Mitigations

1. **Native API preferred**: Always use `crypto.subtle.timingSafeEqual` when available
2. **Same-length comparison**: Always compare same-length byte arrays
3. **Rate limiting**: Limits brute-force attempts regardless of timing
4. **HMAC for signatures**: Timing leaks don't reveal the signing key

---

## Summary Matrix

| Trade-Off | We Chose | Over | Rationale |
|-----------|----------|------|-----------|
| KV Race Condition | **Availability + Simplicity** | Atomicity | DO adds cost/complexity for minor benefit |
| Fail-Open | **Availability** | Strict enforcement | Users > abuse prevention for hobby tool |
| Single JWT Algorithm | **Security** | Flexibility | Eliminates entire class of attacks |
| Timing-Safe Fallback | **Compatibility** | Guarantee | Best-effort is sufficient for our threat model |

---

## When to Revisit

These trade-offs should be reconsidered if:

1. **KV Race Condition**: Processing financial transactions or sensitive operations
2. **Fail-Open**: Service becomes target of coordinated abuse
3. **JWT Algorithm**: Need to accept tokens from external issuers
4. **Timing-Safe**: Protecting high-value secrets in non-Worker environments

---

## References

- [BUG-002: KV Race Condition](../audits/2026-01-25/bugs/BUG-002-kv-race-condition.md)
- [Security Audit Report 2026-01-25](../audits/2026-01-25/SECURITY_AUDIT_REPORT.md)
- [@xivdyetools/rate-limiter](../../xivdyetools-rate-limiter/README.md)
- [@xivdyetools/auth](../../xivdyetools-auth/README.md)
