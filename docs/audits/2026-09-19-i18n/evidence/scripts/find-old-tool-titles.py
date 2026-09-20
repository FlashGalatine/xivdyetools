#!/usr/bin/env python3
"""Where do the OLD localized tool titles (Character Matcher / Color Harmony Explorer ×5) still
appear, outside the per-language files the language agents own? Walks the working tree (skipping
node_modules, dist, coverage, .git) so it needs no VCS call. Usage: find-old-tool-titles.py [--all]
(--all also scans the locale JSON and the policy translations)."""
import os, sys
sys.stdout.reconfigure(encoding="utf-8")
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", ".."))
OLD = ["Character Matcher", "Color Harmony Explorer",
       "Charakter-Matcher", "キャラクターマッチャー", "캐릭터 매처", "角色配色器",
       "Farbharmonie-Explorer", "カラーハーモニーエクスプローラー", "색상 조화 탐색기", "色彩和谐探索器",
       "Explorateur d'Harmonies de Couleurs"]
SKIP_DIRS = {"node_modules", "dist", "coverage", ".git", ".turbo", "e2e-coverage", ".font-sources",
             "playwright-report", "test-results", ".wrangler"}
ALL = "--all" in sys.argv
hits = 0
for top in ("apps", "packages", "docs/user-guides", "docs/projects", "docs/reference", "docs/architecture"):
    for root, dirs, files in os.walk(os.path.join(REPO, top)):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for fn in files:
            if not fn.endswith((".ts", ".md", ".json", ".html", ".mjs", ".js", ".yaml", ".csv", ".py")):
                continue
            p = os.path.join(root, fn)
            rel = os.path.relpath(p, REPO).replace("\\", "/")
            if "CHANGELOG" in fn:
                continue
            per_language = "/locales/" in rel or fn.split(".")[-2:-1] in (["ja"], ["de"], ["fr"], ["ko"], ["zh"])
            if per_language and not ALL:
                continue
            try:
                lines = open(p, encoding="utf-8").read().split("\n")
            except (UnicodeDecodeError, OSError):
                continue
            for i, ln in enumerate(lines, 1):
                for o in OLD:
                    if o in ln:
                        print(f"{rel}:{i}: {o}")
                        hits += 1
print(f"\n{hits} hit(s)")
