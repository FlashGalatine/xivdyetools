"""Exercise the actual preview UPDATE strings in a local, in-memory SQLite DB.

No network, credentials, application databases, or source writes. This verifies
the database race/stale-action behavior; route authority is verified separately
in the source review. It is not an end-to-end Cloudflare/Discord simulation.
"""
from pathlib import Path
import json
import re
import sqlite3

repo = Path(__file__).resolve().parents[5]
moderation = (repo / "apps/presets-api/src/handlers/moderation.ts").read_text(encoding="utf-8")
presets = (repo / "apps/presets-api/src/handlers/presets.ts").read_text(encoding="utf-8")
approve = re.search(r"`(UPDATE presets SET preview_image_status = 'approved'[^`]+)`", moderation).group(1)
upload = re.search(r"`(UPDATE presets SET preview_image_key = \?, preview_image_status = 'pending'[^`]+)`", presets).group(1)
db = sqlite3.connect(":memory:")
db.execute("CREATE TABLE presets(id TEXT PRIMARY KEY, preview_image_key TEXT, preview_image_status TEXT, updated_at TEXT)")
db.execute("INSERT INTO presets VALUES ('synthetic-preset', 'K1.webp', 'pending', 'T1')")
reviewed = db.execute("SELECT preview_image_key FROM presets").fetchone()[0]
db.execute(upload, ("K2.webp", "T2", "synthetic-preset"))
db.execute(approve, ("T3", "synthetic-preset"))
key, status = db.execute("SELECT preview_image_key, preview_image_status FROM presets").fetchone()
assert reviewed == "K1.webp" and key == "K2.webp" and status == "approved"
print(json.dumps({"reviewed_image": reviewed, "current_image": key, "current_status": status,
                  "query_source": "actual source UPDATE strings extracted without modification",
                  "result": "Approval of stale preset-only action approves the replacement image"}, indent=2))
