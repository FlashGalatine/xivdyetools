# FINDING-009: CORS Middleware Allows All Origins

## Severity
INFORMATIONAL

## Category
CWE-942: Permissive Cross-domain Policy

## Location
- File: `xivdyetools-discord-worker/src/index.ts`
- Line(s): 84
- Function/Component: Hono CORS middleware

## Description
The Discord worker applies CORS middleware with default settings (`cors()`), which allows all origins (`Access-Control-Allow-Origin: *`). While this is noted as being "for development," it is applied unconditionally regardless of environment.

## Evidence
```typescript
// index.ts:83-84
// Enable CORS for development
app.use('*', cors());
```

The default Hono `cors()` middleware sets:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, HEAD, PUT, POST, DELETE, PATCH`
- `Access-Control-Allow-Headers: *`

## Impact
**Practical risk: Negligible.** For a Discord interaction endpoint:
- All requests come from Discord's servers, not browsers
- The endpoint requires Ed25519 signature verification, so CORS alone cannot enable unauthorized access
- The `/health` endpoint returns only non-sensitive status information
- Webhook endpoints require Bearer tokens or HMAC signatures

CORS is primarily a browser-enforcement mechanism. Since this worker's clients are Discord (server-to-server) and webhook callers (also server-to-server), permissive CORS has no practical security impact.

## Recommendation
While not a security risk, restricting CORS demonstrates defense-in-depth:

```typescript
// Option 1: Remove CORS entirely (Discord doesn't need it)
// app.use('*', cors());  // Remove this line

// Option 2: Restrict to known origins if browser access is needed
app.use('*', cors({
  origin: ['https://xivdyetools.app', 'https://xivdyetools.projectgalatine.com'],
}));
```

## References
- CWE-942: https://cwe.mitre.org/data/definitions/942.html
- MDN: Cross-Origin Resource Sharing (CORS)
