# Reviewer hand-back — open items (opus verifier, 2026-09-20)

Brief: [open-items-review-brief.md](open-items-review-brief.md). Read-only; five languages. Kept
as returned, lightly reflowed. Line numbers are those of the branch at the time of the review.
Nothing in it has been applied — see [../OPEN_ITEMS_SOLUTIONS.md](../OPEN_ITEMS_SOLUTIONS.md).

## TASK 1 — zh Paint / Pigment (and de Farbe)

**ACCEPT** — zh ryb = `颜料`, spectral = `真实颜料` (sidebar spectral = `光谱 - 真实颜料`, unchanged).
`颜料画` names a *picture*, not a medium; `颜料` is the everyday paint / pigment word and
"颜料三原色 = 红黄蓝" makes it the natural RYB label; `真实颜料` already ships in the sidebar so the
two families converge, and `色素` (the zh name of FFXIV's Pigment currency items, core zh
`currencies`) stays free of collision. Runner-up: `逼真颜料` — `about.spectralCredit` already says
"逼真的颜料混合", so `逼真` is the house adjective for "realistic"; either is native, `真实` wins on
already-shipping consistency.

Edits: `zh.json:185` `"mixingRyb": "颜料画"` → `"颜料"`; `:487` `"modelRyb": "颜料画"` → `"颜料"`;
`:488` `"modelSpectral": "颜料"` → `"真实颜料"`.

**de `Farbe`: REPLACE → `Malfarbe`.** In the row `Farbe / Pigment / Perzeptuell / LAB / Farbton /
Licht`, "Farbe" reads as *colour*, which distinguishes nothing, and the same namespace already says
**Farbstoff** for dye. `Malfarbe` is the everyday art-supplies word and matches core de
`colorWheels.ryb` = "RYB (Malerfarbkreis)". Edits: `de.json:185` `"mixingRyb": "Farbe"` →
`"Malfarbe"`; `:487` `"modelRyb": "Farbe"` → `"Malfarbe"`; `:187` `"Spektral - Realistische Farbe"`
→ `"Spektral - Realistische Malfarbe"`; `:191` `"Farbsimulation. Blau + Gelb = Grün."` →
`"Malfarben-Simulation. Blau + Gelb = Grün."`. `mixer.modelSpectral` = "Pigment" is correct.

## TASK 2 — the clarified English policy sentences

2a OK as proposed. 2b / 2c: keep the proposed structure (the repeated `that` blocks the bad high
attachment of `and` to `removes`; "the same law" is clunky prose but the right crutch for a
translation source) and fold in the residence fix:

- 2b → `Nothing in these Terms removes any consumer-protection right that the law of your country
  of residence grants you and that the same law does not permit you to waive.`
- 2c → `Nothing here takes away any consumer-protection right that the law of the country where
  you live gives you and that the same law does not let you waive.` (the EN web sentence wraps
  across `TERMS_OF_SERVICE.md:161-162` — a mechanical replacement must re-wrap)

