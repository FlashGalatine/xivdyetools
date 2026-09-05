# Source fonts (NOT bundled)

OPT-009 (2026-07-18 audit): the full-size CJK source fonts were moved out of
`src/` so wrangler's `[[rules]] **/*.ttf` glob can only ever capture the
~940 KiB of CJK subsets in `src/fonts/` (JP 321 KiB + SC 482 KiB + KR 140 KiB).
One source face is left here after DEAD-008 below, `NotoSansKR-Variable.ttf` at
~10 MiB; an accidental import of it from inside `src/` would have added 10 MiB
to the bundle and blown the 10 MiB Worker limit at deploy time.

Re-subsetting (when dyes are added) reads from here and writes the subsets to
`src/fonts/` — see the CJK font subsetting notes in the project docs.

DEAD-008 (2026-08-18 dead-code audit): `NotoSansSC-Regular.ttf`, a static face
left over from the pre-5.0 era, was removed — `subset-cjk-fonts.py` cuts the SC
subset from the variable face only and never read this file. Only
`NotoSansKR-Variable.ttf` remains here as a live subset input.
