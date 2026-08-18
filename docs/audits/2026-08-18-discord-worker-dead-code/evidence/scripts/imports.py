import re,collections,sys
SP="C:/Users/DrawF/AppData/Local/Temp/claude/c--dev-XIVProjects/417c1877-c1ef-4f21-9cb7-a508c2d6ca96/scratchpad"
files=[l.strip() for l in open(SP+'/ext.txt')]
root=collections.defaultdict(set); blend=collections.defaultdict(set); other=collections.defaultdict(set)
pat=re.compile(r'import\s+(type\s+)?\{([^}]*)\}\s*from\s*[\'"](@xivdyetools/core(?:/[^\'"]*)?)[\'"]',re.S)
pat2=re.compile(r'from\s*[\'"](@xivdyetools/core[^\'"]*)[\'"]')
dyn=re.compile(r'import\([\'"](@xivdyetools/core[^\'"]*)[\'"]\)')
star=re.compile(r'import\s+\*\s+as\s+(\w+)\s+from\s*[\'"](@xivdyetools/core[^\'"]*)[\'"]')
specs=collections.Counter(); stars=[]
for f in files:
    try: s=open('C:/dev/XIVProjects/xivdyetools/'+f,encoding='utf-8',errors='ignore').read()
    except Exception as e: continue
    for m in pat2.finditer(s): specs[m.group(1)]+=1
    for m in dyn.finditer(s): specs['dyn:'+m.group(1)]+=1
    for m in star.finditer(s): stars.append((f,m.group(1),m.group(2)))
    for m in pat.finditer(s):
        spec=m.group(3); names=m.group(2)
        for n in names.split(','):
            n=n.strip()
            if not n: continue
            n=re.sub(r'^type\s+','',n); n=n.split(' as ')[0].strip()
            tgt = root if spec=='@xivdyetools/core' else (blend if spec=='@xivdyetools/core/blending' else other)
            tgt[n].add(f)
print("SPECIFIERS:",dict(specs))
print("STAR IMPORTS:",stars)
print("\nROOT BARREL IMPORTS (symbol: nfiles src/test):")
for n in sorted(root):
    fs=root[n]; t=[x for x in fs if '.test.' in x or '__tests__' in x or '/test/' in x or '.spec.' in x]
    print(f"  {n}: {len(fs)-len(t)} src, {len(t)} test")
print("\nBLENDING IMPORTS:")
for n in sorted(blend): print(f"  {n}: {sorted(blend[n])}")
print("\nOTHER SPEC IMPORTS:")
for n in sorted(other): print(f"  {n}: {sorted(other[n])}")
