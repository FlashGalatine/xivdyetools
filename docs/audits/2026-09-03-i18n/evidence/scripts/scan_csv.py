# -*- coding: utf-8 -*-
import csv

root = "C:/dev/XIVProjects/xivdyetools/.claude/worktrees/i18n-audit-2026-09-03/"
path = root + "packages/core/dyenames.csv"

out = []

with open(path, encoding='utf-8-sig', newline='') as f:
    reader = csv.DictReader(f)
    rows = list(reader)

out.append(f"Total data rows: {len(rows)}")

cols = ['English Name', 'Japanese Name', 'German Name', 'French Name', 'Korean Name', 'Chinese Name']

# 1. blank cells
out.append("\n=== Blank/whitespace-only cells ===")
for i, row in enumerate(rows, start=2):  # start=2: line 1 is header
    for c in cols:
        val = row.get(c, None)
        if val is None or val.strip() == '':
            out.append(f"line {i}: itemID={row.get('itemID')} col={c} value={val!r}")

# 2. cells identical to English Name (trimmed) in ko/zh (and also ja/de/fr, for completeness)
out.append("\n=== Cells identical to trimmed English Name (possible untranslated leftovers) ===")
for i, row in enumerate(rows, start=2):
    en = (row.get('English Name') or '').strip()
    for c in ['Japanese Name', 'German Name', 'French Name', 'Korean Name', 'Chinese Name']:
        val = (row.get(c) or '').strip()
        if val and val == en:
            out.append(f"line {i}: itemID={row.get('itemID')} col={c} value={val!r} == English {en!r}")

# 3. leading/trailing whitespace (raw, before strip) per cell
out.append("\n=== Leading/trailing whitespace in raw cell (pre-trim) ===")
with open(path, encoding='utf-8-sig', newline='') as f:
    reader2 = csv.DictReader(f)
    for i, row in enumerate(reader2, start=2):
        for c in cols:
            raw = row.get(c)
            if raw is None:
                continue
            if raw != raw.strip():
                out.append(f"line {i}: itemID={row.get('itemID')} col={c} raw={raw!r}")

# 4. smart quotes / curly quotes / unusual punctuation check
out.append("\n=== Smart quotes or unusual punctuation (‘ ’ “ ” ‛ ‚ „) ===")
suspects = ['\u2018', '\u2019', '\u201c', '\u201d', '\u201a', '\u201e', '\ufffd']
with open(path, encoding='utf-8-sig', newline='') as f:
    reader3 = csv.DictReader(f)
    for i, row in enumerate(reader3, start=2):
        for c in cols:
            raw = row.get(c) or ''
            for s in suspects:
                if s in raw:
                    out.append(f"line {i}: itemID={row.get('itemID')} col={c} contains U+{ord(s):04X} value={raw!r}")

# 5. full-width vs half-width Latin / digit inconsistency inside CJK cells (ja/ko/zh)
out.append("\n=== Full-width ASCII variants (U+FF00-FFEF) inside CJK name cells ===")
with open(path, encoding='utf-8-sig', newline='') as f:
    reader4 = csv.DictReader(f)
    for i, row in enumerate(reader4, start=2):
        for c in ['Japanese Name', 'Korean Name', 'Chinese Name']:
            raw = row.get(c) or ''
            for ch in raw:
                if 0xFF00 <= ord(ch) <= 0xFFEF:
                    out.append(f"line {i}: itemID={row.get('itemID')} col={c} char=U+{ord(ch):04X} ({ch}) value={raw!r}")

# 6. duplicate itemIDs
out.append("\n=== Duplicate itemIDs ===")
seen = {}
for i, row in enumerate(rows, start=2):
    iid = (row.get('itemID') or '').strip()
    seen.setdefault(iid, []).append(i)
for iid, lines in seen.items():
    if len(lines) > 1:
        out.append(f"itemID={iid} appears on lines {lines}")

# 7. cross-check itemIDs against dyes.json stainIDs
import json
dyes = json.load(open(root + "packages/core/src/data/dyes.json", encoding='utf-8'))
dye_ids = set()
for d in dyes:
    # try common possible key names
    for k in ('stainID', 'itemID', 'legacyItemID'):
        if k in d:
            dye_ids.add(str(d[k]))
csv_ids = set((row.get('itemID') or '').strip() for row in rows)
out.append("\n=== itemIDs in CSV but not matching any dyes.json id field checked ===")
missing = csv_ids - dye_ids
out.append(f"dyes.json sample keys: {list(dyes[0].keys()) if dyes else 'EMPTY'}")
out.append(f"CSV ids not found among dyes.json stainID/itemID/legacyItemID: {sorted(missing)}")
out.append(f"dyes.json count: {len(dyes)}, CSV row count: {len(rows)}")

with open(root + "docs/audits/2026-09-03-i18n/evidence/scripts/csv_scan_results.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(out))
print("done", len(out))
