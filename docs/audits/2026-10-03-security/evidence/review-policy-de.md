# Review: policy translation, German (de) — audit 2026-10-03

Scope: apps/web-app/PRIVACY.de.md, apps/web-app/TERMS_OF_SERVICE.de.md, apps/discord-worker/PRIVACY_POLICY.de.md,
apps/discord-worker/TERMS_OF_SERVICE.de.md against their English governing files at 0ab33466. Read sentence by sentence.
Commit 2e4cb0cb (2026-09-28 Glamour Reader change) hunks read first and matched to the de hunks. No probe scripts written.

## (1) Entry-point table / authz matrix
Not applicable: documents only, no routes, commands, bindings or pages in scope. Surfaces that link the documents:
web About modal (`about.privacyPolicy` -> "Datenschutz", de.json:30); the bot emits no link (policy-documents.md).

## Checklist: pitfalls named in policy-documents.md "What the first translation pass taught", and where checked
| Pitfall | Where checked | Result |
|---|---|---|
| Operator is one person, not a company (de "unser Unternehmen") | grep -i unternehmen/firma/gesellschaft/betreiber over all four de files | none; "wir" used throughout |
| Modifier on the wrong verb (survival / non-waivable clauses) | web TOS de:172-174 (licence survival), de:181-182 (governing law); bot TOS de:170-171 | correct: licence survives the user's leaving; "auf das du nach diesem Recht nicht verzichten kannst" / "unabdingbar" bind to the consumer right, with "das an deinem Wohnort geltende Recht" as its source. Same claims |
| CJK false friends | n/a for de | n/a |
| One word for two things (de "Sammlung" for batch and collection) | read web PRIVACY.de.md whole; "Stapel" = telemetry batch, "Sammlungen" = saved collections only | clean. "Server" = Discord server / our server only, "Welt" = FFXIV World (bot PRIVACY_POLICY.de.md:25, 31) |
| Quoted UI labels stale | every quoted label vs apps/web-app/src/locales/de.json (table below) | all match current de.json |
| English can be the stale one ("Advanced Options") | EN web PRIVACY.md labels vs en.json | "Advanced Settings", "Enable Analytics", "Reset settings", "Reset all", "Glamour list", "Show Prices", "Open in…" all match en.json |
| Game nouns need the dictionary | docs/reference/ffxiv-terminology.md rows 57, 259-264, 280, 313 | Projektion / Projektionsleser / Gesichtsaccessoires match; no Mirage/Glamour in the de files (grep) |
| Gate must not force unnatural wording | spelled-out quantities ("a dozen") | de "ein Dutzend" is digit-free, fine |
| Ambiguous English costs five translations | "colors extracted from an image", "place where you live" | de renders both the intended way |
| Never hard-wrap CJK | n/a for de | n/a |

Quoted-label verification (web documents vs apps/web-app/src/locales/de.json):
| Label in PRIVACY.de.md / TOS.de.md | de.json key | Match |
|---|---|---|
| "Über XIV Farbwerkzeuge → Datenschutz" | header.about / about.privacyPolicy (:30) | yes |
| "Bilder werden im Browser gelesen und nie hochgeladen" | matcher privacyNote (:307) | exact |
| "Preise anzeigen" | config.showPrices | yes |
| "Erweiterte Einstellungen → Analysen aktivieren" | config.advancedSettings / enableAnalytics (:237) | yes |
| "Einstellungen zurücksetzen" | config.resetSettings | yes |
| "Ausrüstungsliste" / "Alles zurücksetzen" | glamour.sheet.title / glamour.sheet.reset | yes |
| "Öffnen in…" | swatch.itemLinks.openIn | yes |
| Tool names (Paletten-Extraktor, Harmonie-Explorer, Verlauf, Mixer, Budget, Farbmuster-Matcher, Projektionsleser) | tools.* | yes |
Bot documents quote only slash commands (verbatim, identical); no bot de.json label is quoted.

## Per-document section tables

### apps/web-app/PRIVACY.de.md
| § | verdict | note |
|---|---|---|
| intro + closure ("complete list") | same claims | "die Abschnitte unten sind die vollständige Liste" preserved; Glamour Reader = Projektionsleser listed |
| Images and camera captures | same claims | "niemals" kept; label quote exact |
| Character files | same claims | name never sent; local-only nickname/file-name fallback with delete paths; new XIVAPI paragraph (:39-45) carries model numbers + facewear id, "nicht die Datei, nicht den Namen, nicht die Farben, nicht die Farbstoffe", XIVAPI "erhält die Nummern und nichts über dich" |
| Stored on your device | same claims | Acquisition lines and "Alles zurücksetzen" present; IndexedDB single-purpose and old-image deletion kept |
| Network access | same claims | first-party closure and CSP wording kept; Perspective `doNotStore`, "no account identity", removal via Fragen? all present |
| Links to other sites | same claims | referrer suppressed, nothing about the user in the URL |
| Usage analytics | same claims | opt-in, GPC, server-side Sec-GPC discard, event list, five dimensions, never-stored list, three months |
| IP address and logs | same claims | 60 s, 120 s, no DB write, Workers Logs off, will announce first |
| How to verify / Questions | same claims | |

### apps/web-app/TERMS_OF_SERVICE.de.md
| § | verdict | note |
|---|---|---|
| What the site does | DIVERGENCE (c1) | says "Zehn Werkzeuge" but names nine: Projektionsleser missing (EN names Glamour Reader) |
| Accounts | same claims | |
| Community presets (licence, conduct, moderation, appeals 7 days) | same claims | fail-closed moderation wording kept |
| Using the site fairly | same claims | |
| Other people's services | same claims | XIVAPI added; link split glamour piece / dye card correct |
| Square Enix, Age, Availability, Warranty, Liability | same claims | |
| Changes, Ending things | same claims | licence survival correct |
| Governing law, Contact | same claims | non-waivable-right clause correct |

