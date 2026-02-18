# Security Audit: Remediation Roadmap

**Project:** xivdyetools-* Monorepo
**Date:** December 21, 2025
**Purpose:** Prioritized action plan for remaining security items

---

## Overview

This audit found significantly fewer items requiring remediation compared to December 15, 2025. The team has resolved 7 of 9 previous findings and maintained zero npm vulnerabilities.

---

## Priority Matrix

| Priority | Timeframe | Criteria |
|----------|-----------|----------|
| P0 - Critical | Immediate | Active exploitation risk |
| P1 - High | This Week | Significant security gap |
| P2 - Medium | This Month | Reduces attack surface |
| P3 - Low | This Quarter | Best practice improvements |
| P4 - Enhancement | Backlog | Nice-to-have improvements |

---

## Current Findings Summary

| ID | Finding | Severity | Priority |
|----|---------|----------|----------|
| SEC-010 | Vitest version split (v3/v4) | INFORMATIONAL | N/A - By Design |
| SEC-007 | Missing SRI for external resources | N/A | CLOSED - Not Applicable |

**Notes:**
- SEC-010 was initially classified as MEDIUM but has been downgraded to INFORMATIONAL after investigation revealed it's intentional due to Cloudflare Workers testing requirements.
- SEC-007 was investigated and closed as Not Applicable - the project uses `script-src 'self'` CSP which blocks all external scripts (stronger than SRI), and Google Fonts doesn't support SRI.

---

## Understanding SEC-010: Vitest v3/v4 Split

### Why oauth and presets-api Use Vitest v3

