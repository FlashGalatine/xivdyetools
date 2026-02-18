# Security Audit Report - @xivdyetools/core

## Executive Summary
- **Project:** @xivdyetools/core v1.15.0
- **Audit Date:** 2026-01-22
- **Auditor:** Claude Code (Sonnet 4.5)
- **Overall Risk Level:** **LOW**

### Key Findings
The xivdyetools-core library demonstrates **excellent security practices** with only minor informational findings. The codebase shows evidence of security-conscious development with multiple defense-in-depth controls.

**Security Highlights:**
✅ Zero npm dependency vulnerabilities
✅ No dangerous code patterns (eval, Function constructor)
✅ Proper input validation with ReDoS protection
✅ API response size limits to prevent DoS
✅ Request timeout and retry mechanisms
✅ Cache key sanitization to prevent injection
✅ Secrets properly excluded from version control

**Areas for Minor Improvement:**
⚠️ Direct console output bypasses logger abstraction (LOW)
ℹ️ NPM token in .env file (INFORMATIONAL - properly mitigated)

## Findings Summary

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 0 | ✅ None Found |
| High | 0 | ✅ None Found |
| Medium | 0 | ✅ None Found |
| Low | 1 | ⚠️ Review Recommended |
| Informational | 3 | ℹ️ Best Practices Noted |

## Critical Findings (Immediate Action Required)
**NONE** - No critical security vulnerabilities identified.

## High Priority Findings
**NONE** - No high-severity security issues identified.

## Medium Priority Findings
**NONE** - No medium-severity security issues identified.

## Low Priority Findings

