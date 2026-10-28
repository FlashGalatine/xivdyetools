# FINDING-003: Swatch 'Save character colors' names its local record after the .chara nickname or file name, and PRIVACY.md tells users to rename or delete that record with controls the v4 UI does not expose
**Severity:** LOW · **Exposure:** INTERNET-UNAUTH · **Deploy unit:** web-app (code + PRIVACY.md and its 5 locale siblings) · **Rotation:** NONE · **Policy:** CORRECT apps/web-app/PRIVACY.md "Character files (.chara)" bullet 2 (lines 36-40); code fix preferred for the nickname default (Step 3a case 1) · **CWE:** CWE-359
**Merged:** G25 (same root cause) · **Coordinator note:** the verifiers' suggested fix ("rename and delete through Manage Collections") is wrong. Production Harmony probed 2026-10-26: the v4 Favorites panel has no Manage button and the dye-selector component that carried it is not rendered, so PRIVACY.md:61-62 ("no delete control") is accurate and :36-40 ("rename or delete the record") is the false sentence.

## Location
- `apps/web-app/src/components/chara-sheet.ts:210` — Swatch 'Save character colors' always names its local `kind: 'character'` record `nickname.trim() || fileName || default`; there is no name field
- `apps/web-app/PRIVACY.md:39` — "rename or delete the record" offers per-record controls the v4 app does not expose (Rename `updateCollection` and delete `deleteCollection` exist only in `collection-manager-modal.ts:198,:460`, opened only from `dye-selector.ts:565`)

## Evidence
- chara-sheet.ts:210-214 `const base = ( resolved.nickname?.trim() || fileName || LanguageService.t('swatch.characterDefaultName') ).slice(0, 50);` and :223 `createCollection(name, undefined, { kind: 'character' })`. The glamour palette save (glamour-block.ts:1816-1825) takes a typed draft first; the Swatch save does not, so every Swatch character save stores the nickname or file name in the browser's localStorage.
- PRIVACY.md:36-40 discloses the fallback only for "a glamour or its palette" saved "without typing a name" and tells the user to "rename or delete the record". No reachable v4 control renames a record or deletes just one: v4-layout.ts passes one panel for both sides and the live Harmony tool shows no Manage button. The only deletion routes are Advanced Settings → Clear Saved Palettes (palette-kind records only) and clearing site data.
- Reach: any visitor loads a .chara with a nickname or a meaningful file name in the Swatch Matcher and clicks "Save character colors" (chara-file-card.ts:364-375 → swatch-tool.ts:1385). Impact is browser-local; it matters on a shared device and because the policy promises a control that is not there.

## Fix
- Minimize first: name the record with the localized default (`swatch.characterDefaultName`, numbered by `uniqueCollectionName`) or add a name field that starts empty, as the glamour save does.
- CORRECT PRIVACY.md:36-40 in all six variants: replace "rename or delete the record" with the controls that exist (Advanced Settings → Clear Saved Palettes removes saved palettes; clearing site data removes everything). Variants: PRIVACY.ja.md:18, PRIVACY.ko.md:18, PRIVACY.zh.md:18, PRIVACY.de.md:43-44, PRIVACY.fr.md, plus the English file. :61-62 stays as written.
- **Maintainer decision:** restore an in-app per-record rename/delete control in v4 (then the text becomes true) or correct the text as above.

## Status
OPEN — security-only A-WEB implementation and reviews prepared in web 5.16.4; local full-repository verification and affected CI/beta pass; prerequisite publication and production acceptance remain release gates. [A-WEB evidence](../evidence/remediation-web-security-2026-10-28.md).
