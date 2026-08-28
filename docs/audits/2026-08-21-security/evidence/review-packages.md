# Manual Security Code Review — Shared Libraries (`packages/*`)

**Date:** 2026-08-21
**Scope:** `@xivdyetools/auth`, `@xivdyetools/worker-kit`, `@xivdyetools/logger`, `@xivdyetools/core` (security-relevant areas), `@xivdyetools/svg` (targeted), `@xivdyetools/types` and `@xivdyetools/test-utils` (production-leak / insecure-default check only).
**Method:** Read-only manual review of `src/` (non-test files), cross-checked against the built `dist/` with a throw-away Node script (`scratchpad/verify.mjs`, `scratchpad/resvg-check.mjs` — not committed). Consumer call sites in `apps/*` were peeked at only where needed to calibrate severity; app code itself is out of scope for this document.
**Bottom line:** No CRITICAL or HIGH findings. The cryptographic primitives are correctly pinned and timing-safe, and most historical hardening (FINDING-/BUG- series) holds. The findings below are LOW/INFO hardening items: a replayable identity-only bot HMAC, lax JWT claim typing, a logger that can throw (and a few redaction gaps), a prototype-chain lookup in the `.chara` parser, and an SVG escaper that lets XML-illegal characters through (confirmed to break resvg rendering with a preset name that presets-api accepts).

Severity scale: CRITICAL / HIGH / MEDIUM / LOW / INFO. Confidence: **CONFIRMED** (verified by executing the built package or by unambiguous code reading) vs **PLAUSIBLE** (depends on consumer configuration or an unverified precondition).

---

## Findings index

| ID | Sev | Package | File:line | Title | Conf. |
|----|-----|---------|-----------|-------|-------|
| PKG-1 | LOW | auth | `packages/auth/src/hmac.ts:237-277` | Bot HMAC is an identity assertion: not bound to method/path/body, no nonce, ~6-min replay window, ambiguous `:` delimiter | CONFIRMED (property) / PLAUSIBLE (exploit) |
| PKG-2 | LOW | auth | `packages/auth/src/jwt.ts:173-202, 225-259` | `verifyJWT` does not type-check claims (`exp`/`sub` accept objects/strings/numbers) and ignores `nbf`/`iat`; no `iss`/`aud` option | CONFIRMED |
| PKG-3 | LOW | logger | `packages/logger/src/core/base-logger.ts:196-241`, `adapters/json-adapter.ts:43`, `adapters/console-adapter.ts:62,104` | Cycle guard leaves back-references in the redacted copy → `JSON.stringify` in `write()` throws (also on BigInt): a log call becomes a request-crash vector | CONFIRMED |
| PKG-4 | LOW | logger | `packages/logger/src/core/base-logger.ts:66-70, 121-125, 209-218` | Redaction gaps: the `message` argument is never sanitised, non-`Error` thrown values bypass `sanitizeErrorMessage`, key heuristic misses `privateKey`/`signingKey`/`setCookie`/`webhookUrl`/`authHeader`/`jwt`/`sessionId`, and context *values* are never shape-scanned | CONFIRMED |
| PKG-5 | LOW | logger | `packages/logger/src/presets/browser.ts:113-117` | `errorTracker` path re-attaches the raw `error.stack`, whose first line is the unsanitised original message — defeats the BUG-026 sanitisation for third-party trackers | CONFIRMED (latent: no consumer passes `errorTracker` today) |
| PKG-6 | LOW | core | `packages/core/src/services/chara/chara-parser.ts:249-271 (262)` | `mapNamed()` does `table[value]` on a prototype-bearing object literal: `"Tribe":"constructor"`, `"__proto__"`, `"toString"`, `"hasOwnProperty"` pass the "fail loudly" validation and yield a Function / `Object.prototype` as tribe/race/gender | CONFIRMED |
| PKG-7 | LOW | svg (+presets-api) | `packages/svg/src/base.ts:12-19` | `escapeXml` does not strip XML-illegal characters (U+0000-U+0008, U+000B, U+000C, U+000E-U+001F, U+FFFE/FFFF); presets-api validates names by length only, so a preset named `Hel\u0001lo` makes every card that renders it fail in resvg | CONFIRMED (end-to-end with resvg-wasm 2.6.2) |
| PKG-8 | LOW | svg | `contrast-card.ts:171-172`, `gradient.ts:122,125`, `dye-info-card.ts:119`, `swatch-card.ts:111` | Inconsistent attribute escaping — hex values interpolated into `fill="…"` without `escapeXml` (frame.ts/base.ts/preset-swatch escape them); relies on upstream hex validation | PLAUSIBLE |
| PKG-9 | LOW | worker-kit | `packages/worker-kit/src/rate-limiter/backends/kv.ts:161-181, 225-250, 283-286`; `middleware/rate-limit.ts:119,153-156` | Fail-open is the default at both layers; any thrown KV error (incl. keys > 512 B) allows the request; KV cached/eventually-consistent reads make the counter porous (documented best-effort) | PLAUSIBLE (depends on consumer key extractor) |
| PKG-10 | INFO | worker-kit | `packages/worker-kit/src/rate-limiter/backends/memory.ts:42, 122-130, 195-216` | `MemoryRateLimiter` is per-isolate and a key-cardinality flood (> `maxEntries`, default 10 000) evicts other clients' counters | CONFIRMED (mechanism) |
| PKG-11 | INFO | worker-kit | `packages/worker-kit/src/rate-limiter/backends/upstash.ts:73-88` | `INCR` + `EXPIRE NX` in a non-atomic pipeline: a key that ever loses its TTL never expires (permanent 429 for that key); `ttl === -1` is masked | PLAUSIBLE |
| PKG-12 | INFO | auth | `packages/auth/src/discord.ts:63-100` | No `X-Signature-Timestamp` freshness check (captured interactions replay forever); body is fully buffered before the byte-size check | CONFIRMED (design) |
| PKG-13 | INFO | core | `packages/core/src/services/APIService.ts:170-192, 258-279, 683-734, 854-860` | Response-size cap applied after reading the whole body (UTF-16 length, not bytes); upstream price fields not type-checked (NaN propagation); `MemoryCacheBackend` has no eviction and `dataCenterID` no length cap; single-item `itemID` unvalidated | CONFIRMED |
| PKG-14 | INFO | core | `packages/core/src/services/chara/chara-parser.ts:395-400, 411-415` | Model lanes not capped to 16 bits (`1e308` accepted); `Nickname`/`TypeName` unbounded strings | CONFIRMED |
| PKG-15 | INFO | types | `packages/types/src/error/app-error.ts:60-68` | `AppError.toJSON()` serialises `stack` — any handler that `c.json(err)`/`JSON.stringify(err)`s an AppError leaks stack traces | PLAUSIBLE |
| PKG-16 | INFO | test-utils | `packages/test-utils/src/auth/signature.ts:31, 94-103` | Exports a non-constant-time `verifyBotSignature` under the *same name* as the production one, plus a default `TEST_SIGNING_SECRET`; dev-only today (verified) | CONFIRMED (no prod reach) |
| PKG-17 | INFO | auth | `packages/auth/src/hmac.ts:41-74, 254-262`, `jwt.ts:225-259`, `revocation.ts:30-42` | Nits: HMAC `CryptoKey` cache keyed by the secret string; `verifyBotSignature` timestamp parsed with lossy `parseInt`; `verifyJWTSignatureOnly` has no default age cap; revocation store is fail-open (documented) | CONFIRMED |
| PKG-18 | INFO | core | `packages/core/src/services/localization/TranslationProvider.ts:59-67 et al.` | Same prototype-chain lookup shape as PKG-6 (`labels[key]`, `harmonyTypes[key]`, …) — `key = "constructor"` returns a Function; keys are internal today | CONFIRMED (shape) |