### apps/discord-worker/PRIVACY_POLICY.de.md
| § | verdict | note |
|---|---|---|
| 1 Introduction | same claims | |
| 2 Data collected (tables, rate limiting, analytics) | same claims | 180 d, 60 s/120 s, 30 d TTLs, 3 months, `guild`/`dm`, never server/channel id, failure-class list identical |
| 3 Not collected + Image Processing + Character Files | same claims | `.chara` and character-name lines present; "Sonst wird nichts aus der Datei gesendet, und nichts über dich oder dein Discord-Konto" |
| 4 How we use | same claims | |
| 5 Storage, security, operational logs | same claims | two log lines with user id, logs off |
| 6 Third parties | same claims | XIVAPI row present; Perspective "optional" |
| 7 Rights | same claims | commands verbatim; 180-day flag; 30 days |
| 8 Retention | same claims | 30/90 days moderation records, all numbers equal |
| 9-12 Children, transfers, changes, contact | same claims | |

### apps/discord-worker/TERMS_OF_SERVICE.de.md
| § | verdict | note |
|---|---|---|
| 1-2 | same claims | |
| 3 Description | same claims | all seven new commands present, `/glamour` = Projektionsleser |
| 4-5 Conduct, moderation, appeal (7 days) | same claims | "missbrauchen, auszunutzen" faithful |
| 6 IP, third-party services, your content | same claims | item names + XIVAPI added |
| 7-10 Warranty, liability, modifications, termination | same claims | |
| 11 Governing law | same claims | "unabdingbar" binds to the local-law right |
| 12 Contact | same claims | |

Date check: all four de files say 2026-09-28, equal to the English files (format localised, date identical).

## Comparison with in-product de strings (policy-documents.md item 7)
- Web de.json:1033 (sign-in privacyNote: account record, Discord/XIVAuth id and username, no email, nothing sold) agrees with PRIVACY.de.md network item 3.
- de.json:1108 `cfgStoredLocallyHint`, :1411 glamour sheet privacy, :1414 cardNote agree with PRIVACY.de.md.
- de.json:1204 `charaHint`: "Nichts wird übertragen" vs English "Nothing is uploaded" (en.json:1204). See handoff I18N-1.
- Bot de.json:690 (/swatch: "nicht gespeichert") agrees with PRIVACY_POLICY.de.md section 3.

## (2) Positive controls
- Every retention number, host, command and slash-command token equal between en and de across all four documents (verified by reading, beyond the parity script).
- Closure claims ("vollständige Liste", first-party-hosts, bot section 3 not-collected list) preserved, none softened; "niemals/nie" kept 1:1 (web PRIVACY.de.md:15-20, 36-38, 137-143; bot PRIVACY_POLICY.de.md:60, 70-76).
- English-prevails notice present and linking the English file in all four (line 3 of each).
- Opt-out and deletion paths intact: web PRIVACY.de.md:54-56, 111-117, 81-83; bot PRIVACY_POLICY.de.md:165-187.

## (3) Rejected items
- "Design" for "theme": terminology matching de.json, not a claim change.
- "Beacons" left English in the verify step: common term, no claim impact.
- "Nichts wird übertragen" in de.json charaHint: a locale string, not a policy document; handed off.
- Bot TOS de "Fair-Use-Regelung" (:102): faithful to "under fair use".
- Pitfall "Unternehmen": absent, nothing to file.

## (4) Files covered
apps/web-app/PRIVACY.md, PRIVACY.de.md, TERMS_OF_SERVICE.md, TERMS_OF_SERVICE.de.md;
apps/discord-worker/PRIVACY_POLICY.md, PRIVACY_POLICY.de.md, TERMS_OF_SERVICE.md, TERMS_OF_SERVICE.de.md;
.agents/skills/audit-shared/policy-documents.md; docs/reference/ffxiv-terminology.md (Glamour/Facewear rows);
apps/web-app/src/locales/en.json and de.json (labels and privacy strings); packages/bot-logic/src/i18n/locales/de.json and en.json (privacy grep);
git show 2e4cb0cb (four English files).

## (5) Candidates
| cid | sev | exposure | path:line | claim |
|---|---|---|---|---|
| c1 | LOW | INTERNET-UNAUTH | apps/web-app/TERMS_OF_SERVICE.de.md:17-21 | Service description omits the Glamour Reader: "Zehn Werkzeuge" but only nine are named (EN TERMS_OF_SERVICE.md:15-16 names Glamour Reader). Policy CORRECT, six-file edit not needed for de alone if the other four already list it (check), reconcile_case 3. Fix: insert "Projektionsleser," after "Farbmuster-Matcher" at line 18. Arrived with 2e4cb0cb's "Terms gained the Glamour Reader". No privacy promise changes; LOW rather than MEDIUM because the count and every data claim still agree with English. |

No other claim-level divergence found in any of the four documents.

## (6) Handoffs
- I18N-1: apps/web-app/src/locales/de.json:1204 `charaHint` "Nichts wird übertragen" is broader than English "Nothing is uploaded" and untrue given the gear lookup (model numbers go to data.xivdyetools.app); use "Nichts wird hochgeladen".
- DOC: web PRIVACY.de.md:8-13 and TERMS_OF_SERVICE.de.md:17-19 have uneven hard wraps after the 2e4cb0cb edit (cosmetic, same edit as c1).
