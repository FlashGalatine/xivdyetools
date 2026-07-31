# 05 — Package & App Audit ("Trim the Fat")

> Part of [Monorepo 2.0 / Web-App 5.0 research](./README.md).

## Summary

The audit confirms all three suspected overlaps and finds a clean consolidation path: **12 packages → 8** and **11 apps → 8** with low risk. It also surfaced CI gaps that matter more than any merge: `worker-middleware` (a dependency of 7 apps) triggers **zero** deploy workflows, and `api-worker` — live on a public custom domain — has **no deploy workflow at all**.

LOC figures are raw non-test line counts of `src/`.

## 1. Packages

| Package | src LOC | Consumers (import sites) | Verdict |
|---------|--------:|--------------------------|---------|
| `types` | 2,603 | 14 consumers (everything) | **Keep** — true foundation, zero deps |
| `logger` | 1,588 | 11 consumers | **Keep** — multi-runtime, broad reach |
| `core` | 10,803 | 9 consumers | **Keep** — but it *is* the fat; owns duplicated mixing + localization (see §2) |
| `svg` | 3,926 | discord-worker, bot-logic, og-worker, stoat-worker | **Keep** — but reconcile og-worker's parallel implementation (§4) |
| `bot-logic` | 2,098 | discord-worker, stoat-worker, moderation-worker | **Keep** — genuinely shared across two bot platforms |
| `auth` | 934 | oauth, discord-worker, moderation-worker, presets-api | **Keep**; absorb `crypto` |
| `rate-limiter` | 1,338 | 8 consumers (top: worker-middleware) | **Merge** with worker-middleware → `worker-kit` |
| `test-utils` | 3,754 | 8 consumers (devDep only) | **Keep, unpublish from npm** (`publish-packages.yml:19` publishes a test-only package) |
| `crypto` | **183** | auth (4), oauth (4), test-utils (3) | **Merge into `auth`** — 2 of 3 consumers are the JWT path; re-export for test-utils |
| `worker-middleware` | **605** | 7 apps | **Merge** with rate-limiter — it is mostly a thin wrapper over logger + rate-limiter |
| `color-blending` | **543** | svg, discord-worker, bot-logic, stoat-worker | **Fold into core as a subpath export** — duplicates `ColorService.mix*` (§2) |
| `bot-i18n` | **140** (+214 KB locale JSON) | bot-logic (11 of 21 sites), discord-worker, stoat-worker | **Fold into `bot-logic`** — both other consumers already depend on bot-logic |

### Bonus finding
`apps/presets-api/package.json:23` declares `@xivdyetools/crypto` but has **zero imports** of it — delete the dep regardless of the merge.

## 2. The Three Confirmed Overlaps

1. **`crypto` ⊂ `auth`.** `packages/auth/src/hmac.ts:15` and `jwt.ts:18` import it; the only non-auth consumer is oauth's JWT service (`apps/oauth/src/services/jwt-service.ts:19`) — which also depends on `auth`. 183 LOC of base64url/hex does not need its own npm package, version, and publish pipeline.
2. **`color-blending` ≈ `core` mixing.** Same six algorithms (RGB/LAB/OKLAB/RYB/HSL/Spectral) exist in `packages/color-blending/src/blending.ts` and in `ColorService.ts:462-790` + `RybColorMixer.ts` (432 LOC) + `SpectralMixer.ts` (151 LOC). The split was a deliberate tree-shaking measure (REFACTOR-005, noted at `color-blending/src/conversions.ts:283`) — the modern fix is a **per-entry `exports` map on core** (`@xivdyetools/core/blending`), which keeps the bundle win and kills the double-maintenance of every future algorithm fix.
3. **`bot-i18n` ≈ `core` localization.** A 110-line `Translator` re-implements nested-key lookup + interpolation + en-fallback that core's `LocalizationService` (664 LOC) / `TranslationProvider` (561 LOC) already do. Its locale JSON is bot-specific (errors/help/status), so the *data* moves under `bot-logic/src/i18n/`; the *engine* should be core's.

Monorepo 2.0 note: with stainID-first (doc 02) forcing a `TranslationProvider` re-key anyway, consolidating localization engines at the same time avoids doing that migration twice.

## 3. Apps

| App | Purpose | src LOC | Deploy workflow |
|-----|---------|--------:|-----------------|
| `web-app` | SPA, 9 tools, PWA (`xivdyetools.app`) | **60,883** (components 44.9k) | `deploy-web-app.yml` |
| `discord-worker` | Primary Discord bot — consumes **all 10** runtime packages | 16,471 | `deploy-discord-worker.yml` |
| `moderation-worker` | Preset-review bot | 5,707 | `deploy-moderation-worker.yml` |
| `og-worker` | Crawler interception + OG images on `xivdyetools.app/{tool}/*` zone routes | 4,696 | `deploy-og-worker.yml` |
| `presets-api` | Presets REST + D1 (`api.xivdyetools.app`) | 4,267 | `deploy-presets-api.yml` |
| `oauth` | Discord OAuth + JWT (`auth.xivdyetools.app`) | 2,793 | `deploy-oauth.yml` |
| `maintainer` | Local dye-DB editor | 1,732 | — (never deployed; **deprecated**, see doc 03) |
| `universalis-proxy` | CORS/cache shim (`proxy.xivdyetools.app`) | 1,536 | `deploy-universalis-proxy.yml` |
| `api-worker` | Public REST (`data.xivdyetools.app`) | 1,400 | ❌ **none** |
| `stoat-worker` | Revolt bot (Node, not CF) | 1,299 | ❌ none (Fly.io planned, per its CLAUDE.md) |
| `api-docs` | VitePress site for api-worker | 0 src / 988 md | `deploy-api-docs.yml` + its own CF Pages project |

