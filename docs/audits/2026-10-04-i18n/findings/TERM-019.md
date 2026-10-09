# TERM-019: Policy prose names four tools differently from their UI titles
**Tier:** P3 · **Locale(s):** en · **Deploy unit:** apps/web-app + apps/discord-worker · **Term source:** `en.json` `tools.*.title` · **Origin:** MAIN

## Location
- `apps/web-app/TERMS_OF_SERVICE.md:15-17` "Comparison", "Accessibility checker", "Budget finder", "community Presets browser"; `PRIVACY.md:8-9` also "Gradient, Mixer"
- `apps/discord-worker/TERMS_OF_SERVICE.md:29-31` "Budget Alternatives"; UI: "Dye Comparison", "Accessibility Checker", "Budget Suggestions", "Community Presets" (`en.json:51,56,71,77`)

## Evidence
- Three names for the budget tool alone. The Glamour Reader is named consistently.

## Fix
- Quote the `tools.*.title` values in both English documents (the bot ToS may keep the command name too) and carry them to the five variants.

## Status
FIX COMMITTED, NOT DEPLOYED — `bf332ddd` + `e7ad0bc8`. The bot Terms keep "Budget Alternatives", the bot's own result title (`budget.findTitle`), beside `/budget`. (branch `fix/remediation-2026-10-04-sprint7`, web-app 5.14.5, discord-worker 5.8.3; PR #249, open, stacked on #248). Documents only: live when merged (served from `main`).
