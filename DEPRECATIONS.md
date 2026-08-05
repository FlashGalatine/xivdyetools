# Deprecations

This file tracks deprecated features, APIs, and environment variables across the xivdyetools monorepo.
Each entry includes a target removal date and migration guide.

---

## Active Deprecations

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
- [ ] Pages-project domain cutover (steps above) — **manual, at merge/deploy time**

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
- [ ] Production domain cutover (steps above) — **manual, at merge/deploy time**
- [ ] Delete the old `xivdyetools-universalis-proxy` worker after the cutover window

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
- [ ] `npm deprecate @xivdyetools/crypto "Merged into @xivdyetools/auth (import from @xivdyetools/auth/encoding)"` — requires npm 2FA, manual step

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
- [ ] `npm deprecate @xivdyetools/bot-i18n "Merged into @xivdyetools/bot-logic (import from @xivdyetools/bot-logic/i18n)"` — requires npm 2FA, manual step

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
- [ ] `npm deprecate @xivdyetools/color-blending "Merged into @xivdyetools/core (import from @xivdyetools/core/blending)"` — requires npm 2FA, manual step
- [ ] Follow-up refactor: unify duplicated conversions with ColorService inside core

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
- [ ] **npm trusted-publisher setup for `@xivdyetools/worker-kit`** (npmjs.com → package → Settings) + first version must be published manually by a 2FA-authenticated human — OIDC cannot create a new package
- [ ] `npm deprecate` both old packages pointing at `@xivdyetools/worker-kit` — requires npm 2FA, manual step

---

### `STATE_TRANSITION_PERIOD` (oauth worker)

| Field       | Value |
|-------------|-------|
| Deprecated  | 2026-02-19 |
| Remove by   | 2026-06-30 |
| Severity    | Security-sensitive |

**What it is:** A legacy environment variable in the OAuth worker that, when set to `'true'`, disables
OAuth state signature verification. This weakens CSRF protection by allowing unsigned state parameters
in the OAuth callback flow.

**Why it existed:** It was introduced as a compatibility flag during the migration to signed OAuth states,
allowing old clients to continue working during a transition period.

**Migration:** All OAuth clients must use signed state parameters (the default behavior). Remove
`STATE_TRANSITION_PERIOD` from wrangler.toml and all environment configurations. The variable is now
**blocked in production** by `apps/oauth/src/utils/env-validation.ts`.

**Removal checklist:**
- [ ] Confirm no active clients rely on unsigned states
- [ ] Remove `STATE_TRANSITION_PERIOD` from `apps/oauth/src/handlers/callback.ts` (line ~64)
- [ ] Remove `STATE_TRANSITION_PERIOD` from `apps/oauth/src/types.ts`
- [ ] Remove the production guard added in `apps/oauth/src/utils/env-validation.ts`

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
