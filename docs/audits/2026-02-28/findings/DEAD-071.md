# DEAD-071: @xivdyetools/auth — 12 Unused Exported Symbols

## Category
Unused Exports

## Location
- File(s): `packages/auth/src/index.ts`, `packages/auth/src/jwt.ts`, `packages/auth/src/hmac.ts`, `packages/auth/src/timing.ts`
- Symbol(s): `verifyJWTSignatureOnly`, `decodeJWT`, `isJWTExpired`, `getJWTTimeToExpiry`, `JWTPayload`, `createHmacKey`, `hmacSign`, `hmacSignHex`, `hmacVerify`, `hmacVerifyHex`, `BotSignatureOptions`, `timingSafeEqualBytes`

## Evidence
Cross-referenced every import of `@xivdyetools/auth` across the entire monorepo (apps + packages). Only 8 of 20 exported symbols are consumed:

**Consumed (8):** `verifyJWT`, `verifyBotSignature`, `timingSafeEqual`, `verifyDiscordRequest`, `unauthorizedResponse`, `badRequestResponse`, `DiscordVerificationResult`, `DiscordVerifyOptions`

**Unconsumed (12):**
| Symbol | Type | Notes |
|--------|------|-------|
| `verifyJWTSignatureOnly` | function | JWT signature-only verification (no expiry check) — not consumed by any app |
| `decodeJWT` | function | Decode without verification — not consumed |
| `isJWTExpired` | function | Expiry check — not consumed |
| `getJWTTimeToExpiry` | function | TTL helper — not consumed |
| `JWTPayload` | type | Interface — not imported by any consumer (oauth uses its own type) |
| `createHmacKey` | function | Low-level HMAC key creation — not consumed |
| `hmacSign` | function | Raw HMAC sign (base64) — not consumed |
| `hmacSignHex` | function | Raw HMAC sign (hex) — not consumed |
| `hmacVerify` | function | Raw HMAC verify (base64) — not consumed |
| `hmacVerifyHex` | function | Raw HMAC verify (hex) — not consumed |
| `BotSignatureOptions` | type | Options for verifyBotSignature — not imported (consumers use defaults) |
| `timingSafeEqualBytes` | function | Byte-level timing-safe compare — not consumed |

Consumers found:
- `apps/discord-worker/src/utils/verify.ts` → `verifyDiscordRequest`, `unauthorizedResponse`, `badRequestResponse`, `timingSafeEqual`, `DiscordVerificationResult`, `DiscordVerifyOptions`
- `apps/moderation-worker/src/utils/verify.ts` → same symbols as discord-worker
- `apps/presets-api/src/middleware/auth.ts` → `verifyJWT` (as `sharedVerifyJWT`), `verifyBotSignature`

## Why It Exists
These are general-purpose auth utilities designed for the ecosystem. The raw HMAC functions provide building blocks for custom signing, and the JWT helpers cover various verification scenarios. The library was designed to be comprehensive, not just for current consumers.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | MEDIUM — definitely unused today but designed as a reusable library |
| **Blast Radius** | NONE — removing unexported symbols from barrel only |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | Possible: external scripts, future apps (stoat-worker), direct subpath imports |

## Recommendation
**KEEP** — Mark as `@public` API surface

### Rationale
- This is a shared library published to npm; unused exports are **intentional public API**
- The JWT helpers (`decodeJWT`, `isJWTExpired`, `getJWTTimeToExpiry`) form a complete JWT toolkit
- The raw HMAC functions enable custom signing use cases
- `timingSafeEqualBytes` is the binary counterpart to `timingSafeEqual`
- Only 810 lines total — negligible maintenance burden
- No dead code _inside_ the functions; all code paths are reachable
- Library is clean: 0 TODOs, 0 commented code, 0 @deprecated markers