| row | lc | verdict | old → new |
|---|---|---|---|
| 2b | de | REPLACE | `gewährt und das du nicht abbedingen kannst.` → `gewährt und das nach diesem Recht unabdingbar ist.` (`apps/discord-worker/TERMS_OF_SERVICE.de.md:159-160` — the German makes non-waivability the *user's* inability rather than the law's rule; `unabdingbar` is the standard legal term and fits the bot's formal register) |
| 2c | de | REPLACE | `gewährt und das du nicht abbedingen kannst.` → `gewährt und auf das du nach diesem Recht nicht verzichten kannst.` (`apps/web-app/TERMS_OF_SERVICE.de.md:179-180` — same gap; `abbedingen` is lawyer-German and clashes with this document's plain register) |

All others OK, verified by reading: 2a — ja "任意のHexカラーや画像から抽出した色に最も近い", de "einer
beliebigen Hex-Farbe **oder einer** aus einem Bild extrahierten **Farbe**", fr "ou **extraite**"
(fem. sg., agrees with *couleur*, never with *teintures*), ko "임의의 hex 색상이나 이미지에서 추출한
색상에", zh "或从图像中提取颜色进行匹配". 2b / 2c — ja, ko, zh and fr ("que votre droit local vous
accorde et auquel **il** ne vous permet pas de renoncer") all keep *the law* as the subject of both
clauses. The sentence appears in no other file (grepped `*.md` across `apps/`).

**Local-law note.** It matters, and ja / ko are the correct pair — mandatory consumer protection
attaches to habitual residence, whereas bare "local law" can be misread as the law of the venue
just named in the preceding sentence (North Carolina), which inverts the clause. English should
follow ja 「居住地の法律」 / ko 「거주 국가 법」. Consequential edits if adopted: de `dein örtliches
Recht` → `das Recht deines Wohnsitzlandes` (both files), fr `votre droit local` → `le droit de
votre pays de résidence`, zh 「您当地法律」 → 「您居住国的法律」; ja / ko already conform (optionally
tighten ja 居住地 → 居住国 to match "country").

*Coordinator's note:* "country" leaves out state and provincial consumer law; the solutions
document recommends "the place where you live" instead, translations to be produced and verified
at execution.

## TASK 3 — same-English divergences

| # | EN value | lc | verdict | reason / unified value |
|---|---|---|---|---|
| 1 | All | fr | LEGIT | three head nouns: chip set `Tout`, catégories `Toutes`, préréglages `Tous` |
| 2 | Dark | ko | LEGIT | `다크` = core's official dye / theme label; `어두움` = swatch lightness band |
| 3 | Dyes | ja | DRIFT | `preset.dyes` 染料 → **カララント** — 10 other `preset.*` keys already say カララント |
| 4 | Save | de | LEGIT | `Speichern` = form save; `Merken` = bookmark a preset (cf. `gateSave` "Paletten merken") |
| 5 | Vote | de | DRIFT | both → **`Abstimmen`** (`gateVote` already); also `preset.voted` `Gewählt` → `Abgestimmt` |
| 6 | Clear | ja de fr ko zh | LEGIT | verb "clear the field" vs the Clear / Fine / Tight / Collapsed distinctness tier |
| 7 | Light | ja de fr ko zh | LEGIT | additive-light model vs theme name vs swatch lightness band |
| 8 | Saved | fr | LEGIT | plural tab `Enregistrés` vs singular button state `Enregistré` |
| 8 | Saved | de | DRIFT | both → **`Gemerkt`** — the action is Merken, so the tab must not say Gespeichert |
| 9 | Remove | ko | LEGIT | `삭제` deletes the uploaded image server-side; `제거` removes from a list |
| 10 | Compare | de | LEGIT | nav-chip noun `Vergleich` vs hand-off menu infinitive `Vergleichen` |
| 11 | Select a dye | ja | DRIFT | both → **`カララントを選択`**; also `emptyStates.noHarmony.description` 染料 → カララント |
| 12 | All slots are full… | ja | DRIFT | `すべてのスロットが埋まっています。置き換えるスロットを選択してください：` — edit `resultCard.slotsFull` |
| 12 | " | de | DRIFT | `Alle Plätze sind belegt. Wähle einen zum Ersetzen:` — edit `resultCard.slotsFull` |
| 12 | " | ko | DRIFT | `모든 슬롯이 가득 찼습니다. 교체할 슬롯을 선택하세요:` — edit `resultCard.slotsFull` |
| 12 | " | zh | DRIFT | `所有槽位已满。请选择要替换的槽位：` — edit `gradient.slotsFull` |
| 13 | RATIO (bot) | ja de ko zh | LEGIT | contrast card's wide column header vs its narrow in-cell label (`contrast.ts:98-99`) |
| 14 | TARGET (bot) | ja ko zh | LEGIT | target *colour* (sheet / extractor cards) vs target dye row in the budget ledger |
| 15 | NEAREST DYE (bot) | all 5 | DRIFT | ja `近いカララント` · de `NÄCHSTER FARBSTOFF` · fr `TEINTURE PROCHE` · ko `가까운 염료` · zh `最近的染剂` — edit `card.found`; fr `TROUVÉ` still translates a retired English "FOUND", ko `가장 가까운` / zh `最接近` are bare modifiers with no head noun |

On 15: the value currently in the *tighter* slot (`card.swatchNearest`) was picked so nothing can
overflow — except de, where `NÄCHSTE FARBE` says *colour* and must lose to `NÄCHSTER FARBSTOFF`
(core de `labels.dye` = Farbstoff); check that one render. If a card needs a shorter label, give
**EN** two values (as `ratioCol` / `ratioShort` do) rather than letting one locale diverge.

## TASK 4 — German register

Standardise on **du** — already the majority in web-app (~29 strings), the *only* register in the
bot's `de.json` (50) and in all four German policy documents, and the German FFXIV client itself
addresses the player informally; `Sie` survives only in the five oldest namespaces, so it is legacy
drift, not a decision. French stays `vous`: German gaming convention is informal, French software
convention is formal. Pitfalls (`de.json` lines) — do not run a regex sweep:

1. `919` "Voreinstellung eingereicht! **Sie** wird nach Moderatorprüfung angezeigt." — 3rd-person
   *die Voreinstellung*, not address. Must stay. (48 real + 1 false positive in the 49.)
2. `874` "Sind Sie sicher, dass Sie dieses Preset löschen möchten?" → "Möchtest du dieses Preset
   wirklich löschen?"
3. `546` `gridAriaLabel` "Verwenden Sie Pfeiltasten…" → drop the pronoun: "Pfeiltasten zum
   Navigieren, Enter oder Leertaste zum Auswählen."
4. `870` "Versuchen Sie andere Filter" is a *button* label — infinitive: "Andere Filter versuchen"
   (same for the other `emptyStates.*.action` keys).
5. `902` / `903` "Melden Sie sich … an" → "Melde dich … an" — reflexive and separable verb.
6. `576` / `725` "Sie sind offline." → impersonal: "Keine Internetverbindung."
7. `790` "Ihre Favoriten" / `827` "…auf Ihre Lieblingsfarben zu" — `Ihr*` is always capitalised,
   `dein*` lower-case unless string-initial; a case-preserving swap yields a wrong "Deine".
8. `235`, `653-655`, `666`, `667`, `669` "Bitte versuchen Sie es erneut." → "Bitte versuch es noch
   einmal."; `669` has two verbs ("…oder lade die Seite neu").

## TASK 5 — bot-logic identical to English

| key | lc | replacement | reason |
|---|---|---|---|
| `card.slotLimbal` | de | `LIMBUS` | core de `sheets.tattooColors` = "Tätowierung/**Limbus**"; same width as the siblings (TÄTOW., STRÄHN) |
| `card.slotLimbal` | fr | `LIMBE` | core fr `sheets.tattooColors` = "Tatouage/**Limbe**" |
| `about.poweredBy` | de | `Betrieben mit Cloudflare Workers` | the only fully-English sentence in de's `about` block; fr / ja / ko / zh all localise it |
| `card.swatchSlot` | de | `BEREICH` *(borderline)* | every other locale translated it (fr `EMPL.`, ja / zh `部位`, ko `부위`); "Slot" is Duden-legal, so polish, and de's own house word for a slot is *Platz* |

Keep (genuine in-language words): de / fr `about.version`, `preset.tags`, `webhook.fields.tags`;
de `about.links`, `manual.tips.links`, `about.categories.community`, `card.restCol`,
`gradient.startColor`, `preset.name`, `preferences.filters.labels.metallic` (core de
`labels.metallic` = "Metallic"); fr `card.base`, `card.tier0`, `card.ratioCol` / `ratioShort`
(`RAPPORT` would be more idiomatic for contrast, not a defect), `preferences.filters.labels.pastel`,
`preset.cardVotes_one/_other`, `preset.votes`, `quality.excellent`, `stats.summary.documentation`,
`webhook.fields.source`.

## NOTES

- **EN typo + a structural hole in the mixer labels.** `en.json:187` = `"Spectral -Realistic
  Paint"` — missing space; all five translations have it. `config-sidebar.ts:1371-1376` hard-codes
  the `RYB - ` / `OKLAB - ` / `LAB - ` / `HSL - ` / `RGB - ` prefixes but gives spectral none, so
  "Spectral" is translated *inside* the value while the other five stay Latin. Consequence:
  `config.mixingSpectral` and `mixer.modelSpectral` never share an English value, so a same-English
  rule can never catch drift between them (exactly how `颜料画` / `颜料` diverged). Move
  `SPECTRAL - ` into the template, or pull all six prefixes into the locale.
- **`extractor.poweredBy` has the same defect and is invisible to the guardrail.** bot-logic
  `de.json:501` = "Powered by Photon WASM Bildverarbeitung" — half-English, but it differs from EN
  so section B never lists it → `Betrieben mit Photon-WASM-Bildverarbeitung`.
- **The ja 染料 / カララント "by surface" rule is not implemented.** `preset` is 10 カララント : 1
  染料; `colorPalette.searchPlaceholder` says 染料を検索 while `harmony.selectDye`, rendered beside
  the open palette drawer, says カララントを選択. File-wide 86 : 38, 染料 clustered in `tutorial`,
  `config`, `colorPalette`, `emptyStates`. Write the boundary down and enforce it, or sweep.
- **Two German terminology drifts in web-app `de.json`.** (a) `tutorial` says "Farbe(n)" 19 times
  where it means *Farbstoff(e)*. (b) One noun, three words for *preset*: "Preset" (874, 1046),
  "Voreinstellung" (653, 655, 902, 919), bot-logic de's "Community-Vorlagen".
- **The limbal noun disagrees across sources even after the de / fr fix.** Cards would read
  Limbus / Limbe / リムバル / 림벌 / 角膜环 while core's `sheets.tattooColors` says Limbus / Limbe /
  角膜 / 홍채 / 虹膜. Pin one per language in `docs/reference/ffxiv-terminology.md` first.
