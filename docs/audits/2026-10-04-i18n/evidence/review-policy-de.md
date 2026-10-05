# Review: policy-de (German policy documents), 2026-10-04

Rules: reviewer-brief.md. Compared HEAD English vs HEAD German, sentence by sentence, for every section
touched by the *.main.diff (BASE to MAIN) and *.pr.diff (MAIN to HEAD) of the four document pairs.
UI labels checked against apps/web-app/src/locales/de.json (web) and packages/bot-logic/.../de.json (bot).

## Candidates

- **POL-DE-1 (I18N, P2, origin MAIN)** `apps/web-app/TERMS_OF_SERVICE.de.md:17-19`. The German says
  "Zehn Werkzeuge laufen in deinem Browser: Paletten-Extraktor, ..., Farbmuster-Matcher und der
  Community-Presets-Browser" and names nine. English (`TERMS_OF_SERVICE.md:15-17`) lists ten and names
  "Glamour Reader" between Swatch Matcher and Presets browser. The MAIN change (*.main.diff) bumped
  Neun to Zehn but never added **Projektionsleser** (de.json `tools.glamour.title`). The count
  contradicts the list and a tool name is missing from the policy's "What the site does". Fix: insert
  "Projektionsleser," after "Farbmuster-Matcher,".
- **POL-DE-2 (I18N, P3, English side, locale en, origin PR#223)** `apps/web-app/PRIVACY.md:168`.
  "An action on a preset (such as approve, reject or revert) names the preset, and is kept as long as
  the preset exists. A ban, unban, hide or restore also names the account ... deleted after 12 months,
  or sooner for a hide or restore if its preset is deleted." Hide and restore are also actions on a
  preset (the clause itself ties them to the preset), so the two retention rules overlap. The Discord
  policy resolves it with "Other moderation-log entries about a preset" (`PRIVACY_POLICY.md:191`). The
  German (`PRIVACY.de.md:191-197`) had to copy the same ambiguity. Fix in English: "Any other action on
  a preset".
- **POL-DE-3 (I18N, P3, English side, locale en, origin PR#223)** `apps/web-app/PRIVACY.md:151`
  (also `apps/discord-worker/PRIVACY_POLICY.md:116`). "Posts made since the *Last updated* date above do
  not show your Discord user ID; older posts may." The reference date moves with every later edit of
  the document, so the promise silently widens or narrows. German (`PRIVACY.de.md:171-173`) follows.
  Fix in English: name the fixed date.

## Verified equal (no finding)

Web PRIVACY.de (HEAD): facewear id, XIVAPI sentence, "not the dyes", acquisition source returned from
host; localStorage list and the six "what clears what" bullets (labels equal de.json: Erweiterte
Einstellungen, Einstellungen zurücksetzen, Favoriten löschen, Gespeicherte Paletten löschen, Sammlungen
verwalten, Sammlung löschen, Ausrüstungsliste, Alles zurücksetzen); preview-image exception (WebP,
hosts, moderator approval); item 3 account record (Discord id + display name / username fallback;
XIVAuth id + character name; "XIVAuth User" + first 8 chars; linked Discord id; name refresh on sign-in
not while banned; account-link migration; submission counts as vote; held-edit version kept until
restored or deleted; remove image via edit form / My Submissions); example-link paragraph and site
list; whole "what we keep" section (30 days daily limits, 30/90 days failed notifications, ban record
90 days after lift, 12 months moderation log, two private channels, no user id since date);
"Deleting your data" (30 days, subject line, Discord DM, active-ban exception, vote button labels
Abstimmen / Abgestimmt equal de.json); verify step; Questions.
Web TERMS.de: accounts bullet (display name / character name / linked Discord id), XIVAPI bullet,
dye-card link list, example-link bullet, "Datenschutzhinweise" = title of PRIVACY.de.md.
Discord PRIVACY_POLICY.de: display-name rows, preference timestamp, held-edit version, vote rule,
Moderationsdatensätze, .chara section (in-memory, discarded, model numbers + facewear id to our API,
nothing about you), XIVAPI row, Discord posts row, D1 row, deletion paragraph, retention rows (all
numbers 30 / 90 days, 12 months equal).
Discord TERMS.de: six new feature bullets, "dye and item names", XIVAPI paragraph.
Register: du throughout, operator "wir"/"uns", no "Unternehmen". Market Board = Marktbrett; Glamour =
Projektion(sleser); Facewear slot = Gesichtsaccessoires (dictionary Equipment Slots); Farbstoff for dye;
Sammlung only for collections (batches are Stapel); Server vs Welt distinct.

## Rejected

- Tool names Verlauf / Mixer (PRIVACY.de) vs Verlauf-Ersteller / Farbstoffmixer (TERMS.de): English
  uses the same short/long split, so it mirrors the source.
- tools.presets de.json "Community-Vorlagen" vs policies' "Community-Presets": settled at the
  2026-09-19 audit (policies were corrected to Preset); only 2 Vorlage keys remain in de.json, both
  outside this slice.
- Item 2 "Ausrüstungsnamen und -symbole" omits acquisition source: identical staleness in English.
- Line-wrap oddities (PRIVACY.de.md:9-10, 104-106; PRIVACY_POLICY.de.md:70-71) are cosmetic and
  invisible when rendered.
- British "colour/favourite" in the English documents: covered by the american-spelling sweep.

## Files covered

apps/web-app/PRIVACY.md + .de.md, TERMS_OF_SERVICE.md + .de.md; apps/discord-worker/PRIVACY_POLICY.md
+ .de.md, TERMS_OF_SERVICE.md + .de.md (HEAD) and their eight *.main.diff / *.pr.diff pairs.
