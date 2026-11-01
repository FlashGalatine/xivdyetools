"""Shared string/codepoint extraction for the i18n-manager scripts (not a CLI)."""
import json, os, re
from collections import defaultdict

BLOCKS = [
    ("CJK Unified", 0x4E00, 0x9FFF), ("CJK Ext-A", 0x3400, 0x4DBF), ("CJK Compat", 0xF900, 0xFAFF),
    ("Hiragana", 0x3040, 0x309F), ("Katakana", 0x30A0, 0x30FF), ("Hangul", 0xAC00, 0xD7AF),
    ("Hangul Jamo", 0x1100, 0x11FF), ("CJK Punct", 0x3000, 0x303F), ("Fullwidth", 0xFF00, 0xFFEF),
    ("Latin Ext", 0x0100, 0x024F), ("Latin Ext Add", 0x1E00, 0x1EFF), ("Latin-1", 0x0080, 0x00FF),
    ("Basic Latin", 0x0000, 0x007F), ("Symbols", 0x2000, 0x2BFF), ("Greek", 0x0370, 0x03FF),
]
LIT = re.compile(r"'((?:[^'\\\n]|\\.)*)'|\"((?:[^\"\\\n]|\\.)*)\"|`((?:[^`\\]|\\.)*)`", re.S)


def block(cp):
    for name, lo, hi in BLOCKS:
        if lo <= cp <= hi:
            return name
    return "Other"


def _json_strings(obj, out):
    if isinstance(obj, str):
        out.append(obj)
    elif isinstance(obj, dict):
        for v in obj.values():
            _json_strings(v, out)
    elif isinstance(obj, list):
        for v in obj:
            _json_strings(v, out)


def strings_of(path):
    """All user-visible strings in a locale JSON file or a TS/JS string table."""
    with open(path, encoding="utf-8") as f:
        text = f.read()
    if path.endswith(".json"):
        out = []
        _json_strings(json.loads(text), out)
        return out
    return [a or b or c for a, b, c in LIT.findall(text)]


def expand(sources):
    """Dirs → their *.json files; files as given."""
    paths = []
    for a in sources:
        if os.path.isdir(a):
            paths += [os.path.join(a, f) for f in sorted(os.listdir(a)) if f.endswith(".json")]
        else:
            paths.append(a)
    return paths


def codepoints_of(path):
    cps = set()
    for s in strings_of(path):
        cps.update(ord(ch) for ch in s)
    return cps


def collect_codepoints(sources):
    cps = set()
    for p in expand(sources):
        cps |= codepoints_of(p)
    return cps


def inventory(path):
    by = defaultdict(set)
    for cp in codepoints_of(path):
        by[block(cp)].add(cp)
    return by
