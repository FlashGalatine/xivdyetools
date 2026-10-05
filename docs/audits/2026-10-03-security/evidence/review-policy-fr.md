# Review: policy-fr (French translations of the four policy documents)

Scope: apps/web-app/PRIVACY.fr.md, TERMS_OF_SERVICE.fr.md; apps/discord-worker/PRIVACY_POLICY.fr.md, TERMS_OF_SERVICE.fr.md, each read sentence by sentence against its English file. Mechanical parity script (`policy-locale-parity.py`) re-run: PASS, 0 problem groups. Commit 2e4cb0cb hunks (Glamour Reader content change) read first.

## (1) Entry-point table / authz matrix
Not applicable: documentation-only unit, no routes, commands or bindings were reviewed. Slash commands quoted in the bot documents (`/preferences show|reset`, `/preset favorite add|list|remove`, `/extractor image`, `/swatch`, `/glamour`, `/stats`) are verbatim in fr and match English.

## (2) Positive controls
- Every fr file opens with the localized English-prevails notice linking the English file (PRIVACY.fr.md:3, TERMS_OF_SERVICE.fr.md:3, PRIVACY_POLICY.fr.md:3, TERMS_OF_SERVICE.fr.md:3 in discord-worker).
- All four fr files carry the same date as English (2026-09-28 / "Dernière mise à jour").
- Every retention figure matches English (60 s, 120 s, 30 d, 180 d, 3 months, 90 d, 30 d request SLA, 7 d appeals): PRIVACY_POLICY.fr.md:19-49,163-177.
- "Never" promises survive unsoftened: PRIVACY.fr.md:18-19 (images never leave device), :28-29 (name never sent), :143-150 (never-stored list), PRIVACY_POLICY.fr.md:36-39,51,59,63-65,118.
- Opt-out / deletion paths intact: analytics switch + GPC (PRIVACY.fr.md:116-122), "Réinitialiser les paramètres"/"Tout réinitialiser" (:55-58), deletion request + 30 days (PRIVACY_POLICY.fr.md:152-161), `/preferences reset` (:146).
- Governing-law clause correct, with the `auquel` pitfall avoided: web TERMS fr:179-180 and bot TERMS fr:136 read "un droit ... que le droit de votre lieu de résidence vous accorde et auquel ce même droit ne vous permet pas de renoncer".
- Survival clause correct: web TERMS fr:170-172 "peuvent rester en ligne après votre départ, sous la licence ci-dessus" (zh-style detachment absent).
- Quoted UI labels match web-app/src/locales/fr.json: "Liste d'équipement" (1398), "Tout réinitialiser" (1412), "Ouvrir dans…" (1276), "Afficher les prix" (157), "Activer les analyses" (237), "Paramètres avancés" (225), "Réinitialiser les paramètres" (226), "Confidentialité" (30), extractor notice text (307, verbatim). Tool names match titles at fr.json:41-104 (Lecteur de mirages 104, Nuancier 82).
- Operator is not a company: grep for société/entreprise in all four fr files finds none (the only hit, "entreprises", is the verb in bot TERMS fr:111).
- Glamour Reader privacy copy in fr.json (sheet.privacy 1411, cardNote 1412+) says the same as PRIVACY.fr.md:53-58 (kept on device, name never in list, file never saved).

## Checklist of pitfalls named in policy-documents.md "What the first translation pass taught"
| Pitfall | Where checked in fr | Result |
|---|---|---|
| Operator is one person, not a company | grep société/entreprise/"notre équipe" over 4 files | clean (nous used) |
| Modifier on wrong verb (governing law / liability / survival) | web TERMS fr:168-172, 174-180; bot TERMS fr:132-136, 102-111 | correct |
| CJK false friends (利用) | n/a for fr | n/a |
| One word for two things (de Sammlung; ko/zh server) | fr "serveur" = Discord server only; "Monde" = FFXIV World (PRIVACY.fr:71-72, 146; PRIVACY_POLICY.fr:22,28); "collection(s)" only user collections | clean |
| Quoted UI labels stale | all labels above vs current fr.json | clean |
| English can be the stale one ("Advanced Options") | EN PRIVACY.md:47,99 say "Advanced Settings" = en.json:225 | clean |
| Game nouns need the dictionary | glamour=mirage, Market Board=tableau des ventes, World=Monde, facewear=accessoire de visage (dictionary row 313 says "Accessoires de visage"; row 57 says "Accessoires faciaux", both exist; fr uses the item-sheet form) | consistent with dictionary; see handoff on row 57 vs 313 |
| Gate forcing unnatural wording (digit words) | fr prose reads naturally ("une douzaine" for "a dozen", PRIVACY.fr:42-43, kept digit-free) | clean |
| Ambiguous English costs translations | bot TERMS EN:23 / fr:23 "hex color, or ... colors extracted from an image" (see handoff) | minor ambiguity |
| Never hard-wrap CJK | n/a for fr | n/a |

