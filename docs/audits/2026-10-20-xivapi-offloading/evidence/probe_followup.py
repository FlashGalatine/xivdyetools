"""Follow-ups preserve failed probes and test observed fields, not guessed schema."""
import json
import probe_xivapi as p
p.records = json.loads((p.OUT / "probe-manifest.json").read_text(encoding="utf-8"))
spec = json.loads((p.OUT / "openapi.json").read_text(encoding="utf-8"))
for path, value in spec.get("paths", {}).items():
    if any(x in path for x in ("asset", "search", "sheet")):
        print(path, json.dumps(value)[:2000])
stain, _ = p.probe("stain-row1-full", "/api/sheet/Stain/1")
p.probe("stain-transient-pinned", "/api/sheet/StainTransient/1", {"version":"541c0c12e07da325"})
p.probe("stain-four-locales", "/api/sheet/Stain", {"rows":"1,40","fields":"Name,Name@ja,Name@de,Name@fr,Color,Shade,IsMetallic"})
if stain and stain.get("schema"):
    p.probe("stain-pinned", "/api/sheet/Stain", {"rows":"1,40","fields":"Name,Color,Shade,IsMetallic","version":stain["version"],"schema":stain["schema"]})
p.probe("known-equipment-search", "/api/search", {"sheets":"Item","query":"+ModelMain=4295035733 +EquipSlotCategory.MainHand=1","fields":"Name,ModelMain,EquipSlotCategory.MainHand","limit":10})
p.probe("specialshop-full", "/api/sheet/SpecialShop/1769472")
