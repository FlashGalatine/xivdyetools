# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workspace Overview

This is the **XIV Dye Tools** monorepo: a pnpm workspace using Turborepo containing all shared libraries, Cloudflare Workers, and web applications for the Final Fantasy XIV color/dye toolkit. Each package and app has its own `CLAUDE.md` with project-specific guidance.

## Repository Structure

```
xivdyetools/
├── packages/                # Shared libraries (@xivdyetools scope, published to npm)
│   ├── types/               # Branded types (HexColor, DyeId, etc.) and shared interfaces
│   ├── logger/              # Multi-runtime logging with secret redaction
│   ├── auth/                # JWT verification, HMAC signing, Discord Ed25519, Base64URL/hex (/encoding)
│   ├── worker-kit/          # Worker toolkit: Hono middleware + sliding-window rate limiting (Memory, KV, Upstash, Cloudflare native binding)
│   ├── core/                # Color algorithms, dye database (125 dyes, schema v2) + separate facewearColors (11), k-d tree, 6-language i18n, /blending
│   ├── svg/                 # Pure SVG card generators on the 5.0 frame system (data → SVG string) + shared glyph set
│   ├── bot-logic/           # Platform-agnostic Discord/Revolt command business logic + bot UI i18n (/i18n)
│   └── test-utils/          # CF Workers mocks (D1, KV, R2) and test factories (workspace-private, not published)
├── apps/                    # Applications
│   ├── discord-worker/        # Primary Discord bot (CF Worker + Hono, 17 registered slash commands — see src/commands/registry.ts)
│   ├── image-worker/          # Photon pixel extraction, service-binding-only (CF Worker)
│   ├── moderation-worker/     # Moderation bot for community presets (CF Worker)
│   ├── presets-api/           # Community presets REST API (CF Worker + D1)
│   ├── oauth/                 # Discord OAuth + JWT issuance (CF Worker + D1)
│   ├── api-worker/            # Public dye/color-matching API + absorbed Universalis proxy + VitePress docs (CF Worker + KV)
│   ├── og-worker/             # Dynamic OpenGraph image generation (CF Worker)
│   ├── stoat-worker/          # Revolt chat bot (Node.js + revolt.js, NOT a CF Worker)
│   └── web-app/               # Main web app with 9 color tools (Vite + Lit + Tailwind)
├── docs/                    # Architecture, specs, deployment guides, research
└── scripts/                 # Repo-level utility scripts
```

## Dependency Flow

```
types, logger, auth (incl. /encoding) ─────────────────────────┐ (Level 0: no internal deps)
worker-kit (→ logger; incl. /rate-limiter) ────────────────────┤ (Level 1 — workers only)
core (→ types, logger; incl. /blending) ───────────────────────┤ (Level 1)
test-utils (→ auth, types; private) ───────────────────────────┤ (Level 1)
svg (→ core, types) ───────────────────────────────────────────┤ (Level 2)
bot-logic (→ core, svg, types; incl. /i18n) ───────────────────┤ (Level 3)
                                                                │
                            Applications ◄─────────────────────┘
```

`stoat-worker` consumes `bot-logic` (incl. its `/i18n` engine) so it shares command logic with `discord-worker` despite running on Node.js + Revolt instead of Cloudflare + Discord — `svg`, `core`, and `worker-kit` were dropped from its dependencies in Task 6 (it renders no cards and needs no Workers-only middleware).

## Common Commands

All commands run from the **repository root**:

```bash
pnpm install                          # Install all workspace dependencies
pnpm turbo run build                  # Build all packages (respects dependency order)
pnpm turbo run test                   # Test all packages
pnpm turbo run type-check             # Type-check all packages
pnpm turbo run lint                   # Lint all packages
pnpm coverage:report                  # Aggregate coverage vs baselines (90% packages / 80% apps).
                                      # Reads each workspace's coverage/coverage-summary.json, so
                                      # run the coverage suites first — it silently skips any
                                      # workspace that has no summary yet.
pnpm type-check:scripts               # Type-check scripts/ (permanent tsconfig, not a throwaway)
pnpm test:scripts                     # Self-test the dead-code reachability checker (node:test)
pnpm dead-code:check                  # Test-only reachability gate — tags/limits under Tooling below

# Filter to specific packages/apps
pnpm turbo run build --filter=@xivdyetools/core
pnpm turbo run test --filter=xivdyetools-discord-worker
pnpm turbo run build --filter='./packages/*'
pnpm turbo run test --filter='./apps/*'

# Run a single test file
pnpm --filter @xivdyetools/core exec vitest run src/path/to/file.test.ts

# Dev servers
pnpm --filter xivdyetools-web-app run dev          # Vite, localhost:5173
pnpm --filter xivdyetools-discord-worker run dev   # Wrangler local
pnpm --filter xivdyetools-api-worker run docs:dev  # VitePress docs site (absorbed into api-worker)
pnpm --filter xivdyetools-stoat-worker run dev     # tsx watch (Node.js)
```

