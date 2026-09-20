#!/usr/bin/env python3
"""script-inventory.py <dir-or-file>...

Per file (JSON locale files in a dir, or a .ts/.js string table), counts distinct codepoints by
Unicode script block (CJK ideographs, Hiragana, Katakana, Hangul, CJK punctuation/fullwidth,
Latin-Extended, Latin-1, symbols, Other) and lists any "Other" codepoints — the ones most likely
to be missing from a subset font. Strings come from JSON values or quoted TS/JS literals.
Run with PYTHONIOENCODING=utf-8.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from script_inventory_lib import expand, inventory  # noqa: E402

paths = expand(sys.argv[1:])
if not paths:
    sys.exit(__doc__)
for p in paths:
    by = inventory(p)
    total = sum(len(v) for v in by.values())
    parts = ", ".join(f"{k}={len(v)}" for k, v in sorted(by.items(), key=lambda kv: -len(kv[1])) if k != "Basic Latin")
    print(f"{p}: {total} codepoints | {parts}")
    other = sorted(by.get("Other", []))
    if other:
        print("   Other: " + " ".join(f"U+{cp:04X}({chr(cp)})" for cp in other[:30]) + (" …" if len(other) > 30 else ""))
