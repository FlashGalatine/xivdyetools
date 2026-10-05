"""Write findings/{BUG,REFACTOR,OPT}-NNN.md from the verified deep-dive result (evidence/workflow-result.json).

Verifier returns are the source of every field; the independent skeptic's severity, where one ran,
overrides the verifier's (it is the second opinion). CLUSTERS merges the same defect found from
several slices into one finding; everything else is one finding per confirmed verdict. IDs are
assigned by kind, then final severity, then deploy unit and file. Re-runnable.
"""
import json
import pathlib
import re

OUT = pathlib.Path('docs/audits/2026-10-04-deep-dive')
data = json.loads((OUT / 'evidence/workflow-result.json').read_text(encoding='utf-8'))
V, CLAIM, SEEN_GROUP = {}, {}, {}
for g in data['round1'] + data['round2']:
    for c in (g.get('review') or {}).get('candidates', []):
        CLAIM[c['cand']] = c
    for v in g['verdicts']:
        V[v['cand']] = v
        SEEN_GROUP[v['cand']] = g['group']

M, R = 'merge', 'reconfirm'
# primary -> (extras, overrides). Overrides: title, severity, unit, otherUnits.
CLUSTERS = {
    'contract-revision-binding-01': ([('discord-handlers-01', R), ('gap7-01', R), ('presets-handlers-02', R), ('presets-core-01', R), ('discord-core-01', R)],
                                     {'severity': 'MEDIUM', 'otherUnits': 'apps/presets-api',
                                      'title': 'A preset submitted or edited through the bot is posted twice: discord-worker\'s own moderation/submission-log post (legacy button ids) plus the presets-api webhook\'s revision-bound post'}),
    'discord-handlers-02': ([('gap3-01', R), ('gap7-04', R), ('discord-core-05', R)],
                            {'severity': 'MEDIUM', 'title': 'discord-worker\'s preset webhook (index.ts:402-407) hard-codes kind \'new\', so a flagged edit is posted as "New preset pending" with no diff and no Revert button'}),
    'oauth-01': ([('gap7-06', R)], {}),
    'oauth-02': ([('gap7-07', R)], {}),
    'webapp-tools-a2-03': ([('gap1-01', M)], {'severity': 'MEDIUM',
                           'title': 'Gradient, Swatch, Mixer and Budget never seed dyeFiltersConfig from the persisted config at mount, so saved dye filters are ignored until the sidebar is touched'}),
    'gap1-02': ([('webapp-tools-a1-13', M), ('gap6-02', M)], {'severity': 'MEDIUM',
                'title': 'No tool test mounts against a non-default persisted config or asserts that dye filters reach matching (the swatch case is not.toThrow only)'}),
    'gap7-08': ([('webapp-v4-presets-01', M), ('webapp-v4-presets-02', M), ('webapp-services-04', M)], {'severity': 'MEDIUM',
                'title': 'preset-tool reconcileTombstones marks saved community presets "Removed by its author" in three live cases: a swallowed API failure, a saved local- palette, and a stale filtered response'}),
    'webapp-tools-a2-01': ([('webapp-tools-a2-02', M), ('webapp-tools-b-01', M), ('webapp-tools-b-02', M)], {'severity': 'MEDIUM',
                           'title': 'A language switch empties or hides the results of the Harmony, Mixer, Comparison and Accessibility tools (update() rebuilds the panels without regenerating them)'}),
    'gap6-01': ([('webapp-tools-b-14', M)], {'title': 'No tool test invokes the LanguageService.subscribe callback, so the language-switch rebuild that empties four tools (see the MEDIUM finding) is untested'}),
    'webapp-glamour-01': ([('core-chara-01', R), ('gap7-09', R)], {'otherUnits': 'packages/core (fix in web-app needs no publish)'}),
    'webapp-tools-a2-08': ([('webapp-tools-a2-09', M)], {'severity': 'MEDIUM',
                           'title': 'A stale preserved ?dye= deep link overrides the user\'s later choice in Budget (Set as budget target) and Harmony (base-dye pick)'}),
    'discord-core-04': ([('gap7-03', R)], {}),
    'discord-core-07': ([('gap7-05', R)], {}),
    'discord-core-03': ([('gap7-02', R)], {}),
}
ABSORBED = {e for ex, _ in CLUSTERS.values() for e, _k in ex}

