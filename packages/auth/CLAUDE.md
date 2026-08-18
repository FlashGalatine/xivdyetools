# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package Overview

`@xivdyetools/auth` consolidates the authentication primitives shared by every secured Cloudflare Worker in the ecosystem:

- **JWT verification** (HS256-only, signature + expiration + `sub` claim)
- **HMAC-SHA256 signing/verification** with a module-level `CryptoKey` LRU cache
- **Bot signature verification** for inter-worker calls (`timestamp:userId:userName`)
- **Discord Ed25519 signature verification** for HTTP Interactions endpoints
- **Timing-safe equality** with native `crypto.subtle.timingSafeEqual` and a manual XOR fallback

This package intentionally does **not** issue JWTs — that responsibility lives in the `oauth` worker. By only verifying, the surface area exposed to every consuming worker stays small and audit-friendly.

## Commands

```bash
pnpm build         # tsc -p tsconfig.build.json
pnpm test          # vitest run
pnpm test:watch    # vitest
pnpm test:coverage # vitest run --coverage
pnpm type-check    # tsc --noEmit
pnpm lint          # eslint src
pnpm clean         # rimraf dist
```

### Run from monorepo root

```bash
pnpm turbo run build --filter=@xivdyetools/auth
pnpm --filter @xivdyetools/auth exec vitest run src/jwt.test.ts
```

## Architecture

Five single-responsibility modules under `src/` plus an `encoding/` directory, all behind a barrel `index.ts`. Every one has its own subpath export (`/jwt`, `/hmac`, `/timing`, `/discord`, `/revocation`, `/encoding`) so consumers can import a focused slice — `/encoding` in particular exists so a caller that only needs Base64URL/hex helpers doesn't pull in `discord-interactions`.

### Key Directories

```
src/
├── jwt.ts        # verifyJWT, verifyJWTSignatureOnly, decodeJWT
├── hmac.ts       # createHmacKey, hmacSign(Hex), hmacVerify(Hex), verifyBotSignature, getOrCreateHmacKey (internal LRU)
├── timing.ts     # timingSafeEqual
├── discord.ts    # verifyDiscordRequest, unauthorizedResponse, badRequestResponse
├── revocation.ts # isTokenRevoked, revokeToken (KV-backed jti blacklist)
└── encoding/     # base64.ts + hex.ts — Base64URL/hex primitives (absorbed from @xivdyetools/crypto)
```

## Public API

### JWT (`@xivdyetools/auth/jwt`)

```typescript
interface JWTPayload {
  sub: string;       // Discord user ID
  iat: number;
  exp: number;
  type: 'access' | 'refresh';
  username?: string;
  avatar?: string | null;
}

function verifyJWT(token: string, secret: string): Promise<JWTPayload | null>;
function verifyJWTSignatureOnly(token: string, secret: string, maxAgeMs?: number): Promise<JWTPayload | null>;
function decodeJWT(token: string): JWTPayload | null;  // no signature check
```

### HMAC (`@xivdyetools/auth/hmac`)

```typescript
interface BotSignatureOptions {
  maxAgeMs?: number;      // default 5 min
  clockSkewMs?: number;   // default 1 min
}

function createHmacKey(secret: string, usage?: 'sign' | 'verify' | 'both'): Promise<CryptoKey>;
function hmacSign(data: string, secret: string): Promise<string>;     // base64url
function hmacSignHex(data: string, secret: string): Promise<string>;  // hex
function hmacVerify(data: string, signature: string, secret: string): Promise<boolean>;
function hmacVerifyHex(data: string, signature: string, secret: string): Promise<boolean>;
function verifyBotSignature(
  signature: string | undefined,
  timestamp: string | undefined,
  userDiscordId: string | undefined,
  userName: string | undefined,
  secret: string,
  options?: BotSignatureOptions
): Promise<boolean>;
```

### Timing-safe (`@xivdyetools/auth/timing`)

```typescript
function timingSafeEqual(a: string, b: string): Promise<boolean>;
```

### Discord (`@xivdyetools/auth/discord`)

```typescript
interface DiscordVerificationResult { isValid: boolean; body: string; error?: string }
interface DiscordVerifyOptions { maxBodySize?: number }  // default 100_000

function verifyDiscordRequest(request: Request, publicKey: string, options?: DiscordVerifyOptions): Promise<DiscordVerificationResult>;
function unauthorizedResponse(message?: string): Response;  // 401 JSON
function badRequestResponse(message: string): Response;     // 400 JSON
```

### Revocation (`@xivdyetools/auth/revocation`)

```typescript
interface RevocationStore { /* the KV surface actually used — get/put */ }

function isTokenRevoked(jti: string, store: RevocationStore | undefined): Promise<boolean>;
function revokeToken(jti: string, expiresAt: number, store: RevocationStore | undefined): Promise<boolean>; // expiresAt = unix seconds; TTL = max(expiresAt - now, 60)
```

A `jti` blacklist rather than a whitelist: only revoked tokens are stored, with a TTL matching the token's remaining lifetime, so the keyspace stays bounded without a sweep job. The store is passed in as an interface rather than a `KVNamespace` so tests need no Workers types.

### Encoding (`@xivdyetools/auth/encoding`)

```typescript
function base64UrlEncode(str: string): string;
function base64UrlEncodeBytes(bytes: Uint8Array): string;
function base64UrlDecode(str: string): string;
function base64UrlDecodeBytes(str: string): Uint8Array;
function hexToBytes(hex: string): Uint8Array;
function bytesToHex(bytes: Uint8Array): string;
```

