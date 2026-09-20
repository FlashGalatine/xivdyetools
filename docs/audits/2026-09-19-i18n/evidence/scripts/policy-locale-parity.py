#!/usr/bin/env python3
"""Mechanical parity sweep for the Privacy / Terms of Service documents and their locale variants.

Convention (audit-shared/policy-documents.md): the unsuffixed file is English and governing;
translations are siblings named <STEM>.<locale>.md for ja de fr ko zh.

Checks per document, each variant against the English file:
  existence · heading count + levels · list-item and table-row counts · multiset of numbers ·
  multiset of backticked tokens · multiset of URLs · slash-commands · Last-updated DATE ·
  English-prevails notice (a link to the English file in the first 15 lines) ·
  staleness (variant's last commit older than the English file's).

Run from the monorepo root (xivdyetools/). Writes nothing. Exit 0 = all parity checks pass,
1 = at least one FAIL, 2 = no policy document found (wrong directory).
Meaning (does each section make the same claim?) is NOT checked here — that needs a reader.
"""
import collections
import os
import re
import subprocess
import sys
import unicodedata

sys.stdout.reconfigure(encoding="utf-8")
LOCALES = ["ja", "de", "fr", "ko", "zh"]
DOCS = [
    "apps/web-app/PRIVACY.md",
    "apps/web-app/TERMS_OF_SERVICE.md",
    "apps/discord-worker/PRIVACY_POLICY.md",
    "apps/discord-worker/TERMS_OF_SERVICE.md",
]
# ISO, or a CJK-style date (2026年9月16日 / 2026년 9월 16일). Translations are asked to keep ISO.
ISO_DATE = r"(\d{4})\s*[-/.年년]\s*(\d{1,2})\s*[-/.月월]\s*(\d{1,2})"
EN_DATE = r"([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})"
# A number is delimited by ASCII word characters only: in Python `\w` matches 日 / 일 / か, which
# would hide the 30 in "30日" from a \w-based lookahead and report a false mismatch.
NUMBER = r"(?<![A-Za-z0-9_.])\d+(?:[.,]\d+)?(?![A-Za-z0-9_])"
# Words whose conventional spelling contains a digit that is NOT a quantity. Removed before numbers
# are counted, so the gate never pushes a translator toward an unnatural form: Korean legal text
# writes "third party" as 제3자 (the 2026-09-19 translation pass respelled it 제삼자 just to get
# past this check). Add a word here only when the digit is lexical, never to silence a real number.
LEXICAL_DIGIT_WORDS = ["제3자"]
MONTHS = {m: i for i, m in enumerate(
    ["january", "february", "march", "april", "may", "june", "july", "august", "september",
     "october", "november", "december"], 1)}


def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def last_commit(path):
    try:
        out = subprocess.run(["git", "log", "-1", "--format=%cI", "--", path],
                             capture_output=True, text=True, check=False).stdout.strip()
        return out or None
    except OSError:
        return None


def updated_date(text):
    """The document's Last-updated date as (y, m, d), from ISO or 'Month D, YYYY'; None if absent."""
    head = "\n".join(text.splitlines()[:25])
    m = re.search(ISO_DATE, head)
    if m:
        return tuple(int(x) for x in m.groups())
    m = re.search(EN_DATE, head)
    if m and m.group(1).lower() in MONTHS:
        return (int(m.group(3)), MONTHS[m.group(1).lower()], int(m.group(2)))
    return None


def facts(text):
    # The Last-updated DATE is compared separately (its format may be localized); remove the first
    # date token in the header block so its digits do not count as "numbers" on either side.
    text = unicodedata.normalize("NFKC", text)  # full-width digits / Latin → ASCII
    lines = text.splitlines()
    head, rest = "\n".join(lines[:25]), "\n".join(lines[25:])
    head, n = re.subn(ISO_DATE, "", head, count=1)
    if not n:
        head = re.sub(EN_DATE, "", head, count=1)
    body = head + "\n" + rest
    for word in LEXICAL_DIGIT_WORDS:
        body = body.replace(word, "")
    return {
        "headings": [len(h) for h in re.findall(r"(?m)^(#{1,6})\s", text)],
        "list_items": len(re.findall(r"(?m)^\s*(?:[-*+]|\d+[.)])\s", text)),
        "table_rows": len(re.findall(r"(?m)^\|", text)),
        "numbers": collections.Counter(re.findall(NUMBER, body)),
        "code": collections.Counter(re.findall(r"`([^`\n]+)`", text)),
        "urls": collections.Counter(re.findall(r"https?://[^\s)>\]]+", text)),
        "commands": collections.Counter(re.findall(r"(?<![\w/])/[a-z_][a-z0-9_]+", text)),
    }


def diff_counter(a, b):
    missing = list((a - b).elements())
    extra = list((b - a).elements())
    return missing, extra


def main():
    found = [d for d in DOCS if os.path.exists(d)]
    if not found:
        print("no policy document found — run from the monorepo root")
        return 2
    fails = 0
    for doc in found:
        stem, ext = os.path.splitext(doc)
        en_text = read(doc)
        en = facts(en_text)
        en_date = updated_date(en_text)
        en_commit = last_commit(doc)
        print(f"===== {doc}  (last updated {en_date}, last commit {en_commit})")
        variants = {lc: f"{stem}.{lc}{ext}" for lc in LOCALES}
        present = [lc for lc, p in variants.items() if os.path.exists(p)]
        if not present:
            print("  NO VARIANTS — all five locales missing "
                  "(known open finding 2026-09-19-i18n/I18N-010 until remediation lands)")
            fails += 1
            continue
        for lc in LOCALES:
            path = variants[lc]
            if lc not in present:
                print(f"  FAIL {lc}: missing {path}")
                fails += 1
                continue
            text = read(path)
            f = facts(text)
            problems = []
            if f["headings"] != en["headings"]:
                problems.append(f"headings {len(f['headings'])} vs en {len(en['headings'])} (or levels differ)")
            for key in ("list_items", "table_rows"):
                if f[key] != en[key]:
                    problems.append(f"{key} {f[key]} vs en {en[key]}")
            for key in ("numbers", "code", "urls", "commands"):
                missing, extra = diff_counter(en[key], f[key])
                # the English-prevails notice legitimately adds ONE link to the English file
                if key == "urls":
                    extra = [u for u in extra if os.path.basename(doc) not in u]
                if missing or extra:
                    problems.append(f"{key}: missing {missing[:8]} extra {extra[:8]}")
            if updated_date(text) != en_date:
                problems.append(f"Last-updated {updated_date(text)} vs en {en_date}")
            head = "\n".join(text.splitlines()[:15])
            if os.path.basename(doc) not in head:
                problems.append("no English-prevails notice linking the English file in the first 15 lines")
            vc = last_commit(path)
            if en_commit and vc and vc < en_commit:
                problems.append(f"stale: last commit {vc} predates the English file's {en_commit}")
            if problems:
                fails += 1
                print(f"  FAIL {lc}: {path}")
                for p in problems:
                    print(f"         - {p}")
            else:
                print(f"  ok   {lc}: {path}")
        for extra in sorted(set(os.listdir(os.path.dirname(doc)))):
            m = re.fullmatch(re.escape(os.path.basename(stem)) + r"\.([A-Za-z-]+)" + re.escape(ext), extra)
            if m and m.group(1) not in LOCALES:
                print(f"  FAIL unexpected variant {extra} (locale {m.group(1)!r} is not supported)")
                fails += 1
    print(f"\n{'FAIL' if fails else 'PASS'} — {fails} problem group(s)")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
