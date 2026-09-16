# Review: pkg-foundation (packages/types, packages/logger, packages/auth)

## 1. Map

| Module | Purpose |
|---|---|
| `packages/types/src/color/branded.ts` | `HexColor`/`DyeId`/`Hue`/`Saturation` brands + `create*` validators |
| `packages/types/src/color/{rgb,colorblind,match-quality,index}.ts` | RGB/HSV/LAB/OKLAB/OKLCH/LCH/HSL/CMYK interfaces, colorblind matrices, `classifyMatchDistance` |
| `packages/types/src/dye/{dye,dye-filters,facewear,index}.ts` | `Dye`, `FacewearColor`, filter interfaces (type-only) |
| `packages/types/src/character/index.ts` | Character color types, `RACE_SUBRACES`/`SUBRACE_TO_RACE` maps |
| `packages/types/src/preset/{core,community,request,response,index}.ts` | Preset palette/community/request/response interfaces (type-only) |
| `packages/types/src/auth/{provider,jwt,discord,discord-snowflake,xivauth,response,index}.ts` | Auth interfaces + `isValidSnowflake` |
| `packages/types/src/api/{moderation,price,response,index}.ts` | Moderation/price/cache interfaces (type-only) |
| `packages/types/src/error/{codes,app-error,index}.ts` | `ErrorCode` enum, `AppError` runtime class |
| `packages/types/src/localization/index.ts` | `LocaleCode`, `LocaleData`, wheel/harmony key unions (type-only) |
| `packages/types/src/index.ts` | Root barrel |
| `packages/logger/src/core/base-logger.ts` | `BaseLogger`, redaction (`redactSensitiveFields`/`redactArrayItems`), `safeStringify`, `sanitizeErrorMessage` |
| `packages/logger/src/adapters/{console,json,noop}-adapter.ts` | Write strategies (pretty/JSON/silent) |
| `packages/logger/src/presets/{browser,worker,library}.ts` | Runtime-tuned factory functions |
| `packages/logger/src/constants.ts` | `CORE_REDACT_FIELDS`/`WORKER_REDACT_FIELDS` |
| `packages/logger/src/types.ts` | `Logger`/`ExtendedLogger`/`LogContext`/`LoggerConfig`/`ErrorTracker` |
| `packages/auth/src/discord.ts` | `verifyDiscordRequest` (Ed25519, body-cap-while-reading, timestamp freshness) |
| `packages/auth/src/hmac.ts` | HMAC sign/verify, CryptoKey LRU cache, bot-signature v2 |
| `packages/auth/src/jwt.ts` | `verifyJWT`/`verifyJWTSignatureOnly`/`decodeJWT`, alg pinning, claim typing |
| `packages/auth/src/timing.ts` | `timingSafeEqual` |
| `packages/auth/src/revocation.ts` | KV jti blacklist (fail-open by design) |
| `packages/auth/src/encoding/{base64,hex,index}.ts` | Base64URL/hex primitives |

## 2. Candidates

**pkg-foundation-01** — kind BUG, severity MEDIUM, `packages/logger/src/presets/browser.ts:120-125`
Claim: `createBrowserLogger`'s error-tracker wrapper builds the `captureMessage` text with raw `JSON.stringify(error)` for any non-`Error` truthy `error` argument, instead of the package's own `safeStringify` (which every adapter uses specifically to survive circular/BigInt values, per the BUG-104 fix in `console-adapter.ts`/`json-adapter.ts`).
Failing input: production mode (`isDev: () => false`) + an `errorTracker` configured, then `logger.error('msg', { a: 1, self: <circular> })` (or any object containing a `bigint`, e.g. `logger.error('msg', 123n)`).
Wrong outcome: `JSON.stringify` throws (`Converting circular structure to JSON` / `Do not know how to serialize a BigInt`) synchronously inside the wrapped `logger.error`, which is not caught anywhere in this call chain — the exception propagates out of the diagnostic logging call to whatever caller invoked it, exactly the class of bug BUG-104 fixed for the adapters but which was never applied to this tracker-wrapper's own `JSON.stringify` call.
Why tests miss it: `browser.test.ts`'s only "non-Error" case (`'should call errorTracker.captureMessage for non-Error errors'`, line 254) passes a **string** (`'string-error'`), which takes the `typeof error === 'string'` branch and never reaches `JSON.stringify`. No object, circular, or BigInt case exists for this wrapper (the BUG-104 regression suite in `console-adapter.test.ts` only exercises `ConsoleAdapter`/`JsonAdapter` directly, not this preset's tracker path).
Covered by test: no (for the failing shape).
```ts
} else if (error) {
  errorTracker.captureMessage(
    logger.sanitizeMessage(
      `${message}: ${typeof error === 'string' ? error : JSON.stringify(error)}`,
    ),
    'error',
  );
}
```
Fix direction: replace `JSON.stringify(error)` with `safeStringify(error)` (already imported transitively via `base-logger.ts`; export it or import from `../core/base-logger.js`), mirroring the adapters' own fix.

## 3. POSITIVE

