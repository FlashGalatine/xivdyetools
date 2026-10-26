# FINDING-045: Page-side worker-answer validator accepts any 256-unit string as tribe, then casts it to SubRace for the swatch config and clan lookup (defense in depth only)
**Severity:** INFO · **Exposure:** INTERNAL · **Deploy unit:** web-app · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-20

## Location
- `apps/web-app/src/services/chara-inspection-protocol.ts:739` — Page-side worker-answer validator accepts any 256-unit string as tribe, then casts it to SubRace for the swatch config and clan lookup (defense in depth only)

## Evidence
- protocol.ts:739 `isLabelOrNull(tribe) &&`; :757 `tribe: tribe as ImportedCharaCharacter['tribe'],`; config-controller.ts:222 `return { ...config, race: file.tribe, gender: file.gender };`
- Reach: No external sender can reach it. The tribe comes from the first-party, same-origin inspection worker (chara-inspection-service.ts:291). That worker uses xivcharakit, which enumerates tribe against TRIBES (dist/index.js:32-49, 190; this list is identical to SubRace), and core projects tribe only when state==='valid' (packages/core/src/services/chara/chara-library.ts:258).
- readCharacter checks race and gender against enums. It checks tribe only with isLabelOrNull (protocol.ts:415-421, 739) and casts it at :757. CharaSessionService.getTribeAndGender (chara-session-service.ts:47-52) returns it as SubRace, and ConfigController.pinToCharaFile (config-controller.ts:218-223) and swatch-tool.ts:414-417 use it without the toSubRace check at swatch-tool.ts:402. chara-file-card.ts:316-317 indexes SUBRACE_TO_CLAN_KEY with it. Only a defective first-party worker or core could put a non-SubRace value there, and the worst effect is a wrong clan label or a bad race value in the user's own swatch config in localStor… Preconditions: A defective or compromised first-party worker bundle, or a core or xivcharakit regression, would have to emit a tribe that is not a SubRace. No user-supplied .chara file can do this today, because xivcharakit enumerates tribe and core keeps it only when state==='valid'.

## Fix
- In readCharacter, check tribe with `(tribe === null || isIn(SUBRACES, tribe))`, as race and gender already are, and drop the cast at :757. Add a protocol test that rejects an unknown tribe.

## Status
OPEN
