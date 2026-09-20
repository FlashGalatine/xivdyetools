#!/usr/bin/env python3
"""Print named keys across all six locales of a set. Usage: spot-values.py <web|bot|core> key [key...]"""
import json, os, sys
sys.stdout.reconfigure(encoding="utf-8")
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", ".."))
SETS = {"web": "apps/web-app/src/locales", "bot": "packages/bot-logic/src/i18n/locales", "core": "packages/core/src/data/locales"}
rel = SETS[sys.argv[1]]
for key in sys.argv[2:]:
    print(f"## {key}")
    for lc in ["en", "ja", "de", "fr", "ko", "zh"]:
        d = json.load(open(os.path.join(REPO, rel, f"{lc}.json"), encoding="utf-8"))
        for part in key.split("."):
            d = d.get(part, {}) if isinstance(d, dict) else {}
        print(f"  {lc}: {d!r}")
