"""Coordinator decisions after independent verification. Candidate files are evidence, not authority."""
from pathlib import Path
import json

base=Path('docs/audits')
deep=base/'2026-10-26-deep-dive/evidence'
i18n=base/'2026-10-26-i18n/evidence'
def get(p): return json.loads(p.read_text(encoding='utf8'))
rows=[]
sources=['packages','workers','root','web-services']
for name in sources: rows.extend(get(deep/f'candidates-{name}.json'))
# Components are appended only after their independent verification is saved.
decisions_path=deep/'component-decisions.json'
if decisions_path.exists():
    decisions=get(decisions_path)
    for r in get(deep/'candidates-web-components.json'):
        d=decisions[r['candidate_id']]
        if not d['confirmed']: continue
        r.update({k:v for k,v in d.items() if k!='confirmed'})
        rows.append(r)
counts={}
for r in rows:
    counts[r['kind']]=counts.get(r['kind'],0)+1
    r['id']=f"{r['kind']}-{counts[r['kind']]:03d}"
    r['status']='OPEN'
    c=r['candidate_id']
    if c=='workers-05': r['type']='Edge case'
    if c=='workers-06':
        r['supersedes']='2026-10-04-deep-dive/OPT-003'
        r['fix']='Deploy a capped approved-only batch-by-id API first, then switch the caller while preserving order, missing IDs and failures. Up to 49 fewer service-binding requests/query round trips per 50 favorites; not 49 fewer rows read. Coordinate the same implementation with security FINDING-024.'
    if c=='web-root-001': r['locations']=['apps/web-app/src/components/glamour-block.ts:337','apps/web-app/src/components/glamour-block.ts:803','apps/web-app/src/components/chara-file-card.ts:358']
    if c=='pkg-003':
        r['qualification']='Cosmetic malformed boundary: the web card displays labels; SVG strips lone surrogates. Web file-name slice at apps/web-app/src/services/chara-file-loader.ts:89 needs the same boundary rule in its separate consumer sprint.'
    if c=='workers-02': r['qualification']='Category SQL uses OR/EXISTS and does not double counts; this is a stored/UI invariant defect.'
    if c=='workers-07': r['qualification']='No KV mutation or permanent favorite deletion occurs.'
    if c=='workers-08': r['qualification']='The failed edit is logged; the incorrect success is command outcome accounting. An expired token may prevent recovery.'
    if c=='web-services-002': r['qualification']='Distinct from fixed 2026-09-16-deep-dive/BUG-026 (component guard), 2026-10-04-deep-dive/BUG-031 (list cache) and BUG-108 (failed-check count).'
    if c=='web-services-001':
        r['repro']=r['repro'].replace('while main cards support three OKLAB decimals','while the core metric vocabulary specifies three OKLAB decimals')
        r['qualification']='Current v4-result-card has a dedicated DeltaE2000 readout; this finding does not claim that readout is a native OKLAB distance. Core BAND_METHOD_DP and Gradient/Mixer metric views establish the native precision rule.'
(deep/'final-catalog.json').write_text(json.dumps({'snapshot':'6da3ff5b','findings':rows},ensure_ascii=False,indent=2)+'\n',encoding='utf8')
rows=get(i18n/'candidates-content.json')
counts={}
for r in rows:
    counts[r['kind']]=counts.get(r['kind'],0)+1
    r['id']=f"{r['kind']}-{counts[r['kind']]:03d}"
    r['status']='OPEN'
    r['test_gap']={
        'CONTENT-001':'Fatal rendering tests supply arbitrary details, not all localized startup sentences.',
        'CONTENT-002':'Description gates and selected choice tests omit these three choice families.',
        'CONTENT-003':'Structural and same-English parity gates do not enforce this five-key term rule.',
        'CONTENT-004':'Existing fixtures repeat the stale six-type subtitle instead of deriving the supported count.',
        'CONTENT-005':'Coverage/face-presence tests do not assert regional load order with actual rendered glyphs.',
        'CONTENT-006':'Existing helper tests pin English canonical table labels, not localized display/search.'
    }[r['candidate_id']]
    if r['candidate_id']=='CONTENT-006':
        r['tier']='P1'
        r['qualification']='P1 follows the skill rule for live hardcoded UI. The optional preference has no command consumer today; that limits practical urgency but not reachability.'
    if r['candidate_id']=='CONTENT-004':
        r['tier']='P1'
        r['qualification']='Wrong factual text is P1. This subtitle is shown only in the default Discord frame; the X frame omits the deck.'
        r['fix']+=' Bump the OG cache version so existing cached cards receive the corrected copy.'
    if r['candidate_id']=='CONTENT-002':
        r['qualification']='Primary owner is Discord command metadata; new order/sort locale keys are authored and published in bot-logic before the consumer deploy. Preserve canonical option values.'
rows.sort(key=lambda r:(r['tier'],r['id']))
(i18n/'final-catalog.json').write_text(json.dumps({'snapshot':'6da3ff5b','findings':rows},ensure_ascii=False,indent=2)+'\n',encoding='utf8')
