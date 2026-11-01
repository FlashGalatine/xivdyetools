# DEAD-031: FIXED_KEYS.noItem entry cannot be reached
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** bot-logic (ships to discord-worker) · **Semver:** NONE · **Category:** Legacy
**Calibration:** Blast NONE->LOW for consistency with D16: removing it would be an internal production map-entry edit in bot-logic. KEEP is unchanged, pending the CharaPieceProblem trigger.

## Location
- `packages/bot-logic/src/commands/glamour.ts:363-368`

## Evidence
- Read glamour.ts:305-375. readPiece's no-item branch (313-329) sets fixed:null and blocked:'noItem'. The other branch sets fixed.problem = lowest.problems[0] (355-357). That value comes only from charaTwinProblems (core chara-game-rules.ts:141-153), which pushes only 'dye', 'glamour' or 'wear', or from [] at chara-twins.ts:90. So FIXED_KEYS[...] at glamour.ts:581 never gets 'noItem'. FIXED_KEYS is a module-private const and the Piece interface is not exported, so semver is NONE. CharaPieceProblem (chara-game-rules.ts:132) includes 'noItem', so Record exhaustiveness forces the entry. web-app glamour-block.ts:1441 has the same placeholder. git log -S: added in bfd393e7.
- The entry is unreachable, but it costs one line and is required by the Record<CharaPieceProblem,string> type. Removing it means narrowing the internal Piece type for no runtime gain, and it would break the parallel pattern in the web-app glamour-block.ts. Revisit when either of these holds: (a) a @xivdyetools/core release changes the CharaPieceProblem union at chara-game-rules.ts:132, or (b) git grep "push('noItem')" packages/core/src/services/chara matches, meaning charaTwinProblems starts emitting noItem. Under (b) the entry becomes reachable, and its key should then be a real fixed-noItem string, not glamourFixedWear.
- Still live: None at runtime. The entry is required only by the Record<CharaPieceProblem,string> type check at glamour.ts:363.

## Fix
- **KEEP** — revisit trigger: A core release changes the CharaPieceProblem union (chara-game-rules.ts:132), OR git grep "push('noItem')" packages/core/src/services/chara returns a hit.
- Cascade: None. The i18n key card.glamourFixedWear stays live through the wear entry at glamour.ts:366.

## Status
OPEN
