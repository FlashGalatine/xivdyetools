# Deep-Dive Analysis Manifest

- **Project:** XIV Dye Tools monorepo (`xivdyetools/`)
- **Analysis Date:** 2026-07-18
- **Scope:** All 12 shared packages (`packages/*`) and 11 applications (`apps/*`)
- **Method:** Six parallel area analyses (core / shared packages / bot workers / D1 workers / edge workers / web frontends), findings verified against source before documentation
- **Prior audit baseline:** 2026-05-28 deep-dive (docs/audits/2026-05-28/deep-dive) — open items from that audit (core `APIService` >100 chunking, dual JWT verifiers, og-worker enum validation, KR font subset scope) re-verified this pass
- **Numbering:** BUG-/REFACTOR-/OPT- restart at 001 per dated audit folder (established convention; distinct from the global DEAD-XXX registry)
- **Analysis Duration:** Single session, 2026-07-18 — six parallel area analyses (~7–12 min each) plus documentation phase; interrupted once mid-documentation by a session usage limit and resumed
- **Totals:** 139 findings — 81 bugs (1 CRITICAL / 9 HIGH / 33 MEDIUM / 38 LOW), 29 refactors, 29 optimizations; 4 cross-area merges (BUG-006, BUG-007, BUG-013, BUG-017)

## Areas

| Area | Scope |
|------|-------|
| core | `packages/core` — color algorithms, dye DB, k-d tree, APIService, i18n |
| shared-packages | `packages/{types,crypto,logger,auth,rate-limiter,worker-middleware,color-blending,svg,bot-logic,bot-i18n,test-utils}` |
| bot-workers | `apps/{discord-worker,moderation-worker,stoat-worker}` |
| d1-workers | `apps/{presets-api,oauth}` |
| edge-workers | `apps/{api-worker,og-worker,universalis-proxy}` |
| web-frontends | `apps/{web-app,maintainer}` |

Raw per-area analysis output is preserved in `evidence/`.
