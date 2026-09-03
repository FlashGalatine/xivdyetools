#!/usr/bin/env python3
"""Check core's generated locale values against docs/reference/ffxiv-terminology.md.

The dictionary is the authority for game nouns. core's locale JSON is generated from
dyenames.csv + localize.yaml, so any mismatch is a defect in one of those two files
(or in the dictionary). Reports every row of every EN|JA|DE|FR|KO|ZH table whose EN
value maps to a core key, when a locale value differs.
"""
import json, os, re, sys

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", ".."))
P = lambda *a: os.path.join(REPO, *a)
LOCALES = ["en", "ja", "de", "fr", "ko", "zh"]

core = {}
for loc in LOCALES:
    with open(P("packages", "core", "src", "data", "locales", f"{loc}.json"), encoding="utf-8") as f:
        core[loc] = json.load(f)

# namespaces in core that hold game nouns, searched in this order
NS = ["categories", "acquisitions", "currencies", "races", "clans", "labels", "harmonyTypes"]

def core_lookup(en_value):
    """Find (namespace, key) in core whose EN value equals en_value."""
    for ns in NS:
        for k, v in core["en"].get(ns, {}).items():
            if isinstance(v, str) and v.strip().lower() == en_value.strip().lower():
                return ns, k
    return None, None

text = open(P("docs", "reference", "ffxiv-terminology.md"), encoding="utf-8").read()

rows, mismatches, unmatched = 0, [], 0
for line in text.splitlines():
    if not line.startswith("|"):
        continue
    cells = [c.strip() for c in line.strip().strip("|").split("|")]
    if len(cells) < 6 or set("".join(cells)) <= set("-: "):
        continue
    # tolerate a leading "Key" or "Sample ID" column
    if len(cells) == 7:
        cells = cells[1:]
    if len(cells) != 6:
        continue
    en, ja, de, fr, ko, zh = cells
    if en.upper() == "EN":
        continue
    ns, key = core_lookup(en)
    if ns is None:
        unmatched += 1
        continue
    rows += 1
    doc = {"en": en, "ja": ja, "de": de, "fr": fr, "ko": ko, "zh": zh}
    for loc in LOCALES:
        got = core[loc].get(ns, {}).get(key, "")
        if got.strip() != doc[loc].strip():
            mismatches.append((ns, key, loc, doc[loc], got))

print(f"dictionary rows matched to a core key: {rows}")
print(f"dictionary rows with no core counterpart (skipped): {unmatched}")
print(f"value mismatches: {len(mismatches)}\n")
for ns, key, loc, want, got in mismatches:
    print(f"  {ns}.{key}  [{loc}]  dictionary={want!r}  core={got!r}")
