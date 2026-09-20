#!/usr/bin/env python3
"""Unwrap hard-wrapped paragraphs in the Chinese policy translations.

A Markdown soft line break renders as a SPACE. Between two CJK characters that is wrong - GitHub
shows `您居住地 法律赋予` for a sentence wrapped after 居住地. The ja and ko translations keep one
paragraph per line; the four zh files were hard-wrapped at ~100 columns by their translator
(74 CJK-to-CJK breaks). This joins each paragraph back onto one line.

Join rule at each boundary: CJK | CJK (incl. full-width punctuation) -> no space; anything else ->
one space (the files write Latin words with a space on each side: `在 GitHub 上`).

Invariant, asserted before writing: the text is identical once ALL whitespace is removed, and the
line-level block structure (headings, list items, table rows, quotes, rules, fences) is unchanged.

    python unwrap-cjk-policy.py [--check]
"""
import glob
import os
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", ".."))
CJK = r"[　-ヿ㐀-鿿가-힯＀-￯]"
BLOCK_START = re.compile(r"^\s*([-*+] |\d+[.)] |#|\||>|```|~~~|---\s*$|\*\*\*\s*$|<)")


def unwrap(text):
    out, in_fence = [], False
    for line in text.split("\n"):
        stripped = line.strip()
        if stripped.startswith(("```", "~~~")):
            in_fence = not in_fence
            out.append(line)
            continue
        prev = out[-1] if out else ""
        continues = (
            not in_fence
            and stripped != ""
            and prev.strip() != ""
            and not BLOCK_START.match(line)
            and not prev.lstrip().startswith(("#", "|", "```", "~~~"))
            and not re.match(r"^\s*(---|\*\*\*)\s*$", prev)
        )
        if not continues:
            out.append(line)
            continue
        left, right = prev.rstrip(), stripped
        glue = "" if (re.search(CJK + r"$", left) and re.match(CJK, right)) else " "
        out[-1] = left + glue + right
    return "\n".join(out)


def blocks(text):
    """The block skeleton: what kind of line starts each block."""
    kinds = []
    for line in text.split("\n"):
        m = BLOCK_START.match(line)
        if m:
            kinds.append(m.group(1).strip() or m.group(1))
    return kinds


def main():
    check_only = "--check" in sys.argv
    changed = 0
    for path in sorted(glob.glob(os.path.join(REPO, "apps", "*", "*.zh.md"))):
        text = open(path, encoding="utf-8").read()
        new = unwrap(text)
        assert re.sub(r"\s+", "", new) == re.sub(r"\s+", "", text), f"content changed: {path}"
        assert blocks(new) == blocks(text), f"block structure changed: {path}"
        joined = text.count("\n") - new.count("\n")
        print(f"{joined:4d} lines joined  {os.path.relpath(path, REPO)}")
        if joined and not check_only:
            with open(path, "w", encoding="utf-8", newline="\n") as f:
                f.write(new)
            changed += 1
    print(f"{'would change' if check_only else 'changed'} {changed if not check_only else '-'} file(s)")


if __name__ == "__main__":
    main()
