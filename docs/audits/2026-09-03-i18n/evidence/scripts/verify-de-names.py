#!/usr/bin/env python3
"""I18N-007: check every German dye name in dyenames.csv against XIVAPI.

`Perlmutt-` turned out not to be a truncated word but a suffix-stripping
artefact: the German item name is `Perlmutt-Farbstoff`, and removing the
`Farbstoff` part leaves the connecting hyphen behind. This sweeps all 125 rows
for the same class (and any other drift) instead of fixing the one row we
happened to notice.
"""
import csv, json, os, sys, time, urllib.request

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", ".."))
CSV = os.path.join(REPO, "packages", "core", "dyenames.csv")
API = "https://v2.xivapi.com/api/sheet/Item/{}?fields=Name&language=de"

rows = list(csv.DictReader(open(CSV, encoding="utf-8")))
print(f"rows in dyenames.csv: {len(rows)}")

suspicious, mismatched, ok, failed = [], [], 0, []
for i, row in enumerate(rows):
    item_id = (row.get("itemID") or "").strip()
    local = (row.get("German Name") or "").strip()
    if not item_id.isdigit():
        continue
    try:
        req = urllib.request.Request(
            API.format(item_id),
            headers={"User-Agent": "xivdyetools-i18n-audit/1.0 (+repo docs/audits)"},
        )
        with urllib.request.urlopen(req, timeout=20) as r:
            api_name = json.load(r)["fields"]["Name"]
    except Exception as e:  # noqa: BLE001
        failed.append((item_id, local, str(e)[:60]))
        continue

    # The pipeline drops the "dye" word from the item name.
    stripped = api_name
    for suffix in (" Farbstoff", "-Farbstoff", "farbstoff"):
        if stripped.endswith(suffix):
            stripped = stripped[: -len(suffix)]
            break
    stripped = stripped.strip()

    if local.endswith("-") or local.endswith("‑"):
        suspicious.append((item_id, local, api_name, stripped))
    elif local != stripped:
        mismatched.append((item_id, local, api_name, stripped))
    else:
        ok += 1
    time.sleep(0.05)

print(f"exact match with the stripped API name: {ok}")
print(f"\nDANGLING HYPHEN ({len(suspicious)}):")
for item_id, local, api_name, stripped in suspicious:
    print(f"  {item_id}  csv={local!r}  api={api_name!r}  -> suggested {stripped.rstrip('-') !r}")
print(f"\nOTHER DIFFERENCES vs the naive strip ({len(mismatched)}) — review, many are legitimate:")
for item_id, local, api_name, stripped in mismatched[:40]:
    print(f"  {item_id}  csv={local!r}  api={api_name!r}")
if failed:
    print(f"\nLOOKUP FAILED ({len(failed)}):")
    for item_id, local, err in failed[:10]:
        print(f"  {item_id} {local!r}: {err}")
