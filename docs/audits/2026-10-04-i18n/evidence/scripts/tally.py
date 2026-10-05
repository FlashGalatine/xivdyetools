"""Tally the workflow verdicts; write workflow-result.json (the result object) and verdicts.tsv."""
import collections
import json
import pathlib

EV = pathlib.Path(__file__).resolve().parent.parent
RAW = EV / 'workflow-result.raw.txt'   # the workflow's output file, kept only during the run
if RAW.exists():
    raw = json.loads(RAW.read_text(encoding='utf-8'))
    res = raw['result'] if 'result' in raw else raw
    (EV / 'workflow-result.json').write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding='utf-8', newline='\n')
else:
    res = json.loads((EV / 'workflow-result.json').read_text(encoding='utf-8'))

rows = []
for s in res['slices']:
    for v in s['verdicts']:
        sk = v.get('skeptic')
        rows.append({**v, 'slice': s['slice'],
                     'sk': '' if not sk else ('REFUTED' if sk['refuted'] else f"held {sk['tier']}"),
                     'sk_reason': '' if not sk else sk['reason']})
cols = ['slice', 'cand', 'verdict', 'prefix', 'tier', 'sk', 'origin', 'unit', 'locales', 'file_line', 'claim', 'fix', 'reason', 'sk_reason']
with open(EV / 'verdicts.tsv', 'w', encoding='utf-8', newline='\n') as f:
    f.write('\t'.join(cols) + '\n')
    for r in rows:
        f.write('\t'.join(str(r.get(c, '')).replace('\t', ' ').replace('\n', ' ').strip() for c in cols).rstrip() + '\n')

print('verdicts:', collections.Counter(r['verdict'] for r in rows))
conf = [r for r in rows if r['verdict'] == 'CONFIRMED']
print('confirmed by tier:', collections.Counter(r['tier'] for r in conf))
print('confirmed by prefix:', collections.Counter(r['prefix'] for r in conf))
print('confirmed by origin:', collections.Counter(r['origin'] for r in conf))
print('skeptic:', collections.Counter(r['sk'] for r in rows if r['sk']))
print('per slice:', {s['slice']: (len(s['verdicts']), sum(v['verdict'] == 'CONFIRMED' for v in s['verdicts'])) for s in res['slices']})
print('gaps:', [g['id'] for g in res.get('gaps', [])], 'missing:', res.get('missing'))
print()
for r in sorted(conf, key=lambda r: (r['tier'], r['unit'])):
    print(f"{r['tier']} {r['prefix']} {r['sk'] or '-'} | {r['origin']} | {r['unit']} | {r['locales']} | {r['file_line']} | {r['claim'][:200]}")
