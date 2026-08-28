# Dependency Graph

**Package dependencies and consumption relationships across the XIV Dye Tools ecosystem**

---

## npm Package Dependencies

```mermaid
graph TD
    subgraph "Shared Packages (Monorepo 2.0 — 8 packages)"
        TYPES["@xivdyetools/types<br/>v1.16.0"]
        LOGGER["@xivdyetools/logger<br/>v1.3.0"]
        AUTH["@xivdyetools/auth<br/>v1.3.0 (incl. /encoding)"]
        WKIT["@xivdyetools/worker-kit<br/>v1.0.0 (middleware + /rate-limiter)"]
        TEST["@xivdyetools/test-utils<br/>v1.1.8 (workspace-private)"]
        CORE["@xivdyetools/core<br/>v3.0.0 (incl. /blending, schema-v2 data)"]
        SVG["@xivdyetools/svg<br/>v1.2.1"]
        BOTLOGIC["@xivdyetools/bot-logic<br/>v1.4.0 (incl. /i18n)"]
    end

    subgraph "Consumer Applications"
        WEB["xivdyetools-web-app"]
        DISCORD["xivdyetools-discord-worker"]
        MODBOT["xivdyetools-moderation-worker"]
        OAUTH["xivdyetools-oauth"]
        PRESETS["xivdyetools-presets-api"]
        OG["xivdyetools-og-worker"]
        APIWORKER["xivdyetools-api-worker"]
        STOAT["xivdyetools-stoat-worker"]
        IMGWORKER["xivdyetools-image-worker"]
    end

    %% Foundation dependencies
    TYPES --> CORE
    TYPES --> TEST
    AUTH --> TEST
    LOGGER --> CORE
    LOGGER --> WKIT

    %% Feature package dependencies
    CORE --> SVG
    CORE --> BOTLOGIC
    SVG --> BOTLOGIC
    TYPES --> SVG
    TYPES --> BOTLOGIC

    %% Consumer dependencies
    CORE --> WEB
    CORE --> DISCORD
    CORE --> OG
    CORE --> APIWORKER
    CORE --> STOAT
    BOTLOGIC --> DISCORD
    BOTLOGIC --> MODBOT
    BOTLOGIC --> STOAT
    SVG --> DISCORD
    SVG --> OG
    SVG --> STOAT
    AUTH --> DISCORD
    AUTH --> MODBOT
    AUTH --> OAUTH
    AUTH --> PRESETS
    WKIT --> DISCORD
    WKIT --> MODBOT
    WKIT --> OAUTH
    WKIT --> PRESETS
    WKIT --> OG
    WKIT --> APIWORKER
    WKIT --> STOAT
    WKIT --> IMGWORKER
    LOGGER --> WEB
    LOGGER --> DISCORD
    LOGGER --> MODBOT
    LOGGER --> OAUTH
    LOGGER --> PRESETS
    LOGGER --> OG
    LOGGER --> APIWORKER
    LOGGER --> STOAT
    TYPES --> WEB
    TYPES --> DISCORD
    TYPES --> MODBOT
    TYPES --> OAUTH
    TYPES --> PRESETS
    TYPES --> OG
    TYPES --> APIWORKER
    TYPES --> STOAT
    DISCORD -. Service Binding .-> IMGWORKER

    %% Test utils (dev dependency)
    TEST -.-> CORE
    TEST -.-> WEB
    TEST -.-> DISCORD
    TEST -.-> OAUTH
    TEST -.-> PRESETS
    TEST -.-> APIWORKER

    %% API docs documents the API worker

    classDef npm fill:#fff3e0,stroke:#e65100
    classDef consumer fill:#e8f5e9,stroke:#2e7d32

    class TYPES,LOGGER,AUTH,WKIT,TEST,CORE,SVG,BOTLOGIC npm
    class WEB,DISCORD,MODBOT,OAUTH,PRESETS,OG,APIWORKER,STOAT,IMGWORKER consumer
```

---

## Dependency Matrix

### Shared Packages

| Package | Depends On | Used By |
|---------|------------|---------|
| **@xivdyetools/types** | — | All projects |
| **@xivdyetools/logger** | — | All projects |
| **@xivdyetools/auth** (incl. `/encoding`) | — | oauth, discord-worker, moderation-worker, presets-api, test-utils |
| **@xivdyetools/worker-kit** (middleware + `/rate-limiter`) | logger | discord-worker, moderation-worker, oauth, presets-api, og-worker, api-worker, stoat-worker, image-worker |
| **@xivdyetools/test-utils** (workspace-private) | auth, types | All projects (devDependency) |
| **@xivdyetools/core** (incl. `/blending`) | types, logger | web-app, discord-worker, og-worker, api-worker, stoat-worker, svg, bot-logic |
| **@xivdyetools/svg** | core, types | discord-worker, og-worker, stoat-worker, bot-logic |
| **@xivdyetools/bot-logic** (incl. `/i18n`) | core, svg, types | discord-worker, moderation-worker, stoat-worker |

### Consumer Applications

