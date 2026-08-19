# [DEAD-003]: Swatch `sheet` / `race` / `gender` are parsed, forwarded and typed but never used by the card — and they fragment the image cache key

## Category
Dead Code Path (parsed-but-unused parameters)

## Location
- `src/index.ts` 490, 498–501, 525–527 (parse + pass into `generateSwatchOG`)
- `src/services/svg/swatch.ts` 19, 28–33 (`SwatchOGOptions.sheet/race/gender`, `ColorSheetCategory`/`CharacterGender` imports)
- `src/og-data-generator.ts` 264–271 (`imageUrlParams` forwards `sheet`/`race`/`gender` onto the emitted `og:image` URL)
- `src/types.ts` 121–128 (`SwatchParams.sheet/race/gender/index`)

## Evidence
`generateSwatchOG` destructures `algorithm, locale, frame` and never reads `options.sheet/race/gender` (swatch.ts:48-95). CLAUDE.md's route table says so in as many words: *"`?sheet=`/`?race=`/`?gender=` are parsed but the 15E card does not use them"*. `SwatchParams.index` (types.ts:128) has zero readers anywhere.

Efficiency angle: `og-data-generator.ts:264-271` still appends `?sheet=&race=&gender=` to the emitted image URL, so an identical PNG gets a distinct edge-cache key per (sheet, race, gender) tuple — pointless cache fragmentation for a card that renders the same bytes.

**Keep** the *crawler-HTML* use: `generateSwatchOGData` uses `sheet`/`race`/`gender` to write the description ("Find FFXIV dyes matching this Female Wildwood hair colour") and to build the **page** URL — that part is live and correct.

## Why It Exists
v1 swatch card drew the sheet context; 15E removed it and left the plumbing.

## Removal Risk Assessment
| Factor | Assessment |
|---|---|
| **Confidence** | HIGH |
| **Blast Radius** | LOW — 4 files, ~25 lines |
| **Reversibility** | EASY |
| **Hidden Consumers** | Already-cached image URLs carrying `?sheet=` keep working (the route simply ignores unknown query params) |

## Recommendation
**REMOVE**

### If Removing
1. index.ts: delete 498–501 and 525–527; fix the route doc comment at 490.
2. swatch.ts: drop `sheet/race/gender` from `SwatchOGOptions` and the `ColorSheetCategory, CharacterGender` type import.
3. og-data-generator.ts: drop the three `imageUrlParams.set` lines (keep `algo`).
4. types.ts: delete `SwatchParams.index`; keep `sheet/race/gender` on `SwatchParams` (crawler description uses them) and keep `ColorSheetCategory`/`CharacterGender`.
5. Update the CLAUDE.md route-table cell.
