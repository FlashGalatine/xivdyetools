# FINDING-022: Bot privacy policy §3 says a .chara file is read only for colors, dyes and equipment, but /swatch and /glamour also read the clan, gender and producing tool and show them on the public card
**Severity:** LOW · **Exposure:** INTERNET-AUTH · **Deploy unit:** discord-worker (policy) · **Rotation:** NONE · **Policy:** CORRECT apps/discord-worker/PRIVACY_POLICY.md §3 "Character Files" item 2 · **CWE:** n/a

## Location
- `apps/discord-worker/PRIVACY_POLICY.md:88` — Bot privacy policy §3 says a .chara file is read only for colors, dyes and equipment, but /swatch and /glamour also read the clan, gender and producing tool and show them on the public card

## Evidence
- PRIVACY_POLICY.md:88 "2. Read for its colors, dyes and equipment"; swatch.ts:477-479 charSub = [[tribeDisplay(projected.tribe, locale), genderSymbol(projected.gender)]..., producerToken(projected.producer)]; glamour.ts:549 same; response.ts:118 deferredResponse(ephemeral = false)
- Reach: A Discord user runs /swatch or /glamour with a .chara attachment (a signed interaction). The handler returns a non-ephemeral deferredResponse() (apps/discord-worker/src/handlers/commands/swatch.ts:84, glamour.ts:118; response.ts:118 defaults ephemeral=false), and bot-logic builds the card header with tribeDisplay/genderSymbol/producerToken (packages/bot-logic/src/commands/swatch.ts:477-482, glamour.ts:549), so the clan, gender symbol and producer token show up in the channel.
- PRIVACY_POLICY.md:88 lists only "colors, dyes and equipment" as what the file is read for. The code also reads Tribe and Gender (they select the race-specific color sheet, swatch.ts:310) and a fixed producer token (BRIO/KTISIS/ANAMNESIS allowlist, chara-identity.ts:75-85), and prints them on the card the bot posts publicly. Nothing is stored, logged or sent anywhere else, and the 2026-10-15 positive control covers only nickname omission and the producer allowlist, not this policy wording. So the policy is incomplete but harmless: LOW. Preconditions: The user uploads their own .chara file and runs the command in a channel. The clan, gender and producer belong to the game character and the user chose to share them. Only allowlisted producer tokens print, and the nickname never does.

## Fix
- Change §3 Character Files item 2 to also name the character's clan and gender and the tool that saved the file, and say the card shows them. Bump Last Updated in all six variants and add a CHANGELOG entry. No code change is needed.
- Policy variants to edit (all in one commit, all `Last updated` lines bumped): apps/discord-worker/PRIVACY_POLICY.md:88, PRIVACY_POLICY.ja.md:90, PRIVACY_POLICY.de.md:111, PRIVACY_POLICY.fr.md:88, PRIVACY_POLICY.ko.md:88, PRIVACY_POLICY.zh.md:88 (also bump Last Updated in each). No locales/*.json key carries this policy sentence (git grep for the phrase finds only the .md files).

## Status
OPEN