---

## Detailed findings

### PKG-1 — Bot HMAC is an identity assertion, replayable, not bound to the request (LOW)

- **Severity:** LOW — forging still requires `BOT_SIGNING_SECRET`, and in presets-api the check sits *behind* a timing-safe `BOT_API_SECRET` bearer comparison (`apps/presets-api/src/middleware/auth.ts:154-200`); exploitation needs that bearer plus one captured signed tuple. The HMAC's stated purpose (discord-worker `preset-api.ts:34-37`: "binds the user headers to the request, preventing header spoofing even if BOT_API_SECRET is leaked") is only partly met: it binds *identity*, not the request.
- **CWE:** CWE-294 (Authentication Bypass by Capture-replay), CWE-345 (Insufficient Verification of Data Authenticity).
- **Where:** `packages/auth/src/hmac.ts:237-277`

```ts
// hmac.ts:245,264-276
const { maxAgeMs = 5 * 60 * 1000, clockSkewMs = 60 * 1000 } = options;
…
const message = `${timestamp}:${userDiscordId ?? ''}:${userName ?? ''}`;
return hmacVerifyHex(message, signature, secret);
```

- **What is (not) signed:** only `timestamp:userId:userName`. HTTP method, path, query and body are outside the MAC; there is no nonce/jti; the acceptance window is `maxAgeMs` (5 min) + `clockSkewMs` (1 min).
- **Delimiter ambiguity (CONFIRMED):** `:` is the separator but neither operand is validated to exclude it. A signature over `ts:123:a:b` verifies for both `(id="123", name="a:b")` and `(id="123:a", name="b")` (verified with the dist build). Discord *usernames* no longer allow `:` but legacy names and `global_name` do, and the verifier cannot know which the caller sent.
- **Lossy timestamp (CONFIRMED, cosmetic):** `parseInt(timestamp, 10)` accepts `"1700000000junk"` for the freshness check while the raw header is what gets MAC'd — no forgery, but the freshness check and the signed value can disagree.
- **Exploit scenario:** An attacker holding `BOT_API_SECRET` (the scenario this HMAC exists for) who also observes one valid `(X-Request-Timestamp, X-User-Discord-ID, X-User-Discord-Name, X-Request-Signature)` tuple — e.g. from a leaked log line, a debugging proxy, or the discord-worker `PRESETS_API_URL` HTTPS fallback path — can, for ~6 minutes, issue *any* presets-api request (create/delete/vote) as that user, with any body, as many times as they like. Affected consumer: **presets-api** (verifier), **discord-worker**/**moderation-worker** (signers).
- **Fix:** Sign a canonical request string with unambiguous framing — e.g. `HMAC(secret, [ts, nonce, method, path, sha256(body), userId, userName].map(len-prefix).join(''))` or JSON-canonical; add a per-request nonce with a short KV/memory replay cache (the 5-min window bounds the cache); validate `userDiscordId` with `isValidSnowflake` (types package) before signing/verifying; keep `:`-free invariants or length-prefix each field. Keep the bearer gate in front.
- **Confidence:** CONFIRMED for the properties (no body binding, replay window, delimiter collision — executed); PLAUSIBLE for real-world exploitation (requires the second secret + capture).

### PKG-2 — `verifyJWT` claim typing is lax; `nbf`/`iat` ignored; no `iss`/`aud` binding (LOW)

- **Severity:** LOW — every case below still requires a valid HS256 signature, i.e. the issuer's secret; this is an issuer-bug / multi-issuer-safety class, not an external bypass.
- **CWE:** CWE-20 (Improper Input Validation), CWE-287.
- **Where:** `packages/auth/src/jwt.ts:183-191`

```ts
const now = Math.floor(Date.now() / 1000);
if (!payload.exp || payload.exp < now) { return null; }   // exp:{} → NaN<now → false → accepted
if (!payload.sub) { return null; }                         // sub:{} / sub:123 accepted
```

- **Verified against dist (CONFIRMED):** signed tokens with `exp: {}`, `exp: "9999999999"`, `exp: [future]`, `sub: {}`, `sub: 123`, and `nbf: <future>` are all ACCEPTED. `alg: "none"`, a `null` header, and a < 32-byte secret are correctly REJECTED (fail-closed).
- **Scenario:** A mis-minted token (issuer bug, or a future second issuer sharing `JWT_SECRET`) with a non-numeric `exp` never expires; a non-string `sub` flows into D1 queries / `checkModerator()` in presets-api as an object. Because `iss`/`aud` are not checkable, any future reuse of the secret between environments (beta already talks to production presets-api) would make tokens from one issuer valid at another.
- **Fix:** `typeof payload.exp === 'number' && Number.isFinite(...)`, `typeof payload.sub === 'string'` (and optionally `isValidSnowflake`), enforce `nbf` (with the same skew), reject `iat` far in the future, and add `issuer`/`audience` to `VerifyJWTOptions` so presets-api / oauth can pin them.
- **Confidence:** CONFIRMED.

### PKG-3 — Logger `write()` can throw on cyclic / BigInt context (LOW)

- **Severity:** LOW — availability only, but a logger must never be the thing that 500s a request; every Worker routes `logger.info/warn/error` through this path.
- **CWE:** CWE-248 (Uncaught Exception), CWE-754.
- **Where:** `packages/logger/src/core/base-logger.ts:225-227` (guard), `adapters/json-adapter.ts:43` and `adapters/console-adapter.ts:62,104` (unguarded `JSON.stringify`).

```ts
// base-logger.ts:225-227 — the back-reference is left pointing at the ORIGINAL (cyclic) object
if (visited.has(value)) { continue; }
…
// json-adapter.ts:43
console.log(JSON.stringify(entry));
```

- **Verified (CONFIRMED):** `logger.info('x', { obj: a })` where `a.self = a` → `TypeError: Converting circular structure to JSON`; `logger.info('x', { n: 10n })` → `TypeError: Do not know how to serialize a BigInt`. The exception propagates out of the `logger.*` call into the request handler.
- **Scenario:** Any handler that logs an app object with a back-reference (Hono context, a Request, an ORM row with parent links) or a BigInt (e.g. `weaponModelKey()` from core returns a BigInt) crashes with a 500 instead of logging. Not directly attacker-triggerable unless user data is merged into such objects, but it is a latent reliability hole in every worker.
- **Fix:** Replace the back-reference with a marker (`'[Circular]'`) instead of `continue`-ing; wrap `JSON.stringify` in `write()` with a replacer that handles BigInt (`String(v)`) and a try/catch that degrades to a minimal entry.
- **Confidence:** CONFIRMED.

### PKG-4 — Redaction coverage gaps (LOW)

- **Severity:** LOW — redaction is a defence-in-depth control; the gaps are real and easy to hit accidentally.
- **CWE:** CWE-532 (Insertion of Sensitive Information into Log File).
- **Where:** `packages/logger/src/core/base-logger.ts:66-70` (message untouched), `:121-125` (non-Error → `String(error)`, unsanitised), `:209-218` (key heuristic), no value scan anywhere.
- **Verified (CONFIRMED, from the dist):**
  - `logger.error('Failed with token=abc123', …)` → message logged verbatim (`token=abc123`).
  - `logger.error('x', 'string error token=ghi789')` → `error.message: "string error token=ghi789"` (only `Error` instances go through `sanitizeErrorMessage`).
  - context `{ privateKey, setCookie, webhookUrl: 'https://discord.com/api/webhooks/1/TOKEN', authHeader: 'Bearer eyJ…' }` → all four logged verbatim; only `sessionToken` was redacted.
- **Scenario:** A worker logs `{ authHeader: c.req.header('authorization') }` or a Discord webhook URL "for debugging" — the secret lands in Cloudflare logs. Template-string messages (`\`Refresh failed for ${token}\``) are the most common accidental pattern.
- **Fix:** Run `sanitizeErrorMessage` over `message` too; sanitise `String(error)` for non-Error throws; extend the key list/suffix heuristic (`key$`, `cookie`, `setcookie`, `cookies`, `webhook`, `jwt`, `session`, `auth`); add a cheap value-shape pass (Bearer tokens, `eyJ…` JWTs, `discord.com/api/webhooks/\d+/\S+`, Discord bot tokens) for string values.
- **Confidence:** CONFIRMED.

### PKG-5 — Browser preset `errorTracker` path leaks the unsanitised message via `stack` (LOW)

- **Severity:** LOW — only matters when `createBrowserLogger({ errorTracker })` is used; no in-repo consumer passes one today (grep), so this is latent.
- **CWE:** CWE-532.
- **Where:** `packages/logger/src/presets/browser.ts:113-117`

```ts
const safeError = new Error(logger.sanitizeMessage(error.message));
safeError.name = error.name;
safeError.stack = error.stack; // V8 stack = "Name: <ORIGINAL message>\n    at …"
errorTracker.captureException(safeError, safeContext);
```

- **Scenario:** Sentry (or any tracker) displays/stores `stack`; its first line carries the original `token=…` text, so BUG-026's fix is bypassed for the tracker path.
- **Fix:** Rebuild the stack with the sanitised first line: `safeError.stack = error.stack?.replace(error.message, safeError.message)` (or strip the first line).
- **Confidence:** CONFIRMED by V8 stack-format reading; the path is not exercised by any current consumer.

### PKG-6 — `.chara` parser: prototype-chain lookup accepts `constructor`/`__proto__` as a tribe/race/gender (LOW)

- **Severity:** LOW — the parser runs only in the web-app (`apps/web-app/src/components/chara-import.ts`; api-worker does not call `parseCharaFile`); the consequence is a validation bypass and type confusion inside the user's own browser session, plus odd values posted to api-worker's resolver. No memory-safety or cross-user impact.
- **CWE:** CWE-1321 (Prototype-chain property access) / CWE-20.
- **Where:** `packages/core/src/services/chara/chara-parser.ts:249-271`

```ts
const TRIBE_MAP: Record<string, SubRace> = { Midlander: 'Midlander', … };   // plain literal → has Object.prototype
…
const mapped = table[value];          // :262
if (mapped === undefined) { throw … } // 'constructor' → Object (function) ≠ undefined → accepted
```

- **Verified (CONFIRMED, from dist):** `{"Tribe":"constructor"}` → accepted, `tribe` is `function Object()`; `"__proto__"` → `tribe` is `Object.prototype` (serialises as `{}`); `"toString"`/`"hasOwnProperty"` accepted for Race/Gender. A genuinely unknown value (`"NotATribe"`) is correctly rejected. Downstream `CharacterColorService.getHairColors(tribe, gender)` does `data?.[subrace]?.[gender]` and returns `[]` → slots resolve as `indexOutOfRange` instead of the intended loud "unrecognised value" error; `parsed.tribe` reaches the UI as a Function.
- **Fix:** `Object.hasOwn(table, value)` (or build the maps with `Object.create(null)` / a `Map`).
- **Confidence:** CONFIRMED.

### PKG-7 — `escapeXml` lets XML-illegal characters through → resvg parse failure from user-controlled text (LOW)

- **Severity:** LOW — render-time denial of a single card (griefing / self-inflicted), no injection. It is cross-component: presets-api accepts the bytes, the svg package emits them, resvg rejects them.
- **CWE:** CWE-20 / CWE-400 (uncontrolled resource… here: uncontrolled failure).
- **Where:** `packages/svg/src/base.ts:12-19` (escapes `& < > " '` only); presets-api `services/validation-service.ts:177-195` validates name/description by **length only** (2-50 / 10-200).
- **Verified (CONFIRMED):** `generatePresetSwatch({ name: 'Hel\u0001lo', … })` → resvg-wasm 2.6.2: `SVG data parsing failed … a non-XML character '\u{1}'`; same for U+0000, U+000C, U+FFFE. `<script>` in the name renders fine (escaped). The discord-worker `/preset` card (`apps/discord-worker/src/handlers/commands/preset.ts:916`) renders preset names from D1.
- **Scenario:** A user submits a preset named `"My Preset\u0001"` (passes presets-api length validation); every `/preset` card for it — including the one moderators open when reviewing/flagging it — fails to render. Any future og-worker preset card has the same problem.
- **Fix:** In `escapeXml` (or a sibling `sanitizeText`) strip `/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g` (and ideally unpaired surrogates); independently, presets-api should reject/strip control characters on input (defence in depth, also protects Discord embeds).
- **Confidence:** CONFIRMED.

### PKG-8 — Inconsistent attribute escaping for hex values (LOW)

- **Severity:** LOW — all output is rasterised to PNG (no app serves `image/svg+xml`: grep of `apps/*/src` is empty), so a breakout yields at most a malformed/altered image; exploitation also requires a consumer to pass an unvalidated hex string.
- **CWE:** CWE-116 (Improper Encoding or Escaping of Output).
- **Where:** `packages/svg/src/contrast-card.ts:171-172` (`fill="${worst.hexA}"`, `hexB`), `gradient.ts:122,125` (`c.idealHex`, `c.dyeHex`), `dye-info-card.ts:119` (`dye.hex`), `swatch-card.ts:111` (`hex`). By contrast `base.ts:85,111,168`, `frame.ts:164,262,383,401` and `preset-swatch.ts` (via `rect()`/`text()`) do escape.
- **Scenario:** A future bot/og caller that forwards a user hex option without `isValidHexColor()` would let `"/><rect …` terminate the attribute. Today the hexes come from the dye database or validated options, so this is a hardening item.
- **Fix:** Route every attribute value through `escapeXml` (cheap), or accept only `HexColor`-branded values at the generator boundary.
- **Confidence:** PLAUSIBLE.

