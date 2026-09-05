# xivdyetools-image-worker

> Photon-backed image decode and pixel extraction for XIV Dye Tools — an internal Cloudflare Worker reached only over a Service Binding.

## Why this worker exists

`discord-worker` was approaching Cloudflare's compressed-bundle limit, and `@cf-wasm/photon` was the single largest contributor. Splitting image decoding into its own Worker moved that WASM payload out of the bot's bundle entirely, restoring headroom for future growth.

It has since become the monorepo's general photon host rather than a single-caller split: `presets-api` uses it too, for preview-image thumbnails. Adding a photon-backed feature anywhere means adding a route here, not a second copy of the WASM blob.

This Worker has **no public routes and no `workers.dev` subdomain**. The only way in is an `IMAGE_WORKER` Service Binding — from `discord-worker` (`POST /extract`) or `presets-api` (`POST /thumbnail`). See [`docs/operations/IMAGE_WORKER_SPLIT.md`](../../docs/operations/IMAGE_WORKER_SPLIT.md).

## API

### `GET /health`

```json
{ "status": "ok" }
```

### `POST /extract`

Decodes an image and returns its raw RGBA pixel buffer.

**Request**

```jsonc
{
  "url": "https://cdn.discordapp.com/attachments/...",  // required
  "maxDimension": 512                                    // optional — downscale cap
}
```

**Response** — `200 OK`, `Content-Type: application/octet-stream`

The body is the raw pixel buffer. Dimensions come back as headers:

| Header | Description |
|--------|-------------|
| `X-Image-Width` | Decoded (post-downscale) width in pixels |
| `X-Image-Height` | Decoded (post-downscale) height in pixels |

**Errors** — `400` with `{ "error": "<message>" }`.

> ⚠️ **The error envelope is a hard contract.** `discord-worker` substring-matches the `error` value to pick a localized user-facing message and to classify the analytics outcome. The source of truth is the marker table `IMAGE_INPUT_MARKERS` in [`apps/discord-worker/src/services/image-input-errors.ts`](../discord-worker/src/services/image-input-errors.ts) — a `[reason, substring]` list covering `url`, `too_large`, `format`, `timeout` and `fetch`. (No message thrown anywhere in this Worker contains the string `SSRF`; the real host rejection reads `Only Discord CDN URLs are allowed for security`.) Never reword, truncate, or generalise a thrown message without updating that table in the same change — `image-input-errors-contract.test.ts` in discord-worker reads this Worker's source and fails when a message has no marker.

### `POST /thumbnail`

Crops and encodes an uploaded image into a preset card thumbnail. Unlike `/extract` this takes **raw image bytes, not JSON and not a URL** — the caller already holds the file, so nothing is fetched and there is no SSRF surface.

**Request** — the raw image bytes as the body. Capped at 10 MB, checked first against `Content-Length` and then while streaming (`readBodyWithCap`), plus the same pre-decode header dimension gate `/extract` uses.

**Response** — `200 OK`, `Content-Type: image/webp`; the body is the encoded thumbnail. The pipeline is decode → crop to the 640 × 264 band (`computeCropBox`) → resize with Lanczos3 → WebP. The round trip also drops EXIF, so GPS coordinates in an author's screenshot never reach R2.

**Errors** — `400` with `{ "error": "<message>" }` for an empty body, an oversized body, or an image photon cannot decode.

## Security

The URL passed to `/extract` is fetched server-side, so `validateAndFetchImage()` enforces:

- **SSRF protection** — the host must be an allowed image CDN; private and link-local address ranges are rejected.
- **Size limits** — oversized payloads are rejected before decoding.
- **Format validation** — only real decodable image formats pass.
- **Timeouts** — a slow origin cannot hold the isolate open.
- **No public surface, enforced** — `workers_dev` and `preview_urls` are `false` in both environments, pinned by `src/wrangler-config.test.ts` (FINDING-023). Any request that still lands here on a `*.workers.dev` hostname is refused with a `404` before any of the above ever runs.

## Development

```bash
# From the monorepo root
pnpm install
pnpm --filter xivdyetools-image-worker run dev          # wrangler dev
pnpm --filter xivdyetools-image-worker run test
pnpm --filter xivdyetools-image-worker run type-check
pnpm --filter xivdyetools-image-worker run lint
```

## Deployment

```bash
pnpm --filter xivdyetools-image-worker run deploy              # DEV worker (xivdyetools-image-worker-dev)
pnpm --filter xivdyetools-image-worker run deploy:production   # Production (xivdyetools-image-worker)
```

> ⚠️ A bare `wrangler deploy` targets the **dev** worker here. Production always needs `--env production`. See [`docs/operations/DEPLOY_ENVIRONMENTS.md`](../../docs/operations/DEPLOY_ENVIRONMENTS.md).

Deploy this Worker **before** any caller release that depends on a change to the `/extract` or `/thumbnail` contract — the binding resolves at request time, so a stale image-worker breaks `/extractor` (discord-worker) or preview-image uploads (presets-api) in production.

## Environment Bindings

No KV, D1, R2, or secrets. The Worker is stateless; its only input is the request body.

## Dependencies

| Package | Purpose |
|---------|---------|
| `hono` | HTTP framework |
| `@cf-wasm/photon` | WASM image decoding and resizing |
| `@xivdyetools/worker-kit` | `requestIdMiddleware`, `loggerMiddleware` |

## Consumers

- [`apps/discord-worker`](../../apps/discord-worker/) — `IMAGE_WORKER` service binding → `POST /extract`, used by `/extractor`.
- [`apps/presets-api`](../../apps/presets-api/) — `IMAGE_WORKER` service binding → `POST /thumbnail`, used by preset preview-image uploads.

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

## Credits & Acknowledgements

- **[Photon](https://github.com/silvia-odwyer/photon)** (Apache-2.0) — WASM image processing.

## License

MIT © 2025-2026 Flash Galatine — see [LICENSE](./LICENSE).

## Legal Notice

**FINAL FANTASY is a registered trademark of Square Enix Holdings Co., Ltd.**
**FINAL FANTASY XIV © SQUARE ENIX CO., LTD.**

XIV Dye Tools is an unofficial fan project and is **not affiliated with, endorsed by, or sponsored by Square Enix Co., Ltd.**
