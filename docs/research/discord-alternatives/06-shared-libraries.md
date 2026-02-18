# Shared Libraries — Overview

**Related documents:**
- [06a-color-blending.md](./06a-color-blending.md) — `@xivdyetools/color-blending`
- [06b-svg.md](./06b-svg.md) — `@xivdyetools/svg`
- [06c-bot-i18n.md](./06c-bot-i18n.md) — `@xivdyetools/bot-i18n`
- [06d-bot-logic.md](./06d-bot-logic.md) — `@xivdyetools/bot-logic`

---

## Motivation

The Discord Worker currently bundles significant reusable business logic — SVG card generation, command orchestration, color blending, and bot UI translations — directly inside platform-specific command handlers. Building the Stoat Bot (and any future bots for Matrix, Telegram, etc.) without extraction means reimplementing all of this logic, leading to:

- **Duplicated code** — identical SVG generators, blending algorithms, and translation engines in multiple repos
- **Visual inconsistency** — dye info cards looking different across platforms when bugs are fixed in one but not the other
- **Behavioral drift** — command logic diverging as each bot evolves independently
- **Testing burden** — same algorithms tested separately in each consumer

Extracting shared libraries solves all of these while keeping platform-specific concerns (rendering, storage, interaction models) where they belong.

---

## Existing Shared Packages

The ecosystem already follows the micro-package pattern for cross-cutting concerns:

| Package | Purpose | Used By |
|---------|---------|---------|
| `@xivdyetools/types` | Shared TypeScript type definitions | All projects |
| `@xivdyetools/core` | Dye database, color algorithms, palette extraction, localization, Universalis API | All bots, web app |
| `@xivdyetools/logger` | Structured logging with pluggable adapters (console, JSON, noop) | All projects |
| `@xivdyetools/auth` | JWT verification, HMAC signing, timing-safe comparison | API services |
| `@xivdyetools/crypto` | Base64URL encoding/decoding | Auth consumers |
| `@xivdyetools/rate-limiter` | Sliding window rate limiting (memory, KV, Upstash backends) | All bots |
| `@xivdyetools/test-utils` | Mock factories, auth helpers, domain factories | Test suites |

The gap is **domain-specific shared logic** — the SVG visualizations, command orchestration, and bot translations that are currently locked inside the Discord Worker.

---

## Proposed New Packages

| Package | Purpose | Complexity | Size Impact |
|---------|---------|------------|-------------|
| [`@xivdyetools/color-blending`](./06a-color-blending.md) | 6 color blending algorithms as pure functions | Low | ~500 lines, negligible |
| [`@xivdyetools/svg`](./06b-svg.md) | 11 SVG card generators (pure functions: data in, SVG string out) | Medium | ~2,500 lines, zero binary deps |
| [`@xivdyetools/bot-i18n`](./06c-bot-i18n.md) | Translation engine + locale JSON files for bot UI strings | Low | ~250 lines + ~50 KB JSON |
| [`@xivdyetools/bot-logic`](./06d-bot-logic.md) | Platform-agnostic command orchestration ("use case" layer) | High | ~3,000 lines |

All four packages are **pure TypeScript** with zero binary dependencies. They introduce no new WASM modules, no native binaries, and no platform-specific APIs.

---

## Dependency Graph

```
@xivdyetools/types                      (leaf — no deps)
        |
@xivdyetools/core                       (deps: types, logger)
        |
   +----+----+------------------+
   |         |                  |
   v         v                  v
 color-    svg                bot-i18n
 blending  (deps: core,       (deps: none)
 (deps:     color-blending,
  core)     types)
   |         |                  |
   +----+----+------------------+
        |
        v
   bot-logic
   (deps: core, types, svg,
    color-blending, bot-i18n)
        |
   +----+----+
   |         |
   v         v
 Discord   Stoat Bot
 Worker    (Node.js)
 (CF Workers)
```

Existing cross-cutting packages (`auth`, `logger`, `rate-limiter`, `crypto`, `test-utils`) are consumed independently by any project that needs them.

---

## What Stays Platform-Specific

These components should **NOT** be extracted into shared packages:

| Component | Discord Worker | Stoat Bot | Why Not Shared |
|-----------|---------------|-----------|----------------|
| **SVG→PNG rendering** | `@resvg/resvg-wasm` (static WASM import) | `@resvg/resvg-js` (Node.js native) | Different runtimes; each wraps `@xivdyetools/svg` output in a ~20-line platform renderer |
| **Font file loading** | Wrangler binary imports | `fs.readFileSync` | Different module systems |
| **Image processing** | `@cf-wasm/photon` | `sharp` | Different libraries (WASM heap vs native); same pipeline pattern |
| **User storage** | KV Namespace | SQLite (better-sqlite3) | Different backends, same data shapes |
| **Interaction model** | Slash commands + buttons | Prefix commands + reactions | Fundamentally different UX paradigms |
| **Response formatting** | Discord embeds (fields, footer, author) | Stoat SendableEmbed (simpler) | Different API shapes |
| **Auth verification** | Ed25519 signatures on HTTP interactions | WebSocket bot token | Different transports |
| **Pagination** | Button components + Cache API state | Reaction-based | Different interaction primitives |
| **Emoji mapping** | Discord custom emoji IDs | Masquerade avatars | Different display systems |
| **Analytics** | CF Analytics Engine (fire-and-forget) | SQLite `command_stats` table | Different storage backends |
| **Universalis client** | Service Binding + KV cache | Direct fetch + SQLite cache | Thin ~100-line clients; abstraction overhead isn't justified |

