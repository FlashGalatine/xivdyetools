"""
Throw-away research prototype: resolve every equipment model key found in a
folder of `.chara` files against XIVAPI v2 and report resolution / ambiguity.

    python resolver-prototype.py C:/dev/XIVProjects/CharaSamples

Produced `corpus-resolution-log.txt` on 2026-08-16 (XIVAPI version 284bb7f44b9c0976 = 7.55x2).
Documents the exact query grammar that works — see README.md §4.

Rules encoded here (see README §3 / §5):
  gear key   = ModelBase | ModelVariant << 16
  weapon key = ModelSet | ModelBase << 16 | ModelVariant << 32
  slot filter is mandatory:  +EquipSlotCategory.<Slot>=1
  off-hands: try the main-hand item's ModelSub first, then OffHand ModelMain
  a real User-Agent is required (Python's default UA gets a Cloudflare 403)
"""
import collections
import glob
import json
import sys
import time
import urllib.parse
import urllib.request

API = "https://v2.xivapi.com/api/search"
UA = "xivdyetools-research/1.0"

# .chara slot -> EquipSlotCategory boolean column
SLOT_FIELD = {
    "HeadGear": "Head", "Body": "Body", "Hands": "Gloves", "Legs": "Legs", "Feet": "Feet",
    "Ears": "Ears", "Neck": "Neck", "Wrists": "Wrists", "LeftRing": "FingerL", "RightRing": "FingerR",
}


def gear_key(base: int, variant: int) -> int:
    return base | (variant << 16)


def weapon_key(set_: int, base: int, variant: int) -> int:
    return set_ | (base << 16) | (variant << 32)


def search(query: str, fields="Name,ModelMain,ModelSub", limit=500):
    url = API + "?" + urllib.parse.urlencode(
        {"sheets": "Item", "query": query, "fields": fields, "limit": limit}
    )
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def record(d, slot):
    g = d.get(slot)
    return g if isinstance(g, dict) else {}   # Anamnesis sometimes writes null


def main(folder: str):
    keys = collections.defaultdict(set)
    weapons, offhands, glasses = set(), set(), set()
    for f in glob.glob(f"{folder}/*.chara"):
        d = json.load(open(f, encoding="utf-8-sig"))
        for slot, field in SLOT_FIELD.items():
            g = record(d, slot)
            if g.get("ModelBase"):
                keys[field].add(gear_key(g["ModelBase"], g.get("ModelVariant", 0)))
        for slot, bucket in (("MainHand", weapons), ("OffHand", offhands)):
            g = record(d, slot)
            if g.get("ModelBase") or g.get("ModelSet"):
                bucket.add((g.get("ModelSet", 0), g.get("ModelBase", 0), g.get("ModelVariant", 0)))
        gl = d.get("Glasses")
        if isinstance(gl, dict):            # Ktisis / Anamnesis: {"GlassesId": n}
            gl = gl.get("GlassesId")        # Ktisis/Anamnesis hybrid: bare int
        if gl:
            glasses.add(gl)

    total = collections.Counter()
    for field, ks in keys.items():
        ks = sorted(ks)
        found = collections.defaultdict(list)
        for i in range(0, len(ks), 40):                       # OR-group batching, 40 per request
            chunk = ks[i:i + 40]
            q = f"+EquipSlotCategory.{field}=1 +({' '.join(f'ModelMain={k}' for k in chunk)})"
            d = search(q)
            for r in d.get("results", []):
                found[r["fields"]["ModelMain"]].append((r["row_id"], r["fields"]["Name"]))
            time.sleep(0.3)
        zero = [k for k in ks if k not in found]
        multi = {k: v for k, v in found.items() if len(v) > 1}
        total["keys"] += len(ks); total["zero"] += len(zero); total["multi"] += len(multi)
        print(field, "keys", len(ks), "unresolved", len(zero),
              [(k & 0xFFFF, k >> 16) for k in zero][:12], "multi", len(multi))
        for k, v in list(multi.items())[:8]:
            print("   ", (k & 0xFFFF, k >> 16), v)
    print("TOTAL", total)

    print("=== weapons ===")
    for s, b, v in sorted(weapons):
        d = search(f"+EquipSlotCategory.MainHand=1 +ModelMain={weapon_key(s, b, v)}", fields="Name")
        print((s, b, v), [(r["row_id"], r["fields"]["Name"]) for r in d.get("results", [])][:4])
        time.sleep(0.3)

    print("=== offhands ===")
    for s, b, v in sorted(offhands):
        k = weapon_key(s, b, v)
        as_sub = search(f"+EquipSlotCategory.MainHand=1 +ModelSub={k}", fields="Name")
        as_main = search(f"+EquipSlotCategory.OffHand=1 +ModelMain={k}", fields="Name")
        r1 = [(r["row_id"], r["fields"]["Name"]) for r in as_sub.get("results", [])]
        r2 = [(r["row_id"], r["fields"]["Name"]) for r in as_main.get("results", [])]
        print((s, b, v), "asSub", len(r1), r1[:3], "asOffMain", len(r2), r2[:3])
        time.sleep(0.3)
    print("glasses ids", sorted(glasses))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
