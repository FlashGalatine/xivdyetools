# DEAD-015: Unreachable ?? 'card.slotSkin' fallback for the slot label
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** bot-logic (ships to discord-worker; internal const, no export touched) · **Semver:** NONE · **Category:** Legacy
**Calibration:** Blast NONE->LOW: it edits internal bot-logic production code (the SLOT_KEYS retype plus the fallback) that ships to discord-worker. No export is touched.

## Location
- `packages/bot-logic/src/commands/swatch.ts:125 (SLOT_KEYS type), packages/bot-logic/src/commands/swatch.ts:446 (fallback)`

## Evidence
- Read swatch.ts:125-137: SLOT_KEYS has 10 keys (skin,hair,highlights,leftEye,rightEye,lip,facePaint,tattoo,limbalOrTattoo,limbal). The loop at 424 iterates projected.slots, which is Omit<ImportedCharaCharacter,'nickname'> (257); ImportedCharaSlot in core chara-library-types.ts:23 is built on AppearanceSlotInspection, and xivcharakit beta.4 types.d.ts:3,17 types kind as the 8 AppearanceSlot values plus 'tattoo' and 'limbalOrTattoo', 10 in all, every one keyed. Runtime is closed too: core pins xivcharakit 0.1.0-beta.4 exactly, and npm view shows bot-logic@4.11.0 pinning core 5.15.0. git grep: SLOT_KEYS is not exported, and no test feeds an unknown kind. 'card.slotSkin' stays live at :126. noUncheckedIndexedAccess…
- At HEAD the fallback cannot fire, by type and at runtime. The 10-key map covers the whole kind union, and the dependency chain pins exact versions. Retyping the map makes tsc enforce exhaustiveness. A new kind in a future xivcharakit then fails to compile, instead of showing a wrong SKIN label. Behavior does not change today. The const is module-private, so no published API changes: semver NONE (patch at most). The change rewrites two lines and deletes none.
- Still live: None for the fallback. SLOT_KEYS itself is live in the /swatch card rows (swatch.ts:446), through discord-worker.

## Fix
- **REMOVE** — In packages/bot-logic/src/commands/swatch.ts:125, change `const SLOT_KEYS: Record<string, string>` to `const SLOT_KEYS: Record<ImportedCharaSlot['kind'], string>`. ImportedCharaSlot is already imported as a type at :32. At :446, change `t.t(SLOT_KEYS[slot.kind] ?? 'card.slotSkin')` to `t.t(SLOT_KEYS[slot.kind])`. Keep both edits together. Without the retype, a future library kind would reach t.t(undefined) and throw on path.split. Gate: pnpm turbo run build type-check lint test --filter=...@xivdyetools/bot-logic. Then add a patch-level CHANGELOG note on…
- Prerequisite: Apply the SLOT_KEYS retype in the same change as the fallback removal.
- Cascade: None. 'card.slotSkin' stays referenced by SLOT_KEYS.skin, so the locale key is not orphaned, and no tests need to change.

## Status
OPEN — source prepared; release pending. [A-BOT-LOGIC evidence](../../2026-10-26-security/evidence/remediation-bot-logic-2026-10-27.md).
