# DEAD-001: Comments and docs describing behavior that no longer exists (web-app) — ~5 lines
**Confidence:** HIGH · **Blast radius:** NONE · **Deploy unit:** web-app · **Semver:** NONE · **Category:** Legacy

## Location
- `apps/web-app/src/components/swatch-tool.ts:1103`
- `apps/web-app/src/components/glamour-block.ts:244-247,302-304`
- `apps/web-app/src/services/chara-resolve-service.ts:3`

## Evidence
- git grep -i glamour swatch-tool.ts: only :1103 plus :1374-1388 (link to Glamour Reader); test swatch-tool.test.ts:1678 'no longer draws DYES ON THIS GLAMOUR'. git grep -w moveTo: only prod caller glamour-tool.ts:109. resolveCharaEquipment callers: glamour-block.ts:394, item-links-menu.ts:284; card :63-65 says Swatch never calls resolve. glamour-block.ts:244-247 is a JSDoc stacked on the PICKS JSDoc. readGearModels :567 / gear dyes :672 call readArray(value, MAX_*) whose length check (:376) runs before the seen-set loop, so the cap rejects the 13/25 cases first. swatch-tool.ts:1109-1112 sits directly above this.mainLayout (:1113), not mountChara (:1361), and still describes it correctly.
- Every cited comment except one contradicts the current code. Swatch has had no glamour container since the Glamour Reader took it over. moveTo's host is glamour-tool. The Swatch Matcher never calls resolve. readArray's length cap runs before the uniqueness check, so the 'no test reaches it' notes are wrong; the same wrong note also sits at test.ts:423-424, which the reviewer missed. The narrowing: swatch-tool.ts:1109-1112 is not orphaned and is accurate (it sits on this.mainLayout), so exclude it. The fix is mostly a rewrite: only 5 lines are deleted outright (1103 and 244-247), and about 14 others are reworded. These are app comments and docs only, so no runtime or published-API effect.

## Fix
- **REMOVE** — Comments only. No git rm. 1) swatch-tool.ts: delete line 1103. Leave 1109-1112 as they are. 2) glamour-block.ts: delete the orphaned JSDoc at 244-247. In 302-304, change "the Swatch Matcher's panel" to "the Glamour Reader's panel". 3) chara-resolve-service.ts:3 and CLAUDE.md:136: name the Glamour Reader and item-links menu instead of Swatch 11a/11c. 4) protocol.ts:87-90 and test.ts:393-394 and 423-424: say the length cap rejects first and uniqueness is the backstop. 5) chara-file-card.ts:10-11: add the sendsGearIds exception. Then run pnpm turbo run lint type-check test --filter=xivdyetools-web-app.
- Prerequisite: None
- Cascade: None. Comments, a test comment and the app CLAUDE.md only. No symbol, import or locale key changes.

## Status
OPEN
