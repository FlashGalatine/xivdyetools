# DEAD-038: apps/image-worker '@' path alias (vitest resolve.alias + tsconfig paths) has no importer: 10 config lines
**Confidence:** HIGH · **Blast radius:** NONE · **Deploy unit:** apps/image-worker · **Semver:** NONE · **Category:** Dead Path · **Origin:** MAIN

## Location
- `apps/image-worker/vitest.config.ts:22` — resolve.alias '@' and tsconfig paths '@/*'

## Evidence
- No tracked file in apps/image-worker imports or mocks an '@/' specifier. Every bare import is a real package, and tsconfig.base.json defines no baseUrl/paths, so dropping the local override changes no resolution.
  - Commands: git grep -n "@/" -- apps/image-worker returns only tsconfig.json:11; bare specifiers: @cf-wasm/photon, @xivdyetools/worker-kit(/image-sniff), hono, node:*, vitest; grep baseUrl|paths in tsconfig.base.json returns nothing
- Origin: git diff --stat 8ecb878f HEAD -- apps/image-worker/vitest.config.ts apps/image-worker/tsconfig.json is empty. PR #232 changed only package.json, src/index.ts, wrangler.toml and wrangler-config.test.ts.

## Fix
**REMOVE.** This is a config-only cleanup with nothing to verify first.

Steps: 1) apps/image-worker/vitest.config.ts: delete :2 (`import path from 'path';`, unused afterwards) and :22-26 (the resolve block); the closing `},` of test on :21 stays valid.
2) apps/image-worker/tsconfig.json: delete :9-12 (baseUrl + paths) and remove the trailing comma after the :8 "types" entry so the JSON stays valid.
3) Run pnpm turbo run build type-check lint test --filter=...xivdyetools-image-worker, then pnpm dead-code:check.

## Status
REMOVED, NOT DEPLOYED — `cb32ab3a` (branch `fix/remediation-2026-10-04-sprint21`, image-worker 1.3.4; PR #275, open).
