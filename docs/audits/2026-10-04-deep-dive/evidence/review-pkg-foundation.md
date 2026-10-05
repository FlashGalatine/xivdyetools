# Review: pkg-foundation (auth, logger, types) — 2026-10-04

Origin for everything below is MAIN. Only `packages/logger/src/presets/browser.ts` is in the changed-since-79a69d1f list.

## Map
| Module | Role |
|---|---|
| auth/jwt.ts | verifyJWT (HS256-only, typed claims, exp/nbf/iss/aud/type), verifyJWTSignatureOnly (iat age cap), decodeJWT |
| auth/hmac.ts | key LRU (10), hmacSign/Verify (b64url + hex), bot signature v2 (length-prefixed canonical string, 60 s window) |
| auth/discord.ts | Ed25519 verify, freshness window, streamed body cap |
| auth/timing.ts, revocation.ts, encoding/* | timingSafeEqual, KV jti blacklist, base64url/hex |
| logger/core/base-logger.ts | redaction (ancestor+memo guard), SANITIZE_RULES, safeStringify, DelegatingLogger |
| logger adapters / presets / constants | Console/Json/Noop adapters, browser/worker/library factories, redact field lists |
| types/* | type-only except createHexColor/DyeId/Hue/Saturation, AppError, ErrorCode, RACE maps, isValidSnowflake |

## Candidates

### pkg-foundation-01 — BUG, MEDIUM — packages/logger/src/core/base-logger.ts:296-305
Claim: the nested-redaction pass hands every non-plain `object` value (Date, Error, Map, Set, typed array) to `redactSensitiveFields`, whose `{ ...context }` spread destroys it.
Failing input -> outcome: `logger.info('x', { at: new Date(0), err: new Error('boom'), m: new Map([[1,2]]), bytes: new Uint8Array([1,2]) })`. I ran it against the built JsonAdapter and got `"context":{"at":{},"err":{},"m":{},"bytes":{"0":1,"1":2}}`. A Date, an Error in context (`{ cause: err }`) and a Map all log as `{}`.
Tests miss it: no test passes a Date, Error or Map as a context value. Covered: no. Origin: MAIN.
```ts
if (Array.isArray(value)) { redacted[key] = this.redactArrayItems(value, g); }
else { redacted[key] = this.redactSensitiveFields(value as LogContext, g); }
```
Fix: recurse only into plain objects (proto === Object.prototype or null). Convert Date to ISO, Error to `{name, message: sanitized}`, and other exotic objects to a placeholder.

### pkg-foundation-02 — BUG, MEDIUM — packages/logger/src/core/base-logger.ts:283-289 (with 125-129, 202-207)
Claim: context string values get only the whole-value shape scan (`looksLikeSecretValue`), never the free-text `sanitizeErrorMessage` rules that the `message` and error message get. A key-named secret inside a context string therefore survives.
Failing input -> outcome: `logger.warn('upstream failed', { detail: 'upstream said password=hunter2' })` emits `"detail":"upstream said password=hunter2"` (verified on the built adapter). An echoed response body or error text in `responseText`, `body`, `detail` or `raw` leaks.
Tests miss it: hardening tests cover message and error free text only (`hardening.test.ts:54`, `:99`). Covered: no. Origin: MAIN.
Fix: apply `sanitizeErrorMessage` to string values (and string array items) when `config.sanitizeErrors`; keep the shape scan.

### pkg-foundation-03 — OPT, LOW — packages/logger/src/core/base-logger.ts:273-275
`redactSensitiveFields` rebuilds `normalize`, `redactSet` (~25 `toLowerCase().replace` plus a Set) and the suffix regex at every nested object node, on every log call. Hoist: compute the normalized set once per logger or memoize per `redactFields` array.

### pkg-foundation-04 — BUG, LOW (latent) — packages/auth/src/hmac.ts:226-243
The v2 signature binds `req.path` but not the query string (documented "no query"). presets-api passes `new URL(c.req.url).pathname` (`apps/presets-api/src/middleware/auth.ts:315`), so a signature is valid for any `?query` on the same path. Defended: the nonce is single-use (`isFreshBotNonce`, `auth.ts:207`) and calls go over a service binding. Defense in depth: bind `search` too. Covered: no.

### pkg-foundation-05 — REFACTOR, LOW — packages/auth/src/jwt.ts:24-30 vs packages/types/src/auth/jwt.ts
Two diverging `JWTPayload` interfaces. auth's doc says "Re-exported from @xivdyetools/types" but it is a separate declaration (iss/username/auth_provider optional or absent in auth, required in types). Stale comment, no runtime defect.

### pkg-foundation-06 — REFACTOR, LOW — packages/logger/src/core/base-logger.ts:598-609
An orphaned JSDoc (the S10-R18 `MAX_STRINGIFY_NODES` text) sits above the `AUTH_SCHEMES` comment; the real constant is declared at :730.

## POSITIVE
- JWT: alg pinned to HS256, claim typing, fail-closed iat check with `maxAgeMs` (BUG-058), all inside try/catch returning null.
- HMAC: secrets under 32 bytes rejected; LRU refresh/eviction correct; cache keys cannot collide.
- v2 canonical string is length-prefixed with a body hash; 60 s window bidirectional.
- Discord verify checks freshness before reading the body and counts bytes while streaming.
- timingSafeEqual pads and checks lengths; hex decode validates input.
- Redaction: ancestor and memo guards, cycle sentinel (BUG-004), case-insensitive key match plus suffix heuristic, fail-closed safeStringify bound.
- types is nearly all type-only; `createDyeId` correctly rejects itemIDs per schema v2.

## REJECTED
- `hmacVerify`/`hmacVerifyHex` `return crypto.subtle.verify(...)` inside `try` without `await` (`hmac.ts:178,205`): cannot make it reject (wrong-length signature resolves false; 'verify' usage always granted).
- `isTokenRevoked` fail-open on KV error: deliberate, documented design.
- `createHue`/`createSaturation(NaN)` and `AppError.toJSON` including `stack`: no in-repo caller; belongs to the dead-code audit.
- `parseInt(req.timestamp)` leniency: canonical string uses the raw timestamp, so a mismatch fails the HMAC.
- `"…key"` suffix rule over-redacting in message text: fails closed, cosmetic.
- DelegatingLogger keeping a reference to the caller's child context: cosmetic.
- Key `tokens` redaction: handled by the value-shape scan (FINDING-025).
- browser.ts (changed file): tracker path redacts context, message and stack; `sanitizeErrors: !isDevMode` is intended. No regression.

## COVERED (49 non-test files read in full)
auth: package.json, src/{index,jwt,hmac,discord,timing,revocation}.ts, encoding/{index,base64,hex}.ts.
logger: package.json, src/{index,constants,types}.ts, adapters/{index,console-adapter,json-adapter,noop-adapter}.ts, core/{index,base-logger}.ts, presets/{index,browser,worker,library}.ts.
types: package.json, src/index.ts, color/{branded,rgb}.ts, auth/{discord-snowflake,jwt,xivauth}.ts, character/index.ts, dye/{dye,facewear}.ts, error/{app-error,codes}.ts. The remaining types files (api/*, preset/*, localization/*, other auth/*, color/{colorblind,match-quality}, dye/{dye-filters,index}) were skimmed as pure interfaces. Tests were checked by grep only; auth tests were not read.
