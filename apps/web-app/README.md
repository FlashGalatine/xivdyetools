# xivdyetools-web-app

> The main XIV Dye Tools web app — nine interactive color tools for Final Fantasy XIV, built with Vite, Lit, and Tailwind.

Live at **[xivdyetools.app](https://xivdyetools.app)**.

## Tools

| Route | Tool | What it does |
|-------|------|--------------|
| `/harmony` | **Harmony** | Generate triadic, complementary, analogous, split-complementary, tetradic, square, and monochromatic palettes, matched to real dyes |
| `/gradient` | **Gradient** | Build an N-step gradient between two colors and find the closest dye at each stop |
| `/mixer` | **Mixer** | Blend colors in six modes — RGB, LAB, OKLAB, RYB, HSL, and physically-based Spectral (Kubelka-Munk) |
| `/swatch` | **Swatch** | Import a `.chara` character file and match its colors to dyes |
| `/comparison` | **Comparison** | Compare dyes side by side with perceptual distance readouts |
| `/accessibility` | **Accessibility** | Color-vision deficiency simulation and WCAG contrast checking |
| `/extractor` | **Extractor** | Extract a dominant-color palette from an uploaded image via K-means++ clustering |
| `/budget` | **Budget** | Live Universalis market prices, with affordable alternatives to expensive dyes |
| `/presets` | **Presets** | Browse, submit, vote on, and edit community palette presets |

## Development

```bash
# From the monorepo root
pnpm install
pnpm --filter xivdyetools-web-app run dev        # Vite dev server on http://localhost:5173
```

```bash
pnpm --filter xivdyetools-web-app run build      # Production build
pnpm --filter xivdyetools-web-app run preview    # Preview the production build locally
pnpm --filter xivdyetools-web-app run type-check
pnpm --filter xivdyetools-web-app run lint
pnpm --filter xivdyetools-web-app run format
```

### Testing

```bash
pnpm --filter xivdyetools-web-app run test              # Vitest unit tests
pnpm --filter xivdyetools-web-app run test:coverage
pnpm --filter xivdyetools-web-app run test:e2e          # Playwright E2E
pnpm --filter xivdyetools-web-app run test:e2e:ui       # Playwright UI mode
pnpm --filter xivdyetools-web-app run test:e2e:mobile   # Mobile viewport suite
```

### Checks

```bash
pnpm --filter xivdyetools-web-app run validate:i18n        # Verify locale key parity across all 6 languages
pnpm --filter xivdyetools-web-app run check-bundle-size    # Enforce the bundle budget
pnpm --filter xivdyetools-web-app run build:check          # Build + all checks, as CI runs them
```

## Architecture

- **Framework:** [Lit](https://lit.dev/) web components — no virtual DOM, native custom elements
- **Build:** [Vite](https://vitejs.dev/) with code-splitting per tool route
- **Styling:** Tailwind CSS with a token-driven Light/Dark theme
- **State:** Per-tool component state; user preferences persist to `localStorage`
- **Deploy target:** Cloudflare Pages

All color math runs **client-side** through `@xivdyetools/core` — the dye database is bundled, so tools work with no network round-trip. Only the Budget and Presets tools make API calls.

## API Consumption

| Service | Used by | Endpoint |
|---------|---------|----------|
| [`presets-api`](../presets-api/) | Presets tool | `api.xivdyetools.app` |
| [`oauth`](../oauth/) | Sign-in for submitting and voting | `auth.xivdyetools.app` |
| [`api-worker`](../api-worker/) | Budget tool market prices | `data.xivdyetools.app` |

Each of these enforces a CORS origin allowlist. A new deployment origin (a preview URL, a beta domain) must be added to those allowlists **before** it will work — the failure looks like a broken app but is a server-side config gap.

## Localization

Six languages: `en`, `ja`, `de`, `fr`, `ko`, `zh`. Dye names come from `@xivdyetools/core`; UI strings live in the app's own locale files. Run `validate:i18n` before committing translation changes — it fails on any key present in one locale and missing from another.

## Deployment

Deployed to **Cloudflare Pages** via the `deploy-web-app` GitHub Actions workflow on push to `main`. A separate `deploy-web-app-beta` workflow publishes the beta project.

> ⚠️ For beta deploys, the `--branch=beta` flag is load-bearing and **fails silently** if omitted — the build lands in the wrong Pages environment with no error. Note also that beta writes to **production** preset data.

> ⚠️ Do not combine an SPA catch-all route with `immutable` caching on `/assets/*`. That combination can cache an HTML fallback under a `.js` URL for a year, which presents exactly like a partial deploy. To tell them apart, diff the custom domain's response against the `pages.dev` alias.

## Dependencies

| Package | Purpose |
|---------|---------|
| `lit` | Web component framework |
| `@xivdyetools/core` | Dye database, color algorithms, Universalis client |
| `@xivdyetools/svg` | Shared SVG generation helpers |
| `@xivdyetools/types` | `HexColor`, `DyeId`, and other branded types |
| `@xivdyetools/logger` | Browser-flavored structured logger |
| `spectral.js` | Kubelka-Munk spectral mixing |
| `@xivdyetools/test-utils` | Shared test factories (devDependency) |

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

- **[XIVAPI](https://xivapi.com/)** — dye names in English, Japanese, German, and French. Korean and Chinese names are manually sourced.
- **[Universalis](https://universalis.app/)** (MIT) — market board price data for the Budget tool.
- **[spectral.js](https://github.com/rvanwijnen/spectral.js)** (MIT) — physically-based paint mixing.
- **[Lit](https://lit.dev/)** (BSD-3-Clause) — web component framework.
- Color-vision deficiency simulation uses matrices from **Brettel, Viénot & Mollon (1997)**, JOSA A 14(10).
- Fonts under the [SIL Open Font License 1.1](https://openfontlicense.org/): [Onest](https://fonts.google.com/specimen/Onest), [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk), [Fragment Mono](https://fonts.google.com/specimen/Fragment+Mono), [Noto Sans JP / SC / KR](https://fonts.google.com/noto).

## License

MIT © 2025-2026 Flash Galatine — see [LICENSE](./LICENSE).

## Legal Notice

**FINAL FANTASY is a registered trademark of Square Enix Holdings Co., Ltd.**
**FINAL FANTASY XIV © SQUARE ENIX CO., LTD.**

XIV Dye Tools is an unofficial fan project and is **not affiliated with, endorsed by, or sponsored by Square Enix Co., Ltd.** All FINAL FANTASY XIV content, including dye names and color values, is the property of Square Enix.
