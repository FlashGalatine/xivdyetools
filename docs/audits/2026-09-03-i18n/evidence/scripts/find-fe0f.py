#!/usr/bin/env python3
"""Locate every U+FE0F (and any emoji-range codepoint) in the string sources the
discord-worker font subsetter reads, so we can tell whether it can reach a drawn card."""
import os, json, glob

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", ".."))
P = lambda *a: os.path.join(REPO, *a)

TARGETS = [
    P("packages", "core", "src", "data", "locales"),
    P("packages", "bot-logic", "src", "i18n", "locales"),
]

def walk(obj, path=""):
    if isinstance(obj, str):
        yield path, obj
    elif isinstance(obj, dict):
        for k, v in obj.items():
            yield from walk(v, f"{path}.{k}" if path else k)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from walk(v, f"{path}[{i}]")

def interesting(cp):
    return cp == 0xFE0F or 0x1F000 <= cp <= 0x1FAFF or 0x2600 <= cp <= 0x27BF or 0x2B00 <= cp <= 0x2BFF

hits = 0
for t in TARGETS:
    for fp in sorted(glob.glob(os.path.join(t, "*.json"))):
        data = json.load(open(fp, encoding="utf-8"))
        for key, val in walk(data):
            found = sorted({ord(c) for c in val if interesting(ord(c))})
            if found:
                hits += 1
                rel = os.path.relpath(fp, REPO).replace("\\", "/")
                cps = " ".join(f"U+{c:04X}" for c in found)
                print(f"{rel}  {key}\n    {cps}\n    {val[:120]!r}")
print(f"\nTOTAL string values carrying emoji/VS16: {hits}")
