#!/usr/bin/env python3
"""Remediation Phase 0 (mechanical, no translation): run once from anywhere.
  1. web-app: delete resultCard.tools.* from all six locale files (TERM-002).
  2. bot-logic en.json: add about.builtOnBody, card.colours_one/_other (HC-001, I18N-006).
Refuses to write a file whose existing bytes do not round-trip through json.dumps(indent=2),
so it can never reformat a hand-ordered locale file by accident."""
import json, os, sys
sys.stdout.reconfigure(encoding="utf-8")
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", ".."))
L = ["en", "ja", "de", "fr", "ko", "zh"]


def load(path):
    raw = open(path, encoding="utf-8").read()
    data = json.loads(raw)
    if json.dumps(data, ensure_ascii=False, indent=2) + "\n" != raw:
        raise SystemExit(f"REFUSING: {path} does not round-trip with indent=2 — edit by hand")
    return data


def save(path, data):
    open(path, "w", encoding="utf-8", newline="\n").write(json.dumps(data, ensure_ascii=False, indent=2) + "\n")


for lc in L:
    p = os.path.join(REPO, "apps/web-app/src/locales", f"{lc}.json")
    d = load(p)
    removed = list(d.get("resultCard", {}).pop("tools", {}).keys())
    save(p, d)
    print(f"web-app {lc}: removed resultCard.tools.{{{', '.join(removed)}}}")

p = os.path.join(REPO, "packages/bot-logic/src/i18n/locales/en.json")
d = load(p)
about = d["about"]
if "builtOnBody" not in about:
    rebuilt = {}
    for k, v in about.items():
        rebuilt[k] = v
        if k == "builtOn":
            rebuilt["builtOnBody"] = "Market prices from Universalis · Paint mixing by spectral.js"
    d["about"] = rebuilt
card = d["card"]
if "colours_one" not in card:
    rebuilt = {}
    for k, v in card.items():
        rebuilt[k] = v
        if k == "colours":
            rebuilt["colours_one"] = "{n} colour"
            rebuilt["colours_other"] = "{n} colours"
    d["card"] = rebuilt
save(p, d)
print("bot-logic en: about.builtOnBody, card.colours_one/_other present")
