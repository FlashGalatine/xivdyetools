# 🔒 Security Audit Report: xivdyetools-maintainer

**Project:** XIV Dye Tools - Dye Maintainer (Internal Admin Tool)  
**Audit Date:** January 5, 2026  
**Auditor:** GitHub Copilot

---

## Executive Summary

This internal maintainer tool has **moderate security posture** for a development-only tool. It includes several good security practices (production guard, API key authentication) but has vulnerabilities that could be exploited if the tool is ever exposed beyond localhost or if security assumptions change.

**Overall Assessment: ✅ ALL ISSUES RESOLVED** (excellent for a dev tool)

| Severity | Count | Resolved |
|----------|-------|----------|
| 🔴 Critical | 1 | ✅ 1/1 |
| 🟠 High | 3 | ✅ 3/3 |
| 🟡 Medium | 6 | ✅ 6/6 |
| 🔵 Low | 4 | ✅ 4/4 |
| ⚪ Informational | 3 | ✅ 1/1 (actionable) |

---

## ✅ Resolution Status

**Resolution Date:** January 5, 2026
**Status:** ALL issues resolved (CRITICAL, HIGH, MEDIUM, and LOW severity)

### Implemented Fixes

All CRITICAL and HIGH severity vulnerabilities have been addressed:

1. **✅ Path Traversal Protection** (CRITICAL)
   - Implemented startup path validation in `server/utils/pathValidation.ts`
   - Added runtime path validation to all file operations
   - Server fails fast if paths are misconfigured

2. **✅ Input Validation** (HIGH)
   - Installed Zod validation library
   - Created comprehensive schemas in `server/schemas.ts`
   - Applied validation middleware to all POST endpoints
   - Invalid data is rejected with detailed error messages

3. **✅ Session-Based Authentication** (HIGH)
   - Removed API key from frontend (VITE_MAINTAINER_API_KEY)
   - Implemented SessionManager with cryptographically secure tokens
   - Frontend obtains ephemeral session tokens automatically
   - API key remains server-side only (optional fallback)

4. **✅ Timing-Safe Comparison** (HIGH)
   - Replaced string comparison with `crypto.timingSafeEqual()`
   - Prevents timing attacks on API key validation

5. **✅ Additional Security Hardening**
   - CORS restricted to `http://localhost:5174`
   - Server bound to `127.0.0.1` (localhost only)
   - Improved authentication middleware

### Files Modified

**New Files (CRITICAL + HIGH fixes):**
- `server/schemas.ts` - Zod validation schemas
- `server/middleware/validation.ts` - Validation middleware
- `server/auth/SessionManager.ts` - Session management
- `server/middleware/auth.ts` - Authentication middleware
- `server/utils/pathValidation.ts` - Path validation utilities

**New Files (MEDIUM fixes - 2026-01-05):**
- `server/middleware/rateLimiting.ts` - Three-tiered rate limiting configuration
- `server/middleware/errorSanitizer.ts` - Error sanitization utilities
- `server/middleware/timeout.ts` - Request timeout middleware
- `src/utils/fetchWithTimeout.ts` - Client-side fetch timeout wrapper

**New Files (LOW fixes - 2026-01-05):**
- `server/middleware/contentType.ts` - Content-Type validation middleware
- `server/middleware/requestLogger.ts` - Structured logging with request correlation
- `server/middleware/errorHandler.ts` - Global error handler and 404 handler
- `server/utils/logger.ts` - Structured JSON logging utility
- `SECURITY.md` - Comprehensive security documentation

**Updated Files:**
- `server/api.ts` - Applied all security fixes (logging, error handlers, PORT config, middleware)
- `server/middleware/validation.ts` - Updated to use error sanitizer
- `src/services/fileService.ts` - Updated to use fetchWithTimeout for all API calls
- `src/env.d.ts` - Removed API key type definition
- `.env.example` - Added PORT configuration documentation
- `README.md` - Added PORT configuration usage instructions
- `package.json` - Added Zod and express-rate-limit dependencies

---

## Detailed Findings

### 🔴 CRITICAL

