"""Offline analysis of captured rows, plus one bounded shop schema probe."""
import csv, json
import probe_xivapi as p
p.records = json.loads((p.OUT / "probe-manifest.json").read_text(encoding="utf-8"))
root=p.OUT.parents[3]
dyes=json.loads((root/"packages/core/src/data/dyes.json").read_text(encoding="utf-8"))
rows=sum((json.loads((p.OUT/f"stain-coverage-{i}.json").read_text(encoding="utf-8"))["rows"] for i in [1,2]),[])
by_id={r["row_id"]:r["fields"] for r in rows}
csvrows={int(r["itemID"]):r for r in csv.DictReader((root/"packages/core/dyenames.csv").open(encoding="utf-8-sig"))}
report=json.loads((p.OUT/"stain-parity.json").read_text(encoding="utf-8"))
report["locale_missing"]=[]
report["locale_exact_mismatches"]=[]
report["locale_trimmed_mismatches"]=[]
report["consolidated_item_mismatches"]=[]
for d in dyes:
    sid=d["stainID"]; f=by_id[sid]; local=csvrows[d["legacyItemID"] if d["legacyItemID"] is not None else sid]
    for lang,col in [("en","English Name"),("ja","Japanese Name"),("de","German Name"),("fr","French Name")]:
        val=f.get("Name" if lang=="en" else "Name@"+lang)
        entry={"stainID":sid,"locale":lang,"local":local[col],"upstream":val}
        if val is None: report["locale_missing"].append(entry)
        elif val!=local[col]:
            report["locale_exact_mismatches"].append(entry)
            if val.strip()!=local[col].strip(): report["locale_trimmed_mismatches"].append(entry)
    expected={"A":52254,"B":52255,"C":52256}.get(d["consolidationType"])
    if expected is not None and expected not in [x.get("row_id",x.get("value")) for x in f.get("Item",[])]:
        report["consolidated_item_mismatches"].append(sid)
(p.OUT/"stain-parity.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({k:v for k,v in report.items() if k not in ["item_relationships","color_mismatches"]},ensure_ascii=True))
print("item relationship samples:",json.dumps(report["item_relationships"][:2]+report["item_relationships"][-2:]))
p.probe("specialshop-field-shape", "/api/sheet/SpecialShop/1769472", {"fields":"Name,UseCurrencyType,Item@as(raw)"})
