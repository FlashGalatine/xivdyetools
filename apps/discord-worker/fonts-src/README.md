# Source fonts (NOT bundled)

OPT-009 (2026-07-18 audit): the full-size CJK source fonts (~21 MiB) were moved
out of `src/` so wrangler's `[[rules]] **/*.ttf` glob can only ever capture
the ~700 KiB subsets in `src/fonts/`. An accidental import of a full font
from inside `src/` would have added 10+ MiB to the bundle and blown the
10 MiB Worker limit at deploy time.

Re-subsetting (when dyes are added) reads from here and writes the subsets to
`src/fonts/` — see the CJK font subsetting notes in the project docs.
