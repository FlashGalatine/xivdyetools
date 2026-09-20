## 2. knip

- Root `knip.jsonc` runs in monorepo mode and source-maps `packages/*/dist` → `src` via declaration
  maps; no `paths` block needed. `knip --workspace X` filters **reporting**, not loading —
  consumers in other workspaces still count, which is what you want for packages.
- `--production` only means anything when the **project** glob carries `!` too
  (`"project": ["src/**/*.ts!"]` — og-worker's config). Without it every dependency the entry
  doesn't import directly looks unused. Root-config apps other than og-worker are not set up for it.
- knip **cannot see test-only code** (tests are entries) and knip 6 has **no `classMembers`
  rule** — the test-only tier and dead public methods were the majority of dead lines in every
  audit. Always add a per-export zero-non-test-reference scan and a class-member survey
  (`dead-code-finder/scripts/`).
- Known false positives: `scripts/check-bundle-size.d.ts` (implicit `.d.ts` for a `.js` import),
  `ICON_TOOL_DYE_MIXER`, `browser-api-types.ts` (`declare global`), `@customElement` side-effect
  modules, `@public`-tagged package exports (intentional API), `wrangler` devDep in web-app (pins
  wrangler-action). depcheck false-positives the postcss/tailwind stack — don't run it.
- Root `pnpm lint:dead` (since 2026-09-01) reports only the three documented web-app root-vs-local
  artifacts (two `.d.ts` files + the kept `wrangler` devDep) plus configuration hints — the "~200
  issues" figure was stale by an order of magnitude. Per-unit gates: every workspace except the parked
  `apps/stoat-worker` runs knip inside `lint` (`lint:dead` on 8 packages + 6 workers, web-app and
  og-worker via their own `knip.jsonc`). knip cannot see test-only reachability or class members —
  that is `pnpm dead-code:check` (`scripts/check-dead-code.ts`, also in CI), whose limits are listed
  in the root CLAUDE.md Tooling section (raw-text references, the self-reference trap, unmasked regex
  literals, computed-key calls, zero-test-ref members).
- turbo can serve a **stale green** for `lint` when only another workspace changed — the dead-code
  gate reads the whole graph; run the gate directly when it matters.

## 3. "Dead" verdicts that were wrong

- **Barrel vs subpath**: an `index.ts` export with zero importers may be live via a package
  subpath (`@xivdyetools/auth/encoding`) → REDUNDANT-RE-EXPORT, not dead.
- **Shadow DOM**: web-app tools render inside `V4LayoutShell`'s shadow root, but the same
  components also mount in light-DOM modals (preset-edit-form → dye-grid). "Unreachable CSS"
  claims need a mount-path check, not a grep. Tool-content CSS is loaded in BOTH scopes
  (`src/styles/tool-content.css`: page `@import` + `?inline` into the shell sheet).
- **Type-position imports** (`import type { X }`) hide a never-constructed type from knip.
- Scans that stop at `src/` miss `packages/test-utils/integration/` and `apps/*/scripts/`,
  `functions/`, `e2e/` — entries live there too.
- Static assets: `apps/web-app/public/og/<tool>/` cards were dead only because og-worker serves
  them; check the worker before deleting assets. Root `assets/` vs Vite `publicDir: ../public`.
- Locale keys: web-app's `analyze-unused-keys.js` resolves dynamic prefixes (`t(\`swatch.${k}\`)`)
  — `swatch.*` orphans are invisible to the gate; check dynamic-prefix families by hand (the 11
  lookup patterns are catalogued in
  `docs/audits/2026-08-16-web-app-dead-code/evidence/agent-report-i18n.md` §A).
- Re-grep every symbol immediately before `git rm` — three live e2e fixture exports were flagged
  dead in 2026-08-16 by a stale pass.

