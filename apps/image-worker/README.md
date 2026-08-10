# xivdyetools-image-worker

> Photon-backed image decode and pixel extraction for XIV Dye Tools — an internal Cloudflare Worker reached only over a Service Binding.

## Why this worker exists

`discord-worker` was approaching Cloudflare's compressed-bundle limit, and `@cf-wasm/photon` was the single largest contributor. Splitting image decoding into its own Worker moved that WASM payload out of the bot's bundle entirely, restoring headroom for future growth.

This Worker has **no public routes and no `workers.dev` subdomain**. The only way in is the `IMAGE_WORKER` Service Binding from `discord-worker`. See [`docs/operations/IMAGE_WORKER_SPLIT.md`](../../docs/operations/IMAGE_WORKER_SPLIT.md).

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

> ⚠️ **The error envelope is a hard contract.** `discord-worker`'s `/extractor` handler substring-matches the `error` value for `SSRF`, `Discord CDN`, `too large`, `format`, and `timeout` to pick a localized user-facing message. Never reword or generalise those strings without updating the consumer in the same change.

## Security

The URL passed to `/extract` is fetched server-side, so `validateAndFetchImage()` enforces:

- **SSRF protection** — the host must be an allowed image CDN; private and link-local address ranges are rejected.
- **Size limits** — oversized payloads are rejected before decoding.
- **Format validation** — only real decodable image formats pass.
- **Timeouts** — a slow origin cannot hold the isolate open.

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

Deploy this Worker **before** any `discord-worker` release that depends on a change to the `/extract` contract — the binding resolves at request time, so a stale image-worker breaks `/extractor` in production.

## Environment Bindings

No KV, D1, R2, or secrets. The Worker is stateless; its only input is the request body.

## Dependencies

| Package | Purpose |
|---------|---------|
| `hono` | HTTP framework |
| `@cf-wasm/photon` | WASM image decoding and resizing |
| `@xivdyetools/worker-kit` | `requestIdMiddleware`, `loggerMiddleware` |

## Consumers

- [`apps/discord-worker`](../../apps/discord-worker/) — the `IMAGE_WORKER` service binding, used by `/extractor`.

## Connect With Me

**Flash Galatine** | Midgardsormr (Aether)

🎮 **FFXIV**: [Lodestone Character](https://na.finalfantasyxiv.com/lodestone/character/7677106/)
📝 **Blog**: [Project Galatine](https://blog.projectgalatine.com/)
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
