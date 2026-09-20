#!/usr/bin/env python3
"""Clarify two ambiguous sentences in both Terms of Service, in all six languages, and move
`Last updated` to the same new date in every variant (OPEN_ITEMS_SOLUTIONS.md §1, 2026-09-20).

Rows are (file, exact current substring, replacement); "\\n" marks a hard wrap in the file.
Idempotent: a row whose replacement is already in place is skipped. Nothing is written unless
EVERY row of EVERY file either matches exactly once or is already applied - a stale quote means
the document moved on and a human should look.

    python apply-terms-clarification.py [--check]
"""
import os
import sys

sys.stdout.reconfigure(encoding="utf-8")
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", ".."))
W, D = "apps/web-app/TERMS_OF_SERVICE", "apps/discord-worker/TERMS_OF_SERVICE"
OLD_DATE, NEW_DATE = "2026-09-16", "2026-09-20"

ROWS = [
    # ---------------------------------------------------------------- English (governing)
    # 1. "dyes ... extracted from images": it is the COLORS that are extracted.
    (D + ".md",
     "- **Color Matching**: Find FFXIV dyes closest to any hex color or extracted from images",
     "- **Color Matching**: Find the FFXIV dyes closest to any hex color, or to colors extracted from an image"),
    # 2. who "does not let you waive"? - the same law; and WHOSE law? - not the venue's.
    (D + ".md",
     "Nothing in these Terms removes a consumer-protection right your local law grants you and does not permit you to waive.",
     "Nothing in these Terms removes any consumer-protection right that the law of the place where you live grants you and that the same law does not permit you to waive."),
    (W + ".md",
     "venue. Nothing here takes away a consumer-protection right your local law gives you and does not\nlet you waive.",
     "venue. Nothing here takes away any consumer-protection right that the law of the place where you\nlive gives you and that the same law does not let you waive."),
    # ---------------------------------------------------------------- German
    (D + ".de.md",
     "Nichts in diesen Bedingungen nimmt dir ein Verbraucherschutzrecht, das dir dein örtliches Recht\ngewährt und das du nicht abbedingen kannst.",
     "Nichts in diesen Bedingungen nimmt dir ein Verbraucherschutzrecht, das dir das an deinem Wohnort\ngeltende Recht gewährt und das nach diesem Recht unabdingbar ist."),
    (W + ".de.md",
     "diesem Gerichtsstand zu. Nichts hierin nimmt dir ein Verbraucherschutzrecht, das dir dein\nörtliches Recht gewährt und das du nicht abbedingen kannst.",
     "diesem Gerichtsstand zu. Nichts hierin nimmt dir ein Verbraucherschutzrecht, das dir das an\ndeinem Wohnort geltende Recht gewährt und auf das du nach diesem Recht nicht verzichten kannst."),
    # ---------------------------------------------------------------- French
    (D + ".fr.md",
     "que votre droit local vous accorde et auquel il ne vous permet pas de renoncer.",
     "que le droit de votre lieu de résidence vous accorde et auquel ce même droit ne vous permet pas de renoncer."),
    (W + ".fr.md",
     "juridiction compétente. Rien ici ne retire un droit de protection du consommateur que votre droit\nlocal vous accorde et auquel il ne vous permet pas de renoncer.",
     "juridiction compétente. Rien ici ne retire un droit de protection du consommateur que le droit de\nvotre lieu de résidence vous accorde et auquel ce même droit ne vous permet pas de renoncer."),
    # ---------------------------------------------------------------- Korean
    (D + ".ko.md",
     "사용자의 거주 국가 법이 부여하고 포기할 수 없도록 정한 소비자 보호 권리",
     "사용자가 거주하는 지역의 법이 부여하고 그 법이 포기할 수 없도록 정한 소비자 보호 권리"),
    (W + ".ko.md",
     "사용자의 거주 국가 법이 부여하고 포기할 수 없도록 정한 소비자 보호 권리",
     "사용자가 거주하는 지역의 법이 부여하고 그 법이 포기할 수 없도록 정한 소비자 보호 권리"),
    # ---------------------------------------------------------------- Chinese
    (D + ".zh.md",
     "本条款中的任何内容都不会剥夺您当地法律赋予且不允许放弃的消费者保护权利。",
     "本条款中的任何内容都不会剥夺您居住地法律赋予且该法律不允许放弃的消费者保护权利。"),
    (W + ".zh.md",
     "本条款中的任何内容都不会剥夺您当地\n法律赋予且不允许放弃的消费者保护权利。",
     # one line: the zh files were unwrapped afterwards (unwrap-cjk-policy.py) - a soft break
     # between two CJK characters renders as a stray space
     "本条款中的任何内容都不会剥夺您居住地法律赋予且该法律不允许放弃的消费者保护权利。"),
    # Japanese: 「ユーザーの居住地の法律が付与し、放棄することを認めていない」 already says all of it.
    # ---------------------------------------------------------------- Last updated, x12
    (D + ".md", "**Last Updated**: September 16, 2026", "**Last Updated**: September 20, 2026"),
    (D + ".ja.md", f"**最終更新日**：{OLD_DATE}", f"**最終更新日**：{NEW_DATE}"),
    (D + ".de.md", f"**Zuletzt aktualisiert**: {OLD_DATE}", f"**Zuletzt aktualisiert**: {NEW_DATE}"),
    (D + ".fr.md", f"**Dernière mise à jour** : {OLD_DATE}", f"**Dernière mise à jour** : {NEW_DATE}"),
    (D + ".ko.md", f"**최종 업데이트**: {OLD_DATE}", f"**최종 업데이트**: {NEW_DATE}"),
    (D + ".zh.md", f"**最后更新**：{OLD_DATE}", f"**最后更新**：{NEW_DATE}"),
    (W + ".md", f"**Last updated:** {OLD_DATE}", f"**Last updated:** {NEW_DATE}"),
    (W + ".ja.md", f"**最終更新日:** {OLD_DATE}", f"**最終更新日:** {NEW_DATE}"),
    (W + ".de.md", f"**Zuletzt aktualisiert:** {OLD_DATE}", f"**Zuletzt aktualisiert:** {NEW_DATE}"),
    (W + ".fr.md", f"**Dernière mise à jour :** {OLD_DATE}", f"**Dernière mise à jour :** {NEW_DATE}"),
    (W + ".ko.md", f"**최종 업데이트:** {OLD_DATE}", f"**최종 업데이트:** {NEW_DATE}"),
    (W + ".zh.md", f"**最后更新：** {OLD_DATE}", f"**最后更新：** {NEW_DATE}"),
]


def main():
    check_only = "--check" in sys.argv
    texts, applied, skipped, problems = {}, 0, 0, []
    for rel, old, new in ROWS:
        path = os.path.join(REPO, rel)
        text = texts.get(path) or open(path, encoding="utf-8").read()
        if text.count(old) == 1:
            text = text.replace(old, new)
            applied += 1
        elif text.count(old) == 0 and text.count(new) >= 1:
            skipped += 1
        else:
            problems.append(f"{rel}: expected exactly one {old[:50]!r}, found {text.count(old)}")
        texts[path] = text
    if problems:
        sys.exit("ABORT - nothing written:\n  " + "\n  ".join(problems))
    if not check_only:
        for path, text in texts.items():
            with open(path, "w", encoding="utf-8", newline="\n") as f:
                f.write(text)
    print(f"{'would apply' if check_only else 'applied'} {applied}, already in place {skipped}, files {len(texts)}")


if __name__ == "__main__":
    main()