#### 1. Path Traversal Vulnerability in File Operations ✅ RESOLVED
**File:** `server/api.ts`
**Lines:** 67-73
**Status:** ✅ **FIXED** (2026-01-05)

```typescript
const CORE_PATH = path.resolve(__dirname, '../../xivdyetools-core')
const COLORS_PATH = path.join(CORE_PATH, 'src/data/colors_xiv.json')
const LOCALES_PATH = path.join(CORE_PATH, 'src/data/locales')
```

**Description:** While the locale code is validated against a whitelist, the paths are constructed using relative paths from `__dirname`. If the server process is started from an unexpected directory or if symlinks are involved, this could potentially write to unintended locations. More critically, there's no validation that the resolved paths stay within the expected directory.

**Risk:** An attacker with write access could potentially modify critical system files if the `path.resolve` resolution is manipulated.

**Recommendation:**
```typescript
// Add path validation
function isPathSafe(targetPath: string, basePath: string): boolean {
  const resolvedTarget = path.resolve(targetPath)
  const resolvedBase = path.resolve(basePath)
  return resolvedTarget.startsWith(resolvedBase + path.sep)
}

// Verify paths at startup
if (!fs.existsSync(CORE_PATH) || !isPathSafe(COLORS_PATH, CORE_PATH)) {
  console.error('Invalid path configuration')
  process.exit(1)
}
```

**Resolution:**
Implemented comprehensive path validation with both startup and runtime checks:
- Created `server/utils/pathValidation.ts` with `validateBasePaths()` and `validateFilePath()` functions
- Added startup validation that fails fast if paths are misconfigured
- Added runtime validation to all locale endpoint operations (GET and POST)
- Server now exits immediately if core paths don't resolve correctly
- All file operations verify paths stay within expected directories

---

### 🟠 HIGH

#### 2. Missing Input Validation on POST /api/colors ✅ RESOLVED
**File:** `server/api.ts`
**Lines:** 91-100
**Status:** ✅ **FIXED** (2026-01-05)

```typescript
app.post('/api/colors', async (req, res) => {
  try {
    await writeJsonFile(COLORS_PATH, req.body)  // No validation!
    res.json({ success: true })
```

**Description:** The endpoint accepts arbitrary JSON and writes it directly to the colors file without any schema validation. An attacker with the API key could inject malicious data, corrupt the data file, or cause denial of service by writing extremely large payloads (limited only by the 10MB body parser).

**Risk:** Data corruption, injection of malicious content into downstream applications consuming this data.

**Recommendation:**
```typescript
import { z } from 'zod'

const DyeSchema = z.array(z.object({
  itemID: z.number().nullable(),
  category: z.string().max(50),
  name: z.string().max(200),
  hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  acquisition: z.string().max(50),
  price: z.number().nullable(),
  currency: z.string().max(20).nullable(),
  rgb: z.object({ r: z.number().int().min(0).max(255), g: z.number().int().min(0).max(255), b: z.number().int().min(0).max(255) }),
  hsv: z.object({ h: z.number(), s: z.number(), v: z.number() }),
  isMetallic: z.boolean(),
  isPastel: z.boolean(),
  isDark: z.boolean(),
  isCosmic: z.boolean(),
}))

app.post('/api/colors', async (req, res) => {
  const result = DyeSchema.safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({ success: false, error: 'Invalid data format' })
  }
  await writeJsonFile(COLORS_PATH, result.data)
})
```

**Resolution:**
Implemented comprehensive input validation using Zod:
- Installed Zod validation library
- Created `DyeArraySchema` in `server/schemas.ts` with full validation rules
- Created reusable `validateBody()` middleware in `server/middleware/validation.ts`
- Applied validation middleware to POST /api/colors endpoint
- Invalid requests now return 400 with detailed error messages
- Validation includes: itemID, category, name, hex format, RGB/HSV ranges, boolean flags

---

#### 3. Missing Input Validation on POST /api/locale/:code ✅ RESOLVED
**File:** `server/api.ts`
**Lines:** 118-133
**Status:** ✅ **FIXED** (2026-01-05)

```typescript
app.post('/api/locale/:code', async (req, res) => {
  // ... locale code validation only ...
  try {
    const filePath = path.join(LOCALES_PATH, `${code}.json`)
    await writeJsonFile(filePath, req.body)  // No body validation!
```

