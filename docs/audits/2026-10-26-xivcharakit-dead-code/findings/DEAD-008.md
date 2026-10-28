# DEAD-008: swatch-tool redefines MONO and SANS, which chara-ui already exports — ~3 lines
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** web-app (unpublished app, ships with the next web-app release) · **Semver:** NONE · **Category:** Legacy
**Calibration:** Blast NONE->LOW: the change edits production web-app code (imports and constants), not just comments or tests.

## Location
- `apps/web-app/src/components/swatch-tool.ts:64,259,278-279`
- `apps/web-app/src/components/chara-ui.ts:25,27`

## Evidence
- sed swatch-tool.ts: :259 `const MONO = 'var(--font-mono)'`, :278 JSDoc, :279 `const SANS = 'var(--font-display)'`. chara-ui.ts:25/27 exports the same two strings, with the same JSDoc. swatch-tool.ts:64 already imports `{ hasValidGridCoordinate, slotLabel }` from '@components/chara-ui', so the refactor adds no new module edge. `git grep -w MONO|SANS swatch-tool.ts`: 2 declarations and 10 uses (:1291-2195), all in the same file. Five other components already import MONO/SANS from chara-ui (glamour-sheet:21, glamour-twin-picker:19, chara-file-card:29-30, chara-sheet:41, glamour-block:51-52). The font-contract test only scans for quoted family names, so the change doesn't affect it. Both packages are apps, so semv…
- The claim holds. The two local constants copy chara-ui's exports byte for byte, and the file already imports from that module. Deleting them alone would not compile, though, because 10 style strings still use them. So REFACTOR FIRST is right, and the prerequisite is adding MONO and SANS to the existing chara-ui import at :64. Rendered output stays the same because the strings are identical, and type-check catches any miss. Nothing published is affected.

## Fix
- **REFACTOR FIRST** — 1) In swatch-tool.ts:64, change the import to `import { MONO, SANS, hasValidGridCoordinate, slotLabel as charaSlotLabel } from '@components/chara-ui';`. 2) Delete :259 (MONO) plus the blank line after it, then :278-279 (the SANS JSDoc and const). 3) Run `pnpm turbo run build type-check lint test --filter=xivdyetools-web-app`, then `pnpm dead-code:check`. budget-tool.ts:151 and mixer-tool.ts:1265 define the same local MONO, but those are outside D15. Fold them in only as a separate change.
- Prerequisite: Extend the existing chara-ui import at swatch-tool.ts:64 with MONO and SANS before deleting the local constants.
- Cascade: None. No other file reads swatch-tool's private constants. The same MONO duplicates exist in budget-tool.ts:151 (module-level) and mixer-tool.ts:1265 (function-local) and are out of scope here.

## Status
OPEN — remaining A-WEB implementation and regression proof prepared in web 5.16.4 (draft #347); production acceptance pending. [A-WEB evidence](../../2026-10-26-deep-dive/evidence/remediation-web-2026-10-28.md).
