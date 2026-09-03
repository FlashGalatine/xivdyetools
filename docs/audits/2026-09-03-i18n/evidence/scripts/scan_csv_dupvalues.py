# -*- coding: utf-8 -*-
import csv

root = "C:/dev/XIVProjects/xivdyetools/.claude/worktrees/i18n-audit-2026-09-03/"
path = root + "packages/core/dyenames.csv"

out = []
cols = ['English Name', 'Japanese Name', 'German Name', 'French Name', 'Korean Name', 'Chinese Name']

with open(path, encoding='utf-8-sig', newline='') as f:
    reader = csv.DictReader(f)
    rows = list(reader)

for c in cols:
    out.append(f"\n=== Duplicate values within column: {c} ===")
    seen = {}
    for i, row in enumerate(rows, start=2):
        val = (row.get(c) or '').strip()
        seen.setdefault(val, []).append((i, row.get('itemID')))
    dupes_found = False
    for val, entries in seen.items():
        if len(entries) > 1:
            dupes_found = True
            lines_ids = ", ".join(f"line {ln} (itemID {iid})" for ln, iid in entries)
            out.append(f"  {val!r} -> {lines_ids}")
    if not dupes_found:
        out.append("  (none)")

# Also check for unusually short values (possible truncation) - fewer than 3 chars for non-CJK,
# or CJK columns fewer than 2 chars, as a truncation heuristic. Also flag any value ending in
# a bare hyphen/dash (a strong truncation signal already found once).
out.append("\n=== Values ending in a bare hyphen/dash (truncation heuristic) ===")
for i, row in enumerate(rows, start=2):
    for c in cols:
        val = (row.get(c) or '').strip()
        if val and val[-1] in ('-', '\u2013', '\u2014'):
            out.append(f"line {i}: itemID={row.get('itemID')} col={c} value={val!r}")

out.append("\n=== Unusually short values (possible truncation) ===")
for i, row in enumerate(rows, start=2):
    for c in cols:
        val = (row.get(c) or '').strip()
        min_len = 2 if c in ('Japanese Name', 'Korean Name', 'Chinese Name') else 3
        if val and len(val) < min_len:
            out.append(f"line {i}: itemID={row.get('itemID')} col={c} value={val!r} len={len(val)}")

with open(root + "docs/audits/2026-09-03-i18n/evidence/scripts/csv_dupvalues_results.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(out))
print("done")
