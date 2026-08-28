# [DEAD-024]: types `RACE_SUBRACES` / `SUBRACE_TO_RACE` / `COLOR_GRID_DIMENSIONS` have zero importers — while four apps re-roll the race→clan tables

## Category
Unused Export (DEAD) + Duplicate — adopt-or-delete

## Location
- `packages/types/src/character/index.ts` — `RACE_SUBRACES`, `SUBRACE_TO_RACE`, `COLOR_GRID_DIMENSIONS` (+ `CharacterColorCategory`, used only by the last) — ~85 of the file's 177 lines; README + CLAUDE.md document them
- Hand-rolled equivalents: `apps/discord-worker/src/types/preferences.ts:152` (`CLANS_BY_RACE`, display-name variant), `apps/og-worker/src/services/svg/dye-helpers.ts:81` (`ALL_SUBRACES`), `apps/web-app/src/components/swatch-tool.ts:121` and `v4/config-sidebar.ts:98` (`raceKey` + `subraces` lists)

## Evidence
`git grep -nw RACE_SUBRACES|SUBRACE_TO_RACE|COLOR_GRID_DIMENSIONS` outside `packages/types` → 0.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH (unused); the four local tables differ in shape (display names vs keys), so adoption is a small refactor, not a swap |
| **Blast Radius** | Delete: package only. Adopt: 4 app files |
| **Reversibility** | EASY |

## Recommendation
**REFACTOR FIRST** — same shape as DEAD-019: either make the four apps derive their lists from the shared tables (single source of truth for a game-data fact that changes with patches) or delete the constants. Adopt is recommended.
