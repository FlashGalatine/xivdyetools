# -*- coding: utf-8 -*-
import json

root = "C:/dev/XIVProjects/xivdyetools/.claude/worktrees/i18n-audit-2026-09-03/"
locales = ['en', 'ja', 'de', 'fr', 'ko', 'zh']

data = {}
for loc in locales:
    data[loc] = json.load(open(root + f"packages/core/src/data/locales/{loc}.json", encoding='utf-8'))

out = []

top_keys_by_locale = {loc: set(data[loc].keys()) for loc in locales}
all_top = set()
for s in top_keys_by_locale.values():
    all_top |= s
out.append(f"Top-level namespaces (union): {sorted(all_top)}")
for loc in locales:
    missing = all_top - top_keys_by_locale[loc]
    extra = top_keys_by_locale[loc] - all_top
    if missing or extra:
        out.append(f"  {loc}: missing={sorted(missing)} extra={sorted(extra)}")

namespaces = ['labels', 'categories', 'acquisitions', 'currencies', 'harmonyTypes',
              'visionTypes', 'visions', 'tools', 'sheets', 'races', 'clans']

for ns in namespaces:
    out.append(f"\n=== Namespace: {ns} ===")
    key_sets = {}
    for loc in locales:
        obj = data[loc].get(ns, {})
        key_sets[loc] = set(obj.keys())
    union = set()
    for s in key_sets.values():
        union |= s
    out.append(f"  union key count: {len(union)} -> {sorted(union)}")
    for loc in locales:
        missing = union - key_sets[loc]
        extra = key_sets[loc] - union
        if missing or extra:
            out.append(f"  {loc}: MISSING={sorted(missing)} EXTRA={sorted(extra)}")
    # value-parity fingerprint: which locales have identical value to EN, per key
    en_obj = data['en'].get(ns, {})
    for key in sorted(union):
        row = {}
        for loc in locales:
            v = data[loc].get(ns, {}).get(key, '<MISSING>')
            row[loc] = v
        en_val = row.get('en')
        same_as_en = [loc for loc in locales if loc != 'en' and row.get(loc) == en_val]
        if same_as_en:
            out.append(f"    key={key!r} en={en_val!r} IDENTICAL_TO_EN_IN={same_as_en}")

# dyeNames key-count parity (already know itemIDs match dyes.json; just confirm counts equal across locales)
out.append("\n=== dyeNames key count per locale ===")
for loc in locales:
    out.append(f"  {loc}: {len(data[loc]['dyeNames'])}")

# meta.dyeCount consistency
out.append("\n=== meta.dyeCount per locale ===")
for loc in locales:
    out.append(f"  {loc}: {data[loc]['meta']['dyeCount']}")

with open(root + "docs/audits/2026-09-03-i18n/evidence/scripts/namespace_parity_results.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(out))
print("done", len(out))
