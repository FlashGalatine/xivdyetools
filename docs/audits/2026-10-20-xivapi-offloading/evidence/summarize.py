"""Final small schema query and offline compact evidence summary."""
import json
from collections import Counter
import probe_xivapi as p
p.records=json.loads((p.OUT/"probe-manifest.json").read_text(encoding="utf-8"))
seed=json.loads((p.OUT/"stain-row1-full.json").read_text(encoding="utf-8"))
p.probe("specialshop-projected", "/api/sheet/SpecialShop/1769472", {"version":seed["version"],"schema":seed["schema"],"fields":"Name,UseCurrencyType,Item[].Item[].Name,Item[].ReceiveCount,Item[].ItemCost[].Name,Item[].CurrencyCost,Item[].CostType"})
parity=json.loads((p.OUT/"stain-parity.json").read_text(encoding="utf-8"))
summary={"requests":len(p.records),"status_counts":dict(Counter(str(r.get("status","error")) for r in p.records)),"rejected_oversize_bodies":sum("error" in r for r in p.records),"probe_total_body_bytes_saved":sum(r.get("bytes",0) for r in p.records),"raw_csv_exact_differences":dict(Counter(v["locale"] for v in parity["locale_exact_mismatches"])),"trimmed_csv_differences":dict(Counter(v["locale"] for v in parity["locale_trimmed_mismatches"])),"color_differences":len(parity["color_mismatches"]),"missing_dye_rows":parity["missing"],"metallic_differences":parity["metallic_mismatches"],"consolidated_item_differences":parity["consolidated_item_mismatches"]}
(p.OUT/"summary.json").write_text(json.dumps(summary,indent=2)+"\n",encoding="utf-8")
print(json.dumps(summary))
