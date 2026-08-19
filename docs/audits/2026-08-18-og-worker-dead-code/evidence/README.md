# Evidence

| File | What |
|---|---|
| `knip.og.jsonc` | Root-level knip 6.32 config used for the run — og-worker workspace only, `@xivdyetools/*` path-mapped to package `src` so imports resolve to source, `ignoreExportsUsedInFile: true`. |
| `knip-default.txt` | Default mode (test files are entries). Reports the fonts.ts pair, the barrel over-exports, and `ShareParams` — anything kept alive **only** by a test is hidden here. |
| `knip-production.txt` | `--production` mode as run during the audit — reports `@resvg/resvg-wasm` / `@xivdyetools/svg` as unused deps. **Correction (post-audit):** this was a config gap, not a knip failure. In production mode the *project* globs need the `!` suffix as well as the entry (`"project": ["src/**/*.ts!"]`); without it only the entry file counts as production code, so every dependency `index.ts` does not import directly looks unused. With the `!` it works and reports the test-only tier directly (`apps/og-worker/knip.jsonc`, `pnpm lint`). The 2026-08-18 discord-worker audit's identical "unusable" note has the same cause. |
| `tsc-unused.txt` | `tsc --noEmit --noUnusedLocals --noUnusedParameters` — 4 × TS6133 (2 prod, 2 test). og-worker's tsconfig turns these flags **off** (DEAD-008), which is why they are not red in CI. |
| `symrefs-out.txt` | Word-boundary reference counts for ~60 candidate symbols, bucketed prod / og-worker tests / rest of monorepo (`git ls-files` only). The primary evidence for the test-only tier (DEAD-002/004/005/023). |
| `skipped-tests.txt` | grep for `.skip/.only/.todo/xit/xdescribe` — **empty**. |
| `legacy-markers.txt` | grep for `@deprecated / LEGACY / TODO / FIXME / HACK / workaround / for future / call-site stability / kept for` over non-test src. |
| `vitest-baseline.txt` | `vitest run` at HEAD: 16 files, 294 tests, all green — the number the cleanup waves must preserve. |
| `font-subset-regen.txt` | Re-ran `scripts/subset-cjk-fonts.py` and diffed the three CJK subsets **by cmap** against HEAD (byte hashes are non-deterministic — fonttools rewrites `head.modified`). Result: committed subsets are a strict superset (+0 / −99 job-name glyphs, ~45 KB). Regenerated files were reverted. |
| `scripts/symrefs.sh` | The bucketed reference counter. |

Also consulted (not copied): `apps/web-app/src/services/share-service.ts` (share-URL grammar for the DEAD-001/022 consumers), `.github/workflows/deploy-og-worker{,-beta}.yml` (`/health` and the emitted-URL smoke test — harmony only), `docs/projects/og-worker/overview.md:104` (documents DEAD-001 as a "known gap"), `packages/core/src/services/localization/TranslationProvider.ts` (confirmed `getDyeName(itemID)` is keyed by the unique legacy item ID that `Dye.itemID` carries — the translator lookup is correct, not a finding).
