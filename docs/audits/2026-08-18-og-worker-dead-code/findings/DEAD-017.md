# [DEAD-017]: Item-ID-era and 1200×630-era terminology survives in source comments

## Category
Stale Code (comments contradict the 5.0 contract)

## Location
| File:line | Text | Reality |
|---|---|---|
| `src/index.ts:8` | `?dye=5771&harmony=tetradic` | 5771 is an item ID; CLAUDE.md warns this exact value "renders a perfectly valid-looking card that tests nothing" |
| `src/index.ts:537` | "dyes is comma-separated itemIDs (e.g., "5771,5772,5773")" | stainIDs |
| `src/types.ts:81,88,89,95,96,97,132,136` | `// itemID` on every dye field | stainIDs (the module header of dye-helpers says so) |
| `src/services/svg/dye-helpers.ts:26` "O(1) itemID lookup", `:226` "Get a single dye by its itemID" | function is stainID-keyed (its own line 229 admits it) |
| `src/services/renderer.ts:5,112` | "1200x630" | 400-grid ×3 → 1200×1050 / 1200×630 |
| `src/services/svg/base.ts:11-13` | "the OG THEME (indigo accent…) and the 1200×630 OG_DIMENSIONS" | retired (DEAD-004) |

## Evidence
`grep -rn "1200x630\|itemID\|5771"` over non-test src (`evidence` transcript). All contradicted by CLAUDE.md, `docs/projects/og-worker/overview.md` and the code paths themselves. `getDyeByItemId` is a *name* the 5.0 port kept "for call-site stability" — with 8 call sites in 8 files, a rename is a one-commit mechanical change; the comment debt is larger than the rename.

## Recommendation
**REMOVE / UPDATE** the comments (zero runtime change). Optional: rename `getDyeByItemId` → `getDyeByStainId` (already exists on `DyeService`; presets.ts uses `dyeService.getByStainId` directly — the local map is faster, keep it, but name it honestly).
