"""Save the deep-dive workflow result (`result` object of the task output) as evidence/workflow-result.json,
write evidence/verdicts.tsv (one row per verdict, with the skeptic's view), and print a tally.

Usage: python tally.py <task-output-file>"""
import collections
import json
import pathlib
import sys

EV = pathlib.Path('docs/audits/2026-10-04-deep-dive/evidence')
raw = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))
data = raw['result']
(EV / 'workflow-result.json').write_text(json.dumps(data, indent=1, ensure_ascii=False), encoding='utf-8', newline='\n')
groups = data['round1'] + data['round2']
cols = ['group', 'cand', 'verdict', 'kind', 'severity', 'bugType', 'priority', 'impact', 'unit', 'origin', 'file', 'line',
        'tested', 'skeptic', 'title', 'reason']
rows = ['\t'.join(cols)]
tally = collections.Counter()
for g in groups:
    for v in g['verdicts']:
        sk = v.get('skeptic')
        skv = '' if not sk else ('REFUTED' if sk.get('refuted') else sk.get('agreedSeverity', ''))
        rec = {**v, 'group': g['group'], 'skeptic': skv}
        rows.append('\t'.join(str(rec.get(k, '')).replace('\t', ' ').replace('\n', ' ') for k in cols))
        key = v['verdict'] if v['verdict'] != 'CONFIRMED' else f"CONFIRMED {v.get('kind')} {v.get('severity') if v.get('kind') in ('BUG', 'UNTESTED') else ''}".strip()
        tally[key] += 1
        if sk:
            tally['skeptic ' + ('REFUTED' if sk.get('refuted') else 'agreed=' + sk.get('agreedSeverity', '?'))] += 1
(EV / 'verdicts.tsv').write_text('\n'.join(rows) + '\n', encoding='utf-8', newline='\n')
print('groups:', len(groups), '| missing reviews:', [g['group'] for g in groups if not g.get('review')])
for k, n in sorted(tally.items()):
    print(f'{n:4} {k}')
print('critic gaps:', len(data['critic']))
