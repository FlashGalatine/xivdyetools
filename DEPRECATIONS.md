# Deprecations

This file tracks deprecated features, APIs, and environment variables across the xivdyetools monorepo.
Each entry includes a target removal date and migration guide.

---

## Active Deprecations

### `*.xivdyetools.projectgalatine.com` custom domains

| Field       | Value |
|-------------|-------|
| Deprecated  | 2026-08-09 |
| Removed     | Phased — see `docs/operations/DOMAIN_DEPRECATION.md` |
| Severity    | Medium — five live custom domains; one is a public third-party surface |

**What is being retired:** every `*.xivdyetools.projectgalatine.com` hostname. All services move
to their `xivdyetools.app` subdomain, which already serves each one today.

| Retiring | Replacement |
|---|---|
| `bot.xivdyetools.projectgalatine.com` | `bot.xivdyetools.app` |
| `moderation-bot.xivdyetools.projectgalatine.com` | `moderation-bot.xivdyetools.app` |
| `api.xivdyetools.projectgalatine.com` | `api.xivdyetools.app` |
| `auth.xivdyetools.projectgalatine.com` | `auth.xivdyetools.app` |
| `proxy.xivdyetools.projectgalatine.com` | `proxy.xivdyetools.app` |
| `xivdyetools.projectgalatine.com` (apex) | `xivdyetools.app` |

**⚠️ Scope guard:** match `*.xivdyetools.projectgalatine.com` only. The bare string
`projectgalatine.com` is also the maintainer's identity (Bluesky handle in
`packages/core/src/config/product-links.ts:34`, Patreon, GitHub) and those references stay.

**⚠️ Blocking pre-checks** (`DOMAIN_DEPRECATION.md` Phase 0): confirm neither Discord
application's Interactions Endpoint URL, nor any registered OAuth redirect URI, points at the
old domain. Removing a route those depend on breaks the bots or login instantly.

**Migration path:** `apps/web-app/functions/_middleware.ts` already redirects the old apex to
`xivdyetools.app`. It is retired **last**, so every other removal degrades to a redirect rather
than a failure.

**Third-party impact:** `proxy.*` is the public Universalis CORS proxy and gets its own phase
plus a notice window — it is the only hostname here whose removal breaks software this project
does not control.

### 5.0 graphics-era removals (`@xivdyetools/svg` + Discord bot surface)

| Field       | Value |
|-------------|-------|
| Deprecated  | 2026-08-08 (5.0 redesign) |
| Removed     | Same release — the replacements shipped together |
| Severity    | Medium — npm API removals in `@xivdyetools/svg`; Discord schema reshape |

**What was removed (svg package API):** `generateHarmonyWheel`, `generateContrastMatrix`
(+`calculateContrast`/WCAG level types), `generateAccessibilityComparison` /
`generateCompactAccessibilityRow`, `generateComparisonGrid`, `generateBudgetComparison`
(+`formatGil`, `BudgetSvgLabels`, `BudgetSuggestion` shapes), `generateGradientBar`,
`getMatchQuality`/`MATCH_QUALITIES`. **Replacements:** the 5.0 frame system
(`cardShell`/`measuredRow`/`commandChip`/`markFooter`) and per-command generators
(`generateHarmonyCard`, `generateContrastCard`, `generateA11yCard`, `generateComparisonCard`,
`generateBudgetLedger`, `generateGradientCard`, `generateSwatchCard`, `generatePaletteGrid`,
`generateNearestSheet`). Tier language moved to core's calibrated `classifyBandTier` —
AA/AAA letter grades and the emoji quality ladders left every surface.

**Discord surface:** `/swatch color|grid` subcommands replaced by the required `file:`
(.chara) shape; `/budget find` lost `max_price`/`sort_by`/`max_results` (the 13G ledger's
sort IS gil/ΔE) and gained `matching` + tier exclusions; `/accessibility` dye3–6 moved to
the new `/contrast`. Re-run `register-commands` on deploy.

### `apps/api-docs` (standalone CF Pages site)

| Field       | Value |
|-------------|-------|
| Deprecated  | 2026-07-31 |
| Removed     | Merged into `apps/api-worker` 2026-07-31 (Monorepo 2.0 Tier 2) |
| Severity    | Low — static docs site domain cutover |

