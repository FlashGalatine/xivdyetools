# TERM-018: English calls the Glamour list "Equipment list" in its toasts, and its download "Export .md" then "Save .md"
**Tier:** P3 · **Locale(s):** en · **Deploy unit:** apps/web-app · **Term source:** the list's own title, "Glamour list" · **Origin:** MAIN

## Location
- `apps/web-app/src/locales/en.json:1399` title "Glamour list" (quoted by `PRIVACY.md:51`) vs `:1266-1268` "Equipment list copied…" / "Couldn't save the equipment list"
- `:1265` "Export .md" opens the sheet (`glamour-block.ts:720`), whose button says "Save .md" (`:1414`)

## Evidence
- Two names for one list and two verbs for one download in the same flow.

## Fix
- "Glamour list" in the three toasts; one verb on both buttons.

## Status
OPEN
