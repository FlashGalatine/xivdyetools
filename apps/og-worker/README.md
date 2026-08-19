# xivdyetools-og-worker

> Dynamic OpenGraph image generation for XIV Dye Tools — renders a social preview card for any shared tool link, localized via `?lang=`.

Deployed at [og.xivdyetools.app](https://og.xivdyetools.app), and mounted on `xivdyetools.app/<tool>/*` so a shared deep link gets a real preview instead of a generic site card.

## What it does

When someone pastes a share link like `xivdyetools.app/harmony/?dye=102&harmony=triadic` (dye parameters are **stainIDs** — `102` is Jet Black; bare colours travel as `?hex=RRGGBB`) into Discord, Slack, or Bluesky, the crawler hits this Worker first. It:

1. Parses the tool and its parameters out of the URL.
2. Rebuilds the relevant color result from `@xivdyetools/core` (no database round-trip — the dye data is bundled).
3. Renders an SVG card and rasterizes it to PNG via `@resvg/resvg-wasm`.
4. Returns HTML with the correct `og:image` / `twitter:card` meta tags for a human request, or the PNG directly for `/og/*`.

## Routes

### Tool pages (HTML with OG meta tags)

Mounted on the app's own domain so crawlers resolve real previews:

`/harmony` · `/gradient` · `/mixer` · `/swatch` · `/comparison` · `/accessibility` · `/extractor` · `/presets` · `/budget`

### Image endpoints (PNG)

| Path | Description |
|------|-------------|
| `GET /og/:tool/default.png` | Fallback card for a tool with no parameters |
| `GET /og/harmony/:dyeId/:harmonyType` | Harmony palette preview |
| `GET /og/gradient/:startId/:endId/:steps` | Gradient preview |
| `GET /og/mixer/:dyeAId/:dyeBId/:ratio` | Two-dye blend preview |
| `GET /og/mixer/:dyeAId/:dyeBId/:dyeCId/:ratio` | Three-dye blend preview |
| `GET /og/swatch/:color/:limit` | Nearest-dye swatch preview |
| `GET /og/comparison/:dyes` | Side-by-side comparison preview |
| `GET /og/accessibility/:dyes/:visionType` | Color-vision simulation preview |
| `GET /og/extractor/:colors` | Extracted-palette preview |
| `GET /og/presets/:presetId` | Community preset preview |
| `GET /og/budget/:dyeId` | Market price preview |
| `GET /og/default.png` | Site-wide fallback card |
| `GET /health` | Health probe |

All image endpoints accept **`?lang=en\|ja\|de\|fr\|ko\|zh`** to localize dye names and labels on the card, and **`?frame=x`** for the 1200×630 X/Twitter frame (the default Discord frame is 1200×1050). Dye path segments are stainIDs.

## Development

```bash
# From the monorepo root
pnpm install
pnpm --filter xivdyetools-og-worker run dev            # wrangler dev
pnpm --filter xivdyetools-og-worker run test
pnpm --filter xivdyetools-og-worker run type-check
```

## Deployment

```bash
pnpm --filter xivdyetools-og-worker run deploy              # BETA worker (xivdyetools-og-worker-dev — routed on beta.xivdyetools.app + og-beta.xivdyetools.app)
pnpm --filter xivdyetools-og-worker run deploy:production   # Production
```

> ⚠️ Unlike the other workers, a bare `wrangler deploy` here is **not** a routeless sandbox: the top-level env is the live **beta** worker (`beta.xivdyetools.app/<tool>/*` + `og-beta.xivdyetools.app`, its own `xivdyetools_og_analytics_beta` dataset). Production always needs `--env production`. See [`docs/operations/DEPLOY_ENVIRONMENTS.md`](../../docs/operations/DEPLOY_ENVIRONMENTS.md).

Production takes both the `og.xivdyetools.app` custom domain and the nine `xivdyetools.app/<tool>/*` route patterns. Because those patterns sit in front of the web app, a broken deploy here takes those routes down for humans too — smoke-test a tool URL in a browser after deploying, not just the PNG endpoint.

## Environment Bindings

| Binding | Type | Purpose |
|---------|------|---------|
| `ANALYTICS` | Analytics Engine (`xivdyetools_og_analytics`) | Preview render telemetry |
| `APP_BASE_URL` | Var | `https://xivdyetools.app` — canonical link target in meta tags |
| `OG_IMAGE_BASE_URL` | Var | `https://og.xivdyetools.app/og` — absolute `og:image` prefix |

`[[rules]]` bundles `**/*.ttf` as `Data`, embedding the CJK subset fonts needed for Japanese, Korean, and Chinese cards.

## Localization

Six languages: `en`, `ja`, `de`, `fr`, `ko`, `zh`.

This Worker uses the **stateless** localization trio from `@xivdyetools/core` — `LocaleLoader`, `LocaleRegistry`, and `TranslationProvider` — rather than the singleton `LocalizationService.setLocale()` pattern. Concurrent requests for different languages arrive in the same isolate, and a mutable singleton locale races between them at I/O yield points.

## Dependencies

| Package | Purpose |
|---------|---------|
| `hono` | HTTP framework |
| `@resvg/resvg-wasm` | SVG → PNG rasterization |
| `@xivdyetools/core` | Dye database, color algorithms, stateless localization |
| `@xivdyetools/svg` | Shared SVG helpers |
| `@xivdyetools/types` | Shared type definitions |
| `@xivdyetools/worker-kit` | Request ID and logger middleware (no rate limiting on this worker) |

> Note: the cards are this worker's own 15E band frame (`src/services/svg/band.ts`, 400-grid ×3), not the bot's card system — `@xivdyetools/svg` supplies the tool glyphs and text primitives, and its `CARD_WIDTH` constraints do not apply here.

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

- **[resvg](https://github.com/linebender/resvg)** (MPL-2.0) — SVG rasterization.
- Fonts under the [SIL Open Font License 1.1](https://openfontlicense.org/): [Noto Sans JP / SC / KR](https://fonts.google.com/noto), [Onest](https://fonts.google.com/specimen/Onest), [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk), [Fragment Mono](https://fonts.google.com/specimen/Fragment+Mono).

## License

MIT © 2025-2026 Flash Galatine — see [LICENSE](./LICENSE).

## Legal Notice

**FINAL FANTASY is a registered trademark of Square Enix Holdings Co., Ltd.**
**FINAL FANTASY XIV © SQUARE ENIX CO., LTD.**

XIV Dye Tools is an unofficial fan project and is **not affiliated with, endorsed by, or sponsored by Square Enix Co., Ltd.** All FINAL FANTASY XIV content rendered in these preview cards, including dye names and color values, is the property of Square Enix.
