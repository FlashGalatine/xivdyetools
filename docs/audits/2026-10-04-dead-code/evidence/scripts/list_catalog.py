import json
import pathlib

c = json.loads(pathlib.Path('docs/audits/2026-10-04-dead-code/evidence/catalog.json').read_text(encoding='utf-8'))
for r in c:
    print('|'.join(str(r[k]) for k in ('id', 'unit', 'conf', 'blast', 'semver', 'origin', 'rec', 'src', 'test', 'category')))