**What it was:** The VitePress site documenting api-worker's public API, deployed to its own
Cloudflare Pages project (`xivdyetools-api-docs`) on `developers.xivdyetools.app` — a full deploy
workflow + Pages project for ~1k lines of markdown.

**Where it went:** `apps/api-worker/docs/` — built by `pnpm --filter xivdyetools-api-worker run build:docs`
and served as **Workers Static Assets** (production env only, `run_worker_first` + a host check so docs
never shadow API paths on data.*). The docs now deploy atomically with the API they document.

**⚠️ Production cutover (manual):**
1. In the Cloudflare dashboard, remove the `developers.xivdyetools.app` custom domain from the
   `xivdyetools-api-docs` Pages project.
2. Deploy api-worker (`deploy --env production`) — its wrangler.toml claims the domain.
3. Smoke-test `https://developers.xivdyetools.app/`.
4. Delete the Pages project after the cutover window.

**Removal checklist:**
- [x] Content moved to `apps/api-worker/docs/`; vitepress build wired into the api-worker deploy (2026-07-31)
- [x] `deploy-api-docs.yml` deleted (2026-07-31)
- [x] Pages-project domain cutover (steps 1–3) — verified live 2026-08-21: `developers.xivdyetools.app` is no longer attached to the `xivdyetools-api-docs` Pages project (only its `pages.dev` alias remains) and serves api-worker's Workers-Static-Assets build
- [ ] Delete the `xivdyetools-api-docs` Pages project after the cutover window (step 4; tracked in `docs/operations/POST_MERGE_CHECKLIST.md` §2)

---

### `apps/universalis-proxy` (standalone worker)

| Field       | Value |
|-------------|-------|
| Deprecated  | 2026-07-31 |
| Removed     | Merged into `apps/api-worker` 2026-07-31 (Monorepo 2.0 Tier 2) |
| Severity    | Medium — live production domain cutover required |

**What it was:** A standalone CF Worker proxying three Universalis endpoints with always-on CORS,
Cache-API caching, SWR, and request coalescing, on `proxy.xivdyetools.app`.

**Where it went:** `apps/api-worker/src/universalis/` — code moved verbatim; routes mounted at
`/universalis/*` (canonical) **and** `/api/v2/*` (compatibility: preserves the exact path shape used by
already-deployed web-app bundles via the proxy domain, and by discord-worker's `UNIVERSALIS_PROXY`
service binding, which now targets `xivdyetools-api-worker`). Responses stay un-enveloped. api-worker's
global `cors({ origin: '*' })` replaces the proxy's allowlist CORS (strictly more permissive).

**⚠️ Production cutover sequence (manual, do in this order):**
1. In the Cloudflare dashboard, remove the custom domains `proxy.xivdyetools.app` and
   `proxy.xivdyetools.projectgalatine.com` from the old `xivdyetools-universalis-proxy` worker
   (or delete the worker).
2. Deploy api-worker (`deploy --env production`) — its wrangler.toml now claims both proxy domains
   alongside `data.xivdyetools.app`.
3. Smoke-test: `curl https://proxy.xivdyetools.app/api/v2/data-centers` and
   `curl https://data.xivdyetools.app/universalis/data-centers`.
4. Deploy web-app (its production fallback now points at `data.xivdyetools.app/universalis`).
5. Deploy discord-worker (service binding retarget); verify `/budget`.
6. Expect a one-time cold Universalis cache (cache keys embed the request origin).

