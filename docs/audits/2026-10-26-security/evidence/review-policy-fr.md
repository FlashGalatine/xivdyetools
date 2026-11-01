# review-policy-fr: French translation meaning review (2026-10-26)

Reviewer key: `policy-fr` · HEAD 13c386e5 · read-only. Method: read
`.agents/skills/audit-shared/policy-documents.md` (including "What the first translation pass
taught"), then each English governing file and its `.fr.md` sibling in full, section by section.
After that, the fr privacy strings in `apps/web-app/src/locales/fr.json` and
`packages/bot-logic/src/i18n/locales/fr.json` were compared with the en strings and the fr policy.
The mechanical gate (`evidence/policy-locale-parity.txt`: `ok fr` x4, `PASS`) was taken as given.

## Section table (document → fr sibling → verdict)

| Document / section | fr lines | Same claim? |
|---|---|---|
| web PRIVACY: intro (complete list) | PRIVACY.fr.md:8-14 | yes |
| web PRIVACY: Images and camera | :16-32 | yes; "jamais envoyées" quote = fr.json:304 |
| web PRIVACY: `.chara` files | :34-55 | **narrowed**: "other people" → "d'autres joueurs" (:38), see policy-fr-02 |
| web PRIVACY: stored on device | :57-84 | the sentence is faithful, but fr UI vocabulary collides with it (:70-71), see policy-fr-01; every label matches fr.json (222/223/227/229/1389/1404) |
| web PRIVACY: Network access 1-5 | :86-134 | yes; doNotStore, "aucune identité de compte", Monde/centre de données, og-worker URL-only all present |
| web PRIVACY: Links to other sites | :139-160 | yes |
| web PRIVACY: Community presets kept | :162-219 | yes; 30 / 90 / 12 months / 2026-10-05 / author-name clearing all match |
| web PRIVACY: Usage analytics | :221-263 | yes; GPC "jamais … même avec le commutateur activé", every "never stored" item present (IP, UA, ids, cookies, URLs, colors/images, search, preset text, character/World names, linkage) |
| web PRIVACY: IP + logs | :265-285 | yes; 60 s / 120 s, "jamais stockée aux côtés", "le préciserons ici en premier" |
| web PRIVACY: How to verify / Deleting / Questions | :287-334 | yes; adds the UI labels **Voter/Voté** and **Déconnexion** (:307-308), which match fr.json:988/989/221 and add no claim |
| web ToS: all 15 sections | TERMS_OF_SERVICE.fr.md:1-193 | yes; survival clause (:176-178) and the non-waivable clause (:185-186, "auquel ce même droit") are attached to the right verbs |
| bot PRIVACY §1-§12 | PRIVACY_POLICY.fr.md:1-223 | yes; every table row, the 9 ❌ items, 50 / 60 / 120 / 180 / 30 / 90 / 12 / 3 months, `usertrack:{date}:{userId}`, `guild`/`dm`, deletion paths and commands are verbatim |
| bot ToS §1-§12 | TERMS_OF_SERVICE.fr.md (bot):1-148 | yes; §11 venue + non-waivable attached correctly |
| web fr.json privacy strings (235, 304, 1006, 1011, 1018, 1034, 1093, 1166, 1167, 1403, 1406) | — | agree with PRIVACY.fr.md, except the "palettes enregistrées" collision (policy-fr-01) |
| bot fr.json privacy strings (manual `.chara` body :712, preferences reset :343-348) | — | agree ("n'est pas conservé") |

## Candidates

- **policy-fr-01 (LOW, INTERNET-UNAUTH).** The fr UI uses one term for two stores. In fr.json,
  "palette(s) enregistrée(s)" names locally saved palettes (`saveSuccess` :712; `clearPalettes`
  :229) and also locally saved presets (`signinBlurb` :1006 "Les palettes enregistrées restent sur
  cet appareil"; `cfgKeepDeletedDesc` :1060). In en.json those two are "Palette saved!" and
  "Saved presets". PRIVACY.fr.md:70-71 says "**Effacer les palettes sauvegardées** supprime d'un
  seul coup toutes vos palettes enregistrées". In code that control deletes only palette-kind
  collections (`advanced-options-panel.ts:268` `CollectionService.deleteCollectionsByKind('palette')`).
  Saved presets live in a separate key (`saved-presets-service.ts:22` `'v5_saved_presets'`), which
  holds snapshots with `author` (:36). So a French reader is promised a deletion that does not
  happen. The English policy never names saved presets in "What is stored on your device", so the
  English is silent rather than wrong. That gap belongs to the English-accuracy reviewer.
- **policy-fr-02 (LOW / INFO, INTERNET-UNAUTH).** PRIVACY.md:31-33 says the character name is
  never used for "anything else other people can see". PRIVACY.fr.md:38 says "toute autre chose
  visible par d'autres joueurs" (other *players*), which narrows the people the promise covers
  (moderators and non-players are left out). In practice nothing changes, because the sentence
  before it in both languages says the name is never sent anywhere.

## Positive controls

- No "notre société" / "entreprise" for the operator. `git grep -i "société|entreprise"` over
  the four fr files hits only "actions entreprises" (TERMS_OF_SERVICE.fr.md (bot):111, "actions
  taken").
- No softeners ("normalement", "généralement", "en principe"): zero hits. The "jamais" count
  equals the "never" count in both privacy policies (11 / 11).
- Every quoted UI label in PRIVACY.fr.md matches the current fr.json: À propos de Outils de
  Teinture XIV :9, POLITIQUES :29, Confidentialité :30, Activer le tableau des ventes :157,
  Paramètres avancés :222, Réinitialiser les paramètres :223, Effacer les favoris :227, Effacer
  les palettes sauvegardées :229, Activer les analyses :234, Mes soumissions :858, Voter / Voté
  :988-989, Déconnexion :221, Ouvrir dans… :1249, Liste d'équipement :1389, Tout réinitialiser
  :1404.
- "Monde" (FFXIV World) and "serveur" (Discord server) are never conflated. Bot PRIVACY.fr §2
  keeps "ID de serveur" (not stored) apart from "Monde / centre de données" (preference).
- Each translation's line-3 notice says the English version prevails and links the English
  file. Cross-links target the `.fr.md` variants and keep their backticked labels (DOC-073
  convention).
- The governing-law, liability and survival clauses were each read twice. Every modifier is
  attached to the right verb.

## Rejected

- Bot TERMS_OF_SERVICE.fr.md:23 "…de n'importe quelle couleur hexadécimale ou extraite
  d'images": this keeps the old English sentence shape, but the meaning (dyes nearest to
  extracted colors) is the same. i18n handoff.
- Bot TERMS_OF_SERVICE.fr.md:129 "Comportement portant atteinte négativement": awkward wording,
  same meaning. i18n handoff.
- fr.json:1018 `privacyNote` "auteur des palettes que vous proposez" (en "presets you submit"):
  the claim is the same, and "proposez" pins the meaning to submissions. Terminology goes to i18n
  handoff; it feeds policy-fr-01.
- PRIVACY.fr.md:26 "À propos de Outils de Teinture XIV" ("de Outils" elision): this is the
  shipped label (fr.json:9). i18n handoff.
- PRIVACY.fr.md:307-308 adds bold UI labels that the English lacks. The labels are verified
  and add no claim.
- "opt-in" → "avec consentement" (:134, :221): same meaning.
- Bot ToS §4 "Ne pas tenter d'abuser … des limites de débit" copies the English structure. It
  is not the ja 利用 false-friend case.

## Files covered (14)

- apps/web-app/: PRIVACY.md, PRIVACY.fr.md, TERMS_OF_SERVICE.md, TERMS_OF_SERVICE.fr.md,
  src/locales/en.json, src/locales/fr.json, src/components/advanced-options-panel.ts (240-280),
  src/services/saved-presets-service.ts (1-40)
- apps/discord-worker/: PRIVACY_POLICY.md, PRIVACY_POLICY.fr.md, TERMS_OF_SERVICE.md,
  TERMS_OF_SERVICE.fr.md
- packages/bot-logic/src/i18n/locales/: en.json, fr.json (privacy-relevant keys only)
- .agents/skills/audit-shared/policy-documents.md
