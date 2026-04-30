# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package Overview

`@xivdyetools/crypto` is a tiny encoding-utility package: Base64URL (RFC 4648) and hexadecimal helpers for bytes ↔ string conversion. Both encoders are designed for cryptographic contexts — JWT segments, HMAC signatures, raw key material — where the URL-safe Base64 alphabet (`-_`, no padding) and lowercase hex are required.

The package exists separately from `@xivdyetools/auth` so that any consumer needing pure encoding (without pulling in JWT/HMAC/Discord verification logic) can depend on a minimal surface. It has zero internal dependencies, ships with `sideEffects: false`, and runs on any environment that exposes `btoa`/`atob` and the `TextEncoder`/`TextDecoder` globals (browsers, Node 18+, Cloudflare Workers).

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
pnpm turbo run build --filter=@xivdyetools/crypto
pnpm --filter @xivdyetools/crypto exec vitest run src/base64.test.ts
```

## Architecture

Two files, one entry point. There is no submodule layout because the package is small enough that everything lives at the root of `src/`.

### Key Directories

```
src/
├── base64.ts   # Base64URL encode/decode (RFC 4648, URL-safe, no padding)
├── hex.ts      # Lowercase hex ↔ Uint8Array
└── index.ts    # Re-exports both modules
```

## Public API

```typescript
// Base64URL (RFC 4648, URL-safe alphabet, no padding)
function base64UrlEncode(str: string): string;
function base64UrlEncodeBytes(bytes: Uint8Array): string;
function base64UrlDecode(str: string): string;
function base64UrlDecodeBytes(str: string): Uint8Array;

// Hexadecimal (lowercase output, accepts either case as input)
function hexToBytes(hex: string): Uint8Array;  // throws on odd length / invalid chars
function bytesToHex(bytes: Uint8Array): string;
```

There are no types or classes — every export is a pure function.

## Key Patterns

### Web-Crypto-only, no Node fallback

The implementations rely exclusively on platform globals — `btoa`, `atob`, `TextEncoder`, `TextDecoder`. There is **no** Node `Buffer` fallback. Node 18+ has all of these on `globalThis`, so this works uniformly across runtimes without conditionally importing `node:buffer`. If you ever need this to run on Node < 18, you'd add the fallback inside `base64.ts` rather than at the consumer.

### Base64URL specifics

`base64UrlEncodeBytes` produces the URL-safe Base64 form by post-processing standard `btoa` output:

```
btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
```

Decoding reverses this and re-pads to a multiple of 4 before calling `atob`. This is the format JWTs use for header/payload/signature segments.

### Hex validation

`hexToBytes` enforces:
- Even length (throws `'Hex string must have even length'`)
- Only `[0-9a-fA-F]` characters (throws `'Invalid hex character'`)

`bytesToHex` always returns lowercase. If you need uppercase, uppercase the result at the call site.

## Consumers

Grepped from `package.json` files in the monorepo:

- Packages: `@xivdyetools/auth` (its only direct dependency)
- Apps: `xivdyetools-presets-api`, `xivdyetools-oauth`
- Test-only: `@xivdyetools/test-utils`

`@xivdyetools/auth` is the primary consumer — every JWT/HMAC operation routes through these encoders. The apps that depend directly typically use `bytesToHex`/`hexToBytes` for handling tokens stored in cookies or headers outside the auth helpers.

## Internal Dependencies

None. This package is Level 0 in the dependency graph.

## Publishing

```bash
# 1. Make changes in packages/crypto/
# 2. Build and test
pnpm turbo run build test --filter=@xivdyetools/crypto

# 3. Bump version in packages/crypto/package.json
# 4. Publish
pnpm --filter @xivdyetools/crypto publish --provenance --access public --no-git-checks
```

`prepublishOnly` runs `clean` then `build` automatically. The package surface is tiny and stable — most version bumps will be patches.
