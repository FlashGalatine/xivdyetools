# FINDING-034: de preset.shotSlot caption omits the "not uploaded" assurance the other five locales carry
**Severity:** INFO · **Exposure:** INTERNET-UNAUTH · **Deploy unit:** web-app (locale de) · **Rotation:** NONE · **Policy:** CORRECT apps/web-app/src/locales/de.json preset.shotSlot (translation parity with en.json preset.shotSlot; the PRIVACY.md example-link paragraph, lines 129-133, needs no chan… · **CWE:** n/a

## Location
- `apps/web-app/src/locales/de.json:982` — de preset.shotSlot caption omits the "not uploaded" assurance the other five locales carry

## Evidence
- de.json:982 "shotSlot": "PROJEKTIONSBILD · VERLINKT" vs en.json:982 "GLAMOUR SHOT · LINKED, NOT UPLOADED"; de.json:1034 fieldLinkHint "Gespeichert wird der Link, nie eine Kopie des Bildes"
- Reach: Any visitor using the German UI who opens a community preset that has an example link sees the caption, in preset-detail.ts:1002 and in preset-card.ts:336 when the card has no preview image. It needs no sign-in.
- The facts check out. de.json:982 reads "PROJEKTIONSBILD · VERLINKT", while en/fr/ja/ko/zh all say the image is linked and not uploaded (or that only the link is stored). The English assurance is true: R2 preview images come only from a separate author upload (presets-api handlers/presets.ts:1266-1314), never from a copy of the example link. The German text is therefore incomplete but not false, and de preset.fieldLinkHint (de.json:1034) still tells the author at submission time that only the link is stored. That makes this a translation-parity gap with no privacy effect, so it is INFO rather than LOW. Preconditions: The UI language is de, and the preset has an exampleLink. On the card the caption shows only when the preset has no previewImageUrl.

## Fix
- Restore the assurance in de preset.shotSlot, for example "PROJEKTIONSBILD · NUR LINK, KEINE KOPIE" or "· VERLINKT, NICHT HOCHGELADEN". Keep it short because it is an uppercase label. Fold it into the next web-app i18n pass; it does not need its own security sprint item.
- Policy detail: CORRECT apps/web-app/src/locales/de.json preset.shotSlot (translation parity with en.json preset.shotSlot; the PRIVACY.md example-link paragraph, lines 129-133, needs no change)
- Policy variants to edit (all in one commit, all `Last updated` lines bumped): Only apps/web-app/src/locales/de.json preset.shotSlot. en, fr, ja, ko and zh already carry the assurance, and PRIVACY.de.md is unaffected.

## Status
OPEN — security-only A-WEB implementation and reviews prepared in web 5.16.4; affected CI, whole-graph verification and production acceptance remain release gates. [A-WEB evidence](../evidence/remediation-web-security-2026-10-28.md).
