# FINDING-029: ko/zh item-name tables built from unpinned Teamcraft staging head with no recorded commit, checksum or content gate
**Severity:** LOW · **Exposure:** LOCAL · **Deploy unit:** api-worker build-time data (item-names.{ko,zh}.json bundled into api-worker; also read by discord-worker's CJK font cut) · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-494

## Location
- `apps/api-worker/scripts/build-item-names.mjs:62` — ko/zh item-name tables built from unpinned Teamcraft staging head with no recorded commit, checksum or content gate
- `apps/api-worker/scripts/build-item-names.mjs:63` — Item-name build not pinned or validated; ko/zh from Teamcraft staging branch head

## Evidence
- build-item-names.mjs:62-63 TEAMCRAFT_BASE = 'https://raw.githubusercontent.com/ffxiv-teamcraft/ffxiv-teamcraft/staging/libs/data/src/lib/json'; :138 dataminingRef = /^[0-9a-f]{40}$/.test(sha) ? sha : 'master'; :150 source: 'local ffxiv-datamining clone'; :246 meta.sources[lang] = SOURCES[lang]; .gitattributes:12 item-names.*.json linguist-generated=true -diff
- Reach: A party controlling (or compromising) the ffxiv-teamcraft staging branch changes ko-items.json/zh-items.json, and the maintainer runs `node scripts/build-item-names.mjs` after a patch and commits the output. The poisoned names then ship in /v1/chara/resolve answers and /glamour cards after the next api-worker deploy.
- Lines 62-67 fetch from `.../ffxiv-teamcraft/staging/...` with no SHA, and line 246 records only that branch URL. item-names.meta.json confirms ko/zh carry the staging URL and itemCsv says "local ffxiv-datamining clone" with no commit. resolveDataminingRef (:131-143) silently falls back to 'master'. cleanName (:182-188) strips only tags, soft hyphens and whitespace, so there is no charset, length or bidi/control check. .gitattributes:12 marks item-names.*.json `-diff`, so a regeneration shows up in review as an opaque binary change. The sibling build-acquisition.ts pins and records a SHA (:104-106, :391, :538), so the gap is an inco… Preconditions: Needs an upstream compromise or a bad push to the Teamcraft staging branch (or the xivapi datamining master), plus a maintainer who runs the script by hand and commits the result. Both sub-claims hold: (1) the unpinned staging source with no SHA in the meta, and (2) no content validation beyond cle…
- Live state the repo cannot show: None. The committed JSON is what ships, and whether the current tables are clean depends only on what the 2026-08-21 staging head contained.

## Fix
- Resolve the Teamcraft staging HEAD to a SHA the way build-acquisition.ts pinTeamcraft does, fetch from that SHA, and record it (plus a sha256 of each file) in meta.sources. Record the local clone's `git rev-parse HEAD` and fail instead of falling back to 'master'. Add a content gate that rejects names containing C0/C1 controls, bidi overrides or over-long values (U+200F is already allow-listed in discord-worker's co…

## Status
OPEN — future-builder remediation prepared in A-API: immutable validated source commits, exact-byte SHA256 per language, pinned local Git blobs, shared name cleaning and validation before writes; [API evidence](../evidence/remediation-api-2026-10-27.md). Historical tables and metadata are unchanged; their source provenance remains unresolved pending a controlled data/font refresh. No historical SHA is invented, and source preparation does not close this finding.