### PKG-9 — Rate-limit fail-open defaults and KV failure modes (LOW)

- **Severity:** LOW — deliberate, documented availability-over-strictness posture; the bypass surface depends on how consumers build keys.
- **CWE:** CWE-636 (Not Failing Securely), CWE-770.
- **Where:** `middleware/rate-limit.ts:119` (`onError = 'fail-open'`), `:153-156`; `backends/kv.ts:163` (`config.failOpen !== false` → default open), `:225-250` (increment failures after retries are swallowed and the request was already allowed), `:283-286` (`buildKey` = `${prefix}${key}|${window}` with no length check).
- **Detail:** KV rejects keys > 512 bytes and empty values; such a throw is caught → `allowed: true, backendError: true`. So any key extractor that embeds a user-controlled, unbounded string (a path param, a username, a compound `${ip}:${c.req.path}` with a long path) lets a client opt out of limiting by sending an over-long component. `getClientIp()` keys are safe (≤ 45 chars). Separately, KV reads may be served from the edge cache for up to 60 s and the window is fixed (2× burst at the boundary) — the module docblock honestly says "best-effort", but consumers should know it is not an abuse-stopper.
- **Fix:** Cap/hash keys (`sha256` → hex, or truncate to 200 chars) in `buildKey`; consider `onError: 'fail-closed'` for write endpoints; use `UpstashRateLimiter` / a Durable Object where the limit is security-relevant (oauth, preset writes).
- **Confidence:** PLAUSIBLE (depends on consumer key extractors; none in-repo were found using `trustXForwardedFor` or `validateFormat:false`).

