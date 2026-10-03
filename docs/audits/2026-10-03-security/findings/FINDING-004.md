# FINDING-004: Web sign-in copy (preset.privacyNote: 'No character data'), PRIVACY.md item 3 and TERMS_OF_SERVICE §Accounts say 'username', but oauth stores and presets-api publishes the Discord global name or the XIVAuth verified character name, plus a linked Discord id
**Severity:** MEDIUM · **Exposure:** INTERNET-UNAUTH · **Deploy unit:** web-app + oauth · **Rotation:** NONE · **Policy:** AMEND apps/web-app/PRIVACY.md §Network access item 3; apps/web-app/TERMS_OF_SERVICE.md §Accounts; apps/web-app/src/locales/*.json preset.privacyNote — variants: `apps/web-app/PRIVACY.md`, `apps/web-app/PRIVACY.ja.md`, `apps/web-app/PRIVACY.ko.md`, `apps/web-app/PRIVACY.zh.md`, `apps/web-app/PRIVACY.de.md`, `apps/web-app/PRIVACY.fr.md`, `apps/web-app/TERMS_OF_SERVICE.md`, `apps/web-app/TERMS_OF_SERVICE.ja.md`, `apps/web-app/TERMS_OF_SERVICE.ko.md`, `apps/web-app/TERMS_OF_SERVICE.zh.md`, `apps/web-app/TERMS_OF_SERVICE.de.md`, `apps/web-app/TERMS_OF_SERVICE.fr.md`, `apps/web-app/src/locales/en.json`, `apps/web-app/src/locales/ja.json`, `apps/web-app/src/locales/ko.json`, `apps/web-app/src/locales/zh.json`, `apps/web-app/src/locales/de.json`, `apps/web-app/src/locales/fr.json` · **CWE:** CWE-359
**Regression of / supersedes:** 2026-08-29-security/FINDING-002 · **Reconcile case:** 2 (Step 3a) · **Why AMEND:** the corrected text must name fields the current text does not (the verified character name as username / author name, and a second, linked Discord id), so it is a new public commitment.

## Location
- apps/oauth/src/handlers/xivauth.ts:343-358: displayName = verifiedCharacter?.name, username = displayName ?? 'XIVAuth User …', then findOrCreateUser({xivauth_id, discord_id: linkedDiscordId, username}) INSERTs both into users (user-service.ts:111-114); presets-api uses auth.userName as author_name (presets.ts:1029)
- apps/web-app/src/locales/en.json:1033 (preset.privacyNote, same text at line 1033 in ja/ko/zh/de/fr): 'your Discord or XIVAuth ID and username … No character data, no email, nothing sold.'
- apps/web-app/PRIVACY.md:65-68 (§Network access item 3): sign-in creates 'an account record — your provider ID and username'; no mention of a character name or of a second, linked Discord id

## Evidence
- xivauth.ts:343-344,358,377: `const displayName = verifiedCharacter?.name ?? null;` / `const username = displayName ?? \`XIVAuth User ${xivauthUser.id.slice(0, 8)}\`;` / `discord_id: linkedDiscordId,` / `global_name: displayName, // verified character name only`
- en.json:1033: "Signing in creates an account record: your Discord or XIVAuth ID and username. Your display name appears on presets you submit. No character data, no email, nothing sold." Every sibling locale says the same thing, e.g. de 'Keine Charakterdaten' and ja 'キャラクター情報も…取得せず'
- Prior audits: FINDING-002 (2026-08-29) closed with 114f6dde, which rewrote this copy but kept 'No character data'. Neither security-trade-offs.md nor the Rejected suspicions / Positive controls of the 2026-08-29 or 2026-09-15 reports accepts a character name as the stored username. PRIVACY.md:93 and :123 cover outbound links and analytics events only.

## Fix
- Two parts. **Now (CORRECT):** remove the false "No character data" clause from `preset.privacyNote` in all six locales — wrong today whatever is decided. **Later (AMEND):** decide minimization first (§8): keep the verified character name as the stored username and public author name, or store an opaque label / ask the user to type an author name, and stop storing the linked Discord id unless presets-api needs it (see FINDING-014).
- Then rewrite `preset.privacyNote` in all six locale JSONs (remove "No character data"; run `pnpm --filter xivdyetools-web-app run validate:i18n` and the parity gates) and AMEND PRIVACY.md item 3 + ToS §Accounts (twelve files, all `Last updated` bumped) to name exactly what the chosen design stores.
- Add a copy-parity test tying the modal claim to `xivauth.ts` so it cannot drift again (it drifted after the 2026-08-29 fix `114f6dde`).

## Status
OPEN
