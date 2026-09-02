# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

This package is now gated on the monorepo's `knip` dead-code check (`pnpm run lint:dead`, folded
into `lint`; root `knip.jsonc`). Because `@xivdyetools/auth` sits at its registry version (2.0.0),
nothing was removed — the first run found 17 barrel exports (9 values, 8 types) with no in-repo
consumer, all at `src/index.ts`. Four of the nine values (`base64UrlDecode`, `base64UrlDecodeBytes`,
`hexToBytes`, `bytesToHex`) are misleading at a glance: their implementations are very much in
production use (`apps/moderation-worker/src/handlers/modals/ban-reason.ts`,
`apps/oauth/src/services/jwt-service.ts`), but every live consumer imports them via the
`@xivdyetools/auth/encoding` subpath, not this root barrel — so the root re-export specifier is
genuinely unreferenced and is tagged `@public` rather than deleted, same as the other thirteen.

## [2.0.0] - 2026-08-31

Security audit remediation (docs/audits/2026-08-29-security, FINDING-015) — finishes the bot
signature rollover that 1.4.0 started. **BREAKING**: this is the package's first MAJOR release —
a public export is gone.

### Removed

- **`verifyBotSignature`** (v1 bot request signature: `${timestamp}:${userDiscordId}:${userName}`,
  hex HMAC-SHA256, 5-minute freshness window, no binding to method/path/body) is deleted from
  `hmac.ts` and the package barrel. `createBotSignatureV2` / `verifyBotSignatureV2` (FINDING-014,
  1.4.0) have been the **only** accepted bot signature since `presets-api` 2.2.0 (2026-08-30);
  `discord-worker` 5.1.0 and `moderation-worker` 1.6.0 stopped *sending* v1 the same day. No code
  in this monorepo referenced `verifyBotSignature` before this release, so the removal is a no-op
  in-repo — the entire cost lands on npm consumers outside this workspace.

  **Migration:** replace a `verifyBotSignature(sig, ts, userId, userName, secret, opts?)` call with
  `verifyBotSignatureV2(sig, req, secret, opts?)`, where `req` is a `BotSignatureV2Request` object —
  it still carries `timestamp`, `userDiscordId` and `userName`, but now also `method`, `path`,
  `body` and an optional `nonce`, none of which v1 bound at all:

  ```typescript
  // v1 (gone)
  const ok = await verifyBotSignature(sigHeader, tsHeader, userId, userName, secret);

  // v2
  const ok = await verifyBotSignatureV2(
    req.headers.get('X-Request-Signature-V2'),
    {
      method: req.method,
      path: new URL(req.url).pathname,        // no origin, no query
      body: await req.clone().arrayBuffer(),  // omit for GET/HEAD
      timestamp: req.headers.get('X-Request-Timestamp') ?? undefined,
      nonce: req.headers.get('X-Request-Nonce') ?? undefined,
      userDiscordId: req.headers.get('X-User-Discord-ID') ?? undefined,
      userName: req.headers.get('X-User-Discord-Name') ?? undefined,
    },
    secret
  );
  ```

  On the signing side, replace whatever produced the old `X-Request-Signature` header with
  `createBotSignatureV2(req, secret)`, and send its result as `X-Request-Signature-V2` alongside
  `X-Request-Nonce` — `X-Request-Signature` is no longer read by anything in this ecosystem.
  `BotSignatureOptions` (`maxAgeMs` / `clockSkewMs`) is unchanged and still accepted by
  `verifyBotSignatureV2`; only its effective default tightened, from v1's 5-minute window to v2's
  own default of `BOT_SIGNATURE_V2_MAX_AGE_MS` (60 s) — a narrower freshness window that a
  caller-implemented nonce-replay check can fit inside, since a single-use nonce is only useful
  for as long as its signature is.

  **This package does not implement that replay check.** `verifyBotSignatureV2` binds `nonce`
  into the signed string — a captured request can't be replayed with a different nonce — but
  never checks whether a given nonce has been seen before; migrating from v1 to v2 buys full
  request binding (method, path, body, timestamp, nonce, identity) and nothing else. A caller
  wanting single-use enforcement has to keep its own store for the 60 s window (this monorepo's
  is `presets-api`'s, a KV-backed `botnonce:` cache — not part of this package).

  A consumer with no immediate path to v2 must pin `@xivdyetools/auth@^1` — 1.4.0 stays on the
  registry with `verifyBotSignature` intact.

## [1.4.0] - 2026-08-21

Security audit remediation (docs/audits/2026-08-21-security, FINDING-001 / FINDING-015). Minor bump: additive API, one behavioural change in `revokeToken` TTLs.

### Security

- **`revokeToken()` now keeps blacklist entries alive for `exp + REFRESH_GRACE_SECONDS`** (new exported constant, 15 min) instead of ending exactly at `exp`. The oauth worker's `/auth/refresh` honours tokens for a grace window past `exp`; with the old TTL a revoked token became refreshable the moment it expired (FINDING-001). Both sides now share the same constant. New `RevokeTokenOptions.graceSeconds` for callers that override the window.
- **`verifyJWT` / `verifyJWTSignatureOnly` validate claim types** (FINDING-015): `exp` must be a finite numeric date, `sub` a non-empty string, `iat`/`nbf` numeric when present; a signed `exp: "9999999999"` or `sub: {}` is rejected instead of comparing as strings/objects. `verifyJWT` also enforces `nbf` (with optional `clockToleranceSeconds`), and accepts new `issuer` (string or list) and `audience` options that pin `iss`/`aud`.

- **Bot request signature v2** (FINDING-014): `createBotSignatureV2` / `verifyBotSignatureV2` bind `method`, URL `path`, SHA-256 of the body, timestamp, an optional nonce and the identity headers with a length-prefixed canonical string (v1 signed only `timestamp:userId:userName` with an ambiguous `:` delimiter — `(123,"a:b")` ≡ `("123:a","b")`) and a 60 s window (`BOT_SIGNATURE_V2_MAX_AGE_MS`). Header names `BOT_SIGNATURE_V2_HEADER` (`X-Request-Signature-V2`) / `BOT_SIGNATURE_NONCE_HEADER` (`X-Request-Nonce`). `verifyBotSignature` (v1) is unchanged for rollover.
- **`verifyDiscordRequest` enforces timestamp freshness** (FINDING-021): `X-Signature-Timestamp` older than `DEFAULT_DISCORD_MAX_TIMESTAMP_AGE_SECONDS` (300) or more than 60 s in the future is rejected before the body is read; `DiscordVerifyOptions.maxTimestampAgeSeconds` / `.maxFutureSkewSeconds` override.

### Added

- `REFRESH_GRACE_SECONDS`, `RevokeTokenOptions`, `VerifyJWTOptions.issuer` / `.audience` / `.clockToleranceSeconds`, `JWTPayload.nbf` / `.aud`, `createBotSignatureV2`, `verifyBotSignatureV2`, `BotSignatureV2Request`, `BOT_SIGNATURE_V2_MAX_AGE_MS`, `BOT_SIGNATURE_V2_HEADER`, `BOT_SIGNATURE_NONCE_HEADER`, `DEFAULT_DISCORD_MAX_TIMESTAMP_AGE_SECONDS`.

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
- **DEAD-019 (adopt)**: `apps/oauth/src/services/jwt-service.ts`'s hand-rolled `getSigningKey`/`signJwtData`/`verifyJwtData` now delegate to this package's `hmacSign`/`hmacVerify` — verified byte-for-byte identical for `JWT_SECRET` (already enforced >= 32 bytes by oauth's own env validation, satisfying `createHmacKey`'s minimum-key-length check). `discord-worker`'s `services/preset-api.ts`/`utils/github-verify.ts` and `moderation-worker`'s `services/preset-api.ts` were evaluated for the same swap and **kept as-is**: their secrets (`BOT_SIGNING_SECRET`, `GITHUB_WEBHOOK_SECRET`) have no minimum-length requirement anywhere in this repo (existing tests use 17-20 character secrets), so `createHmacKey`'s `>= 32` byte floor would silently fail-closed in real deployments with a shorter secret. `hmacSign`/`hmacSignHex`/`hmacVerify`/`hmacVerifyHex` remain exported and are no longer zero-caller. **(superseded 2026-08-18 — see Changed above: both `preset-api.ts` sites now use `hmacSignHex`.)**

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
