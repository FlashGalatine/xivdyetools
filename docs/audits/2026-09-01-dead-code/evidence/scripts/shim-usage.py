#!/usr/bin/env python3
"""shim-usage.py — for each app-local `@deprecated` re-export shim of @xivdyetools/types,
list the names it re-exports and, for each, whether anything in the app still imports it FROM
the local shim (as opposed to from @xivdyetools/types directly)."""
import os, re, subprocess

root = subprocess.check_output(["git", "rev-parse", "--show-toplevel"], text=True).strip()
SHIMS = {
    "apps/oauth/src/types.ts": "apps/oauth",
    "apps/presets-api/src/types.ts": "apps/presets-api",
    "apps/moderation-worker/src/types/preset.ts": "apps/moderation-worker",
    "apps/discord-worker/src/types/preset.ts": "apps/discord-worker",
}
tracked = subprocess.check_output(["git", "ls-files"], cwd=root, text=True).splitlines()

for shim, unit in SHIMS.items():
    src = open(os.path.join(root, shim), encoding="utf-8").read()
    names = []
    for m in re.finditer(r"export type \{([^}]*)\} from '@xivdyetools/types'", src, re.S):
        names += [n.strip() for n in m.group(1).split(",") if n.strip()]
    base = os.path.basename(shim).replace(".ts", "")
    print(f"\n=== {shim}  ({len(names)} re-exported names)")
    files = [f for f in tracked if f.startswith(unit + "/") and f.endswith(".ts") and f != shim]
    for n in names:
        users = []
        for f in files:
            try:
                t = open(os.path.join(root, f), encoding="utf-8", errors="ignore").read()
            except OSError:
                continue
            # an import of this name from a relative path ending in the shim's module name
            for m in re.finditer(r"import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+'([^']*)'", t, re.S):
                mod = m.group(2)
                if not mod.startswith("."):
                    continue
                if os.path.basename(mod).split(".")[0] != base:
                    continue
                if re.search(r"\b" + re.escape(n) + r"\b", m.group(1)):
                    users.append(f)
        mark = "LIVE " if users else "DEAD "
        print(f"  {mark}{n:32} {len(users):2} local importer(s) {users[:3]}")