Workers additionally support:

```bash
pnpm --filter xivdyetools-discord-worker run deploy              # BETA bot (…-dev, *.workers.dev)
# NOTE: a bare `deploy` targets the routeless `…-dev` worker on discord-worker /
# moderation-worker / presets-api / api-worker / image-worker, and the ROUTED BETA
# worker on og-worker (beta.xivdyetools.app). Production needs `--env production`.
# `oauth` is the INVERSE: it has no [env.production] — a bare `wrangler deploy` IS
# the production deploy. Check the wrangler.toml first; see
# docs/operations/DEPLOY_ENVIRONMENTS.md.
pnpm --filter xivdyetools-discord-worker run deploy:production   # Production
```

## Key Technical Details

### Tooling
- **pnpm 11.17** with `workspace:*` protocol for internal dependencies; workspace-level settings (overrides, `allowBuilds` script policy, `minimumReleaseAge` supply-chain window) live in `pnpm-workspace.yaml`
- **Turborepo 2.10** for task orchestration with dependency-aware caching
- **TypeScript 5.9** with shared `tsconfig.base.json` (strict, ES2022, bundler resolution, `verbatimModuleSyntax`)
- **Vitest 4** for all packages and apps; **Playwright** for `web-app` E2E
- **ESLint 10** flat config with typescript-eslint
- **Prettier 3** for formatting
- **knip 6** for dead code. The root `knip.jsonc` is the monorepo graph; `packages/{core,svg,bot-logic}` are gated on it via their own `lint:dead` (`knip --directory ../.. --workspace packages/<p>`, part of `lint`), while `apps/web-app` and `apps/og-worker` keep their own per-app `knip.jsonc`. Those three packages run with `includeEntryExports`, so a **barrel export nothing in the monorepo imports fails `lint` unless its specifier carries a `/** @public */` tag** (`"tags": ["-public"]`) — `@public` meaning "published npm API, deliberately kept without an in-repo consumer". All eight apps except `stoat-worker` are now gated via their own `lint:dead` scripts. `pnpm lint:dead` at the root sweeps every workspace; as of 2026-09-01, it reports 4 known-and-documented findings: 3 from `apps/web-app` (2 unused `.d.ts` files + 1 kept `wrangler` devDependency, all ignored by web-app's local `knip.jsonc` but visible at root due to config scope divergence) and 1 from `packages/logger` (duplicate export). The logger item will clear when logger is gated in Phase 3; the web-app items are root-vs-local artifacts regardless. Until the five ungated packages (`auth`, `logger`, `types`, `worker-kit`, `test-utils`) join the gate, the root sweep serves as a reference point, not a gate; the per-package `lint` commands above are the actual gate.
- **Dead-code reachability gate** (`pnpm dead-code:check` → `scripts/check-dead-code.ts`, self-tested by `pnpm test:scripts`; both run in CI immediately after `Type-check (affected)`, alongside a permanent `pnpm type-check:scripts` for the `scripts/` directory itself) closes a gap knip cannot: modules, exports, and **class members** reachable only from test files. knip treats every test file as an entry, so anything a test imports counts as used, and knip 6 dropped its `classMembers` rule entirely — a dead public method is invisible to it no matter how it's configured. Three exemption tags, asymmetric on purpose: `@testonly <reason>` (only tests reach this; it may be deletable) and `@entrypoint <reason>` (reached only by an external convention static analysis can't see — Pages `functions/`, a CLI script run from `package.json`; must never be deleted) both require a reason, a bare tag fails the gate, while `@public` (published `@xivdyetools/*` API with no in-repo consumer) does not, matching knip's own `"tags": ["-public"]` convention.

  Known limits, so a maintainer who hits one recognises it instead of distrusting the gate:
  - Reference matching runs on raw file text, so a name inside a comment, a JSDoc `@example`, or a `vitest.config.ts` coverage glob can mask an export- or member-level finding by looking like a reference (orphan-module/file-level matching is import-specifier-shaped only — `extractSpecifiers` — so a glob string cannot touch it) — under-reports, the safe direction. The converse is deliberate: per the checker's own leading docblock, "candidates come from MASKED text; references and exemption tags come from RAW text," so a declaration-shaped line inside a comment or template can never invent a candidate that does not exist.
  - Regex literals are never masked (telling a regex `/` from division needs the preceding token, a parser's job), so a quote or backtick inside one throws the span tracker off — a backtick opens a template that runs to end of file, and a quote can swallow a real backtick later on the same line with the same effect; either way the checker falls back to raw text for candidacy on that whole file — over-reports, but bounded to that file. Recount at any time: over `listTracked()`, a file where `declarationLines(text)` differs from `maskSource(text).split('\n')` fell back (3 differ at HEAD).
  - A member reached only through a computed bracket key (`obj[name]()`) is invisible to the reference scan and gets reported as a false positive — tag it `@entrypoint` naming the call site.
  - A member with zero references from any test file is outside both tools' visibility — knip has no class-member rule, and this checker needs at least one test importer before it will flag anything — so it still needs a manual survey; `SavedPresetsService.__reloadForTesting` was one, found and removed by hand during the gate's 2026-09-01 rollout.
  - **Self-reference trap:** a tag's own reason prose is matched as raw text too, so a reason that names a sibling symbol in the same production file (a dotted `.method` or a bare export name) becomes a "reference" to that sibling and silently drops it from both the violation and exempt lists with no error and exit 0 — write reasons that name the test file and behaviour, never a neighbouring symbol, and after tagging diff the `ℹ … exempt` counts against the pre-tag violation count to catch a shortfall. (`scripts/check-dead-code.ts` and its test are excluded as referrers, so this doc's own prose — which names real symbols throughout — can never trigger it.)
  - Class-member candidacy is depth-aware — a `MEMBER_DECL` match nested deeper than its class's own body (a bare call statement inside a method) is not a candidate — but an unbalanced brace inside an unmasked regex literal in a class body inflates that depth count, so, per `attributeLinesToBlocks`'s docblock, "every member declared after it in that class reads as nested rather than direct and `findTestOnlyMembers` drops it as a candidate — until the next column-0 declaration resyncs" (under-reports, bounded to that one class).

  Before committing: `pnpm turbo run build type-check lint test && pnpm test:scripts && pnpm dead-code:check`.

