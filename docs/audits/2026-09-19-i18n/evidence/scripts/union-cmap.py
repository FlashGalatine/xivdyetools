#!/usr/bin/env python3
"""Union-cmap check: are the punctuation codepoints the per-font sweep called MISSING
covered by ANY face the worker bundles? Prints, per worker, which face carries each."""
import os, sys, glob
sys.path.insert(0, "/c/dev/XIVProjects/.claude/skills/i18n-manager/scripts".replace("/c/", "C:/"))
from fontTools.ttLib import TTFont

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", ".."))

SUSPECT = [0x3001, 0x3002, 0x300C, 0x300D, 0x301C, 0xFF01, 0xFF06, 0xFF08,
           0xFF09, 0xFF0C, 0xFF0F, 0xFF1A, 0xFF1B, 0xFF1D, 0xFF1F]

for worker in ("discord-worker", "og-worker"):
    fdir = os.path.join(REPO, "apps", worker, "src", "fonts")
    faces = {}
    for path in sorted(glob.glob(os.path.join(fdir, "*.ttf")) + glob.glob(os.path.join(fdir, "*.otf"))):
        f = TTFont(path, lazy=True)
        faces[os.path.basename(path)] = set(f.getBestCmap().keys())
        f.close()
    print(f"===== {worker} ({len(faces)} faces) =====")
    for cp in SUSPECT:
        carriers = [n for n, cm in faces.items() if cp in cm]
        mark = "OK " if carriers else "TOFU"
        print(f"  {mark} U+{cp:04X} {chr(cp)}  <- {', '.join(carriers) if carriers else 'NO FACE'}")
    print()
