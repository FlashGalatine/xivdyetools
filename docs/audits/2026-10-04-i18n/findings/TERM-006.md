# TERM-006: German web-app names a preset three ways: Voreinstellung, Preset and Vorlage
**Tier:** P2 · **Locale(s):** de · **Deploy unit:** apps/web-app · **Term source:** the repo's own choice: the tool title, the bot and og-worker say Vorlage · **Origin:** MAIN

## Location
- `apps/web-app/src/locales/de.json:875` "Voreinstellungen werden geladen…" (24 values say Voreinstellung); 16 say Preset ("Preset löschen")
- tool title "Community-Vorlagen" (`de.json:71`); the bot uses Vorlage (60 values), and so does og-worker

## Evidence
- Preset is an app noun, not a game noun, so the repo's own title settles the word.

## Fix
- Move the Voreinstellung and Preset values to Vorlage, and add a glossary row for Preset.

## Status
FIX COMMITTED, NOT DEPLOYED — `31c8914f` + `c88d51c6` (review follow-ups) (branch `fix/remediation-2026-10-04-sprint6`, web-app 5.14.4, core 5.8.2; PR #248, open, stacked on #247).
