#!/usr/bin/env python3
"""deps.py — every declared dependency / devDependency per workspace vs. the tracked files that
mention it (imports, config files, scripts). Prints only the ones with no mention outside the
workspace's own package.json, i.e. the candidates. Verify each by hand: postcss/tailwind/wrangler
and other config-only consumers are known false positives."""
import json, os, re, subprocess

root = subprocess.check_output(["git", "rev-parse", "--show-toplevel"], text=True).strip()
tracked = [f for f in subprocess.check_output(["git", "ls-files"], cwd=root, text=True).splitlines()
           if "/coverage/" not in f and "e2e-coverage" not in f and not f.startswith("docs/audits/")]
text = {}
for f in tracked:
    if re.search(r"\.(ts|tsx|js|mjs|cjs|jsx|json|jsonc|toml|yml|yaml|vue|html|css|py)$", f):
        try:
            text[f] = open(os.path.join(root, f), encoding="utf-8", errors="ignore").read()
        except OSError:
            pass

for ws in sorted([d for d in tracked if re.fullmatch(r"(apps|packages)/[^/]+/package\.json", d)]):
    unit = os.path.dirname(ws)
    pkg = json.loads(text[ws])
    for kind in ("dependencies", "devDependencies"):
        for dep in pkg.get(kind, {}):
            hits = []
            for f, t in text.items():
                if f == ws:
                    continue
                if not f.startswith(unit + "/"):
                    continue
                if re.search(r"['\"]" + re.escape(dep) + r"(/[^'\"]*)?['\"]", t) or re.search(r"\b" + re.escape(dep) + r"\b", t):
                    hits.append(f)
            if not hits:
                print(f"{unit:26} {kind:15} {dep}")
