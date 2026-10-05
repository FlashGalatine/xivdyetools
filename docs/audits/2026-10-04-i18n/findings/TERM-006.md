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
OPEN
