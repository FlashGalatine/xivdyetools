#!/usr/bin/env python3
"""locale-diff.py <locale-dir> [--source en] [--locale xx] [--allow word,word]

Compares every <code>.json in <locale-dir> against the source locale and prints:
  DUPLICATE KEYS   duplicate keys inside any object (JSON keeps the LAST value — translations silently lost)
  MISSING          key paths present in source, absent in target
  EXTRA            key paths present in target, absent in source
  PLACEHOLDER      {placeholder} sets that differ from the source value
  SAME-AS-SOURCE   target value identical to source (untranslated candidates; hex/numbers/short identifiers/allowlist skipped)
Exit code 1 if duplicates or missing keys exist. Run with PYTHONIOENCODING=utf-8.
"""
import json, os, re, sys

args = sys.argv[1:]
if not args or args[0].startswith("-"):
    sys.exit(__doc__)
d = args[0]
src = "en"; only = None; allow = set()
for i, a in enumerate(args):
    if a == "--source": src = args[i + 1]
    if a == "--locale": only = args[i + 1]
    if a == "--allow": allow |= set(args[i + 1].split(","))
ALLOW = {"XIV Dye Tools", "FFXIV", "Universalis", "Discord", "OK", "Gil", "Lalafell", "Eorzea"} | allow
PH = re.compile(r"\{[A-Za-z0-9_]+\}")

def load(path):
    dups = []
    def hook(pairs):
        seen = {}
        for k, v in pairs:
            if k in seen:
                dups.append(k)
            seen[k] = v
        return seen
    with open(path, encoding="utf-8") as f:
        data = json.load(f, object_pairs_hook=hook)
    return data, dups

def flat(obj, prefix=""):
    out = {}
    if isinstance(obj, dict):
        for k, v in obj.items():
            out.update(flat(v, f"{prefix}{k}."))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            out.update(flat(v, f"{prefix}{i}."))
    else:
        out[prefix[:-1]] = obj
    return out

def trivial(v):
    if not isinstance(v, str): return True
    s = v.strip()
    return (s in ALLOW or len(s) <= 2 or re.fullmatch(r"[#0-9A-Fa-f%.,:/ +\-×·Δ°]+", s) is not None
            or re.fullmatch(r"[A-Z0-9_\-· ]+", s) is not None)   # codes/tags like "R·C", "RGB DIST"

src_data, src_dups = load(os.path.join(d, f"{src}.json"))
S = flat(src_data)
print(f"source {src}: {len(S)} keys" + (f"  DUPLICATE KEYS: {src_dups}" if src_dups else ""))
bad = bool(src_dups)
for fn in sorted(os.listdir(d)):
    code = fn[:-5]
    if not fn.endswith(".json") or code == src or (only and code != only):
        continue
    data, dups = load(os.path.join(d, fn))
    T = flat(data)
    missing = sorted(k for k in S if k not in T)
    extra = sorted(k for k in T if k not in S)
    ph = [k for k in S if k in T and isinstance(S[k], str) and isinstance(T[k], str)
          and set(PH.findall(S[k])) != set(PH.findall(T[k]))]
    same = [k for k in S if k in T and S[k] == T[k] and not trivial(S[k])]
    print(f"\n== {code}: {len(T)} keys | dup={len(dups)} missing={len(missing)} extra={len(extra)} placeholder={len(ph)} same-as-{src}={len(same)}")
    for label, items in (("DUPLICATE KEYS", dups), ("MISSING", missing), ("EXTRA", extra), ("PLACEHOLDER", ph)):
        for k in items[:60]:
            print(f"  {label:15} {k}")
        if len(items) > 60: print(f"  {label:15} … +{len(items)-60} more")
    for k in same[:40]:
        print(f"  SAME-AS-SOURCE  {k} = {S[k]!r}")
    if len(same) > 40: print(f"  SAME-AS-SOURCE  … +{len(same)-40} more")
    bad = bad or bool(dups) or bool(missing)
sys.exit(1 if bad else 0)
