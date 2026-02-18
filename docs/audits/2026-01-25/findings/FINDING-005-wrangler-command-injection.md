# FINDING-005: Wrangler OS Command Injection Vulnerability

## Severity
**HIGH** (Development Tooling)

## Category
- CWE-78: Improper Neutralization of Special Elements used in an OS Command ('OS Command Injection')

## Affected Projects
All Cloudflare Worker projects:
- xivdyetools-oauth
- xivdyetools-presets-api
- xivdyetools-discord-worker
- xivdyetools-moderation-worker
- xivdyetools-og-worker
- xivdyetools-universalis-proxy

## Description
Wrangler versions 4.0.0 through 4.59.0 have an OS Command Injection vulnerability in `wrangler pages deploy` (GHSA-36p8-mvp6-cv38).

## Evidence
```json
{
  "name": "wrangler",
  "severity": "high",
  "via": [{
    "source": 1112456,
    "title": "Wrangler affected by OS Command Injection in `wrangler pages deploy`",
    "url": "https://github.com/advisories/GHSA-36p8-mvp6-cv38",
    "cwe": ["CWE-78"],
    "range": ">=4.0.0 <4.59.1"
  }]
}
```

## Impact
**Risk Context**: This is a development tool vulnerability, not a production runtime vulnerability.

Potential impact:
1. **Local Machine Compromise**: If an attacker can control directory names used in `wrangler pages deploy`, they could execute arbitrary commands
2. **CI/CD Pipeline Compromise**: If CI/CD systems use untrusted input in deployment commands

**Mitigating Factors**:
- Requires attacker to control deployment parameters
- Does not affect production Workers runtime
- Limited to `wrangler pages deploy` command (Workers projects primarily use `wrangler deploy`)

## Recommendation

### Update Wrangler
```bash
npm update wrangler
```

Target version: 4.59.1 or later

### Note on Semver
The fix requires a semver major update to `@cloudflare/vitest-pool-workers` (to 0.12.6) which will also update wrangler.

## References
- [GHSA-36p8-mvp6-cv38](https://github.com/advisories/GHSA-36p8-mvp6-cv38)

## Status
- [x] wrangler updated in xivdyetools-oauth (2026-01-25)
- [x] wrangler updated in xivdyetools-presets-api (2026-01-25)
- [x] wrangler updated in xivdyetools-discord-worker (2026-01-25)
- [x] wrangler updated in xivdyetools-moderation-worker (2026-01-25)
- [x] wrangler updated in xivdyetools-og-worker (2026-01-25)
- [x] wrangler updated in xivdyetools-universalis-proxy (2026-01-25)

**Resolution Date:** 2026-01-25
**Resolution Notes:** Updated wrangler to ^4.59.1 in all 6 Worker projects. Vulnerability resolved.