Absorbed from the retired `@xivdyetools/crypto`. Import from this subpath, not the barrel — the root re-export drags in `discord-interactions`.

## Key Patterns

### Algorithm pinning (HS256 only)

`verifyJWT` and `verifyJWTSignatureOnly` decode the header, parse `alg`, and reject anything other than `'HS256'`. This blocks the classic "alg confusion" attack where a token specifies `alg: none` or `alg: RS256` to bypass HMAC verification:

```typescript
if (header.alg !== 'HS256') return null;
```

`verifyJWT` additionally enforces `exp` (FINDING-003 — tokens without expiration are rejected) and `sub` (BUG-010 — tokens without subject identity are rejected). `verifyJWTSignatureOnly` is for refresh-token paths where you want signature validity but a longer grace window via `maxAgeMs` from `iat`.

### Signature verification flow

All HMAC and JWT verification routes through `crypto.subtle.verify('HMAC', key, signatureBytes, dataBytes)` rather than computing-then-comparing strings. The native `subtle.verify` is itself timing-safe — comparison happens inside the crypto implementation, not in JS — so no separate `timingSafeEqual` call is needed.

### CryptoKey LRU cache (OPT-002)

`getOrCreateHmacKey(secret, usage)` is module-internal but used by every sign/verify path. It caches up to 10 `CryptoKey` instances keyed by `${secret}:${usage}`. On hit, the entry is `delete`d and re-`set` to refresh LRU position (BUG-005). On miss with a full cache, the oldest entry (first key via `Map.keys().next()`) is evicted. This eliminates redundant `crypto.subtle.importKey()` per request in long-running isolates.

`createHmacKey` enforces `keyData.length >= 32` bytes (HMAC-SHA256 minimum, FINDING-009) and throws otherwise.

### Bot signature format

Inter-worker calls (e.g. `presets-api → discord-worker` notifications) use:

```
message  = `${timestamp}:${userDiscordId ?? ''}:${userName ?? ''}`
signature = hmacSignHex(message, BOT_SIGNING_SECRET)
```

`verifyBotSignature` checks signature presence, timestamp parses to a number, age ≤ `maxAgeMs` (default 5 min), and that the timestamp isn't more than `clockSkewMs` (default 1 min) in the future. `userDiscordId` and `userName` are optional for system-level requests; both empty strings are allowed in the message.

### Discord Ed25519 verification

`verifyDiscordRequest` wraps `discord-interactions`' `verifyKey` with extra hardening:

1. `Content-Length` check before reading the body (rejects oversized requests early)
2. Required headers check (`X-Signature-Ed25519`, `X-Signature-Timestamp`)
3. Actual body length check after reading (Content-Length is spoofable)
4. `verifyKey(body, signature, timestamp, publicKey)`

The result includes `body` so the caller doesn't have to re-read the request stream after verification.

### Timing-safe with native fallback

`timingSafeEqual` uses `crypto.subtle.timingSafeEqual` (Cloudflare Workers) when available and falls back to a constant-time XOR loop otherwise. Both arrays are zero-padded to `max(a.length, b.length)` before comparison so the loop runtime doesn't leak length information. The function still returns `false` if the original lengths differed.

## Consumers

Grepped from `package.json` files in the monorepo:

- Apps: `xivdyetools-discord-worker`, `xivdyetools-presets-api`, `xivdyetools-moderation-worker`, `xivdyetools-oauth-worker`

The `oauth` worker issues tokens itself (it does not call `verifyJWT` for issuance) but consumes `verifyJWTSignatureOnly`, `decodeJWT`, `isTokenRevoked`, `revokeToken`, `hmacSign`/`hmacVerify` (2026-08-18 dead-code audit — DEAD-019 adoption replaced a hand-rolled base64url HMAC pair) and the `/encoding` primitives from this package (`apps/oauth/src/services/jwt-service.ts`).

`discord-worker`'s `services/preset-api.ts`/`utils/github-verify.ts` and `moderation-worker`'s `services/preset-api.ts` keep their own hand-rolled HMAC (2026-08-18 audit, DEAD-019: not adopted) — `createHmacKey`'s `>= 32` byte minimum (FINDING-009) would silently fail-closed for `BOT_SIGNING_SECRET`/`GITHUB_WEBHOOK_SECRET`, which have no length floor anywhere in this repo (existing tests use 17-20 character secrets).

## Internal Dependencies

- None — the encoding primitives (`base64UrlEncode/Decode/Bytes`, `bytesToHex`, `hexToBytes`) live in `src/encoding/`, absorbed from the retired `@xivdyetools/crypto` (v1.3.0). Import via `@xivdyetools/auth/encoding` to avoid pulling the Discord verification module.
- External: `discord-interactions` (Ed25519 verification)
- Optional peer: `@cloudflare/workers-types` (only for the `KVNamespace`/`Request` types when used in worker contexts)

## Publishing

Publishing goes through the **Publish Packages to npm** GitHub Actions workflow, which authenticates via npm trusted publishing (OIDC). There is no npm token — see the root `CLAUDE.md` for the full flow and the break-glass local path.

```bash
# 1. Make changes in packages/auth/
# 2. Build and test
pnpm turbo run build test --filter=@xivdyetools/auth

# 3. Bump version in packages/auth/package.json and merge to main
# 4. Actions → "Publish Packages to npm" → package: @xivdyetools/auth
```

Security-sensitive changes here cascade to every secured worker — coordinate consumer bumps in the same PR and prefer additive changes over breaking signature shifts.
