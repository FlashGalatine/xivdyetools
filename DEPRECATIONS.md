# Deprecations

This file tracks deprecated features, APIs, and environment variables across the xivdyetools monorepo.
Each entry includes a target removal date and migration guide.

---

## Active Deprecations

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
