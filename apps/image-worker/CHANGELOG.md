# Changelog

All notable changes to the XIV Dye Tools Image Worker will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-09-02

Sprint 12 of the 2026-09-02 deep-dive remediation (`docs/audits/2026-09-02-deep-dive`).
Minor bump: the accepted pixel range is smaller than it was (16 MP → 9.4 MP), so some
inputs that used to reach photon are now rejected at the gate — deliberately, because
they were the ones that could take the isolate down. Everything up to and including
4K still passes.

### Fixed

- **The dimension cap admitted the input it existed to reject (BUG-052).**
  `MAX_PIXEL_COUNT` was `16 * 1024 * 1024` — *exactly* 4096², the largest square the
  side cap allows — and the check is `>`, not `>=`, so that square passed. One RGBA
  buffer for it is 64 MiB; photon holds two (`get_raw_pixels` materialises one and
  `dyn_image_from_raw` copies the vector again per operation), so decode-then-resize
  needed ≥ 128 MiB of WASM linear memory against Cloudflare's 128 MiB per-isolate
  limit — before the JS-side source buffer and the resize output. A solid-colour
  4096×4096 PNG compresses to tens of KB, far under the 10 MB file cap, so the OOM
  this pre-decode gate exists to prevent was reachable from any Discord attachment,
  in a Worker shared with presets-api.

  The cap is now **derived from the memory budget** rather than from the side
  length: 72 MiB / (4 bytes per RGBA pixel × 2 concurrent copies) = **9.4 MP**.
  `MAX_IMAGE_DIMENSION` (4096/side) stays as a secondary guard on shape.

  That budget was first set at 32 MiB, i.e. a 4 MP ceiling, on the reasoning that
  4 MP is far more resolution than palette extraction can use. True, but beside the
  point: this gate rejects the **input**, before the decode that is the only thing
  able to downscale it, so setting it by what extraction needs does not save anyone
  bandwidth — it refuses their screenshot. 3840×2160 is 8.29 MP and 3440×1440 is
  4.95 MP, so a 4K or ultrawide capture, the most common palette source an FFXIV
  player has, was refused outright from `/extract` (the bot and the web extractor)
  and from presets-api's preview upload alike. At 9.4 MP both pass and 4096×4096 —
  the 134 MiB decompression bomb this finding was actually about — is still refused.
  The trade is a thinner margin: peak lands near 95–100 MB of the 128 MiB isolate.

  The old suite had *noticed* the symptom: a comment in `validators.test.ts` recorded
  that "the pixel count branch [is] unreachable — dimension check always triggers
  first" and tested the dimension check instead.

- **A one-pixel-wide source trapped the shared WASM instance (BUG-053).**
  `computeCropBox(1, 1000)` gave `bandHeight = Math.round(1 / 2.4242) = 0`;
  `bandHeight > height` was false, so the band stayed 1×0 and `crop(original, 0, 0,
  1, 0)` produced a 1×0 image that `resize(…, 640, 264, Lanczos3)` sampled out of
  bounds. The Rust panic surfaces as a WASM trap: the request answers 400 with an
  opaque message, and **the trapped module instance is shared by every later
  `/extract` and `/thumbnail` on that isolate**. A 1×1000 PNG clears presets-api's
  preview-image gate (non-empty, ≤ 5 MB, sniffs as png) and this Worker's own
  (w>0, h>0, within the caps), so nothing upstream stopped it. Both axes now clamp
  into `[1, source]`.

- **An extreme aspect ratio returned an empty 200 (image-stoat-02).** Past roughly
  512:1, `resizeImage` rounded the minor axis to 0 — a 2000×3 attachment at the
  default `maxDimension` of 256 gives `Math.round((3 / 2000) * 256) === 0` — so
  `get_raw_pixels()` came back empty, `/extract` answered 200 with a zero-byte body
  and `X-Image-Height: 0`, and discord-worker told the user the image had no colours
  it could read. For an image that plainly has colours. Both branches clamp to ≥ 1.

- **`'Image file is empty'` was classified as our failure, not the user's
  (image-stoat-07).** An empty 200 from the Discord CDN reaches `validateFileSize(0)`
  and throws that message, which had no marker in discord-worker's
  `IMAGE_INPUT_MARKERS` — so `imageInputReason` returned null, the analytics outcome
  was recorded as `unknown` rather than `image_input`, and the user saw the generic
  `matchImage.processingFailed`. It now reads as `format`, not `too_large`: nothing
  about an empty file is large, and "not an image we can read" is what happened.

  The marker table was tested against the messages it *lists*, which cannot catch a
  message this Worker throws that the table has never heard of.
  `image-input-errors-contract.test.ts` now reads this Worker's source instead. It
  found two further unmatched messages on its first run, both correctly unmatched and
  now recorded as such: `'Invalid JSON body'` (our own malformed request) and
  `'No image data provided'` (`/thumbnail`, which only presets-api calls).

### Changed

- **One `maxDimension` rule, in `validators.ts` (REFACTOR-007).** The rule, the bound
  and the error string were written twice — `index.ts` had its own
  `MIN_MAX_DIMENSION` and predicate and rebuilt the message by hand, while
  `photon.ts` already exported `assertValidMaxDimension` with identical wording. Both
  sides were tested independently, which is exactly why a drift between them would
  have stayed green.

  It lives in `validators.ts` rather than `photon.ts` — where the review suggested —
  because every route test mocks `photon.js` wholesale, so a rule the route reached
  through it would be `undefined` under test. `photon.ts` re-exports it.

