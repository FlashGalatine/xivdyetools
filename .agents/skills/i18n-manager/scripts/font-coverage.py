#!/usr/bin/env python3
"""font-coverage.py <font.ttf> <dir-or-file>... [--scripts cjk|hangul|kana|all]

Needed codepoints = every character in the given locale JSON dirs / TS string tables
(same extraction as script-inventory.py), filtered to the chosen script ranges.
Compares against the font's cmap (fontTools) and prints needed / covered / MISSING / STALE.
Exit 1 when glyphs are missing (text would render as tofu). Requires: pip install fonttools.
Compare two subsets with cmap-diff.py, never by md5 (fonttools rewrites head.modified).
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from script_inventory_lib import collect_codepoints  # noqa: E402

try:
    from fontTools.ttLib import TTFont
except ImportError:
    sys.exit("fontTools missing: python -m pip install --user fonttools brotli")

RANGES = {
    "cjk":    [(0x3000, 0x303F), (0x3040, 0x309F), (0x30A0, 0x30FF), (0x3400, 0x4DBF), (0x4E00, 0x9FFF), (0xF900, 0xFAFF), (0xFF00, 0xFFEF)],
    "hangul": [(0x1100, 0x11FF), (0xAC00, 0xD7AF), (0x3000, 0x303F), (0xFF00, 0xFFEF)],
    "kana":   [(0x3040, 0x309F), (0x30A0, 0x30FF), (0x3000, 0x303F), (0xFF00, 0xFFEF)],
    "all":    [(0x0000, 0x10FFFF)],
}
args = sys.argv[1:]
if len(args) < 2:
    sys.exit(__doc__)
scripts = "all"
if "--scripts" in args:
    i = args.index("--scripts"); scripts = args[i + 1]; del args[i:i + 2]
font_path, sources = args[0], args[1:]
ranges = RANGES[scripts]
inr = lambda cp: any(lo <= cp <= hi for lo, hi in ranges)

needed = {cp for cp in collect_codepoints(sources) if inr(cp)}
font = TTFont(font_path)
covered = set(font.getBestCmap().keys())
font.close()
missing = sorted(needed - covered)
stale = sorted({cp for cp in covered if inr(cp)} - needed)
print(f"{font_path}: needed={len(needed)} covered={len(needed & covered)} missing={len(missing)} stale={len(stale)} (scripts={scripts})")
for cp in missing[:80]:
    print(f"  MISSING U+{cp:04X} {chr(cp)}")
if len(missing) > 80: print(f"  … +{len(missing)-80} more missing")
if stale:
    print(f"  STALE: {len(stale)} glyphs in font but needed by nothing — re-run scripts/subset-cjk-fonts.py to shrink")
sys.exit(1 if missing else 0)
