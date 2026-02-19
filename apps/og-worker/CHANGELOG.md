# Changelog

All notable changes to the XIV Dye Tools OpenGraph Worker will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.3] - 2026-02-19

### Security

- **FINDING-003**: Added parameter bounds validation to all OG image generation routes to prevent resource exhaustion
  - Gradient: `steps` must be 2–20 (returns 400 if exceeded)
  - Mixer: `ratio` must be 1–99 (returns 400 if out of range)
  - Swatch: `limit` must be 1–20 (returns 400 if exceeded)
  - Comparison/Accessibility: `dyeIds` limited to 1–16 IDs (returns 400 if exceeded)
  - Replaced silent `isNaN` fallbacks with explicit error responses

---

## [1.0.2] - 2026-01-26

### Security

- Added pre-commit hooks for security scanning (detect-secrets, trivy)
  - Scans for accidentally committed secrets before push
  - Vulnerability scanning for dependencies and container images

### Changed

- Added Dependabot configuration for automated dependency updates
  - Weekly npm dependency updates
  - Weekly GitHub Actions updates

---

## [1.0.1] - 2026-01-25

### Security

- **FINDING-004**: Updated `hono` to ^4.11.4 to fix JWT algorithm confusion vulnerability (CVSS 8.2)
- **FINDING-005**: Updated `wrangler` to ^4.59.1 to fix OS command injection in `wrangler pages deploy`

---

## [1.0.0] - 2025-01-19

### Added

#### Core Infrastructure
- **Cloudflare Worker** with Hono framework for routing and request handling
- **Crawler detection** for Discord, Twitter/X, Facebook, LinkedIn, Slack, Telegram, and WhatsApp
- **Analytics tracking** via Cloudflare Analytics Engine for share events and image requests

#### OG Image Generation
- **SVG rendering engine** with reusable primitives (`rect`, `text`, `circle`)
- **PNG conversion** using `resvg-wasm` WebAssembly library
- **Custom fonts** embedded in the worker:
  - Onest (primary UI text)
  - Space Grotesk (headers and branding)
  - Habibi (decorative accents)

#### Tool-Specific OG Images

- **Harmony Tool** (`/og/harmony/:dyeId/:harmonyType.png`)
  - Displays base dye with color harmony visualization
  - Supports: complementary, analogous, triadic, split-complementary, tetradic, square
  - Shows dye name, hex code, and matched harmony colors with delta values

- **Gradient Tool** (`/og/gradient/:startId/:endId/:steps.png`)
  - Visualizes dye gradient from start to end color
  - Shows intermediate steps with matched dyes
  - Displays start/end dye names and hex codes

- **Mixer Tool** (`/og/mixer/:dyeAId/:dyeBId/:ratio.png`)
  - Shows two input dyes with their blend result
  - Displays blend ratio percentage
  - Shows closest matching dye to the blended color

- **Swatch Matcher** (`/og/swatch/:color/:limit.png`)
  - Input color display with hex and RGB values
  - Top 4 matching dyes with delta (Δ) distance values
  - Color-coded delta indicators (green < 3, yellow < 6, red ≥ 6)
  - **Character color position display**: Shows where the input color appears in the FFXIV character creator (e.g., "Eye Colors - Row 4, Col 3")

#### Character Color Lookup
- Search across all FFXIV character color sheets:
  - **Shared colors**: Eye Colors, Highlights, Lip Colors (Dark/Light), Tattoo/Limbal, Face Paint (Dark/Light)
  - **Race-specific colors**: Hair Colors and Skin Colors for all 16 subraces and both genders
- Position calculation using 8-column grid matching in-game UI

#### OG Metadata Generation
- Dynamic `og:title`, `og:description`, `og:image` tags per tool
- Twitter Card support (`twitter:card`, `twitter:image`)
- Proper caching headers (1h browser, 24h edge)

#### API Routes
- Tool interception routes: `/harmony/*`, `/gradient/*`, `/mixer/*`, `/swatch/*`, `/comparison/*`, `/accessibility/*`
- Direct image routes: `/og/harmony/...`, `/og/gradient/...`, `/og/mixer/...`, `/og/swatch/...`
- Default image: `/og/default.png`
- Health check: `/health`

### Technical Details

- **Image dimensions**: 1200×630px (standard OG image size)
- **Bundle size**: ~4MB (1.3MB gzipped)
- **Startup time**: ~45ms
- **Supported algorithms**: OKLAB (default), CIEDE2000, RGB

### Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| hono | ^4.10.7 | Web framework |
| @resvg/resvg-wasm | ^2.6.2 | SVG → PNG |
| @xivdyetools/core | ^1.14.0 | Dye database |
| @xivdyetools/types | ^1.7.0 | Type definitions |

---

## [Unreleased]

### Planned
- Comparison tool OG images
- Accessibility tool OG images
- KV caching for generated images
- Budget tool support (if shareable)
