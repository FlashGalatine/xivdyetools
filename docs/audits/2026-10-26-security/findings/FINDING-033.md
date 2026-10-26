# FINDING-033: de/fr web-app privacy policies narrow the .chara character-name never-clause from 'other people' to 'other players'
**Severity:** INFO · **Exposure:** INTERNET-UNAUTH · **Deploy unit:** web-app (policy translations de, fr) · **Rotation:** NONE · **Policy:** CORRECT apps/web-app/PRIVACY.de.md § Charakterdateien (.chara) bullet 1; CORRECT apps/web-app/PRIVACY.fr.md § Fichiers de personnage (.chara) bullet 1 · **CWE:** n/a

## Location
- `apps/web-app/PRIVACY.de.md:36` — de/fr web-app privacy policies narrow the .chara character-name never-clause from 'other people' to 'other players'
- `apps/web-app/PRIVACY.fr.md:38` — PRIVACY.fr.md narrows the .chara character-name promise from 'other people' to 'other players'

## Evidence
- PRIVACY.md:32-33 "anything else other people can see" / PRIVACY.de.md:36 "das andere Spieler sehen können" / PRIVACY.fr.md:38 "visible par d'autres joueurs"
- Reach: Anyone can read the published policy text. No attacker path exists: the character name is never sent off-device, the submit name field starts empty (glamour-block.ts:1660), and the nickname fallback only labels local browser storage (glamour-block.ts:1821, chara-sheet.ts:211).
- Confirmed at file:line. PRIVACY.md:32-33 says "other people", PRIVACY.de.md:36 says "andere Spieler" and PRIVACY.fr.md:38 says "d'autres joueurs"; ko ("다른 사람") and zh ("任何其他人") match the English. Both narrowed sentences are still true, because no code path shows the name to anyone and each sentence first says the name is "never sent anywhere". So this is a translation-fidelity gap, not false policy text, and it rates INFO rather than LOW. Preconditions: Both sub-claims (de, fr) are real. Neither has a practical effect, because the character name never leaves the device.

## Fix
- Translation fix only, no code change: de "das andere Personen sehen können", fr "visible par d'autres personnes".
- Also consider ja PRIVACY.ja.md:17 "他のユーザー" (other users) -> "他の人", which narrows the clause the same way.
- Policy variants to edit (all in one commit, all `Last updated` lines bumped): apps/web-app/PRIVACY.de.md:36 and apps/web-app/PRIVACY.fr.md:38 are in scope. apps/web-app/PRIVACY.ja.md:17 ("他のユーザーに見える形") narrows the clause the same way but is not in this group. ko (PRIVACY.ko.md:17) and zh (PRIVACY.zh.md:17) are faithful to the English. No src/locales/*.json key carries this clause: git grep finds the phrase only in the PRIVACY.*.md files.

## Status
OPEN
