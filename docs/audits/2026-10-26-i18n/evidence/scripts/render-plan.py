"""Coordinator-authored merged scheduling, independently verified; run from repo root."""
from pathlib import Path
import json,re
BASE=Path('docs/audits'); OUT=BASE/'2026-10-26-i18n'
S='2026-10-26-security'; D='2026-10-26-xivcharakit-dead-code'; B='2026-10-26-deep-dive'; I='2026-10-26-i18n'
catalog={}
for folder in [S,D,B,I]:
    for r in json.loads((BASE/folder/'evidence/final-catalog.json').read_text(encoding='utf8'))['findings']:
        catalog[f'{folder}/{r["id"]}']={**r,'source':folder}
def q(label):
    if re.fullmatch(r'S\d+',label): return f'{S}/FINDING-{int(label[1:]):03d}'
    if re.fullmatch(r'D\d+',label): return f'{D}/DEAD-{int(label[1:]):03d}'
    return f'{I if label.startswith(("HC-","I18N-","TERM-","FONT-")) else B}/{label}'
def link(id):
    folder,short=id.split('/')
    prefix='' if folder==I else f'../{folder}/'
    return f'[{id}]({prefix}findings/{short}.md)'
def esc(s): return re.sub(r'(?<!\\)\|', r'\\|', str(s)).replace('\n',' ')
def load_actions(folder, filename, sprint_names):
    result={}
    for line in (BASE/folder/filename).read_text(encoding='utf8').splitlines():
        m=re.match(r'^\| \[((?:FINDING|DEAD)-\d+)\]\(findings/[^)]+\) \| [^|]+ \| ([^|]+) \| (.*) \|$',line)
        if not m: continue
        action=m[3]
        action=re.sub(r'Sprint (\d+)',lambda x:sprint_names.get(int(x[1]),x[0]),action)
        action=re.sub(r'\*\(decision \d+\)\*','(existing decision gate)',action)
        action=re.sub(r'\[([^\]]+)\]\(findings/([^)]*)\)',lambda x:f'[{folder}/{x[1]}](../{folder}/findings/{x[2]})',action)
        result[f'{folder}/{m[1]}']=(m[2],action)
    return result
