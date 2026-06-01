# Dependencies Summary

## Overview
- **Total Findings:** 2 (DEAD-108, DEAD-109)
- See `../evidence/dependency-scan.txt` for the full per-package usage table.

## Findings
| ID | Package | Status | Recommendation |
|----|---------|--------|----------------|
| DEAD-108 | `@testing-library/dom` | zero imports in src/e2e | REMOVE (verify first) |
| DEAD-108 | `@testing-library/user-event` | zero imports in src/e2e | REMOVE (verify first) |
| DEAD-108 | `@xivdyetools/test-utils` | zero imports anywhere | REMOVE (verify first) |
| DEAD-109 | `@tailwindcss/postcss` | build-only, mis-placed in `dependencies` | MOVE to `devDependencies` |
| DEAD-109 | `cross-env` | used in script, **not declared** (phantom) | ADD to `devDependencies` |

## Not flagged (intentionally) — common false positives
- `@vitest/coverage-v8`, `@vitest/ui` — activated via CLI flags (`--coverage`, `--ui`), never imported.
- `@types/node` — ambient types.
- `autoprefixer`, `postcss` — used by `postcss.config.js` / Vite (config files were initially missed by an automated scan; verified by reading them).
- `eslint-config-prettier`, `eslint-plugin-prettier` — imported by `eslint.config.js`.
- `sharp` — used by `scripts/convert-icons-to-webp.js`.

## Notes
Confirm DEAD-108 with `pnpm --filter xivdyetools-web-app why <pkg>` + a build before editing `package.json` — a setup file or
transitive re-export could still pull a testing-library package.
