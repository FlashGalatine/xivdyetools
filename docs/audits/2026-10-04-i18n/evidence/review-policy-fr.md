# Review: policy-fr (French policy documents) - 2026-10-04

Scope: apps/web-app/PRIVACY.fr.md, apps/web-app/TERMS_OF_SERVICE.fr.md, apps/discord-worker/PRIVACY_POLICY.fr.md,
apps/discord-worker/TERMS_OF_SERVICE.fr.md at HEAD, read in full against the HEAD English files. All changed
sections (BASE->MAIN and MAIN->HEAD diffs) compared sentence by sentence.

## Candidates
- POL-FR-1 TERM P2: policies say "palette prédéfinie" (91 occurrences in the four fr documents; BASE already had 7+16) while the UI
  says "préréglage" for the same concept (web fr.json tools.presets.title line 71 "Préréglages communautaires", 20+
  uses; bot-logic fr.json 58 uses). Dictionary has no row (unpinned). Origin MAIN (pattern predates; PR#230/#223/#227 hunks add more).
- POL-FR-2 I18N P2: web TERMS fr:17-19 says "Dix outils" but lists nine; "Lecteur de mirages" is missing (English :15-17 lists Glamour
  Reader). The MAIN change Neuf->Dix did not add the tool. Origin MAIN (BASE->MAIN diff).
- POL-FR-3 I18N P3 wording: "voter sur" for "vote on" (web TERMS fr:30, bot TERMS fr:27) -> "voter pour"; "rejette" for "discards" a
  batch / unsent events (web PRIVACY fr:218, 243) reads as "refuses"; "(pas tant qu'un bannissement est actif)" fr:99,102 ->
  "(sauf pendant un bannissement)"; "salon de journal des soumissions" fr:175 (bot fr:116,192) clumsy for "submission-log channel".
- POL-FR-4 I18N P3: "All Rights Reserved." left English in bot TERMS fr:75 while web TERMS fr:121 has "Tous droits réservés."; headings
  "Fin des choses" (web TERMS fr:170, literal "Ending things") and "Appels" (web fr:76,85; bot fr:62,69 "appeals").
- POL-FR-5 I18N P3: "DM" (bot TERMS fr:67, bot PRIVACY fr:170, web TERMS fr:82) vs "message privé" (web PRIVACY fr:305) for the same contact route.
- POL-FR-6 EN-side (locale en) P3: "reverts one" / "revert" has no stated object (web PRIVACY.md:150,168; bot PRIVACY_POLICY.md:58,116,191). The fr
  chose "annule une modification" (reverting an edit); English could say "reverts an edit". Origin PR#230 / PR#227.

## Checked and right
- Every retention number, host, command, subject line, e-mail, Discord link verbatim (30 days, 90 days, 12 months, 60/120 s, 180 days, 3 months).
- Same Last-updated date 2026-10-04 in web PRIVACY/TERMS fr; bot PRIVACY 2026-10-04, bot TERMS 2026-09-28 (matches English). English-prevails notice present (line 3) in all four.
- Quoted UI labels equal CURRENT web-app fr.json: Paramètres avancés, Réinitialiser les paramètres, Effacer les favoris, Effacer les palettes
  sauvegardées, Gérer les collections, Supprimer la collection, Tout réinitialiser, Liste d'équipement (glamour.sheet.title), Mes soumissions,
  Activer les analyses, Afficher les prix, Ouvrir dans…, Déconnexion, Voter/Voté, À propos -> Confidentialité, matcher.privacyNote text.
- Tool names in the colour-tool list equal fr.json tools.*.title (Nuancier, Lecteur de mirages, ...).
- Dictionary: tableau des ventes, Monde (not serveur) for World, mirage (m.), accessoire de visage = Facewear slot row 16050.
- Operator voice: "nous" throughout, never "notre société". vous register throughout.
- Governing-law, liability, survival, deletion clauses read twice: no flipped modifier; "pas plus tôt", "sauf le message sur un bannissement toujours actif" correct.
- Privacy deletion path (30 days, Discord posts removed, active ban excepted), opt-outs (GPC, analytics off by default) all kept.

## Rejected
- "Nuancier"/"Explorateur d'harmonies" vs official English tool names: policies quote current fr.json; any change belongs to the web-app locale slice.
- "tenue" for outfit (web PRIVACY fr:71): equals fr.json glamour.sheet.privacy.
- "serveur" for infrastructure vs Discord server: English uses "server" for both; no World confusion.
- "appels" is a legitimate French legal term; filed only as P3.
- British spellings in English policies: covered by american-spelling sweep, not this slice.

Files covered: the four fr documents plus their *.main.diff / *.pr.diff and English counterparts; apps/web-app/src/locales/fr.json label lookups; docs/reference/ffxiv-terminology.md.
