# FINDING-012: swatch.charaHint and the LOCAL ONLY chip say 'Nothing is uploaded', but the Glamour Reader POSTs gear and glasses ids to /v1/chara/resolve
**Severity:** LOW · **Exposure:** INTERNET-UNAUTH · **Deploy unit:** web-app · **Rotation:** NONE · **Policy:** CORRECT apps/web-app/src/locales/*.json §swatch.charaHint (PRIVACY.md §Character files is already correct) — variants: `apps/web-app/src/locales/en.json`, `apps/web-app/src/locales/ja.json`, `apps/web-app/src/locales/ko.json`, `apps/web-app/src/locales/zh.json`, `apps/web-app/src/locales/de.json`, `apps/web-app/src/locales/fr.json` · **CWE:** CWE-1059
**Reconcile case:** 3 (Step 3a)

## Location
- apps/web-app/src/locales/en.json:1204 — swatch.charaHint: "Parsed on this device. Nothing is uploaded — …" (the same claim at line 1204 of ja/ko/zh/de/fr.json)
- apps/web-app/src/components/chara-file-card.ts:140-146,192,270-271 — the hint is rendered under the card and in the drop zone, and is the title of the LOCAL ONLY chip; glamour-tool.ts:84-90 mounts this card
- apps/web-app/src/components/glamour-block.ts:361 → services/chara-resolve-service.ts:127-140 — POST ${apiWorkerBase}/v1/chara/resolve with {gear, glasses}

## Evidence
- en.json:1204  "charaHint": "Parsed on this device. Nothing is uploaded — the file holds a character name and sometimes a screenshot."
- chara-resolve-service.ts:127-139  const body = { gear }; if (glassesId && glassesId > 0) body.glasses = glassesId; … fetch(`${getApiWorkerBase()}/v1/chara/resolve`, { method: 'POST', … body: JSON.stringify(body) })
- PRIVACY.md:35-37  "…the app asks our API for the item behind each slot. The request carries only the equipment model numbers from the file and the id of its facewear…" (the policy is accurate; only the UI string contradicts it)

## Fix
- Give the Glamour Reader's CharaFileCard its own hint, e.g. 'Parsed on this device. Only the gear model numbers are sent, to look up item names. The name and colors stay here.', and make the LOCAL ONLY chip conditional, or relabel it there. The Swatch Matcher, which does not call resolve, can keep the current string.
- Apply the new or changed key to all six locale files (en/ja/ko/zh/de/fr) and keep the i18n parity and same-English gates green.
- No change to PRIVACY.md: §Character files already describes the request correctly.

## Status
FIX COMMITTED, NOT DEPLOYED — `3daa83fd` (local branch `fix/security-2026-10-03-sprint2`, web-app 5.13.4; not pushed); all six locale variants.
