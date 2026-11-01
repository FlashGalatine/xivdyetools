#!/usr/bin/env python3
"""members.py <class-file> <ClassName> [<ClassName>...]

Public-method usage survey for a TypeScript class (knip 6 has no classMembers rule).
For every public (non-private/protected) method declared in <class-file>, counts `.name(` /
`.name` references across TRACKED files (git ls-files), bucketed:
  extSrc   = non-test files outside the class's own deploy unit
  extTest  = test files outside the unit
  unitSrc  = non-test files inside the unit (including the class file itself)
  unitTest = test files inside the unit
Flags methods with extSrc=0 (candidates) and extSrc=0 & unitSrc<=1 (declaration only).
Run from anywhere inside the repo:  python members.py apps/web-app/src/services/storage-service.ts StorageService
"""
import os, re, subprocess, sys

if len(sys.argv) < 3:
    sys.exit(__doc__)
root = subprocess.check_output(["git", "rev-parse", "--show-toplevel"], text=True).strip()
target = sys.argv[1].replace("\\", "/")
parts = target.split("/")
unit = "/".join(parts[:2]) if parts[0] in ("apps", "packages") else parts[0]
files = [f for f in subprocess.check_output(["git", "ls-files"], cwd=root, text=True).splitlines()
         if re.search(r"\.(ts|tsx|js|mjs)$", f) and "/coverage/" not in f and "e2e-coverage" not in f
         and not f.startswith("docs/audits/")]
texts = {}
for f in files:
    try:
        with open(os.path.join(root, f), encoding="utf-8", errors="ignore") as fh:
            texts[f] = fh.read()
    except OSError:
        pass
src = texts.get(target) or open(os.path.join(root, target), encoding="utf-8").read()
is_test = lambda f: bool(re.search(r"\.(test|spec)\.[tj]sx?$|__tests__/|/e2e/|/tests?/", f))
SKIP = {"constructor", "if", "for", "while", "switch", "catch", "return", "function", "super"}
for cls in sys.argv[2:]:
    m = re.search(r"(?:export\s+)?(?:abstract\s+)?class\s+" + re.escape(cls) + r"\b[^{]*\{", src)
    if not m:
        print(f"{cls}: class not found in {target}"); continue
    # body = from class opening brace to the matching close (brace counting)
    i, depth = m.end(), 1
    while i < len(src) and depth:
        depth += {"{": 1, "}": -1}.get(src[i], 0); i += 1
    body = src[m.end():i]
    methods = []
    for mm in re.finditer(r"^  (?:public\s+)?(?:static\s+)?(?:async\s+)?(?:get\s+|set\s+)?([A-Za-z_]\w*)\s*(?:<[^>]*>)?\(", body, re.M):
        name = mm.group(1)
        line = body[body.rfind("\n", 0, mm.start()) + 1: mm.end()]
        if name in SKIP or "private " in line or "protected " in line or name.startswith("#"):
            continue
        if name not in methods:
            methods.append(name)
    print(f"{cls}: {len(methods)} public methods in {target}")
    for name in methods:
        rx = re.compile(r"\." + re.escape(name) + r"\b")
        ext_src = ext_test = unit_src = unit_test = 0
        for f, t in texts.items():
            n = len(rx.findall(t))
            if not n:
                continue
            inside = f.startswith(unit + "/")
            if inside:
                if is_test(f): unit_test += n
                else: unit_src += n
            else:
                if is_test(f): ext_test += n
                else: ext_src += n
        flag = ""
        if ext_src == 0:
            flag = "  <-- no external src use" + (" (declaration-only?)" if unit_src <= 1 else "")
        print(f"  {name:36} extSrc={ext_src:3} extTest={ext_test:3} unitSrc={unit_src:3} unitTest={unit_test:3}{flag}")
