# @xivdyetools/auth

Shared authentication utilities for the xivdyetools ecosystem. Provides secure JWT verification, HMAC signing, timing-safe comparison, and Discord signature verification.

## Installation

```bash
npm install @xivdyetools/auth
```

## Features

- **JWT Verification** - HMAC-SHA256 JWT verification with algorithm validation
- **HMAC Signing** - Create and verify HMAC-SHA256 signatures
- **Timing-Safe Comparison** - Constant-time string comparison to prevent timing attacks
- **Discord Verification** - Ed25519 signature verification for Discord interactions
- **Tree-Shakeable** - Subpath exports for minimal bundle size

## Usage

### JWT Verification

```typescript
import { verifyJWT, decodeJWT, isJWTExpired } from '@xivdyetools/auth';

// Verify JWT with signature and expiration checking
const payload = await verifyJWT(token, process.env.JWT_SECRET);
if (!payload) {
  // Invalid signature, expired, or wrong algorithm
}

// Decode without verification (debugging only)
const decoded = decodeJWT(token);

// Check if a token is expired — takes the raw token string, not a payload
if (isJWTExpired(token)) {
  // Token has expired
}
```

### Token Revocation

```typescript
import { isTokenRevoked, revokeToken } from '@xivdyetools/auth';

// Revoke a token by its `jti` claim. The store is any KV-like
// { get, put } — TTL is derived from the token's own expiry.
await revokeToken(payload.jti, payload.exp, env.KV);

// Check before honouring a token
if (await isTokenRevoked(payload.jti, env.KV)) {
  return new Response('Unauthorized', { status: 401 });
}
```

Both **fail open**: if the store is unavailable or absent, they return `false` rather than throwing, keeping auth functional during a KV outage. Callers needing strict revocation must handle store unavailability themselves.

### HMAC Signing

```typescript
import { hmacSign, hmacVerify, verifyBotSignature } from '@xivdyetools/auth';

// Sign data with HMAC-SHA256 (base64url output)
const signature = await hmacSign(data, secret);

// Verify signature
const isValid = await hmacVerify(data, signature, secret);

// Verify bot request signature (with timestamp validation)
const isValidBot = await verifyBotSignature(
  signature,    // X-Request-Signature header
  timestamp,    // X-Request-Timestamp header
  userDiscordId,
  userName,
  secret,
  { maxAgeMs: 5 * 60 * 1000 }  // Optional: 5 minute max age
);
```

### Timing-Safe Comparison

```typescript
import { timingSafeEqual } from '@xivdyetools/auth';

// Constant-time string comparison (prevents timing attacks)
const isEqual = await timingSafeEqual(userInput, expectedValue);
```

### Discord Signature Verification

```typescript
import { verifyDiscordRequest } from '@xivdyetools/auth';

// Verify Discord interaction signature
const result = await verifyDiscordRequest(request, env.DISCORD_PUBLIC_KEY);

if (!result.valid) {
  return new Response('Unauthorized', { status: 401 });
}

// result.body contains the parsed interaction
const interaction = result.body;
```

## Subpath Exports

Import only what you need for optimal tree-shaking:

```typescript
// JWT utilities only
import { verifyJWT, decodeJWT } from '@xivdyetools/auth/jwt';

// HMAC utilities only
import { hmacSign, hmacVerify } from '@xivdyetools/auth/hmac';

// Timing utilities only
import { timingSafeEqual } from '@xivdyetools/auth/timing';

// Discord utilities only
import { verifyDiscordRequest } from '@xivdyetools/auth/discord';

// Base64URL / hex encoding primitives only (no Discord module pulled in)
import { base64UrlEncode, base64UrlDecode, bytesToHex, hexToBytes } from '@xivdyetools/auth/encoding';
```

## API Reference

### JWT (`@xivdyetools/auth/jwt`)

| Function | Description |
|----------|-------------|
| `verifyJWT(token, secret)` | Verify JWT signature, algorithm (HS256 only), and expiration |
| `verifyJWTSignatureOnly(token, secret, maxAgeMs?)` | Verify signature only (for refresh token grace periods) |
| `decodeJWT(token)` | Decode JWT without verification (debugging only) |
| `isJWTExpired(token)` | Check if a token string is expired |
| `getJWTTimeToExpiry(token)` | Seconds until the token expires (`0` if expired or invalid) |

### HMAC (`@xivdyetools/auth/hmac`)

