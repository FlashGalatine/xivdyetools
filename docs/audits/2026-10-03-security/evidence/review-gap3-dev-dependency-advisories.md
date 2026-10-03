# Review gap3-dev-dependency-advisories (2026-10-03)

Method: `pnpm audit --json` (all deps, all severities) from root; output kept in the session scratchpad (not committed). `pnpm ls --prod -r --depth Infinity --json` compared with evidence/pnpm-audit.json. Lockfile and overrides read directly.

## 1. Entry-point table / authz matrix
No request-handling entry points in this scope (supply chain only). Relevant execution contexts:

| Context | Who triggers | Secrets in scope | Dependency code run |
|---|---|---|---|
| deploy-*.yml `wrangler-action` step (deploy-api-worker.yml:62-69) | push to main / dispatch | CLOUDFLARE_API_TOKEN, ACCOUNT_ID (step-scoped `with:`, not job env) | wrangler 4.140.0 deploy path |
| deploy-api-worker.yml:60 `build:docs` | same | none (secrets only on the deploy step) | vitepress 1.6.4, vite 6.4.3, vue 3.5.43 |
| publish-packages.yml (`id-token: write`, l.104) | manual dispatch | npm OIDC | tsup/esbuild 0.28.x, pnpm publish |
| sync-dye-emojis.yml:49-52 | schedule/dispatch | DISCORD_TOKEN (step env) | tsx 4.23.15 |

## 2. Positive controls
- Step 1 sanity check: `pnpm ls --prod -r --depth Infinity` enumerates 18 importers and 39 unique name@version (10 are workspace `link:` entries, leaving 29 registry packages; audit says 27 - differs by the two type-only packages, @cloudflare/workers-types and @types/trusted-types, which carry no runtime code). It includes hono@4.13.9, lit@3.3.3, @resvg/resvg-wasm@2.6.2, @cf-wasm/photon@0.4.0, revolt.js@7.2.0 (+ solid-js 1.9.11, seroval 1.6.2), @upstash/redis, discord-interactions. So the prod gate does cover every shipped runtime package; it does not under-report. `pnpm audit --prod` = 0 advisories (re-run now).
- Full audit: 3 low / 5 moderate / 2 high / 0 critical across 723 deps (696 dev), ALL ten advisories are `undici@7.29.0` (patched >=7.29.1) via `wrangler>miniflare>undici` (pnpm-lock.yaml:3818, 6382-6386). No advisory on vitepress, vue, vite, rollup, esbuild, tsup, tsx, postcss, tailwind.
- Overrides resolve to patched versions: rollup 4.59.0 (lock:3550, floor >=4.59.0); seroval 1.6.2 (lock:3573, floor >=1.5.3); vite for vitepress 6.4.3 (lock:3862, floor >=6.4.3 <7); tsup's esbuild 0.28.1 (lock:2803, floor >=0.28.1). `qs` has no entry in the lockfile at all, so the floor is inert but harmless.
- Deploy secrets are passed only to the wrangler-action step (`with:` inputs), never job-level env, so test/build steps running dev dependencies do not see them (deploy-api-worker.yml:62-69, deploy-web-app.yml:62-65). Actions pinned by SHA.
- wrangler 4.140.0 itself uses undici@8.10.2 (lock:6169 is jsdom; wrangler's own HTTP is not the miniflare copy) - see below.

## 3. Rejected items (advisory triage)
All ten are undici 7.29.0 reached only through miniflare (local workerd simulator: `wrangler dev`, vitest pools, `getPlatformProxy`):
- GHSA-rfgv-xxqx-mfg5 (high, unrequested WebSocket subprotocol DoS), GHSA-w293-vg96-wgc3 (high, BalancedPool TLS bypass), GHSA-3wwx-pv8p-q78v, GHSA-pmjh-fq2x-6v4x, GHSA-3xpg-4rpp-hhhm, GHSA-2jfj-6hjv-fm6j, GHSA-rx4f-c7p8-82vq (moderate), GHSA-r53p-7pc4-xj5r, GHSA-2gqq-gqf2-x968, GHSA-8436-99hf-9mmv (low): rejected - class (a) not applicable (undici is a Node-side client library inside miniflare, never bundled into a Worker or the docs/web bundle; `git grep undici` in apps/*/src and packages/*/src returns nothing), class (b) not reachable: `wrangler deploy` in deploy-*.yml does not start miniflare, and the vulnerable surfaces (client-side WebSocket handling, BalancedPool, retry/dump/cache interceptors, decompression of responses from a server the dev chooses) are not used by an upload to api.cloudflare.com; the CI test steps that may start miniflare run without the Cloudflare token. Residual: developer-machine `wrangler dev` only (LOCAL, LOW); fixed by the next miniflare bump (miniflare 5.20260923.0-alpha is an alpha pin pulled by wrangler 4.140.0 - the maintainer cannot patch it without an override, which would be reasonable: `undici: '>=7.29.1 <8'` scoped to miniflare).
- VitePress/Vue/Vite class (a): no advisory exists against vitepress 1.6.4, vue 3.5.43, vite 6.4.3 or rollup 4.59.0, so the docs bundle served on developers.xivdyetools.app carries no known-vulnerable code. web-app Vite 8.3.1 / PostCSS 8.5.28 / Tailwind: no advisories.
- tsup/esbuild/tsx in publish-packages.yml and sync-dye-emojis.yml: no advisories; esbuild build-scripts disabled (`allowBuilds: esbuild: false`).
- Dev-server-only vite advisories (GHSA-fx2h-pf6j-xcff etc.): already closed by the vitepress>vite override; not reachable in `vite build` regardless.

## 4. Files covered
pnpm-workspace.yaml; pnpm-lock.yaml (sections for undici, miniflare, wrangler, rollup, seroval, vite, vitepress, vue, esbuild, tsup, tsx, qs); evidence/pnpm-audit.json; apps/*/package.json (grep of dev tooling); .github/workflows/deploy-api-worker.yml, deploy-web-app.yml, publish-packages.yml, sync-dye-emojis.yml (grep of run/uses/secrets lines), directory listing of the other deploy-*.yml.

## 5. Candidate table
| cid | sev | exposure | path:line | claim |
|---|---|---|---|---|
| c1 | LOW | LOCAL | pnpm-lock.yaml:6386 | undici 7.29.0 (10 advisories incl. 2 high) via wrangler>miniflare, patched in 7.29.1; unreachable in CI deploy and shipped code, reachable only in developers' `wrangler dev`. Recommend scoped override and extend the CI gate to full `pnpm audit` (non-blocking, moderate+) so dev-tool advisories become visible (ci-supply-chain#c3 related). |

## 6. Handoffs
- evidence/pnpm-audit.json documents only `--prod`; a scheduled non-blocking full audit would have surfaced these ten (docs/CI owner).
- pnpm-workspace.yaml `qs` override has no matching lockfile entry; can be removed or kept as a floor (housekeeping).
