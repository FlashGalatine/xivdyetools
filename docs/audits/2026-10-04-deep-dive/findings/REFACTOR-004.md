# REFACTOR-004: glamour-block DYEABLE_SLOTS duplicates core chara-gposers private DYEABLE with a 'change both' comment
**Priority:** LOW · **Effort:** LOW · **Risk:** LOW · **Deploy unit:** apps/web-app · **Origin:** MAIN · **Other units:** packages/core (chara-gposers.ts:84-92)

## Location
- `apps/web-app/src/components/glamour-block.ts:147`

## Evidence
- Reproduction: Changing membership in one copy only makes the Reader rows and the GPOSERS export disagree on which slots show Dye 1/Dye 2.
- Identical 7-slot sets at glamour-block.ts:147-155 and chara-gposers.ts:84-92, linked only by a comment (lines 144-145). Drift risk is in membership only, which is a stable game fact; the block deliberately still draws accessory dyes via its non-dyeable branch (819-822) while the export drops them, so the sets' users already diverge on purpose.
  - Checked: glamour-block.ts:144-155,819,838; packages/core/src/services/chara/chara-gposers.ts:84-92,120
- Origin: git grep 8ecb878f: glamour-block.ts:147 DYEABLE_SLOTS and :144 'change both' comment

## Fix
- Export the DYEABLE set (typed over the shared slot ids) from core and import it in glamour-block — needs a @xivdyetools/core publish, then consumer deploys (web-app).

## Status
OPEN
