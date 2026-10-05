#!/usr/bin/env python3
"""For every key whose EN value contains a needle (case-insensitive), print the value in each
non-EN locale. Usage: en-needle-values.py <web|bot> <needle> [locale ...]"""
import json, os, sys
sys.stdout.reconfigure(encoding="utf-8")
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", ".."))
SETS = {"web": "apps/web-app/src/locales", "bot": "packages/bot-logic/src/i18n/locales"}
rel, needle = SETS[sys.argv[1]], sys.argv[2].lower()
locs = sys.argv[3:] or ["ja", "de", "fr", "ko", "zh"]

def flat(d, p=""):
    for k, v in d.items():
        if isinstance(v, dict):
            yield from flat(v, p + k + ".")
        elif isinstance(v, str):
            yield p + k, v

D = {lc: dict(flat(json.load(open(os.path.join(REPO, rel, f"{lc}.json"), encoding="utf-8")))) for lc in ["en"] + locs}
for k, v in D["en"].items():
    if needle in v.lower():
        print(f"## {k}  en={v[:70]!r}")
        for lc in locs:
            print(f"   {lc}: {D[lc].get(k, '')[:90]!r}")
