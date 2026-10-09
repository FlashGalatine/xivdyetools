# TERM-010: French policy documents call a preset "palette prédéfinie"; the UI says "préréglage"
**Tier:** P2 · **Locale(s):** fr · **Deploy unit:** apps/web-app + apps/discord-worker · **Term source:** `fr.json` `tools.presets.title` "Préréglages communautaires" · **Origin:** MAIN (the PRs add more)

## Location
- all four fr documents, e.g. `apps/web-app/PRIVACY.fr.md:27`; web `TERMS_OF_SERVICE.fr.md:19` names the tool "navigateur de Palettes Prédéfinies communautaires"
- UI: `apps/web-app/src/locales/fr.json:71`; the bot says préréglage throughout

## Evidence
- A document quoting a tool or feature must use the shipped name (`policy-documents.md`). #223 and #230 add more instances in their hunks.

## Fix
- "préréglage(s)" in all four fr documents; add a glossary row for Preset.

## Status
FIX COMMITTED, NOT DEPLOYED — préréglage in all four French documents (`bf332ddd`, `e7ad0bc8`, `4e891868`, `ea041c74`); the glossary *Preset* entry names it. (branch `fix/remediation-2026-10-04-sprint7`, web-app 5.14.5, discord-worker 5.8.3; PR #249, open, stacked on #248). Documents only: live when merged (served from `main`).