def finish(text):
    for cand, did in sorted(ID_OF_GLOBAL.items(), key=lambda kv: -len(kv[0])):
        text = re.sub(r'(?<![\w-])' + re.escape(cand) + r'(?![\w-])', did, text)
    for rx, rep in POST:
        text = rx.sub(rep, text)
    return text


ID_OF_GLOBAL = {}
SEV_RANK = {'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3, 'N/A': 4, '': 4}
REPL = [(re.compile(r'\bcand-[\w-]+'), '')]


# Agent text cites IDs from EARLIER audits (and code comments citing them); this catalog's own IDs are
# only inserted later, by the candidate-id mapping. Qualify every raw reference so none collides.
OLD_DATED = re.compile(r'(2026-\d\d-\d\d)[ -]deep-dive (BUG|REFACTOR|OPT)-(\d{3})')
OLD_RAW = re.compile(r'(?<![/\w-])(BUG|REFACTOR|OPT)-(\d{3})\b')
EARLIER_DEAD = re.compile(r'the earlier DEAD-(\d{3})')
DEAD_RAW = re.compile(r'(?<![/\w-])DEAD-(\d{3})\b')
SHORT = re.compile(r'(?<![\w-])(a1|a2)-(\d\d)\b')


def clean(s):
    s = (s or '').replace('\ufffd', '—').strip()
    s = OLD_DATED.sub(r'\1-deep-dive/\2-\3', s)
    s = OLD_RAW.sub(r'earlier-audit \1-\2', s)
    s = EARLIER_DEAD.sub(r'the 2026-08-18 dead-code audit DEAD-\1', s)
    s = DEAD_RAW.sub(r'2026-10-04-dead-code/DEAD-\1', s)
    s = s.replace('the 2026-08-18 dead-code audit 2026-10-04-dead-code/DEAD-', '2026-08-18-discord-worker-dead-code/DEAD-')
    s = re.sub(r'(?<![/\w-])pre-OPT-(\d{3})', r'pre-(earlier-audit OPT-\1)', s)
    return SHORT.sub(r'webapp-tools-\1-\2', s)


SUPERSEDES = {'webapp-v4-shell-03': '2026-09-02-deep-dive/BUG-066 (scheduled in that plan, never fixed)'}
POST = [
    (re.compile(r'Note for the coordinator: this is an exact re-file of 2026-09-02-deep-dive/BUG-066 \(webapp-v4-04, MEDIUM, same file:line, same claim\)\.'),
     'Carried over: this is the same defect as 2026-09-02-deep-dive/BUG-066 (same file:line, same claim).'),
    (re.compile(r'\s*The finding should be filed as a carried-over open finding, not a new discovery\.'), ''),
    (re.compile(r'fix the api-worker-05 comment'), 'fix the stale comment'),
    (re.compile(r'A separate issue worth its own candidate:'), 'A separate issue, not filed here:'),
    (re.compile(r"Candidate's 'stale tab' repro is wrong"), "The originally suggested 'stale tab' repro is wrong"),
    (re.compile(r'so the candidate is not superseded'), 'so this finding is not superseded'),
    (re.compile(r'(BUG-0(?:21|22)) \(HIGH\)'), r'\1'),
    (re.compile(r'(BUG-0(?:21|22)) \(HIGH, '), r'\1 ('),
    # after the (HIGH) tags are gone:
    (re.compile(r'of three BUG candidates already filed: BUG-021, BUG-021 and tools-b-01 \(MEDIUM\)'),
     'of the language-switch defect already filed as BUG-021 (which covers all four tools)'),
    (re.compile(r'BUG-021/BUG-021/tools-b-01'), 'BUG-021'),
    (re.compile(r'consistent with peer UNTESTED MEDIUMs \(webapp-components-02, BUG-127\)'), 'consistent with BUG-011, the other untested-behaviour MEDIUM'),
    (re.compile(r'Defects -01 and -02'), 'BUG-009 and BUG-062'),
    (re.compile(r'which is why -01 and -02 ship green'), 'which is why BUG-009 and BUG-062 ship green'),
    (re.compile(r'BUG-078 \(MEDIUM, '), 'BUG-078 ('),
    (re.compile(r'(?<![/\w.-])REMEDIATION_PLAN\.md:268,271'), 'docs/audits/2026-10-03-security/REMEDIATION_PLAN.md:268,271'),
    (re.compile(r'Pair with -01\.'), 'Pair with BUG-004.'),
    (re.compile(r'Have presets-api add an edit flag plus the pre-edit snapshot \(previous_values\) to the submission payload'),
     'Have presets-api add an edit flag to the submission payload (previous_values is already sent)'),
    # BUG-034 (Codex review on #237): a null-only fall-through misses '013114', which parses as a real
    # legacy item id (Pure White), so the six-digit case has to be decided before the id lookup.
    (re.compile(r'In the bare-number branch, when parseDyeIdInput returns null and the input is 6 digits \(isValidHex\), fall through to the hex branch\.'),
     "Treat every bare all-digit input of exactly six characters as hex, ahead of the bare-number branch, so only 1-5 digit "
     "inputs are read as ids. A null-only fall-through is not enough: '013114' parses as a real legacy item id (Pure White). "
     "Add regression tests for '000000', '123456' and '013114'."),
]


def unit_of(v):
    u = clean(v.get('unit'))
    f = v.get('file', '')
    parts = f.split('/')
    if parts[0] in ('apps', 'packages') and len(parts) > 2:
        return '/'.join(parts[:2])
    if u.startswith(('apps/', 'packages/')):
        return '/'.join(u.split('/')[:2])
    return 'root (CI/scripts)'


def final_sev(v):
    sk = v.get('skeptic') or {}
    if sk and not sk.get('refuted') and sk.get('agreedSeverity') in SEV_RANK:
        return sk['agreedSeverity']
    return v.get('severity') or 'N/A'


rows = []
for cand, v in V.items():
    if v['verdict'] != 'CONFIRMED' or cand in ABSORBED:
        continue
    extras, ov = CLUSTERS.get(cand, ([], {}))
    kind = v.get('kind') or CLAIM.get(cand, {}).get('kind')
    prefix = 'BUG' if kind in ('BUG', 'UNTESTED') else kind
    sev = ov.get('severity') or (final_sev(v) if prefix == 'BUG' else (v.get('priority') if prefix == 'REFACTOR' else v.get('impact')))
    title = clean(ov.get('title') or v.get('title') or CLAIM.get(cand, {}).get('claim'))
    rows.append(dict(cand=cand, v=v, prefix=prefix, kind=kind, sev=sev or 'N/A', title=title, unit=unit_of(v),
                     extras=extras, ov=ov))

order = {'BUG': 0, 'REFACTOR': 1, 'OPT': 2}
rows.sort(key=lambda r: (order[r['prefix']], SEV_RANK.get(r['sev'], 4), r['unit'], r['v'].get('file', ''), r['v'].get('line') or 0))
counters = {'BUG': 0, 'REFACTOR': 0, 'OPT': 0}
for r in rows:
    counters[r['prefix']] += 1
    r['id'] = f"{r['prefix']}-{counters[r['prefix']]:03d}"
ID_OF = {r['cand']: r['id'] for r in rows}
ID_OF_GLOBAL.update(ID_OF)
for r in rows:
    for e, _k in r['extras']:
        ID_OF[e] = r['id']
ID_OF_GLOBAL.update(ID_OF)

fdir = OUT / 'findings'
fdir.mkdir(exist_ok=True)
for p in fdir.glob('*.md'):
    p.unlink()
catalog = []
for r in rows:
    v, ov = r['v'], r['ov']
    merged = [V[e] for e, k in r['extras'] if k == M]
    recon = [V[e] for e, k in r['extras'] if k == R]
    if r['prefix'] == 'BUG':
        head = (f"**Severity:** {r['sev']} · **Type:** {'Untested behavior' if r['kind'] == 'UNTESTED' else clean(v.get('bugType')) or 'Logic'} · "
                f"**Deploy unit:** {r['unit']} · **Covered by test?** {v.get('tested') or 'no'} · **Origin:** {clean(v.get('origin')) or 'MAIN'}")
    elif r['prefix'] == 'REFACTOR':
        head = (f"**Priority:** {v.get('priority') or 'LOW'} · **Effort:** {v.get('effort') or 'N/A'} · **Risk:** {v.get('risk') or 'N/A'} · "
                f"**Deploy unit:** {r['unit']} · **Origin:** {clean(v.get('origin')) or 'MAIN'}")
    else:
        head = (f"**Impact:** {v.get('impact') or 'LOW'} · **Category:** {v.get('optCategory') or 'N/A'} · **Deploy unit:** {r['unit']} · "
                f"**Expected gain:** {clean(v.get('expectedGain')) or 'n/a'} · **Benchmark:** {clean(v.get('benchmark')) or 'n/a'}")
    other = ov.get('otherUnits') or clean(v.get('otherUnits'))
    if other:
        head += f" · **Other units:** {other}"
    L = [f"# {r['id']}: {r['title']}", head]
    if r['cand'] in SUPERSEDES:
        L.append(f"**Supersedes:** {SUPERSEDES[r['cand']]}")
    L += ['', '## Location']
    for x in [v] + merged + recon:
        L.append(f"- `{x.get('file')}:{x.get('line')}`" + (f" — {clean(x.get('title'))}" if x is not v and x.get('title') else ''))
    L += ['', '## Evidence']
    for x in [v] + merged:
        if x.get('repro'):
            L.append(f"- Reproduction: {clean(x['repro'])}")
        L.append(f"- {clean(x['reason'])}")
        if x.get('evidence'):
            L.append('  - Checked: ' + clean(x['evidence']).replace('\n', '; '))
        sk = x.get('skeptic') or {}
        if sk:
            L.append(f"- Second, independent check ({'refuted' if sk.get('refuted') else 'severity ' + str(sk.get('agreedSeverity'))}): {clean(sk.get('reason'))}")
    for x in recon:
        L.append(f"- Found independently from another slice: {clean(x.get('reason'))}")
    L.append(f"- Origin: {clean(v.get('originEvidence')) or clean(v.get('origin'))}")
    L += ['', '## Fix']
    for x in [v] + merged:
        if x.get('fix'):
            L.append(f"- {clean(x['fix'])}")
    L += ['', '## Status', 'OPEN', '']
    text = '\n'.join(L)
    for cand, did in sorted(ID_OF.items(), key=lambda kv: -len(kv[0])):
        text = re.sub(r'(?<![\w-])' + re.escape(cand) + r'(?![\w-])', did, text)
    text = finish(text)
    (fdir / f"{r['id']}.md").write_text(text, encoding='utf-8', newline='\n')
    catalog.append(dict(id=r['id'], title=finish(r['title']), prefix=r['prefix'], kind=r['kind'], sev=r['sev'],
                        bugType=('Untested behavior' if r['kind'] == 'UNTESTED' else clean(v.get('bugType'))),
                        unit=r['unit'], other=finish(other or ''), origin=clean(v.get('origin')) or 'MAIN', tested=v.get('tested'),
                        effort=v.get('effort'), category=v.get('optCategory'), cands=[r['cand']] + [e for e, _ in r['extras']],
                        fix=finish(clean(v.get('fix')))))
(OUT / 'evidence/catalog.json').write_text(json.dumps(catalog, indent=1, ensure_ascii=False), encoding='utf-8', newline='\n')
(OUT / 'evidence/id-map.json').write_text(json.dumps(ID_OF, indent=1), encoding='utf-8', newline='\n')
by = {}
for c in catalog:
    k = c['prefix'] + ' ' + (c['sev'] if c['prefix'] == 'BUG' else '')
    by[k] = by.get(k, 0) + 1
print(len(catalog), 'findings:', dict(sorted(by.items())))
print('PR-origin:', [(c['id'], c['origin']) for c in catalog if c['origin'] != 'MAIN'])
