#!/usr/bin/env python3
"""Cross-surface vocabulary drift.

core is the authority for game vocabulary (dye/category/harmony/vision/race/clan/
currency/acquisition/label names). web-app and bot-logic each keep their own
hand-edited locale JSON. Where one of them re-states a concept core already owns
AND the two disagree in some locale, users see two different words for one thing.

Method: pair a web-app / bot-logic key with a core key when their **English**
values are equal (case-insensitive, punctuation-trimmed). Then compare the five
target locales. Report only pairs that actually diverge somewhere.
"""
import json, os, re, sys

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", ".."))
P = lambda *a: os.path.join(REPO, *a)
LOCALES = ["en", "de", "fr", "ja", "ko", "zh"]

SETS = {
    "core":      P("packages", "core", "src", "data", "locales"),
    "bot-logic": P("packages", "bot-logic", "src", "i18n", "locales"),
    "web-app":   P("apps", "web-app", "src", "locales"),
}
# core namespaces that are genuine shared game vocabulary
CORE_NS = ("labels.", "categories.", "harmonyTypes.", "visionTypes.", "visions.",
           "races.", "clans.", "currencies.", "acquisitions.", "tools.")

def flat(d, pref=""):
    out = {}
    for k, v in d.items():
        p = f"{pref}.{k}" if pref else k
        if isinstance(v, dict):
            out.update(flat(v, p))
        elif isinstance(v, str):
            out[p] = v
    return out

def load(setname):
    out = {}
    for loc in LOCALES:
        with open(os.path.join(SETS[setname], f"{loc}.json"), encoding="utf-8") as f:
            out[loc] = flat(json.load(f))
    return out

norm = lambda s: re.sub(r"[\s:：.。()（）]+", "", s).strip().lower()

core = load("core")
core_by_en = {}
for k, v in core["en"].items():
    if k.startswith(CORE_NS) and v.strip():
        core_by_en.setdefault(norm(v), []).append(k)

total_pairs = 0
divergent = []
for setname in ("bot-logic", "web-app"):
    other = load(setname)
    for k, v in other["en"].items():
        if not v.strip():
            continue
        matches = core_by_en.get(norm(v))
        if not matches:
            continue
        core_key = matches[0]
        total_pairs += 1
        diffs = []
        for loc in LOCALES[1:]:
            a = other[loc].get(k, "")
            b = core[loc].get(core_key, "")
            if norm(a) != norm(b):
                diffs.append((loc, a, b))
        if diffs:
            divergent.append((setname, k, core_key, v, diffs))

print(f"paired keys (same English value as a core vocabulary key): {total_pairs}")
print(f"pairs that DIVERGE in >=1 locale: {len(divergent)}\n")
for setname, k, core_key, en, diffs in sorted(divergent):
    print(f"[{setname}] {k}   vs core {core_key}   (en = {en!r})")
    for loc, a, b in diffs:
        print(f"    {loc}: {setname}={a!r}   core={b!r}")
    print()
