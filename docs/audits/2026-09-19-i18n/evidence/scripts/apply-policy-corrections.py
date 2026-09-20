#!/usr/bin/env python3
"""Apply the Opus verifiers' corrections to the policy translations (I18N-010).
Each row is (file, exact current substring, replacement, expected occurrence count or None = >=1).
Refuses to write a file if any of its rows does not match — a stale quote means the file moved on."""
import os, sys
sys.stdout.reconfigure(encoding="utf-8")
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", ".."))
W, D = "apps/web-app/", "apps/discord-worker/"

ROWS = [
    # --- de + fr verifier, 2026-09-20 ---
    (W + "TERMS_OF_SERVICE.fr.md", "vous accorde et ne vous permet pas de renoncer.", "vous accorde et auquel il ne vous permet pas de renoncer.", 1),
    (D + "TERMS_OF_SERVICE.fr.md", "vous accorde et ne vous permet pas de renoncer.", "vous accorde et auquel il ne vous permet pas de renoncer.", 1),
    (W + "PRIVACY.de.md", "werden in deinem Browser gelesen und niemals hochgeladen", "werden im Browser gelesen und nie hochgeladen", 1),
    (W + "PRIVACY.fr.md", "« Afficher les Prix »", "« Afficher les prix »", None),
    (W + "PRIVACY.fr.md", "d'Accessibilité", "d'accessibilité", None),
    (W + "TERMS_OF_SERVICE.fr.md", "d'Accessibilité", "d'accessibilité", None),
    (W + "PRIVACY.de.md", "verwirft jede Sammlung, die das", "verwirft jeden Stapel, der das", 1),
    (W + "PRIVACY.de.md", "kleine Sammlungen dieser Ereignisse", "kleine Stapel dieser Ereignisse", 1),
    (W + "PRIVACY.de.md", "Jede Sammlung trägt außerdem", "Jeder Stapel trägt außerdem", 1),
    (D + "PRIVACY_POLICY.de.md", "markiert außerdem einen täglichen Aktivitäts-Marker pro Nutzer", "dient außerdem als Schlüssel für einen täglichen Aktivitäts-Marker pro Nutzer", 1),
    # the coordinator then re-ordered the clause by hand so the verb closes it:
    # "…die einer beliebigen Hex-Farbe oder einer aus einem / Bild extrahierten Farbe am nächsten kommen"
    (D + "TERMS_OF_SERVICE.de.md", "oder die aus Bildern extrahiert wurden", "Bild extrahierten Farbe am nächsten kommen", 1),
    (W + "PRIVACY.de.md", "niemals als Vorlagenname, Autorenname", "niemals als Preset-Name, Autorenname", 1),
    (W + "TERMS_OF_SERVICE.de.md", "wiederholte Verstöße können dir", "wiederholte Verstöße können dich", 1),
    (W + "TERMS_OF_SERVICE.de.md", "Reiche nur Inhalte ein, an denen du das Recht dazu hast.", "Reiche nur Inhalte ein, zu deren Einreichung du berechtigt bist.", 1),
    # closed-list promise ("only to THESE first-party hosts") — verifier note, applied by the coordinator
    (W + "PRIVACY.fr.md", "L'application ne communique qu'avec ses propres hôtes", "L'application ne communique qu'avec ces hôtes de première partie", 1),
]
ROWS += [
    # --- ja + ko + zh verifier, 2026-09-20 ---
    # A: 当社 = "this COMPANY"; the operator is one individual. Counts are the verifier's.
    (W + "PRIVACY.ja.md", "当社", "運営者", 9),
    (W + "TERMS_OF_SERVICE.ja.md", "当社", "運営者", 14),
    (D + "PRIVACY_POLICY.ja.md", "当社", "運営者", 13),
    (D + "TERMS_OF_SERVICE.ja.md", "当社", "運営者", 9),
    # ...and the two places the blanket replace leaves reading redundantly
    (W + "TERMS_OF_SERVICE.ja.md", "運営者が自己負担で運営する", "運営者が自費で運営する", 1),
    (D + "TERMS_OF_SERVICE.ja.md", "運営者は、運営者の単独の裁量により", "運営者は、その単独の裁量により", 1),
    # A: 离开后 modified 发布, so only presets published AFTER leaving were covered
    (W + "TERMS_OF_SERVICE.zh.md", "您在离开后发布的预设可能仍会保留在线上", "您发布的预设在您离开后可能仍会保留在线上", 1),
    # A: 자사 = "our company's"
    (W + "PRIVACY.ko.md", "다음의 자사 호스트에만 통신하며", "다음의 자체 호스트에만 통신하며", 1),
    # A: ja 利用 is plain "use" — the user would agree never to USE rate limits
    (D + "TERMS_OF_SERVICE.ja.md", "レート制限を悪用、利用、または回避しようとしないこと", "レート制限を悪用、不正利用、または回避しようとしないこと", 1),
    # B: quoted UI strings must be the shipped strings (all checked against the locale JSON)
    (W + "PRIVACY.zh.md", "“图像在您的浏览器中读取，绝不会被上传”", "“图像仅在浏览器中读取，绝不上传”", 1),
    (W + "PRIVACY.zh.md", "「在…中打开」", "「在以下网站打开…」", 1),
    (D + "PRIVACY_POLICY.ja.md", "氏族、性別、既定のワールド / データセンター", "部族、性別、既定のワールド / データセンター", 1),
    (D + "PRIVACY_POLICY.ja.md", "（メタリック、パステル、ダーク、コズミック、イシュガルディアン、高額、店売り、クラフト）", "（メタリック、パステル、ダーク、コスモ、イシュガルド、高価、ベンダー、クラフト）", 1),
    (D + "PRIVACY_POLICY.ko.md", "(금속, 파스텔, 다크, 코스믹, 이시가르드, 고가, 상점 판매, 제작)", "(메탈릭, 파스텔, 다크, 코스모, 이슈가르드, 고가, 상인, 제작)", 1),
    (D + "PRIVACY_POLICY.zh.md", "（金属、粉彩、暗色、宇宙、伊修加德、昂贵、贩售、可制作）", "（金属、粉彩、暗色、宇宙、伊修加德、高价、商店、制作）", 1),
    # B: 서버 / 服务器 two rows above means a DISCORD server whose id is NOT stored
    (D + "PRIVACY_POLICY.ko.md", "기본 서버 / 데이터 센터", "기본 마켓 서버 / 데이터 센터", 1),
    (D + "PRIVACY_POLICY.zh.md", "默认服务器 / 大区", "默认市场服务器 / 大区", 1),
]

by_file = {}
for f, cur, new, n in ROWS:
    by_file.setdefault(f, []).append((cur, new, n))

bad = 0
for f, rows in by_file.items():
    p = os.path.join(REPO, f)
    s = open(p, encoding="utf-8").read()
    ok = True
    for cur, new, n in rows:
        c = s.count(cur)
        if c == 0 and s.count(new) > 0:
            print(f"skip {f}: already applied — {new[:40]!r}")
            continue
        if c == 0 or (n is not None and c != n):
            print(f"FAIL {f}: expected {n or '>=1'} of {cur[:50]!r}, found {c}")
            ok, bad = False, bad + 1
            continue
        s = s.replace(cur, new)
        print(f"ok   {f}: {c}x {cur[:36]!r} -> {new[:36]!r}")
    if ok:
        open(p, "w", encoding="utf-8", newline="\n").write(s)
sys.exit(1 if bad else 0)
