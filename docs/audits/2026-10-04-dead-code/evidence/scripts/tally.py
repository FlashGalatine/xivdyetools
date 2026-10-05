"""Parse the review/verify workflow result (evidence/workflow-result-raw.txt), write
evidence/workflow-result.json (the `result` object only) and evidence/verdicts.tsv (one row per
verdict), and print a per-group tally.

workflow-result-raw.txt was the workflow's task-output file, copied in once and deleted after this
script ran; workflow-result.json is the kept copy of its `result` object."""
import json
import pathlib

EV = pathlib.Path('docs/audits/2026-10-04-dead-code/evidence')
raw = json.loads((EV / 'workflow-result-raw.txt').read_text(encoding='utf-8'))
data = raw['result']
(EV / 'workflow-result.json').write_text(json.dumps(data, indent=1, ensure_ascii=False), encoding='utf-8', newline='\n')
groups = data.get('round1', []) + data.get('round2', [])
cols = ['group', 'cand', 'verdict', 'unit', 'file', 'line', 'symbol', 'category', 'confidence', 'blast', 'semver',
        'origin', 'rec', 'srcLines', 'testLines', 'title', 'reason']
rows = ['\t'.join(cols)]
tot_c = tot_r = 0
for g in groups:
    v = g.get('verdicts', [])
    c = [x for x in v if x.get('verdict') == 'CONFIRMED']
    tot_c += len(c); tot_r += len(v) - len(c)
    print(f"{g['group']:22} cands={len((g.get('review') or {}).get('candidates', [])):3} confirmed={len(c):3} rejected={len(v) - len(c):3}")
    for x in v:
        rows.append('\t'.join(str({**x, 'group': g['group']}.get(k, '')).replace('\t', ' ').replace('\n', ' ') for k in cols))
(EV / 'verdicts.tsv').write_text('\n'.join(rows) + '\n', encoding='utf-8', newline='\n')
print(f'TOTAL confirmed={tot_c} rejected={tot_r}; critic gaps={len(data.get("critic", []))}')
