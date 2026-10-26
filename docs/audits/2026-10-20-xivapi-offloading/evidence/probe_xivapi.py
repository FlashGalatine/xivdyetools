"""Read-only Issue 322 probes. Run with Python; writes dated evidence beside this file.
No authentication, private data, retries, or load testing. 2 MB/request cap, 15s timeout.
"""
import hashlib, json, time
from pathlib import Path
from datetime import datetime, timezone
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
OUT = Path(__file__).resolve().parent
BASE = "https://v2.xivapi.com"
HEADERS = {"User-Agent": "XIVDyeTools-Issue322-Research/1.0 (+https://github.com/FlashGalatine/xivdyetools/issues/322)", "Origin": "https://xivdyetools.app", "Accept": "application/json"}
records = []
def probe(name, path, params=None, headers=None):
    url = BASE + path + (("?" + urlencode(params)) if params else "")
    before = time.perf_counter()
    record = {"name": name, "url": url, "started_utc": datetime.now(timezone.utc).isoformat()}
    payload = None
    try:
        request = Request(url, headers={**HEADERS, **(headers or {})})
        try:
            response = urlopen(request, timeout=15)
        except HTTPError as error:
            response = error
        with response:
            data = response.read(2_000_001)
            record["status"] = response.status
            record["headers"] = {k.lower(): v for k, v in response.headers.items() if k.lower() in {"content-type", "cache-control", "etag", "last-modified", "access-control-allow-origin", "access-control-expose-headers", "vary", "retry-after", "content-length"}}
        if len(data) > 2_000_000: raise ValueError("Response exceeds 2 MB research limit")
        record["bytes"] = len(data)
        record["sha256"] = hashlib.sha256(data).hexdigest()
        try: payload = json.loads(data)
        except (ValueError, UnicodeDecodeError): pass
        suffix = ".json" if payload is not None else ".bin"
        (OUT / (name + suffix)).write_bytes(data)
        record["body_file"] = name + suffix
        if isinstance(payload, dict):
            record["schema"] = payload.get("schema")
            record["version"] = payload.get("version")
            record["rows"] = len(payload.get("rows", payload.get("results", [])))
    except Exception as error: record["error"] = str(error)
    record["elapsed_ms"] = round((time.perf_counter() - before) * 1000)
    records.append(record)
    (OUT / "probe-manifest.json").write_text(json.dumps(records, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(record), flush=True)
    time.sleep(0.25)
    return payload, record
if __name__ == "__main__":
    probe("openapi", "/api/openapi.json")
    probe("versions", "/api/version")
    stain, _ = probe("stain-sample", "/api/sheet/Stain", {"rows":"1,40,131","fields":"Name,Name@ja,Name@de,Name@fr,Color,Shade,IsMetallic","transient":"Item1.Name,Item2.Name"})
    probe("stain-transient", "/api/sheet/StainTransient/1")
    if stain and stain.get("schema"):
        probe("stain-pinned", "/api/sheet/Stain", {"version":"541c0c12e07da325","schema":stain["schema"],"rows":"1,40,131","fields":"Name,Color,Shade,IsMetallic"})
    for locale in ["ko", "zh"]:
        probe("stain-" + locale, "/api/sheet/Stain/1", {"fields":"Name","language":locale})
    probe("items", "/api/sheet/Item", {"rows":"5729,52254,42589","fields":"Name,Name@ja,Icon,ModelMain,ModelSub,DyeCount,EquipSlotCategory,IsUntradable"})
    probe("glasses", "/api/sheet/Glasses/1", {"fields":"Name,Icon,GlassesId"})
    probe("gilshop", "/api/sheet/GilShopItem", {"limit":2,"fields":"Item.Name"})
    probe("specialshop", "/api/sheet/SpecialShop", {"limit":1,"fields":"Name,UseCurrencyType,Item[].ReceiveItems[].Item.Name"})
    probe("equip-search", "/api/search", {"sheets":"Item","query":"+ModelMain=1 +EquipSlotCategory.Body=1","fields":"Name,ModelMain,EquipSlotCategory.Body","limit":2})
    _, first = probe("icon", "/api/asset", {"path":"ui/icon/022000/022001_hr1.tex","format":"png"})
    etag = first.get("headers", {}).get("etag")
    if etag:
        probe("icon-conditional", "/api/asset", {"path":"ui/icon/022000/022001_hr1.tex","format":"png"}, {"If-None-Match":etag})
