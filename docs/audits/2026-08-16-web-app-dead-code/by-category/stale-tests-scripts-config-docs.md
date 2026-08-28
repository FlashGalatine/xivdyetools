# Stale Tests, Scripts, Config & Docs — Summary

## Overview
- **Total Findings:** 8 (DEAD-006, 007, 025, 026, 027, 028, 029 + config parts of 021)
- **Recommended for Removal:** 6 remove, 2 refactor/correct

| ID | Location | Confidence | Recommendation |
|----|----------|------------|----------------|
| DEAD-006 | dead aliases/paths, `build:css*`, `tsconfig.app.json`, `main` field | HIGH | REMOVE |
| DEAD-007 | `spectral.js` direct dependency (used only via core) | HIGH | REMOVE |
| DEAD-025 | `manifest.json` v3 shortcuts + `share_target`, `sitemap.xml` v3 URLs, `browserconfig.xml` missing tile | HIGH | REFACTOR FIRST (correct, don't delete) |
| DEAD-026 | `convert-icons-to-webp.js` (dead), `analyze-unused-keys.js` (unwired), `generate-icons.mjs` half-dead path, `scripts/README.md` | HIGH | REMOVE / wire / fix |
| DEAD-027 | `e2e/example.spec.ts` (fixture exports re-checked: live, kept) | HIGH | REMOVE |
| DEAD-028 | 22/32 `component-utils` helpers, 9 mock factories, `errorHandlers`, 2 server helpers | HIGH | REMOVE |
| DEAD-029 | stale `CLAUDE.md`/`scripts/README.md`/`.env` lines, `engines.node` mismatch | HIGH | CORRECT |

**Dependencies verified KEEP:** every other devDependency has a real consumer (`sharp` only for manual one-shot scripts; `cross-env` for one script; `wrangler` pins the version `cloudflare/wrangler-action@v4` uses from the working directory — KEEP-UNCERTAIN, confirm against the action's source before removing).
