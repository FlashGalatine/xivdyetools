# Review: packages-security (auth, logger, worker-kit)

Audit 2026-10-03, commit 0ab33466. Read-only review. Probe: `scripts/packages-security/redaction-probe.mjs` (runs the built worker logger over secret and PII shapes; output summarised below).

## 1. Entry points and authz matrix

These are libraries, so entries are exported primitives and the consumers that call them. No routes of their own.

| Entry | Who calls it / reaches it | Guards before it | Caps |
|---|---|---|---|
| `verifyDiscordRequest` (auth/src/discord.ts:60) | discord-worker `POST /` (index.ts:717), moderation-worker `POST /` (index.ts:160); anyone on the internet can POST | Content-Length pre-check (:66); both signature headers required (:79); timestamp window 300 s past / 60 s future (:97); then Ed25519 `verifyKey` over the received bytes (:134) | 100,000 B default, counted WHILE reading (:113-125); reader cancelled on the first chunk past the cap; negative cap rejects (:110) |
| `verifyBotSignatureV2` (auth/src/hmac.ts:318) | presets-api `authMiddleware` (middleware/auth.ts:311), after the `BOT_API_SECRET` bearer match | constant-time bearer compare, `BOT_SIGNING_SECRET` required outside dev/test, 60 s age + 60 s skew, HMAC over a length-prefixed canonical string, then nonce single-use check (`isFreshBotNonce`, auth.ts:197) | n/a (body hashed, not capped here; the body cap is presets-api's bodyGuards) |
| `verifyJWT` / `verifyJWTSignatureOnly` (auth/src/jwt.ts:229, :286) | presets-api, oauth, api-worker | alg pinned to HS256 (:127), HMAC verify before payload parse (:140-151), claim typing (:196), exp/nbf, optional type/iss/aud | none in package (header size is the platform's) |
| `createHmacKey` / `hmacSign*` / `hmacVerify*` (hmac.ts) | all HMAC users | 32-byte floor (:104) | n/a |
| `timingSafeEqual` (timing.ts:27) | oauth, workers | n/a | n/a |
| `isTokenRevoked` / `revokeToken` (revocation.ts) | oauth, presets-api | KV store optional; fail-open read (:57-59) | n/a |
| `requestIdMiddleware` (worker-kit middleware/request-id.ts:55) | every Worker | UUID-v4 shape validation of client `X-Request-ID`, default on (:56) | n/a |
| `loggerMiddleware` (middleware/logger.ts:108) | every Worker | UA logging default off (:112); path logged = pathname only unless `sanitizePath` is given | n/a |
| `rateLimitMiddleware` (middleware/rate-limit.ts:128) | every Worker | key from caller; `onError` default fail-open (accepted trade-off) | n/a |
| `getClientIp` (rate-limiter/ip.ts:40) | rate-limit key extractors | `CF-Connecting-IP` only; `X-Forwarded-For` ignored unless opted in (:42) | n/a |
| Backends: Memory / KV / Upstash / Cloudflare native | api-worker, discord-worker, moderation-worker, oauth, presets-api (Upstash has no in-repo consumer) | n/a | KV TTL = window + 60 s; Memory capped at 10,000 keys with LRU prune |
| `bodyGuards` (worker-kit body-guards/body-guards.ts:62) | oauth, presets-api | Hono `bodyLimit` (size, streaming when no Content-Length); JSON depth 10 + `__proto__`/`constructor`/`prototype` key rejection on POST/PATCH/PUT with `application/json` | caller-set `maxSize` |
| `detectImageFormat` / `sniffImageType` (image-sniff/detect.ts) | image-worker `validateImageFormat`, presets-api upload (handlers/presets.ts:1177) | n/a | needs >= 12 bytes |

Authz matrix for the request-verification entries:

| Caller | Discord Ed25519 | Bot bearer + V2 sig + nonce | JWT |
|---|---|---|---|
| Anonymous internet | rejected 401 | rejected (unauthenticated context) | rejected |
| Any Discord user | accepted only via a Discord-signed interaction | n/a | n/a |
| Holder of `BOT_API_SECRET` only | n/a | rejected without a `BOT_SIGNING_SECRET` signature | n/a |

## 2. Positive controls

- HMAC key floor: `createHmacKey` throws under 32 bytes (auth/src/hmac.ts:103-106); every sign/verify path goes through `getOrCreateHmacKey` -> `createHmacKey`. Test: hmac.test.ts:41.
- Constant-time: `crypto.subtle.verify` for HMAC (hmac.ts:158, :183; jwt.ts:140); `timingSafeEqual` pads to equal length and falls back to XOR (timing.ts:35-54).
- V2 canonical string is length-prefixed per field with a `v2` tag and binds method, path, SHA-256 of the body, timestamp, nonce, Discord id and name (hmac.ts:245-258). Injective, so no delimiter collision.
- Nonce replay check exists at the one verifier: presets-api auth.ts:197-228 (format `^[A-Za-z0-9._-]+$`, <= 64 chars, 120 s `botnonce:` KV entry, runs only after the signature verified, nonce kept out of logs).
- v1 bot signature removed outright (hmac.ts:200-215).
- JWT: alg pinned (jwt.ts:127), signature verified before the payload is parsed, `exp`/`sub` required and typed (:196-203), `nbf`, optional type/iss/aud (:255-272), `verifyJWTSignatureOnly` fails closed on a missing `iat` when an age cap is passed (:313-319).
- Discord body cap enforced while reading (2026-09-15 FINDING-001 confirmed): auth/src/discord.ts:108-134 reads the stream, counts bytes, cancels the reader, never retains the crossing chunk. Guarded by `packages/auth/src/discord-stream.test.ts` ("cancels on the first chunk beyond the byte cap", with and without a lying Content-Length; asserts `reads: 2, cancelled: true`; plus a split multibyte case). Freshness: discord-freshness.test.ts.
- Logger redaction (probe output confirmed): Discord bot token, JWT (also inside free text), `Bearer`, `Authorization: Basic ...` (becomes `authorization=[REDACTED]`), 64+ hex whole values, array items (probe `arr`: JWT and hex items redacted), key-name list plus `token|secret|password|apikey` suffix (`UPSTASH_REDIS_REST_TOKEN` redacted), cyclic and aliased contexts (base-logger.ts:190-256, :338-370). Error messages are sanitised and stacks dropped when `sanitizeErrors` is on, which is the Worker preset default (base-logger.ts:127-139, presets/worker.ts).
- Request id: client `X-Request-ID` must be a UUID, else replaced (request-id.ts:62-64); every in-repo consumer uses the default (`git grep "requestIdMiddleware("` shows no `validateFormat: false`).
- User-Agent logging off by default (logger.ts:112); og-worker sets it false explicitly; no in-repo consumer opts in.
- Rate-limit error logs carry `keyScope`, never the key (key-scope.ts, kv.ts:164, cloudflare.ts:204, rate-limit.ts:152). The KV fallback key holds the IP for window + 60 s = 120 s, which matches apps/web-app/PRIVACY.md:139-144 and discord-worker PRIVACY_POLICY.md:37.
- `getClientIp` ignores `X-Forwarded-For` by default (ip.ts:42). `CloudflareRateLimiter` rejects a tier without a callable `limit()` at construction (cloudflare.ts:100-105) and keys per (limit, period) tier (cloudflare.ts:174-180).
- image-sniff: needs >= 12 bytes before deciding; RIFF must carry `WEBP` at offset 8 (detect.ts:70-96). Called before decode at every consumer: presets-api upload sniffs (handlers/presets.ts:1177) then image-worker re-validates; image-worker `/extract` runs `validateAndFetchImage` (format) then `assertImageDimensionsFromHeader` (own header parser, fail-closed on unreadable) before `PhotonImage.new_from_byteslice` (photon.ts:187-194); `/thumbnail` has no `detectImageFormat` call but the header-dimension gate (image-worker dimensions.ts:121-133, photon.ts:279) rejects anything that is not a real PNG/JPEG/GIF/WebP/BMP header before decode. The stored object is always the re-encoded WebP (preview-image-service.ts:140-165), never the upload.
- bodyGuards: size via Hono `bodyLimit` (streaming when there is no Content-Length), depth 10 and prototype-key rejection (structure.ts:35-56).

## 3. Rejected items

- V2 signature does not bind the query string: already filed and deliberately kept INFO (2026-08-29/FINDING-015 "Deliberately not done", PKG-03). Code unchanged (`path` is `pathname`, presets-api auth.ts:314). Not re-filed.
- Nonce check is get-then-put (not atomic), cross-colo best-effort, skipped on KV error or absent binding (auth.ts:206-227): documented in the function comment, same class as the accepted KV race and fail-open trade-offs.
- Discord replay inside the 300 s timestamp window (discord.ts:97-103): 2026-08-21 FINDING-021 decision; Discord interactions carry no nonce.
- `isTokenRevoked` fail-open on KV error (revocation.ts:57-59): documented intent in the JSDoc; same availability trade as the accepted fail-open entries.
- `rateLimitMiddleware` default `onError: 'fail-open'` and backends' `failOpen !== false`: accepted trade-off. The "failOpen:false alone is not enough" trap is documented (security-trade-offs.md:148); api-worker telemetry sets both (api-worker rate-limit.ts:165-175).
- Upstash backend: no in-repo consumer (grep), so no live exposure.
- A bare base64 Upstash-style token as a free-text substring is not caught by the sanitiser (probe: `upstash AXlT...=` survives in a message). Shape redaction of arbitrary base64 would false-positive heavily, and Upstash has no consumer. Dropped.
- image-sniff signatures are short prefixes (PNG 4 B, GIF 3 B, BMP 2 B, detect.ts:21-27), so a text file starting `BM` (12+ bytes) reads as bmp and a PNG-prefixed polyglot passes. Not exploitable: every consumer then decodes through Photon after a real header parse and re-encodes (section 2), so nothing polyglot is stored or served. Under 12 bytes returns undefined (detect.ts:63).
- `hmacVerify`/`hmacVerifyHex` return `crypto.subtle.verify(...)` without `await` inside `try` (hmac.ts:157, :182), so a rejected promise would escape the `catch`. `subtle.verify` only rejects on key/usage misuse, not on bad signature bytes, and a malformed hex string throws synchronously inside the try. Not reachable with attacker input. Handoff.
- Canonical field length uses UTF-16 `length` (hmac.ts:257): still injective; signer and verifier share the function.
- `decodeJWT` unverified-decode export (jwt.ts:105): documented warning; no production use found in this review's scope.
- `verifyJWTSignatureOnly` with no age cap for `/auth/revoke` (oauth token.ts:118): only writes a revocation entry for a token the caller already holds.
- Request id echoed in the `X-Request-ID` response header: UUID-validated, no injection.
- Memory limiter keyed by IP lives in isolate memory only (memory.ts:57): transient, never persisted.

## 4. Files covered

packages/auth/src: hmac.ts, jwt.ts, discord.ts, timing.ts, revocation.ts, encoding/base64.ts, encoding/hex.ts, discord-stream.test.ts, index.ts (head).
packages/logger/src: core/base-logger.ts, constants.ts, presets/worker.ts, presets/browser.ts, presets/library.ts, adapters/json-adapter.ts, adapters/console-adapter.ts (write paths); test names in core/hardening.test.ts.
packages/worker-kit/src: middleware/request-id.ts, middleware/logger.ts, middleware/rate-limit.ts, rate-limiter/ip.ts, key-scope.ts, headers.ts, backends/{cloudflare,kv,upstash,memory}.ts, presets/configs.ts, image-sniff/{detect,index}.ts, body-guards/{body-guards,structure}.ts, index.ts.
Consumers opened to verify controls: apps/presets-api/src/middleware/auth.ts (nonce, V2 call), handlers/presets.ts:1160-1200, services/preview-image-service.ts:100-170; apps/image-worker/src/{index,validators,dimensions,photon}.ts (relevant ranges); apps/discord-worker/src/index.ts:700-740, services/preset-api.ts:85-135; apps/moderation-worker/src/utils/verify.ts, index.ts:55-175, utils/url-sanitizer.ts (head); apps/oauth/src/handlers/token.ts:100-175, services/jwt-service.ts:195-240; apps/api-worker/src/middleware/rate-limit.ts (selectors).
Docs: apps/web-app/PRIVACY.md:130-152, discord-worker PRIVACY_POLICY.md rate-limit rows, docs/architecture/security-trade-offs.md headings, 2026-08-29 FINDING-015.

## 5. Candidate table

| cid | sev | exposure | path:line | claim |
|---|---|---|---|---|
| c1 | LOW | LOCAL | packages/logger/src/core/base-logger.ts:218-231 | The redactor is secret-only: personal fields under common key names (`username`, `global_name`, `avatar`, `ip`, `userAgent`, `email`, `guildId`, `channelId`) pass through verbatim, including inside a `{ user: {...} }` object (probe: `username:"Alice"`, `ip:"1.2.3.4"`, `user:{username:"Bob",avatar:"x"}` all emitted). Nothing in the package backstops the privacy promise if a caller logs a user object. Hardening only; this review found no in-package leak. |

## 6. Handoffs

- hmac.ts:157 and :182: `return crypto.subtle.verify(...)` inside `try` without `await`; add `await` so the `catch` returns false as the contract says (plain bug, no attacker path).
- packages/worker-kit/src/rate-limiter/backends/cloudflare.ts:151-157: with no tier matching the config window it falls back to limit-only selection (documented); a construction-time warning would help. Not security.
- packages/auth/src/hmac.ts:231 docblock says "no origin, no query" for `path`; keep the PKG-03 decision visible in consumer docs (documentation skill).