## 4. Web-App → Backend Dependency Map

**Only 3 of 10 backends are runtime dependencies of the web app.** Exactly three `VITE_*` vars exist.

| Backend | How | Evidence |
|---------|-----|----------|
| universalis-proxy ✅ | `VITE_UNIVERSALIS_PROXY_URL`, prod fallback `https://proxy.xivdyetools.app/api/v2` | `api-service-wrapper.ts:28,37` |
| presets-api ✅ | `VITE_PRESETS_API_URL` → `https://api.xivdyetools.app` | `auth-service.ts:87`, `preset-submission-service.ts:69`, plus a **hardcoded no-env-var** `DEFAULT_API_URL` in `community-preset-service.ts:79` |
| oauth ✅ | `VITE_OAUTH_WORKER_URL` → `https://auth.xivdyetools.app` | `auth-service.ts:82,397,716` |
| og-worker ⚠️ indirect | Never fetched by the browser — it fronts the SPA's own origin via zone routes (`apps/og-worker/wrangler.toml`) and passes non-crawler traffic through | web-app only emits share URLs against `share-service.ts:41` `BASE_URL` |
| api-worker ❌ | Zero runtime calls; one outbound `<a href>` in `about-modal.ts:227` | |
| discord/moderation/stoat/api-docs/maintainer ❌ | No references | |

Hygiene found on the way: `vite-env.d.ts:8,10` declares only two of the three used env vars (**`VITE_PRESETS_API_URL` is undeclared**); stale `netlify.toml` CSP omits all three real backends (app deploys to CF Pages — delete the file).

## 5. CI / Deploy-Weight Findings (do these first)

1. 🚩 **`packages/worker-middleware/**` appears in zero deploy workflows' path filters** despite 7 dependent apps — a change to it ships to nobody until an unrelated push. Same gap: `packages/svg/**` missing from `deploy-og-worker.yml`, `packages/auth/**` missing from `deploy-oauth.yml`.
2. 🚩 **api-worker has no deploy workflow** yet owns a live public domain the web app links to.
3. `publish-packages.yml` publishes all 12 packages including test-only `test-utils`.

The package merges in §1 shrink this problem structurally (fewer packages ⇒ fewer path filters to keep honest), but the filters should be fixed immediately regardless.

## 6. Recommendations

**Tier 1 — packages (12 → 8, low risk) — ✅ approved 2026-07-30:**
1. `crypto` → `auth` (re-export for test-utils).
2. `bot-i18n` → `bot-logic` (data under `bot-logic/src/i18n/`; engine from core).
3. `worker-middleware` + `rate-limiter` → one `worker-kit` package.
4. `color-blending` → `@xivdyetools/core/blending` subpath export.
5. Unpublish `test-utils`; drop presets-api's phantom `crypto` dep.

**Tier 2 — apps (11 → 8):**
6. Delete `maintainer` (doc 03).
7. Merge `universalis-proxy` into `api-worker` under `/universalis/*`. It exists solely to stamp CORS headers on *every* Universalis response including errors (its CLAUDE.md:9,107); it shares its dependency set with api-worker; cutover is literally one env var (`VITE_UNIVERSALIS_PROXY_URL`). Requires a permissive-CORS route class in api-worker (its own routes are stricter).
8. Fold `api-docs` into api-worker (serve static) or the web app under `/developers` — a full CF Pages project + workflow for ~1k lines of markdown.
9. Add the api-worker deploy workflow **before** items 7–8.

**Tier 3 — the real fat (investigate, size separately):**
10. **og-worker duplicates `packages/svg`**: `apps/og-worker/src/services/svg/` is **2,942 LOC** of parallel generators for the same six tools (harmony 428, mixer 633, swatch 376, accessibility 382, dye-helpers 348, gradient 303, comparison 211) while importing only ~79 LOC of primitives from `@xivdyetools/svg`. This is the largest single duplication in the monorepo — bigger than Tier 1 items 1–4 combined. Reconciling it belongs with the Web-App 5.0 share/OG redesign.
11. **`web-app/src/components` = 44,851 LOC in one flat folder** — nine tool components of 1.9–3.6 kLOC each (see doc 04 §structure). This is the true Monorepo 2.0 target and should ride along with the mobile-friendly rebuild rather than be refactored twice.
12. `stoat-worker` — ✅ *decided 2026-07-30:* **parked.** Kept in the repo but receives no 5.0 investment (no deploy pipeline, no feature work); there is currently no user demand for a Revolt bot. Revisit if/when Discord poses more significant privacy concerns.

## 7. Resulting Shape (proposed)

```
packages/  types · logger · core (incl. /blending) · auth (incl. crypto)
           worker-kit (middleware + rate-limiter) · svg · bot-logic (incl. bot-i18n) · test-utils (private)
apps/      web-app · discord-worker · moderation-worker · presets-api
           oauth · api-worker (incl. universalis-proxy + api-docs) · og-worker · stoat-worker (parked)
```

Every merge above is additive-then-delete (re-export from the absorber, flip imports, remove the shell package), so each can land independently and be reverted independently.