### PKG-10 — `MemoryRateLimiter` is per-isolate and evictable (INFO)

- `backends/memory.ts:42` caps at 10 000 keys; `:122-130 / 195-216` prune the 20% least-recently-active keys when exceeded. Verified with `maxEntries: 10`: a client blocked at its limit is allowed again after 15 other keys are touched (its counter was evicted). With the default 10k this needs > 10k distinct keys per isolate per window (a botnet for IP keys; many accounts for user-ID keys). Also: state is per isolate/colo, so the effective global limit is N× the configured one. Documented in the file header; INFO.

### PKG-11 — Upstash `EXPIRE NX` orphan key (INFO)

- `backends/upstash.ts:73-77` pipelines `INCR`, `EXPIRE … NX`, `TTL`. A pipeline is not a transaction: if a key ever exists without a TTL (a failed EXPIRE, manual ops, a pre-`NX` version), `NX` never sets one, the counter grows forever, and `:87` maps `ttl === -1` to `ttlSeconds`, hiding the condition. Self-heal by running `EXPIRE` (without NX) when `TTL` returns −1, or use `multi()`. PLAUSIBLE.

### PKG-12 — Discord verification: no timestamp freshness, body buffered before size check (INFO)

- `discord.ts:104` delegates to `discord-interactions@4.4.0 verifyKey` (verified: `crypto.subtle` ed25519, `return false` on any exception, message = `timestamp || body`). Neither the library nor the wrapper checks that `X-Signature-Timestamp` is recent, so a captured interaction can be replayed indefinitely (Discord's docs don't require a freshness check; many frameworks add a 5-minute one). `:88` reads the full body before `:94` measures it — the Content-Length pre-check (`:66-73`) is advisory (chunked bodies bypass it); Workers' own limits bound the damage. CWE-294 / CWE-400. INFO.

