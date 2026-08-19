# [DEAD-002]: `dye-helpers.ts` character-colour-sheet lookup block (~260 lines) has no production caller

## Category
Dead Code Path / Unused Export (test-only)

## Location
- File: `src/services/svg/dye-helpers.ts`
- Lines: 14, 16–17 (imports `CharacterColorService`, `RACE_SUBRACES`, `SubRace`, `Gender`, `Race`), 23 (`characterColorService`), 52–179 (`CharacterColorLookup`, `SHARED_CATEGORY_NAMES`, `SUBRACE_SEARCH_ORDER`, `ALL_SUBRACES`, `GENDERS`, `findCharacterColorByHex`, `getHexIndex`, `buildHexIndex`), 233–362 (`CharacterColorContext`, `getCharacterColorFromSheet`, `formatSubraceName`)
- Symbols: `characterColorService`, `findCharacterColorByHex`, `getCharacterColorFromSheet`, `ALL_SUBRACES`, `CharacterColorLookup`, `CharacterColorContext`

## Evidence
`evidence/symrefs-out.txt`: every one of these symbols has prod references **only inside dye-helpers.ts itself** (`characterColorService prod=7 tests=12`, `findCharacterColorByHex prod=2 tests=8`, `getCharacterColorFromSheet prod=1 tests=7`, `ALL_SUBRACES prod=3 tests=5`, `CharacterColorContext prod=2 tests=0`, `CharacterColorLookup prod=7 tests=0`). The only plausible consumer, `swatch.ts`, imports `dyeService, deltaForAlgorithm` and nothing else — the 15E swatch card ranks dyes by ΔE and never consults a colour sheet (see DEAD-003). knip's default mode hides this because `dye-helpers.test.ts` (describes at lines 20, 64, 168, 257 — ~180 test lines) is an entry.

Cold-start cost, not just dead text: `export const characterColorService = new CharacterColorService();` runs at module load on every isolate for a service nothing calls.

## Why It Exists
The v1 swatch OG card annotated the target with its character-creator sheet position ("Eye Colors row 2 col 5"). The 15E rewrite (v2.0.0) dropped that — "the card must not invent" — and the helpers were left behind. The `DEAD-024 adoption` comment (from the 2026-07 audit) shows the block was *tidied* rather than questioned.

## Removal Risk Assessment
| Factor | Assessment |
|---|---|
| **Confidence** | HIGH |
| **Blast Radius** | LOW — one file + its test file; `svg/index.ts` `export * from './dye-helpers'` re-exports them but nothing imports through it (DEAD-013) |
| **Reversibility** | EASY |
| **Hidden Consumers** | None found (no dynamic import; not a published package) |

## Recommendation
**REMOVE**

### Rationale
~260 of the file's 362 lines, an unused service instantiation on the hot path, and four now-unneeded package imports. What remains (`dyeService`, `dyeByStainId`, `deltaForAlgorithm`, `DyeMatch`, `findClosestDyesWithDistance`, `getDyeByItemId`) is the real helper set.

### If Removing
1. Delete lines 14, 16–17 (keep the `Dye` import), 23, 52–179, 233–362 of `dye-helpers.ts`; drop `CharacterColorService`, `RACE_SUBRACES`, `SubRace`, `Gender`, `Race` imports.
2. Delete the `ALL_SUBRACES`, `characterColorService`, `findCharacterColorByHex`, `getCharacterColorFromSheet` describes in `dye-helpers.test.ts`.
3. Do DEAD-003 in the same commit (removes the type imports that referenced this world).
4. `pnpm type-check && pnpm test`.