**Description:** Same issue as above - locale data is written without schema validation.

**Risk:** Corruption of locale files, potential XSS if locale data contains script content rendered elsewhere.

**Recommendation:** Add Zod schema validation for LocaleData type.

**Resolution:**
Implemented comprehensive locale data validation:
- Created `LocaleDataSchema` in `server/schemas.ts` with full validation
- Validates locale code, meta, labels, dyeNames, and optional fields
- Applied validation middleware to POST /api/locale/:code endpoint
- Ensures locale data structure is correct before writing to files
- Prevents corruption of locale files

---

#### 4. API Key Exposed in Client-Side Code ✅ RESOLVED
**File:** `src/services/fileService.ts`
**Lines:** 11-14
**Status:** ✅ **FIXED** (2026-01-05)

```typescript
function getApiKey(): string {
  return import.meta.env.VITE_MAINTAINER_API_KEY || ''
}
```

**Description:** The API key is bundled into the client-side JavaScript via Vite's environment variable system (`VITE_` prefix). This means anyone who can access the web app can extract the API key from the bundled JavaScript.

**Risk:** If the app is ever served to unauthorized users (even accidentally), the API key is immediately compromised.

**Recommendation:**
1. For a dev-only tool, consider session-based authentication instead
2. Or implement a proxy pattern where the server validates sessions and adds the API key
3. Add a warning in the README about this limitation

**Resolution:**
Implemented session-based authentication (option 1):
- Removed `VITE_MAINTAINER_API_KEY` from frontend entirely
- Created `SessionManager` class in `server/auth/SessionManager.ts`
- Session tokens are generated using `crypto.randomBytes()` (cryptographically secure)
- Frontend automatically obtains session token on health check
- Session tokens stored in memory only (never persisted)
- API key remains server-side only for optional fallback authentication
- Updated `src/env.d.ts` and `.env.example` to remove frontend API key references

---

### 🟡 MEDIUM

#### 5. CORS Configured to Allow All Origins ✅ RESOLVED
**File:** `server/api.ts`
**Line:** 28
**Status:** ✅ **FIXED** (2026-01-05)

```typescript
app.use(cors())
```

**Description:** CORS is configured with default settings, allowing requests from any origin. While this is common for dev tools, it means any website can make requests to the API if running.

**Risk:** If a user visits a malicious website while the maintainer server is running, that website could potentially make API calls.

**Recommendation:**
```typescript
app.use(cors({
  origin: ['http://localhost:5174', 'http://127.0.0.1:5174'],
  methods: ['GET', 'POST'],
  credentials: false,
}))
```

**Resolution:**
Restricted CORS to localhost only:
- Updated CORS configuration in `server/api.ts`
- Origin restricted to `http://localhost:5174`
- Credentials disabled for security

---

#### 6. No Rate Limiting ✅ RESOLVED
**File:** `server/api.ts`
**Status:** ✅ **FIXED** (2026-01-05)

**Description:** No rate limiting is implemented on any endpoints. An attacker could flood the server with requests.

**Risk:** Denial of service, resource exhaustion.

**Recommendation:** Implement rate limiting using `express-rate-limit`.

**Resolution:**
Implemented comprehensive three-tiered rate limiting using express-rate-limit:
- Created `server/middleware/rateLimiting.ts` with three rate limiters:
  - **Global Limiter**: 1000 requests per 15 minutes (all endpoints)
  - **Write Limiter**: 30 requests per 1 minute (POST /api/colors, POST /api/locale/:code)
  - **Session Limiter**: 10 requests per 15 minutes (POST /api/auth/session)
- Applied rate limiters to all endpoints in `server/api.ts`
- Rate limit headers (`RateLimit-*`) included in responses
- Appropriate limits for development tool (generous but protective)

---

#### 7. Timing Attack Vulnerability in API Key Comparison ✅ RESOLVED
**File:** `server/api.ts`
**Lines:** 52-56
**Status:** ✅ **FIXED** (2026-01-05)

