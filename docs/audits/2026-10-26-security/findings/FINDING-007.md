# FINDING-007: fr policy says 'Effacer les palettes sauvegardées' deletes all 'palettes enregistrées', which the fr UI uses as its name for saved presets; the control leaves v5_saved_presets intact
**Severity:** LOW · **Exposure:** INTERNET-UNAUTH · **Deploy unit:** web-app (PRIVACY.fr.md policy translation) · **Rotation:** NONE · **Policy:** CORRECT apps/web-app/PRIVACY.fr.md § Ce qui est stocké sur votre appareil (and add saved presets to PRIVACY.md § What is stored on your device for parity) · **CWE:** n/a

## Location
- `apps/web-app/PRIVACY.fr.md:70` — fr policy says 'Effacer les palettes sauvegardées' deletes all 'palettes enregistrées', which the fr UI uses as its name for saved presets; the control leaves v5_saved_presets intact

## Evidence
- PRIVACY.fr.md:70 '**Paramètres avancés → Effacer les palettes sauvegardées** supprime d'un seul coup toutes vos palettes enregistrées'; advanced-options-panel.ts:268 'const deleted = CollectionService.deleteCollectionsByKind('palette');'; fr.json:1006 'Les palettes enregistrées restent sur cet appareil'
- Reach: Any French reader of the published privacy policy who has saved community presets clicks Advanced Settings -> Effacer les palettes sauvegardées, expecting the presets to be gone as PRIVACY.fr.md:70-71 says. advanced-options-panel.ts:264-271 runs only CollectionService.deleteCollectionsByKind('palette'), so the localStorage key v5_saved_presets (saved-presets-service.ts:22, snapshots with author, :36) stays.
- PRIVACY.fr.md:70-71 says the control deletes 'toutes vos palettes enregistrées'. fr.json:1006 (signinBlurb), :1010 (gateSave 'Enregistrer des palettes') and :1060 (cfgKeepDeletedDesc 'Une palette enregistrée…') all use that same phrase for saved presets. The code at advanced-options-panel.ts:268 clears only palette-kind collections. The effect is an over-promise about deleting data kept on the user's own device: nothing is uploaded, so it is harmless, but the policy text is false (LOW). Preconditions: The reader has saved at least one community preset in the Presets tool and reads the fr (or ja/ko) policy. No server-side data is involved.

## Fix
- CORRECT the 'Ce qui est stocké sur votre appareil' bullet: say that saved community presets (the Presets shelf) are not cleared by this control; they are removed one at a time with the save toggle, or all at once with the browser's site-data controls. Add the matching saved-presets line to PRIVACY.md and every locale sibling so the versions stay in step. A code alternative is to have the control also clear SavedPres…
- Policy variants to edit (all in one commit, all `Last updated` lines bumped): Same term collision in PRIVACY.ja.md:27, where the control '保存したパレットをクリア' is the same phrase ja.json:1006/1010 use for saved presets ('保存したパレット', 'パレット保存'). PRIVACY.ko.md:27 has it too: '저장된 팔레트' against ko.json:1006 '저장한 팔레트' and gateSave '팔레트 저장'. PRIVACY.de.md:66 is weaker: 'Gespeicherte Paletten' against de.json 'Gemerkte Paletten'/'Paletten merken'. PRIVACY.zh.md:27 does not collide ('调色板' against zh.json '配色')…

## Status
OPEN — security-only A-WEB implementation and reviews prepared in web 5.16.4; local full-repository verification and affected CI/beta pass; prerequisite publication and production acceptance remain release gates. [A-WEB evidence](../evidence/remediation-web-security-2026-10-28.md).
