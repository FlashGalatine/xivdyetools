# Security & Code Quality Recommendations

## Top 5 Actionable Recommendations

### 1. Add XML Entity Escaping to SVG Generation
**Addresses:** FINDING-004
**Effort:** Low
**Impact:** Medium

Create an `escapeXml()` utility and apply it to all text interpolated into SVG `<text>` elements. This prevents potential SVG injection if user-controlled content (preset names, dye names with special characters) flows into SVG output.

```typescript
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
```

### 2. Centralize Environment Validation
**Addresses:** FINDING-001, FINDING-002, FINDING-010, REFACTOR-001
**Effort:** Low-Medium
**Impact:** High

Create a shared environment validation builder that all workers use. Include:
- Required variable checks with production hard-fail
- Discord Snowflake format validation
- Type-specific validators (URL, hex string, comma-separated IDs)

### 3. Add Parameter Bounds to OG-Worker
**Addresses:** FINDING-003
**Effort:** Low
**Impact:** Medium

Add maximum value checks for all numeric URL parameters:
```typescript
const MAX_STEPS = 20;
const MAX_DYE_COUNT = 10;
if (steps > MAX_STEPS) return c.json({ error: 'steps exceeds maximum' }, 400);
```

### 4. Remove or Expire STATE_TRANSITION_PERIOD Flag
**Addresses:** FINDING-007
**Effort:** Low
**Impact:** Low-Medium

If the transition to signed OAuth states is complete, remove the flag entirely. If still needed, add an expiry date and production guard.

### 5. Fix Moderation Audit Log
**Addresses:** BUG-003
**Effort:** Medium
**Impact:** Medium

Implement proper append-only history for moderation actions, either as a JSON array in the existing column or a separate `moderation_history` table.

## Security Posture Assessment

### What's Working Well

The project already implements many security best practices that are often missing in similar projects:

- **No `eval()` or `Function()` usage** anywhere in the codebase
- **No `innerHTML` assignments** — all rendering uses safe template APIs
- **No hardcoded secrets** — all configuration via environment variables
- **Timing-safe comparisons** for all secret verification
- **Parameterized SQL** with no string concatenation
- **PKCE enforcement** on OAuth (not just optional support)
- **Content-Length validation** before body parsing
- **Safe JSON parsing** with depth limits
- **Secret redaction in logs** with comprehensive field coverage

### Areas to Monitor

1. **Dependency updates**: Run `pnpm audit` regularly and update vulnerable packages
2. **CSP violations**: Monitor Content-Security-Policy violation reports
3. **Rate limit effectiveness**: Add metrics to validate rate limits are working (OPT-002)
4. **Token rotation**: Periodically rotate `JWT_SECRET`, `BOT_SIGNING_SECRET`, `DISCORD_CLIENT_SECRET`

### Comparison to Industry Standards

| OWASP Top 10 (2021) | Status | Notes |
|----------------------|--------|-------|
| A01: Broken Access Control | Strong | RBAC for moderators, ban checks, CORS |
| A02: Cryptographic Failures | Excellent | Web Crypto API, proper key management |
| A03: Injection | Excellent | Parameterized SQL, no eval, input validation |
| A04: Insecure Design | Good | Defense-in-depth, fail-open with logging |
| A05: Security Misconfiguration | Good | Env validation, security headers |
| A06: Vulnerable Components | Check pnpm audit | Minimal dependencies |
| A07: Auth Failures | Excellent | PKCE, Ed25519, JWT with algorithm check |
| A08: Data Integrity Failures | Good | Signed states, HMAC verification |
| A09: Logging Failures | Excellent | Structured logging with secret redaction |
| A10: SSRF | Good | Hardcoded API base URLs, no user-controlled URLs |
