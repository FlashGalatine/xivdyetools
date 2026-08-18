# [DEAD-008]: `fonts-src/NotoSansSC-Regular.ttf` — 10.6 MB tracked font the subset script refuses to use

## Category
Orphaned File (asset)

## Location
- `apps/discord-worker/fonts-src/NotoSansSC-Regular.ttf` (10,559,284 bytes, git-tracked)
- Sibling `NotoSansKR-Variable.ttf` (10.4 MB) is LIVE — it is a `subset-cjk-fonts.py` input

## Evidence
`apps/discord-worker/scripts/subset-cjk-fonts.py:71-75` comment: the SC static face is "still tracked from the pre-5.0 era" and must NOT be used — subsets are cut from the variable face; `SC_INPUT_CANDIDATES` deliberately excludes it. `git grep NotoSansSC-Regular` → only that comment and `fonts-src/README.md`. The shipped subset `src/fonts/NotoSansSC-Subset.ttf` is what the worker bundles.

## Why It Exists
Pre-5.0 source font kept after the switch to variable-face subsetting.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH |
| **Blast Radius** | NONE (not bundled, not read by any script) |
| **Reversibility** | EASY — stays in git history; the shipped subset is unaffected |
| **Hidden Consumers** | None; the subset script's candidate list excludes it by design |

## Recommendation
**REMOVE**

### Rationale
Every clone carries 10.6 MB for a file the tooling explicitly ignores. Update `fonts-src/README.md` and the script comment when deleting.
