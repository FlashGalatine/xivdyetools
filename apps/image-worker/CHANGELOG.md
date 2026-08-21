# Changelog

All notable changes to the XIV Dye Tools Image Worker will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-08-21

Security audit remediation (docs/audits/2026-08-21-security, FINDING-004). Minor bump: stricter input handling, same service-binding contract and error envelope.

### Security

- **Pre-decode dimension gate.** `PhotonImage.new_from_byteslice` decodes the whole image to RGBA before any size check could run, so a few-MB decompression bomb (e.g. a 20 000 × 20 000 PNG) could OOM the 128 MB isolate from `/extractor` or a preset preview upload. New `src/dimensions.ts` reads width × height from the container header only (PNG IHDR, JPEG SOFn — APPn/DQT skipped, GIF logical screen, WebP VP8/VP8L/VP8X, BMP) and `assertImageDimensionsFromHeader()` applies the existing `MAX_IMAGE_DIMENSION` (4096) / `MAX_PIXEL_COUNT` (16 MP) rules — which were defined but never called — before `processImageForExtraction` / `processImageForThumbnail` decode. Unreadable headers fail closed. Error text keeps the "too large" / "format" substrings discord-worker matches on.
- **`maxDimension` is validated** (integer 16–4096) at `POST /extract` (400) and again inside `processImageForExtraction`; NaN / 0 / huge values no longer reach `resize()`.
- **Byte caps are enforced while streaming.** `fetchImageWithTimeout` (new `maxBytes` option) and `POST /thumbnail` use `readBodyWithCap()` — Content-Length pre-check, then the actual stream, abandoned as soon as the cap is exceeded — instead of buffering the whole body and checking afterwards; `/thumbnail` now has its own 10 MB cap.

## [1.0.0] - 2026-08-16

The first release of `xivdyetools-image-worker`: the monorepo's **Photon WASM host**,
reachable only over a Cloudflare Service Binding. Design and measurements in
`docs/operations/IMAGE_WORKER_SPLIT.md`.

### Why it exists

`@cf-wasm/photon` is a 1.5 MiB WASM library (604 KiB gzipped) that exactly one bot feature —
`discord-worker`'s `/extractor` — used, yet every `/harmony`, `/dye` and `/contrast`
invocation carried it. The 5.0 font payload (Fragment Mono + the Noto Sans JP subset + a larger
SC subset, +967 KiB) pushed `discord-worker` to **3,209.3 KiB gzipped**, over Cloudflare's
3,072 KiB free-plan limit, so the bot could not deploy at all. Moving photon here dropped
`discord-worker` to ~2,590 KiB gzipped (≈ 480 KiB of headroom); this Worker measures
639.35 KiB gzipped (1,648.82 KiB raw). Splitting was chosen over trimming fonts because the
WASM blob compresses predictably and the fonts were about to grow again (Sprint 7 FONT-001).

Since the split it has become the general photon host rather than a single-caller shim: any
photon-backed feature anywhere in the monorepo adds a route here, not a second copy of the blob.

### Added

