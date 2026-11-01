# Review: pkg-security (auth + logger + worker-kit)

Audit 2026-10-26, HEAD 13c386e5. Versions: auth 2.0.2, logger 2.3.0, worker-kit 1.5.0.
Delta since the 2026-10-03 base (0ab33466), from `git diff --stat 0ab33466 HEAD -- packages/{auth,logger,worker-kit}/src`:
auth `jwt.ts` (doc comments only); logger `core/base-logger.ts` (+360: BUG-140 free-text pass on
context string values, BUG-141 `toJSON` handling, URL-userinfo rule, linear `JWT_SCAN`);
worker-kit `body-guards.ts` (BUG-149 `isJsonMediaType`), `middleware/rate-limit.ts` (headers after
`next()`, `withMissingHeaders`), `backends/kv.ts` (paged `deleteByPrefix`). Nothing in these three
packages touches the new `.chara` feature.

Probes (scratchpad, not committed): `probe-logger.ts`, `probe-redos.ts`, `probe-err.ts`, `probe-jwt.mts`,
run with `node_modules/.bin/tsx` against `src/` directly.

## 1. Entry points and authz matrix

| Entry | Reached by | Guards | Caps |
|---|---|---|---|
| `verifyDiscordRequest` auth/src/discord.ts:70 | discord-worker `POST /` (index.ts:807), moderation-worker `POST /` (index.ts:160); any internet client | CL pre-check :78; both headers :91; timestamp 300 s past / 60 s future :101-110; Ed25519 `verifyKey` over the read bytes :147 | 100,000 B counted while streaming :117-136, reader cancelled past cap |
| `verifyBotSignatureV2` auth/src/hmac.ts:317 | presets-api auth.ts:311 after the `BOT_API_SECRET` bearer | 60 s age + 60 s skew :323-332; length-prefixed canonical :280-292; nonce single-use is the caller's (presets-api `isFreshBotNonce`) | body hashed, size capped by presets-api bodyGuards |
| `verifyJWT` / `verifyJWTSignatureOnly` jwt.ts:236 / :299 | presets-api auth.ts:100 (issuer pinned), oauth jwt-service.ts:232, oauth token.ts:118 (`/auth/revoke`) | alg === HS256 :151; HMAC before payload parse :162; claim typing :194-200; exp/nbf :250-257; type/iss/aud opt-in :260-270 | none in package |
| `createHmacKey` / `hmacSign*` / `hmacVerify*` hmac.ts:92-214 | oauth, both bots, presets-api | 32-byte floor :100 | n/a |
| `isTokenRevoked` / `revokeToken` revocation.ts:55 / :79 | oauth, presets-api | fail-open read (documented :49-53) | TTL = exp + 900 s - now, min 60 s |
| `timingSafeEqual` timing.ts:27 | discord-worker index.ts:326 | pads to max length, length check after compare | n/a |
| `requestIdMiddleware` worker-kit middleware/request-id.ts:54 | every Worker | UUID regex :24,:63 (default on) | n/a |
| `loggerMiddleware` middleware/logger.ts:112 | every Worker | pathname only unless `sanitizePath` :83-86; UA off by default :117 | n/a |
| `rateLimitMiddleware` middleware/rate-limit.ts:145 | presets-api (rate-limit.ts:132,:152) | `onError` default fail-open (accepted trade-off) | n/a |
| `getClientIp` rate-limiter/ip.ts:53 | every IP key extractor | CF-Connecting-IP; XFF ignored unless opted in :58 | n/a |
| Backends Memory / KV / Upstash / Cloudflare | api-worker, discord-worker, moderation-worker, oauth, presets-api (Upstash: no consumer) | KV key `${prefix}${key}|${window}` kv.ts:325; log lines carry `keyScope` only | KV TTL window+60 s; Memory 10,000 keys |
| `bodyGuards` body-guards/body-guards.ts:101 | oauth, presets-api | Hono `bodyLimit`; JSON depth 10 + `__proto__`/`constructor`/`prototype` own-key rejection on POST/PATCH/PUT with a JSON media type (structure.ts:35-56) | caller `maxSize` |

Caller matrix (unchanged from 2026-10-03): anonymous internet -> rejected by Ed25519 / no bot context / no JWT;
any Discord user -> only through a Discord-signed interaction; holder of `BOT_API_SECRET` alone ->
unauthenticated without a `BOT_SIGNING_SECRET` V2 signature and a fresh nonce.

