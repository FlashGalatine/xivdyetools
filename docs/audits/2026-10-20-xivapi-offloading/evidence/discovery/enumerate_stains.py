"""Enumerate XIVAPI's complete Stain sheet without a local row-ID allowlist.
Research only: up to 20 sequential pages, 100 requested rows/page, 2 MB/read, 15s timeout.
Writes only evidence/discovery; leaves previous captures and production data unchanged.
"""
import hashlib, json, time
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[4]
FIELDS="Name,Name@ja,Name@de,Name@fr,Color,Shade,SubOrder,IsMetallic,IsHousingApplicable,Item[].Name"
BASE="https://v2.xivapi.com/api/sheet/Stain"
HEADERS={"User-Agent":"XIVDyeTools-Issue322-DyeDiscovery/1.0 (+https://github.com/FlashGalatine/xivdyetools/issues/322)","Accept":"application/json"}
records=[]; rows=[]; seen=set(); after=None; version=None; schema=None; complete=False
try:
    for page in range(1,21):
        params={"fields":FIELDS,"limit":100}
        if after is not None: params["after"]=after
        if version is not None: params["version"]=version
        if schema is not None: params["schema"]=schema
        url=BASE+"?"+urlencode(params)
        record={"page":page,"url":url,"started_utc":datetime.now(timezone.utc).isoformat()}
        records.append(record)
        start=time.perf_counter()
        try:
            response=urlopen(Request(url,headers=HEADERS),timeout=15)
        except HTTPError as error: response=error
        with response:
            record["status"]=response.status
            data=response.read(2_000_001)
            record["elapsed_ms"]=round((time.perf_counter()-start)*1000)
            record["content_type"]=response.headers.get("Content-Type")
        if len(data)>2_000_000: raise ValueError("Research body limit exceeded")
        file="stain-list-page-"+str(page)+".json"
        (OUT/file).write_bytes(data)
        record.update({"body_file":file,"bytes":len(data),"sha256":hashlib.sha256(data).hexdigest()})
        if record["status"]!=200: raise ValueError("HTTP "+str(record["status"]))
        payload=json.loads(data)
        if not isinstance(payload.get("rows"),list): raise ValueError("Missing rows array")
        if not payload.get("version") or not payload.get("schema"): raise ValueError("Missing version/schema")
        if version is None: version=payload["version"]; schema=payload["schema"]
        if payload["version"]!=version or payload["schema"]!=schema: raise ValueError("Version/schema drift")
        batch=payload["rows"]; record["rows"]=len(batch)
        record["version"]=version; record["schema"]=schema
        if not batch: complete=True; break
        ids=[r["row_id"] for r in batch]
        if any(type(i) is not int or i<0 for i in ids): raise ValueError("Invalid Stain row IDs")
        if ids!=sorted(set(ids)): raise ValueError("Unsorted/duplicate page IDs")
        if after is not None and ids[0]<=after: raise ValueError("Pagination did not advance")
        if any(i in seen for i in ids): raise ValueError("Duplicate row across pages")
        for r in batch:
            if not isinstance(r.get("fields"),dict): raise ValueError("Missing fields")
            if not all(k in r["fields"] for k in ["Name","Name@ja","Name@de","Name@fr","Color","IsMetallic","Item"]):
                raise ValueError("Missing projected field")
        rows.extend(batch); seen.update(ids); after=ids[-1]
        time.sleep(0.25)
    if not complete: raise ValueError("Safety page cap reached before empty page")
except Exception as error:
    records[-1]["error"]=str(error)
finally:
    (OUT/"manifest.json").write_text(json.dumps(records,indent=2)+"\n",encoding="utf-8")
local=json.loads((ROOT/"packages/core/src/data/dyes.json").read_text(encoding="utf-8"))
local_ids={d["stainID"] for d in local}
candidates=[r for r in rows if r["row_id"]!=0 and isinstance(r["fields"].get("Name"),str) and r["fields"]["Name"].strip()]
excluded=[r for r in rows if r not in candidates]
candidate_ids={r["row_id"] for r in candidates}
summary={"complete":complete,"version":version,"schema":schema,"requests":len(records),"page_counts":[r.get("rows") for r in records],"rows":len(rows),"unique_rows":len(seen),"min_id":min(seen) if seen else None,"max_id":max(seen) if seen else None,"local_dyes":len(local_ids),"named_nonzero_candidates":len(candidates),"new_candidate_ids":sorted(candidate_ids-local_ids),"local_ids_missing_from_named_candidates":sorted(local_ids-candidate_ids),"excluded_rows":[{"row_id":r["row_id"],"fields":r["fields"]} for r in excluded],"nonzero_blank_name_ids":[r["row_id"] for r in rows if r["row_id"]!=0 and not r["fields"]["Name"].strip()],"candidate_ids_without_item_link":[r["row_id"] for r in candidates if not any(v.get("row_id",v.get("value",0))>0 for v in r["fields"]["Item"])],"total_response_bytes":sum(r.get("bytes",0) for r in records)}
(OUT/"summary.json").write_text(json.dumps(summary,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
print(json.dumps(summary,ensure_ascii=True))
if not complete: raise SystemExit(1)