actions=load_actions(S,'REMEDIATION_PLAN.md',{0:'operations gates',1:'A-WORKER-KIT',2:'A-BOT-LOGIC',3:'A-PRESETS',4:'A-MODERATION',5:'A-DISCORD',6:'A-OAUTH',7:'A-API',8:'A-WEB',12:'A-CORE and A-SVG'})
actions.update(load_actions(D,'CLEANUP_PLAN.md',{2:'A-DISCORD',4:'A-CORE',5:'A-BOT-LOGIC',6:'M-CORE',7:'M-BOT-LOGIC'}))
grade, action=actions[q('S9')]
actions[q('S9')]=(grade, action.replace('in A-WEB','in R-CI'))
grade, _=actions[q('S24')]
actions[q('S24')]=(grade,'After A-PRESETS deploys its capped approved-only batch lookup, switch favorite listing to that endpoint; preserve favorite order, distinguish missing from failed results, and pass acting-user rate-limit context. Assert one binding request for a 50-entry list and handle delivery/partial failures. This one implementation also satisfies the deduplicated optimization.')
specs=[
('OPS-API-DEV','Cloudflare stale dev worker','S054'),
('OPS-ZONE','Cloudflare zone transport settings','S055'),
('OPS-RETIRED','Retired Cloudflare resources','S056'),
('OPS-PAGES-HISTORY','Web Pages history and aliases','S009'),
('OPS-REPO-SECRETS','GitHub repository secret scope','S028'),
('OPS-SECRET-SCANNING','GitHub scanning settings','S050'),
('OPS-BRANCH-PROTECTION','GitHub branch protection','S051'),
('OPS-XIVCHARAKIT-PROVENANCE','XIVCharaKit release provenance','S052'),
('DECISION-UPSTREAM-MERGE','Upstream identity-merge decision','S008'),
('A-WORKER-KIT','packages/worker-kit','S004 S017'),
('A-CORE','packages/core','D002 D003 D020 D021 BUG-003'),
('A-SVG','packages/svg',''),
('A-BOT-LOGIC','packages/bot-logic','S014 S021 D005 D015 D016 D017 D022 BUG-001 BUG-002 BUG-004'),
('A-API','apps/api-worker','S002 S005 S029 S038 D004 D018 D019'),
('A-PRESETS','apps/presets-api','S015 S016 S018 S019 S037 BUG-005 BUG-006 BUG-007 BUG-008'),
('A-OAUTH','apps/oauth','S023 S032 S036'),
('A-MODERATION','apps/moderation-worker','S001 S025'),
('A-DISCORD','apps/discord-worker','S022 S024 S039 S040 D014 BUG-009 BUG-010 BUG-011 HC-002 I18N-001'),
('A-WEB','apps/web-app','S003 S006 S007 S010 S011 S012 S013 S026 S027 S033 S034 S041 S045 S048 D001 D006 D007 D008 D009 D010 D011 D012 D013 '+ ' '.join(f'BUG-{n:03d}' for n in range(12,24))+' HC-001 TERM-001'),
('A-OG-COPY','apps/og-worker','I18N-002'),
('A-IMAGE','apps/image-worker','S020'),
('R-CI','repository tooling/workflows','S031 S049'),
('R-DOCS-DECISIONS','repository docs/process','S030 S035 S046 S053'),
('H-LOGGER','packages/logger','S044 S047'),
('H-AUTH','packages/auth','S042'),
('M-CORE','packages/core','D024'),
('M-BOT-LOGIC','packages/bot-logic','D023'),
('F-OG','apps/og-worker','FONT-001')]
notes={
'A-WORKER-KIT':'Publish an additive MINOR. API, presets-api and oauth opt into IPv6 keying; Discord adopts the glamour tier in their separate releases.',
'A-CORE':'Publish the deprecation MINOR before any removal. Also harden the quadratic GPOSERS sink as a companion to the upstream-name finding assigned to A-API. Preserve exported names when relocating live limits/types; add the legacy API deprecation record.',
'A-SVG':'After A-CORE: harden quadratic fitText and adopt the new core release. This is a separate SVG publish; A-BOT-LOGIC and direct consumers follow it.',
'A-BOT-LOGIC':'After A-CORE and A-SVG. Publish one 4.x deprecation MINOR with correctness/sanitizer fixes, the legacy-oracle rewrite, and new six-language order/sort keys for A-DISCORD. Reuse existing slot labels. Deprecate the approved redundant result field without removing it yet.',
'A-API':'After A-WORKER-KIT/A-CORE/A-SVG as applicable. Adopt IPv6 keying and the updated core; combine upstream bounds with adjacent dead-code cleanup.',
'A-PRESETS':'After A-WORKER-KIT. Add the capped approved-only batch-by-id lookup before A-DISCORD switches favorite listing; preserve missing/failed outcomes and acting-user rate limits. Atomic quota admission can satisfy both distinct quota findings with separate assertions. Any linked-identity provider support selected here must deploy before A-MODERATION.',
'A-OAUTH':'After A-WORKER-KIT. Resolve the identity-link product decision first. If oauth is chosen as the linked-identity provider, ship that support before A-MODERATION.',
'A-MODERATION':'After A-PRESETS, A-BOT-LOGIC and the selected identity provider. Preserve the accepted decision to remove moderator names, with no policy AMEND for those removed names.',
'A-DISCORD':'After A-WORKER-KIT/A-BOT-LOGIC and the capped batch endpoint. Also remove moderator names from preview posts, apply the bot half of snapshot-policy correction, fix paired attachment comments, and correct beta-secret comments. Measure favorite requests at 1/10/50 entries: up to 49 fewer request/query round trips, not rows read. Command localization registration ships through the workflow.',
'A-WEB':'After required package publishes. Also apply the code-point-safe file-name cap paired with core labels. Keep persisted settings, result rendering, async modal ownership and cache generations consistent. All policy edits are six-file owner changes, behind unresolved decisions where listed.',
'A-OG-COPY':'After relevant core/SVG publication. Correct the default Discord-frame subtitle in all six authored tables; X omits this subtitle. Bump the OG cache version and run glyph/fit gates.',
'A-IMAGE':'One image-worker release; validate peak decode memory in the Worker runtime before treating the accounting change as complete.',
'R-CI':'One repository verification gate, not a package publish. Also add Pages deployment retention as the companion to the history cleanup, preserving current production/beta deployments.',
'R-DOCS-DECISIONS':'One repository documentation/process gate. Carry dated live-state evidence as inherited, not freshly rechecked. On actual Perspective key deletion, schedule separate presets-api behavior verification and web/Discord six-file ToS updates; do not publish those claims early. If query signing is chosen, add the explicit auth/presets/Discord/moderation compatibility sequence below.',
'H-LOGGER':'Publish hardening after ordinary correctness work. Its dependent package and app adoption sprints below are required; do not leave propagation as next deploy.',
'H-AUTH':'Publish canonical-encoding hardening. Run private test-utils verification, then release each auth consumer separately using the adoption table.',
'M-CORE':'Isolated core 6.0.0 after shipped/adopted deprecation MINOR, legacy-oracle rewrite and explicit beta acceptance. Remove legacy parser/resolver and parity [host] half; retain [library]. Preserve relocated live contracts. Optional KEEP removals require their own revisit decision.',
'M-BOT-LOGIC':'Isolated bot-logic 5.0.0 after M-CORE is published and M-SVG compatibility adoption is published. Remove the approved redundant character field. fileText/NO_INPUT/familySize optional removals remain KEEP until separately selected; the earlier Discord attachment cleanup is still required.',
'F-OG':'Terminal after all translated text and major adoption. Thread locale through OG renderer/font loader, select Chinese regional faces, and assert actual rendered glyph choice. Re-subset only if required cmap changed; bump OG cache version. F-DISCORD precedes this separate OG release.'}

