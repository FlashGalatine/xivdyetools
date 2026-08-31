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

**It has no public surface.** `workers_dev = false` and `preview_urls = false` in both
environments, and there are no routes anywhere — the only way to reach it is an `IMAGE_WORKER`
service binding. `src/wrangler-config.test.ts` now pins that shape (2026-08-29 FINDING-023), so a
config flip fails `pnpm test` instead of relying on a comment; a request that still reaches this
Worker on a `*.workers.dev` hostname is refused with a `404` before any body read, fetch, or
decode, as defence in depth. It holds no secrets and no storage bindings (KV/D1/R2); it is the
smallest operational footprint in the monorepo.

It has since become the monorepo's general photon host rather than a single-caller split. Two
endpoints, two callers:

| Route | Caller | Returns |
|---|---|---|
| `POST /extract` | `discord-worker` `/extractor` | raw RGBA pixels for palette extraction |
| `POST /thumbnail` | `presets-api` preview-image upload | a cropped WebP |

Adding a photon-backed feature anywhere in the monorepo means adding a route here, not a second
copy of the WASM blob — that is the whole point of the split.

## Commands

```bash
pnpm dev                    # wrangler dev
pnpm deploy                 # Publishes the default (top-level) env — see note below
pnpm deploy:production      # Deploy to env.production
pnpm test                   # vitest run
pnpm test:watch             # vitest in watch mode
pnpm test:coverage          # vitest run --coverage
pnpm type-check             # tsc --noEmit
pnpm lint                   # eslint src
```

**`pnpm deploy` does not give you a usable staging instance.** The default env exists
solely so a bare `wrangler deploy` can never touch production — it publishes under the
`xivdyetools-image-worker-dev` name with `workers_dev = false` and no routes, so the
result has no reachable URL and nothing binds to it. To actually exercise this Worker,
deploy `env.production` (`pnpm deploy:production`) and call it through `discord-worker`'s
`IMAGE_WORKER` service binding — there is no standalone way to hit `/extract` from
outside that path.

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
├── index.ts        # Hono app: GET /health, POST /extract, POST /thumbnail
├── types.ts        # Env (no bindings) + UrlValidationResult/FormatValidationResult/ImageFormat
├── validators.ts   # SSRF allowlist, size/dimension/format checks, timeout fetch
└── photon.ts       # loadImage / resizeImage / crop / extractPixels
                    # + processImageForExtraction, processImageForThumbnail, computeCropBox
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

### The `POST /thumbnail` contract

```
POST /thumbnail
  body: raw image bytes (NOT JSON, and NOT a URL — the caller already holds the upload)

200 → body:    WebP bytes, Content-Type: image/webp
400 → body:    { error: string }   — empty body, or photon could not decode
```

Unlike `/extract`, this route takes **bytes, not a URL**, so none of the SSRF/size/format
validators in `validators.ts` run on it: `presets-api` has already received and bounded the
upload, and nothing here fetches anything. The only guard is the empty-body check.

`processImageForThumbnail` crops to the 640 × 264 band (`THUMBNAIL_WIDTH`/`THUMBNAIL_HEIGHT`,
aspect ≈ 2.42) via `computeCropBox`, resizes with Lanczos3, and encodes WebP. `computeCropBox`
takes the largest centred region matching the target aspect, so a portrait source is cropped
rather than letterboxed.

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

### Public-Surface Guard (FINDING-023, 2026-08-29 security audit)

This Worker's entire security model rests on having no public surface — `workers_dev = false`
and `preview_urls = false` in both environments, no routes ever, service-binding-only. That
invariant used to be enforced by nothing but a `wrangler.toml` comment; `src/wrangler-config.test.ts`
now pins it (no `routes` anywhere or by inheritance, `workers_dev`/`preview_urls` explicit
`false` in both environments, exactly one named environment, and — the cross-worker contract —
that production's `name` is exactly what both discord-worker's and presets-api's `IMAGE_WORKER`
service bindings point at, in every one of their own environments).

As defence in depth (not the primary control), `index.ts` also refuses any request whose URL
hostname ends in `.workers.dev`, for every route including `/health`, before any body read,
fetch, or decode. Both callers reach this Worker only through a Service Binding — they construct
`new Request('https://image-worker/<path>', …)`, a URL never resolved over DNS — so a
`*.workers.dev` hostname can only mean a real public request, which is only reachable if
`workers_dev` is ever flipped on by mistake. The refusal is a plain `404` (Hono's own
unmatched-route response, via `c.notFound()`) rather than a `403`: a flipped deployment should
still look exactly like the routeless worker it is supposed to be, not confirm to a scanner that
something is being deliberately gatekept.

**The guard and the config test cover different axes of the same invariant, and neither
substitutes for the other.** The hostname guard only ever sees a `*.workers.dev` hostname —
exactly what a `workers_dev` flip produces. It cannot see a `routes` addition: a route (e.g.
`route = { pattern = "img.xivdyetools.app", custom_domain = true }`) makes this Worker publicly
reachable on a *real* custom-domain hostname, which never ends in `.workers.dev` and sails
straight past the guard into `validateAndFetchImage`. Only `src/wrangler-config.test.ts` — which
asserts no `routes` exist in any spelling wrangler accepts — covers that axis.

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
| `@xivdyetools/worker-kit` | `requestIdMiddleware`, `loggerMiddleware` (structured logging arrives transitively via `@xivdyetools/logger`, not declared directly — see `apps/og-worker` for the same pattern) |

## Related Projects

**Dependencies:** `@xivdyetools/worker-kit`

**Service Bindings (outbound):** None.

**Service Bindings (inbound):** two callers, both over an `IMAGE_WORKER` binding —
`xivdyetools-discord-worker` calls `POST /extract`, `xivdyetools-presets-api` calls
`POST /thumbnail`.

**Siblings:** `xivdyetools-discord-worker` (the split's origin — see
`docs/operations/IMAGE_WORKER_SPLIT.md` for why photon moved out) and
`xivdyetools-presets-api` (preview images).

## Deployment Checklist

**Deploy order is load-bearing.** This Worker must be deployed *before* its callers, or their
`IMAGE_WORKER` service bindings fail to resolve (the reverse order is harmless — an old caller
alongside a new image Worker simply doesn't use the new route yet).

1. `pnpm lint && pnpm test && pnpm type-check` — must be green.
2. `pnpm deploy:production` (or via CI: `.github/workflows/deploy-image-worker.yml`).
3. Deploy the callers and smoke-test both paths — `discord-worker`'s `/extractor` with a real
   Discord attachment, and a preset preview-image upload through `presets-api`. There is no
   public health endpoint on this Worker to check directly.