### PKG-13 — APIService robustness nits (INFO)

- `APIService.ts:704-720`: `content-length` pre-check, then `response.text()` (full buffer), then `text.length` (UTF-16 units) — a post-hoc cap, not a streaming one; upstream is a fixed host (`universalis.app` or the in-house proxy). `:258-279` trusts `price`/`worldId` types (`Math.round({})` → `NaN` prices). `:170-192` `MemoryCacheBackend` has no eviction and `:905-907` sanitises `dataCenterID` to `[A-Za-z0-9]` but not length → unbounded distinct cache keys per isolate if a consumer forwards user DC strings. `:854-860` single-item `itemID` is not validated (batch is). None are exploitable beyond memory/NaN noise. CWE-400 / CWE-20.

### PKG-14 — `.chara` model lanes and strings unbounded (INFO)

- `chara-parser.ts:411-415` `readModelLane` floors any positive finite number — `ModelBase: 1e300` and `ModelSet: 1e308` were accepted (verified) though lanes are 16-bit; `charaModelKey()` then produces absurd keys that the web-app posts to api-worker's resolver. `:395,400` `TypeName`/`Nickname` accept unbounded strings. Clamp lanes to `0..65535` and length-cap the strings. CWE-20.

### PKG-15 — `AppError.toJSON()` includes `stack` (INFO)