def pkg_name(unit):
    return json.loads((Path(unit)/'package.json').read_text())['name']
def ends(unit):
    if unit.startswith(('apps/','packages/')):
        name=pkg_name(unit)
        gate=f'`pnpm turbo run build type-check lint test --filter=...{name}` and whole-graph gates before merge'
        if unit=='apps/web-app': gate+='; `pnpm --filter xivdyetools-web-app run build:check`'
        if unit.startswith('packages/'):
            if unit=='packages/test-utils': return gate+' → private verification gate; no npm publish.'
            return gate+' → version/CHANGELOG decision → merge → Actions **Publish Packages to npm** for `'+name+'`; verify registry before downstream adoption.'
        if unit=='apps/stoat-worker': return gate+' → parked-unit verification only; no activation or deployment.'
        suffix=unit.split('/')[1]
        return gate+f' → merge → `deploy-{suffix}.yml` (production); beta workflow only when explicitly selected.'
    if unit.startswith('repository'): return '`pnpm test:scripts`, `pnpm type-check:scripts`, `pnpm docs:check-links`, `pnpm docs:check-versions`, `pnpm workers:check-logs` as affected → repository verification gate; no unrelated application deploy.'
    return 'Explicit maintainer authorization at execution → narrowly scoped action/decision → read-only state verification recorded; no automatic action from this audit.'

scheduled=[]; keep=[]; superseded=[]
for name,unit,labels in specs:
    scheduled.extend({'id':q(label),'sprint':name,'unit':unit} for label in labels.split())