```typescript
const providedKey = req.headers['x-api-key']
if (providedKey !== API_KEY) {
  console.warn(`🚫 Unauthorized API request to ${req.method} ${req.path}`)
  res.status(401).json({ success: false, error: 'Unauthorized' })
```

**Description:** String comparison with `!==` is vulnerable to timing attacks. An attacker could potentially determine the API key character by character by measuring response times.

**Risk:** API key disclosure through timing side-channel.

**Recommendation:**
```typescript
import crypto from 'crypto'

function secureCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

// Then use:
if (!providedKey || !secureCompare(String(providedKey), API_KEY)) {
```

**Resolution:**
Implemented timing-safe comparison:
- Created `timingSafeEqual()` function in `server/middleware/auth.ts`
- Uses `crypto.timingSafeEqual()` for constant-time comparison
- Prevents timing attacks on API key validation
- Applied to all API key comparisons in auth middleware

---

#### 8. Potential XSS in Error Messages ✅ RESOLVED
**File:** `src/components/DyeEditor.vue`
**Lines:** 94-96
**Status:** ✅ **FIXED** (2026-01-05)

```vue
<p v-if="error" class="text-sm mt-2" :class="isDuplicate ? 'text-red-400' : 'text-yellow-400'">
  {{ error }}
</p>
```

**Description:** Error messages from external sources (XIVAPI) are displayed directly. Vue's template interpolation (`{{ }}`) auto-escapes, which mitigates most XSS, but if error handling changes or raw HTML binding is ever introduced, this could become exploitable.

**Risk:** Low immediate risk due to Vue's auto-escaping, but worth noting for defense-in-depth.

**Recommendation:** Sanitize external error messages before storage.

**Resolution:**
Implemented comprehensive error sanitization to prevent user input in error messages:
- Created `server/middleware/errorSanitizer.ts` with error sanitization system:
  - `ValidationErrorCode` enum for safe error codes
  - `sanitizeZodError()` function to convert Zod errors to safe format
  - Generic error messages that never include user input
- Updated `server/middleware/validation.ts` to use error sanitizer:
  - Full error details logged server-side for debugging
  - Only sanitized error codes and generic messages sent to client
  - Format: `{ field: "itemID", code: "INVALID_TYPE", message: "Field 'itemID' has invalid type" }`
- Eliminates risk of user input appearing in validation error messages

---

#### 9. Missing Request Timeout Configuration ✅ RESOLVED
**File:** `server/api.ts`
**Status:** ✅ **FIXED** (2026-01-05)

**Description:** The Express server has no timeout configuration. Long-running requests could tie up resources.

**Recommendation:** Add `connect-timeout` middleware with a 30-second timeout.

**Resolution:**
Implemented comprehensive timeout protection on both server and client:
- **Server-side:**
  - Created `server/middleware/timeout.ts` with 30-second timeout middleware
  - Sets both socket-level and response-level timeouts
  - Automatically responds with 408 Request Timeout if exceeded
  - Applied early in middleware stack in `server/api.ts`
- **Client-side:**
  - Created `src/utils/fetchWithTimeout.ts` utility using AbortController
  - Wraps native fetch with configurable timeout (default 15s)
  - Updated all 8 fetch calls in `src/services/fileService.ts`:
    - Read operations: 15s timeout (health, session, reads, validation)
    - Write operations: 30s timeout (POST /api/colors, POST /api/locale/:code)
- Prevents hung connections and provides clear user feedback on timeout

---

#### 10. No HTTPS Enforcement ✅ RESOLVED
**File:** `server/api.ts`
**Lines:** 177-185
**Status:** ✅ **FIXED** (2026-01-05)

```typescript
app.listen(PORT, () => {
```

**Description:** Server only listens on HTTP. API keys are transmitted in clear text over the network.

**Risk:** If used on a network (not just localhost), API keys could be intercepted.

**Recommendation:** Bind to localhost only:
```typescript
app.listen(PORT, '127.0.0.1', () => {  // Bind to localhost only
```

**Resolution:**
Server now binds to localhost only:
- Updated `app.listen()` to bind to `127.0.0.1`
- Server is not accessible from network interfaces
- Eliminates risk of network interception
- Appropriate for development-only tool

