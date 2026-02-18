# XIV Dye Tools - Security & Performance Remediation TODO

**Last Updated:** December 7, 2025
**Status:** Phase 1 Critical Fixes Complete

---

## Completed (December 7, 2025)

### 🚨 CRITICAL (P0) - All Fixed!

| Issue | Project | Files Modified | Commit |
|-------|---------|----------------|--------|
| ✅ PKCE code_verifier exposure | OAuth + Web App | `authorize.ts`, `callback.ts`, `auth-service.ts` | `0a44cb8`, `f6a9160` |
| ✅ Token refresh accepts forged tokens | OAuth | `jwt-service.ts`, `refresh.ts` | `7d270fe` |
| ✅ Open redirect vulnerability | Web App | `auth-service.ts` | `aa6745a` |

**Summary of Fixes:**
1. **PKCE Fix:** The `code_verifier` now stays in `sessionStorage` and is sent directly to POST `/auth/callback`. It never travels through URL redirects.
2. **Token Forgery Fix:** Added `verifyJWTSignatureOnly()` function to verify expired tokens' signatures before allowing refresh.
3. **Open Redirect Fix:** Added `sanitizeReturnPath()` function with comprehensive URL validation.

---

## Remaining Work

### 🔴 HIGH PRIORITY (P1) - Fix This Week

#### Security Issues

| # | Project | Issue | File | Effort | Status |
|---|---------|-------|------|--------|--------|
| 1 | presets-api | CORS allows all localhost ports | `src/index.ts:48-49` | 15 min | ✅ |
| 2 | presets-api | CORS returns `*` for no-origin requests | `src/index.ts:44-51` | 15 min | ✅ |
| 3 | presets-api | Bot auth trusts user-supplied headers | `src/middleware/auth.ts:139-146` | 30 min | ✅ |
| 4 | presets-api | JWT algorithm not validated | `src/middleware/auth.ts:47-94` | 15 min | ✅ |
| 5 | oauth | JWT token in URL query params | `src/handlers/callback.ts:110-112` | 30 min | ✅ (fixed with PKCE) |
| 6 | web-app | JWT stored in localStorage (XSS risk) | `src/services/auth-service.ts:215-218` | 2 hours | ⬜ |
| 7 | web-app | Sensitive token logging | Multiple files | 30 min | 🔶 Partial |

#### Performance Issues

| # | Project | Issue | File | Effort | Status |
|---|---------|-------|------|--------|--------|
| 8 | web-app | Excessive console.log (40+ statements) | Multiple files | 1 hour | 🔶 Partial |
| 9 | web-app | Event listener memory leaks (490 vs 36) | `src/components/base-component.ts` | 2 hours | ⬜ |
| 10 | presets-api | N+1 pagination queries | `src/services/preset-service.ts:105-119` | 30 min | ✅ |
| 11 | presets-api | Missing composite indexes | `schema.sql:48-54` | 15 min | ✅ |

### 🟠 MEDIUM PRIORITY (P2) - Fix This Month

#### Security Issues

| # | Project | Issue | File | Effort |
|---|---------|-------|------|--------|
| 12 | presets-api | LIKE wildcards not escaped | `src/services/preset-service.ts:75-78` | 15 min | ✅ |
| 13 | presets-api | Race condition in vote duplicate check | `src/handlers/votes.ts:25-30` | 30 min | ✅ |
| 14 | oauth | Token revocation is a no-op | `src/handlers/refresh.ts:173-181` | 1 hour | ✅ |
| 15 | oauth | CORS too permissive (localhost) | `src/index.ts:36-38` | 15 min | ✅ |
| 16 | web-app | innerHTML with user content | Multiple locations | 1 hour | ✅ |
| 17 | core | maxIterations not clamped (DoS potential) | `src/services/PaletteService.ts:343` | 10 min | ✅ |

#### Performance Issues