- `packages/auth/src/discord.ts`: FINDING-001 (body cap enforced while reading, not after buffering) still holds — the reader loop checks `size > maxBodySize` before pushing each chunk and cancels rather than draining; timestamp freshness (FINDING-021) is checked before the body is even read.
- `packages/auth/src/jwt.ts`: alg pinned to `HS256` only (no `none`/RS256 confusion), `hasWellTypedClaims` rejects string-typed `exp`/`nbf`/`iat` and empty `sub` before any date comparison — closes the classic "numeric claim compared as string" trap.
- `packages/logger/src/core/base-logger.ts`: redaction guard is correctly ordered (`ancestors` checked before `memo`) so a genuine cycle can never be treated as already-memoized; `safeStringify` and the redaction budget deliberately fail in opposite directions (serialization truncates/closes, redaction never silently skips) and the file's own comments explain why that asymmetry is correct rather than an inconsistency.
- `packages/logger/src/core/base-logger.ts` `SANITIZE_RULES`: `authorization=` consumes to end-of-value rather than stopping at the first space (BUG-005 fixed), and the free-text scheme pass is deliberately `Bearer`-only to avoid over-redacting ordinary prose ("token exchange", "bot token missing").
- `packages/types/src/color/branded.ts` `createHexColor`: regex is anchored (`^#(...)$`), accepts both 3- and 6-digit hex case-insensitively, and normalizes/uppercases consistently — no bypass found.
- `packages/auth/src/hmac.ts`: all HMAC/JWT signature checks go through `crypto.subtle.verify`/`timingSafeEqual`, never a manual `===` comparison of secrets or signatures.

## 4. REJECTED

- `getOrCreateHmacKey` cache key `${secret}:${usage}` collision — `usage` is a closed literal union, not attacker-controlled, so no two distinct (secret, usage) pairs can produce the same key.
- `verifyBotSignatureV2`'s `parseInt(req.timestamp, 10)` accepting trailing garbage (`"123abc"` → `123`) — harmless: the canonical string HMAC'd is the raw `req.timestamp` string, so a forged/garbled timestamp still has to satisfy the freshness window AND produce a matching signature; no bypass.
- `base64UrlDecodeBytes` throwing on structurally-invalid padding (length % 4 === 1) — every call site (`hmacVerify`, `hmacVerifyHex`, `verifyJWTSignature` via `verifyJWT`/`verifyJWTSignatureOnly`) is wrapped in a try/catch that returns `false`/`null`, so this never escapes as an unhandled exception.
- `timingSafeEqual`'s `crypto.subtle.timingSafeEqual` call — confirmed synchronous (not a Promise) per Cloudflare's non-standard extension; the `try/catch` correctly falls back to the manual XOR loop when unavailable, no logic bug.
- Logger `redactSensitiveFields`'s `Object.keys(redacted)` / bracket-write pattern for prototype-pollution — `redacted` is always a fresh object literal (`{ ...context }`), never a lookup into a shared map/prototype, so client-controlled keys like `"__proto__"` only ever become an own enumerable property of a throwaway copy, not a prototype write.
- `createDyeId`'s 1–254 window rejecting legacy itemIDs/synthetic negative facewear IDs — matches the documented schema-v2 contract exactly (`packages/types/CLAUDE.md`), not a defect.

## 5. COVERED

29 files read in `packages/types/src` (every non-test source file): `api/index.ts`, `api/moderation.ts`, `api/price.ts`, `api/response.ts`, `auth/discord-snowflake.ts`, `auth/discord.ts`, `auth/index.ts`, `auth/jwt.ts`, `auth/provider.ts`, `auth/response.ts`, `auth/xivauth.ts`, `character/index.ts`, `color/branded.ts`, `color/colorblind.ts`, `color/index.ts`, `color/match-quality.ts`, `color/rgb.ts`, `dye/dye-filters.ts`, `dye/dye.ts`, `dye/facewear.ts`, `dye/index.ts`, `error/app-error.ts`, `error/codes.ts`, `error/index.ts`, `index.ts`, `localization/index.ts`, `preset/community.ts`, `preset/core.ts`, `preset/index.ts`, `preset/request.ts`, `preset/response.ts`.

13 files read in `packages/logger/src` (every non-test source file): `adapters/console-adapter.ts`, `adapters/index.ts`, `adapters/json-adapter.ts`, `adapters/noop-adapter.ts`, `constants.ts`, `core/base-logger.ts`, `core/index.ts`, `index.ts`, `presets/browser.ts`, `presets/index.ts`, `presets/library.ts`, `presets/worker.ts`, `types.ts`.

9 files read in `packages/auth/src` (every non-test source file): `discord.ts`, `encoding/base64.ts`, `encoding/hex.ts`, `encoding/index.ts`, `hmac.ts`, `index.ts`, `jwt.ts`, `revocation.ts`, `timing.ts`.

Test files skimmed (coverage-check only, not full read): `packages/logger/src/adapters/console-adapter.test.ts`, `packages/logger/src/presets/browser.test.ts`, `packages/logger/src/core/base-logger.test.ts` (redaction/BUG-005/BUG-004 sections), plus the auth package's test-file inventory (`bot-signature-v2.test.ts`, `discord.test.ts`, `discord-freshness.test.ts`, `discord-stream.test.ts`, `hmac.test.ts`, `jwt.test.ts`, `revocation.test.ts`, `timing.test.ts`, `encoding/*.test.ts`) confirmed to exist and cover FINDING-001/FINDING-021 by name.

Total: 51 non-test source files read across the three packages.
