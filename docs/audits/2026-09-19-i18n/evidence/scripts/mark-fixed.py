#!/usr/bin/env python3
"""Set every finding's `## Status` to FIXED with its commits, and annotate the plan's sprint headings."""
import os, re, sys
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
D = "2026-09-20"
FIXED = {
    "I18N-001": ("`b76623dd` + `354fe746`", "137 keys ×6 generated from the schema; `localizeOption()` walks every option; test asserts coverage, drift and Discord's cap (longest localization per field — `/preferences` 2,736, not the 9,909 a per-locale sum gave)"),
    "I18N-002": ("`354fe746`", "`manual`/`topic` case; `match_image` uses `matchImageHelp.title` (no `manual5.topics` key exists for it)"),
    "HC-001": ("`b76623dd` + `354fe746`", "`about.builtOnBody` ×6; the English constant is gone"),
    "I18N-003": ("`b76623dd`", "`Intl.PluralRules` per Translator; fr 0/1/2, de 0, en 0, ja pinned"),
    "I18N-004": ("`329fcc58`", "`안팎` in **two** keys — remediation found a second occurrence in `accessibility.unitDeDesc`"),
    "I18N-005": ("`f7c6e1fc` + `b76623dd` (docs `7ae472e7`)", "`foldForSearch()` in core, used by `DyeService` and bot-logic; Latin-only mark strip, `が`≠`か` tested"),
    "I18N-006": ("`b76623dd` + `354fe746`", "`card.colours_one/_other` added, bare key kept; `t.tc()` at the call site"),
    "I18N-007": ("`f7c6e1fc`", "generator exits 1 on an empty cell (`--allow-missing`); `getColorWheelName` ends in `formatKey()`"),
    "I18N-008": ("`329fcc58`", "`compareDyeNames` in Budget; localized-label compare in the dye selector"),
    "I18N-009": ("`f7c6e1fc` + `7ae472e7`", "JSDoc example corrected; `Variables.locale` is `LocaleCode`"),
    "I18N-010": ("`863cd0e7` + `0008820a`", "20 translations + locale-aware About links + an \"Also available in\" line on the four English files; parity PASS, then 32 corrections from two `opus` reviewers"),
    "TERM-001": ("`329fcc58` + `b76623dd`", "one official term per locale on both surfaces; dictionary section *Market and Server Terms* added"),
    "TERM-002": ("`329fcc58`", "seven `resultCard.tools.*` keys deleted; `toolLabel()` renders the route's `titleKey`"),
    "TERM-003": ("`329fcc58` + `b76623dd`", "ko `서버` / `데이터 센터`, zh `服务器` / `大区` on both surfaces, Korean particles re-agreed"),
    "TERM-004": ("`329fcc58`", "one form per concept per locale; same-English divergent groups in web-app 35 → 11, all context-dependent"),
}
for fid, (commits, note) in FIXED.items():
    p = os.path.join(ROOT, "findings", f"{fid}.md")
    s = open(p, encoding="utf-8").read()
    head, sep, _ = s.partition("## Status\n")
    assert sep, fid
    open(p, "w", encoding="utf-8", newline="\n").write(f"{head}## Status\nFIXED {D} {commits} — {note}\n")
    print("ok  ", fid)

SPRINTS = {
    "## Sprint 1 —": "`f7c6e1fc` · **Deploy needs:** merge, then publish `@xivdyetools/core` 5.4.0 FIRST",
    "## Sprint 2 —": "`329fcc58` · **Deploy needs:** merge (ships as web-app 5.12.0 with Sprint 3)",
    "## Sprint 3 —": "`863cd0e7` · **Deploy needs:** merge → `deploy-web-app.yml`",
    "## Sprint 4 —": "`7ae472e7` · **Deploy needs:** merge → `deploy-api-worker.yml`",
    "## Sprint 5 —": "`b76623dd` · **Deploy needs:** merge, then publish `@xivdyetools/bot-logic` 4.4.0 after core",
    "## Sprint 6 —": "`354fe746` + `0008820a` · **Deploy needs:** merge → `deploy-discord-worker.yml` (runs `register-commands`)",
    "## Sprint 7 —": "`1fb3341f` (+ root notes `ce455850`) · **Deploy needs:** none of its own",
}
p = os.path.join(ROOT, "REMEDIATION_PLAN.md")
s = open(p, encoding="utf-8").read()
for prefix, tail in SPRINTS.items():
    lines = s.split("\n")
    for i, ln in enumerate(lines):
        if ln.startswith(prefix) and "✅" not in ln:
            lines[i] = f"{ln}  **✅ COMPLETED {D}** {tail}"
    s = "\n".join(lines)
s = s.replace("**Status basis:** 15 total — 0 fixed, 15 outstanding,", f"**Status basis:** 15 total — **15 fixed {D}**, 0 outstanding,")
open(p, "w", encoding="utf-8", newline="\n").write(s)
print("ok   REMEDIATION_PLAN.md")
