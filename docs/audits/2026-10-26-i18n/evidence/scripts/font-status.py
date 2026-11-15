"""Compare runtime-table codepoints against each bundled font; no font files changed."""
import json
from pathlib import Path
from fontTools.ttLib import TTFont
out=Path('docs/audits/2026-10-26-i18n/evidence')
inputs=json.loads((out/'font-input-codepoints.json').read_text())
def cjk(cp):
    return any(a<=cp<=b for a,b in [(0x3000,0x30ff),(0x3400,0x4dbf),(0x4e00,0x9fff),(0xf900,0xfaff),(0xac00,0xd7af)])
rows=[]; unions=[]
for unit, langs in inputs.items():
    fontdir=Path('apps')/unit/'src/fonts'
    all_needed=set().union(*map(set,langs.values()))
    cmaps={}
    for path in fontdir.glob('*.ttf'):
        with TTFont(path) as font: cmaps[path.name]=set(font.getBestCmap())
    union=set().union(*cmaps.values())
    for lang, points in langs.items():
        needed=set(points)
        unions.append(dict(unit=unit,locale=lang,needed=len(needed),covered=len(needed&union),missing=sorted(needed-union)))
    for family,lang in [('JP','ja'),('SC','zh'),('KR','ko')]:
        name=f'NotoSans{family}-Subset.ttf'; cmap=cmaps[name]
        needed={cp for cp in langs[lang] if cjk(cp)}
        if family=='KR': needed={cp for cp in needed if 0xac00<=cp<=0xd7af}
        rows.append(dict(unit=unit,font=name,locale=lang,bytes=(fontdir/name).stat().st_size,needed=len(needed),covered=len(needed&cmap),missing=sorted(needed-cmap),stale=len({cp for cp in cmap if cjk(cp)}-all_needed)))
(out/'font-status.json').write_text(json.dumps(dict(fonts=rows,union=unions),indent=2)+'\n')
for r in rows: print(f"{r['unit']} {r['font']}: needed={r['needed']} covered={r['covered']} missing={len(r['missing'])} stale={r['stale']} bytes={r['bytes']}")
print('Union missing:',sum(len(r['missing']) for r in unions))
