# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`xivdyetools-image-worker` is a Cloudflare Worker that decodes an image URL and returns its raw
RGBA pixels using `@cf-wasm/photon`. It exists for exactly one reason: `@cf-wasm/photon` is a
1.5 MiB WASM library used by a single feature (`discord-worker`'s `/extractor` command), and
carrying it inside `discord-worker` pushed that Worker's gzipped bundle to 3,209.3 KiB — over
Cloudflare's 3 MiB free-plan limit, so it could not deploy at all. Splitting photon out here
dropped `discord-worker` to 2,589.70 KiB gzipped (482 KiB headroom); this Worker itself measures
639.35 KiB gzipped (1,648.82 KiB raw). See `docs/operations/IMAGE_WORKER_SPLIT.md` for the full
rationale and measurements.

**It has no public surface.** `workers_dev = false` in `[env.production]` and there are no
routes — the only way to reach it is `discord-worker`'s `IMAGE_WORKER` service binding. It holds
no secrets and no storage bindings (KV/D1/R2); it is the smallest operational footprint in the
monorepo.

## Commands

```bash
pnpm dev                    # wrangler dev
pnpm deploy                 # Deploy to staging (default env)
pnpm deploy:production      # Deploy to env.production
pnpm test                   # vitest run
pnpm test:watch             # vitest in watch mode
pnpm test:coverage          # vitest run --coverage
pnpm type-check             # tsc --noEmit
pnpm lint                   # eslint src
```

### Pre-commit Checklist

```bash
pnpm lint && pnpm test && pnpm type-check
```

## Architecture

### Request Flow

```
discord-worker ──Service Binding──► POST /extract
                                          │
                                          ▼
                              validateAndFetchImage(url)   (validators.ts)
                                  ├─ SSRF allowlist check (Discord CDN only)
                                  ├─ fetch with 10s timeout, one manual redirect hop
                                  ├─ file-size check (10 MB max)
                                  └─ magic-byte format check (png/jpeg/gif/webp/bmp)
                                          │
                                          ▼
                              processImageForExtraction(buffer)   (photon.ts)
                                  ├─ PhotonImage.new_from_byteslice
                                  ├─ resize to maxDimension (default 256), aspect preserved
                                  ├─ extract raw RGBA pixels
                                  └─ .free() both PhotonImage instances
                                          │
                                          ▼
                              200: raw bytes  +  X-Image-Width / X-Image-Height headers
                              4xx: { error: <verbatim thrown message> }
```

### Key Directories

```
src/
├── index.ts        # Hono app: GET /health, POST /extract
├── types.ts        # Env (no bindings) + UrlValidationResult/FormatValidationResult/ImageFormat
├── validators.ts   # SSRF allowlist, size/dimension/format checks, timeout fetch
└── photon.ts        # loadImage / resizeImage / extractPixels / processImageForExtraction
```

### The `POST /extract` contract

```
POST /extract
  body: { url: string, maxDimension?: number }

200 → body:    raw RGBA bytes (binary, not base64 — a service binding passes
                Request/Response objects directly, so base64 would only cost
                33% for no benefit)
      headers: X-Image-Width, X-Image-Height, Content-Type: application/octet-stream

400 → body:    { error: string }   — see "The error contract is verbatim" below
```

**The error contract is verbatim.** `discord-worker`'s `extractor.ts` substring-matches the
`error` field against all five fragments `'SSRF'`, `'Discord CDN'`, `'too large'`, `'format'`,
`'timeout'` (source of truth: `apps/discord-worker/src/handlers/commands/extractor.ts:536-543`)
to choose a localized user-facing message. `index.ts`'s `catch` block returns `error.message`
unmodified for every thrown `Error` (only non-`Error` throws fall back to a generic message).
**Never reword, truncate, or generalize an error message thrown from `validators.ts` or
`photon.ts`** — doing so silently breaks the caller's message-matching without failing any type
check.

### Response size bound

`DEFAULT_MAX_DIMENSION` in `photon.ts` is **256**. When the caller omits `maxDimension`,
`processImageForExtraction` resizes to that default before extracting pixels, so the response
body is bounded at 256 × 256 × 4 bytes = **256 KiB** regardless of the 10 MB input-file limit
(`MAX_FILE_SIZE_BYTES` in `validators.ts`). `discord-worker`'s `image-client.ts` does not pass
`maxDimension`, so this default is what production traffic actually gets; a caller that does
supply a larger `maxDimension` receives a proportionally larger response, since `index.ts` passes
the request body's value through to the processor unvalidated.

### Environment Bindings (wrangler.toml)

None. `types.ts`'s `Env` interface carries only the inert `ENVIRONMENT` var (set by
`[env.production]`, unused at runtime — `loggerMiddleware` is configured with
`readEnvironmentFromEnv: false`). No KV, D1, R2, Analytics, or Service Bindings outbound.

