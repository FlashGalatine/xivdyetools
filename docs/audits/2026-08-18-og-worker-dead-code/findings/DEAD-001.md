# [DEAD-001]: The three 5.0 image routes (extractor / presets / budget) are unreachable from any emitted `og:image` URL

## Category
Dead Code Path (unreachable route — a *gap*, not surplus)

## Location
- File(s): `src/og-data-generator.ts` (`generateOGDataForTool`, lines 492–577), `src/index.ts` (routes at 604–677), `src/services/svg/{extractor,presets,budget}.ts`
- Symbol(s): `generateOGDataForTool` `default:` arm; `generateExtractorOG`, `generatePresetsOG`, `generateBudgetOG`

## Evidence
`generateOGDataForTool` switches on six tools and falls to `default` for `extractor`, `presets`, `budget`, emitting the **root** card (`${OG_IMAGE_BASE_URL}/default.png`) with the generic "XIV Dye Tools" title — not even the per-tool `/og/<tool>/default.png` that exists. Grep across the monorepo for `og/extractor|og/presets|og/budget` finds only the route definitions, docs, and `index.test.ts`; web-app's `index.html` points its `og:image` at a static PNG and its share-service *does* generate `/extractor/?colors=…&algo=…` and `/budget/?dye=…|hex=…` share links (`apps/web-app/src/services/share-service.ts:113-136`) that this worker intercepts. So the 276 lines of 15E extractor/presets/budget generators plus the `extractorCount` / `budgetBest` deck lines in `og-strings.ts` execute only when someone hand-types a PNG URL.

`docs/projects/og-worker/overview.md:104` already records this: *"routed (5.0) — known gap: their crawler HTML still emits the generic title and root default card"*. `src/index.test.ts:433-447` **asserts** the gap (`expect(html).toContain('https://og.xivdyetools.app/og/default.png')`).

Grammar note for the fix: `/og/extractor/:colors` wants `RRGGBB-share` pairs, but web-app's `ExtractorShareParams` carries `colors: string[]` with **no share** — the image route grammar and the share grammar were designed apart. Budget's `?hex=` (bare colour target) has no image-route counterpart either (`/og/budget/:dyeId` is stainID-only).

## Why It Exists
5.0 added the three image routes and cards (net-new) but the crawler-side data generators were never written; the beta e2e workflow only follows a `/harmony/` URL.

## Removal Risk Assessment
| Factor | Assessment |
|---|---|
| **Confidence** | HIGH that the routes are unreachable via crawler flow |
| **Blast Radius** | NONE if left; MEDIUM to fix (og-data-generator + share-grammar alignment + tests) |
| **Reversibility** | EASY |
| **Hidden Consumers** | Direct PNG URLs typed by humans / docs; the beta workflow smoke-tests only harmony |

## Recommendation
**KEEP — and close the gap** (do not delete the routes/generators).

### Rationale
The generators are the deliverable; the missing piece is ~60 lines of `generate{Extractor,Presets,Budget}OGData` + three `case`s. Deleting 276 lines of finished, tested card code to satisfy a dead-code metric would be backwards. The **test that pins the gap** must be inverted when the fix lands.

### If fixing
1. Add `generateExtractorOGData` (read `colors=` — decide whether to emit equal shares or extend the share grammar), `generatePresetsOGData` (read `?id=`/slug), `generateBudgetOGData` (read `dye=`; `hex=` falls back to the tool default card) and route them from the switch — at minimum emit `/og/<tool>/default.png` instead of the root card.
2. Flip `index.test.ts:433` to assert the per-tool image URL.
3. Extend `deploy-og-worker-beta.yml`'s emitted-URL check to one of the new tools.
4. Update `overview.md:104` (remove "known gap").
