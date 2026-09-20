#!/usr/bin/env python3
"""How does each hand-edited locale set name the Market Board? Tallies the term used in every
key whose EN value mentions it. Location-relative; run from anywhere."""
import json, os, sys, collections
sys.stdout.reconfigure(encoding="utf-8")
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", ".."))
L = ["en", "ja", "de", "fr", "ko", "zh"]
TERMS = {
    "ja": ["マーケットボード", "マーケット"],
    "de": ["Marktbrett", "Markttafel", "Marktplatz", "Markt"],
    "fr": ["ableau des ventes", "ableau des marchés", "marché"],
    "ko": ["장터 게시판", "시장 게시판", "마켓보드", "마켓 보드", "장터", "시장"],
    "zh": ["市场布告板", "市场版", "市场板", "市场"],
}

def flat(d, p=""):
    for k, v in d.items():
        if isinstance(v, dict):
            yield from flat(v, p + k + ".")
        elif isinstance(v, str):
            yield p + k, v

for name, rel in [("web-app", "apps/web-app/src/locales"), ("bot-logic", "packages/bot-logic/src/i18n/locales")]:
    D = {lc: dict(flat(json.load(open(os.path.join(REPO, rel, f"{lc}.json"), encoding="utf-8")))) for lc in L}
    keys = [k for k, v in D["en"].items() if "market board" in v.lower() or "marketboard" in v.lower()]
    print(f"== {name}: {len(keys)} keys whose EN mentions Market Board")
    for lc in L[1:]:
        c = collections.defaultdict(list)
        for k in keys:
            v = D[lc][k]
            hit = next((t for t in TERMS[lc] if t in v), None)
            c[hit or "OTHER"].append(k if hit else f"{k} = {v[:50]!r}")
        for term, ks in c.items():
            print(f"   {lc}: {term!r} x{len(ks)}  e.g. {ks[:3]}")
    print()
