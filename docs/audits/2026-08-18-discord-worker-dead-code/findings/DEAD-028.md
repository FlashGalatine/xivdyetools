# [DEAD-028]: core `src/data/character_colors.json` — a 798 KB orphan data file that is still being hand-maintained

## Category
Orphaned File (data)

## Location
- `packages/core/src/data/character_colors.json` (797,929 bytes, 1 minified line, git-tracked)
- Live replacement: `packages/core/src/data/character_colors/` (split `index.json`, `shared/*.json`, `race_specific/*.json`) — the only files `CharacterColorService` imports
- Stale doc: `packages/core/CLAUDE.md:52` lists it in the tree as "FFXIV skin/hair color tables"

## Evidence
`git grep -n character_colors.json` → only `CLAUDE.md:52` and CHANGELOG prose. Per-file importer map over `git ls-files packages/core/src/data` → every data file has an importer except this one. DEAD-049 (2026-02-28 audit) removed the deprecated `characterColorData` barrel export but left the file — and commit `be884d1` (Helion → Helions) later re-keyed its Hrothgar entries alongside the live split files, i.e. someone maintained a file nothing reads.

## Why It Exists
The pre-split monolith; the export was retired but the file was not.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH |
| **Blast Radius** | NONE — tsc only emits imported JSON, so it is not in `dist/` or any bundle; cost is repo weight + a maintenance trap |
| **Reversibility** | EASY (history) |
| **Hidden Consumers** | `scripts/` in core were checked — none read it |

## Recommendation
**REMOVE** (+ fix CLAUDE.md:52).
