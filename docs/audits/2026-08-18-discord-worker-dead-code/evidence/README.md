# Evidence

| File | What |
|---|---|
| `knip.root.jsonc` | Root-level knip 6.32 config used for the run (monorepo mode, all 17 workspaces, `ignoreExportsUsedInFile: true`). knip source-maps `packages/*/dist/*.js → src/*.ts` via declaration maps, so imports of `@xivdyetools/*` from any app count as usage of the package's `src` symbol. |
| `knip-default.txt` | Default mode: unused files / deps / exports **excluding** package entry (`index.ts`) exports. |
| `knip-entry-exports.txt` | `--include-entry-exports`: additionally reports public-API symbols exported from a package's entry files that **no workspace in the monorepo imports** (from that file). ⚠ An export listed here for a barrel may still be live via a subpath import (e.g. `browserLogger` is imported from `@xivdyetools/logger/browser`, so the root `index.ts` re-export is "unused" but the symbol is not). Every item was manually classified — see the findings. |
| `tsc-discord-worker.txt` | `tsc --noEmit` with the base `noUnusedLocals`/`noUnusedParameters` (already on repo-wide) — clean. |
| `legacy-markers.txt` | grep for `@deprecated` / LEGACY / TODO-remove / compat markers across the scope (non-test files). |
| `skipped-tests.txt` | grep for `.skip`/`.todo`/`.only` — empty (0 skipped tests in scope). |
| `track-*.md` | Raw notes from the four manual verification passes (Phase 3). |

**Not used:** knip `--production` mode. With production entries marked (`src/index.ts!`) it still failed to traverse discord-worker's handler tree (it reported `@xivdyetools/bot-logic` etc. as unused deps of discord-worker), so its "test-only consumers" tier was recomputed by grep for the individual candidates instead.

> **Correction (2026-08-18, og-worker audit follow-up):** that was a config gap, not a knip limitation. In production mode the *project* globs need the `!` suffix too (`"project": ["src/**/*.ts!"]`); the config above only marked the entry, so knip treated the entry file alone as production code and reported every dependency it did not import directly. With the `!` on the project glob, `--production` works and surfaces the test-only tier directly — see `apps/og-worker/knip.jsonc`.

## `scripts/`
Helper scripts the manual tracks wrote (copied from the session scratchpad so the notes' references resolve):
`refs.sh` / `symrefs.sh` (bucketed word-boundary reference counts over tracked files), `imports.py` (named-import extraction of `@xivdyetools/*` across workspaces), `members.py` (per-class public-method usage survey — knip's `classMembers` blind spot), `span.py`, `i18n_orphans.py` (bot-logic locale orphan scan). `scripts/output/` holds their raw outputs (`internal-usage.txt`, `members-out.txt`, `i18n-result.json`, `glyph-calls.txt`).