for n in range(25,48): keep.append({'id':q(f'D{n}'),'reason':'Preserve the existing KEEP verdict and revisit trigger.'})
superseded=[{'id':q('S43'),'by':q('D23'),'reason':'Approved result-field removal wins over the narrower field hardening; restore the security task if that approved major path is reversed.'},{'id':q('OPT-001'),'by':q('S24'),'reason':'Scheduling deduplication only: the same capped batch lookup/caller change has one implementation. Retain request-count and failure-semantic acceptance checks.'}]
all_assigned=[r['id'] for r in scheduled+keep+superseded]
assert len(all_assigned)==len(set(all_assigned))==len(catalog)==133
assert set(all_assigned)==set(catalog)
(OUT/'evidence/plan-assignments.json').write_text(json.dumps({'scheduled':scheduled,'keep':keep,'superseded':superseded},indent=2)+'\n',encoding='utf8')
lines=['# Merged Remediation Plan — 2026-10-26','',
'**Sources:** [Security](../2026-10-26-security/SECURITY_AUDIT_REPORT.md) 56 + [XIVCharaKit dead code](../2026-10-26-xivcharakit-dead-code/DEAD_CODE_REPORT.md) 47 + [deep dive](../2026-10-26-deep-dive/DEEP_DIVE_REPORT.md) 24 + [i18n](I18N_AUDIT_2026-10-26.md) 6.',
'**Status basis:** **133 IDs: 0 fixed, 108 scheduled, 23 KEEP, 2 superseded for scheduling, 0 requiring rotation.** All underlying new findings remain OPEN; no remediation has started. Each primary ID appears in exactly one assignment table. Companion package/adoption sprints have no duplicate primary-ID rows.',
'Grades retain their source meaning: security severity/exposure, dead-code confidence/blast/semver, deep-dive severity and scheduling tier, or i18n priority. HIGH confidence in a removal is not a HIGH-severity bug.',
'',
'This plan supersedes the scheduling in #333 and #334 while preserving their frozen catalogs. Their live-state checks are dated evidence and were not repeated here. The older `2026-10-04-deep-dive/OPT-003` is carried into the new optimization and is outside the 133-ID accounting.',
'',
'## Approval, decisions and ordering','',
'The maintainer already chose to remove moderator names, deprecate before the core 6 / bot-logic 5 major pair, drop the legacy parity `[host]` half and retain `[library]`. **Review first; nothing starts until a sprint is named.** This document does not authorize resource deletion, settings changes, upstream messages, publishing, deployment or a merge.',
'',
'No P0/emergency sprint is needed. Named sprints are independently reviewable units, not permission to run the whole list. Prioritize the P1 displayed-text fixes and MEDIUM correctness bugs, then contained bugs, cleanup and hardening. Package prerequisites precede their consumers. Structural major removals are isolated after correctness and beta acceptance; terminal font work is last. A package publish, app deployment and external-settings verification are separate units. Nondependent ordinary app sprints may be reordered to deliver the higher-priority fix first.',
'',
'Unresolved gates from #333 remain: per-record controls versus policy wording; CSP narrowing versus wording; tag/link moderation; failed-decode quota treatment; identity unlink/ban lookup behavior; signed-in browsing policy AMEND; button throttling versus a recorded trade-off; optional query signing. Resolve only the decisions needed for the named sprint. No default is chosen here.',
'',
'All version numbers are targets inherited from the accepted major path, not fresh registry assertions. Before execution, compare local and registry versions: fold into an unpublished version where valid; otherwise additive/deprecation MINOR, compatible fix PATCH, published API removal MAJOR. Stage only owned paths; never stash or switch the shared checkout. **Merging to main is the deploy.** No bare wrangler deployment from this plan.',
'',
'Each locale-owning release finalizes its text before checking/subsetting fonts. A missing drawable glyph blocks that release until its font update is ready; never ship a red glyph gate while waiting for the terminal phase. The final F-DISCORD/F-OG pass occurs only after the last rendered-text/item-name change.',
'']

for name,unit,labels in specs:
    if name in ['M-CORE','M-BOT-LOGIC','F-OG']: continue
    lines += [f'## Sprint {name} — {unit}','',notes.get(name,'Future maintainer-only action; recheck the dated evidence and exact target before acting.'),'']
    if labels:
        lines += ['| ID | Source | Sev/Pri | Action |','|---|---|---|---|']
        for label in labels.split():
            id=q(label);r=catalog[id]
            if id in actions: grade,action=actions[id]
            else:
                grade=r.get('tier',r.get('severity','LOW'))
                if grade in ['MEDIUM','LOW']: grade+=' / '+('P2' if r.get('kind')=='BUG' else 'P3')
                action=r['fix']
            lines.append(f'| {link(id)} | {r["source"]} | {esc(grade)} | {esc(action)} |')
    else: lines += ['Companion task only; its primary finding is assigned to A-API.']
    lines += ['',f'**Ends with:** {ends(unit)}','']

