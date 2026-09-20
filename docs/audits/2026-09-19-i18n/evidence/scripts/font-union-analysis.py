#!/usr/bin/env python3
"""Per-worker font analysis done the way the runtime actually resolves glyphs:
needed codepoints (from that worker's own string sources) vs the UNION of the faces it
bundles. Also reports per-face glyph counts and how many glyphs in each CJK subset are
not needed by any source (true surplus / re-subset opportunity)."""
import os, sys, glob, json, re

SKD = "C:/dev/XIVProjects/.claude/skills/i18n-manager/scripts"
sys.path.insert(0, SKD)
from script_inventory_lib import collect_codepoints  # noqa: E402
from fontTools.ttLib import TTFont  # noqa: E402

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", ".."))
P = lambda *a: os.path.join(REPO, *a)

WORKERS = {
    "discord-worker": [
        P("packages", "core", "src", "data", "locales"),
        P("packages", "bot-logic", "src", "i18n", "locales"),
    ],
    "og-worker": [
        P("packages", "core", "src", "data", "locales"),
        P("apps", "og-worker", "src", "services", "og-strings.ts"),
    ],
}

CJK_ANY = [(0x1100, 0x11FF), (0x3000, 0x303F), (0x3040, 0x309F), (0x30A0, 0x30FF),
           (0x3400, 0x4DBF), (0x4E00, 0x9FFF), (0xAC00, 0xD7AF), (0xF900, 0xFAFF),
           (0xFF00, 0xFFEF)]
in_cjk = lambda cp: any(a <= cp <= b for a, b in CJK_ANY)

for worker, sources in WORKERS.items():
    needed = collect_codepoints(sources)
    fdir = P("apps", worker, "src", "fonts")
    faces = {}
    for path in sorted(glob.glob(os.path.join(fdir, "*.ttf")) + glob.glob(os.path.join(fdir, "*.otf"))):
        f = TTFont(path, lazy=True)
        faces[os.path.basename(path)] = set(f.getBestCmap().keys())
        f.close()
    union = set().union(*faces.values()) if faces else set()

    missing = sorted(cp for cp in needed if cp not in union)
    print(f"===== {worker} =====")
    print(f"  needed codepoints (all scripts): {len(needed)}")
    print(f"  union cmap of {len(faces)} bundled faces: {len(union)}")
    print(f"  NEEDED BUT IN NO FACE (real tofu): {len(missing)}")
    for cp in missing[:40]:
        try:
            ch = chr(cp)
        except ValueError:
            ch = "?"
        print(f"      U+{cp:04X} {ch}")
    print("  per-face CJK-range glyphs vs. how many of those are actually needed:")
    for name, cm in faces.items():
        cjk = {cp for cp in cm if in_cjk(cp)}
        if not cjk:
            continue
        used = cjk & needed
        size = os.path.getsize(os.path.join(fdir, name))
        print(f"      {name:28s} cjk_glyphs={len(cjk):5d} needed_by_sources={len(used):5d} "
              f"surplus={len(cjk) - len(used):5d}  {size // 1024} KiB")
    print()
