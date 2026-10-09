"""Scope the 2026-10-04 findings against what changed on main since each audit's SHA.

For every finding in the three catalogs: collect cited paths (Location section = primary,
whole body = secondary, basenames resolved against the repo tree), intersect with the
changed-file set for that catalog's audit SHA, and attach its sprint from the merged plan.
"""
import json, os, re, subprocess, sys
from collections import defaultdict

ROOT = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True).stdout.strip()
SP = os.path.dirname(os.path.abspath(__file__))  # holds changed-*.txt (git diff --name-only <audit sha> origin/main)
AUD = os.path.join(ROOT, "docs", "audits")
CATS = {
    "dead-code": ("2026-10-04-dead-code", "1e842b20", "changed-dead.txt"),
    "deep-dive": ("2026-10-04-deep-dive", "80262a2f", "changed-dd-i18n.txt"),
    "i18n": ("2026-10-04-i18n", "80262a2f", "changed-dd-i18n.txt"),
}

tracked = subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True, text=True, encoding="utf-8").stdout.split("\n")
tracked = [t for t in tracked if t and not t.startswith("docs/audits/")]
by_base = defaultdict(list)
for t in tracked:
    by_base[os.path.basename(t)].append(t)

PATH_RE = re.compile(r"((?:apps|packages|scripts|docs|\.github|\.agents)/[A-Za-z0-9_./@\-\[\]]+\.[A-Za-z0-9]+)")
ROOTFILE_RE = re.compile(r"\b(turbo\.json|pnpm-workspace\.yaml|pnpm-lock\.yaml|knip\.jsonc|package\.json|tsconfig\.base\.json|README\.md|CHANGELOG-laymans\.md)\b")
BASE_RE = re.compile(r"\b([A-Za-z0-9_\-]+(?:\.[A-Za-z0-9_\-]+)*\.(?:ts|tsx|js|mjs|json|md|py|yml|yaml|toml|css|csv))\b")


def unit_dir(unit):
    m = re.findall(r"(apps/[a-z\-]+|packages/[a-z\-]+)", unit or "")
    return m


def resolve(cands, units):
    out = set()
    for c in cands:
        c = c.rstrip(".,):;`'\"")
        if c in tracked_set:
            out.add(c)
            continue
        base = os.path.basename(c)
        hits = by_base.get(base, [])
        if not hits:
            continue
        # prefer hits inside the finding's unit(s)
        scoped = [h for h in hits if any(h.startswith(u + "/") for u in units)]
        if c.count("/") >= 1:
            # partial path like src/services/foo.ts
            scoped2 = [h for h in hits if h.endswith(c)]
            if scoped2:
                out.update(scoped2 if len(scoped2) <= 3 else [])
                continue
        if scoped:
            out.update(scoped if len(scoped) <= 3 else [])
        elif len(hits) == 1:
            out.add(hits[0])
    return out


tracked_set = set(tracked)

# sprint map from the merged plan
plan = open(os.path.join(AUD, "2026-10-04-i18n", "REMEDIATION_PLAN.md"), encoding="utf-8").read()
sprint_of = {}
section = None
for line in plan.split("\n"):
    m = re.match(r"^##+ (.*)", line)
    if m:
        h = m.group(1)
        sm = re.match(r"Sprint (\d+)", h)
        if sm:
            section = f"S{int(sm.group(1)):02d}"
        elif h.startswith("Superseded"):
            section = "SUPERSEDED"
        elif h.startswith("KEEP"):
            section = "KEEP"
        elif h.startswith("Pin first"):
            section = "PIN"
        elif h.startswith("Standing"):
            section = None
        elif h.startswith("From the") and section == "S00":
            pass
        continue
    if section and line.startswith("| ["):
        idm = re.match(r"^\| \[([^\]]+)\]", line)
        if idm:
            raw = idm.group(1)
            key = raw if "/" in raw else f"i18n/{raw}"
            sprint_of.setdefault(key, section)
    if section == "SUPERSEDED" and line.startswith("|") and not line.startswith("|---"):
        pass

rows = []
for cat, (folder, sha, chfile) in CATS.items():
    changed = set(l.strip() for l in open(os.path.join(SP, chfile), encoding="utf-8") if l.strip())
    catalog = {c["id"]: c for c in json.load(open(os.path.join(AUD, folder, "evidence", "catalog.json"), encoding="utf-8"))}
    fdir = os.path.join(AUD, folder, "findings")
    for fn in sorted(os.listdir(fdir)):
        if not fn.endswith(".md"):
            continue
        fid = fn[:-3]
        body = open(os.path.join(fdir, fn), encoding="utf-8").read()
        c = catalog.get(fid, {})
        units = unit_dir(c.get("unit", ""))
        loc = ""
        lm = re.search(r"## Location\n(.*?)\n## ", body, re.S)
        if lm:
            loc = lm.group(1)
        status = ""
        sm = re.search(r"## Status\n(.*)$", body, re.S)
        if sm:
            status = sm.group(1).strip().split("\n")[0]
        def cands(text):
            cs = set(PATH_RE.findall(text)) | set(BASE_RE.findall(text))
            cs |= set(ROOTFILE_RE.findall(text))
            return cs
        prim = resolve(cands(loc), units)
        sec = resolve(cands(body), units) - prim
        hit_p = sorted(prim & changed)
        hit_s = sorted(sec & changed)
        key = fid if cat != "i18n" else f"i18n/{fid}"
        if cat != "i18n":
            key = f"{cat}/{fid}"
        rows.append({
            "key": key, "cat": cat, "id": fid, "unit": c.get("unit", ""),
            "sev": c.get("sev") or c.get("tier") or f"{c.get('conf')}/{c.get('blast')}·{c.get('rec')}",
            "title": c.get("title", ""), "status": status,
            "sprint": sprint_of.get(key, "?"),
            "loc_paths": sorted(prim), "touched_primary": hit_p, "touched_secondary": hit_s,
        })

json.dump(rows, open(os.path.join(SP, "scope.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
from collections import Counter
print("total", len(rows))
print("sprint ?", [r["key"] for r in rows if r["sprint"] == "?"])
print("no loc paths", [r["key"] for r in rows if not r["loc_paths"]])
tp = [r for r in rows if r["touched_primary"]]
ts = [r for r in rows if not r["touched_primary"] and r["touched_secondary"]]
print("touched primary", len(tp), "secondary-only", len(ts))
for r in tp:
    print("P", r["key"], r["sprint"], r["status"][:30], r["touched_primary"])
for r in ts:
    print("S", r["key"], r["sprint"], r["status"][:30], r["touched_secondary"])
print(Counter(r["sprint"] for r in rows))
