#!/usr/bin/env python3
"""Apply exact, reviewed locale edits without re-serialising the JSON.

    python apply-locale-edits.py <edits.json> [--check]

edits.json: { "<repo-relative locale dir>": { "<lc>": [ ["dotted.key", "old", "new"], ... ] } }

Each row is verified against the parsed JSON first (the dotted key must currently hold `old`, or
already hold `new` - the script is idempotent), then applied as a one-line text replacement of
`"<leaf>": "<old>"`, which must match exactly one line. Key order, indentation and every other
byte stay as they were, so the diff is the edit and nothing else. A row that matches nothing, or
more than one line, aborts before any file is written."""
import json
import os
import sys

sys.stdout.reconfigure(encoding="utf-8")
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", ".."))


def get(d, dotted):
    for part in dotted.split("."):
        d = d[part]
    return d


def main():
    spec_path = sys.argv[1]
    check_only = "--check" in sys.argv
    spec = json.load(open(spec_path, encoding="utf-8"))
    pending = {}
    applied = skipped = 0
    for rel, per_locale in spec.items():
        for lc, rows in per_locale.items():
            path = os.path.join(REPO, rel, f"{lc}.json")
            text = pending.get(path) or open(path, encoding="utf-8").read()
            data = json.loads(text)
            for key, old, new in rows:
                cur = get(data, key)
                if cur == new:
                    skipped += 1
                    continue
                if cur != old:
                    sys.exit(f"ABORT {lc} {key}: expected {old!r}, found {cur!r}")
                leaf = key.split(".")[-1]
                needle = f"{json.dumps(leaf, ensure_ascii=False)}: {json.dumps(old, ensure_ascii=False)}"
                repl = f"{json.dumps(leaf, ensure_ascii=False)}: {json.dumps(new, ensure_ascii=False)}"
                lines = text.split("\n")
                hits = [i for i, l in enumerate(lines) if l.strip().rstrip(",") == needle]
                if len(hits) != 1:
                    # the same leaf + value may exist in another namespace: pick the one whose
                    # replacement makes the parsed key hold `new`
                    good = []
                    for i in hits:
                        trial = lines[:]
                        trial[i] = trial[i].replace(needle, repl, 1)
                        if get(json.loads("\n".join(trial)), key) == new:
                            good.append(i)
                    if len(good) != 1:
                        sys.exit(f"ABORT {lc} {key}: {len(hits)} candidate lines, {len(good)} resolve")
                    hits = good
                i = hits[0]
                lines[i] = lines[i].replace(needle, repl, 1)
                text = "\n".join(lines)
                data = json.loads(text)
                assert get(data, key) == new, (lc, key)
                applied += 1
            pending[path] = text
    if not check_only:
        for path, text in pending.items():
            with open(path, "w", encoding="utf-8", newline="\n") as f:
                f.write(text)
    print(f"{'would apply' if check_only else 'applied'} {applied}, already in place {skipped}, files {len(pending)}")


if __name__ == "__main__":
    main()
