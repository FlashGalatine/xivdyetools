#!/usr/bin/env python3
"""Bump one workspace's version everywhere the docs gate reads it.
Usage: bump-version.py <dir e.g. packages/core> <name as it appears in the tables> <old> <new> "<history highlights>"
Touches: <dir>/package.json, root README.md row, docs/versions.md current row + a new history row.
Fails loudly (exit 1) if any of the four edits did not apply exactly once."""
import json, os, re, sys
sys.stdout.reconfigure(encoding="utf-8")
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", ".."))
d, name, old, new, highlights = sys.argv[1:6]
readme_name = sys.argv[6] if len(sys.argv) > 6 else name  # README names apps by directory


def edit(path, fn):
    p = os.path.join(REPO, path)
    s = open(p, encoding="utf-8").read()
    t, n = fn(s)
    if n != 1:
        raise SystemExit(f"FAIL {path}: expected exactly 1 edit, made {n}")
    open(p, "w", encoding="utf-8", newline="\n").write(t)
    print(f"ok   {path}")


pkg = json.load(open(os.path.join(REPO, d, "package.json"), encoding="utf-8"))
if pkg["version"] == new:
    print(f"skip {d}/package.json (already {new})")
else:
    edit(f"{d}/package.json", lambda s: re.subn(r'("version":\s*")' + re.escape(old) + '"', r"\g<1>" + new + '"', s, count=1))


def table_row(s, prefix, label=None):
    label = label or name
    lines, n = s.split("\n"), 0
    for i, ln in enumerate(lines):
        if ln.startswith("|") and f"`{label}`" in ln and f"{prefix}{old}" in ln:
            lines[i] = ln.replace(f"{prefix}{old}", f"{prefix}{new}", 1)
            n += 1
    return "\n".join(lines), n


edit("README.md", lambda s: table_row(s, "", readme_name))
edit("docs/versions.md", lambda s: table_row(s, "v"))


def history(s):
    lines, n = s.split("\n"), 0
    for i, ln in enumerate(lines):
        if ln.strip() == f"### {name}":
            for j in range(i + 1, min(i + 8, len(lines))):
                if re.match(r"^\|[-\s|]+\|$", lines[j]):
                    lines.insert(j + 1, f"| v{new} | Sep 2026 | {highlights} |")
                    n += 1
                    break
            break
    return "\n".join(lines), n


edit("docs/versions.md", history)
