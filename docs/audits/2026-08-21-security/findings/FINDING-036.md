# FINDING-036: Dependency advisories — 5 open (1 high, 3 moderate, 1 low), all in dev-only tooling (vite 5.4.21 via `vitepress`, esbuild 0.27.3 via `tsup`/`vitest` in stoat-worker)

## Severity
**LOW** — none is reachable at runtime (dev-server-only issues); CI's `pnpm audit --prod --audit-level high` correctly ignores them. Coordinator-run `pnpm audit --json` (`../evidence/pnpm-audit.json`, summary in `../evidence/pnpm-audit-summary.md`).

## Category
CWE-1104 Use of Unmaintained Third Party Components · OWASP A06:2021

## Location
| Advisory | Package | Resolved | Fixed in | Path |
|---|---|---|---|---|
| GHSA-fx2h-pf6j-xcff (HIGH) | vite | 5.4.21 | ≥ 6.4.3 | `apps/api-worker > vitepress > vite` |
| GHSA-4w7w-66w2-5vf9 (MOD) | vite | 5.4.21 | ≥ 6.4.2 | same |
| GHSA-v6wh-96g9-6wx3 (MOD) | vite | 5.4.21 | ≥ 6.4.3 | same |
| GHSA-67mh-4wv8-2f99 (MOD) | esbuild | 0.21.5 | ≥ 0.24.3 | `apps/api-worker > vitepress > @vitejs/plugin-vue > vite > esbuild` |
| GHSA-g7r4-m6w7-qqqr (LOW) | esbuild | 0.27.3 | ≥ 0.28.1 | `apps/stoat-worker > tsup / vitest > esbuild` |

## Recommendation
Bump `vitepress` to a release on Vite ≥ 6.4.3 (or add a `vite` override for the docs workspace) and `tsup`/`vitest` in stoat-worker when convenient. Positive controls already in place: `minimumReleaseAge: 1440`, `allowBuilds` deny-all, `--frozen-lockfile` everywhere, nightly `pnpm audit --prod`, OIDC trusted publishing with `--provenance`.

## References
- `../evidence/pnpm-audit.json`, `../evidence/pnpm-audit-summary.md`
