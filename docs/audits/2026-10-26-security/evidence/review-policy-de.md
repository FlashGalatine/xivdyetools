# Review: policy translation meaning — de (key `policy-de`)

Audit 2026-10-26, HEAD 13c386e5. Read-only meaning review of the German variants of the four
policy documents plus the privacy-bearing UI strings in the web-app and bot locale files.
Method: `.agents/skills/audit-shared/policy-documents.md` § "What the first translation pass
taught" read first; then each English governing file and its `.de.md` sibling read in full and
compared section by section; every UI label the de text quotes was checked against
`apps/web-app/src/locales/de.json` with a scratch key-diff script (en value → de value).
The mechanical parity gate (`evidence/policy-locale-parity.txt`) passes for all four de files.

## Section table (document → section → verdict)

| Document | Sections compared | Verdict |
|---|---|---|
| web-app `PRIVACY.de.md` | intro, Images, `.chara`, on-device storage (6 clear paths), Network access 1-5, outbound links, presets: what we keep (6 bullets, 30/90/12-month periods), analytics (GPC, never-stored list, 3-month retention), IP (60 s / 120 s), verify, deletion (3 self-service paths, email + Discord, 30 days, ban exception), questions | Same claims. One softened "never" audience noun (policy-de-02) |
| web-app `TERMS_OF_SERVICE.de.md` | all 15 sections incl. license, moderation, appeals (7 days), age 13, warranty, liability, ending (survival), governing law | Same claims; survival clause modifier correct ("Vorlagen, die du veröffentlicht hast, können auch nach deinem Weggang ... bestehen bleiben"); non-waiver clause names the place of residence and the same law |
| discord-worker `PRIVACY_POLICY.de.md` | §1-§12, all tables (4 + 5 + 3 + 8 + 4 + 5 + 16 rows) | Same claims; every retention row, right and command present |
| discord-worker `TERMS_OF_SERVICE.de.md` | §1-§12 | Same claims; "missbrauchen, auszunutzen oder zu umgehen" matches "abuse, exploit, or circumvent"; "unabdingbar" = cannot be waived |
| web-app `de.json` privacy strings | `matcher.privacyNote`, `preset.privacyNote`, `preset.fieldLinkHint`, `preset.cfgStoredLocallyHint`, `preset.gateSaveNote`, `preset.shotSlot`, `swatch.charaHint`, `swatch.charaHintGlamour`, `glamour.sheet.privacy`, `config.analyticsDesc` | Same claims except `preset.shotSlot` (policy-de-01) |
| bot-logic `locales/de.json` | `manual5.topics.characterFile.body` ("wird einmal für die Antwort gelesen und nicht gespeichert"), `about.removedBody` | Same claims |

## Candidates

- **policy-de-01** (LOW) `apps/web-app/src/locales/de.json:982` — `"shotSlot": "PROJEKTIONSBILD · VERLINKT"`
  drops the "NOT UPLOADED" half of en `"GLAMOUR SHOT · LINKED, NOT UPLOADED"`. de is the only one of
  five translations that drops it (fr "LIEN, PAS DE COPIE", ja/ko/zh "link only stored"). The caption
  renders on the example link (`preset-detail.ts:1002`, `preset-card.ts:336`). The assurance
  survives in `preset.fieldLinkHint` de ("Gespeichert wird der Link, nie eine Kopie des Bildes"),
  hence LOW.
- **policy-de-02** (LOW) `apps/web-app/PRIVACY.de.md:36` — "niemals als Vorlagenname, Autorenname
  oder irgendetwas anderes verwendet, das andere **Spieler** sehen können" narrows en
  `PRIVACY.md:33` "anything else other **people** can see" to other players. Read literally, it
  no longer covers moderators, the operator or non-players. No code path shows the name to
  anyone, so it has no practical effect.

## Positive controls

- Operator stays "wir"/"uns"; no Unternehmen/Firma/Gesellschaft in any de file (git grep).
- Telemetry *batch* = "Stapel", saved *collections* = "Sammlungen". The 2026-09-20 Sammlung
  collision has not regressed.
- FFXIV World = "Welt", Discord server = "Server"/"Discord-Server". No collision.
- Every quoted UI label matches the current `de.json`: Über XIV Farbwerkzeuge → RICHTLINIEN →
  Datenschutz, Erweiterte Einstellungen, Einstellungen zurücksetzen, Favoriten löschen,
  Gespeicherte Paletten löschen, Analysen aktivieren, Marktbrett aktivieren, Ausrüstungsliste,
  Alles zurücksetzen, Meine Einreichungen, Abstimmen/Abgestimmt, Öffnen in…, and the padlock
  sentence.
- All numbers, hosts, periods, the email, the Discord invite and the commands are identical.
  This includes 8 characters, 30/90/180 days, 12 months, 60/120 s, 50 favorites, 13 years,
  7 days, 2026-10-05 and `usertrack:{date}:{userId}`.
- Both governing-law clauses keep the venue consent, the place-of-residence law and non-waiver.
- The web ToS survival clause attaches "after you leave" to "stay up", not to "published".
- No untranslated English sentence; the "Last updated" date (2026-10-12) matches on all four.

## Rejected (one-line reasons)

- Web and bot ToS "zur Prüfung protokolliert" for "logged for audit". The German "Prüfung" also
  means the automated check and moderator review: i18n handoff. The meaning is kept, because the
  submission-log post IS the audit trail.
- `preset.previewImagePendingReview` "nach der Freigabe" drops "a moderator": i18n handoff, the
  approval gate is unchanged.
- `PRIVACY.de.md:217` "bevor er sie schreibt": wrong pronoun for "Stapel" (ihn), grammar only.
- `PRIVACY.de.md:57` "Bezugsquellen" for "Acquisition lines": terminology, same stored field,
  i18n handoff.
- `PRIVACY.de.md:293` adds the "Abgestimmt" label to the vote path: an accurate extra detail
  (`preset.voted`), no new promise.
- `preset.privacyNote` de "Autor der Paletten" (en: presets): terminology, i18n handoff.
- de link labels keep the English file names while linking `.de.md`: cosmetic.

## Files covered: 15

- `apps/web-app/` (PRIVACY.md, PRIVACY.de.md, TERMS_OF_SERVICE.md, TERMS_OF_SERVICE.de.md)
- `apps/discord-worker/` (PRIVACY_POLICY.md, PRIVACY_POLICY.de.md, TERMS_OF_SERVICE.md, TERMS_OF_SERVICE.de.md)
- `apps/web-app/src/locales/` (en.json, de.json, plus `shotSlot` in fr/ja/ko/zh)
- `apps/web-app/src/components/v4/` (preset-detail.ts, preset-card.ts: `shotSlot` call sites only)
- `packages/bot-logic/src/i18n/locales/` (en.json, de.json)
- `.agents/skills/audit-shared/policy-documents.md`