lines += ['## Required hardening adoption sprints','',
'Each row below is a **separate sprint** ending in the named unit publish/deploy/verification. Package adoption is explicit because packed dependency pins can otherwise retain old versions. Resolve compatible bump sizes against the actual published manifests at execution. The five context-as-error call-site corrections ride their owning apps, not the logger package sprint.','',
'| Sprint | Unit | Depends on / action | Ends with |','|---|---|---|---|']
hardening=[
('H-CORE-ADOPT','packages/core','H-LOGGER; update logger dependency/publish core 5.x'),
('H-WORKER-KIT-ADOPT','packages/worker-kit','H-LOGGER; update logger dependency/publish'),
('H-SVG-ADOPT','packages/svg','H-CORE-ADOPT; update core dependency/publish'),
('H-BOT-LOGIC-ADOPT','packages/bot-logic','H-CORE-ADOPT and H-SVG-ADOPT; update packed dependencies/publish 4.x'),
('H-TEST-UTILS','packages/test-utils','H-AUTH; verify the private auth consumer'),
('H-API','apps/api-worker','Adopt core + worker-kit and transitive logger'),
('H-PRESETS','apps/presets-api','Adopt auth + worker-kit/logger; correct context-as-error call sites'),
('H-OAUTH','apps/oauth','Adopt auth + worker-kit/logger'),
('H-IMAGE','apps/image-worker','Adopt worker-kit/logger'),
('H-OG','apps/og-worker','Adopt core + SVG + worker-kit/logger'),
('H-DISCORD','apps/discord-worker','Adopt auth + bot-logic + SVG + core + logger + worker-kit; correct context-as-error call sites'),
('H-MODERATION','apps/moderation-worker','Adopt auth + bot-logic + logger + worker-kit; correct context-as-error call sites'),
('H-WEB','apps/web-app','Adopt core + SVG + logger'),
('H-STOAT','apps/stoat-worker','Adopt bot-logic/logger, mirror sanitizer and correct context-as-error calls; keep parked')]
for name,unit,action in hardening: lines.append(f'| {name} | {unit} | {action}; wait for its upstream publishes | {ends(unit)} |')

lines += ['', '## Isolated major sequence','',
'Requires ordinary fixes/adoptions and shipped minor deprecations, eliminated legacy test oracle, Discord attachment preparation, and explicit beta acceptance. No KEEP item is automatically converted into a removal just because a major is opened.','']
for name,unit,labels in specs:
    if name not in ['M-CORE','M-BOT-LOGIC']: continue
    lines += [f'### Sprint {name} — {unit}','',notes[name],'','| ID | Source | Sev/Pri | Action |','|---|---|---|---|']
    for label in labels.split():
        id=q(label);r=catalog[id];grade,action=actions[id]
        lines.append(f'| {link(id)} | {r["source"]} | {esc(grade)} | {esc(action)} |')
    lines += ['',f'**Ends with:** {ends(unit)}','']
