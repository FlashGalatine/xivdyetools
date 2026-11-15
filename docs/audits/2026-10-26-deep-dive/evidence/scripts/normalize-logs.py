"""Normalize saved diagnostic text for Git review; preserve lines/content, remove terminal decoration."""
from pathlib import Path
import re
changed=[]
for folder in ['2026-10-26-deep-dive','2026-10-26-i18n']:
    for p in (Path('docs/audits')/folder).rglob('*.txt'):
        data=p.read_bytes()
        text=data.decode('utf-16') if data.startswith((b'\xff\xfe',b'\xfe\xff')) else data.decode('utf-8-sig')
        text=re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]','',text)
        normalized='\n'.join(line.rstrip() for line in text.splitlines()).rstrip()+'\n'
        if data != normalized.encode('utf8'):
            p.write_bytes(normalized.encode('utf8')); changed.append(str(p))
print(f'Normalized {len(changed)} text artifacts to UTF-8/LF without ANSI or trailing whitespace.')