| Project | Runtime Dependencies | Test Dependencies |
|---------|----------------------|-------------------|
| **web-app** | core, types, logger, lit, vite | test-utils, vitest, playwright |
| **discord-worker** | core, types, logger, auth, worker-kit, svg, bot-logic, hono | test-utils, vitest |
| **moderation-worker** | types, logger, auth, worker-kit, bot-logic, hono | test-utils, vitest |
| **oauth** | types, logger, auth, worker-kit, hono | test-utils, vitest |
| **presets-api** | types, logger, auth, worker-kit, hono | test-utils, vitest |
| **og-worker** | core, types, svg, logger, worker-kit, hono, @resvg/resvg-wasm | vitest |
| **api-worker** | core, types, logger, worker-kit, hono | test-utils, vitest |
| **stoat-worker** | core, types, logger, worker-kit, bot-logic, svg, revolt.js | test-utils, vitest |
| **image-worker** | worker-kit, hono, @cf-wasm/photon | vitest |

---

## Core Library Internal Structure

```
@xivdyetools/core (v3.0.0)
├── blending/                ← self-contained blending algorithms (subpath @xivdyetools/core/blending)
├── services/
│   ├── ColorService.ts      ← ColorConverter, ColorAccessibility, ColorManipulator
│   ├── DyeService.ts        ← DyeDatabase (k-d tree), DyeSearch, HarmonyGenerator
│   ├── APIService.ts        ← Universalis API wrapper with LRU cache + metrics
│   ├── PaletteService.ts    ← K-means++ clustering algorithm
│   ├── PresetService.ts     ← Curated preset palettes, ResolvedPreset
│   └── LocalizationService.ts
├── config/
│   ├── consolidated-ids.ts  ← Patch 7.5 dye consolidation (Type-A=52254, B=52255, C=52256)
│   └── dye-vocabulary.ts    ← Closed vocabularies + acquisition → (price, currency) coupling
├── data/
│   ├── dyes.json            ← 125 standard dyes (schema v2: 7 fields, stainID-keyed; rgb/hsv/cost/flags derived at initialize())
│   └── facewear_colors.json ← 11 Facewear colors (NOT dyes — facewearColors export)
└── locales/
    └── {en,ja,de,fr,ko,zh}.json

Notes:
- As of v2.0.0, type re-exports are removed. Import Dye, RGB, HexColor, etc. from
  @xivdyetools/types directly. 28 internal symbols are marked @internal and excluded
  from the barrel export.
- As of v2.6.0, ALLIED_SOCIETY_ACQUISITIONS is removed. Patch 7.5 collapsed those
  vendor categories out of the dye database.
- As of v3.0.0 (schema v2), the data file is dyes.json (125 entries, stainID-keyed).
  The 11 Facewear colours moved to facewear_colors.json / the facewearColors export.
```

---

## Third-Party Dependencies by Project

### xivdyetools-web-app

| Package | Version | Purpose |
|---------|---------|---------|
| `lit` | ^3.1 | Web components framework |
| `vite` | ^6.x | Build tool and dev server |
| `tailwindcss` | ^4.2 | Utility-first CSS |

### xivdyetools-discord-worker

| Package | Version | Purpose |
|---------|---------|---------|
| `hono` | ^4.12.34 | HTTP framework for Workers (floor set by FINDING-001: CORS ReDoS) |
| `discord-interactions` | ^4.4 | Ed25519 signature verification |
| `@resvg/resvg-wasm` | ^2.6 | SVG to PNG rendering |

`@cf-wasm/photon` moved to `xivdyetools-image-worker` (see below) — see
`docs/operations/IMAGE_WORKER_SPLIT.md` for why.

### xivdyetools-image-worker

| Package | Version | Purpose |
|---------|---------|---------|
| `hono` | ^4.12.34 | HTTP framework for Workers |
| `@cf-wasm/photon` | ^0.3 | Image decode/resize/pixel-extraction (WASM) — the sole reason this Worker exists |

### xivdyetools-oauth / presets-api / moderation-worker

| Package | Version | Purpose |
|---------|---------|---------|
| `hono` | ^4.12.34 | HTTP framework for Workers (floor set by FINDING-001: CORS ReDoS) |

### xivdyetools-stoat-worker

| Package | Version | Purpose |
|---------|---------|---------|
| `revolt.js` | ^7.1 | Revolt API client |

---

## Version Synchronization

Internal dependencies use the `workspace:*` protocol and resolve automatically within the pnpm monorepo.

When updating a **shared package** (e.g., `@xivdyetools/core`):

1. Make changes in `packages/core/`
2. Build and test:
   ```bash
   pnpm turbo run build test --filter=@xivdyetools/core
   ```
3. Bump version in `packages/core/package.json` and merge to `main`
4. Publish via the **Publish Packages to npm** workflow (Actions → run with
   package `@xivdyetools/core`). It authenticates using trusted publishing
   (OIDC); there is no npm token. See the root `CLAUDE.md` for the full flow.
5. Consumer apps automatically use the latest workspace version in development. For production deploys, rebuild and redeploy affected consumers.

### Breaking Change Protocol

If a core library change is breaking:

1. Increment major version (e.g., 1.17.2 → 2.0.0)
2. Update all consumers to handle breaking changes
3. Update minimum version in compatibility matrix ([versions.md](../versions.md))

---

## Related Documentation

- [Service Bindings](service-bindings.md) - Worker-to-worker communication
- [API Contracts](api-contracts.md) - Inter-service API specifications
- [Versions](../versions.md) - Current version matrix
