# French (fr) policy translations: meaning review (2026-10-11)

Method: each variant read in full against its English file at HEAD 42c35e87 (line counts: discord-worker PRIVACY_POLICY 223/223, TERMS_OF_SERVICE 148/148; web-app PRIVACY 277 vs 331 wrapped, TERMS_OF_SERVICE 177 vs 193 wrapped). Quoted UI labels checked against apps/web-app/src/locales/fr.json and packages/bot-logic/src/i18n/locales/fr.json; game nouns against docs/reference/ffxiv-terminology.md.

Checks that passed on all four files: English-prevails notice at line 3, localized, links the English file in the same folder; no company wording for the operator ("nous" only; no "notre societe"); no "glamour" (policies use "mirage", masculine, per terminology.md L317-330); "tableau des ventes", "Monde", "centre de donnees", "accessoire de visage" (client string, terminology.md L392) all correct; command names, hostnames, storage names, section numbers and retention numbers (30/60/90/120 s/180 days/12 months/7 days/13) verbatim; the 2026-10-05 Discord-ID cutoff is a fixed date, not anchored to "Last updated"; governing-law, liability and survival clauses read twice, modifiers attach correctly; no hard-wrap issue (not CJK).

Quoted UI labels verified against web fr.json: "A propos de Outils de Teinture XIV" (header.about; shipped spelling, quoted exactly), POLITIQUES (about.policiesLabel), Confidentialite (about.privacyPolicy), "Les images sont lues dans votre navigateur et jamais envoyees." (matcher.privacyNote), Parametres avances, Reinitialiser les parametres, Effacer les favoris, Effacer les palettes sauvegardees, Activer les analyses, Activer le tableau des ventes, Gerer les collections, Supprimer la collection, "Liste d'equipement" (glamour.sheet.title), "Tout reinitialiser" (glamour.sheet.reset), Mes soumissions, Voter / Vote, Deconnexion, "Ouvrir dans..." (swatch.itemLinks.openIn), and all ten tool names (Explorateur d'harmonies, Extracteur de palette, Verification d'accessibilite, Comparaison de Teintures, Constructeur de Degrade, Melangeur de Teintures, Suggestions Budget, Nuancier, Lecteur de mirages, Preregalages communautaires). Bot labels: Clan, Genre, Monde / centre de donnees, "Mes soumissions" match bot-logic fr.json preferences.keys.*.

## apps/web-app/PRIVACY.fr.md vs PRIVACY.md
Sections compared (all): intro; Images and camera captures; Character files; What is stored on your device; Network access (items 1-5, links to other sites, example links); Community presets: what we keep (daily limits, Discord posts, failed notifications, ban records, moderation log); Usage analytics; Your IP address and logs; How to verify; Deleting your data; Questions.
Result: every section present and equivalent; no dropped obligation, no added claim. Retention numbers, the 2026-10-05 cutoff, GPC/Sec-GPC rule, doNotStore, ban-lift clearing, 30-day deletion SLA all match. Additions that are accurate: "(Voter / Voté)" and "(Déconnexion)" name the shipped buttons. "annule une modification" for "revert" (L196-198 area, also in bot policy) is an accurate gloss: presets-api revert route restores previous values of a flagged edit (apps/presets-api/src/handlers/moderation.ts:255-256). One wording item: L133 "hébergées par nous-mêmes" (cand 05).

## apps/web-app/TERMS_OF_SERVICE.fr.md vs TERMS_OF_SERVICE.md
Sections compared: intro; What the site does; Accounts; Community presets (ownership, conduct, moderation, appeals); Using the site fairly; Other people's services; Square Enix material; Age; Availability; No warranty; Limits on liability; Changes; Ending things; Governing law; Contact.
Result: meaning equivalent throughout. Wording only: L78/L87 "Appels", L104 "Services d'autres personnes", L172 "Fin des choses" are literal renderings (cand 03). "GILS" (L160) is defensible: shipped bot copy writes "216 gils" (bot-logic fr.json manual5.topics.spectrumPrices) though terminology.md L106 lists the currency label as "Gil" (cand 06, informational).

## apps/discord-worker/PRIVACY_POLICY.fr.md vs PRIVACY_POLICY.md
Sections compared: 1-12 and the closing acknowledgement, including all four tables (collected data, usage analytics, storage, retention) row by row.
Result: equivalent; every table row and retention period matches. Wording only: L28 filter-category adjectives do not match shipped labels (cand 01); L47 and L129 "limité(e) par débit" (cand 02).

## apps/discord-worker/TERMS_OF_SERVICE.fr.md vs TERMS_OF_SERVICE.md
Sections compared: 1-12 and closing acknowledgement.
Result: equivalent. Wording only: L62/L69 "Processus d'appel"/"appels" (cand 03); L75 trademark sentence "All Rights Reserved." left in English while the web terms translate it (cand 04).

No handoff-security claim differences were found.
