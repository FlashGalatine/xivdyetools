# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-08-16

Monorepo 2.0 Tier 1 package consolidation. Written 2026-07-30 and unpublished until this release (npm has 1.2.0).

### Added

- Absorbed `@xivdyetools/crypto` v1.1.2: Base64URL (RFC 4648) and hex encoding primitives (`base64UrlEncode`, `base64UrlEncodeBytes`, `base64UrlDecode`, `base64UrlDecodeBytes`, `hexToBytes`, `bytesToHex`) now live in `src/encoding/` and ship at the new `@xivdyetools/auth/encoding` subpath export (also re-exported from the package root). The standalone `@xivdyetools/crypto` package is retired and will receive no further releases — the API is identical, only the import specifier changes (`'@xivdyetools/crypto'` → `'@xivdyetools/auth/encoding'`; see `DEPRECATIONS.md`).
- `"sideEffects": false` so bundlers can tree-shake unused modules — consumers importing only `/encoding` no longer pull in `discord-interactions`.

### Changed

- `@xivdyetools/crypto` dropped from `dependencies`; `jwt.ts` / `hmac.ts` import the encoding primitives relatively. The package now has **no internal dependencies** (Level 0 of the monorepo graph) — `discord-interactions` is the only runtime dependency, `@cloudflare/workers-types` remains an optional peer.
- Docs: README and `CLAUDE.md` synced to the branch state: `/encoding` and `/revocation` subpaths documented, API-reference signatures corrected (`isJWTExpired(token)` / `getJWTTimeToExpiry(token)` take the raw token string, `unauthorizedResponse(message?)` / `badRequestResponse(message)` return JSON), consumers listed, license/legal notice added, stale blog link removed.
- **Follow-up 3**: `hmacSignHex` is now consumed by both bot workers — `discord-worker`'s `services/preset-api.ts` and `moderation-worker`'s `services/preset-api.ts` replaced their hand-rolled `crypto.subtle` signing with it, each worker's `BOT_SIGNING_SECRET` now enforced at ≥32 bytes by that worker's own env-validation. This supersedes the "kept as-is" note recorded below under DEAD-019 — both sites are now adopted, not kept; `discord-worker`'s `utils/github-verify.ts` remains the one intentional holdout (GitHub imposes no minimum webhook-secret length).

### Removed (2026-08-18 dead-code audit)

- **DEAD-020**: `isJWTExpired(token)` and `getJWTTimeToExpiry(token)` removed from `jwt.ts` and the root barrel — documented in the README but had zero callers outside their own tests; `oauth`'s `jwt-service.ts` deleted its own copy of `isJWTExpired` back in the 2026-07-18 audit and never called this package's version.
- **DEAD-020**: `timingSafeEqualBytes(a, b)` removed from `timing.ts` and the root barrel — zero callers; every consumer uses the string-based `timingSafeEqual`, and all HMAC/JWT signature checks already route through the inherently timing-safe `crypto.subtle.verify()` instead. `timingSafeEqual` and the root `/encoding` re-exports are unaffected (KEEP).
- **DEAD-019 (adopt)**: `apps/oauth/src/services/jwt-service.ts`'s hand-rolled `getSigningKey`/`signJwtData`/`verifyJwtData` now delegate to this package's `hmacSign`/`hmacVerify` — verified byte-for-byte identical for `JWT_SECRET` (already enforced >= 32 bytes by oauth's own env validation, satisfying `createHmacKey`'s minimum-key-length check). `discord-worker`'s `services/preset-api.ts`/`utils/github-verify.ts` and `moderation-worker`'s `services/preset-api.ts` were evaluated for the same swap and **kept as-is**: their secrets (`BOT_SIGNING_SECRET`, `GITHUB_WEBHOOK_SECRET`) have no minimum-length requirement anywhere in this repo (existing tests use 17-20 character secrets), so `createHmacKey`'s `>= 32` byte floor would silently fail-closed in real deployments with a shorter secret. `hmacSign`/`hmacSignHex`/`hmacVerify`/`hmacVerifyHex` remain exported and are no longer zero-caller.

