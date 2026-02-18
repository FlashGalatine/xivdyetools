# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
