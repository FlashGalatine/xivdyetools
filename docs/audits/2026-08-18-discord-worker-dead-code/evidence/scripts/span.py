import re,sys
R='C:/dev/XIVProjects/xivdyetools/'
f=sys.argv[1]; names=sys.argv[2:]
lines=open(R+f,encoding='utf-8').read().split('\n')
tot=0
for name in names:
    # find method start line (2-space indent)
    start=None
    for i,l in enumerate(lines):
        if re.match(r'^  (?:static\s+)?(?:async\s+)?'+re.escape(name)+r'\s*(<[^>]*>)?\(',l):
            start=i;break
    if start is None:
        print(f"  {name}: NOT FOUND"); continue
    # walk back over JSDoc
    s=start
    j=start-1
    while j>=0 and (lines[j].strip().startswith('*') or lines[j].strip().startswith('/**') or lines[j].strip()=='' ):
        if lines[j].strip().startswith('/**'): s=j; break
        j-=1
    # find end: first line == '  }' after start
    e=start
    depth=0; started=False
    for k in range(start,len(lines)):
        depth+=lines[k].count('{')-lines[k].count('}')
        if '{' in lines[k]: started=True
        if started and depth<=0: e=k;break
    n=e-s+1; tot+=n
    print(f"  {name}: lines {s+1}-{e+1} ({n})")
print(f"  TOTAL {tot}")
