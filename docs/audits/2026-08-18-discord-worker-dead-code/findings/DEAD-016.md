# [DEAD-016]: svg — 9 of 20 panel glyphs are never requested (1.5 KB of path data that ships in the web-app bundle)

## Category
Dead Data (design reserve)

## Location
- `packages/svg/src/icons/tool-icons.ts` — `PANEL` record: `wait`, `steps`, `formats`, `stack`, `ratio`, `swap`, `pin`, `pin-off`, `anchor` — 1,513 of 3,029 bytes of path data
- Every other glyph set is 100 % requested: tool 10/10 compact + 9/9 detail (og-worker `DEFAULT_DECK` renders every tool), harmony 10/10, chrome 4/4, category 9/9; panel 11/20 (`search`, `funnel`, `alert`, `folder`, `coins`, `presets-empty`, `gear`, `star`, `star-fill`, `kebab`, `dye`)

## Evidence
Requested names collected from every literal + resolved dynamic call site (`apps/web-app/src/shared/{tool,harmony,category,state,ui}-icons.ts`, og-worker `default-card.ts`/`band-shared.ts`, svg internals). The whole `PANEL` record is retained once `panelGlyph` is imported (`sideEffects: false` cannot tree-shake object members), so the nine ship in the web-app bundle. Header comment calls them the "panel + empty state set confirmed 2026-08-07" — a *designed* set; web-app's `ui-icons.ts` still hand-draws its other icons and never migrated to these names.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH (usage) — but whether they are "dead" or "reserved" is a design call |
| **Blast Radius** | NONE technically |
| **Reversibility** | EASY |
| **Hidden Consumers** | Future web-app UI that was meant to adopt them |

## Recommendation
**KEEP / flag to design owner** — either wire the web-app icons that these were drawn for (`ui-icons.ts`) or drop the nine. Not an auto-remove.