Both projects use `@cloudflare/vitest-pool-workers@^0.10.14` for testing Cloudflare Workers in the workerd runtime. This package [currently only supports Vitest 2.0.x - 3.2.x](https://github.com/cloudflare/workers-sdk/issues/11064).

**Key Points:**
- This is **intentional and correct configuration**
- Upgrading to Vitest v4 would **break tests** for these projects
- Vitest v4 support is being developed (PR #11632) but not yet released
- Projects without @cloudflare/vitest-pool-workers correctly use v4

### Action Required

**None at this time.** Monitor the [cloudflare/workers-sdk repository](https://github.com/cloudflare/workers-sdk/issues/11064) for the v4 support release.

---

## Completed Improvements (Dec 21, 2025)

The following optional improvements have been implemented:

### 1. Updated Hono in OAuth Worker

**Status:** COMPLETED

- Updated from ^4.6.0 to ^4.10.7
- Now matches discord-worker and presets-api

### 2. Updated @types/node in OAuth Worker

**Status:** COMPLETED

- Updated from ^22.10.1 to ^22.10.2
- Now matches all other projects

### 3. Added engines Field to Remaining Projects

**Status:** COMPLETED

Added `"engines": { "node": ">=18.0.0" }` to:
- xivdyetools-web-app
- xivdyetools-discord-worker
- xivdyetools-maintainer

All 9 projects now specify the minimum Node.js version requirement.

---

### SEC-007: Subresource Integrity - CLOSED

**Status:** Closed - Not Applicable
**Investigation Date:** December 21, 2025

#### Investigation Results

SEC-007 was investigated and determined to be **not applicable** for this project:

1. **No External JavaScript CDNs**
   - The project doesn't use any CDN-hosted JavaScript libraries
   - CSP `script-src 'self'` blocks ALL external scripts - this is stronger than SRI
   - No jQuery, Bootstrap, or similar libraries loaded from CDNs

2. **Google Fonts Doesn't Support SRI**
   - Google Fonts CSS is dynamically generated based on browser/device
   - The CSS content changes, so no stable hash can be generated
   - This is a known limitation documented by Google

3. **Other External Resources Don't Need SRI**
   - `cdn.discordapp.com` - User avatar images (can't execute code)
   - `universalis.app` - API connections (not script resources)

#### Conclusion

**No action required.** The existing CSP policy provides equivalent or better protection than SRI would for this use case.

---

## Maintenance Tasks

### Quarterly Secret Rotation

Per `SECRET_ROTATION.md`, next rotation is Q1 2026:

| Secret | Due Date |
|--------|----------|
| JWT_SECRET | March 15, 2026 |
| BOT_API_SECRET | March 15, 2026 |

---

### Monthly Dependency Audit

Continue running npm audit monthly:

```bash
for dir in xivdyetools-*; do
  echo "=== $dir ==="
  (cd "$dir" && npm audit 2>/dev/null || true)
done
```

Next audit: January 21, 2026

---

## Tracking Checklist

### December 2025

- [x] SEC-001: Maintainer authentication - RESOLVED
- [x] SEC-002: Remove selenium - RESOLVED
- [x] SEC-004: TypeScript standardization - RESOLVED
- [x] SEC-005: Core package update - RESOLVED
- [x] SEC-006: @types/node standardization - RESOLVED
- [x] SEC-008: CSP in HTTP headers - RESOLVED
- [x] SEC-009: Secret rotation documentation - RESOLVED
- [x] SEC-010: Vitest version split - ACCEPTED (intentional for CF Workers)

### January 2026 (Future)

- [ ] Monthly npm audit
- [ ] Review for new vulnerabilities

### March 2026 (Q1)

- [ ] Quarterly secret rotation
- [ ] Full security audit

---

## Verification Steps

After completing Vitest upgrade:

1. **Run all tests:**
   ```bash
   cd xivdyetools-oauth && npm test
   cd ../xivdyetools-presets-api && npm test
   ```

2. **Verify coverage:**
   ```bash
   npm run test:coverage
   ```

3. **Deploy to staging and verify:**
   - OAuth login flow works
   - Preset API endpoints respond
   - Bot commands function

---

## Risk Assessment

### Current State

| Category | Status |
|----------|--------|
| Critical findings | 0 |
| High findings | 0 |
| Medium findings | 0 |
| Low findings | 0 |
| Informational | 1 (SEC-010 - intentional) |
| Overall posture | EXCELLENT |

**Notes:**
- SEC-010 (Vitest v3/v4 split) is intentional and required for Cloudflare Workers testing compatibility
- SEC-007 (SRI) was closed as Not Applicable - CSP provides equivalent protection

---

## Residual Risks

| Risk | Mitigation | Acceptance |
|------|------------|------------|
| Zero-day in dependencies | Monthly audits, quick patching | Accepted |
| Discord API changes | Monitor changelog | Accepted |
| Cloudflare service issues | No alternative | Accepted |

---

## Comparison: Dec 15 vs Dec 21

| Metric | Dec 15, 2025 | Dec 21, 2025 |
|--------|--------------|--------------|
| Critical findings | 0 | 0 |
| High findings | 2 | 0 |
| Medium findings | 4 | 0 |
| Low findings | 3 | 0 |
| npm vulnerabilities | 0 | 0 |
| Remediation rate | - | 100% |
| Overall rating | GOOD | EXCELLENT |

---

## Next Audit Schedule

| Audit Type | Frequency | Next Date |
|------------|-----------|-----------|
| npm audit (automated) | Monthly | January 21, 2026 |
| Secret rotation | Quarterly | March 15, 2026 |
| Full security audit | Quarterly | March 21, 2026 |

---

## Conclusion

The xivdyetools ecosystem is in **excellent security condition** with **zero actionable findings**.

The Vitest v3/v4 split (SEC-010) was initially flagged as a medium-priority item but investigation revealed it's **intentional and required** for Cloudflare Workers testing. The `@cloudflare/vitest-pool-workers` package does not yet support Vitest v4.

**Current Status:**
- All previous findings from Dec 15 resolved or accepted
- Zero npm vulnerabilities across all projects
- No immediate action required

**Monitoring Items:**
1. Watch for `@cloudflare/vitest-pool-workers` v4 support release
2. Continue monthly npm audits
3. Follow Q1 2026 secret rotation schedule

---

**Document Owner:** XIV Dye Tools Team
**Classification:** Internal Use
**Last Updated:** December 21, 2025