**Removal checklist:**
- [x] Code + unit tests moved into api-worker; router remounted; new route tests (2026-07-31)
- [x] discord-worker binding + web-app fallback URL + preconnect hints flipped (2026-07-31)
- [x] deploy-universalis-proxy.yml deleted (api-worker's workflow covers the moved code)
- [x] Production domain cutover, steps 1–3 — verified live 2026-08-21: both proxy hosts answer api-worker (`/v1/dyes` 200, `/api/v2/data-centers` 200). Steps 4–5 (web-app + discord-worker production deploys) *are* the 5.0 merge
- [ ] Delete the old `xivdyetools-universalis-proxy` worker after the cutover window (still exists, last deploy 2026-07-13 — tracked in `docs/operations/POST_MERGE_CHECKLIST.md` §2)

---

### `apps/maintainer` (Dye Maintainer GUI)

| Field       | Value |
|-------------|-------|
| Deprecated  | 2026-07-30 (decision) |
| Removed     | 2026-07-31 |
| Severity    | Low — local-only dev tool, never deployed |

**What it was:** A Vue 3 SPA + Express sidecar for appending dyes to `colors_xiv.json` with XIVAPI name
fetching. Never deployed; refused to boot in production.

**Why removed:** Monorepo 2.0 (docs/research/monorepo-2.0/03). Its scope was narrower than assumed
(append-only, one dye at a time), its vocabularies had drifted from the data, and — decisively — its save
path was **verifiably destructive**: the server's Zod schemas silently stripped `stainID`, `isIshgardian`,
and `consolidationType` from all 136 dyes on any save, and dropped 8 translation groups per locale file.

**Replacement:**
- Canonical workflow: `docs/maintainer/adding-dyes.md` (manual / Claude-assisted, game-data-first).
- Vocabularies + validation: `@xivdyetools/core` `src/config/dye-vocabulary.ts` (`DYE_CATEGORIES`,
  `DYE_ACQUISITIONS`, `ACQUISITION_META`) enforced by `dye-vocabulary.test.ts` in CI — including the
  stainID-uniqueness check the GUI never had.

**Removal checklist:**
- [x] Port corrected vocabularies + invariant tests into core (2026-07-31)
- [x] Amend `adding-dyes.md` into the canonical procedure (2026-07-31)
- [x] Delete `apps/maintainer`; remove `scripts/coverage-report.ts` skip-list; docs cleanup (2026-07-31)
- [x] Lockfile regenerated — drops the express/cors/express-rate-limit/concurrently/vue/vue-tsc family

---

### `@xivdyetools/crypto` (npm package)

| Field       | Value |
|-------------|-------|
| Deprecated  | 2026-07-30 |
| Remove by   | Removed from the monorepo 2026-07-30; npm registry deprecation pending |
| Severity    | Low |

**What it is:** A ~180-LOC standalone encoding package (Base64URL RFC 4648 + hex helpers), published to npm.

**Why deprecated:** Monorepo 2.0 Tier 1 consolidation (docs/research/monorepo-2.0/05 §6) — two of its three
consumers were the auth/JWT path. The source moved verbatim to `packages/auth/src/encoding/` and ships as
`@xivdyetools/auth/encoding` (also re-exported from the auth package root) since `@xivdyetools/auth@1.3.0`.

**Migration:** Replace `import { … } from '@xivdyetools/crypto'` with
`import { … } from '@xivdyetools/auth/encoding'`. The API is byte-for-byte identical.

**Removal checklist:**
- [x] Move source + tests into `packages/auth/src/encoding/` (2026-07-30)
- [x] Flip all workspace consumers: auth, oauth, test-utils (2026-07-30)
- [x] Remove from publish-packages.yml and deploy path filters (2026-07-30)
- [x] `npm deprecate @xivdyetools/crypto "Merged into @xivdyetools/auth (import from @xivdyetools/auth/encoding)"` (2026-08-28, by the maintainer via `npm login --auth-type=web` — the package disallows tokens)

---

### `@xivdyetools/bot-i18n` (npm package)

| Field       | Value |
|-------------|-------|
| Deprecated  | 2026-07-30 |
| Remove by   | Removed from the monorepo 2026-07-30; npm registry deprecation pending |
| Severity    | Low |

**What it is:** The bot-facing translation engine (`Translator`, `createTranslator`, `LocaleCode`) plus six
bot-UI locale JSON files, published as a standalone npm package.

**Why deprecated:** Monorepo 2.0 Tier 1 consolidation (docs/research/monorepo-2.0/05 §6) — bot-logic accounted
for 11 of its 21 import sites and both other consumers (discord-worker, stoat-worker) already depend on
bot-logic. The source moved verbatim to `packages/bot-logic/src/i18n/` and ships as
`@xivdyetools/bot-logic/i18n` since `@xivdyetools/bot-logic@1.4.0`.

**Migration:** Replace `import { … } from '@xivdyetools/bot-i18n'` with
`import { … } from '@xivdyetools/bot-logic/i18n'`. The API is identical.

**Removal checklist:**
- [x] Move source + tests + locale JSON into `packages/bot-logic/src/i18n/` (2026-07-30)
- [x] Flip all workspace consumers: bot-logic, discord-worker, stoat-worker (2026-07-30)
- [x] Remove from publish-packages.yml and deploy path filters (2026-07-30)
- [x] `npm deprecate @xivdyetools/bot-i18n "Merged into @xivdyetools/bot-logic (import from @xivdyetools/bot-logic/i18n)"` (2026-08-28, via `npm login --auth-type=web`)

---

### `@xivdyetools/color-blending` (npm package)

| Field       | Value |
|-------------|-------|
| Deprecated  | 2026-07-31 |
| Remove by   | Removed from the monorepo 2026-07-31; npm registry deprecation pending |
| Severity    | Low |

**What it is:** Six self-contained color blending algorithms (RGB, LAB, OKLAB, RYB, HSL, Spectral/Kubelka-Munk)
with their own conversion helpers, split from core for tree-shaking (REFACTOR-005).

**Why deprecated:** Monorepo 2.0 Tier 1 consolidation (docs/research/monorepo-2.0/05 §6) — the tree-shaking
win is preserved by a per-entry `exports` map on core instead of a whole separate package. The source moved
verbatim to `packages/core/src/blending/` and ships as `@xivdyetools/core/blending` since
`@xivdyetools/core@2.8.0`.

**Migration:** Replace `import { … } from '@xivdyetools/color-blending'` with
`import { … } from '@xivdyetools/core/blending'`. The API is identical.

**Removal checklist:**
- [x] Move source + tests into `packages/core/src/blending/` (2026-07-31)
- [x] Flip all workspace consumers: svg, bot-logic, discord-worker; drop unused dep from stoat-worker (2026-07-31)
- [x] Remove from publish-packages.yml and deploy path filters (2026-07-31)
- [x] `npm deprecate @xivdyetools/color-blending "Merged into @xivdyetools/core (import from @xivdyetools/core/blending)"` (2026-08-28, via `npm login --auth-type=web`)
- [ ] ~~Follow-up refactor: unify duplicated conversions with ColorService inside core~~ —
      **declined 2026-08-18** (DEAD-037, dead-code audit Wave 4b). `blending/conversions.ts` stays.
      An equivalence guard (`packages/core/src/blending/conversions.equivalence.test.ts`) compares every
      helper with its `ColorConverter` / `RybColorMixer` counterpart across all 125 dye hexes plus the
      blending suites' vectors (86,319 interpolated samples per inverse helper). Only two helpers are
      bit-identical — `hexToRgb` and `oklabToRgb`. The rest differ numerically and unifying them would
      move rendered gradients, mixer results and bot cards:
      - `rgbToLab` — core rounds L/a/b to 4 dp (`#e4dfd0`: `l 88.83921264346783` vs `L 88.8392`).
      - `rgbToOklab` — core rounds to 6 dp (`#e4dfd0`: `a -0.0005799732264173962` vs `-0.00058`).
      - `rgbToHsl` — core returns s/l on 0–100 rounded to 2 dp (`#e4dfd0`: `s 0.2702702702702704` vs `27.03`).
      - `labToRgb` — different dark-region inverse (κ=903.3 vs the 7.787 linear segment): 15 of 86,319
        samples differ, e.g. `#000b9d`→`#010101` @ t=0.667 gives `g 13` vs `g 12`.
      - `hslToRgb` — the 0–100 rescale core requires loses float identity: 42 of 86,319 samples differ,
        e.g. `#aca8a2`→`#a7a7a7` @ t=0.5 gives `(170,166,165)` vs `(169,166,164)`.
      - `rgbToRyb` / `rybToRgb` — `RybColorMixer` is the Gossett-Chen trilinear/Newton-Raphson solver,
        a different algorithm; `blendColors(…, 'ryb', …)` moves on essentially every pair.
      - `rgbToHex` — same values, but core emits uppercase and `blendColors().hex` is lowercase.
      - `rgbToReflectance` / `reflectanceToRgb` / `reflectanceToKS` / `ksToReflectance` — no core equivalent.
      The two identical helpers were left in place too: delegating them would make the tree-shakeable
      `@xivdyetools/core/blending` entry point import `ColorConverter` — the exact dependency REFACTOR-005
      removed — to retire ~30 of 311 lines while the other 12 helpers stay. The equivalence test is
      permanent: it pins the identical pair against drift and the deltas against a well-meaning "fix".

---

### `@xivdyetools/worker-middleware` + `@xivdyetools/rate-limiter` (npm packages)

| Field       | Value |
|-------------|-------|
| Deprecated  | 2026-07-31 |
| Remove by   | Removed from the monorepo 2026-07-31; npm registry deprecation pending |
| Severity    | Low |

**What they are:** The shared Hono middleware stack (request ID, logger, rate-limit factory) and the
sliding-window rate limiting engine (Memory/KV/Upstash backends) it wraps, published as two npm packages.

**Why deprecated:** Monorepo 2.0 Tier 1 consolidation (docs/research/monorepo-2.0/05 §6) — worker-middleware
was rate-limiter's top consumer and mostly wraps it; the pair also had the worst deploy-filter coverage in CI.
Both moved verbatim into `packages/worker-kit/` (`src/middleware/`, `src/rate-limiter/`) and ship as
`@xivdyetools/worker-kit` since v1.0.0.

**Migration:**
- `import { … } from '@xivdyetools/worker-middleware'` → `import { … } from '@xivdyetools/worker-kit'` (or `/middleware`)
- `import { … } from '@xivdyetools/rate-limiter'` → `import { … } from '@xivdyetools/worker-kit/rate-limiter'`
- Backend subpaths preserved: `/rate-limiter/{memory,kv,upstash,presets}`

Both APIs are unchanged.

**Removal checklist:**
- [x] Assemble `packages/worker-kit` (worker-middleware shell renamed, rate-limiter absorbed) (2026-07-31)
- [x] Flip all 8 consuming apps (package.json + imports) (2026-07-31)
- [x] Replace both packages in publish-packages.yml and all deploy path filters (2026-07-31)
- [x] **npm trusted-publisher setup for `@xivdyetools/worker-kit`** + first version published by hand (2026-08-28): the *Publish Packages to npm* run on merge day failed on this package with `E404 PUT` exactly as expected; the maintainer published 1.1.0 from a local shell with a granular access token (bypass 2FA, no `--provenance`), then set the package to "Require 2FA and disallow tokens" and added the trusted publisher (`FlashGalatine/xivdyetools`, `publish-packages.yml`, environment `production`). Next bumps go through OIDC like the other six.
- [x] `npm deprecate` both old packages pointing at `@xivdyetools/worker-kit` (2026-08-28, via `npm login --auth-type=web`): worker-middleware → "Merged into @xivdyetools/worker-kit (import from @xivdyetools/worker-kit or @xivdyetools/worker-kit/middleware)", rate-limiter → "Merged into @xivdyetools/worker-kit (import from @xivdyetools/worker-kit/rate-limiter)"

---

### `LocalStorageCacheBackend` (web-app)

| Field       | Value |
|-------------|-------|
| Deprecated  | ~2025-12 |
| Remove by   | TBD |
| Severity    | Low |

**What it is:** A localStorage-based cache backend for the Universalis API service in the web-app.
The `IndexedDBCacheBackend` is the preferred replacement, offering larger storage capacity and better
performance for structured data.

**Migration:** Use `IndexedDBCacheBackend` (already the default in `api-service-wrapper.ts`). Remove
all references to `LocalStorageCacheBackend`.

**Removal checklist:**
- [ ] Confirm `LocalStorageCacheBackend` is not used in any active code paths
- [ ] Remove the class from the web-app
- [ ] Clean up any associated localStorage keys if needed

---

## Process

1. When deprecating something, add an entry here with a realistic removal date
2. Add a `@deprecated` JSDoc tag to the relevant code with the removal date
3. On the removal date, open a PR that removes the deprecated code and this entry
