#!/usr/bin/env python3
"""core-locale-sections.py — which top-level sections of packages/core's locale files are read
by any tracked source file. Core exposes them through LocalizationService getters and through
string keys, so look for both the section name in quotes and the obvious getter names."""
import json, os, re, subprocess

root = subprocess.check_output(["git", "rev-parse", "--show-toplevel"], text=True).strip()
tracked = [f for f in subprocess.check_output(["git", "ls-files"], cwd=root, text=True).splitlines()
           if re.search(r"\.(ts|tsx|js|mjs)$", f) and "/coverage/" not in f
           and "e2e-coverage" not in f and not f.startswith("docs/audits/")]
texts = {}
for f in tracked:
    try:
        texts[f] = open(os.path.join(root, f), encoding="utf-8", errors="ignore").read()
    except OSError:
        pass
en = json.load(open(os.path.join(root, "packages/core/src/data/locales/en.json"), encoding="utf-8"))
for section in en:
    pat = re.compile(r"['\"`]" + re.escape(section) + r"['\"`.]|\." + re.escape(section) + r"\b")
    prod, test = [], []
    for f, t in texts.items():
        if not pat.search(t):
            continue
        (test if re.search(r"\.(test|spec)\.[tj]sx?$|__tests__/|/tests?/|/e2e/", f) else prod).append(f)
    n = len(en[section]) if isinstance(en[section], dict) else 1
    print(f"{section:16} keys={n:4} prod={len(prod):3} test={len(test):3}  {prod[:4]}")
