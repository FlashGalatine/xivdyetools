# Security review — shared packages (`packages/*`) — 2026-08-29

**Unit:** `@xivdyetools/auth` 1.4.0, `@xivdyetools/logger` 2.1.0, `@xivdyetools/worker-kit` 1.1.0, `@xivdyetools/core` 4.0.1, `@xivdyetools/svg` 3.0.0, `@xivdyetools/types` 2.0.0, `@xivdyetools/test-utils` 1.2.0 (private). `packages/bot-logic` is the discord-worker reviewer's and was read only where the svg `title` producer contract required it.
**Baseline:** `b195723f..HEAD` (13 package commits: FINDING-001/002/003/014/015/021/026/027/028 remediation on 2026-08-21, svg 3.0.0 chara-name rename + band-ink work on 2026-08-28/29, Dependabot bumps). Every changed source file in the delta list was read in full; the whole of auth / logger / worker-kit / svg src, the security-relevant half of core, and the runtime-guard files of types / test-utils were read against the checklist rows *Packages* and *Personal data*.
**Method:** read-only in the audit worktree; consumer call sites in `apps/*/src` were read only to calibrate severity (they are not re-filed here — cross-unit facts are flagged for the owning reviewer). No package test was executed; guard tests were read.
**Bottom line:** the 2026-08-21 fixes are real and guarded (v2 signature, claim typing, Discord freshness, logger safeStringify/value scan, `Object.hasOwn`, XML-illegal strip, native rate-limit backend). What remains is (1) the *rollover* half of FINDING-014 never landed — v1 is still exported, still sent, still accepted, and the v2 nonce is never checked for reuse; (2) the native limiter's fail-open is unobservable in two consumers; (3) two personal-data sinks the packages provide (`logUserAgent`, raw limiter keys in error logs) that collide with the web-app's written privacy promise; (4) small redaction and escaping gaps. Nothing CRITICAL/HIGH on the package side.

---

## Module map

