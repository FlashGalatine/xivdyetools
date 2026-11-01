# FINDING-046: v2 bot signature binds URL pathname only; GET query string (status/search/sort/page/limit) is unsigned
**Severity:** INFO · **Exposure:** INTERNAL · **Deploy unit:** discord-worker · **Rotation:** NONE · **Policy:** NONE · **CWE:** n/a

## Location
- `apps/discord-worker/src/services/preset-api.ts:120` — v2 bot signature binds URL pathname only; GET query string (status/search/sort/page/limit) is unsigned

## Evidence
- preset-api.ts:120 `path: new URL(`https://internal${path}`).pathname,`; auth.ts:318 `path: new URL(c.req.url).pathname,`; hmac.ts:252 `/** URL path only (no origin, no query) */`
- Reach: discord-worker request() signs `new URL(...).pathname` (preset-api.ts:120), and getPresets (preset-api.ts:215-229) appends the filters as a query string. presets-api authMiddleware verifies against `new URL(c.req.url).pathname` (apps/presets-api/src/middleware/auth.ts:313-323). Rewriting the query needs someone inside the PRESETS_API service binding (wrangler.toml:30/154), which no outside party can reach.
- Confirmed: canonicalV2 (packages/auth/src/hmac.ts:280-291) covers method, path, body hash, timestamp, nonce and identity, but never the query string, and both sides agree on the pathname. No attack follows. The request travels the service binding in both environments. Each nonce is single-use (isFreshBotNonce, 120 s KV) inside a 60 s window. The one query field that matters for authorization, status, is gated by isModerator, which comes from the signed identity (presets.ts:235-239), and getPresets sends no user identity. Preconditions: To matter, an attacker would need to sit inside the service binding, or the PRESETS_API_URL fallback would have to be used without the binding while TLS is intercepted. The attacker would also have to beat the single-use nonce check and the 60 s window. And a query parameter would have to become re…
- Live state the repo cannot show: This assumes the deployed production worker has the PRESETS_API service binding attached, as wrangler.toml:154 declares, so the URL fallback is never used.

## Fix
- Optional hardening: bind a canonical query (the sorted `url.search`) into canonicalV2 as a v3 field and update both bots and presets-api together. Otherwise document in hmac.ts that query parameters must never decide authorization.

## Status
OPEN
