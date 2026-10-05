# DEAD-003: 6 legacy ContextAction members in result-card.ts and their handler cases in 5 tools are never emitted (~102 src lines + 126-line guard test)
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** apps/web-app · **Semver:** NONE · **Category:** Dead Path · **Origin:** MAIN

## Location
- `apps/web-app/src/components/v4/result-card.ts:127` — CONTEXT_ACTIONS 'add-comparison'|'add-mixer'|'add-accessibility'|'see-harmonies'|'budget'|'copy-hex'

## Evidence
- ResultCard is the only context-action emitter (result-card.ts:1114,1192) and it emits only inspect-*/transform-*/external-*/add-mixer-slot-*. No src, e2e or test dispatches the six legacy actions, so the handler cases in 5 tools are unreachable.
  - Commands: git grep "context-action" in apps/web-app: the only emitters are result-card.ts:1114,1192, and the menu calls at 1807-1893 pass inspect-, transform- and external-* actions.; git grep of the legacy literals over src+e2e finds only the handlers, the vocabulary at 128-133 and context-action-vocabulary.test.ts:75-79.; budget-tool's handleContextAction (1832-1853) and swatch-tool's (2421-2428) handle only these legacy actions.
- Origin: git grep at 8ecb878f lists the same cases at budget-tool.ts:1834-1849, gradient-tool.ts:2089-2105, harmony-tool.ts:1661-1677, mixer-tool.ts:2030, swatch-tool.ts:2423, result-card.ts:128-133. git diff 8ecb878f..HEAD touches none of these files.

## Fix
**REMOVE WITH CAUTION.** budget-tool's, swatch-tool's and harmony-tool's whole listeners and methods die, not just their cases. The guard test must be rewritten, not deleted, so it keeps its navigate-to-tool check. Keep success.copiedToClipboard (still used at budget-tool.ts:1188). common.copied loses its only caller (gradient-tool.ts:2107).

Steps: 1) result-card.ts: delete lines 127-133 (the legacy comment plus 6 members) and rewrite the docblock at 100-110. 2) budget-tool.ts: delete the listener at 1136-1140 and the method at 1832-1853; drop ContextAction from the import type on line 32 (handoffTo is still used at 1180/1183). 3) swatch-tool.ts: delete the listener at 2407-2412 and the method at 2418-2428; drop ContextAction from the import on line 63. 4) gradient-tool.ts: delete the legacy cases at 2088-2109. 5) harmony-tool.ts: handleContextAction (1653-1683) handles only the six removed actions, so delete its listener at 1638-1642, the whole method, and the ContextAction import at line 68. 6) mixer-tool.ts: delete the copy-hex case at 2030-2034. 7) Rewrite src/components/__tests__/v4/context-action-vocabulary.test.ts (126 lines): keep its check that swatch-tool.ts and mixer-tool.ts never contain the 'navigate-to-tool' event string, and drop the parts that read the removed methods (extractMethodBody throws once swatch's method is gone, and DEAD_LEGACY_ACTIONS: ContextAction[] stops type-checking). 8) Remove common.copied (line ~127) from all 6 locales if the orphan test flags it. 9) pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app && pnpm dead-code:check.

## Status
OPEN