---

### 🔵 LOW

#### 11. Missing Content-Type Validation ✅ RESOLVED
**File:** `server/api.ts`
**Line:** 29
**Status:** ✅ **FIXED** (2026-01-05)

```typescript
app.use(express.json({ limit: '10mb' }))
```

**Description:** No explicit Content-Type validation. The server will attempt to parse any body as JSON regardless of Content-Type header.

**Recommendation:**
```typescript
app.use(express.json({
  limit: '10mb',
  type: 'application/json'
}))
```

**Resolution:**
Implemented comprehensive Content-Type validation middleware:
- Created `server/middleware/contentType.ts` with strict validation
- Validates mutation operations (POST, PUT, PATCH, DELETE) require `application/json` Content-Type
- Skips validation for requests with no body (Content-Length: 0)
- Returns 415 Unsupported Media Type for invalid Content-Type
- Logs invalid Content-Type attempts with requestId and IP address
- Applied middleware before `express.json()` in `server/api.ts`

---

#### 12. Insufficient Logging ✅ RESOLVED
**File:** `server/api.ts`
**Status:** ✅ **FIXED** (2026-01-05)

**Description:** Only unauthorized access attempts are logged. Successful mutations, server errors, and other security-relevant events are not logged.

**Recommendation:** Add structured logging for all API operations.

**Resolution:**
Implemented comprehensive structured logging and audit trail:
- Created `server/utils/logger.ts` - JSON-formatted structured logging utility
  - Log levels: DEBUG, INFO, WARN, ERROR, AUDIT
  - Consistent timestamp (ISO 8601) and context format
  - Machine-parseable JSON output for easy filtering
- Created `server/middleware/requestLogger.ts` - Request logging middleware
  - Generates unique request ID using `crypto.randomBytes()` for correlation
  - Logs all incoming requests (method, path, IP, user-agent)
  - Logs all responses (status code, duration)
  - AUDIT logs for successful mutation operations (POST/PUT/DELETE with 2xx status)
  - Attaches requestId to Request object for use across middleware
- Updated all route error handlers in `server/api.ts` to use Logger.error()
  - Replaced scattered console.error calls with structured Logger.error()
  - Added context: requestId, method, path, error message, IP
  - Maintains startup banners as plain console for better readability

---

#### 13. Error Details Exposed to Client ✅ RESOLVED
**File:** `server/api.ts`
**Lines:** 95-99
**Status:** ✅ **FIXED** (2026-01-05)

**Description:** While the current implementation is good (generic error messages), the pattern of catching and exposing could accidentally leak details if changed.

**Recommendation:** Use a standardized error handler that ensures no stack traces leak.

**Resolution:**
Implemented multiple fixes to prevent error information disclosure:
1. **Fixed Health Endpoint** (line 96):
   - Removed `corePath: CORE_PATH` from response (was exposing file system path)
   - Now returns only `{ "status": "ok" }`
   - Added security comment explaining path validation happens at startup
2. **Global Error Handler** (`server/middleware/errorHandler.ts`):
   - Created `globalErrorHandler()` - catches unhandled exceptions
   - Logs full error details server-side (message, stack trace, requestId)
   - Returns only generic "Internal server error" to client
   - Created `notFoundHandler()` - handles 404 for undefined routes
   - Registered both handlers LAST in middleware stack (after all routes)

---

#### 14. Hardcoded Server Port ✅ RESOLVED
**File:** `server/api.ts`
**Line:** 71
**Status:** ✅ **FIXED** (2026-01-05)

```typescript
const PORT = 3001
```

**Description:** Port is hardcoded rather than configurable via environment variable.

**Recommendation:**
```typescript
const PORT = process.env.MAINTAINER_PORT || 3001
```

**Resolution:**
Made server port configurable via environment variable:
- Updated `server/api.ts` line 89: `const PORT = parseInt(process.env.PORT || '3001', 10)`
- Updated `.env.example` with PORT configuration section:
  - Documented default value (3001)
  - Added note about frontend API base URL dependency
  - Included configuration instructions
