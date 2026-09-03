#!/usr/bin/env python3
"""Which non-ASCII glyphs does packages/svg draw, and can the bundled faces draw them?

A glyph the card emits that no bundled face covers is tofu on every card, in every locale.
Checks each worker's full face set (a card's stack lists Latin + all three CJK subsets).
"""
import os, re, glob
from fontTools.ttLib import TTFont

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", ".."))

# collect non-ASCII literals from packages/svg source (non-test)
svg_src = [p for p in glob.glob(os.path.join(REPO, "packages", "svg", "src", "**", "*.ts"), recursive=True)
           if not p.endswith(".test.ts")]
found = {}
for p in svg_src:
    txt = open(p, encoding="utf-8").read()
    for i, line in enumerate(txt.splitlines(), 1):
        for ch in line:
            cp = ord(ch)
            if cp > 0x7F:
                found.setdefault(cp, []).append(f"{os.path.relpath(p, REPO).replace(os.sep,'/')}:{i}")

faces = {}
for worker in ("discord-worker", "og-worker"):
    fdir = os.path.join(REPO, "apps", worker, "src", "fonts")
    for path in sorted(glob.glob(os.path.join(fdir, "*.ttf")) + glob.glob(os.path.join(fdir, "*.otf"))):
        f = TTFont(path, lazy=True)
        faces[f"{worker}/{os.path.basename(path)}"] = set(f.getBestCmap().keys())
        f.close()

latin = {k: v for k, v in faces.items() if "Noto" not in k}
allf = faces

print(f"non-ASCII codepoints drawn by packages/svg: {len(found)}\n")
for cp in sorted(found):
    carriers_all = [k for k, v in allf.items() if cp in v]
    carriers_latin = [k for k, v in latin.items() if cp in v]
    if not carriers_all:
        status = "TOFU  (no bundled face)"
    elif not carriers_latin:
        status = "CJK-ONLY (falls to a Noto face)"
    else:
        status = "ok"
    if status != "ok":
        sites = sorted(set(found[cp]))[:3]
        print(f"  {status:32s} U+{cp:04X} {chr(cp)}   {', '.join(sites)}")
print("\n(ok glyphs omitted)")
