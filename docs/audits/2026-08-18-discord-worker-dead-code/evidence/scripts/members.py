import re,sys,os
SP="C:/Users/DrawF/AppData/Local/Temp/claude/c--dev-XIVProjects/417c1877-c1ef-4f21-9cb7-a508c2d6ca96/scratchpad"
R='C:/dev/XIVProjects/xivdyetools/'
allfiles=[l.strip() for l in open(SP+'/files.txt') if re.search(r'\.(ts|tsx|js|mjs)$',l)]
texts={}
for f in allfiles:
    try: texts[f]=open(R+f,encoding='utf-8',errors='ignore').read()
    except: pass
target=sys.argv[1]; cls=sys.argv[2]
src=open(R+target,encoding='utf-8').read()
# public methods: lines starting with 2-space indent then optional static/async, name(
methods=[]
for m in re.finditer(r'^  (?:static\s+)?(?:async\s+)?(?:get\s+|set\s+)?([a-zA-Z_]\w*)\s*(?:<[^>]*>)?\(',src,re.M):
    name=m.group(1)
    if name in ('constructor','if','for','while','switch','catch','return','function'): continue
    # skip private/protected
    line=src[src.rfind('\n',0,m.start())+1:m.end()]
    if 'private ' in line or 'protected ' in line: continue
    if name not in methods: methods.append(name)
print(f"{cls}: {len(methods)} public methods in {target}")
for name in methods:
    rx=re.compile(r'\.'+re.escape(name)+r'\b')
    ext_src=ext_test=core_src=core_test=0
    for f,t in texts.items():
        if f==target: 
            n=len(rx.findall(t)); 
            core_src+=n; continue
        n=len(rx.findall(t))
        if not n: continue
        is_test=('.test.' in f or '__tests__' in f or '/test/' in f or '.spec.' in f)
        if f.startswith('packages/core/'):
            if is_test: core_test+=n
            else: core_src+=n
        else:
            if is_test: ext_test+=n
            else: ext_src+=n
    flag='' if ext_src else ('  <-- no external src use' + ('' if (core_src) else ' (INTERNAL 0 too)'))
    print(f"  {name:38} extSrc={ext_src:3} extTest={ext_test:3} coreSrc(non-test,incl self)={core_src:3} coreTest={core_test:3}{flag}")
