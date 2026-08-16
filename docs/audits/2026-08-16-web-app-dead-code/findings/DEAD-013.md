# [DEAD-013]: 21 dead SVG icon constants (~6.4 KB of inline SVG strings)

## Category
Unused Export

## Location
- `apps/web-app/src/shared/ui-icons.ts` — 18 constants: `ICON_COINS`(109-117), `ICON_FILTER`(137-142), `ICON_EXPORT`(152-159), `ICON_SORT`(186-191), `ICON_TARGET`(216-221), `ICON_SPARKLES`(223-228), `ICON_DISTANCE`(230-235), `ICON_SEARCH`(261-266), `ICON_USER`(276-281), `ICON_EDIT`(283-288), `ICON_TRASH`(290-295), `ICON_DOCUMENT`(329-337), `ICON_LOCKED`(348-356), `ICON_BOOK`(380-388), `ICON_SUCCESS`(390-397), `ICON_ERROR`(399-406), `ICON_IMPORT`(419-427), `ICON_FOLDER`(429-435) — **130 lines / 6,096 bytes**
- `apps/web-app/src/shared/ui-icons.ts:37` — `ICON_THEME` (alias of `ICON_THEME_SUN`) — test-only
- `apps/web-app/src/shared/tool-icons.ts:36` — `ICON_TOOL_MATCHER` (alias of `ICON_TOOL_EXTRACTOR`) — test-only
- `apps/web-app/src/shared/state-icons.ts:37-38` — `ICON_STATE_WAIT` (the separate `ICON_STATE_WAIT_ANIMATED` is live)

## Evidence
Each of the 18 grepped to exactly one hit (its declaration). Three additionally appear only in prose comments in `state-icons.ts` naming what replaced them (`ICON_STATE_COINS`, `ICON_STATE_SEARCH`, `ICON_STATE_FOLDER`). `ICON_FOLDER`'s extra hits are a *different* symbol (`collection-manager-modal.ts:14` aliases `ICON_STATE_FOLDER as ICON_FOLDER`). None appears inside any `html\`\`` template, `innerHTML`, e2e spec, or `icons.test.ts`. `ICON_THEME` and `ICON_TOOL_MATCHER` are referenced only by `src/shared/__tests__/icons.test.ts` (`:38,:291-294` and `:29,:176,:256-258`). knip: all in *Unused exports*.

**Do not confuse:** `ICON_LOCK` (`ui-icons.ts:362`) is byte-identical geometry to `ICON_LOCKED` and IS live. `ICON_TOOL_DYE_MIXER` was flagged by knip as a duplicate but is live (`mixer-tool.ts:47,1520,1612`).

## Why It Exists
The 5.0 icon system split UI glyphs into `state-icons.ts` (semantic states) and left the pre-5.0 generic set in `ui-icons.ts`; several were superseded one-for-one and the originals never removed.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH |
| **Blast Radius** | NONE — no import sites |
| **Reversibility** | EASY |
| **Hidden Consumers** | Bundle: SVG string constants that are exported-but-unused are already tree-shaken by esbuild, so **no runtime bundle change** — this is source hygiene only. |

## Recommendation
**REMOVE**

### If Removing
1. Delete the 18 declarations + JSDoc from `ui-icons.ts`; delete `ICON_THEME` (`:37`), `ICON_TOOL_MATCHER` (`tool-icons.ts:36`), `ICON_STATE_WAIT` (`state-icons.ts:37-38`)
2. `icons.test.ts`: drop the `ICON_THEME` import/assertions (`:38,:291-295`) and retarget `:176` to `ICON_TOOL_EXTRACTOR`
3. Amend the prose at `state-icons.ts:57` if it names `ICON_STATE_WAIT`
4. `pnpm --filter xivdyetools-web-app run type-check test`
