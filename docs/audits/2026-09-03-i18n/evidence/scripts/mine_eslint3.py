import json

with open('docs/audits/2026-09-03-i18n/evidence/eslint.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

def norm(p):
    return p.replace('\\', '/')

for d in data:
    sm = d.get('suppressedMessages', [])
    if sm:
        print('=== FILE:', norm(d['filePath']))
        for m in sm:
            print('  rule:', m.get('ruleId'), '| line:', m.get('line'), '| severity:', m.get('severity'))
            print('  message:', m.get('message'))
            supp = m.get('suppressions', [])
            for s in supp:
                print('    suppression kind:', s.get('kind'), '| justification:', s.get('justification'))
            print()
