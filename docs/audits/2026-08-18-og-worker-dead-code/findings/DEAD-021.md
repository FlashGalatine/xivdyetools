# [DEAD-021]: `scripts/subset-cjk-fonts.py` probes 13 source-font fallback paths that cannot exist

## Category
Dead Code Path (script)

## Location
- `scripts/subset-cjk-fonts.py:69` `DISCORD_FONTS_DIR = …/discord-worker/src/fonts`
- lines 71–75, 78–85, 93–100 — candidate lists for SC/KR/JP sources

## Evidence
Each candidate list tries, in order: `scripts/.font-sources/*-Variable.ttf` (the download target — **live**), then `src/fonts/NotoSans{SC,KR,JP}-{Regular,Variable,[wght]}.ttf` and the same names under `apps/discord-worker/src/fonts/`. `ls` of both directories: only `-Subset.ttf` files exist (discord-worker ships subsets too, and a subset is not a valid *source* for a subset). So 13 of 14 candidates are dead branches from before the `.font-sources/` download convention (the `.gitignore` in this app exists solely for that directory).

## Recommendation
**REMOVE** the non-`.font-sources` candidates and `DISCORD_FONTS_DIR` (~15 lines). Cosmetic — the script works — but a reader currently believes discord-worker's fonts are an input to this worker's, which is false.
