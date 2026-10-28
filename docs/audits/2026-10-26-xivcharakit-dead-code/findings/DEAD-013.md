# DEAD-013: Bundle-budget rows match no emitted chunk (vendor-spectral, other vendor, dye selector) — ~8 lines
**Confidence:** MEDIUM · **Blast radius:** LOW · **Deploy unit:** web-app (check-bundle-size.js gates deploy-web-app.yml and deploy-web-app-beta.yml; a merge triggers a web-ap… · **Semver:** NONE · **Category:** Legacy
**Calibration:** Confidence HIGH->MEDIUM: the verifiers split (HIGH/MEDIUM), and the proof depends on the chunk names a build emits, which Rolldown derives from the module graph. Re-run build:check in the PR to make it reproducible.

## Location
- `apps/web-app/scripts/check-bundle-size.js:127,128,158`
- `apps/web-app/src/__tests__/bundle-budget.test.ts:54`
- `apps/web-app/vite.config.ts:42-43`

## Evidence
- I ran two HEAD vite builds into scratch: the config as-is, and one with the spectral.js and 'vendor' manualChunks returns removed. Both emit the same 49 chunk names, hashes included, at the same sizes. Neither emits a vendor-spectral, other vendor-*, or dye-selector-* chunk; the only vendor chunks are vendor-core and vendor-lit. Sourcemaps put spectral.js in modals-*, dye-selector.ts in collapsible-panel-*, and xivcharakit in the worker chunk only. The local dist/ shows the same. git grep for the three patterns finds only the listed lines plus components.md:192 (the other hits are unrelated DOM ids). No test asserts the labels. Only the EMITTED fixture at test:54 depends on the dye-selector row.
- All three rows are inert today. Rolldown merges spectral.js into modals-* despite its manualChunks assignment. The 'vendor' branch catches no modules: the page reaches no node_modules package except lit and spectral.js, and xivcharakit appears only in the worker chunk. The shared dye-selector code is emitted as collapsible-panel-*. Removing the manualChunks returns changes nothing in the output. One caveat: 'other vendor' together with return 'vendor' is a dormant guard rather than dead code. If a future npm dependency ever reaches the page bundle, it would get a 30 KB vendor-* chunk today; after removal it land…

## Fix
- **REMOVE WITH CAUTION** — 1. In check-bundle-size.js, delete lines 127, 128 and 158. 2. In bundle-budget.test.ts, delete line 54 ('dye-selector-B6HfW2Vr.js'). Its named-limit test fails without the row. 3. In vite.config.ts, delete lines 42-43. The build output is byte-identical (verified). 4. In apps/web-app/CLAUDE.md, delete the bullets at lines 221-222. 5. In docs/projects/web-app/components.md:192, drop vendor-spectral and vendor. 6. Optionally, make check-bundle-size fail on a named row that matches no file. 7. Run pnpm turbo run build type-check lint test --filter=xivdyeto…
- Cascade: Removing the dye-selector row requires removing EMITTED line 54 in bundle-budget.test.ts in the same change. The vite.config manualChunks returns, the CLAUDE.md bullets and components.md:192 go with the rows. Nothing else depends on them: no workflow, script or test references the labels.

## Status
OPEN — inert spectral/dye-selector cleanup prepared in web 5.16.4; generic vendor assignment and its 30 KB guard intentionally KEPT/reclassified at recheck. All current emitted bytes and budget assignments are preserved; production acceptance pending. [A-WEB evidence](../../2026-10-26-deep-dive/evidence/remediation-web-2026-10-28.md).
