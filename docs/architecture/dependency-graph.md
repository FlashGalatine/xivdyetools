# Dependency Graph

**Package dependencies and consumption relationships across the XIV Dye Tools ecosystem**

---

## npm Package Dependencies

```mermaid
graph TD
    subgraph "npm Registry — Shared Packages"
        TYPES["@xivdyetools/types<br/>v1.9.0"]
        CRYPTO["@xivdyetools/crypto<br/>v1.1.0"]
        LOGGER["@xivdyetools/logger<br/>v1.2.2"]
        AUTH["@xivdyetools/auth<br/>v1.1.1"]
        RATELIMIT["@xivdyetools/rate-limiter<br/>v1.4.3"]
        TEST["@xivdyetools/test-utils<br/>v1.1.5"]
        CORE["@xivdyetools/core<br/>v2.0.1"]
        SVG["@xivdyetools/svg<br/>v1.1.2"]
        BLEND["@xivdyetools/color-blending<br/>v1.0.1"]
        BOTLOGIC["@xivdyetools/bot-logic<br/>v1.1.2"]
        BOTI18N["@xivdyetools/bot-i18n<br/>v1.1.0"]
    end

    subgraph "Consumer Applications"
        WEB["xivdyetools-web-app"]
        DISCORD["xivdyetools-discord-worker"]
        MODBOT["xivdyetools-moderation-worker"]
        OAUTH["xivdyetools-oauth"]
        PRESETS["xivdyetools-presets-api"]
        PROXY["xivdyetools-universalis-proxy"]
        OG["xivdyetools-og-worker"]
        STOAT["xivdyetools-stoat-worker"]
        MAINT["xivdyetools-maintainer"]
    end

    %% Foundation dependencies
    TYPES --> CORE
    TYPES --> LOGGER
    TYPES --> AUTH
    TYPES --> TEST
    CRYPTO --> AUTH
    LOGGER --> CORE

    %% Feature package dependencies
    CORE --> SVG
    CORE --> BLEND
    CORE --> BOTLOGIC
    SVG --> BOTLOGIC
    BLEND --> BOTLOGIC
    BOTI18N --> BOTLOGIC
    TYPES --> SVG
    TYPES --> BOTLOGIC

    %% Consumer dependencies
    CORE --> WEB
    CORE --> DISCORD
    CORE --> OG
    CORE --> MAINT
    BOTLOGIC --> DISCORD
    BOTLOGIC --> STOAT
    SVG --> DISCORD
    SVG --> OG
    BOTI18N --> DISCORD
    BOTI18N --> STOAT
    BLEND --> DISCORD
    BLEND --> STOAT
    AUTH --> DISCORD
    AUTH --> MODBOT
    AUTH --> PRESETS
    RATELIMIT --> DISCORD
    RATELIMIT --> MODBOT
    RATELIMIT --> OAUTH
    RATELIMIT --> PRESETS
    RATELIMIT --> PROXY
    RATELIMIT --> STOAT
    LOGGER --> WEB
    LOGGER --> DISCORD
    LOGGER --> MODBOT
    LOGGER --> OAUTH
    LOGGER --> PRESETS
    LOGGER --> PROXY
    LOGGER --> OG
    LOGGER --> STOAT
    TYPES --> WEB
    TYPES --> DISCORD
    TYPES --> MODBOT
    TYPES --> OAUTH
    TYPES --> PRESETS
    TYPES --> OG
    TYPES --> STOAT

    %% Test utils (dev dependency)
    TEST -.-> CORE
    TEST -.-> WEB
    TEST -.-> DISCORD
    TEST -.-> OAUTH
    TEST -.-> PRESETS

    classDef npm fill:#fff3e0,stroke:#e65100
    classDef consumer fill:#e8f5e9,stroke:#2e7d32

    class TYPES,CRYPTO,LOGGER,AUTH,RATELIMIT,TEST,CORE,SVG,BLEND,BOTLOGIC,BOTI18N npm
    class WEB,DISCORD,MODBOT,OAUTH,PRESETS,PROXY,OG,STOAT,MAINT consumer
```

---

## Dependency Matrix

### Shared Packages

