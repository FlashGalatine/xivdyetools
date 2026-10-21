"""Coverage follow-up: canonical 125 Stain IDs; exact locale/color/metallic parity."""
import csv, json, re
import probe_xivapi as p
p.records = json.loads((p.OUT / "probe-manifest.json").read_text(encoding="utf-8"))
root = p.OUT.parents[3]
dyes = json.loads((root / "packages/core/src/data/dyes.json").read_text(encoding="utf-8"))
seed = json.loads((p.OUT / "stain-row1-full.json").read_text(encoding="utf-8"))
pin = {"version": seed["version"], "schema": seed["schema"]}
rows = []
for i in range(0, len(dyes), 100):
    response, _ = p.probe("stain-coverage-" + str(i // 100 + 1), "/api/sheet/Stain", {**pin, "rows": ",".join(str(d["stainID"]) for d in dyes[i:i+100]), "limit":100,"fields":"Name,Name@ja,Name@de,Name@fr,Color,Shade,IsMetallic,Item[].Name"})
    rows.extend(response.get("rows", []))
for language in ["kr", "chs"]:
    p.probe("stain-language-" + language, "/api/sheet/Stain/1", {**pin,"fields":"Name","language":language})
locale_rows = list(csv.DictReader((root / "packages/core/dyenames.csv").open(encoding="utf-8-sig")))
print("CSV columns:", list(locale_rows[0]))
metal_source = (root / "packages/core/src/config/dye-vocabulary.ts").read_text(encoding="utf-8")
metal_text = re.search(r"METALLIC_STAIN_IDS.*?new Set\(\[(.*?)\]\)", metal_source, re.S).group(1)
metal = {int(n) for n in re.findall(r"\b\d+\b", re.sub(r"//[^\n]*", "", metal_text))}
by_id = {r["row_id"]:r["fields"] for r in rows}
summary = {"version":pin["version"],"schema":pin["schema"],"expected":len(dyes),"returned":len(rows),"missing":[],"english_name_mismatches":[],"color_mismatches":[],"metallic_mismatches":[],"item_relationships":[]}
for dye in dyes:
    sid = dye["stainID"]
    if sid not in by_id: summary["missing"].append(sid); continue
    f=by_id[sid]
    if f.get("Name") != dye["name"]: summary["english_name_mismatches"].append({"stainID":sid,"local":dye["name"],"upstream":f.get("Name")})
    color = "#" + format(f["Color"], "06x")
    if color != dye["hex"]: summary["color_mismatches"].append({"stainID":sid,"local":dye["hex"],"upstream":color})
    if bool(f.get("IsMetallic")) != (sid in metal): summary["metallic_mismatches"].append(sid)
    summary["item_relationships"].append({"stainID":sid,"consolidationType":dye["consolidationType"],"legacyItemID":dye["legacyItemID"],"upstreamItems":[{"id":v.get("row_id",v.get("value")),"name":v.get("fields",{}).get("Name")} for v in f.get("Item",[])]})
(p.OUT / "stain-parity.json").write_text(json.dumps(summary,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({k:v for k,v in summary.items() if k!="item_relationships"},ensure_ascii=True))
