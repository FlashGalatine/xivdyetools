# Frozen Stain audit fixture

Raw page bodies and local source bytes come from the 2026-10-20 investigation at repository baseline `b98c8584a85f5dc50b4b4392c508cc627ef004d6`. `source-record.json` records their original locations and hashes.

`bundle/` is a format-1 test bundle constructed **offline** from those responses. Its pinned request URLs are reconstructed test inputs, not a second observation of HTTP traffic; its generation timestamp is fixed for reproducibility. The actual requests, timestamps and source evidence are in `docs/audits/2026-10-20-xivapi-offloading/evidence/discovery/manifest.json`.

The duplicate raw/local files intentionally freeze the real replay contract independently of today's source data. The scoped `.gitattributes` preserves exact input bytes and hashes across Windows and Linux checkouts.