| Package | Security-relevant exports (file) | In-repo consumers (`apps/*/src`, non-test) |
|---|---|---|
| **auth** 1.4.0 | `verifyJWT`, `verifyJWTSignatureOnly`, `decodeJWT` (`jwt.ts`); `isTokenRevoked`, `revokeToken`, `REFRESH_GRACE_SECONDS` (`revocation.ts`); `createHmacKey` (≥32 B), `hmacSign/Hex`, `hmacVerify/Hex`, **`verifyBotSignature` (v1)**, `createBotSignatureV2`, `verifyBotSignatureV2`, `BOT_SIGNATURE_V2_HEADER`, `BOT_SIGNATURE_NONCE_HEADER` (`hmac.ts`); `timingSafeEqual` (`timing.ts`); `verifyDiscordRequest` (`discord.ts`); `/encoding` base64url + hex | discord-worker `index.ts:551` (Discord verify), `services/preset-api.ts:141-165` (v1 **and** v2 signing), `utils/env-validation.ts`, `utils/github-verify.ts`; moderation-worker `index.ts:122`, `services/preset-api.ts:140-164`, `utils/verify.ts`, `utils/env-validation.ts`; oauth `handlers/refresh.ts:75,80,114,181,282,296`, `services/jwt-service.ts:155-232`, `utils/pkce-binding.ts`; presets-api `middleware/auth.ts:95-103` (JWT + revocation + `issuer`), `:215-238` (v2, then v1 fallback) |
| **logger** 2.1.0 | `createRequestLogger`/`createWorkerLogger` → `JsonAdapter` + `WORKER_REDACT_FIELDS`; `createBrowserLogger`/`browserLogger` → `ConsoleAdapter`; `createLibraryLogger`/`ConsoleLogger`/`NoOpLogger`; `safeStringify`, `looksLikeSecretValue` (`core/base-logger.ts`); redact list (`constants.ts`) | 43 src files: discord-worker (27), moderation-worker (11), stoat-worker (`index.ts:17`, `message-handler.ts:23` — `createLibraryLogger`, Node), web-app (`shared/logger.ts` → `browserLogger`, `api-service-wrapper.ts`); every Worker indirectly through worker-kit `loggerMiddleware` |
| **worker-kit** 1.1.0 | `requestIdMiddleware` (UUID-validated), `loggerMiddleware` (`logUserAgent` opt-in, `sanitizePath`), `rateLimitMiddleware` (`onError` default `'fail-open'`); `/rate-limiter`: `getClientIp` (CF-Connecting-IP only), `getRateLimitHeaders`, `CloudflareRateLimiter` (native `[[ratelimits]]`, tiered), `KVRateLimiter`, `MemoryRateLimiter`, `UpstashRateLimiter`, presets | api-worker `index.ts:63-73`, `middleware/rate-limit.ts` (CF → KV), `universalis/services/rate-limiter.ts:46` (**Memory**, public proxy), `chara/router.ts`, `telemetry/router.ts`; discord-worker `index.ts`, `services/rate-limiter.ts` (Upstash → KV); image-worker `index.ts`; moderation-worker `index.ts`, `middleware/rate-limit.ts` (CF → KV); oauth `index.ts:36-40`, `services/rate-limit.ts` (CF → KV → Memory), `handlers/xivauth.ts`, `services/user-service.ts`; og-worker `index.ts:134` (`logUserAgent:false`); presets-api `index.ts:48-53`, `middleware/rate-limit.ts` (CF → Memory) |
| **core** 4.0.1 | `parseCharaFile` (`chara-parser.ts`), `resolveCharaColors` (`chara-resolver.ts`), `charaModelKey`/`gearModelKey`/`weaponModelKey` (`chara-models.ts`); `DyeDatabase.initialize` (proto-safe clone); `LocalizationService`/`TranslationProvider` (`Object.hasOwn` on `getLabel`); `APIService` (Universalis client — **no in-repo app consumer**); `/blending` `blendColors`; `PaletteService` (clamped) | 62 app src files. `.chara`: web-app `components/chara-import.ts`, `services/chara-resolve-service.ts`; api-worker `chara/resolver.ts:22,46,114,124` (`charaModelKey`); bot-logic `commands/swatch.ts` |
| **svg** 3.0.0 | `escapeXml` (control-char strip), `text()`/`cardText()` (escape content), `rect/circle/line/swatch` (escape fill/stroke), `cardShell` (400 px wide, height capped 350), `generateSwatchCard({ title })`, `generateDyeInfoCard`, `generatePresetSwatch`, other card generators, glyph set | packages/bot-logic (8 files — the only `generateSwatchCard` producer, passes `card.swatchTitle`); discord-worker `handlers/commands/{budget,extractor,preset,stats}.ts`, `services/budget/budget-calculator.ts`; og-worker `services/svg/{band,band-shared,default-card}.ts` (`escapeXml`, `estimateTextWidth`); web-app icon shims, `theme-service.ts`, `budget-tool.ts` |
| **types** 2.0.0 | runtime guards `createHexColor`, `createDyeId` (1–254), `createHue`, `createSaturation`, `isValidSnowflake` (`/^\d{17,20}$/`), `classifyMatchDistance`; `AppError.toJSON()` (includes `stack`) | 90 app src files |
| **test-utils** 1.2.0 (private) | `verifyBotSignature` (**non-constant-time, same name as auth's**), `TEST_SIGNING_SECRET`, `createTestJWT`, D1/KV/R2/AE mocks | `devDependencies` only: api-worker, discord-worker, moderation-worker, oauth, presets-api, packages/svg (`package.json`); the only non-`.test.ts` importer is `apps/discord-worker/src/test-utils.ts` (itself a test helper) |

Previous-audit fix status (delta re-verified — see *Positive controls* for evidence): FINDING-001 ✔, FINDING-003 ✔ (with PKG-04 caveat), FINDING-014 ✔ *partial — rollover half open* (PKG-01/02), FINDING-015 ✔, FINDING-021 ✔, FINDING-026 ✔ (JsonAdapter only — PKG-07/08), FINDING-027 ✔, FINDING-028 ✔ (four hex sites still unescaped — PKG-09), FINDING-036 ✔ (overrides moved to `pnpm-workspace.yaml:8-27`; `pnpm audit --prod` clean).

---

## Candidates

### PKG-01 — FINDING-014 rollover never finished: v1 bot HMAC is still exported, still sent by both bots, still accepted by presets-api when the v2 header is absent

- **Severity:** LOW  **Exposure:** INTERNAL (service binding) / INTERNET-AUTH (bearer-gated `PRESETS_API_URL` fallback)  **Rotation:** none required by this finding; note `BOT_SIGNING_SECRET` rotation is still the open "optional but recommended" row at `docs/operations/POST_MERGE_CHECKLIST.md:357`.
- **Where:** `packages/auth/src/hmac.ts:237-277` (v1 verifier unchanged), `packages/auth/src/index.ts:48` (exported); `apps/presets-api/src/middleware/auth.ts:228-239`; senders `apps/discord-worker/src/services/preset-api.ts:148`, `apps/moderation-worker/src/services/preset-api.ts:147`; gate `docs/operations/POST_MERGE_CHECKLIST.md:367`; test `apps/presets-api/tests/middleware/auth-v2.test.ts:106` ("still accepts a v1-only request").

```ts
// presets-api auth.ts:228-238
} else {
  // v1 (timestamp:userId:userName) — kept for rollover; both bots send v2
  // as of 2026-08-21 and v1 is slated for removal once they are deployed.
  isValidSignature = await verifyBotSignature(signature, timestamp, userDiscordId, userName, c.env.BOT_SIGNING_SECRET);
}
```

- **Trigger:** an attacker holding `BOT_API_SECRET` (the bearer at `auth.ts:180`) and one captured `(X-Request-Timestamp, X-User-Discord-ID, X-User-Discord-Name, X-Request-Signature)` tuple sends any presets-api request **without** `X-Request-Signature-V2`. The verifier takes the v1 branch (`auth.ts:208` only checks `signatureV2 !== undefined`), and v1 binds neither method, path nor body and has a 5-min + 60 s window (`hmac.ts:245,264-276`).
- **Impact:** everything FINDING-014 fixed remains reachable by header stripping for as long as v1 is accepted — arbitrary create/vote/delete as the captured identity for ~6 minutes. The removal gate ("both bots and presets-api production deploys carry the v2 code") was satisfied by the 2026-08-28 merge-day deploys, so this is now an overdue removal rather than a rollover. Both bots still *send* the v1 header, so any log line or proxy that captures request headers captures a usable v1 tuple.
- **Fix:** presets-api: delete the v1 branch (missing v2 header → unauthenticated) and flip the `auth-v2.test.ts:106` case to expect rejection; bots: stop emitting `X-Request-Signature`; auth: `@deprecated` `verifyBotSignature` now, remove in the next major; strike the `POST_MERGE_CHECKLIST.md:367` row.

### PKG-02 — v2 nonce is bound but never checked for reuse: no replay store exists anywhere, so any captured v2-signed request replays for up to 120 s

- **Severity:** LOW  **Exposure:** INTERNAL / INTERNET-AUTH (same precondition as PKG-01)  **Rotation:** none.
- **Where:** `packages/auth/src/hmac.ts:333` (`req.nonce ?? ''` — nonce optional), `:358-362` (doc: "Nonce replay protection is left to the caller"), `:369-380` (60 s age + 60 s future skew); `apps/presets-api/src/middleware/auth.ts:215-227` (passes the header nonce into the canonical string and nothing else); grep of `apps/*/src` for `X-Request-Nonce|BOT_SIGNATURE_NONCE_HEADER` hits only the three signer/verifier files — no KV/memory store.

```ts
// hmac.ts:358-362
/**
 * Verify a v2 bot signature: freshness (default 60 s, 60 s future skew) and
 * the full request binding. Nonce replay protection is left to the caller
 * (store `nonce` for the window if you need strict single-use).
 */
```

- **Trigger:** with the bearer plus one captured v2-signed request (headers + body), re-send it verbatim within `BOT_SIGNATURE_V2_MAX_AGE_MS` (60 s, `:284`) plus the 60 s future skew: the same `POST …/vote`, preset create or delete executes again.
- **Impact:** the "nonce + 60 s" design that FINDING-014's remediation advertises (and the reviewer brief expects) provides no single-use guarantee — the nonce currently only makes two signatures differ. Window is short and the bearer is required, hence LOW; but the API shape makes the omission invisible to a consumer (`nonce` is optional, no store parameter exists).
- **Fix:** add `verifyBotSignatureV2(sig, req, secret, { nonceStore })` where `nonceStore` is `{ get(key): Promise<string|null>; put(key, value, { expirationTtl }) }` (the same structural shape as `RevocationStore`); when a store is given require a non-empty nonce, reject a seen nonce, record it with TTL = window + skew. presets-api passes a KV namespace (`TOKEN_BLACKLIST` is already bound — a `nonce:` prefix suffices). Add a replay test to `bot-signature-v2.test.ts`.

### PKG-03 — v2 canonical string omits the query string

- **Severity:** INFO  **Exposure:** INTERNAL / INTERNET-AUTH  **Rotation:** none.
- **Where:** `packages/auth/src/hmac.ts:298-299` (`/** URL path only (no origin, no query) */`), `:326-338`; verifier `apps/presets-api/src/middleware/auth.ts:219` (`new URL(c.req.url).pathname`); signers strip the query too (`apps/discord-worker/src/services/preset-api.ts:157`).
- **Trigger:** a captured signed `GET /api/v1/presets?…` verifies for any other query string on the same path within the window.
- **Impact:** today only read routes consume queries (`apps/presets-api/src/handlers/presets.ts:194`, `handlers/moderation.ts:320`), so no mutation is affected; this is the one request component the "full request binding" leaves out and a future `?force=`/`?status=` on a signed mutation would be unbound.
- **Fix:** add `url.search` (or a sorted `key=value&…` canonical form) as a ninth length-prefixed field; bump `'v2'` → `'v3'` in the canonical header so old signers fail loudly.

### PKG-04 — Native rate-limiter fail-open is silent in oauth and moderation-worker (no logger wired, `backendError` dropped, binding shape unvalidated)

- **Severity:** LOW  **Exposure:** INTERNET-UNAUTH (oauth `/auth/*`), INTERNET-UNAUTH (moderation interactions, Ed25519-gated)  **Rotation:** none.
- **Where:** `packages/worker-kit/src/rate-limiter/backends/cloudflare.ts:108-117` (constructor checks only `tiers.length`), `:159-174` (throw → `allowed:true, backendError:true`, warn only via `this.logger?.warn`); no consumer passes `logger`: `apps/api-worker/src/middleware/rate-limit.ts:40-43,120-129`, `apps/presets-api/src/middleware/rate-limit.ts:41-44`, `apps/oauth/src/services/rate-limit.ts:95-98`, `apps/moderation-worker/src/middleware/rate-limit.ts:147-150`. api-worker and presets-api still get a log line from `rateLimitMiddleware` (`packages/worker-kit/src/middleware/rate-limit.ts:175-184`); oauth `checkRateLimit` returns `{allowed, remaining, resetAt, limit}` and discards `backendError` (`apps/oauth/src/services/rate-limit.ts:140-145`); moderation `checkRateLimit` likewise (`apps/moderation-worker/src/middleware/rate-limit.ts:188-193`).

```ts
// cloudflare.ts:159-172
} catch (error) {
  if (config.failOpen !== false) {
    this.logger?.warn('Rate limiter fail-open: rate-limit binding error, allowing request', { … });
    return { allowed: true, remaining: tier.limit, resetAt, limit: tier.limit, backendError: true };
  }
```

- **Trigger:** a `[[ratelimits]]` outage, a renamed/missing binding on a future deploy, or a wrongly-typed binding (anything without `.limit()` — e.g. a KV namespace passed by mistake) makes every `check()` throw; the request is allowed and **nothing is logged** in oauth/moderation. `POST_MERGE_CHECKLIST.md:340` ("Confirm the `[[ratelimits]]` bindings exist on every production worker") is still unchecked, which is exactly the state this would hide.
- **Impact:** oauth's brute-force limits (10/20/30 per min) and moderation's per-user limits can be off with no signal; the accepted fail-open trade-off assumes "Logging/Alerting: `backendError: true` flag + structured logging" (`docs/architecture/security-trade-offs.md`, *Fail-Open* → *Mitigations*), which is not true for these two consumers.
- **Fix:** worker-kit — validate `typeof tier.binding?.limit === 'function'` in the constructor (throw = fail loudly on the first request, like a missing KV binding would), and fall back to `console.warn` when no logger is supplied (KV's increment path already does this at `kv.ts:242-247`); consumers — pass `getLogger(c)` and log `backendError`. A wrangler-config test that every `[env.production.ratelimits]` name matches the `Env` type would close the deploy-time half.

### PKG-05 — `loggerMiddleware({ logUserAgent: true })` writes the full User-Agent of every request to Workers Logs on three internet-facing workers, including the `/v1/telemetry` beacon whose privacy page says "your … user agent … is never collected"

- **Severity:** MEDIUM (the brief's rule reads HIGH for "a field the policy explicitly promises not to store"; rated MEDIUM here because the sink is the operational request log, not the analytics dataset, and the promise's sentence is scoped to the telemetry batch — coordinator to decide which reading governs)  **Exposure:** INTERNET-UNAUTH  **Rotation:** none.
- **Where:** package option `packages/worker-kit/src/middleware/logger.ts:44-49` (default `false`, good) and sink `:141-145`; opt-ins `apps/api-worker/src/index.ts:66-73` (`app.use('*', …)` — applies to `/v1/telemetry`), `apps/oauth/src/index.ts:37-40`, `apps/presets-api/src/index.ts:49-53`; promise `apps/web-app/PRIVACY.md:78-82` ("What is **never** collected: your IP address, user agent or device details … The server discards everything about the request except the validated events").

```ts
// worker-kit logger.ts:141-145
const startContext: Record<string, unknown> = { method, path };
if (logUserAgent) {
  startContext.userAgent = c.req.header('user-agent');
}
logger.info('Request started', startContext);
```

- **Trigger:** any request — every `sendBeacon` from an opted-in web-app tab produces a `Request started {method, path:'/v1/telemetry', userAgent}` line in api-worker's log stream for the Workers Logs retention window.
- **Impact:** CWE-359: a field the user-facing policy says is never collected is retained server-side (UA + path + timestamp, ~fingerprint-grade with the request-id). No policy for oauth/presets-api mentions request logs at all, so those two are "field not listed" (MEDIUM by the brief).
- **Fix:** set `logUserAgent: false` on api-worker (mandatory for `/v1/telemetry`), oauth and presets-api (og-worker already does, `apps/og-worker/src/index.ts:134`); if UA is wanted for abuse triage, log a coarse family bucket instead. Alternatively amend `PRIVACY.md` to disclose operational request logs and their retention. Package-side: keep the default `false` and add a doc line that enabling it must be reflected in the consumer's privacy notice.

### PKG-06 — Rate-limit error / fail-open paths log the raw limiter key (client IP; Discord user id for the bots)

- **Severity:** LOW  **Exposure:** INTERNET-UNAUTH (api-worker, oauth, presets-api keys = `getClientIp`); INFO for discord-worker/moderation-worker (key = Discord user id, which `apps/discord-worker/PRIVACY_POLICY.md:79` lists for "Prevent abuse | User ID, Rate limit counters")  **Rotation:** none.
- **Where:** `packages/worker-kit/src/middleware/rate-limit.ts:142-150` and `:175-184` (`key` on backend error), `rate-limiter/backends/kv.ts:165-170` and `:228-247` (`key`, `kvKey`; `:242-247` `console.error` fallback), `backends/cloudflare.ts:161-165` (`key: bindingKey`), `backends/upstash.ts:100-104` (`key`). Keys: `apps/api-worker/src/middleware/rate-limit.ts:69,138`, `apps/presets-api/src/middleware/rate-limit.ts:57`, `apps/oauth/src/services/rate-limit.ts:136` (`${ip}:${path}`), `apps/discord-worker/src/services/rate-limiter.ts:185` (`${userId}:${scope}`), `apps/moderation-worker/src/middleware/rate-limit.ts:177` (`${type}:${userId}`).
- **Trigger:** KV/Upstash/binding error during a request — rare, but every such line carries the raw IP; `apps/web-app/PRIVACY.md:78` promises the IP is never collected and `apps/discord-worker/PRIVACY_POLICY.md:54` says "IP addresses (abstracted by Cloudflare Workers)" are not.
- **Impact:** CWE-532 on an error path; low volume.
- **Fix:** log `keyPrefix` plus a truncated `sha256(key)` (12 hex chars is enough for correlation) instead of the key; or drop the key and keep `kvKey` only for KV (it embeds the key — hash that too).

### PKG-07 — Logger value-shape redaction does not reach array string items or the free-text `message`/`error.message`

- **Severity:** LOW  **Exposure:** every Worker (CWE-532)  **Rotation:** none (latent).
- **Where:** `packages/logger/src/core/base-logger.ts:225-231` (value scan only on direct string values), `:242-248` (arrays: non-object items pass through untouched), `:66-69` and `:125-131` (message / non-Error throws go through `sanitizeErrorMessage` only), `:143-193` (key=value + `Bearer` patterns only — no JWT / Discord-token / hex shape), `:411-421` (`looksLikeSecretValue` exists but is never applied to messages). Guard coverage: `hardening.test.ts:44-49` (message `token=`), `:69-87` (object values); `base-logger.test.ts:430-434` (arrays of *objects*). No test for a bare JWT in `message` or a string array.

```ts
// base-logger.ts:244-248
redacted[key] = value.map((item: unknown) =>
  typeof item === 'object' && item !== null && !visited.has(item)
    ? this.redactSensitiveFields(item as LogContext, visited)
    : item,          // ← strings are not shape-scanned
);
```

- **Trigger:** `logger.error(\`refresh failed for ${jwt}\`)` (message has no `token=`), `logger.info('x', { tokens: [jwt] })` (`tokens` misses the `(token|secret|password|apikey)$` suffix at `:217` and the item is a string), or an `Error` whose message embeds a bearer value without a key.
- **Impact:** defence-in-depth gap only — no in-repo call site was found doing this today — but it is the exact accidental pattern FINDING-026 set out to close, and the package's changelog claims value-shape coverage for "STRINGS under any key".
- **Fix:** run a substring-replacing form of `SECRET_VALUE_PATTERNS` (global, non-anchored variants) over `message`, `error.message` and array string items; extend the suffix regex with plural forms (`tokens|secrets|keys|passwords`); add the three cases to `hardening.test.ts`.

### PKG-08 — `ConsoleAdapter` still serialises with raw `JSON.stringify` and the redaction copy keeps cyclic back-references, so the "write() never throws" guarantee holds for `JsonAdapter` only

- **Severity:** INFO (LOW for stoat-worker, the one production Node consumer)  **Exposure:** LOCAL (browser preset) / stoat-worker  **Rotation:** none.
- **Where:** `packages/logger/src/adapters/console-adapter.ts:62` (`JSON.stringify(context)`) and `:104` (`JSON.stringify(entry)`); `core/base-logger.ts:239-241` (`if (visited.has(value)) continue;` — the copy still points at the original cyclic object); fixed path `adapters/json-adapter.ts:40-46`. Consumers: web-app `browserLogger`, stoat-worker `createLibraryLogger` (`apps/stoat-worker/src/index.ts:17`, `message-handler.ts:23`), core `ConsoleLogger`.
- **Trigger:** `logger.info('x', obj)` with `obj.self = obj` or a BigInt (`weaponModelKey()` returns one) through the browser/library preset → `TypeError` propagates out of the log call.
- **Impact:** availability only; the 2026-08-21 changelog line "`write()` can no longer throw out of a log call" is true only for the worker preset.
- **Fix:** use `safeStringify` in both `ConsoleAdapter` branches; in `redactSensitiveFields` replace a visited value with `'[Circular]'` instead of `continue`.

### PKG-09 — Four dye-hex `fill="…"` interpolations still bypass `escapeXml`, contradicting the 2.0.1 changelog's "they were the only unescaped attribute sites"

- **Severity:** INFO (PLAUSIBLE — every value comes from the dye DB or core-computed hexes; output is rasterised to PNG)  **Exposure:** discord-worker cards  **Rotation:** none.
- **Where:** `packages/svg/src/contrast-card.ts:241-242` (`fill="${p.hexA}"`, `${p.hexB}` — 13A rest strip) and `:302-303` (13B rows); `packages/svg/src/dye-info-card.ts:224` (`fill="${n.hex}"`, nearest strip); `packages/svg/src/palette-grid.ts:160` (`fill="${band[i].hex}"`). Everything else routes through `escapeXml` (`base.ts:103,108,131,133,160,163,186,188,203`, `frame.ts:164,212,264,430-431,526,599`) or is a theme constant.
- **Trigger:** a future caller forwarding an unvalidated hex option (`"/><rect …`) into one of these four sites.
- **Fix:** wrap the four in `escapeXml()`; add a source test asserting no `fill="${` / `stroke="${` without `escapeXml(` outside the theme-constant allowlist so the changelog claim is machine-checked.

### PKG-10 — `.chara` model carries `nickname` and `producer` raw and unbounded; model lanes uncapped — privacy and bounds are enforced only by each consumer

- **Severity:** INFO  **Exposure:** LOCAL (web-app browser) / discord-worker (`.chara` attachment)  **Rotation:** none.
- **Where:** `packages/core/src/services/chara/chara-parser.ts:404` (`producer: … record['TypeName']`), `:409` (`nickname: … record['Nickname']`), `:420-424` (`readModelLane` floors any positive finite number — `1e308` accepted), `chara-resolver.ts:354,358` (copied onto `ResolvedCharaCharacter`). Consumer guards found: bot-logic `commands/swatch.ts:80` (`SwatchCharacter = Omit<…,'nickname'>`), `:171-176` (`withoutNickname` at resolve time), `:221` (localized `card.swatchTitle`); web-app `components/chara-import.ts:169,1479,1621` (never pre-fills a publishable name; nickname used only as a local file-card label at `:666,751,1640`), `services/telemetry-service.ts:176` (`normalizeProducer` allowlist bucket — never the raw `TypeName`); api-worker `chara/router.ts:44` (8 KB body), `:70` (`LANE_MAX` on the resolve request).
- **Trigger:** any consumer that logs or renders the parsed model wholesale (`logger.info('parsed', resolved)`) leaks the nickname/producer; a lane of `1e308` yields a meaningless `charaModelKey` string that api-worker rejects.
- **Impact:** the chara-name privacy rule is real but lives entirely in producers; the package offers no "drop the name" mode. Not promoted: no in-repo consumer mis-handles it today.
- **Fix:** `parseCharaFile(text, { keepNickname?: boolean })` defaulting to **drop**; cap `producer`/`nickname` at 64 code points; clamp lanes to `0..65535` (a lane is 16-bit). Keep the resolver's `nickname` field optional so `Omit` producers still type-check.

### PKG-11 — Status of the 2026-08-21 INFO items (old PKG-10..18) — none promoted

| Old id | Item | 2026-08-29 state |
|---|---|---|
| PKG-10 | `MemoryRateLimiter` per-isolate + evictable | Unchanged (`backends/memory.ts:42,122-130,195-216`). Now used in production by api-worker's **public** Universalis proxy (`apps/api-worker/src/universalis/services/rate-limiter.ts:46`, documented as a "soft brake", BUG-066) and as the no-binding fallback in presets-api/oauth. Not promoted here — flagged to the api-worker reviewer (the checklist row asks for native limiting on public routes). |
| PKG-11 | Upstash `INCR`+`EXPIRE NX` orphan key | **Withdrawn** — see *Rejected*. |
| PKG-12 | Discord freshness / buffer-before-size | Freshness fixed (FINDING-021, `discord.ts:99-110`); body still read before the byte check (`:113-119`) behind a `Content-Length` pre-check — Workers' own body limits bound it. INFO. |
| PKG-13 | `APIService` size cap after read, UTF-16 length, NaN prices, unbounded `MemoryCacheBackend` | Unchanged (`APIService.ts:703-720,258-279,170-192`). **No `apps/*/src` file constructs `APIService`** (grep) — web-app and discord-worker use their own clients through api-worker's proxy, which caps upstream bodies. INFO, published surface only. |
| PKG-14 | `.chara` lanes/strings unbounded | Unchanged at the package (see PKG-10); api-worker now bounds lanes server-side (`chara/router.ts:70`). |
| PKG-15 | `AppError.toJSON()` includes `stack` | Unchanged (`packages/types/src/error/app-error.ts:60-68`); grep finds no `c.json(err)`/`JSON.stringify(err)` sink in any app src. INFO. |
| PKG-16 | test-utils non-constant-time `verifyBotSignature` under the production name | Unchanged (`packages/test-utils/src/auth/signature.ts:94-103`); still `private: true` and `devDependencies`-only in all six consumers. INFO. |
| PKG-17 | `CryptoKey` cache keyed by raw secret; lossy `parseInt` timestamp; revocation fail-open | Unchanged (`hmac.ts:38-53`, `:254`, `:372`; `revocation.ts:49-66` documented). INFO. |
| PKG-18 | `TranslationProvider` prototype-bearing lookups | `getLabel` hardened (`TranslationProvider.ts:58-69`); `getCategory`/`getAcquisition`/`getCurrency`/… still use `obj[key]` truthiness (`:133-217`) — keys come from the dye DB/enums, not users. INFO (shape). |

---

## Positive controls (verified against current code — do not re-file)

**auth (FINDING-014/015/021/001)**
- v2 canonical string: fixed `'v2'` tag, `METHOD`, path, `sha256(body)`, timestamp, nonce, id, name — each `${len}:${value}` and newline-joined (`hmac.ts:326-338`); delimiter-collision case asserted (`bot-signature-v2.test.ts:56-60`); 60 s age + 60 s future skew (`:369-378`, tests `:62-71`); body treated as bytes (`:314-319`, test `:48-54`). presets-api never falls back to v1 when a v2 header is present (`auth.ts:208-227`; `auth-v2.test.ts:86`).
- `createHmacKey` enforces ≥ 32 bytes on **both** sign and verify (`hmac.ts:95-98` via `getOrCreateHmacKey`, keys non-extractable `:107`); every verify path is `crypto.subtle.verify` (`hmac.ts:172-177,201-206`; `jwt.ts:158-163`); `timingSafeEqual` pads and folds the length into the XOR fallback (`timing.ts:34-53`); empty/odd/non-hex signatures fail closed (`encoding/hex.ts:20-25`, caught at `hmac.ts:207`).
- JWT: `alg` pinned to HS256 **before** signature check (`jwt.ts:147`); payload must be a non-array object (`:172-174`); `exp` finite ≥ 0, `sub` non-empty string, `iat`/`nbf` numeric when present (`:178-196`); `nbf` enforced, `iss` (string or list) and `aud` enforced when requested and a missing claim rejects (`:198-207,246-266`); tests `jwt.test.ts:358-434`; `verifyJWTSignatureOnly` fails closed on missing `iat` when an age cap is set (`:314-325`). presets-api passes `issuer` (`auth.ts:95-97`; `JWT_ISSUER` confirmed set in production per `POST_MERGE_CHECKLIST.md:81`).
- Discord: required headers → freshness (300 s / 60 s skew, `Number.isFinite`) → body → **byte**-length cap → `verifyKey` (`discord.ts:88-142`); `discord-interactions@4.4.0` pinned (lockfile). Tests `discord-freshness.test.ts`.
- Revocation TTL = `exp + REFRESH_GRACE_SECONDS(900)` with a 60 s floor (`revocation.ts:87-92`; tests `revocation.test.ts:79-116`).

**logger (FINDING-026)**
- `JsonAdapter.write` → `safeStringify` (cycles → `[Circular]`, BigInt → string, last-resort envelope) (`json-adapter.ts:40-46`, `base-logger.ts:428-448`); `message` and non-`Error` throws go through `sanitizeErrorMessage` (`:66-69,125-131`); key list covers `authorization`, `cookie`, `set_cookie`, `private_key`, `webhook_url`, `auth_header`, `session_id`, `client_secret`, `signing_secret`, `webhook_secret`, plus worker `jwt_secret`/`bot_api_secret`/`bot_signing_secret`/`discord_client_secret` (`constants.ts:14-49`); case/separator-insensitive match + `(token|secret|password|apikey)$` suffix (`:215-221`); value-shape scan for `Bearer`, three-part JWT, Discord bot token, ≥ 64-hex (`:411-421`) on direct string values at every nesting level; `stack` only when `sanitizeErrors=false` (`:117-120`); `child()` loggers delegate to the parent's `createEntry`, so redaction is inherited (`:343-363`); browser `errorTracker` path sanitises context, message and stack (`browser.ts:110-119`) — and no consumer passes an `errorTracker` (grep). Hardening tests `hardening.test.ts`. No transport ships logs off-worker.

**worker-kit (FINDING-003)**
- `CloudflareRateLimiter`: tiers sorted, smallest-fitting tier chosen, key prefix scoping, `checkOnly` consumes exactly once, fail-open/closed contract under test (`cloudflare.ts`, `cloudflare.test.ts`). All four HTTP workers construct it when the binding is bound and declare `[[env.production.ratelimits]]` explicitly (`apps/api-worker/wrangler.toml:99-107`, `apps/oauth/wrangler.toml:25-37` (top-level = production), `apps/presets-api/wrangler.toml:103-105`, `apps/moderation-worker/wrangler.toml:76-83`); every consumer's tier equals its effective limit, so the largest-tier fallback never loosens anything. discord-worker keeps Upstash atomic `INCR` and warns once per isolate on KV fallback (`apps/discord-worker/src/services/rate-limiter.ts:59-91`).
- `requestIdMiddleware` validates inbound ids against a strict UUID regex by default (`request-id.ts:24,61-66`) — no consumer sets `validateFormat:false` (grep); `getClientIp` uses `CF-Connecting-IP` only, XFF opt-in that nobody enables (`ip.ts:53-79`); `loggerMiddleware` logs method + pathname only unless `sanitizePath` is supplied (`logger.ts:71-83`); KV keys use `|` (IPv6-safe, `kv.ts:283-286`); Upstash token never logged.

**core (FINDING-027)**
- `mapNamed` and `TranslationProvider.getLabel` use `Object.hasOwn` (`chara-parser.ts:268-271`, `TranslationProvider.ts:58-69`; test `chara-parser-proto.test.ts`). `DyeDatabase.initialize` deep-clones into `Object.create(null)` and drops `__proto__`/`constructor`/`prototype` (`DyeDatabase.ts:70,84-98`), validates every dye (`:116-165`). `.chara` parser rejects non-object roots and non-`.chara` JSON, type-checks every numeric/string field, never reads `Base64Image` (`chara-parser.ts:288-317`). `APIService` sanitises the DC segment to `[A-Za-z0-9]`, validates batch ids, chunks ≤ 100, 5 s timeout, 1 MB cap, 4xx not retried (`APIService.ts:638-676,683-734,856-907`; `constants.ts:126-137`). `/blending` clamps `ratio` to `[0,1]` and validates hex before any math (`blending.ts:51-55`, `conversions.ts:289-306`) — fixed-size arithmetic, no data-driven loops. `PaletteService` clamps `colorCount` 1–10, `maxIterations` 1–100, `maxSamples` ≥ 2 (`PaletteService.ts:362-395`). Locale data is static JSON with a structural check (`LocaleLoader.ts:49-96`); no HTML is produced by core i18n.

**svg (FINDING-028, chara-name privacy)**
- `escapeXml` strips C0 controls (except TAB/LF/CR), U+FFFE/U+FFFF and lone surrogates before escaping the five specials (`base.ts:18-37`; `base-escape.test.ts`). Every `<text>` is produced by `text()`/`cardText()` which escape content (`base.ts:193`, `frame.ts:171`); primitives escape `fill`/`stroke`/`font-family`/`transform`/`dasharray`. No `<image>`, `href`, `<foreignObject>`, `<script>`, `<style>`, external URLs or entities anywhere (grep). `cardShell` fixes 400 px width and caps height at `CARD_MAX_HEIGHT` 350 (`frame.ts:207-216`) — resvg work is bounded; `preset-swatch` `width` is only set by bot code.
- 3.0.0: `SwatchCardOptions.charName` removed, `title` documented as "NEVER the character's name or the attachment filename" (`swatch-card.ts:72-75`); type-level guard test (`swatch-card.test.ts:174-186`) and escape test (`:167-172`); the sole producer strips `nickname` at resolve time and passes the localized `card.swatchTitle` (`packages/bot-logic/src/commands/swatch.ts:80,171-176,221`). Enforcement is type-level + producer-side (a string is a string at runtime) — recorded as designed, see PKG-10 for the package-side option.

**types / test-utils / supply chain**
- `createHexColor`/`createDyeId`/`isValidSnowflake` are real anchored checks, not casts (`branded.ts:53-64,98-106`, `discord-snowflake.ts:30-51`); no secrets or defaults in `types`.
- `test-utils` is `private: true`, `devDependencies`-only in all six consumers, exports only reach test code.
- FINDING-036: security floors and scoped overrides live in `pnpm-workspace.yaml:8-27` (pnpm 11 no longer reads `package.json#pnpm.overrides`); `pnpm audit --prod` → "No known vulnerabilities found" (`evidence/pnpm-audit-summary.txt`).

---

## Rejected (checked and dropped — one line each)

- **Old PKG-11 Upstash `EXPIRE … NX` "orphan forever"** — Redis `EXPIRE key ttl NX` sets a TTL exactly when the key has none, so a TTL-less key self-heals on the next `check()` (`upstash.ts:73-77`); the 2026-08-21 claim was inverted. Only the `ttl === -1` cosmetic masking (`:87`) remains.
- **base64url decoder accepts non-canonical input** (`+`/`/` alphabet, `atob` whitespace, `encoding/base64.ts:67-87`) — signature malleability only; nothing keys on the token string (revocation keys on `jti`).
- **`verifyDiscordRequest` `Number(timestamp)` accepts hex/exponent forms** — the raw header string is what Ed25519 covers, freshness runs on the parsed value; no forgery, no bypass.
- **`verifyJWT` `issuer` is optional** ("a consumer that forgets `iss`") — by design; presets-api pins it (`auth.ts:95-97`, prod var confirmed), oauth is its own issuer and verifies its own tokens.
- **`selectTier` largest-tier fallback silently loosens** — every consumer binds a tier equal to its effective limit (65 / 240 / 100 / 10-20-30 / 25-70); no loosening in practice.
- **`requestIdMiddleware` trusts client UUIDs** — bounded format, correlation spoofing only; previously accepted.
- **auth `package.json` `files: ["dist","src"]` publishes `*.test.ts`** — only synthetic secrets (`test-jwt-secret-key-…`); nothing material.
- **`escapeXml` numeric inputs** — every call site passes a string; numbers are formatted by `num()`/`grp()` first; TS would reject a number.
- **`.chara` nesting/size bombs** — `JSON.parse` runs client-side (web-app) or behind api-worker's 8 KB bounded body; the parser reads a fixed key set with no recursion.
- **HMAC `CryptoKey` cache keyed by the raw secret** — bounded to 10 LRU, keys non-extractable, equivalent to holding `env` (old PKG-17).
- **oauth `${ip}:${path}` compound limiter key with an unbounded path** — consumer-side (oauth reviewer): under the native binding it only splits buckets per path; under the KV fallback a > 512-byte key would throw → fail-open. Not a package defect.
- **KV limiter key length (old PKG-9)** — all package consumers key by `getClientIp` (≤ 45 chars) or `${type}:${userId}` with fixed prefixes; the oauth exception is noted above.
- **`AppError.toJSON` stack leak (old PKG-15)** — no `c.json(err)`/`JSON.stringify(err)` sink in any app src (grep); latent only.
- **`APIService` robustness (old PKG-13)** — no in-repo app constructs it; upstream bodies are capped by api-worker's proxy.
- **ReDoS in the new value-shape regexes** (`base-logger.ts:411-416`) — each pattern anchors on `\b[MN]`/`\beyJ`/`^`, so scanning is linear in the number of alnum runs, not quadratic.

---

## Files covered (read in full unless marked)

**packages/auth:** `src/index.ts`, `src/hmac.ts`, `src/jwt.ts`, `src/discord.ts`, `src/revocation.ts`, `src/timing.ts`, `src/encoding/index.ts`, `src/encoding/base64.ts`, `src/encoding/hex.ts`, `src/bot-signature-v2.test.ts`, `src/discord-freshness.test.ts`, `src/jwt.test.ts`, `src/revocation.test.ts`, `package.json`, `CHANGELOG.md` (delta).
**packages/logger:** `src/index.ts`, `src/constants.ts`, `src/types.ts`, `src/core/index.ts`, `src/core/base-logger.ts`, `src/adapters/{index,console-adapter,json-adapter,noop-adapter}.ts`, `src/presets/{index,browser,worker,library}.ts`, `src/core/hardening.test.ts`, `package.json`, `CHANGELOG.md` (delta); grep-audited `src/core/base-logger.test.ts`, `src/adapters/console-adapter.test.ts`.
**packages/worker-kit:** `src/index.ts`, `src/middleware/{index,types,request-id,logger,rate-limit}.ts`, `src/rate-limiter/{index,types,ip,headers}.ts`, `src/rate-limiter/backends/{cloudflare,kv,memory,upstash}.ts`, `src/rate-limiter/presets/{index,configs}.ts`, `src/rate-limiter/backends/cloudflare.test.ts`, `package.json`, `CHANGELOG.md` + `CLAUDE.md` (delta); grep-audited `src/middleware/rate-limit.test.ts`, `src/rate-limiter/backends/kv.test.ts`.
**packages/core:** `src/services/chara/{chara-parser,chara-models,chara-resolver}.ts`, `src/services/chara/__tests__/chara-parser-proto.test.ts`, `src/services/APIService.ts`, `src/services/dye/{DyeDatabase,DyeSearch}.ts`, `src/services/localization/{TranslationProvider,LocaleLoader,LocaleRegistry}.ts`, `src/services/LocalizationService.ts`, `src/services/{PaletteService,CharacterColorService,PresetService}.ts`, `src/blending/{blending,conversions,index,types}.ts`, `src/utils/index.ts`, `package.json`, `CHANGELOG.md` (delta); grep-audited `src/index.ts` (export list), `src/constants/index.ts` (Universalis constants). Not read (pure colour math, no external input): `src/services/color/*`, `src/services/{ColorService,DyeService}.ts`, `src/services/dye/{DyeFilter,HarmonyGenerator}.ts`, `src/utils/kd-tree.ts`, `src/config/*`.
**packages/svg:** `src/{base,frame,index,swatch-card,dye-info-card,contrast-card,gradient,preset-swatch,a11y-card,budget-ledger,comparison-card,harmony-card,mixer-card,nearest-sheet,palette-grid,random-dyes-grid}.ts`, `src/base-escape.test.ts`, `package.json`, `CHANGELOG.md` (delta); grep-audited `src/icons/tool-icons.ts` (interpolations + signatures), `src/swatch-card.test.ts`.
**packages/types:** `src/index.ts`, `src/color/branded.ts`, `src/color/match-quality.ts`, `src/error/app-error.ts`, `src/auth/discord-snowflake.ts`, `package.json`.
**packages/test-utils:** `src/index.ts`, `src/auth/{signature,jwt,headers}.ts`, `src/constants/{index,pkce}.ts`, `package.json`.
**packages/bot-logic (producer contract only):** grep-audited `src/commands/swatch.ts`.
**Consumer calibration (excerpts):** `apps/presets-api/src/middleware/auth.ts:75-275`, `apps/discord-worker/src/services/preset-api.ts:100-200`, `apps/moderation-worker/src/services/preset-api.ts:100-195`, `apps/api-worker/src/middleware/rate-limit.ts` (full), `apps/api-worker/src/universalis/services/rate-limiter.ts:1-90`, `apps/api-worker/src/index.ts:60-80`, `apps/oauth/src/services/rate-limit.ts:60-175`, `apps/oauth/src/services/jwt-service.ts:150-235`, `apps/oauth/src/index.ts:30-45`, `apps/presets-api/src/middleware/rate-limit.ts:15-80`, `apps/presets-api/src/index.ts:44-58`, `apps/moderation-worker/src/middleware/rate-limit.ts:110-285`, `apps/discord-worker/src/services/rate-limiter.ts:55-110`, `apps/web-app/PRIVACY.md:66-90`, `apps/discord-worker/PRIVACY_POLICY.md` (grep), `apps/*/wrangler.toml` (ratelimits grep), `docs/operations/POST_MERGE_CHECKLIST.md` (grep), `docs/architecture/security-trade-offs.md`, `pnpm-workspace.yaml:5-27`, `evidence/pnpm-audit-summary.txt`, `evidence/pii-sinks.txt` + `evidence/pii-sources.txt` (packages lines), `docs/audits/2026-08-21-security/evidence/review-packages.md`.