| # | Project | Issue | File | Effort |
|---|---------|-------|------|--------|
| 18 | presets-api | Vote operations execute 4-5 queries | `src/handlers/votes.ts:20-79` | 30 min | ✅ |
| 19 | presets-api | Categories endpoint JOINs every request | `src/handlers/categories.ts:19-51` | 1 hour | ✅ |
| 20 | presets-api | Regex recompilation per request | `src/services/moderation-service.ts:23-37` | 20 min | ✅ |
| 21 | core | Sequential batch API calls | `src/services/APIService.ts:626-637` | 1 hour | ✅ |
| 22 | web-app | setTimeout without cleanup | Multiple locations | 30 min | ✅ |
| 23 | web-app | Duplicate service instantiation | Multiple components | 30 min | ✅ |

#### Code Quality Issues

| # | Project | Issue | Effort | Status |
|---|---------|-------|--------|--------|
| 24 | discord-worker | Duplicate DiscordInteraction types | 1 hour | ⬜ |
| 25 | discord-worker | Redundant locale resolution | 30 min | ✅ (regression test added) |
| 26 | web-app | Giant monolithic components (1200+ lines) | 4 hours | ✅ |

### 🟡 LOW PRIORITY (P3) - Fix When Convenient

| # | Project | Issue | Effort | Status |
|---|---------|-------|--------|--------|
| 27 | presets-api | Missing security headers | 15 min | ✅ |
| 28 | presets-api | Error details in production logs | 15 min | ✅ |
| 29 | presets-api | No public rate limits | 1 hour | ✅ |
| 30 | presets-api | Hardcoded CORS domain | 10 min | ✅ |
| 31 | oauth | No rate limiting on auth endpoints | 1 hour | ✅ |
| 32 | oauth | Potential info leakage in logs | 15 min | ✅ |
| 33 | discord-worker | Webhook secret timing attack | 30 min | ✅ |
| 34 | discord-worker | No request body size limit | 15 min | ✅ |
| 35 | core | Cache key injection | 15 min | ✅ |
| 36 | web-app | Missing ARIA accessibility attributes | 1 hour | ✅ |
| 37 | web-app | HTML in translation strings | 30 min | ✅ |

---

## Quick Reference: Next Session Tasks

### Recommended Next Steps (in order)

1. **CORS Fixes (30 min total)**
   - `xivdyetools-presets-api/src/index.ts` - Fix localhost wildcards
   - `xivdyetools-oauth/src/index.ts` - Fix localhost wildcards

2. **JWT Algorithm Validation (15 min)**
   - `xivdyetools-presets-api/src/middleware/auth.ts` - Validate HS256

3. **Bot Auth Header Trust (30 min)**
   - `xivdyetools-presets-api/src/middleware/auth.ts` - Validate bot requests

4. **Console Logging Cleanup (1 hour)**
   - Remove/guard remaining console.log in web-app
   - Add structured logging where needed

5. **Database Indexes (15 min)**
   - `xivdyetools-presets-api/schema.sql` - Add composite indexes

---

## Deployment Notes

### Order of Deployment
1. Deploy `xivdyetools-oauth` FIRST (PKCE changes)
2. Deploy `xivdyetools-web-app` SECOND (client-side PKCE changes)
3. Test OAuth flow end-to-end before deploying other changes

### Testing Checklist
- [ ] OAuth login works (new PKCE flow)
- [ ] Token refresh works (signature verification)
- [ ] Open redirect blocked (try `?return_path=https://evil.com`)
- [ ] Forged tokens rejected on refresh

### Rollback Plan
- OAuth worker: Revert to previous version in Cloudflare dashboard
- Web app: Redeploy previous build from Cloudflare Pages

---

## Files Modified Summary

### xivdyetools-oauth
- `src/handlers/authorize.ts` - Removed code_verifier from state
- `src/handlers/callback.ts` - GET returns code, POST exchanges it
- `src/handlers/refresh.ts` - Added signature verification
- `src/services/jwt-service.ts` - Added `verifyJWTSignatureOnly()`
- `src/__tests__/authorize.test.ts` - Updated for new flow
- `src/__tests__/callback.test.ts` - Updated for new flow
- `src/__tests__/refresh.test.ts` - Added security test

### xivdyetools-web-app
- `src/services/auth-service.ts` - New PKCE flow + open redirect fix + console log cleanup
