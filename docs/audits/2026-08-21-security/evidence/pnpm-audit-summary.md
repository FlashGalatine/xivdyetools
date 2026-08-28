# pnpm audit summary (2026-08-21)

Raw output: `pnpm-audit.json` (exit 1 = advisories present). Totals: 1 high, 3 moderate, 1 low, 0 critical — **all in devDependencies, none reachable at runtime**.

| Severity | Package | Resolved | Fixed in | Advisory | Path (dev tooling) |
|---|---|---|---|---|---|
| HIGH | vite | 5.4.21 | >=6.4.3 | GHSA-fx2h-pf6j-xcff — `server.fs.deny` bypass on Windows (dev server only) | apps/api-worker > vitepress > vite |
| MODERATE | vite | 5.4.21 | >=6.4.2 | GHSA-4w7w-66w2-5vf9 — path traversal in optimized-deps `.map` (dev server only) | apps/api-worker > vitepress > vite |
| MODERATE | vite | 5.4.21 | >=6.4.3 | GHSA-v6wh-96g9-6wx3 — launch-editor NTLMv2 hash disclosure (dev server only) | apps/api-worker > vitepress > vite |
| MODERATE | esbuild | 0.21.5 | >=0.24.3 | GHSA-67mh-4wv8-2f99 — dev server accepts any origin (dev server only) | apps/api-worker > vitepress > @vitejs/plugin-vue > vite > esbuild |
| LOW | esbuild | 0.27.3 | >=0.28.1 | GHSA-g7r4-m6w7-qqqr — arbitrary file read in dev server on Windows | apps/stoat-worker > tsup / vitest > esbuild |

Assessment: VitePress (docs build for api-worker) pins an old Vite 5 line; tsup/vitest in the parked stoat-worker pin esbuild 0.27.3. Exposure requires running those dev servers locally while browsing a hostile site. CI runs `pnpm audit --prod --audit-level high` nightly, which correctly excludes these. Recommendation: bump `vitepress` (or add a `vite` override for the docs workspace) and `tsup`/`vitest` in stoat-worker when convenient; no production impact.