### `verbatimModuleSyntax` Caveat
The base tsconfig enables `verbatimModuleSyntax`, so type-only imports must be explicitly marked: `import type { Foo } from '...'`. A regular `import { Foo }` for something only used as a type is a compile error.

### Inter-Worker Communication
Workers communicate via Cloudflare **Service Bindings** (direct Worker-to-Worker, no HTTP overhead):

```
discord-worker ──► presets-api
discord-worker ──► image-worker        (POST /extract — palette pixels)
discord-worker ──► api-worker          (UNIVERSALIS_PROXY binding — market prices for /budget)
moderation-worker ──► presets-api
presets-api ──► discord-worker (notifications)
presets-api ──► image-worker           (POST /thumbnail — preview images)
api-worker ──► (standalone, public-facing)
```

All Cloudflare Workers use **Hono** (`^4.12.34` floor) as the HTTP framework and consume `@xivdyetools/worker-kit` for request-ID / logger / rate-limit middleware. Persistence is **D1** (SQLite): `presets-api` owns `xivdyetools-presets` (also bound read/write by `moderation-worker` — `discord-worker`'s own D1 binding was removed, DEAD-007; it reaches preset data only through the `presets-api` service binding), `oauth` owns `xivdyetools-users`; `presets-api` additionally stores preview images in R2.

### Localization
6 languages throughout: `en`, `ja`, `de`, `fr`, `ko`, `zh`
- XIVAPI v2 only serves en/ja/de/fr; Korean and Chinese names are manually sourced
- Locale pipeline: `fetch_dye_names.py` → `dyenames.csv` → `build-locales.ts` → JSON
- CJK rendering needs subset fonts (Noto Sans JP + SC + KR, regenerated by each worker's `scripts/subset-cjk-fonts.py`) in SVG-to-PNG rendering

### Dye Database Composition (schema v2, since 2026-07-31)
The dye database is **125 standard dyes** in `packages/core/src/data/dyes.json` — 7 fields per entry (`stainID` [canonical key], `name`, `hex`, `category`, `acquisition`, `consolidationType`, `legacyItemID`). Everything else (`rgb`/`hsv`/`lab`, `cost`/`currency` via `ACQUISITION_META`, the five `is*` flags) is **derived at `DyeDatabase.initialize()`** — the runtime `Dye` object keeps its full 16-field shape, and `Dye.itemID` remains a `number` (= `legacyItemID`, falling back to `stainID` for future consolidated-only dyes). `isMetallic` = the Stain sheet's gloss set (`METALLIC_STAIN_IDS`, 16); `isCosmic ≡ consolidationType 'C'`; `isIshgardian ≡ 'B'`.

The **11 Facewear colors are NOT dyes** — they live in `facewear_colors.json` / the `facewearColors` export (`FacewearColor`: string slug `id`, `name`, `hex`). The pre-v2 synthetic negative itemIDs survive only as the frozen `LEGACY_FACEWEAR_ITEM_IDS` compatibility map (`getFacewearColorByLegacyItemID()`).

## Publishing Libraries to npm

All 7 publishable packages — types, logger, auth, worker-kit, core, svg, bot-logic — publish through the **Publish Packages to npm** GitHub Actions workflow (`workflow_dispatch`), which authenticates with npm via **trusted publishing (OIDC)**. (`@xivdyetools/test-utils` is the 8th package; it is workspace-private and not published.) There is no npm token anywhere in CI — the workflow's `id-token: write` permission mints a short-lived credential from its own GitHub identity, which also signs the provenance attestation.

```bash
# 1. Make changes in packages/<name>/
# 2. Build and test
pnpm turbo run build test --filter=@xivdyetools/<name>

# 3. Bump version in packages/<name>/package.json and merge to main
# 4. Actions → "Publish Packages to npm" → package: @xivdyetools/<name>
#    (or "all-modified" to publish everything whose version differs from npm)
```

**A version bump is required.** The workflow's `detect` job only publishes a package when its local version differs from the published one; with versions at parity it does nothing.

**Local publishing is deliberately not a normal path.** Every package is set to *"Require two-factor authentication and disallow tokens"*, so an unattended local publish is impossible by design. The break-glass case is a **new package's first version** (OIDC cannot create a package that doesn't exist yet — `worker-kit` on 2026-08-28 was the last one). The maintainer's 2FA is a security key, not an OTP app, so the flow is token-based, not `--otp`:

1. Log in to npmjs.com (security key) → *Access Tokens* → generate a **granular access token**: scope `@xivdyetools` read + write, **Bypass 2FA** on, a short expiry.
2. Put it in the **user-level** `~/.npmrc` (`//registry.npmjs.org/:_authToken=…`) — never the committed repo `.npmrc`.
3. Build and publish **without `--provenance`** (provenance generation only works inside CI and aborts a local publish):

```bash
pnpm turbo run build --filter=@xivdyetools/<name>
pnpm --filter @xivdyetools/<name> publish --access public --no-git-checks
```

4. On npmjs.com set the new package to *Require two-factor authentication and disallow tokens*, add its trusted publisher (below), then delete the token and the `~/.npmrc` line.

Writes to a package that *already* disallows tokens (`npm deprecate`, a re-publish) reject the token with `Two-factor authentication is required to publish this package but an automation token was specified` — for those, `npm login --auth-type=web` (the browser prompt takes the security key) and rerun.

**Trusted publisher config** (npmjs.com → package → Settings): GitHub Actions, `FlashGalatine/xivdyetools`, workflow `publish-packages.yml`, environment `production` (the publish job runs in that environment), permission `npm publish`. A new package needs this configured before the workflow can publish it.

pnpm 11 publishes natively and performs the OIDC exchange itself — no npm CLI involvement. (Under pnpm 10 the publish was delegated to npm, which needed an explicit upgrade to ≥ 11.5.1 for OIDC support; that workflow step was removed with the pnpm 11 migration.)

`@xivdyetools/core`'s `build` script runs `build:locales` → `tsc` → `copy:locales`. `build:locales` regenerates from `dyenames.csv` / `localize.yaml`, so hand-edits to the generated locale JSON are overwritten — fold corrections into the source files instead.

## CI/CD

- **CI**: lint, type-check, test, build on affected packages (push/PR)
- **Deploy**: path-filtered workflows per worker (push to main + manual dispatch)
- **Publish**: manual `workflow_dispatch` to publish a selected npm package, authenticated via OIDC trusted publishing (no token)
- **Secrets**: `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` for the 8 production deploy workflows; the 3 `*-beta.yml` workflows use a separate `CLOUDFLARE_API_TOKEN_BETA` instead (2026-08-29 FINDING-028)

## Documentation Hub

`docs/` contains architecture overviews, API contracts, deployment guides, and specs — its `CLAUDE.md` indexes all major topics. The public-facing API documentation lives in `apps/api-worker/docs/` (VitePress) and deploys with api-worker as Workers Static Assets on developers.xivdyetools.app.