### FINDING-001: Console Output in Production Code
- **Severity:** LOW
- **Category:** Information Disclosure (CWE-532)
- **Impact:** Limited information leakage; bypasses logger abstraction
- **Recommendation:** Replace `console.warn()` with logger interface
- **Files:**
  - [src/utils/index.ts:669](../xivdyetools-core/src/utils/index.ts#L669)
  - [src/services/dye/DyeSearch.ts:280,402](../xivdyetools-core/src/services/dye/DyeSearch.ts)
- **Details:** [findings/FINDING-001.md](security/findings/FINDING-001.md)

## Informational Findings (Best Practices & Observations)

### FINDING-002: NPM Token in .env File
- **Severity:** INFORMATIONAL
- **Status:** ✅ PROPERLY MITIGATED
- **Category:** Secrets Management (CWE-798)
- **Current Controls:**
  - ✅ .env file in .gitignore
  - ✅ Not tracked by git
  - ✅ Token has expiration (90 days)
  - ✅ Limited scope (single package)
- **Recommendation:** Document token rotation process; consider using npm login for development
- **Details:** [findings/FINDING-002.md](security/findings/FINDING-002.md)

### FINDING-003: ReDoS Protection (Positive Control)
- **Severity:** INFORMATIONAL (Security Best Practice)
- **Status:** ✅ EXCELLENT
- **Category:** ReDoS Prevention (CWE-1333)
- **Observation:** Hex color validation includes length check before regex to prevent ReDoS attacks
- **Analysis:** Regex pattern is safe with O(n) complexity
- **Recommendation:** Keep as-is; serves as good example for other validators
- **Details:** [findings/FINDING-003.md](security/findings/FINDING-003.md)

### FINDING-004: API Response Size Limits (Positive Control)
- **Severity:** INFORMATIONAL (Security Best Practice)
- **Status:** ✅ EXCELLENT
- **Category:** DoS Prevention (CWE-400)
- **Observation:** APIService implements dual-layer response size validation (1MB limit)
- **Defense-in-Depth:**
  - Content-Length header validation
  - Actual body size validation
  - AbortController timeout (5 seconds)
- **Recommendation:** Working as designed; no changes needed
- **Details:** [findings/FINDING-004.md](security/findings/FINDING-004.md)

## Detailed Findings
Individual finding reports are available in the [findings directory](security/findings/).

## Security Controls Analysis

### ✅ Input Validation
- **Hex Color Validation:** Length-limited with safe regex pattern
- **RGB Validation:** Range checks with Number.isFinite()
- **HSV Validation:** Range checks with boundary enforcement
- **API Parameters:** Sanitization of datacenter IDs, validation of item ID arrays

### ✅ Injection Prevention
- **Cache Key Injection:** Sanitization with `sanitizeDataCenterId()` (alphanumeric only)
- **URL Path Injection:** Input sanitization before URL construction
- **No SQL/NoSQL:** No database queries in this library
- **No Command Injection:** No shell command execution

### ✅ Denial of Service Prevention
- **Response Size Limits:** 1MB maximum (API_MAX_RESPONSE_SIZE)
- **Request Timeouts:** 5 second timeout (UNIVERSALIS_API_TIMEOUT)
- **Rate Limiting:** 200ms minimum delay between requests
- **Retry Limits:** Maximum 3 attempts with exponential backoff
- **Cache Size Limits:** LRU cache with configurable max size (default 1000)

### ✅ Information Disclosure Prevention
- **Error Sanitization:** API errors provide user-friendly messages without internal details
- **Logger Abstraction:** NoOpLogger default prevents accidental logging in production
- **⚠️ Minor Issue:** Some console.warn() calls bypass logger (FINDING-001)

### ✅ Dependency Security
- **Zero Vulnerabilities:** `npm audit` reports 0 vulnerabilities
- **Minimal Dependencies:** Only 3 production dependencies
  - @xivdyetools/logger: ^1.1.0 (internal package)
  - @xivdyetools/types: ^1.7.0 (internal package)
  - spectral.js: ^3.0.0 (color mixing library)
- **Regular Updates:** Recent TypeScript version (5.9.3)

### ✅ Secrets Management
- **No Hardcoded Secrets:** No API keys or credentials in source code
- **Environment Variables:** NPM token properly isolated in .env (gitignored)
- **Configuration:** Separation of sensitive and non-sensitive config

### ✅ Error Handling
- **Structured Errors:** AppError class with error codes
- **Try-Catch Coverage:** Comprehensive error handling in API calls
- **No Swallowed Exceptions:** Errors properly propagated or logged
- **Timeout Handling:** AbortController for request cancellation

## Automated Scan Results

### npm audit
```json
{
  "vulnerabilities": {
    "info": 0,
    "low": 0,
    "moderate": 0,
    "high": 0,
    "critical": 0,
    "total": 0
  },
  "dependencies": {
    "prod": 4,
    "dev": 311,
    "total": 314
  }
}
```

### Secrets Scan
- **Scan Date:** 2026-01-22
- **Files Scanned:** All TypeScript source files
- **Secrets Found:** 0 in committed code
- **False Positives:** Build artifacts and documentation examples excluded
- **Status:** ✅ PASS

## Recommendations

### Immediate Actions (None Required)
No critical or high-severity issues require immediate attention.

### Short-Term Improvements (Next Minor Version)
1. **Replace console.warn() with logger** (FINDING-001)
   - Impact: Reduces information leakage, improves consistency
   - Effort: LOW
   - Files: utils/index.ts, services/dye/DyeSearch.ts

2. **Document token rotation process** (FINDING-002)
   - Create SECURITY.md with secrets management guidelines
   - Add .env.example template
   - Effort: MINIMAL

### Long-Term Enhancements (Future Considerations)
1. **Add Content Security Policy headers** (if library is used in web contexts)
2. **Implement Subresource Integrity (SRI)** for CDN distribution
3. **Consider adding rate limiting per-datacenter** in APIService
4. **Add security.txt file** for vulnerability disclosure

## Testing Recommendations
1. **Fuzzing:** Test hex color validation with malformed inputs
2. **Load Testing:** Verify rate limiting under concurrent load
3. **Timeout Testing:** Confirm proper handling of slow/hanging API responses
4. **Cache Testing:** Verify LRU eviction under memory pressure

## Compliance & Standards
- ✅ **OWASP Top 10 (2021):** No applicable vulnerabilities
- ✅ **CWE Top 25:** No applicable weaknesses
- ✅ **NIST Cybersecurity Framework:** Adequate controls for a client library
- ✅ **Dependency Scanning:** All dependencies up-to-date and vulnerability-free

## Risk Assessment

### Overall Risk: **LOW**
The xivdyetools-core library demonstrates mature security practices with defense-in-depth controls. The identified issues are minor and properly mitigated or low-impact.

### Risk Factors
| Factor | Assessment | Notes |
|--------|------------|-------|
| Attack Surface | MINIMAL | Client-side library with limited external interactions |
| Dependency Risk | LOW | Only 3 prod dependencies, all clean |
| Input Validation | STRONG | Comprehensive validation with ReDoS protection |
| Error Handling | STRONG | Structured errors with proper propagation |
| DoS Resilience | STRONG | Multiple layers of protection |
| Information Disclosure | LOW | Minor console.warn() usage |
| Code Injection | NONE | No eval or dynamic code execution |

## Conclusion

The **@xivdyetools/core** library exhibits **exemplary security practices** for a client-side color manipulation library. The development team has clearly prioritized security with multiple defense-in-depth controls, proper input validation, and thoughtful error handling.

**Key Strengths:**
- Zero dependency vulnerabilities
- Comprehensive input validation
- DoS prevention mechanisms
- Secrets properly managed
- No dangerous code patterns

**Recommendations Summary:**
- Address console.warn() usage (LOW priority)
- Document secrets management process (INFORMATIONAL)
- Continue current security practices

**Audit Status:** ✅ **PASS WITH COMMENDATION**

The library is suitable for production use with the understanding that the minor findings should be addressed in future updates.

---

**Audit Performed By:** Claude Code (Sonnet 4.5)
**Audit Date:** 2026-01-22
**Audit Scope:** Source code security review, dependency analysis, automated scanning
**Methodology:** OWASP ASVS L2, CWE Top 25, manual code review
