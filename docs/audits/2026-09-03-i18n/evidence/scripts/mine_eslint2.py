import json

with open('docs/audits/2026-09-03-i18n/evidence/eslint.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

total_err = sum(d['errorCount'] for d in data)
total_warn = sum(d['warningCount'] for d in data)
total_msgs = sum(len(d['messages']) for d in data)
total_suppressed = sum(len(d.get('suppressedMessages', [])) for d in data)
print('total errorCount:', total_err)
print('total warningCount:', total_warn)
print('total messages:', total_msgs)
print('total suppressedMessages:', total_suppressed)

# show any file with nonzero counts
for d in data:
    if d['errorCount'] or d['warningCount'] or len(d['messages']) or len(d.get('suppressedMessages', [])):
        print('NONZERO:', d['filePath'], d['errorCount'], d['warningCount'], len(d['messages']), len(d.get('suppressedMessages', [])))
