#!/usr/bin/env python3
"""Is any bundled face still a VARIABLE font?

resvg ignores variable-font axes: it renders the face's DEFAULT instance and silently
drops `font-weight`. PR #148 (2026-08-29) replaced the Latin faces with static instances
for exactly this reason. This checks every face both workers bundle — including the CJK
subsets, whose `-Subset.ttf` names do not match the gate's /VariableFont/i filename test.
"""
import os, glob
from fontTools.ttLib import TTFont

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", ".."))

for worker in ("discord-worker", "og-worker"):
    fdir = os.path.join(REPO, "apps", worker, "src", "fonts")
    print(f"===== {worker} =====")
    for path in sorted(glob.glob(os.path.join(fdir, "*.ttf")) + glob.glob(os.path.join(fdir, "*.otf"))):
        f = TTFont(path, lazy=True)
        name = os.path.basename(path)
        variable = "fvar" in f
        # OS/2 usWeightClass is the weight a static face reports
        weight = f["OS/2"].usWeightClass if "OS/2" in f else "?"
        if variable:
            axes = {a.axisTag: (a.minValue, a.defaultValue, a.maxValue) for a in f["fvar"].axes}
            print(f"  VARIABLE  {name:30s} OS/2.usWeightClass={weight}  axes={axes}")
        else:
            print(f"  static    {name:30s} OS/2.usWeightClass={weight}")
        f.close()
    print()
