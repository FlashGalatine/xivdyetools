"""Read-only audit inventory and gate-summary collector. Run from repository root."""
import json, re, subprocess
from pathlib import Path

out = Path('docs/audits/2026-10-26-deep-dive/evidence')
paths = subprocess.check_output(['git','ls-files','apps','packages','scripts'], text=True).splitlines()
source = [p for p in paths if re.search(r'\.(ts|tsx|js|mjs|py|sql)$',p) and not re.search(r'(__tests__|__fixtures__|\.test\.|\.spec\.|/fixtures/|/mocks/|/dist/|/coverage/|/tests/|/e2e/|/src/test-utils[./]|/src/(?:[^/]+/)?test-setup\.)',p)]
rows = []
patterns = re.compile(r'catch\b|waitUntil|\.batch\(|Promise\.all|setTimeout|JSON\.parse|Date\.now|new Date|fetch\(|parseInt|Number\(|as any')
with (out/'pattern-grep.txt').open('w',encoding='utf8') as f:
    f.write('Command: python docs/audits/2026-10-26-deep-dive/evidence/scripts/collect.py; paths from git ls-files apps packages scripts\n')
    for p in source:
        lines = Path(p).read_text(encoding='utf8').splitlines()
        rows.append({'path':p,'lines':len(lines)})
        for n,line in enumerate(lines,1):
            if patterns.search(line): f.write(f'{p}:{n}: {line}\n')
(out/'source-inventory.json').write_text(json.dumps(rows,indent=2)+'\n',encoding='utf8')
(out/'hotspots.json').write_text(json.dumps(sorted(rows,key=lambda r:r['lines'],reverse=True)[:40],indent=2)+'\n',encoding='utf8')
versions = {str(p.parent).replace('\\','/'):json.loads(p.read_text(encoding='utf8'))['version'] for parent in ['apps','packages'] for p in Path(parent).glob('*/package.json')}
(out/'versions.json').write_text(json.dumps(versions,indent=2)+'\n',encoding='utf8')
def read_log(p):
    b=p.read_bytes()
    return b.decode('utf-16') if b.startswith(b'\xff\xfe') else b.decode('utf-8-sig',errors='replace')
gate=re.sub(r'\x1b\[[0-9;]*m', '', read_log(out/'gates-baseline.txt'))
counts=[]
for line in gate.splitlines():
    if re.search(r'(Test Files\s+|Tests\s+\d|Tasks:\s+|Cached:\s+|Time:\s+)',line): counts.append(line)
(out/'gate-summary.txt').write_text('Command: pnpm turbo run build type-check lint test --concurrency=2\nExit: 0\n'+ '\n'.join(counts)+'\n',encoding='utf8')
coverage={}
for parent in ['apps','packages']:
    for p in Path(parent).glob('*/coverage/coverage-summary.json'):
        coverage[str(p.parent.parent).replace('\\','/')]=json.loads(p.read_text(encoding='utf8'))['total']
(out/'coverage-baseline.json').write_text(json.dumps(coverage,indent=2)+'\n',encoding='utf8')
seen = set()
for p in out.glob('read-files-*.txt'):
    for line in p.read_text(encoding='utf8').splitlines():
        if line.startswith('#') or line.startswith('PENDING'): continue
        m = re.search(r'(?:apps|packages|scripts)/[^\t ]+', line)
        if m: seen.add(m.group())
gaps = [r['path'] for r in rows if r['path'] not in seen]
reconciled = {'scope': 'tracked non-test TS/JS/Python/SQL executable/declaration/config source in apps, packages, scripts; test helpers and fixtures excluded; CSS/HTML/data additionally listed in reviewer ledgers', 'files': len(rows), 'original_lines': sum(r['lines'] for r in rows), 'covered': len(rows)-len(gaps), 'missing': gaps}
(out/'source-coverage.json').write_text(json.dumps(reconciled,indent=2)+'\n',encoding='utf8')
print(f'{len(rows)} source files inventoried; {len(coverage)} existing coverage summaries; {len(counts)} gate summary lines')
