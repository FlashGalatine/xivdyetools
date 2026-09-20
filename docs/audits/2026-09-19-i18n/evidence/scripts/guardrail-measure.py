#!/usr/bin/env python3
"""Prototype measurement for the two guardrails the 2026-09-19 audit recommended and did not build.

A. same-English consistency — keys that share one EN value should share one value in each target
   locale (recommendation 2). Reports every group that diverges, clustered by value.
B. identical-to-EN — target values literally equal to the EN value, for the set that has no
   allow-list yet (bot-logic; recommendation 3).

The point of measuring first: the violation count decides whether each check can be a hard gate
with a small curated allow-list, or only a warning. Writes nothing but stdout.
Run from anywhere; the repo root is derived from this file."""
import collections
import json
import os
import sys

sys.stdout.reconfigure(encoding="utf-8")
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", ".."))
LOC = ["en", "ja", "de", "fr", "ko", "zh"]
SETS = {
    "web-app": os.path.join("apps", "web-app", "src", "locales"),
    "bot-logic": os.path.join("packages", "bot-logic", "src", "i18n", "locales"),
}


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


summary, lines = [], []
for name, rel in SETS.items():
    data = load(rel)
    by_en = collections.defaultdict(list)
    for k, v in data["en"].items():
        if isinstance(v, str) and v.strip():
            by_en[v].append(k)
    groups = {v: ks for v, ks in by_en.items() if len(ks) >= 2}
    divergent = {}
    for en_val, keys in groups.items():
        per = {}
        for lc in LOC[1:]:
            vals = collections.OrderedDict((k, data[lc].get(k)) for k in keys)
            if len(set(vals.values())) > 1:
                per[lc] = vals
        if per:
            divergent[en_val] = per
    cells = sum(len(per) for per in divergent.values())
    summary.append(
        f"[A] {name}: EN keys={len(data['en'])}  same-EN groups={len(groups)}  "
        f"divergent groups={len(divergent)}  divergent (group x locale) cells={cells}"
    )
    lines.append(f"===== A. same-English consistency: {name} =====")
    for en_val in sorted(divergent, key=lambda s: (len(s), s)):
        per = divergent[en_val]
        lines.append(f"\nEN = {en_val!r}  ({len(groups[en_val])} keys)  diverges in: {', '.join(per)}")
        for lc, vals in per.items():
            clusters = collections.defaultdict(list)
            for k, v in vals.items():
                clusters[v].append(k)
            for v, ks in clusters.items():
                lines.append(f"    {lc}: {v!r}  <- {', '.join(ks)}")
    lines.append("")

data = load(SETS["bot-logic"])
lines.append("===== B. bot-logic identical-to-EN =====")
union = collections.defaultdict(list)
for lc in LOC[1:]:
    same = [k for k, v in data["en"].items() if isinstance(v, str) and v != "" and data[lc].get(k) == v]
    summary.append(f"[B] bot-logic {lc}: identical-to-en = {len(same)}")
    for k in same:
        union[k].append(lc)
summary.append(
    f"[B] bot-logic union of keys identical in >=1 locale = {len(union)}; "
    f"identical in all 5 = {sum(1 for v in union.values() if len(v) == 5)}"
)
for k in sorted(union, key=lambda k: (-len(union[k]), k)):
    lines.append(f"  [{','.join(union[k]):<14}] {k} = {data['en'][k]!r}")

print("\n".join(summary))
print()
print("\n".join(lines))
