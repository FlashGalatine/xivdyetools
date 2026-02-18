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

// Check if JWT is expired
if (isJWTExpired(payload)) {
  // Token has expired
}
```

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
```

## API Reference

### JWT (`@xivdyetools/auth/jwt`)

| Function | Description |
|----------|-------------|
| `verifyJWT(token, secret)` | Verify JWT signature, algorithm (HS256 only), and expiration |
| `verifyJWTSignatureOnly(token, secret, maxAgeMs?)` | Verify signature only (for refresh token grace periods) |
| `decodeJWT(token)` | Decode JWT without verification (debugging only) |
| `isJWTExpired(payload)` | Check if JWT payload is expired |
| `getJWTTimeToExpiry(payload)` | Get milliseconds until JWT expires |

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
| `unauthorizedResponse()` | Return 401 response |
| `badRequestResponse(message?)` | Return 400 response |

## Security Features

- **Algorithm Validation**: JWT verification only accepts HS256, preventing algorithm confusion attacks
- **Timing-Safe Comparison**: Uses `crypto.subtle.timingSafeEqual()` with XOR fallback
- **Timestamp Validation**: Bot signatures include clock skew tolerance and max age checks
- **Body Size Limits**: Discord verification enforces 100KB max body size by default

## Dependencies

- `@xivdyetools/crypto` - Base64URL and hex encoding utilities
- `discord-interactions` - Discord Ed25519 signature verification

## License

MIT
