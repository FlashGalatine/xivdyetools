#!/usr/bin/env python3
"""Tool-name consistency: every web-app locale key whose EN value equals a tool's EN title,
compared per locale. Reports key groups whose non-EN values disagree with each other.
Run from anywhere; paths are relative to the repo root derived from this file."""
import json, os, sys, collections
sys.stdout.reconfigure(encoding="utf-8")
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", ".."))
LOC = ["en", "ja", "de", "fr", "ko", "zh"]

def flat(d, p=""):
    for k, v in d.items():
        kk = f"{p}.{k}" if p else k
        if isinstance(v, dict):
            yield from flat(v, kk)
        else:
            yield kk, v

def load(rel):
    out = {}
    for lc in LOC:
        with open(os.path.join(REPO, rel, f"{lc}.json"), encoding="utf-8") as f:
            out[lc] = dict(flat(json.load(f)))
    return out

def report(name, data, min_group=2, only_titles=None):
    by_en = collections.defaultdict(list)
    for k, v in data["en"].items():
        if isinstance(v, str) and 3 <= len(v) <= 40:
            by_en[v].append(k)
    n = 0
    for en_val, keys in sorted(by_en.items()):
        if len(keys) < min_group:
            continue
        if only_titles is not None and en_val not in only_titles:
            continue
        diverge = {}
        for lc in LOC[1:]:
            vals = {k: data[lc].get(k) for k in keys}
            if len(set(vals.values())) > 1:
                diverge[lc] = vals
        if diverge:
            n += 1
            print(f"[{name}] EN = {en_val!r}  ({len(keys)} keys)")
            for lc, vals in diverge.items():
                for k, v in vals.items():
                    print(f"    {lc}: {k} = {v!r}")
            print()
    print(f"== {name}: {n} same-EN key groups diverge in >=1 locale ==\n")

web = load("apps/web-app/src/locales")
titles = {v for k, v in web["en"].items() if k.startswith("tools.") and k.endswith(".title")}
print("TOOL TITLES (en):", sorted(titles), "\n")
report("web-app tool names", web, only_titles=titles)
if "--all" in sys.argv:
    report("web-app ALL same-EN groups", web)
    report("bot-logic ALL same-EN groups", load("packages/bot-logic/src/i18n/locales"))