## 2. Positive controls (re-verified this checkout)

- HMAC key floor 32 B (hmac.ts:99-102); every sign/verify goes through `getOrCreateHmacKey` -> `createHmacKey`.
- Constant-time: `crypto.subtle.verify` (hmac.ts:176,:205; jwt.ts:162); `timingSafeEqual` pads and checks length after the compare (timing.ts:31-54).
- V2 canonical string: 8 fixed fields, each `${len}:${value}` joined by `\n`, `v2` tag first (hmac.ts:280-292). Injective at the string level; probe `probe-jwt.mts` shows method is upper-cased before binding (a `get` request verifies a `GET` signature, by design).
- JWT: alg pinned, signature before payload parse, non-object payload rejected (jwt.ts:176), `exp`/`sub` typed, nbf honoured, iss pinned by presets-api (auth.ts:100-102).
- Discord: stream-counted 100 KB cap, crossing chunk not retained, freshness checked before body read (discord.ts:99-136).
- Logger redaction (probe-logger.ts): key list + `(token|secret|password|apikey)$` suffix catches `BOT_API_SECRET`, `JWT_SECRET`, `DISCORD_TOKEN`, `CACHE_PURGE_API_TOKEN`, `INTERNAL_WEBHOOK_SECRET`, `XIVAUTH_CLIENT_SECRET`, `UPSTASH_REDIS_REST_TOKEN`, `botToken`; header objects (`x-signature-ed25519` hex128, `Cookie`, `X-Api-Key`) redacted; JWT and Discord bot token in values and free text; `Authorization: Bot <token>` and URL userinfo password in error messages; Errors in context keep no stack/message.
- Logger regex cost: 20 adversarial 100 KB inputs through message + context + array (probe-redos.ts), worst 65 ms (Discord-token run); the BUG-140 URL-userinfo and JWT_SCAN rewrites are linear in practice.
- Rate-limit logs: `scopeRateLimitKey` everywhere a key could be logged (rate-limit.ts:179,:215; kv.ts:177,:250; upstash.ts:103; cloudflare.ts:207); never the IP / Discord id.
- `CloudflareRateLimiter` refuses a tier without callable `limit()` (cloudflare.ts:130-136) and keys per (limit, period) tier (:181).
- bodyGuards BUG-149: `isJsonMediaType` is a superset of the old substring test (body-guards.ts:43-55), so `Application/JSON` and `+json` bodies are now depth-checked; JSON.parse of 100k-deep nesting returns in 18 ms (node), and `validateStructure` stops at depth 11.
- `rateLimitMiddleware` memoizes a factory backend per isolate (rate-limit.ts:152-161); the only factory consumers (presets-api) select by `c.env`, which is constant per isolate.
- KV `deleteByPrefix` pages with a seen-cursor guard (kv.ts:299-312); reset key ends in `|` so `1.2.3.4` cannot reset `1.2.3.45`.

## 3. Rejected / not re-filed

- IPv6 keys are full addresses, not /64 buckets (ip.ts:87-89): raised and rejected in 2026-08-29 review-api-worker.md:204 as a platform-wide limitation; unchanged.
- V2 signature does not bind the query string: 2026-08-29 PKG-03, deliberately INFO; unchanged (hmac.ts:252).
- Lone-surrogate collision in the canonical string (TextEncoder maps `\uD800` and `�` to the same bytes, both length 1): identity fields come from HTTP headers, which are ByteStrings and cannot carry a surrogate; signer is a trusted bot. Unreachable.
- `parseInt` timestamp accepts suffixes (`"123abc"`): the raw timestamp string is itself bound into the HMAC, so a forged suffix fails verification.
- `verifyKey` exception message returned in the 401 body (discord.ts:155-159, discord-worker index.ts:813): only key/config errors throw; no secret material in them.
- Logger is secret-only, not personal-field redaction: 2026-10-03 rejected suspicion; unchanged.
- KV fallback limiter stores the IP in a key name for 120 s: disclosed in apps/web-app/PRIVACY.md:224-229 and a 2026-10-03 positive control.
- `rateLimitMiddleware` / backends fail open by default; `isTokenRevoked` fail-open: accepted trade-offs.
- `verifyJWTSignatureOnly` with no age cap at `/auth/revoke`: 2026-10-03 rejected (only revokes a token the caller already holds).
- `hmacVerify` / `hmacVerifyHex` return `crypto.subtle.verify(...)` without `await` inside `try` (hmac.ts:176, :205): 2026-10-03 handoff, still unfixed; `subtle.verify` rejects only on key misuse, not attacker bytes. Re-raise as a BUG handoff, not security.
- `jsonDepthLimit` calls `next()` when `c.req.text()` throws (body-guards.ts:136-140): the only throw in practice is Hono's BodyLimitError, which the cached rejected body re-raises in the handler and `bodyLimit`'s own catch turns into 413.
- `CloudflareRateLimiter.checkOnly` consumes a token and `increment` is a no-op (cloudflare.ts:245-252): over-counts, fails in the strict direction.
- `DISCORD_COMMAND_LIMITS` has no `glamour` key, so `/glamour` takes the 15/min default (configs.ts:102): a discord-worker tuning choice, routed to that reviewer.
- `OAUTH_LIMITS['/auth/refresh']` (configs.ts:29) for a route removed in oauth 3.0.0: dead config, no effect.