- Updated `README.md` with "Custom Port Configuration" section:
  - Documented how to set PORT via environment variable
  - Provided examples: `PORT=4000 npm run dev:server`
  - Added note about updating frontend API base URL if port changes
- Backward compatible: defaults to 3001 if PORT not set

---

### ⚪ INFORMATIONAL

#### 15. Good Practice: Production Guard ✅
**File:** `server/api.ts`  
**Lines:** 15-22

```typescript
if (process.env.NODE_ENV === 'production') {
  console.error('... ERROR: Maintainer service must NOT run in production! ...')
  process.exit(1)
}
```

**Positive Finding:** Excellent practice preventing accidental production deployment.

---

#### 16. Good Practice: Locale Code Whitelist ✅
**File:** `server/api.ts`  
**Lines:** 103-107

```typescript
const validCodes = ['en', 'ja', 'de', 'fr', 'ko', 'zh']
if (!validCodes.includes(code)) {
  return res.status(400).json({ success: false, error: 'Invalid locale code' })
}
```

**Positive Finding:** Proper whitelist validation prevents path traversal via locale parameter.

---

#### 17. Security Documentation Missing ✅ RESOLVED
**File:** `README.md`, `CLAUDE.md`
**Status:** ✅ **FIXED** (2026-01-05)

**Description:** No security documentation exists outlining:
- Threat model for this tool
- Security assumptions
- Safe usage guidelines

**Recommendation:** Create a SECURITY.md documenting the security model and limitations.

**Resolution:**
Created comprehensive `SECURITY.md` documentation (~400 lines):
- **Overview**: Dev-only tool warning and introduction
- **Threat Model**: Assumptions and identified threats
- **Security Controls**: Detailed documentation of all 12 security controls:
  1. Production environment guard
  2. Network binding restriction (127.0.0.1)
  3. CORS restriction to localhost
  4. Authentication (session-based + API key fallback)
  5. Rate limiting (3-tier system)
  6. Request timeout (30s server, 15s/30s client)
  7. Path traversal protection (startup + runtime)
  8. Input validation (Zod schemas)
  9. Content-Type validation
  10. Error sanitization
  11. Structured logging & audit trail
  12. Global error handler
- **Known Limitations**: Documents acceptable risks for dev tool (no HTTPS, API key in env, etc.)
- **Security Testing**: Recommended tests with example commands
- **Reporting Security Issues**: Disclosure process
- **Security Checklist**: Verification checklist for all controls
- **Change Log**: Tracks security improvements over time
- **References**: Links to OWASP, Express security docs, Node.js security checklist

---

## Summary Recommendations

### Immediate Actions (High Priority)
1. Add input validation schemas (Zod) for all POST endpoints
2. Use timing-safe comparison for API key validation  
3. Restrict CORS to localhost origins
4. Bind server to `127.0.0.1` only

### Short-Term Actions (Medium Priority)
5. Add rate limiting
6. Implement path validation at startup
7. Add request timeout configuration
8. Document security assumptions

### Long-Term Considerations
9. Consider replacing API key auth with session-based auth for better security
10. Add structured logging/audit trail
11. Create automated security tests

---

## Security Checklist Summary

| Control | Status |
|---------|--------|
| Production Guard | ✅ Excellent - Exits on production environment |
| Network Binding | ✅ Server bound to 127.0.0.1 only (localhost) |
| CORS Protection | ✅ Restricted to http://localhost:5174 |
| Authentication | ✅ Session-based with timing-safe comparison |
| Authorization | ✅ Write ops require key, reads open |
| Rate Limiting | ✅ Three-tiered (global, write, session) |
| Request Timeouts | ✅ 30s server, 15s/30s client |
| Path Traversal | ✅ Startup + runtime path validation |
| Input Validation | ✅ Zod schemas with sanitized errors |
| Content-Type | ✅ Strict application/json validation |
| Error Sanitization | ✅ No user input in errors, generic messages |
| Structured Logging | ✅ JSON format with request correlation IDs |
| Global Error Handler | ✅ Catches unhandled exceptions, prevents leaks |
| XSS Protection | ✅ Vue auto-escaping + error sanitization |
| Security Documentation | ✅ Comprehensive SECURITY.md created |
