#!/usr/bin/env python3
"""bindings.py — every binding / var name declared in each app's wrangler.toml vs. references to
that name in the app's tracked source. A binding with 0 source references is either dead config or
an ops-only var; verify each by hand before filing."""
import os, re, subprocess

root = subprocess.check_output(["git", "rev-parse", "--show-toplevel"], text=True).strip()
tracked = subprocess.check_output(["git", "ls-files"], cwd=root, text=True).splitlines()
NAME = re.compile(r'^\s*(?:binding|name)\s*=\s*"([A-Z][A-Z0-9_]*)"', re.M)
VAR = re.compile(r'^([A-Z][A-Z0-9_]{2,})\s*=\s*', re.M)

for toml in [f for f in tracked if re.fullmatch(r"apps/[^/]+/wrangler\.toml", f)]:
    unit = os.path.dirname(toml)
    cfg = open(os.path.join(root, toml), encoding="utf-8").read()
    names = set(NAME.findall(cfg)) | set(VAR.findall(cfg))
    src = [f for f in tracked if f.startswith(unit + "/") and re.search(r"\.(ts|tsx|js|mjs|py)$", f)]
    texts = {}
    for f in src:
        try:
            texts[f] = open(os.path.join(root, f), encoding="utf-8", errors="ignore").read()
        except OSError:
            pass
    dead = []
    for n in sorted(names):
        hits = [f for f, t in texts.items() if re.search(r"\b" + re.escape(n) + r"\b", t)]
        prod = [f for f in hits if not re.search(r"\.(test|spec)\.[tj]sx?$|__tests__/|/tests?/", f)]
        if not prod:
            dead.append((n, len(hits)))
    print(f"\n=== {unit}  ({len(names)} declared names)")
    for n, h in dead:
        print(f"   NO PROD REF: {n:32} (test refs: {h})")
