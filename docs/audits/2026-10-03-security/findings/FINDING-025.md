# FINDING-025: pnpm-lock.yaml: wrangler 4.140.0 → miniflare 5.20260923.0-alpha pins undici 7.29.0 (10 dev-tree advisories, patched in 7.29.1), which the --prod CI audit gate cannot see
**Severity:** LOW · **Exposure:** LOCAL · **Deploy unit:** CI · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-1395

## Location
- pnpm-lock.yaml:6382-6386 — miniflare@5.20260923.0-alpha dependencies include `undici: 7.29.0` (installed: node_modules/.pnpm/undici@7.29.0, version 7.29.0)
- pnpm-lock.yaml:7222 — wrangler@4.140.0 is the only consumer of miniflare (no @cloudflare/vitest-pool-workers or miniflare in any apps/*/ or packages/*/ vitest config)
- .github/workflows/ci.yml:78 — `pnpm audit --prod --audit-level high`, so dev-tree advisories are never surfaced

## Evidence
- pnpm-lock.yaml:6382 `miniflare@5.20260923.0-alpha(@types/node@26.6.2):` -> `undici: 7.29.0`; wrangler@4.140.0 (lock:7216-7222) -> `miniflare: 5.20260923.0-alpha`
- `evidence/pnpm-audit.json` (`--prod`): 0 advisories. `evidence/pnpm-audit-full.json` (coordinator, full tree, 2026-10-03): 10 advisories — 2 high (incl. TLS certificate-validation bypass), 5 moderate, 3 low — all `undici@7.29.0` via `<app>>wrangler>miniflare>undici`, patched `>=7.29.1`. Only local `wrangler dev`/miniflare loads this copy.
- pnpm-workspace.yaml:8-27 overrides cover rollup/qs/seroval/vitepress>vite/tsup>esbuild only — no undici floor; undici entered at 4d4c1ee2 (Sprint 6 dev-toolchain bump), and no prior audit or security-trade-offs.md entry accepts it

## Fix
- Add a scoped override in pnpm-workspace.yaml, `'miniflare>undici': '>=7.29.1 <8'`, with a FINDING comment in the existing FINDING-036 style. Drop it once wrangler pulls a miniflare that ships the patched undici.
- Optionally add a non-blocking scheduled full `pnpm audit --audit-level moderate` job, so that advisories in dev tooling stay visible.

## Status
FIX COMMITTED, NOT MERGED — `3a158847` (branch `fix/security-2026-10-03-sprint11`; PR #233, draft): override `miniflare>undici: >=7.29.1 <8` resolves to 7.30.0. The full-tree audit goes from 10 undici advisories to 0, and the lockfile diff is limited to that entry. A non-blocking full-tree `pnpm audit --audit-level moderate` step was added to the `audit` job.
