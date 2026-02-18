# FINDING-004: Hono JWT Algorithm Confusion Vulnerability

## Severity
**HIGH**

## Category
- OWASP A07:2021 - Identification and Authentication Failures
- CWE-347: Improper Verification of Cryptographic Signature

## Affected Projects
- xivdyetools-oauth
- xivdyetools-presets-api
- xivdyetools-discord-worker
- xivdyetools-moderation-worker
- xivdyetools-og-worker
- xivdyetools-universalis-proxy

## Description
Multiple projects use `hono` version <=4.11.3, which has two HIGH severity JWT-related vulnerabilities:

1. **GHSA-3vhc-576x-3qv4** (CVSS 8.2): JWT algorithm confusion when JWK lacks "alg" - allows untrusted header.alg fallback
2. **GHSA-f67f-6cw9-8mq4** (CVSS 8.2): JWT Algorithm Confusion via Unsafe Default (HS256) allows token forgery and auth bypass

## Evidence
```json
{
  "name": "hono",
  "severity": "high",
  "range": "<=4.11.3",
  "fixAvailable": true,
  "cwe": ["CWE-347"],
  "cvss": {
    "score": 8.2,
    "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:H/A:N"
  }
}
```

## Impact
An attacker could potentially:
1. **Token Forgery**: Create valid-looking JWTs without the secret key
2. **Authentication Bypass**: Gain unauthorized access to protected resources
3. **Privilege Escalation**: Impersonate other users or gain admin access

**Note**: The xivdyetools-oauth project implements its own JWT verification (jwt-service.ts) that explicitly validates the algorithm is HS256, which mitigates this vulnerability. However, if any project uses Hono's built-in JWT middleware, it could be vulnerable.

## Recommendation

### Immediate Action
Update hono to version 4.11.4 or later in all projects:

```bash
npm update hono
```

Or specifically:
```json
"hono": "^4.11.4"
```

### Verification
After update, run:
```bash
npm audit
```

Verify hono vulnerability is resolved.

## References
- [GHSA-3vhc-576x-3qv4](https://github.com/advisories/GHSA-3vhc-576x-3qv4)
- [GHSA-f67f-6cw9-8mq4](https://github.com/advisories/GHSA-f67f-6cw9-8mq4)

## Status
- [x] hono updated in xivdyetools-oauth (2026-01-25)
- [x] hono updated in xivdyetools-presets-api (2026-01-25)
- [x] hono updated in xivdyetools-discord-worker (2026-01-25)
- [x] hono updated in xivdyetools-moderation-worker (2026-01-25)
- [x] hono updated in xivdyetools-og-worker (2026-01-25)
- [x] hono updated in xivdyetools-universalis-proxy (2026-01-25)

**Resolution Date:** 2026-01-25
**Resolution Notes:** Updated hono to ^4.11.4 in all 6 Worker projects. Vulnerability resolved.
