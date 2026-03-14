# 01 — Overview & Goals

## What Is the Public API?

A read-only REST API deployed as a Cloudflare Worker at `api.xivdyetools.com` that wraps the functionality of `@xivdyetools/core` and related libraries. It provides HTTP endpoints for querying the FFXIV dye database, matching colors, generating color harmonies, converting between color spaces, simulating colorblindness, and more — all returning structured JSON or XML responses.

## Target Audience

### Primary

- **FFXIV community developers** building glamour planners, gear set managers, outfit sharing tools, or housing decoration apps that need programmatic access to dye data
- **Discord bot authors** (non-JS) who want to add dye lookup, color matching, or harmony generation to their bots without embedding the npm library
- **Dalamud plugin developers** (C#) who need server-side dye data, color matching, or localized dye names for in-game plugins

### Secondary

- **Mobile app developers** building FFXIV companion apps (iOS/Android) that need dye search and color tools
- **Data analysts / researchers** studying FFXIV's dye system, color distribution, or market pricing trends
- **Content creators** building interactive web tools or overlays that need real-time dye information

## What It Exposes

The API is organized into 10 endpoint domains, each mapping to an existing service in `@xivdyetools/core`:

| Domain | Service | Key Capabilities |
|--------|---------|-----------------|
| **Dyes** | `DyeService` | List, search, filter, sort all 136 dyes; Patch 7.5 consolidation group metadata |
| **Color Matching** | `DyeService` (k-d tree) | Find closest dye to any hex color; range queries |
| **Color Harmony** | `DyeService` → `HarmonyGenerator` | 9 harmony types: complementary, triadic, analogous, square, tetradic, split-complementary, monochromatic, compound, shades |
| **Color Conversion** | `ColorService` | Convert between 8 color spaces: Hex, RGB, HSV, HSL, LAB, LCH, OKLAB, OKLCH |
| **Color Mixing** | `ColorService` | Mix colors using 9 methods: RGB, LAB, RYB, OKLAB, OKLCH, LCH, HSL, HSV, Spectral |
| **Colorblind Simulation** | `ColorService` | Simulate 4 vision types: deuteranopia, protanopia, tritanopia, achromatopsia |
| **Accessibility** | `ColorService` | WCAG contrast ratios, AA/AAA compliance, perceived luminance |
| **Character Colors** | `CharacterColorService` | Eye, hair, skin, lip, tattoo, face paint colors for all 16 subraces |
| **Presets** | `PresetService` | Curated dye palettes organized by category (jobs, seasons, themes, etc.) |
| **Localization** | `LocalizationService` | Dye names in 6 languages: English, Japanese, German, French, Korean, Chinese |

Additionally, market price data is available via pass-through to the existing `universalis-proxy` worker, with automatic handling of Patch 7.5's dye consolidation (105 individual dye items consolidated into 3 base items for market board purposes).

## Non-Goals

- **Not a replacement for the npm library** — Developers who can use JavaScript/TypeScript should use `@xivdyetools/core` directly for better performance and offline capability
- **Not exposing write operations** — Community preset submissions, voting, and moderation remain on the existing `presets-api` with its own JWT authentication
- **Not providing user accounts** — The API uses simple API keys, not OAuth flows or user sessions
- **Not a real-time service** — No WebSocket connections or push notifications for price changes
- **Not an image processing service** — Palette extraction from uploaded images requires significant compute and is deferred to a later phase

## Success Criteria

1. **Functional completeness** — Every public method on `DyeService`, `ColorService`, `CharacterColorService`, `PresetService`, and `LocalizationService` is accessible via HTTP
2. **Developer experience** — Interactive API documentation (OpenAPI/Swagger) with try-it-now capability, clear error messages, and code examples in 3+ languages
3. **Performance** — Sub-100ms response times for all dye lookups and color conversions (leveraging Cloudflare's edge network)
4. **Reliability** — 99.9% uptime, graceful degradation when Universalis is unavailable, proper rate limiting to prevent abuse
5. **Adoption** — At least 5 registered API keys within the first 3 months of launch

## Relationship to Existing Services

```
                    ┌─────────────────────────────────────┐
                    │         api.xivdyetools.com         │
                    │          (new api-worker)            │
                    │                                      │
                    │  Dyes · Matching · Harmony · Colors  │
                    │  Character · Presets · Localization   │
                    └──────┬──────────────────┬────────────┘
                           │                  │
                  Service Binding      Service Binding
                           │                  │
                           ▼                  ▼
                   ┌──────────────┐  ┌──────────────────┐
                   │  presets-api  │  │ universalis-proxy │
                   │ (community   │  │ (market prices)   │
                   │  presets)     │  │                   │
                   └──────────────┘  └──────────────────┘
```

The new `api-worker` is a **thin HTTP layer** over the core library. It does not duplicate logic — it instantiates the same services, validates input, and serializes responses. For community presets and market data, it delegates to existing workers via Cloudflare Service Bindings (zero-latency inter-worker calls).
