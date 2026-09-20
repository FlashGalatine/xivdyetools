#!/usr/bin/env python3
"""Add one navigation line under the H1 of each ENGLISH policy document, linking its five
translations (I18N-010). Navigation only: no digits, no http URLs, no claim — the parity gate
(numbers / urls / headings / lists / tables) is unaffected, and `Last updated` does not move.
Idempotent."""
import os, sys
sys.stdout.reconfigure(encoding="utf-8")
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", ".."))
DOCS = ["apps/web-app/PRIVACY.md", "apps/web-app/TERMS_OF_SERVICE.md",
        "apps/discord-worker/PRIVACY_POLICY.md", "apps/discord-worker/TERMS_OF_SERVICE.md"]
NAMES = [("ja", "日本語"), ("de", "Deutsch"), ("fr", "Français"), ("ko", "한국어"), ("zh", "中文")]
MARK = "> Also available in:"

for doc in DOCS:
    p = os.path.join(REPO, doc)
    s = open(p, encoding="utf-8").read()
    if MARK in s:
        print(f"skip {doc}")
        continue
    stem, ext = os.path.splitext(os.path.basename(doc))
    links = " · ".join(f"[{label}]({stem}.{lc}{ext})" for lc, label in NAMES)
    line = f"{MARK} {links}. This English version is the authoritative text.\n"
    lines = s.split("\n")
    h1 = next(i for i, ln in enumerate(lines) if ln.startswith("# "))
    lines[h1 + 1:h1 + 1] = ["", line.rstrip("\n")]
    open(p, "w", encoding="utf-8", newline="\n").write("\n".join(lines))
    print(f"ok   {doc}")
