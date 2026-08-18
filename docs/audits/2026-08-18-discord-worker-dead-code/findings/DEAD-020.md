# [DEAD-020]: auth `isJWTExpired`, `getJWTTimeToExpiry`, `timingSafeEqualBytes` — documented API with zero callers; root re-export of `/encoding` is redundant-by-design

## Category
Unused Export (DEAD, documented)

## Location
- `packages/auth/src/jwt.ts:275-297` — `isJWTExpired`, `getJWTTimeToExpiry` (~23 lines + jwt.test.ts cases)
- `packages/auth/src/timing.ts:65-86` — `timingSafeEqualBytes` (~22 lines); `timingSafeEqual` (string) is the one everybody uses
- `packages/auth/src/index.ts:63-72` — root re-export of `base64Url*`, `hexToBytes`, `bytesToHex` (10 lines): every consumer imports from `@xivdyetools/auth/encoding`; DEPRECATIONS.md documents the root alias for the crypto migration → **KEEP** (or drop together with the DEPRECATIONS entry)
- Types `JWTPayload`, `VerifyJWTOptions`, `RevocationStore`, `BotSignatureOptions` — INTERNAL-ONLY but correct `.d.ts` hygiene → KEEP
- `DiscordVerificationResult` / `DiscordVerifyOptions` — **LIVE** (knip's premise was wrong: both bot workers' `utils/verify.ts` are re-export shims consuming them, not copies)

## Evidence
`git grep -nw isJWTExpired|getJWTTimeToExpiry|timingSafeEqualBytes` outside auth → one hit: `apps/oauth/src/services/jwt-service.ts:10`, a comment saying `isJWTExpired` was deleted from oauth. README table documents all three.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH |
| **Blast Radius** | LOW; npm-published + documented → semver-minor for hypothetical external consumers |
| **Reversibility** | EASY |

## Recommendation
**REMOVE WITH CAUTION** the three functions (+ tests, README rows, CHANGELOG note); **KEEP** the root encoding re-exports and the option types.