| Package | Depends On | Used By |
|---------|------------|---------|
| **@xivdyetools/types** | — | All projects |
| **@xivdyetools/crypto** | — | @xivdyetools/auth |
| **@xivdyetools/logger** | — | All projects except crypto, maintainer |
| **@xivdyetools/auth** | crypto | discord-worker, moderation-worker, presets-api |
| **@xivdyetools/rate-limiter** | — | discord-worker, moderation-worker, oauth, presets-api, universalis-proxy, stoat-worker |
| **@xivdyetools/test-utils** | types, crypto | All projects (devDependency) |
| **@xivdyetools/core** | types, logger | web-app, discord-worker, og-worker, maintainer |
| **@xivdyetools/color-blending** | core | discord-worker, stoat-worker |
| **@xivdyetools/svg** | core, color-blending, types | discord-worker, og-worker |
| **@xivdyetools/bot-logic** | core, bot-i18n, color-blending, svg, types | discord-worker, stoat-worker |
| **@xivdyetools/bot-i18n** | — | discord-worker, stoat-worker |

### Consumer Applications

| Project | Runtime Dependencies | Test Dependencies |
|---------|----------------------|-------------------|
| **web-app** | core, types, logger, lit, vite | test-utils, vitest, playwright |
| **discord-worker** | core, types, logger, auth, rate-limiter, svg, bot-logic, bot-i18n, color-blending, hono, @resvg/resvg-wasm, @cf-wasm/photon | test-utils, vitest |
| **moderation-worker** | types, logger, auth, rate-limiter, hono | test-utils, vitest |
| **oauth** | types, logger, crypto, rate-limiter, hono | test-utils, vitest |
| **presets-api** | types, logger, auth, crypto, rate-limiter, hono | test-utils, vitest |
| **universalis-proxy** | rate-limiter, hono | vitest |
| **og-worker** | core, types, svg, hono, @resvg/resvg-wasm | vitest |
| **stoat-worker** | core, types, logger, rate-limiter, bot-logic, bot-i18n, color-blending, svg, revolt.js | vitest |
| **maintainer** | core, vue, express, zod | vitest |

---

## Core Library Internal Structure

```
@xivdyetools/core (v2.0.0+)
├── services/
│   ├── ColorService.ts      ← ColorConverter, ColorAccessibility, ColorManipulator
│   ├── DyeService.ts        ← DyeDatabase (k-d tree), DyeSearch, HarmonyGenerator
│   ├── APIService.ts        ← Universalis API wrapper with LRU cache + metrics
│   ├── PaletteService.ts    ← K-means++ clustering algorithm
│   ├── PresetService.ts     ← Curated preset palettes, ResolvedPreset
│   └── LocalizationService.ts
├── data/
│   └── dyes.json            ← 136 official FFXIV dyes
└── locales/
    └── {en,ja,de,fr,ko,zh}.json

Note: As of v2.0.0, type re-exports are removed.
Import Dye, RGB, HexColor, etc. from @xivdyetools/types directly.
28 internal symbols are marked @internal and excluded from the barrel export.
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
| `hono` | ^4.12 | HTTP framework for Workers |
| `discord-interactions` | ^4.4 | Ed25519 signature verification |
| `@resvg/resvg-wasm` | ^2.6 | SVG to PNG rendering |
| `@cf-wasm/photon` | ^0.3 | Image processing (dominant color) |

### xivdyetools-oauth / presets-api / moderation-worker / universalis-proxy

| Package | Version | Purpose |
|---------|---------|---------|
| `hono` | ^4.12 | HTTP framework for Workers |

### xivdyetools-stoat-worker

| Package | Version | Purpose |
|---------|---------|---------|
| `revolt.js` | ^7.1 | Revolt API client |

### xivdyetools-maintainer

| Package | Version | Purpose |
|---------|---------|---------|
| `vue` | ^3.5 | Frontend framework |
| `express` | ^5.2 | Backend HTTP server |
| `zod` | ^4.3 | Schema validation |

---

## Version Synchronization

Internal dependencies use the `workspace:*` protocol and resolve automatically within the pnpm monorepo.

When updating a **shared package** (e.g., `@xivdyetools/core`):

1. Make changes in `packages/core/`
2. Build and test:
   ```bash
   pnpm turbo run build test --filter=@xivdyetools/core
   ```
3. Bump version in `packages/core/package.json`
4. Publish:
   ```bash
   pnpm --filter @xivdyetools/core publish --provenance --access public --no-git-checks
   ```
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