- **`POST /extract`** — the palette-pixel endpoint for `discord-worker` `/extractor`. Body `{ url: string, maxDimension?: number }`; validates the URL through the SSRF allowlist (`https:` + hostname exactly `cdn.discordapp.com` / `media.discordapp.net`, every IP literal and cloud-metadata / private / loopback / link-local range blocked, one manual redirect hop re-validated), fetches with a 10 s `AbortController` timeout, enforces the 10 MB cap against both `Content-Length` and the fetched buffer, magic-byte-checks the format (png / jpeg / gif / webp / bmp), decodes with `PhotonImage.new_from_byteslice`, resizes to `maxDimension` (default **256**, Lanczos3, aspect preserved) and returns **raw RGBA bytes** as `application/octet-stream` with `X-Image-Width` / `X-Image-Height` headers (binary, not base64 — a service binding passes `Response` objects directly). Default response is bounded at 256 × 256 × 4 = 256 KiB regardless of input size. `4xx → { error: string }`.
- **The verbatim error contract.** `discord-worker`'s `extractor.ts` substring-matches `error` against `'SSRF'`, `'Discord CDN'`, `'too large'`, `'format'`, `'timeout'` to pick a localized user message, so `index.ts` returns every thrown `Error`'s message **unmodified**; only non-`Error` throws fall back to `Image processing failed`. Never reword a message thrown from `validators.ts` or `photon.ts`.
- **`POST /thumbnail`** — the preview-image endpoint for `presets-api`'s preset preview upload (`preview-image-service.ts`). Body is **raw image bytes, not JSON and not a URL** (the caller already holds and has bounded the upload, so none of the SSRF / size / format validators run — the only guard is the empty-body check). `processImageForThumbnail` crops to the largest centred region matching the **640 × 264** band (`THUMBNAIL_WIDTH` / `THUMBNAIL_HEIGHT`, aspect ≈ 2.42, via `computeCropBox` — portrait sources are cropped, not letterboxed), resizes with Lanczos3 and encodes **WebP**; returns `image/webp`, or `400 { error }` when the body is empty or photon cannot decode it. (`b9be572`)
- **`GET /health`** → `{ status: "ok" }` (only reachable through a binding — there is no public URL to poll).
- **`src/validators.ts`** and **`src/photon.ts`**, copied in from `discord-worker` (`6b613a0`, `cc598d0`) so the split changed no behaviour the bot's callers could observe: `validateImageUrl` / `isPrivateHost` / `validateFileSize` / `validateDimensions` / `detectImageFormat` / `validateImageFormat` / `validateAndFetchImage`, and `loadImage` / `resizeImage` / `extractPixels` / `getImageDimensions` / `processImageForExtraction`, plus the new `computeCropBox` / `processImageForThumbnail`. Exported constants: `MAX_FILE_SIZE_BYTES` (10 MB), `MAX_IMAGE_DIMENSION` (4096), `MAX_PIXEL_COUNT` (16 MP), `FETCH_TIMEOUT_MS` (10 000). Note `validateDimensions` is exported but not called on the `/extract` path — oversized sources are brought down by the unconditional resize instead, and a caller-supplied `maxDimension` is honoured as-is.
- **WASM memory hygiene**: every `PhotonImage` (original, resized; for thumbnails original, cropped, resized) is `.free()`d in a `finally` block, guarding the same-reference case when no resize was needed, so a busy isolate does not leak toward the 128 MB limit. Tests assert all three thumbnail images are freed on both the success path and each error path (`2b038b6`, `83c0ad7`).
- **`@xivdyetools/worker-kit`** `requestIdMiddleware` + `loggerMiddleware({ serviceName: 'xivdyetools-image-worker', readEnvironmentFromEnv: false })` on every route — structured JSON logs with cross-worker request IDs, same pattern as the other Workers.
- **`wrangler.toml` with the BUG-008 two-env layout from birth**: the top-level env is `xivdyetools-image-worker-dev` with `workers_dev = false` and no routes (a bare `wrangler deploy` can never touch production — and can never expose an unauthenticated public `POST /extract` either, which `workers_dev = true` on the dev name would have done, `a1d56b1`); `[env.production]` is `xivdyetools-image-worker`, also `workers_dev = false`, no routes. **No public surface in either env** — the only way in is the `IMAGE_WORKER` binding declared by `discord-worker` (both its envs) and `presets-api` (both its envs), all pointing at the production name. No `nodejs_compat`. No secrets, no KV / D1 / R2 / Analytics — the smallest operational footprint in the monorepo. `types.ts`'s `Env` carries only the inert `ENVIRONMENT` var.
- **`.github/workflows/deploy-image-worker.yml`** — builds with `turbo run build --filter=xivdyetools-image-worker...`, type-checks, tests, and deploys `--env production` on push to `main` for `apps/image-worker/**`, `packages/logger/**`, `packages/worker-kit/**` (plus `workflow_dispatch`). (`2ba14c4`)
- **Tests**: 89 vitest cases across `index.test.ts` (route contracts, error envelope, both success paths), `photon.test.ts` (resize maths, crop box, pixel extraction, `.free()` accounting) and `validators.test.ts` (allowlist, private-host and metadata blocking, redirect handling, size / format / timeout). Coverage gate 85 / 80 / 85 / 85 (statements / branches / functions / lines); measured 96.5 % statements, 94.8 % branches, 100 % functions, 96.4 % lines. `pnpm lint` (`eslint src`) is wired.
- `CLAUDE.md`, `README.md` (2026-08-10 README audit: licensing, attribution) and `LICENSE`.

### Changed

- `@xivdyetools/logger` removed as a direct dependency it never imported (arrives transitively via `worker-kit`, the same shape as `og-worker`). (`a1d56b1`)
- Dependencies at release: `@cf-wasm/photon ^0.3.7`, `hono ^4.12.34` (FINDING-001 floor), `wrangler ^4.120.0` (FINDING-004: miniflare 5 / undici 7.29), `vitest ^4.1.10`.

### Deploy-day steps

1. **Deploy order is load-bearing — this Worker goes first.** `discord-worker` and `presets-api` both declare an `IMAGE_WORKER` service binding to `xivdyetools-image-worker`; Cloudflare rejects a deploy whose binding names a script that does not exist yet. `deploy-image-worker.yml` and `deploy-discord-worker.yml` both fire on the merge to `main` with no `needs:` between them (deliberately — do not add cross-workflow ordering), so **before the branch merges** run once, by hand: `pnpm --filter xivdyetools-image-worker run deploy:production`. `workflow_dispatch` cannot substitute — GitHub only exposes it for workflows already on the default branch. Once the script exists in the account the race is permanently harmless. (`docs/operations/DEPLOY_ENVIRONMENTS.md` records that this first deploy has already been done, on 2026-08-09; verify with `wrangler deployments list --env production` rather than assuming.)
2. If that first deploy predates `POST /thumbnail` (2026-08-10), **redeploy production before `presets-api` ships** — otherwise preview-image uploads get a 404 from the binding.
3. Then deploy the callers and smoke-test both paths: `/extractor` with a real Discord attachment (discord-worker) and a preset preview-image upload (presets-api). `pnpm deploy` (top-level env) is **not** a usable staging instance — it publishes an unreachable `-dev` script that nothing binds to.
4. Nothing to set: no secrets, no vars, no bindings on this side.
