#!/usr/bin/env python3
"""cmap-diff.py <a.ttf> <b.ttf>

Compares two fonts by their cmap (codepoint → glyph) tables and reports codepoints only in A,
only in B, and the shared count. Use this — never md5 — to decide whether a regenerated subset
changed coverage: fonttools rewrites head.modified on every run, so bytes always differ.
Exit 0 when coverage is identical, 1 otherwise. Requires fontTools.
"""
import sys
try:
    from fontTools.ttLib import TTFont
except ImportError:
    sys.exit("fontTools missing: python -m pip install --user fonttools brotli")
if len(sys.argv) != 3:
    sys.exit(__doc__)
def cmap(p):
    f = TTFont(p); c = set(f.getBestCmap().keys()); f.close(); return c
a, b = cmap(sys.argv[1]), cmap(sys.argv[2])
only_a, only_b = sorted(a - b), sorted(b - a)
print(f"A={len(a)} B={len(b)} shared={len(a & b)} onlyA={len(only_a)} onlyB={len(only_b)}")
for label, items in (("only in A", only_a), ("only in B", only_b)):
    if items:
        print(f"  {label}: " + " ".join(f"U+{cp:04X}({chr(cp)})" for cp in items[:40]) + (" …" if len(items) > 40 else ""))
sys.exit(0 if not only_a and not only_b else 1)