## 4. Candidates (details in the structured return)

| id | sev | exposure | file:line | claim |
|---|---|---|---|---|
| pkg-security-01 | LOW | INTERNAL | packages/logger/src/core/base-logger.ts:268-273 | Non-Error `error` argument is `safeStringify`'d and only free-text sanitised; the key-name list (cookie, session_id, webhook_url, set_cookie, nested keys) is never applied. Probe: `log.error('obj', {cookie:'sid=abc', session_id:'s1', webhook_url:'https://x/y'})` emits all three verbatim, while the same object as context is redacted. Five in-repo call sites already pass a context-shaped object as the error arg (discord-worker index.ts:319, :916; moderation-worker index.ts:239; presets-api retention-job.ts:86; stoat-worker index.ts:70), with harmless values today. |
| pkg-security-02 | INFO | INTERNAL | packages/logger/src/core/base-logger.ts:839-848 | No value shape covers a Discord webhook / interaction-token URL; probe shows `{url:'https://discord.com/api/webhooks/<id>/<token>'}` and the same string in a message survive. discord-worker builds such URLs (utils/discord-api.ts:76,:165,:340) but was not seen logging them; moderation-worker has its own `sanitizeUrl`. |
| pkg-security-03 | INFO | INTERNET-AUTH | packages/auth/src/encoding/base64.ts:254-273 | Signature decoding is non-canonical: a JWT whose signature has altered trailing bits, std-alphabet `+`/`/`, an inserted space or `=` padding still verifies (probe: 4/4 variants true); V2 accepts upper-case hex. No consumer keys anything by the token string (grep), revocation keys by `jti`, so no bypass today. |
| pkg-security-04 | INFO | LOCAL | packages/worker-kit/src/rate-limiter/ip.ts:44-47 | JSDoc example says "Default: trusts X-Forwarded-For as fallback" and :67 says "default true for compat", contradicting the real default `false` (:58); a consumer reading the docs may opt in believing it is the default, or omit it believing XFF is honoured. |

## 5. Files covered

28 source files read in full or in the relevant part:
- packages/auth/src: discord.ts, hmac.ts, jwt.ts, revocation.ts, timing.ts, index.ts, encoding/base64.ts, encoding/hex.ts (8)
- packages/logger/src: constants.ts, core/base-logger.ts (redaction, sanitise rules, safeStringify), presets/worker.ts, types.ts (signature only) (4)
- packages/worker-kit/src: body-guards/body-guards.ts, body-guards/structure.ts, middleware/request-id.ts, middleware/logger.ts, middleware/rate-limit.ts, rate-limiter/ip.ts, rate-limiter/key-scope.ts, rate-limiter/headers.ts, rate-limiter/types.ts (part), rate-limiter/presets/configs.ts, rate-limiter/backends/{memory,kv,upstash,cloudflare}.ts (14)
- consumer call sites: apps/oauth/src/handlers/token.ts, apps/oauth/src/services/jwt-service.ts, apps/presets-api/src/middleware/auth.ts, apps/discord-worker/src/index.ts, apps/discord-worker/src/utils/discord-api.ts, apps/moderation-worker/src/index.ts (parts)

Not read: logger adapters (console/json/noop), presets/browser.ts, presets/library.ts; worker-kit image-sniff (unchanged since 2026-10-03, reviewed then), barrel index files.