---

## Migration Strategy

### Phase 1: Foundation (low risk, no breaking changes)

1. **`@xivdyetools/color-blending`** — Single file extraction, pure functions, zero platform deps. The Discord Worker switches `import { blendColors } from './services/color-blending.js'` to `import { blendColors } from '@xivdyetools/color-blending'`. Estimated effort: 1 day.

2. **`@xivdyetools/bot-i18n`** — Extract the `Translator` class and locale JSON files. The Discord Worker's `bot-i18n.ts` becomes a thin wrapper that re-exports from the package and adds KV-based `createUserTranslator()`. Estimated effort: 1–2 days.

3. **Type promotions** — Move `BlendingMode`, `MatchingMethod`, `UserPreferences`, `Gender`, `CLANS_BY_RACE`, `BLENDING_MODES`, `MATCHING_METHODS`, and related validators from `discord-worker/src/types/preferences.ts` to `@xivdyetools/types`. These are game data, not platform data. Estimated effort: 1 day.

### Phase 2: Visual Layer (medium complexity)

4. **`@xivdyetools/svg`** — Extract all SVG generators. Depends on `@xivdyetools/color-blending` being done first (for `rgbToLab` used by `dye-info-card.ts`). The Discord Worker's `services/svg/` shrinks to just `renderer.ts` (WASM-specific) and `fonts.ts` (binary imports). Estimated effort: 3–5 days.

### Phase 3: Business Logic (high complexity, incremental)

5. **`@xivdyetools/bot-logic`** — Extract command orchestration, one command at a time. Start with simplest commands (`dye-info`, `harmony`) to establish the input/output pattern, then progress to complex commands (`budget`, `extractor`). Estimated effort: 2–3 weeks.

### Phase 4: Stoat Bot

6. Build `xivdyetools-stoat-bot` consuming all shared packages, with platform-specific implementations for rendering (`@resvg/resvg-js`), image processing (`sharp`), storage (SQLite), and revolt.js integration.

---

## Bundle Size Impact

Net change for the Discord Worker should be approximately **zero**. This is a reorganization, not an addition — each extracted module replaces its current inline equivalent 1:1.

| Package | Content | Tree-shakeable? |
|---------|---------|-----------------|
| `@xivdyetools/color-blending` | ~500 lines of pure math | Yes |
| `@xivdyetools/svg` | ~2,500 lines of string builders | Yes |
| `@xivdyetools/bot-i18n` | ~250 lines + ~50 KB locale JSON | Partial (JSON always bundled) |
| `@xivdyetools/bot-logic` | ~3,000 lines replacing existing handlers | Yes |

Current Discord Worker bundle: **~8 MiB** (gzip: ~2.4 MiB) against the 10 MiB paid plan limit. No new binary dependencies are introduced.

---

## Font & Asset Handling

| Asset | Lives In | Rationale |
|-------|----------|-----------|
| Font `.ttf` files (Space Grotesk, Onest, Habibi, Noto Sans SC/KR subsets) | Each bot's repo | Font *loading* is platform-specific (wrangler binary import vs. `fs.readFileSync`) |
| Font family NAME strings (`FONTS` constant) | `@xivdyetools/svg` | SVG generators reference names in `font-family` attributes |
| `THEME` color constants | `@xivdyetools/svg` | All cards use the same dark theme |
| Bot UI locale JSON files | `@xivdyetools/bot-i18n` | Shipped as package data |
| Dye data + dye locale data | `@xivdyetools/core` (unchanged) | Already shared |

If font file duplication across bot repos becomes a maintenance burden, a future `@xivdyetools/fonts` asset package could be considered. This is premature given fonts only change when new dyes are added to the game (requiring re-subsetting).

---

## Testing Strategy

Each shared package gets its own test suite following the established Vitest pattern:

| Package | Test Approach |
|---------|---------------|
| `color-blending` | Unit tests: verify blending algorithms produce correct RGB outputs for known color pairs; snapshot tests for regression |
| `svg` | Unit tests: verify SVG output contains expected elements; snapshot tests for layout stability; integration tests with `@resvg/resvg-js` for visual regression |
| `bot-i18n` | Unit tests: key lookup, interpolation, fallback behavior, missing keys; locale file completeness checks |
| `bot-logic` | Unit tests with mock dependencies: verify correct SVG generation, embed data, error handling; existing `@xivdyetools/test-utils` factories for Dye mocks |

Existing Discord Worker tests that cover SVG generation and blending algorithms migrate to the respective package test suites. The Discord Worker's test suite shrinks to cover only platform-specific logic (Discord API interaction, KV storage, WASM rendering).