lines += ['M-SVG below occurs **between** M-CORE and M-BOT-LOGIC. Each other row is its own consumer release after the package versions are available; no deploy-everything step.','',
'| Sprint | Unit | Action | Ends with |','|---|---|---|---|']
major=[('M-SVG','packages/svg','Compatibility/adoption publish against core 6 before bot-logic 5'),('M-API','apps/api-worker','Adopt core 6; keep v1 HTTP compatibility'),('M-WEB','apps/web-app','Adopt core 6/SVG; preserve protocol/live-field contracts and bundle budget'),('M-OG','apps/og-worker','Adopt core 6/SVG and verify card generation'),('M-DISCORD','apps/discord-worker','Adopt core 6/SVG/bot-logic 5 and verify adapters'),('M-MODERATION','apps/moderation-worker','Adopt bot-logic 5 and verify moderation replies'),('M-STOAT','apps/stoat-worker','Adopt bot-logic 5 and verify parked adapter; no activation')]
for name,unit,action in major: lines.append(f'| {name} | {unit} | {action} | {ends(unit)} |')
lines += ['', 'oauth, presets-api and image-worker have hardening adoption releases above; no extra core-major deployment is required solely because unrelated consumers change.','',
'## Terminal font sprints','',
'### Sprint F-DISCORD — apps/discord-worker','',
'After all rendered locale/item-name changes and major adoption: regenerate subsets only where the required cmap changed, run actual regional-face/coverage/item-name tests, and compare missing/surplus codepoints. If no font change is needed, this is a verification-only gate; do not create an empty release. Otherwise keep its Discord release separate from OG. This is a companion task, with no extra catalog ID.','',f'**Ends with:** unchanged fonts → recorded coverage/face verification; changed fonts → {ends("apps/discord-worker")}','',
'### Sprint F-OG — apps/og-worker','',notes['F-OG'],'','| ID | Source | Sev/Pri | Action |','|---|---|---|---|']
r=catalog[q('FONT-001')]
lines += [f'| {link(q("FONT-001"))} | {I} | P3 | {r["fix"]} |','',f'**Ends with:** {ends("apps/og-worker")}','',
'## Superseded and deduplicated assignments','',
'| ID | Superseded by | Reason |','|---|---|---|']
for r in superseded: lines.append(f'| {link(r["id"])} | {link(r["by"])} | {r["reason"]} |')
lines += ['', '## KEEP register — unchanged','',
'All 23 original KEEP entries retain their full evidence/revisit conditions in the linked findings. The trigger is a review gate, not automatic permission to remove.','',
'| ID | Item | Reason / revisit trigger |','|---|---|---|']
for item in keep:
    r=catalog[item['id']]
    review_only={
        'DEAD-027':'Published fields: review at core 6 / bot-logic 5 planning and explicitly select or reject their removal. They remain KEEP until selected; an optional prior deprecation does not itself authorize removal.',
        'DEAD-028':'Published provider overload: at core 6 planning, re-grep every production caller and review the exact linked trigger; explicitly select narrowing only if the consumer condition still holds.',
        'DEAD-029':'Published barrel re-export: review at core 6 planning whether the subpath becomes the sole supported route. Keep unless that compatibility decision is explicitly selected.',
        'DEAD-030':'Published CHARA_WEAPON_SLOTS: review its consumers when core 6 planning opens; explicitly select any removal rather than automatically folding it into the major.',
        'DEAD-038':'Published fileText/NO_INPUT compatibility: review at bot-logic 5 planning. Making fileBytes required and removing compatibility paths needs an explicit selection; retain them until then.',
        'DEAD-039':'Published optional familySize: review at bot-logic 5 planning or a change to its public export/contract. Requiring it and removing the fallback needs an explicit selection; retain it until then.'
    }
    trigger=review_only.get(r['id'],r.get('trigger') or 'Recheck the full linked finding before changing its KEEP verdict.')
    lines.append(f'| {link(item["id"])} | {esc(r["title"])} | {esc(trigger)} |')
lines += ['', '## Standing verification and conditional follow-ups','',
'- Re-read each finding at the execution commit. Prefer a focused observable regression over broad test rewrites. Gate the affected unit and dependents (`--filter=...<unit>`), then the whole graph before merge; run `pnpm dead-code:check` after removals and web `build:check` after web/shared bundle changes.',
'- Package releases are Actions-only. Verify registry availability before a downstream publish/deploy. Keep one package or app per sprint even when dependencies require a coordinated sequence; do not push main or deploy from this audit.',
'- Policy corrections use all six variants, matching Last updated dates and policy parity; AMEND requires the existing explicit product decision and must not precede the described runtime behavior. The Perspective ToS follow-ups occur on actual key deletion, with the inherited before-2026-12-31 deadline rechecked then.',
'- If query signing is chosen, add separate auth publish, presets-api compatibility deploy, Discord signer deploy, moderation signer deploy and final presets-api transition. Recording the current path-only trade-off instead needs no invented code rollout.',
'- Use current role routing for collectors/workers/verifiers; keep approvals, commits, pushes and outward-facing prose with the coordinator. This plan received independent Sol/xhigh scheduling verification; no new security-critical verdict was made.',
'- Record completed sprints with date, commits, publication/deployment evidence and remaining consumer work. Keep failures/blocked glyph gates visible; never lower thresholds or silently skip a unit.',
'']
(OUT/'REMEDIATION_PLAN.md').write_text('\n'.join(lines),encoding='utf8')
print(f'{len(catalog)} IDs: {len(scheduled)} scheduled, {len(keep)} KEEP, {len(superseded)} superseded')
