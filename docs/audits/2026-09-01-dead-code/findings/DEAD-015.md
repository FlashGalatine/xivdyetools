# DEAD-015: moderation-worker `handlers/buttons/index.ts` — eight barrel re-exports nothing imports; the router uses only `handleButtonInteraction`

**Confidence:** HIGH · **Blast radius:** NONE · **Deploy unit:** apps/moderation-worker · **Semver:** NONE (app-internal) · **Category:** Redundant Re-export

## Location
- `apps/moderation-worker/src/handlers/buttons/index.ts:22-34` — two `export { … } from` blocks re-exporting `handlePresetApproveButton`, `handlePresetRejectButton`, `handlePresetRevertButton`, `isPresetModerationButton`, `handleBanConfirmButton`, `handleBanCancelButton`, `isBanConfirmButton`, `isBanCancelButton`

## Evidence
- knip flags all eight under *Unused exports* (`evidence/knip-root.txt`).
- The only production importer takes one name: `src/index.ts:28` `import { handleButtonInteraction } from './handlers/buttons/index.js'`.
- The two `import * as buttons` test files are not consumers either — `component-gate.test.ts` and `rate-limit-fail-open.test.ts` reference exactly `buttons.handleButtonInteraction` (5 assertions total); their `vi.mock` factories spread `importActual` and override only that name.
- The five handlers the barrel re-exports are already imported **directly** at the top of the same file for `handleButtonInteraction` to dispatch to — so the re-export block is pure surface.

## Fix
**REMOVE** both `export { … } from './preset-moderation.js'` / `'./ban-confirmation.js'` blocks (13 lines). `isPresetModerationButton` loses its last non-test reference in the process — it is covered by DEAD-014, remove them together. moderation-worker CHANGELOG `### Removed`.
Gate: `pnpm turbo run build type-check lint test --filter=xivdyetools-moderation-worker`.

## Status
OPEN