- `CLAUDE.md`'s three stale sections are corrected (image-stoat-06). They described
  pre-1.1.0 behaviour: that `maxDimension` reaches `resize()` unvalidated, that
  "nothing in the `/extract` route calls `validateDimensions`", and that
  `/thumbnail`'s "only guard is the empty-body check". The error contract also named
  five fragments including `'SSRF'` — a string no message in this Worker has ever
  contained — and pointed at a matcher that has since moved to
  `apps/discord-worker/src/services/image-input-errors.ts`.

### Tests

- `it('calls crop with correct arguments')` asserted `expect.any(Number)` on all four
  coordinates, so it could not fail for *any* crop box — including the degenerate one
  above (image-stoat-04). It now asserts the box `computeCropBox` actually computes.
- New coverage for degenerate shapes: nine named cases plus an exhaustive sweep of
  every 1..64 × 1..64 source, asserting the band is at least 1×1 and inside the
  source. The existing cases were 1920×1080, 1080×1920, 1000×1000, 1600×1200 and
  3000×400 — none anywhere near where the rounding collapses.

## [1.2.1] - 2026-09-02

### Removed

- `getImageDimensions` (`src/photon.ts`) and its three tests — dead-code sweep
  (`docs/audits/2026-09-01-dead-code`, DEAD-027). It arrived with the 1.0.0 copy-in from
  discord-worker and never gained a caller here; dimension checks run through
  `validators.ts`'s header path instead. No behaviour change on `/extract` or `/thumbnail`.

This app is now gated on the monorepo's `knip` dead-code check (`pnpm run lint:dead`, folded into
`lint`; root `knip.jsonc`) — clean on first run, no unused exports.

## [1.2.0] - 2026-08-30

Security audit remediation (docs/audits/2026-08-29-security, FINDING-023). Minor bump: the
private-only design is now enforced, not just documented.

### Fixed

- The one-hop redirect follow in `validateAndFetchImage` used `redirect: 'error'` for the second request; the Workers runtime has no `error` mode and throws on it, so a Discord CDN URL that redirected once failed with a `TypeError` instead of being fetched. The second hop now uses `redirect: 'manual'` like the first; a further redirect comes back as a 3xx that the existing `!ok` check rejects — still never followed.

### Security

- **Config-drift test for the private-only invariant.** New `src/wrangler-config.test.ts` (deliberately in `src/`, not `tests/` — this app's vitest `include` is `src/**/*.test.ts`) pins: no `routes` in any spelling wrangler accepts, in either environment or by inheritance; `workers_dev = false` and the new `preview_urls = false` explicit in both; exactly one named environment (`[env.production]`, nothing else); no `wrangler.json`/`wrangler.jsonc` shadowing the `wrangler.toml` this test (and wrangler itself) reads; and — the cross-worker contract — that production's `name` is exactly what both discord-worker's and presets-api's `IMAGE_WORKER` service bindings point at, in every one of their own environments. This is the last of a four-worker config-drift test set this branch added (presets-api, oauth, moderation-worker, now image-worker); FINDING-023 closes with this release.
- **The edit this test most needs to catch is not setting `workers_dev` to `true` — it is deleting the `workers_dev = false` line.** wrangler defaults an absent `workers_dev` to `routes.length === 0` (verified against the pinned 4.126.0), which is `true` for this routeless worker in both environments — so a "tidy-up" that drops the line publishes this Worker exactly as surely as writing `true` would, with no line that even looks suspicious in a diff. The test's positive assertions (`workers_dev = false` must be present) catch a deletion; a check that only looked for a stray `true` would not.
- **`preview_urls = false`**, added explicitly in both environments alongside `workers_dev = false` (matching `api-worker`'s existing precedent), and pinned by the new test.
- **In-code hostname guard.** A request whose URL hostname ends in `.workers.dev` is now refused with a `404` before any body read, fetch, or decode — for every route, `/health` included. Both callers reach this Worker only through a Service Binding (`new Request('https://image-worker/…')`, never resolved over DNS), so a `*.workers.dev` hostname can only mean a real public request — reachable only if `workers_dev` is ever flipped on by mistake. This is defence in depth, not the primary control; the primary control remains that there is no public surface at all. **This guard and the config test cover different axes and neither substitutes for the other**: the guard only ever sees a `*.workers.dev` hostname, which is what a `workers_dev` flip produces — it cannot see a `routes` addition, because a route (e.g. `route = { pattern = "img.xivdyetools.app", custom_domain = true }`) makes this Worker reachable on a real custom-domain hostname that never ends in `.workers.dev`, reaching `validateAndFetchImage` straight past the guard. Only the config test's routes check covers that axis.

### Deploy-day steps

No secrets, no vars, no new bindings, and no operator action needed — but `preview_urls` was
previously absent from this Worker's config, so every deploy sent `undefined` for it and
whatever the account had stored (if anything) stood; **this is the first deploy that actively
sends `preview_urls = false`.** No known failure mode either way, and nothing depends on preview
URLs today, but it is a real one-way change: a code-only rollback (reverting this commit) removes
the line from `wrangler.toml` again, which on the *next* deploy goes back to sending `undefined`
— it does not, by itself, re-enable whatever was previously set. Deploy `--env production` as
usual; the config pins and the hostname guard take effect immediately, with no coordination
needed from either caller.

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
