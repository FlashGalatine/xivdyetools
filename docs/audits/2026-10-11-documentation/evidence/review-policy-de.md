# German (de) policy translations - meaning review (2026-10-11)

Scope: 4 variants, each read in full against its English file at HEAD 42c35e87 (== served 16a6123f for app code).
UI labels verified against apps/web-app/src/locales/de.json and packages/bot-logic/src/i18n/locales/de.json;
game nouns against docs/reference/ffxiv-terminology.md.

Checks run for every document: English-prevails notice present and linked; operator voice (wir, not "unser Unternehmen" - git grep for Unternehmen/Firma/Gesellschaft over all four: 0 hits); governing-law / liability / survival clauses read twice; one-word-two-things (Sammlung vs Stapel); retention numbers; section cross-references; hard-wrap (n/a, German).

## apps/web-app/PRIVACY.de.md vs PRIVACY.md

Result: no meaning divergence found. 12 sections compared one by one.
- Notice (l.3): localized, links PRIVACY.md. OK.
- Intro, Images, Character files, On-device storage, Network access (items 1-5 + "Links that take you to other sites"), Community presets: what we keep (daily limits 30 d, failed notifications 30/90 d, ban records 90 d, moderation log 12 months, 2026-10-05 Discord-ID date), Usage analytics, IP address and logs (60 s / 120 s), How to verify, Deleting your data (30 days, ban carve-out), Questions: all claims, numbers and exceptions present and equal.
- Quoted UI labels verified against de.json: "Über XIV Farbwerkzeuge" (header.about), "RICHTLINIEN" (about.policiesLabel), "Datenschutz" (about.privacyPolicy), "Einstellungen zurücksetzen", "Favoriten löschen", "Gespeicherte Paletten löschen" (config.*), "Sammlungen verwalten" / "Sammlung löschen" (collections.*), "Analysen aktivieren" (config.enableAnalytics), "Marktbrett aktivieren" (config.enableMarketBoard), "Meine Einreichungen" (preset.mySubmissions), "Abstimmen"/"Abgestimmt" (preset.vote/voted), "Alles zurücksetzen" and "Ausrüstungsliste" (glamour.sheet.reset/title), "Öffnen in…" (swatch.itemLinks.openIn), "Bilder werden im Browser gelesen und nie hochgeladen" (l.303 of de.json, exact). All current.
- Tool names match tools.*.title (Paletten-Extraktor, Harmonie-Explorer, Farbstoffvergleich, Verlauf-Ersteller, Farbstoffmixer, Barrierefreiheitsprüfung, Budget-Vorschläge, Farbmuster-Matcher, Projektionsleser).
- Game nouns: Projektion (glamour, feminine, terminology l.322), Gesichtsaccessoires (facewear slot word, terminology l.62-64). OK.
- Sammlung is used only for saved collections; telemetry batches are "Stapel". OK.
- "Bezugsquellen" for the Acquisition lines matches de.json glamour cardNote (l.1384).
- Cross-refs *Community-Vorlagen: was wir aufbewahren* and *Deine Daten löschen* match the German headings.

## apps/web-app/TERMS_OF_SERVICE.de.md vs TERMS_OF_SERVICE.md

Result: no divergence. 13 sections compared.
- Accounts (XIVAuth fallback name, 8 chars, Discord link), licence (non-exclusive, no sale/sublicence), moderation (hold on flag or on no verdict), 7-day appeals, third-party list (Mirapri, Garland, Teamcraft, Gamer Escape, Lodestone, Saddlebag), Square Enix, age 13, availability, warranty/liability caps (incl. GIL), changes, ending, governing law (North Carolina; consumer-right saving clause "auf das du nach diesem Recht nicht verzichten kannst" is the correct non-waivable reading), contact: all present and equal.
- Notice present and linked. No company-voice error.

## apps/discord-worker/PRIVACY_POLICY.de.md vs PRIVACY_POLICY.md

Result: no claim differs. 12 numbered sections compared (section numbers verbatim).
- Data tables (Discord ID, author name incl. XIVAuth fallback, locale, guild/channel, preferences list incl. the 8 exclusion categories, favorites 50, first-run flag 180 d, submissions incl. held pre-edit version, votes), rate-limiting (60 s native / 120 s KV fallback, no IP), usage analytics (3 rows, 3 months / 30 d / 30 d, `usertrack:{date}:{userId}`), moderation records, "not collected" list, image and .chara handling, XIVAPI sentence, storage table (Discord row complete, 2026-10-05), operational logs, third parties, rights, deletion (30 days, active-ban carve-out), retention table (13 rows, all values equal), children, transfers, changes, contact: all present.
- Cross-refs *Nutzungsanalyse*, *Moderationsdatensätze*, *Datenaufbewahrung*, *Deine Rechte* match the German headings.
- Commands/options verbatim (`/preferences reset key:<preference>`; schemas.ts:802 confirms `key`).
- One register slip (cand-policy-de-01): table header "Ihre Datenschutzrichtlinie" (l.173).

## apps/discord-worker/TERMS_OF_SERVICE.de.md vs TERMS_OF_SERVICE.md

Result: no divergence. 12 sections compared.
- Feature list (incl. /glamour as "Projektionsleser", matches web tools.glamour.title), conduct, moderation clause, appeal steps, IP/fair use, licence, warranty, liability, modifications, termination, governing law and consumer saving clause ("unabdingbar" = non-waivable, correct), contact: equal.
- Notice present and linked; blockquote pointing at the web terms and the privacy policy preserved.

## Considered and not filed
- "Fair-Use-Regelung" (discord TOS l.102): adds "Regelung" to "fair use"; meaning intact, not a defect.
- Web TOS/PRIVACY "Ihr/Ihre/Sie" hits: all third-person (their/they), not formal address. Only the one table header above is a real slip.
- "Beschaffung" is the general de.json acquisition label but the glamour sheet uses "Bezugsquelle"; the policy follows the glamour sheet, which is the surface it describes.
- Date text "2026-10-09" instead of "October 9, 2026": fixed go-live-style ISO date, acceptable.
