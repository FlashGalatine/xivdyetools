# DEAD-004: web-app — five exported functions with zero production call sites (`closeChangelogModal`, `clearCharaResolveCache`, `getConfigController`, `findHarmonyDyes`, `getMarketBoardService`) — 71 lines

**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** apps/web-app · **Semver:** NONE (app-internal) · **Category:** Unused Export (test-only)

## Location
- `src/components/changelog-modal.ts:398-406` `closeChangelogModal` (9) — the modal closes through its own instance method
- `src/services/chara-resolve-service.ts:169-172` `clearCharaResolveCache` (4) — added with the 2026-08-20 chara work, never wired
- `src/services/config-controller.ts:436-442` `getConfigController` (7) — every consumer imports the `ConfigController` class directly (7 files)
- `src/services/harmony-generator.ts:260-304` `findHarmonyDyes` (45) — `services/index.ts:42-48` re-exports five *other* harmony helpers, not this one
- `src/services/market-board-service.ts:437-442` `getMarketBoardService` (6) — consumers use the `MarketBoardService` class

## Evidence
- `evidence/symrefs-web-app.txt`: each row is `prod=1` (its own declaration) with 3–35 test references.
- Re-checked against non-`src` files (vite plugins, `functions/`, `scripts/`, `e2e/`) — `evidence/recheck-nonsrc.txt` shows no hits. That check exists because it caught two false positives in discord-worker (`countLocalizations`, `LOCALE_CODES` are used by `scripts/register-commands.ts`).
- Spans measured in `evidence/measure.txt`.

## Fix
**REMOVE** each function and the test blocks that only exercise it (keep tests that assert the surviving class API). `getConfigController`/`getMarketBoardService` are singleton accessors over live classes — delete the accessor only, never the class. Re-grep each symbol immediately before deleting. web-app CHANGELOG `### Removed`.
Gate: `pnpm turbo run build type-check lint test --filter=xivdyetools-web-app`.

## Status
FIXED 2026-09-01 `a7cb99f8` — four removed. `clearCharaResolveCache` was KEPT: it is a `beforeEach` isolation hook, now documented as one.