## (3) Rejected items
- PRIVACY.fr.md:143-150 "Le serveur rejette tout ce qui concerne la requête" for "discards everything about the request": "rejette" could suggest refusing the request, but the same paragraph's allowlist sentence fixes the meaning; wording only (handoff).
- Bot TERMS fr:23 "couleur hexadécimale ou extraite d'images": ambiguity inherited from English; claim not changed.
- "Palettes prédéfinies" for presets vs product label "Préréglages communautaires" (fr.json:71): terminology, not a claim.
- fr uses ISO date in the bot documents' "Dernière mise à jour : 2026-09-28" while English uses "September 28, 2026": format may be localized, date identical.
- PRIVACY.fr.md:73 "gère" etc. checks of hosts/URLs: parity script covers them; no meaning issue.
- Web-app sign-in copy (fr.json privacyNote, "votre nom d'affichage apparaît") vs PRIVACY ("author name shown"): both English and fr say the same; no fr-specific drift.
- Claims-vs-code accuracy of the English text is out of scope for this reviewer (other reviewers own it).

## (4) Files covered
apps/web-app/PRIVACY.md, PRIVACY.fr.md, TERMS_OF_SERVICE.md, TERMS_OF_SERVICE.fr.md; apps/discord-worker/PRIVACY_POLICY.md, PRIVACY_POLICY.fr.md, TERMS_OF_SERVICE.md, TERMS_OF_SERVICE.fr.md; `git show 2e4cb0cb` (all four English hunks and the fr hunks via full read); apps/web-app/src/locales/en.json and fr.json (privacy/analytics/sheet/itemLinks/tool titles); packages/bot-logic/src/i18n/locales/en.json and fr.json (grep of privacy-type strings, line 690 /swatch manual); .agents/skills/audit-shared/policy-documents.md; docs/reference/ffxiv-terminology.md (rows 57, 229-264, 313); policy-locale-parity.py output.

Per-document verdict tables

### apps/web-app/PRIVACY.fr.md
| § | verdict | note |
|---|---|---|
| intro (tools list) | same claims | Glamour Reader added correctly (fr:8-14) |
| Images and camera | same claims | quoted notice matches fr.json:307 |
| Character files (3 bullets) | same claims | new XIVAPI bullet (fr:40-47) faithful: model numbers + facewear id, "nothing about you", names/acquisition/icons return from data host |
| Stored on device | same claims | Acquisition lines + "Réinitialiser les paramètres" / "Tout réinitialiser" correct |
| Network access 1-5, link-outs | same claims | closure sentence kept ("ne communique qu'avec ces hôtes ... ainsi qu'avec les tiers") |
| Usage analytics | same claims | opt-in, GPC, Sec-GPC, allowlist, 3 months all preserved |
| IP address and logs | same claims | 60 s, 120 s, Workers Logs off preserved |
| How to verify / Questions | same claims | |

### apps/web-app/TERMS_OF_SERVICE.fr.md
| § | verdict | note |
|---|---|---|
| What the site does | DIVERGENCE | EN lists Glamour Reader (EN:15-17); fr:17-19 says "Dix outils" but names nine and omits the Lecteur de mirages (see c1) |
| Accounts | same claims | |
| Community presets / Moderation / Appeals | same claims | 7 days kept |
| Using the site fairly | same claims | |
| Other people's services | same claims | XIVAPI + dye-card split (fr:105-109) correct |
| Square Enix material | same claims | item names and icons present |
| Age, Availability, Warranty, Liability, Changes | same claims | |
| Ending things | same claims | survival clause correct |
| Governing law | same claims | non-waivable clause correct |
| Contact | same claims | |

