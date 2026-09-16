"""Validate audit artifact structure, arithmetic, links, and unchanged tracked source."""
from pathlib import Path
import json, re, subprocess
root=Path.cwd()
out=root/'docs/audits/2026-09-15-dead-code'
expected={f'DEAD-{i:03}' for i in range(1,22)}
report=(out/'DEAD_CODE_REPORT.md').read_text(encoding='utf-8-sig')
plan=(out/'CLEANUP_PLAN.md').read_text(encoding='utf-8-sig')
catalog=report.split('## Catalog\n')[1].split('## Quick wins')[0]
catalog_ids=re.findall(r'\[(DEAD-\d{3})\]',catalog)
assert set(catalog_ids)==expected and len(catalog_ids)==21
assigned=re.findall(r'^\| (DEAD-\d{3}) \|',plan,re.M)
assert set(assigned)==expected and len(assigned)==21,assigned
findings=sorted((out/'findings').glob('DEAD-*.md'))
assert {p.stem for p in findings}==expected
problems=[]
for p in out.rglob('*.md'):
    text=p.read_text(encoding='utf-8-sig')
    if '\ufffd' in text:problems.append(f'replacement character: {p}')
    if p.parent.name=='findings' and len(text.splitlines())>25:problems.append(f'long finding: {p}')
    for target in re.findall(r'\]\(([^)]+)\)',text):
        if re.match(r'^[a-z]+://',target) or target.startswith('#'):continue
        target=target.split('#')[0].split(' "')[0]
        if target and not (p.parent/target).exists():problems.append(f'broken link: {p}: {target}')
assert not problems,problems
spans=json.loads((out/'evidence/test-removal-spans.json').read_text())
assert sum(s['lines'] for s in spans)==527
for s in spans:
    lines=(root/s['file']).read_text(encoding='utf-8').splitlines()
    assert len(lines)>=s['end']
    assert s['label'] in lines[s['line']-1]
results=json.loads((out/'evidence/collection-final-results.json').read_text(encoding='utf-8-sig'))
assert len(results)==15 and all(r['exit']==0 for r in results)
initial=json.loads((out/'evidence/collection-results.json').read_text(encoding='utf-8-sig'))
assert next(r for r in initial if r['id']=='baseline-turbo')['exit']==0
assert all('exec ' in r['command'] or ' run ' in r['command'] or 'dead-code:check' in r['command'] for r in initial)
assert subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()=='0332fcc5768a4477301ed5b15590eee16a772f87'
assert subprocess.check_output(['git','diff','--name-only'],text=True).strip()==''
assert subprocess.check_output(['git','diff','--cached','--name-only'],text=True).strip()==''
subprocess.run(['git','diff','--check'],check=True)
status=subprocess.check_output(['git','status','--porcelain=v1'],text=True)
allowed={'?? docs/audits/2026-09-15-dead-code/','?? docs/audits/2026-09-15-security/'}
assert set(status.splitlines())<=allowed,status
summary={'result':'PASS','snapshot':'0332fcc5768a4477301ed5b15590eee16a772f87','catalog_entries':21,'cleanup_candidates':17,'keep':4,'finding_files':len(findings),'local_markdown_links':'valid','source_candidate_lines':197,'dedicated_test_lines':527,'final_commands_passed':15,'tracked_worktree_diff':'empty','untracked_status':status.splitlines()}
(out/'evidence/artifact-validation.json').write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8')
print(json.dumps(summary))
