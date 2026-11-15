# FINDING-012: ToS appeal steps demand a Discord user ID that XIVAuth-only accounts do not have; PRIVACY's request route accepts the author name
**Severity:** LOW · **Exposure:** INTERNET-UNAUTH · **Deploy unit:** web-app (policy docs served as static TERMS_OF_SERVICE*.md) · **Rotation:** NONE · **Policy:** CORRECT TERMS_OF_SERVICE.md "Appeals and removal" step 3 (align with PRIVACY.md "Deleting your data") · **CWE:** CWE-451

## Location
- `apps/web-app/TERMS_OF_SERVICE.md:75` — ToS appeal steps demand a Discord user ID that XIVAuth-only accounts do not have; PRIVACY's request route accepts the author name

## Evidence
- TERMS_OF_SERVICE.md:75 "3. Include your Discord user ID and the name of the preset"; PRIVACY.md:266-267 "include your Discord user ID or the author name shown on your presets"
- Reach: Any visitor opens the ToS (linked from the About modal) and follows "Appeals and removal". A user who signed in only through XIVAuth is told to supply a Discord user ID that is not on their account record, so it cannot identify them.
- TERMS_OF_SERVICE.md:75 says "Include your Discord user ID and the name of the preset". The same document's Accounts section (lines 28-34) says the record holds a Discord user ID only when the XIVAuth account is linked to Discord. PRIVACY.md:266-267 accepts "your Discord user ID or the author name shown on your presets", so the two documents disagree. An XIVAuth-only user either cannot follow the step or hands over a Discord ID that doesn't match their record, which is unneeded personal data. The doc doesn't promise anything about storage, and no code collects data here, so this is LOW: policy text that is false for one class of acc… Preconditions: The user signed in through XIVAuth with no linked Discord account. Users who sign in with Discord, or whose XIVAuth account is linked to Discord, are not affected.

## Fix
- Change appeal step 3 to the PRIVACY wording: say whether you sign in with Discord or XIVAuth, and give your Discord user ID or the author name shown on your presets, plus the preset name. Apply the same change to all five locale siblings.
- Policy variants to edit (all in one commit, all `Last updated` lines bumped): apps/web-app/TERMS_OF_SERVICE.ja.md:49, TERMS_OF_SERVICE.de.md:83, TERMS_OF_SERVICE.fr.md:85, TERMS_OF_SERVICE.ko.md:49, TERMS_OF_SERVICE.zh.md:49. No src/locales/*.json key holds the appeal steps (git grep found none).

## Status
OPEN