### apps/discord-worker/PRIVACY_POLICY.fr.md
| § | verdict | note |
|---|---|---|
| 1-2 data tables | same claims | |
| Rate limiting, Usage Analytics | same claims | 120 s, 30 d, 3 months, never-listed User ID preserved |
| 3 Not collected | same claims | `.chara` bullet added (fr:64) |
| Character Files | same claims | "Immédiatement supprimée", "Jamais stocké", XIVAPI via own API (fr:75-83) |
| 4-5 | same claims | |
| 6 Third parties | same claims | XIVAPI row (fr:131); Perspective row unchanged |
| 7 Rights | same claims | |
| 8 Retention | same claims | 90/30 days preserved |
| 9-12 | same claims | |

### apps/discord-worker/TERMS_OF_SERVICE.fr.md
| § | verdict | note |
|---|---|---|
| 1-2 | same claims | |
| 3 Description | same claims | all seven new commands listed (fr:29-33) |
| 4-5 | same claims | |
| 6 | same claims | "noms de teintures et d'objets", XIVAPI sentence (fr:79,85) |
| 7-10 | same claims | |
| 11 Governing law | same claims | |
| 12 | same claims | |

## (5) Candidates
| cid | sev | exposure | path:line | claim |
|---|---|---|---|---|
| c1 | LOW | INTERNET-UNAUTH | apps/web-app/TERMS_OF_SERVICE.fr.md:17-19 | EN "Ten tools ... Swatch Matcher, Glamour Reader, and the community Presets browser" (TERMS_OF_SERVICE.md:15-17). fr says "Dix outils" but lists only nine and omits the Lecteur de mirages, so the service description lacks the tool that reads `.chara` gear and sends model numbers to XIVAPI. Translation was not updated when EN gained the tool (b29b9562; 2e4cb0cb touched only the XIVAPI/Saddlebag lines). Policy CORRECT, reconcile_case 3: add "le Lecteur de mirages," after "le Nuancier,". Six-file edit; check the other four siblings for the same omission (only EN:16 matches "Glamour Reader" in a grep of EN/fr/de). |

## (6) Handoffs
- DOC: other-language siblings (de, ja, ko, zh) of apps/web-app/TERMS_OF_SERVICE.md should be checked for the same Glamour Reader omission; only EN contained the string "Glamour Reader" in my grep of EN/fr/de (de may use "Projektionsleser").
- DOC: web TERMS EN:17 line is hard-wrapped long (cosmetic); fr:20 follows suit.
- I18N: "palettes prédéfinies" (PRIVACY.fr, both TERMS, PRIVACY_POLICY.fr) vs shipped label "Préréglages communautaires" (web fr.json:71) and "préréglages favoris" (bot-logic fr.json:298); pick one term.
- I18N: web TERMS fr heading "Fin des choses" is a literal rendering of "Ending things"; "Résiliation et fin d'accès" or similar reads better.
- I18N: PRIVACY.fr.md:147 "Le serveur rejette tout ce qui concerne la requête" -> "Le serveur ignore tout le reste de la requête" (avoids a reading as request rejection).
- I18N: bot TERMS fr:23 "n'importe quelle couleur hexadécimale ou extraite d'images" -> "n'importe quelle couleur hexadécimale, ou aux couleurs extraites d'une image" (mirror the clarified English).
- I18N: dictionary lists both "Accessoires faciaux" (ffxiv-terminology.md:57) and "Accessoires de visage" (:313); fr policies use "accessoire de visage"; reconcile the dictionary.
- I18N: web TERMS fr:184 and bot TERMS fr:142 use straight double quotes for the email subject, other places use « »; typography only.
- DOC: bot PRIVACY_POLICY.fr:157 email subject is « XIV Dye Tools Privacy » in both EN and fr (consistent); no action.