| Function | Description |
|----------|-------------|
| `createHmacKey(secret, usage)` | Create CryptoKey for HMAC operations |
| `hmacSign(data, secret)` | Sign data, return base64url signature |
| `hmacSignHex(data, secret)` | Sign data, return hex signature |
| `hmacVerify(data, signature, secret)` | Verify base64url signature |
| `hmacVerifyHex(data, signature, secret)` | Verify hex signature |
| `verifyBotSignature(sig, ts, userId, userName, secret, opts?)` | Verify bot request signature |

### Timing (`@xivdyetools/auth/timing`)

| Function | Description |
|----------|-------------|
| `timingSafeEqual(a, b)` | Constant-time string comparison |
| `timingSafeEqualBytes(a, b)` | Constant-time Uint8Array comparison |

### Discord (`@xivdyetools/auth/discord`)

| Function | Description |
|----------|-------------|
| `verifyDiscordRequest(request, publicKey, opts?)` | Verify Discord Ed25519 signature |
| `unauthorizedResponse(message?)` | Return 401 JSON response |
| `badRequestResponse(message)` | Return 400 JSON response |

### Revocation

| Function | Description |
|----------|-------------|
| `revokeToken(kv, jti, exp)` | Add a token's `jti` to the KV-backed blacklist until it expires |
| `isTokenRevoked(kv, jti)` | Check the blacklist before honouring a token |

### Encoding (`@xivdyetools/auth/encoding`)

| Function | Description |
|----------|-------------|
| `base64UrlEncode(input)` / `base64UrlDecode(input)` | Base64URL string codec |
| `base64UrlEncodeBytes(bytes)` / `base64UrlDecodeBytes(str)` | Base64URL byte codec |
| `bytesToHex(bytes)` / `hexToBytes(hex)` | Hex codec |

Absorbed from the retired `@xivdyetools/crypto` — see [`DEPRECATIONS.md`](../../DEPRECATIONS.md).

## Security Features

- **Algorithm Validation**: JWT verification only accepts HS256, preventing algorithm confusion attacks
- **Timing-Safe Comparison**: Uses `crypto.subtle.timingSafeEqual()` with XOR fallback
- **Timestamp Validation**: Bot signatures include clock skew tolerance and max age checks
- **Body Size Limits**: Discord verification enforces 100KB max body size by default

## Dependencies

**No internal dependencies.** Base64URL and hex encoding are built in under `@xivdyetools/auth/encoding` (absorbed from the retired `@xivdyetools/crypto`), so this package sits at Level 0 of the dependency graph.

| Package | Purpose |
|---------|---------|
| `discord-interactions` | Discord Ed25519 signature verification |
| `@cloudflare/workers-types` | Optional peer — `KVNamespace` / `Request` types in Worker contexts |

## Consumers

[`discord-worker`](../../apps/discord-worker/), [`presets-api`](../../apps/presets-api/), [`moderation-worker`](../../apps/moderation-worker/), and [`@xivdyetools/test-utils`](../test-utils/).

The [`oauth`](../../apps/oauth/) worker uses these primitives indirectly — it **issues** tokens rather than verifying them. This package deliberately does not issue JWTs; keeping it verify-only holds the surface exposed to every consuming worker small and audit-friendly.

## Connect With Me

**Flash Galatine** | Midgardsormr (Aether)

🎮 **FFXIV**: [Lodestone Character](https://na.finalfantasyxiv.com/lodestone/character/7677106/)
💻 **GitHub**: [@FlashGalatine](https://github.com/FlashGalatine)
🐦 **X/Twitter**: [@AsheJunius](https://x.com/AsheJunius)
📺 **Twitch**: [flashgalatine](https://www.twitch.tv/flashgalatine)
🌐 **BlueSky**: [projectgalatine.com](https://bsky.app/profile/projectgalatine.com)
❤️ **Patreon**: [ProjectGalatine](https://patreon.com/ProjectGalatine)
☕ **Ko-Fi**: [flashgalatine](https://ko-fi.com/flashgalatine)
💬 **Discord**: [Join Server](https://discord.gg/5VUSKTZCe5)

## License

MIT © 2025-2026 Flash Galatine — see [LICENSE](./LICENSE).

## Legal Notice

**FINAL FANTASY is a registered trademark of Square Enix Holdings Co., Ltd.**
**FINAL FANTASY XIV © SQUARE ENIX CO., LTD.**

XIV Dye Tools is an unofficial fan project and is **not affiliated with, endorsed by, or sponsored by Square Enix Co., Ltd.**
