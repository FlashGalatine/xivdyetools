# DEAD-021: api-worker `lib/services.ts` re-exports `LocalizationService` for nobody — every consumer imports it straight from `@xivdyetools/core`

**Confidence:** HIGH · **Blast radius:** NONE · **Deploy unit:** apps/api-worker · **Semver:** NONE (app-internal) · **Category:** Redundant Re-export

## Location
- `apps/api-worker/src/lib/services.ts:9` — `LocalizationService` pulled into the import list only to be re-exported
- `apps/api-worker/src/lib/services.ts:14` — `export { LocalizationService };`

## Evidence
- knip *Unused exports* (`evidence/knip-root.txt`).
- The three importers of `lib/services.js` take `dyeService` / `calculateDistance` only (`routes/dyes.ts:12`, `routes/match.ts:12`, `telemetry/schema.ts:22`, plus two tests).
- Every actual use of the class imports the package directly: `lib/dye-serializer.ts:6`, `middleware/locale.ts:11`.

## Fix
**REMOVE** line 14 and drop `LocalizationService` from the line 9 import list. Two lines. Fold into the same commit as DEAD-020. api-worker CHANGELOG `### Removed`.
Gate: `pnpm turbo run build type-check lint test --filter=xivdyetools-api-worker`.

## Status
OPEN
