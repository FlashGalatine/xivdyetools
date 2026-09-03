import json
import sys

with open('docs/audits/2026-09-03-i18n/evidence/eslint.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

def norm(p):
    return p.replace('\\', '/')

webapp_files = [d for d in data if 'apps/web-app' in norm(d['filePath'])]
print('Total files in report:', len(data))
print('web-app files in report:', len(webapp_files))

rules = {}
for d in data:
    for m in d['messages']:
        rid = m.get('ruleId')
        rules[rid] = rules.get(rid, 0) + 1
print('\n--- All rule counts (whole report) ---')
for r, c in sorted(rules.items(), key=lambda x: -x[1]):
    print(r, c)

print('\n--- i18n rule counts in web-app only ---')
i18n_rules = {}
for d in webapp_files:
    for m in d['messages']:
        rid = m.get('ruleId') or ''
        if 'i18n' in rid:
            i18n_rules[rid] = i18n_rules.get(rid, 0) + 1
for r, c in sorted(i18n_rules.items(), key=lambda x: -x[1]):
    print(r, c)
