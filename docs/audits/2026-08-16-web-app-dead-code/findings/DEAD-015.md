# [DEAD-015]: Unread locals, fields, params and a write-only Lit `@state` — the 15 `tsc --noUnusedLocals` hits (~90 lines incl. cascades)

## Category
Dead Code Path

## Location / Evidence
`npx tsc --noEmit --noUnusedLocals --noUnusedParameters` (`evidence/tsc-unused.txt`; the app's `tsconfig.json` sets both flags `false`, and `eslint.config.js` ignores `^_`-prefixed names, which is how these survive lint). Each verified by reading the code:

| file:line | symbol | what it is | lines |
|---|---|---|---|
| `src/components/comparison-tool.ts:140` | `dyesWithHSV` | private field written at `:351,:2070,:2371`, **read nowhere**. Its exclusive helper `calculateHSVValues` (`:2066-2079`) is called from 6 sites (`:313,:586,:2037,:2213,:2430,:2562`) solely to keep the dead field fresh; exclusive type `DyeWithHSV` (`:78-86`). The "visual charts" it fed no longer exist (cf. dead `comparison.chart.*` i18n keys, DEAD-022). | ~32 |
| `src/components/comparison-tool.ts:539-550` | `createHeader` | private method, 0 call sites (same-named methods in `accessibility-tool.ts:527`, `harmony-result-panel.ts:148` are separate and live) | 12 |
| `src/components/harmony-tool.ts:1696-1707` | `findHarmonyDyesInternal` | private thin delegate to `findHarmonyDyes`, never called; its import at `:36` becomes unused. Knock-on: `findHarmonyDyes` in `harmony-generator.ts:259-303` becomes test-only (45 more lines) — flagged, not recommended | 13 |
| `src/components/swatch-tool.ts:283` | `gridExcerptAnchor` | field written 5× (`:1513,:1523,:1530,:1747,:1778`), read 0× | 7 |
| `src/components/swatch-tool.ts:3103` | `_key` | leftover interpolated i18n key string; the method uses the explicit `labels` record | 1 |
| `src/components/dye-action-dropdown.ts:448-456` | `_toolName` | 3-branch `if/else` of `LanguageService.t()` calls whose result is never read | 9 |
| `src/components/v4/result-card.ts:1336` | `_toolName` | never read → its only source, private `getToolDisplayName` (`:1314-1325`), becomes dead too | 1 + ~12 |
| `src/components/dye-grid.ts:103` | `_isFocused` | computed per cell, never applied — see caution below | 1 |
| `src/components/mixer-tool.ts:178,1580` | `slot3Element` | never assigned an element; the Mixer is a two-dye tool (leftover of a 3-slot design) | 2 |
| `src/components/v4-layout.ts:39,153,696` | `_configController` | write-only module variable | 3 (with DEAD-012 row 8) |
| `src/components/v4/preset-detail.ts:99,591,596` | `@state() displayOptions` | Lit reactive state that is written from `ConfigController` and **never read in `render()`** — every write triggers a wasted re-render | 3 |
| `src/services/share-service.ts:235` | param `tool` of `addParamsToUrl` | body iterates `params` only; one call site `:213` | 2 edits |
| `src/services/share-service.ts:751` | `_failed` | dead local in `getAnalyticsStats` | 1 |
| `src/components/add-to-collection-menu.ts:185` | param `dyeName` | one call site `:90/:93`; the local at `:43` exists only to feed it | 3 |
| `src/shared/beta-branding.ts:127` | param `attr` | **FALSE-POSITIVE** — required first arg of a `String.replace` callback; rename `_attr` or leave | 0 |

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH for all but `_isFocused` |
| **Blast Radius** | LOW — each edit is local; `dyesWithHSV` touches 6 call sites in one file |
| **Reversibility** | EASY |
| **Hidden Consumers** | `_isFocused` (`dye-grid.ts:103`) computes a keyboard-focus flag that is then not applied to the cell — this may be a **missing feature** (focus ring / `aria-selected` on the roving-tabindex grid) rather than dead code. `focusedIndex` itself is live for keyboard nav (`:381-423`). **REFACTOR-FIRST**: decide whether the cell should reflect focus; if yes, apply it; if no, delete the line. |

## Recommendation
**REMOVE** (all rows except `_isFocused` → **REFACTOR FIRST**; `attr` → rename)

### Rationale
Beyond hygiene, two of these are live inefficiencies: `preset-detail.displayOptions` causes spurious Lit re-renders on every config change, and `dye-action-dropdown._toolName` performs three translation lookups per open for nothing. Silencing with `_` was the wrong fix.

### If Removing
1. Apply the deletions row by row (see the agent report §D for exact line sets); after `dyesWithHSV` goes, check whether `ColorService.hexToHsv` is still imported for another use
2. Consider flipping `noUnusedLocals`/`noUnusedParameters` to `true` in `apps/web-app/tsconfig.json` once the count is 0 (test files currently contribute 4 more hits — fix those too) so this class cannot regrow
3. `pnpm --filter xivdyetools-web-app run type-check test`