- `types/src/error/app-error.ts:60-68`. `JSON.stringify(err)` on an AppError emits `stack`. No in-scope app was found doing `c.json(error)` with an AppError, but the default makes an accidental stack leak a one-liner. Drop `stack` from `toJSON()` or gate it on an explicit flag. CWE-209. PLAUSIBLE.

### PKG-16 — test-utils name collision / defaults (INFO)

- `test-utils/src/auth/signature.ts:31` exports `TEST_SIGNING_SECRET`; `:94-103` exports `verifyBotSignature` (same name as the production function in `@xivdyetools/auth`) using `signature === expected`. The package is `private: true`, appears only in `devDependencies` of api-worker, discord-worker, moderation-worker, oauth, presets-api and svg, and the only non-test importer (`apps/discord-worker/src/test-utils.ts`) is itself test-only (nothing in `src/` imports it). So no production leak today — the risk is a future auto-import picking the wrong `verifyBotSignature`. Rename to `createExpectedBotSignature`/`verifyBotSignatureForTests`. CWE-208 if ever misused.

### PKG-17 — auth nits (INFO)

- `hmac.ts:41-74`: the `CryptoKey` cache is keyed by the secret string (`${secret}:${usage}`) — equivalent to keeping `env` in memory, bounded to 10, LRU; acceptable, but a hash of the secret would avoid holding the raw value in a long-lived Map key. `hmac.ts:254`: lossy `parseInt` (see PKG-1). `jwt.ts:225-259`: `verifyJWTSignatureOnly` has no default age cap (documented; oauth's refresh handler implements a 24 h grace + 30 d absolute session itself — verified at `apps/oauth/src/handlers/refresh.ts:72-110`). `revocation.ts:30-42`: fail-open on KV error (explicitly documented). `discord.ts:67`: `parseInt(contentLength)` accepts negative/garbage (then falls through to the real byte check — harmless).

### PKG-18 — TranslationProvider prototype-chain lookups (INFO)

- `TranslationProvider.ts:59-67, 235-243, 268-276, 304-311, 337-344, 370-377, 401-409, 434-442` use `localeData?.labels[key]` truthiness on JSON-imported objects (prototype-bearing). `key = "constructor"` returns a Function as a "translation". Callers today pass internal keys (bot-logic `localization.ts:105,123` pass category/acquisition from the dye DB); flagged so the same `Object.hasOwn` fix as PKG-6 can be applied uniformly.

---

## Positive controls verified

**auth**
- JWT: algorithm pinned to `HS256` (`jwt.ts:125`); `alg: none`, RS/HS confusion and `kid` games are moot (no key lookup by header); signature verified with `crypto.subtle.verify` (native, timing-safe); `exp` and `sub` presence required; `expectedType` discriminator available; a `null`/garbage header or malformed base64url throws → caught → `null`; verification with a < 32-byte secret fails closed (`createHmacKey` throws inside the try).
- HMAC: keys imported non-extractable, usage-scoped; 32-byte minimum enforced for sign *and* verify; hex and base64url verifiers use `crypto.subtle.verify`; `hexToBytes` rejects odd length / non-hex; base64url decoder pads correctly and throws on invalid input (`atob` → `DOMException`, caught by callers).
- `timingSafeEqual`: `crypto.subtle.timingSafeEqual` when present, XOR fallback otherwise; both compared on padded buffers with the length folded in (verified `abc/abc`, `abc/abd`, `abc/abcd`).
- Discord: `Content-Length` pre-check then real **byte**-length check (BUG-059); required headers enforced; `verifyKey` (discord-interactions 4.4.0) uses `crypto.subtle` Ed25519 and returns `false` on any exception (odd-length/non-hex signature or key).
- Revocation: `jti` comes only from verified tokens; TTL ≥ 60 s.

**worker-kit**
- `requestIdMiddleware` validates inbound `X-Request-ID` against a strict UUID regex by default (log-injection / correlation-spoof prevented); no consumer disables it.
- `loggerMiddleware` logs method + pathname only (query string only if the consumer supplies `sanitizePath`; moderation-worker does, with its sanitiser); UA opt-in; never logs headers/bodies.
- `getClientIp` prefers `CF-Connecting-IP`, ignores `X-Forwarded-For` unless opted in (no consumer opts in), lower-cases IPv6.
- KV keys use `|` between key and window (IPv6-safe); `getOAuthLimit` longest-prefix match; Upstash token only ever passed to the SDK (not logged); `RateLimiterLogger` contexts contain keys/errors, not secrets.
- `MemoryRateLimiter` is a true sliding log (no fixed-window 2× burst) with bounded per-key arrays and a key cap.

**logger**
- Default redact list always merged with consumer lists (FINDING-008); key matching is case/separator-insensitive with a token/secret/password/apikey suffix heuristic; recursion covers nested objects and arrays with a cycle guard; `error.stack` only emitted when `sanitizeErrors=false`; `error.cause`/AggregateError children are never emitted (no leak); `sanitizeErrorMessage` is linear-time — measured ≤ 2.5 ms on 200 kB adversarial inputs (no ReDoS); JSON output is structurally escaped (no log-line injection from values).

**core**
- No `new RegExp` built from input anywhere in `src/` (grep); `DyeSearch.searchByName` uses `includes`; `isValidHexColor` length-checks before an anchored regex; `hexToRgb`/`rgbToHex` validate and throw `AppError`.
- APIService: `dataCenterID` sanitised to `[A-Za-z0-9]` for both URL and cache key; cache keys type-prefixed (`dc`/`world`/`global`) and delimited; batch IDs validated as positive integers and chunked ≤ 100; upstream JSON duck-typed and `itemId` matched; sanitised error messages to callers; cache read/write failures tolerated; retries skip deterministic 4xx.
- `DyeDatabase.initialize` deep-clones into `Object.create(null)` and strips `__proto__`/`constructor`/`prototype`; every dye validated (hex regex, types, domains).
- `PaletteService` clamps `colorCount` (1-10), `maxIterations` (1-100), `maxSamples` (≥ 2) and samples down to `maxSamples`.
- `.chara` parser is JSON (no binary offsets to bound-check); `JSON.parse` failures and non-object roots are rejected; numeric fields type-checked; `Base64Image` is never read.
- Locale loading is static JSON imports with a structural check; no runtime I/O.

**svg**
- Every `<text>` in the package is produced by `base.ts text()` or `frame.ts cardText()`, both of which `escapeXml` the content (grep: `<text` appears only in those two files); `<script>`-shaped preset names render as literal text (verified in resvg).
- No `<image>`, `<a>`, `href`/`xlink:href`, `<foreignObject>`, `<script>`, `<style>`/`@import`, `<use>`/`<symbol>`, DOCTYPE/ENTITY anywhere; `url(#…)` references only internal clip-path ids generated from counters/constants; fonts referenced by family name only (no embedding, no external URLs); `transform` and `font-family` values are escaped or from fixed tables.
- No app serves raw SVG (`image/svg+xml` absent from `apps/*/src`); all cards are rasterised to PNG.

**types / test-utils**
- `types` contains no secrets, defaults or key material; runtime validators (`createHexColor`, `createDyeId`, `isValidSnowflake`) use anchored, bounded regexes.
- `test-utils` is `private: true`, `devDependencies`-only in all six consumers, and unreachable from any production `src/` module.

---

## Coverage

**Read fully (every line):**
- `packages/auth/src/`: `jwt.ts`, `hmac.ts`, `discord.ts`, `revocation.ts`, `timing.ts`, `index.ts`, `encoding/base64.ts`, `encoding/hex.ts`, `encoding/index.ts`; `package.json`.
- `packages/worker-kit/src/`: `index.ts`, `middleware/{index,types,request-id,logger,rate-limit}.ts`, `rate-limiter/{index,types,ip,headers}.ts`, `rate-limiter/backends/{memory,kv,upstash}.ts`, `rate-limiter/presets/{index,configs}.ts`; `package.json`.
- `packages/logger/src/`: `index.ts`, `constants.ts`, `types.ts`, `core/{index,base-logger}.ts`, `adapters/{index,console-adapter,json-adapter,noop-adapter}.ts`, `presets/{index,browser,worker,library}.ts`; `package.json`.
- `packages/core/src/`: `services/APIService.ts`, `services/dye/DyeSearch.ts`, `services/dye/DyeDatabase.ts`, `services/chara/{chara-models,chara-parser,chara-resolver}.ts`, `services/PaletteService.ts`, `services/CharacterColorService.ts`, `services/PresetService.ts`, `services/localization/{LocaleLoader,LocaleRegistry}.ts`, `utils/index.ts`, `constants/index.ts`.
- `packages/svg/src/`: `base.ts`, `index.ts`, `preset-swatch.ts`, `frame.ts` (lines 120-290 and 487-600 read; function list enumerated).
- `packages/types/src/`: `color/branded.ts`, `auth/discord-snowflake.ts`, `auth/jwt.ts`, `error/app-error.ts`.
- `packages/test-utils/src/`: `index.ts`, `auth/{jwt,signature,headers}.ts`, `constants/{index,pkce}.ts`; `package.json`.

**Skimmed / grep-audited only:**
- `core`: `services/localization/TranslationProvider.ts` and `services/LocalizationService.ts` (lookup/interpolation grep), `index.ts` (export list), `config/*.ts` (URL grep — all https), repo-wide grep for `new RegExp|JSON.parse|fetch(|DataView|atob|eval|innerHTML|localStorage|encodeURIComponent|Content-Length`.
- `svg`: `a11y-card.ts`, `budget-ledger.ts`, `comparison-card.ts`, `contrast-card.ts`, `dye-info-card.ts`, `gradient.ts`, `harmony-card.ts`, `mixer-card.ts`, `nearest-sheet.ts`, `palette-grid.ts`, `random-dyes-grid.ts`, `swatch-card.ts`, `icons/tool-icons.ts` — grep for `<text|<tspan|<title|<desc`, risky elements/attributes, unescaped `="${…}"` interpolations and `id="…${…}"`.
- `types`: remaining files are type-only (grep for secrets/defaults/key material: none).
- `test-utils`: `cloudflare/*`, `factories/*`, `utils/*` not read (mocks/factories, dev-only; reachability verified instead).

**Not read (pure computation, no external-input parsing; out of the requested focus):** `core/services/{ColorService,DyeService,DyeFilter,HarmonyGenerator}.ts`, `core/services/color/*`, `core/blending/*`, `core/config/{band-*,consolidated-ids,dye-vocabulary,facewear,learn-links,product-links}.ts` (URL grep only), `core/utils/kd-tree.ts`, `core/types/*`.

**Consumer peeks (for severity calibration only):** `apps/presets-api/src/middleware/auth.ts:150-230`, `apps/presets-api/src/services/validation-service.ts:19-50,170-220`, `apps/discord-worker/src/services/preset-api.ts:30-70`, `apps/oauth/src/handlers/refresh.ts:1-30,60-125,262-295`, `apps/oauth/src/services/jwt-service.ts:155-176`, `apps/discord-worker/src/test-utils.ts:1-20`; greps across `apps/*/src` for `image/svg+xml`, `validateFormat|trustXForwardedFor|sanitizePath|logUserAgent|errorTracker|fail-closed`, `verifyBotSignature|hmacSignHex|verifyJWTSignatureOnly|decodeJWT|isTokenRevoked`, `generatePresetSwatch(`, `parseCharaFile`, `toJSON()|instanceof AppError`, `@xivdyetools/test-utils`.

---

## Appendix — verification evidence (executed against `packages/*/dist`, built 2026-08-21 00:32, newer than every reviewed `src` file)

```
[logger-cycle] THREW: TypeError: Converting circular structure to JSON
[logger-bigint] THREW: TypeError: Do not know how to serialize a BigInt
[logger-line-0] {"level":"error","message":"Failed with token=abc123",…,"error":{"name":"Error","message":"upstream said token=[REDACTED]"}}
[logger-line-1] {"level":"error","message":"Non-error thrown",…,"error":{"name":"Unknown","message":"string error token=ghi789"}}
[logger-line-2] {…"context":{…,"privateKey":"PK","setCookie":"sid=1","webhookUrl":"https://discord.com/api/webhooks/1/TOKEN","authHeader":"Bearer eyJ.x.y","sessionToken":"[REDACTED]"}}
[chara constructor/Hyur/Male] ACCEPTED tribe=function:function Object() { [native co …
[chara __proto__/Hyur/Male] ACCEPTED tribe=object:[object Object] … json={"tribe":{},…}
[chara Midlander/toString/Male] ACCEPTED … race=function
[chara Midlander/Hyur/hasOwnProperty] ACCEPTED … gender=function
[chara NotATribe/Hyur/Male] REJECTED: .chara field Tribe: unrecognised value "NotATribe" …
[chara-lanes] [{"slot":"MainHand","set":1e+308,"base":1,"variant":1},{"slot":"Body","base":1e+300,"variant":7000000000000000}]
[escapeXml] "A\u0001B&lt;C&gt;&amp;&quot;&apos;\u0000"
[jwt exp:{}] ACCEPTED   [jwt exp:"9999999999"] ACCEPTED   [jwt exp:[future]] ACCEPTED
[jwt sub:{}] ACCEPTED   [jwt sub:123(number)] ACCEPTED    [jwt nbf future] ACCEPTED
[jwt alg none] rejected [jwt header null] rejected        [jwt short secret] rejected (fail-closed)
[botsig id=123 name=a:b] true
[botsig id=123:a name=b (same sig)] true
[botsig ts with junk suffix] true
[timingSafeEqual] [true,false,false]
[b64 "YQ"] [97] [b64 "YQ=="] [97] [b64 "YQ="] [97] [b64 "Y"] THROW DOMException [b64 "!!!"] THROW DOMException [b64 ""] []
[memrl victim blocked before flood] true
[memrl victim allowed after flood (counter evicted)] true
[redos quote+200k a] 2.5 ms for 200001 chars
[redos token=" + 200k a] 1.1 ms for 200007 chars
[redos many token= no close] 1.6 ms for 232000 chars
[redos json-ish keys] 1.6 ms for 198000 chars

resvg-wasm 2.6.2:
[plain name] rendered OK
[name with U+0001] RENDER FAILED: SVG data parsing failed … a non-XML character '\u{1}' found at 3:164
[name with U+0000] RENDER FAILED …   [name with U+000C (FF)] RENDER FAILED …   [name with U+FFFE] RENDER FAILED …
[name with <script>] rendered OK
[bad hex in escaped rect] rendered OK
```
