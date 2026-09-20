#!/usr/bin/env python3
"""Apply the opus reviewer's 13 corrections to the naming + glamour pass (2026-09-20).
Exact-substring, idempotent; a row whose `current` is gone but whose `new` is present is skipped."""
import os, sys
sys.stdout.reconfigure(encoding="utf-8")
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", ".."))
WL, BL = "apps/web-app/src/locales/", "packages/bot-logic/src/i18n/locales/"
OGS, OGE = "apps/og-worker/src/services/og-strings.ts", "apps/og-worker/src/services/og-embed.ts"
ROWS = [
    # 1 (A) bare masculine count noun after "an" is ungrammatical
    (WL + "de.json", "An Farbmuster-Matcher gesendet", "An den Farbmuster-Matcher gesendet", 1),
    # 2 (B) bare 和谐 reads oddly as a tool name (and carries the censorship joke); 色彩和谐 is the file's word
    (WL + "zh.json", '"title": "和谐探索器"', '"title": "色彩和谐探索器"', 1),
    ("apps/web-app/PRIVACY.zh.md", "、和谐探索器", "、色彩和谐探索器", None),
    ("apps/web-app/TERMS_OF_SERVICE.zh.md", "、和谐探索器", "、色彩和谐探索器", None),
    # 3-5 (B) 코디 is casual; the legal documents take the official-register 의상 (particles re-agreed)
    ("apps/web-app/PRIVACY.ko.md", "코디를 제출", "의상을 제출", 1),
    ("apps/web-app/PRIVACY.ko.md", "코디나 그 팔레트를", "의상이나 그 팔레트를", 1),
    ("apps/web-app/PRIVACY.ko.md", "코디 블록의", "의상 블록의", 1),
    ("apps/web-app/PRIVACY.ko.md", "코디 부위의", "의상 부위의", 1),
    ("apps/web-app/TERMS_OF_SERVICE.ko.md", "코디의 장비", "의상의 장비", 1),
    ("apps/web-app/TERMS_OF_SERVICE.ko.md", "코디 부위의", "의상 부위의", 1),
    # 6, 7, 12 the tutorial banner lists tools by short name — three locales kept the retired one
    (WL + "ko.json", "하모니, 추출기", "조화, 추출기", 1),
    (WL + "zh.json", "色彩协调、提取器", "色彩和谐、提取器", 1),
    (WL + "en.json", "Color Harmony, Extractor", "Harmony, Extractor", 1),
    # 8 (B) the one hyphenated compound of the batch, and an abbreviation needs Durchkopplung
    (BL + "de.json", "FFXIV Projektions-Enthusiasten", "FFXIV-Projektionsenthusiasten", 1),
    # 9, 13 (B/C) og-embed de: "inklusive" reads as "including"; a 24-letter coinage
    (OGE, "Gestalte inklusive Projektionen!", "Gestalte Projektionen für alle!", 1),
    (OGE, "deine perfekte Projektionskombination", "die perfekte Kombination für deine Projektion", 2),
    # 10 (B, pre-existing) dangling を — the sentence had no verb
    (WL + "ja.json", "ミラプリページを。", "ミラプリページを入力してください。", 1),
    # 11 (C) the card headline quoted the retired title's shortening; the new title is short enough
    (OGS, "harmony: { name: 'Color Harmony',", "harmony: { name: 'Harmony Explorer',", 1),
    (OGS, "harmony: { name: 'Farbharmonie',", "harmony: { name: 'Harmonie-Explorer',", 1),
    (OGS, "harmony: { name: 'Harmonies de couleurs',", "harmony: { name: \"Explorateur d'harmonies\",", 1),
    (OGS, "harmony: { name: 'カラーハーモニー',", "harmony: { name: 'ハーモニーエクスプローラー',", 1),
    (OGS, "harmony: { name: '색상 조화',", "harmony: { name: '조화 탐색기',", 1),
    (OGS, "harmony: { name: '色彩和谐',", "harmony: { name: '色彩和谐探索器',", 1),
    (OGS,
     " * community title — with two deliberate card-shortenings ×6 (harmony drops\n * the Explorer suffix; budget drops Suggestions).",
     " * community title — with one deliberate card-shortening ×6 (budget drops\n * Suggestions). Harmony carried a second one, \"Color Harmony\", cut from the old\n * three-word title; the tool was renamed Harmony Explorer on 2026-09-20 and the\n * card now quotes that title in full, like the other seven.", 1),
]
bad = 0
for f, cur, new, n in ROWS:
    p = os.path.join(REPO, f)
    s = open(p, encoding="utf-8").read()
    c = s.count(cur)
    if new in s and (c == 0 or cur in new):
        print(f"skip {f}: already applied — {new[:34]!r}")
        continue
    if c == 0 or (n is not None and c != n):
        print(f"FAIL {f}: expected {n or '>=1'} of {cur[:44]!r}, found {c}")
        bad += 1
        continue
    open(p, "w", encoding="utf-8", newline="\n").write(s.replace(cur, new))
    print(f"ok   {f}: {c}x {cur[:30]!r} -> {new[:34]!r}")
for f in ("apps/web-app/PRIVACY.ko.md", "apps/web-app/TERMS_OF_SERVICE.ko.md"):
    left = open(os.path.join(REPO, f), encoding="utf-8").read().count("코디")
    print(f"{'ok  ' if left == 0 else 'FAIL'} {f}: {left} 코디 left")
    bad += left
sys.exit(1 if bad else 0)
