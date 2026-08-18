import json,re,os,sys
from collections import Counter,defaultdict
ROOT='C:/dev/XIVProjects/xivdyetools'
SP=os.path.dirname(os.path.abspath(__file__))
LOC=f'{ROOT}/packages/bot-logic/src/i18n/locales'
langs=['en','ja','de','fr','ko','zh']
data={l:json.load(open(f'{LOC}/{l}.json',encoding='utf-8')) for l in langs}
def leaves(o,p=''):
    if isinstance(o,dict):
        for k,v in o.items():
            yield from leaves(v,f"{p}.{k}" if p else k)
    else:
        yield p,o
keys={l:dict(leaves(data[l])) for l in langs}
en=keys['en']
allkeys=set(en)
# key set parity
print("== key-set parity vs en")
for l in langs:
    if l=='en': continue
    missing=sorted(set(en)-set(keys[l])); extra=sorted(set(keys[l])-set(en))
    print(f"{l}: total={len(keys[l])} missing={len(missing)} extra={len(extra)}")
    for m in missing[:20]: print("   missing:",m)
    for m in extra[:20]: print("   extra:",m)
# consumer files
files=[x.strip() for x in open(f'{SP}/i18n-consumers.txt') if x.strip()]
# also include test files? Ground rule says tests count for TEST-ONLY. Track separately.
allcode=[x.strip() for x in open(f'{SP}/code.txt') if x.strip()]
testfiles=[f for f in allcode if f.endswith('.test.ts') and re.match(r'(apps/discord-worker|apps/stoat-worker|packages/bot-logic)/',f)]
def read(f):
    try: return open(f'{ROOT}/{f}',encoding='utf-8').read()
    except Exception as e: return ''
src={f:read(f) for f in files}
tsrc={f:read(f) for f in testfiles}
# 1. literal references: 'key' "key" `key`
lit_re=re.compile(r"""['"`]([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+)['"`]""")
literals=defaultdict(set)
for f,s in src.items():
    for m in lit_re.finditer(s):
        literals[m.group(1)].add(f)
tliterals=defaultdict(set)
for f,s in tsrc.items():
    for m in lit_re.finditer(s):
        tliterals[m.group(1)].add(f)
# 2. template prefixes: `prefix.${...}` inside backticks
tpl_re=re.compile(r"`([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)*\.)\$\{[^`]*`")
prefixes=defaultdict(set)
for f,s in src.items():
    for m in tpl_re.finditer(s):
        prefixes[m.group(1)].add(f)
# also string concat: 'prefix.' + x
cat_re=re.compile(r"""['"]([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)*\.)['"]\s*\+""")
for f,s in src.items():
    for m in cat_re.finditer(s):
        prefixes[m.group(1)].add(f)
print("\n== dynamic prefixes found in consumers:")
for p,fs in sorted(prefixes.items()):
    print(f"  {p}  <- {', '.join(sorted(fs))[:150]}")
# also templates of the form `${ns}.something` -- unknown ns; report them
tpl2=re.compile(r"`\$\{[^}]+\}\.[a-zA-Z0-9_.]+`")
print("\n== templates with dynamic namespace prefix (`${x}.suffix`):")
suffixes=set()
for f,s in src.items():
    for m in tpl2.finditer(s):
        print("  ",f,m.group(0)); suffixes.add(m.group(0).split('}.')[1].rstrip('`'))
# classify
live=[];dyn=[];testonly=[];orphan=[]
for k in sorted(allkeys):
    if k in literals: live.append(k)
    elif k.startswith('accessibility.') and k.split('.',1)[1] in ('protanopia','deuteranopia','tritanopia','achromatopsia'): dyn.append(k)
    elif k.startswith('accessibility.'): 
        (testonly if k in tliterals else orphan).append(k)
    elif any(k.startswith(p) for p in prefixes): dyn.append(k)
    elif any(k.endswith('.'+sfx) for sfx in suffixes): dyn.append(k)
    elif k in tliterals: testonly.append(k)
    else: orphan.append(k)
print(f"\n== totals: keys={len(allkeys)} live(literal)={len(live)} dynamic-prefix={len(dyn)} test-only={len(testonly)} orphan={len(orphan)}")
# per-namespace
def ns(k): return k.split('.')[0]
c_all=Counter(ns(k) for k in allkeys); c_orph=Counter(ns(k) for k in orphan); c_dyn=Counter(ns(k) for k in dyn); c_t=Counter(ns(k) for k in testonly)
print("\n== per namespace: total / live / dyn / test-only / orphan")
for n,_ in sorted(c_all.items(), key=lambda x:-x[1]):
    print(f"  {n:16s} {c_all[n]:4d} {c_all[n]-c_orph[n]-c_dyn[n]-c_t[n]:4d} {c_dyn[n]:4d} {c_t[n]:4d} {c_orph[n]:4d}")
# byte estimate: for each orphan key, sum len(json.dumps(key_leaf: value)) across 6 langs
def bytes_for(kset):
    tot=0
    for l in langs:
        for k in kset:
            v=keys[l].get(k)
            if v is None: continue
            leaf=k.split('.')[-1]
            tot+=len(json.dumps({leaf:v},ensure_ascii=False).encode('utf-8'))
    return tot
print(f"\n== orphan bytes across 6 files (approx, leaf+value): {bytes_for(orphan)}  test-only bytes: {bytes_for(testonly)}")
with open(f'{ROOT}/docs/audits/2026-08-18-discord-worker-dead-code/evidence/bot-i18n-orphan-keys.txt','w',encoding='utf-8') as out:
    out.write("# bot-logic i18n orphan keys (packages/bot-logic/src/i18n/locales/*.json)\n")
    out.write(f"# generated 2026-08-18 by track C; keys={len(allkeys)} live={len(live)} dynamic={len(dyn)} test-only={len(testonly)} orphan={len(orphan)}\n")
    out.write("# 'orphan' = leaf key path never appears as a string literal in any non-test file under apps/discord-worker, apps/stoat-worker, packages/bot-logic, packages/svg,\n#   and is not covered by any template/concat prefix found there. en value shown for context.\n\n")
    out.write("## ORPHAN\n")
    for k in orphan: out.write(f"{k}\t{json.dumps(en[k],ensure_ascii=False)[:100]}\n")
    out.write("\n## TEST-ONLY (only *.test.ts reference the literal)\n")
    for k in testonly: out.write(f"{k}\t{'; '.join(sorted(tliterals[k]))}\n")
    out.write("\n## DYNAMIC-PREFIX-COVERED (assumed live; verify enumerations)\n")
    for k in dyn: out.write(f"{k}\n")
json.dump({'live':live,'dyn':dyn,'testonly':testonly,'orphan':orphan},open(f'{SP}/i18n-result.json','w'))
