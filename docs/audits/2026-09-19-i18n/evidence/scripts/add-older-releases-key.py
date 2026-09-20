#!/usr/bin/env python3
"""Add `changelog.olderReleases` to the six web-app locale files, directly after
`changelog.currentTag` (the block's last key), without re-serialising the JSON. Idempotent."""
import json
import os
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", ".."))
VALUES = {
    "en": "Older releases on GitHub",
    "ja": "以前のリリースを GitHub で見る",
    "de": "Ältere Versionen auf GitHub",
    "fr": "Versions antérieures sur GitHub",
    "ko": "이전 릴리스는 GitHub에서 보기",
    "zh": "在 GitHub 上查看更早的版本",
}
for lc, value in VALUES.items():
    path = os.path.join(REPO, "apps", "web-app", "src", "locales", f"{lc}.json")
    text = open(path, encoding="utf-8").read()
    data = json.loads(text)
    if data["changelog"].get("olderReleases") == value:
        print(lc, "already in place")
        continue
    lines = text.split("\n")
    hits = [i for i, l in enumerate(lines) if re.match(r'^    "currentTag": ".*"$', l)]
    assert len(hits) == 1, (lc, hits)
    i = hits[0]
    lines[i] = lines[i] + ","
    lines.insert(i + 1, f'    "olderReleases": {json.dumps(value, ensure_ascii=False)}')
    text = "\n".join(lines)
    assert json.loads(text)["changelog"]["olderReleases"] == value
    assert list(json.loads(text)["changelog"])[-1] == "olderReleases"
    open(path, "w", encoding="utf-8", newline="\n").write(text)
    print(lc, "added")
