#!/usr/bin/env python3
"""English-side application of the maintainer's 2026-09-20 naming decisions:
  - the tool is "Swatch Matcher" (en.json said "Character Matcher")
  - the tool is "Harmony Explorer" (en.json said "Color Harmony Explorer")
  - the header-gear panel is "Advanced Settings" (the Privacy Policy and the dev docs said
    "Advanced Options"; file / symbol names such as advanced-options-panel.ts are untouched —
    the replace is case-sensitive on the two-word label only)
Localized titles, og-strings and the policy TRANSLATIONS are handled separately, per language.
Idempotent; every row asserts how many replacements it expects (None = at least one)."""
import os, sys
sys.stdout.reconfigure(encoding="utf-8")
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", ".."))
UG = "docs/user-guides/"
ROWS = [
    ("apps/web-app/src/locales/en.json", '"title": "Color Harmony Explorer"', '"title": "Harmony Explorer"', 1),
    ("apps/web-app/src/locales/en.json", '"title": "Character Matcher"', '"title": "Swatch Matcher"', 1),
    ("apps/web-app/PRIVACY.md", '"Reset settings" in Advanced Options', '"Reset settings" in Advanced Settings', 1),
    ("apps/web-app/PRIVACY.md", "**Advanced Options → Enable Analytics**", "**Advanced Settings → Enable Analytics**", 1),
    # living docs — the old title
    ("docs/architecture/overview.md", "Color Harmony Explorer", "Harmony Explorer", None),
    ("docs/projects/web-app/overview.md", "Color Harmony Explorer", "Harmony Explorer", None),
    (UG + "index.md", "Color Harmony Explorer", "Harmony Explorer", None),
    (UG + "web-app/accessibility.md", "Color Harmony Explorer", "Harmony Explorer", None),
    (UG + "web-app/color-harmony.md", "Color Harmony Explorer", "Harmony Explorer", None),
    (UG + "web-app/community-presets.md", "Color Harmony Explorer", "Harmony Explorer", None),
    (UG + "web-app/getting-started.md", "Color Harmony Explorer", "Harmony Explorer", None),
    (UG + "web-app/palette-extractor.md", "Color Harmony Explorer", "Harmony Explorer", None),
    (UG + "web-app/swatch-matcher.md", "Color Harmony Explorer", "Harmony Explorer", None),
    # living docs — notes that explained the split, which no longer exists
    (UG + "index.md", "| **Swatch Matcher** (app title: *Character Matcher*) |", "| **Swatch Matcher** |", 1),
    (UG + "web-app/swatch-matcher.md", "the tool menu lists it as **Character Matcher**.", "the tool menu lists it as **Swatch Matcher**.", 1),
    ("docs/projects/web-app/tools.md", 'en title "Character Matcher", short name "Swatch")', 'en title "Swatch Matcher" since 5.12.0 — it read "Character Matcher" before — short name "Swatch")', 1),
    # living docs — the gear panel's label
    ("docs/projects/web-app/components.md", "Advanced Options", "Advanced Settings", None),
    ("docs/projects/web-app/overview.md", "Advanced Options", "Advanced Settings", None),
    ("docs/projects/web-app/tools.md", "Advanced Options", "Advanced Settings", None),
    # source comments that would keep a grep for the old names alive
    ("apps/web-app/src/components/harmony-tool.ts", "Color Harmony Explorer", "Harmony Explorer", 1),
    ("apps/web-app/src/shared/tool-config-types.ts", "Swatch Matcher (Character Matcher) configuration", "Swatch Matcher configuration (locale namespace `tools.character`, the v3 name)", 1),
]
bad = 0
for f, cur, new, n in ROWS:
    p = os.path.join(REPO, f)
    s = open(p, encoding="utf-8").read()
    c = s.count(cur)
    if c == 0 and new in s:
        print(f"skip {f}: already applied")
        continue
    if c == 0 or (n is not None and c != n):
        print(f"FAIL {f}: expected {n or '>=1'} of {cur[:50]!r}, found {c}")
        bad += 1
        continue
    open(p, "w", encoding="utf-8", newline="\n").write(s.replace(cur, new))
    print(f"ok   {f}: {c}x {cur[:44]!r}")
sys.exit(1 if bad else 0)