## [1.2.0] - 2026-07-19

2026-07-18 audit remediation (Sprints 2 & 6).

### Added

- JWT/session hardening from Sprint 2: `jti`-based revocation support and `orig_iat` absolute session anchoring used by the oauth worker's refresh rotation.

### Fixed

- **BUG-059**: `verifyDiscordRequest`'s authoritative body-size check measures UTF-8 **bytes** (`TextEncoder`) instead of UTF-16 code units — CJK/emoji payloads could previously exceed the intended byte cap by up to ~4× before the check fired.

## [1.1.2] - 2026-03-18

### Fixed

- **BUG-005**: HMAC CryptoKey cache now uses true LRU ordering — cache hits refresh entry position to prevent premature eviction of frequently-used keys

### Security

- **BUG-010**: Require `sub` claim in `verifyJWT()` and `verifyJWTSignatureOnly()` — reject tokens without a subject identity to prevent authorization bypass if JWT secret is compromised or tokens come from multiple issuers

---

## [1.1.1] - 2026-03-09

### Changed

- Updated `@upstash/redis` from 1.36.3 to 1.36.4 (fix: prevent multiple script init)
- Updated `@types/node` from 25.3.3 to 25.3.5

## [1.1.0] - 2026-02-21

### Security

- **FINDING-003**: Require `exp` claim in `verifyJWT` — reject tokens without expiration instead of treating them as never-expiring
- **FINDING-009**: Enforce 32-byte minimum key length in `createHmacKey` — reject weak secrets that undermine HMAC-SHA256 security

### Changed

- **REFACTOR-003**: Deduplicate JWT verification logic — extract shared `verifyJWTSignature()` helper used by both `verifyJWT()` and `verifyJWTSignatureOnly()`, eliminating ~30 lines of duplication

### Performance

- **OPT-002**: Cache `CryptoKey` objects at module level — eliminates redundant `crypto.subtle.importKey()` calls when the same HMAC secret is reused across requests within a Worker isolate

## [1.0.3] - 2026-02-21

### Changed

- Patch version bump for lint-only changes

## [1.0.2] - 2026-02-06

### Security

- **FINDING-001**: Replaced non-constant-time `!==` comparison with `crypto.subtle.verify()` in `verifyJWT()` and `verifyJWTSignatureOnly()`. Signature verification is now inherently timing-safe via the Web Crypto API
- **FINDING-002**: Replaced non-constant-time `===` comparison with `crypto.subtle.verify()` in `hmacVerify()`, consistent with the already-safe `hmacVerifyHex()` implementation
- Removed unused `base64UrlEncodeBytes` import from jwt.ts

---

## [1.0.0] - 2026-01-26

### Added
- Initial release of @xivdyetools/auth
- `verifyJWT()` - HMAC-SHA256 JWT verification with algorithm validation
- `verifyJWTSignatureOnly()` - Signature-only verification for refresh tokens
- `decodeJWT()` - Decode without verification (debugging only)
- `createHmacKey()` - Create HMAC-SHA256 CryptoKey
- `hmacSign()` - Sign data with HMAC-SHA256
- `hmacVerify()` - Verify HMAC-SHA256 signature
- `verifyBotSignature()` - Bot request signature verification with timestamp validation
- `timingSafeEqual()` - Constant-time string comparison utility
- `verifyDiscordRequest()` - Discord Ed25519 signature verification wrapper
- Multiple subpath exports for tree-shaking (`/jwt`, `/hmac`, `/timing`, `/discord`)
- Comprehensive test suite with security-focused test cases

### Security
- Algorithm validation prevents JWT confusion attacks (only accepts HS256)
- Timing-safe comparison prevents timing-based side-channel attacks
- Body size validation prevents DoS via large payloads
