# FINDING-013: The ToS says the stored Discord name is always the display name, but oauth stores the username when there is no display name
**Severity:** LOW · **Exposure:** INTERNET-UNAUTH · **Deploy unit:** web-app (policy docs) · **Rotation:** NONE · **Policy:** CORRECT apps/web-app/TERMS_OF_SERVICE.md section "Accounts" (and every locale sibling) · **CWE:** CWE-451

## Location
- `apps/web-app/TERMS_OF_SERVICE.md:29` — The ToS says the stored Discord name is always the display name, but oauth stores the username when there is no display name

## Evidence
- callback.ts:242 `username: discordUser.global_name || discordUser.username,` vs TERMS_OF_SERVICE.md:29-30 "With Discord, the name is your display name."
- Reach: Anyone can read the public ToS from the About modal link (about-modal.ts:468, policyDocFile). A Discord user with no global_name who signs in through oauth /auth/callback gets a record holding their Discord username, which the ToS does not mention.
- In apps/oauth/src/handlers/callback.ts:242, findOrCreateUser stores `discordUser.global_name || discordUser.username`. TERMS_OF_SERVICE.md:29-30, and lines 20 (ja/ko/zh), 32-33 (de) and 34-35 (fr) of its locale siblings, all say the name is the display name and omit the username fallback. PRIVACY.md:85-86 does disclose that fallback, so the data is covered, but the ToS statement is false for users without a display name. Per the rubric, policy text that is false but harmless is LOW. The reviewer's INFO is close. Preconditions: The Discord account has a null global_name, which is uncommon but possible for legacy accounts. The fallback branch is tested at apps/oauth/src/__tests__/callback.test.ts:1087 and :1124.

## Fix
- Change the ToS sentence to "With Discord, the name is your display name, or your username if you have no display name," matching PRIVACY.md:85-86, in all six ToS files. No code change.
- Policy variants to edit (all in one commit, all `Last updated` lines bumped): apps/web-app/TERMS_OF_SERVICE.ja.md:20, apps/web-app/TERMS_OF_SERVICE.de.md:32-33, apps/web-app/TERMS_OF_SERVICE.fr.md:34-35, apps/web-app/TERMS_OF_SERVICE.ko.md:20, apps/web-app/TERMS_OF_SERVICE.zh.md:20. No locales/*.json key holds this text, because the ToS is linked as a per-locale .md file through policyDocFile.

## Status
OPEN — security-only A-WEB implementation and reviews prepared in web 5.16.4; affected CI, whole-graph verification and production acceptance remain release gates. [A-WEB evidence](../evidence/remediation-web-security-2026-10-28.md).