### Required Secrets / Optional Secrets

None. This Worker has no secrets — it fetches only from an SSRF-restricted allowlist
(`cdn.discordapp.com`, `media.discordapp.net`) and returns pixel data, nothing that needs
authenticating.

## Key Patterns

### SSRF Protection

`validateImageUrl()` (`validators.ts`) only allows `https:` URLs whose hostname is exactly
`cdn.discordapp.com` or `media.discordapp.net`. `isPrivateHost()` additionally blocks every IP
literal (v4 and v6), cloud metadata endpoints (`169.254.169.254`, GCP/Azure metadata hostnames),
and the standard private/loopback/link-local ranges — defense in depth, since Discord CDN never
resolves to those. Redirects are followed manually (`redirect: 'manual'`), one hop only, and the
redirect target is validated through the same allowlist before being followed.

### WASM Memory Management

`@cf-wasm/photon`'s `PhotonImage` instances are not garbage-collected — `processImageForExtraction`
`.free()`s both the original and resized image in a `finally` block (guarding against the
original/resized image being the same reference when no resize was needed) so a Worker isolate
handling many requests does not leak WASM memory toward the 128 MB limit.

### What is actually bounded on the request path

Two limits are enforced before pixels are ever extracted: the 10 MB file size
(`MAX_FILE_SIZE_BYTES`, checked against both the `Content-Length` header and the fetched buffer
in `validators.ts`) and the 10-second fetch timeout (`FETCH_TIMEOUT_MS`, via `AbortController`).
Input dimensions are not separately capped — `validators.ts` also exports `validateDimensions`,
`MAX_IMAGE_DIMENSION` (4096) and `MAX_PIXEL_COUNT` (16 megapixels), but nothing in the `/extract`
route calls `validateDimensions`; a large source image is instead brought down to size by the
unconditional resize step in `photon.ts`, and the request body's `maxDimension` is passed through
to that resize without runtime validation (a non-default value is honored as-is).

## Dependencies

| Package | Purpose |
|---------|---------|
| `hono` | HTTP framework |
| `@cf-wasm/photon` | Image decode/resize/pixel-extraction (WASM) — the entire reason this Worker exists |
| `@xivdyetools/logger` | Structured logging |
| `@xivdyetools/worker-kit` | `requestIdMiddleware`, `loggerMiddleware` |

## Related Projects

**Dependencies:** `@xivdyetools/logger`, `@xivdyetools/worker-kit`

**Service Bindings (outbound):** None.

**Service Bindings (inbound):** `xivdyetools-discord-worker` calls `POST /extract` via its
`IMAGE_WORKER` binding — the *only* caller.

**Sibling:** `xivdyetools-discord-worker` (the split's origin — see
`docs/operations/IMAGE_WORKER_SPLIT.md` for why photon moved out).

## Deployment Checklist

**Deploy order is load-bearing.** This Worker must be deployed *before* `discord-worker`, or
`discord-worker`'s `IMAGE_WORKER` service binding fails to resolve (the reverse order is
harmless — an old bot alongside a new image Worker simply doesn't call it yet).

1. `pnpm lint && pnpm test && pnpm type-check` — must be green.
2. `pnpm deploy:production` (or via CI: `.github/workflows/deploy-image-worker.yml`).
3. Deploy `discord-worker` and smoke-test `/extractor` with a real Discord attachment — there is
   no public health endpoint on this Worker to check directly.
