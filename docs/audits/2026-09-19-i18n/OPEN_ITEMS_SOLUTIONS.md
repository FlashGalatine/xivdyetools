# Open items — best solutions (2026-09-20)

**Status: PROPOSED.** Nothing here has been applied except §5, which is a record update (three
terms verified, no shipped string changed). Everything else waits for the maintainer's go-ahead;
§8 is the execution order if it is given.

Scope: the items the [audit report](I18N_AUDIT_2026-09-19.md) left under *Open items*, the choices
PR #192 flagged as vetoable, and what turned up while looking. Each section states the problem,
what was measured, the recommended solution and what it touches. An `opus` reviewer reading all
five languages checked the judgment calls (`evidence/open-items-review-brief.md`); its verdicts are
folded in and marked **[reviewer]**.

| # | Item | Recommended solution | Touches |
|---|---|---|---|
| 1 | Two ambiguous English policy sentences | Reword the English (3 sentences); translations already carry the intended reading except German (2 fixes). Better still: say *whose* law — "the place where you live" | bot ToS ×6, web ToS ×6, 2 changelog lines |
| 2 | zh Paint / Pigment collision | RYB → `颜料`, Spectral → `真实颜料` — the pair the zh sidebar already uses. Same defect in German: `Farbe` → `Malfarbe` | `zh.json` 3 values, `de.json` 4 |
| 3 | Guardrails never built | Build them **in vitest**, not in `validate:i18n` — that script runs in no CI job. Ten allow-list entries; six groups of real drift to fix as the gate goes on | web-app + bot-logic tests, 2 allow-lists, ~20 locale values |
| 4 | What's New budget 40 → 48 KB | Bound the module in **bytes** (the gate's unit), link older releases, restore 40 KB | changelog plugin, modal, 1 locale key ×6 |
| 5 | ko `데이터 센터`, zh `服务器` / `大区` unverified | **Done** — read raw from the official pages in a real browser | records only |
| 6 | Found while looking | German register (48 formal strings in a `du` product); an English typo with a structural cause; "Perceptual" naming two models | `de.json`, `en.json`, `config-sidebar.ts` |
| 7 | Choices that stay yours | No action needed | — |

---

## 1. Two ambiguous English policy sentences

**Problem.** Two English sentences were each parsed two ways by the translators
(`policy-documents.md` → *Ambiguous English costs five translations*):

- bot ToS §3 — "Find FFXIV dyes closest to any hex color or extracted from images": is it the
  *dyes* that are extracted from images, or the *colors*? (`/extractor image` pulls colors out of
  an image and then matches dyes to them — so: the colors.)
- the consumer-rights sentence in both Terms — "a consumer-protection right your local law gives
  you and does not let you waive": the subject of "does not let you waive" is left to the reader.
  The French draft detached it from *local law* entirely until a reviewer restored `auquel il`.

**What was checked.** All six variants of all three sentences, today:

| Sentence | ja | de | fr | ko | zh |
|---|---|---|---|---|---|
| bot §3 Color Matching | 画像から抽出した**色**に最も近い | einer aus einem Bild extrahierten **Farbe** | couleur … ou **extraite** d'images (agrees with *couleur*) | 이미지에서 추출한 **색상**에 가장 가까운 | 或从图像中提取**颜色**进行匹配 |
| consumer right (bot §11, web *Governing law*) | 法律が付与し、放棄することを認めていない | das dir dein örtliches Recht gewährt und das du nicht abbedingen kannst | que votre droit local vous accorde et **auquel il** ne vous permet pas de renoncer | 법이 부여하고 포기할 수 없도록 정한 | 当地法律赋予且不允许放弃的 |

Every translation already carries the intended reading — the earlier `opus` pass fixed them. The
only text still ambiguous is the governing English, which is also the text the next translator
(or a seventh language) starts from.

**Solution — reword the English, change no meaning.**

| File | Today | Proposed |
|---|---|---|
| `apps/discord-worker/TERMS_OF_SERVICE.md` §3 | Find FFXIV dyes closest to any hex color or extracted from images | Find the FFXIV dyes closest to any hex color, or to colors extracted from an image |
| same, §11 | Nothing in these Terms removes a consumer-protection right your local law grants you and does not permit you to waive. | Nothing in these Terms removes any consumer-protection right that your local law grants you and that the same law does not permit you to waive. |
| `apps/web-app/TERMS_OF_SERVICE.md` *Governing law* | Nothing here takes away a consumer-protection right your local law gives you and does not let you waive. | Nothing here takes away any consumer-protection right that your local law gives you and that the same law does not let you waive. |

**[reviewer]** §3: all five translations already say exactly this — no edit. Consumer-rights
sentence: ja, fr, ko, zh keep *the law* as the subject of both clauses — no edit. **German needs
one in both files**: `das du nicht abbedingen kannst` makes non-waivability the *user's* inability
rather than the law's rule, and `abbedingen` is lawyer-German in the web document's plain register:

| File | old → new |
|---|---|
| `apps/discord-worker/TERMS_OF_SERVICE.de.md` | `gewährt und das du nicht abbedingen kannst.` → `gewährt und das nach diesem Recht unabdingbar ist.` |
| `apps/web-app/TERMS_OF_SERVICE.de.md` | `gewährt und das du nicht abbedingen kannst.` → `gewährt und auf das du nach diesem Recht nicht verzichten kannst.` |

**A second ambiguity the reviewer raised, and the better fix: "your local law".** The sentence
follows straight on from "…the state or federal courts located in North Carolina", and *local law*
can be read as the law of that venue — which would invert the clause. Mandatory consumer protection
attaches to where the consumer lives; ja (`居住地の法律`) and ko (`거주 국가 법`) already say so, de
/ fr / zh say "local law". The reviewer proposes "the law of your country of residence". One
adjustment to that: for many users the non-waivable rights are **state or provincial** law
(California, Québec, New South Wales — and the governing law here is itself a state's), so *place*
is safer than *country*:

| | Minimal (syntax only) | Recommended (syntax + whose law) |
|---|---|---|
| bot §11 | …any consumer-protection right that your local law grants you and that the same law does not permit you to waive. | …any consumer-protection right that the law of the place where you live grants you and that the same law does not permit you to waive. |
| web | …any consumer-protection right that your local law gives you and that the same law does not let you waive. | …any consumer-protection right that the law of the place where you live gives you and that the same law does not let you waive. |
| translations | de ×2 (above) | de ×2, fr ×2, zh ×2, ko ×2 (`거주 국가` → place of residence); ja already says 居住地 — wording to be produced and verified at execution |

**What it touches.** Per the six-file rule: both Terms documents get the same new `Last updated`
date in all six variants (the web Terms promise "changes are posted here with a new date"). One
line in each app's `CHANGELOG-laymans.md` ("two sentences reworded for clarity; nothing you agreed
to changed"). Not a *significant* change, so no announcement beyond the release notes. The parity
script is unaffected — no number, token or URL moves. The English web sentence wraps across two
lines, so the replacement re-wraps.

**Set aside.** *Leave it*: costs nothing today and re-trips on the next translation or the seventh
language.

This is legal text and the maintainer's call — neither the coordinator nor the reviewer is a
lawyer. The recommendation is only that the wording should stop admitting two readings, of the
syntax and of whose law is meant.

## 2. zh: two mixing modes, one word

**Problem.** The Dye Mixer has two paint-like models. English calls them *Paint* (RYB, the artist's
wheel) and *Pigment* (Spectral, Kubelka–Munk). ja 絵の具 / 顔料 and ko 물감 / 안료 have two words;
Chinese does not — `颜料` is the everyday word for both. The original Mixer spec (`7d029298`) gave
Pigment `颜料` and, to dodge the collision, coined `颜料画` for Paint; TERM-004 then spread `颜料画`
to the sidebar so the two surfaces agreed.

`颜料画` means "a painting done in pigments" — a picture, not a medium. It is the wrong kind of
noun for a mode name.

**Solution.** Use the pair the zh sidebar has shipped all along — `光谱 - 真实颜料` for Spectral —
in both label families:

| Key | EN | zh today | zh proposed |
|---|---|---|---|
| `mixer.modelRyb` | Paint | 颜料画 | 颜料 |
| `config.mixingRyb` | Paint | 颜料画 | 颜料 |
| `mixer.modelSpectral` | Pigment | 颜料 | 真实颜料 |
| `config.mixingSpectral` | Spectral - Realistic Paint | 光谱 - 真实颜料 | unchanged |

`颜料三原色` = red-yellow-blue is schoolbook Chinese, so `颜料` is the natural label for RYB; "real
paint" is how the sidebar already tells the physical model apart. No new vocabulary, no two modes
sharing a label on either surface. Set aside: `色料` (textbook "colourant", stiff), `绘画颜料`,
`涂料` (house paint), `色素` (food colouring).

**[reviewer]** ACCEPT. `真实颜料` is already shipping in the sidebar, so the two label families
converge; it also stays clear of `色素`, which is the zh name of FFXIV's *Pigment* currency items
in core. Runner-up: `逼真颜料` — `about.spectralCredit` already says "逼真的颜料混合", so `逼真` is
the house adjective for "realistic"; either is native, `真实` wins on already-shipped consistency.

**The reviewer found the same defect in German.** de `Farbe` for *Paint* also means *colour*: in
the row `Farbe / Pigment / Perzeptuell / LAB / Farbton / Licht` it distinguishes nothing, since
every model is about colour. → `Malfarbe`, the everyday art-supplies word, which matches core de's
own `colorWheels.ryb` = "RYB (Malerfarbkreis)":

| Key | de today | de proposed |
|---|---|---|
| `mixer.modelRyb`, `config.mixingRyb` | Farbe | Malfarbe |
| `config.mixingSpectral` | Spektral - Realistische Farbe | Spektral - Realistische Malfarbe |
| `config.mixingRybDesc` | Farbsimulation. Blau + Gelb = Grün. | Malfarben-Simulation. Blau + Gelb = Grün. |

Fonts: the web app draws no cards and og-worker / discord-worker do not render these keys, so no
subset changes.

## 3. The guardrails that were recommended and not built

Open item 6 named two (report recommendations 2 and 3). Checking the list again, **two more were
never built either** and the report did not say so: recommendation 7 (`--coverage.enabled=false`
on subset gate runs) and recommendation 8 (an og-worker render test with the longest de / fr wheel
name in the harmony deck row).

### 3a. Where a gate has to live — `validate:i18n` runs in no CI job

`.github/workflows/ci.yml` runs `turbo run lint / type-check / test / build`. Nothing in any
workflow runs `validate:i18n` (grep: no workflow mentions it). Its two scripts —
`validate-i18n.js` (referenced keys exist, key order) and `i18n-parity.mjs` (missing / extra keys,
placeholders, empties, duplicates, identical-to-EN) — are **hand-run gates**; only the orphan check
has a vitest twin (`src/__tests__/i18n-orphans.test.ts`). A pull request that drops a key from one
locale is green today.

So recommendation 2 as written ("add it to `validate:i18n`") would have produced a check that
gates nothing. The check belongs in vitest, and the same test should finally put `checkParity()`'s
existing hard errors in front of CI.

### 3b. Same-English consistency (recommendation 2)

Rule: keys that share one English value share one value in every other locale, unless the group is
allow-listed with a reason. It would have caught TERM-001, TERM-002 and TERM-004 at PR time.

Measured on this branch (`evidence/guardrail-measure.txt`):

| Set | EN keys | same-EN groups | diverge in ≥ 1 locale | group × locale cells |
|---|---|---|---|---|
| web-app | 1,128 | 62 | 12 | 24 |
| bot-logic | 653 | 24 | 3 | 12 |

Small enough to be a **hard gate with a curated allow-list**, not a warning.

**[reviewer] — every divergent group read in context.** Ten allow-list entries; six groups carry
real drift (*Saved* is both: legitimate in French, drift in German). The check earns its keep on
day one.

| Set | EN value | Locale(s) | Verdict | Allow-list reason, or the one value both keys should carry |
|---|---|---|---|---|
| web | All | fr | LEGIT | three head nouns: `Tout` (chips), `Toutes` (catégories), `Tous` (préréglages) |
| web | Dark | ko | LEGIT | `다크` = theme / palette label; `어두움` = swatch lightness band |
| web | Save | de | LEGIT | `Speichern` = form save; `Merken` = bookmark a preset |
| web | Clear | all 5 | LEGIT | verb "clear the field" vs the *Clear* distinctness tier |
| web | Light | all 5 | LEGIT | additive-light model vs theme name vs lightness band |
| web | Saved | fr | LEGIT | plural tab `Enregistrés` vs singular button state `Enregistré` |
| web | Remove | ko | LEGIT | `삭제` deletes the uploaded image; `제거` removes from a list |
| web | Compare | de | LEGIT | nav noun `Vergleich` vs menu infinitive `Vergleichen` |
| bot | RATIO | ja de ko zh | LEGIT | wide column header vs narrow in-cell label on the contrast card |
| bot | TARGET | ja ko zh | LEGIT | target *colour* (sheet / extractor) vs target dye row (budget ledger) |
| web | Dyes | ja | **DRIFT** | `preset.dyes` 染料 → `カララント` (ten other `preset.*` keys already say so) |
| web | Vote | de | **DRIFT** | both → `Abstimmen`; and `preset.voted` `Gewählt` → `Abgestimmt` |
| web | Saved | de | **DRIFT** | both → `Gemerkt` — the action is *Merken*, so the tab must not say *Gespeichert* |
| web | Select a dye | ja | **DRIFT** | both → `カララントを選択` (+ `emptyStates.noHarmony.description` 染料 → カララント) |
| web | All slots are full… | ja de ko zh | **DRIFT** | ja `…埋まっています。…`, de `Alle Plätze sind belegt. Wähle einen zum Ersetzen:`, ko `…가득 찼습니다…`, zh `所有槽位已满。请选择要替换的槽位：` |
| bot | NEAREST DYE | all 5 | **DRIFT** | `card.found` still translates a retired English "FOUND" (fr `TROUVÉ`; ko / zh are bare modifiers with no noun) → ja `近いカララント`, de `NÄCHSTER FARBSTOFF`, fr `TEINTURE PROCHE`, ko `가까운 염료`, zh `最近的染剂` |

The bot row changes strings drawn on cards. Every proposed value already ships in a sibling key, so
no new glyph is expected — `font-coverage.test.ts` decides, not this sentence — and de
`NÄCHSTER FARBSTOFF` moves into the tighter `card.swatchNearest` slot, so that card gets one render
check. If a card genuinely needs a shorter label, give **English** two values (as `ratioCol` /
`ratioShort` do) rather than letting one locale diverge silently.

**Design.**

- web-app: `checkSameEnglish()` exported from `scripts/i18n-parity.mjs` (so the hand-run report
  prints it too); allow-list `scripts/i18n-same-english-allowlist.json`, keyed by the English
  value → `{ reason, locales }`; a stale entry (the group no longer diverges there) fails, so the
  file cannot rot — the same rule the identical-to-EN allow-list already follows.
- a new vitest file asserts, on the real locale files: no hard parity error, no divergence outside
  the allow-list, no stale entry. That is the step that makes any of it a CI gate.
- bot-logic: the same check in a new `src/i18n/__tests__/locale-quality.test.ts`.
- Exact-match grouping only. Case-folded or trimmed grouping was considered and dropped: `Light`
  vs `light` are usually different parts of speech, and the noise would train people to allow-list
  by reflex.

### 3c. bot-logic identical-to-English allow-list (recommendation 3)

Measured: 56 keys are identical to English in at least one locale (ja 32, de 45, fr 47, ko 32,
zh 31). **31 are identical in all five** and are command syntax (`manual.*.name` ×20), brands,
units and symbols (`RGB`, `HSV`, `≥ 4.5:1`, `GIL/ΔE`, `Discord`). The other 25 are de / fr cognates
and card abbreviations.

**[reviewer]** of those 25, three are genuinely untranslated and one is polish; the rest are real
words in the language (de *Version*, *Tags*, *Links*, *Name*, *Rest*, *Metallic* — core's own de
label; fr *Pastel*, *Excellent*, *Source*, *Base*, *ratio*).

| Key | Locale | Today | Replacement | Why |
|---|---|---|---|---|
| `card.slotLimbal` | de | LIMBAL | `LIMBUS` | core de `sheets.tattooColors` = "Tätowierung/**Limbus**" |
| `card.slotLimbal` | fr | LIMBAL | `LIMBE` | core fr = "Tatouage/**Limbe**" |
| `about.poweredBy` | de | Powered by Cloudflare Workers | `Betrieben mit Cloudflare Workers` | the only English sentence in de's `about` block; fr / ja / ko / zh all localise it |
| `card.swatchSlot` | de | SLOT | `BEREICH` (borderline) | every other locale translated it; *Slot* is legal German, so polish only |

A blind spot worth knowing: the check only sees values **identical** to English. de
`extractor.poweredBy` = "Powered by Photon WASM Bildverarbeitung" is half-English and invisible to
it (→ `Betrieben mit Photon-WASM-Bildverarbeitung`). The limbal noun also disagrees across sources
even after this fix — cards say リムバル / 림벌 / 角膜环 where core's sheet name says 角膜 / 홍채 /
虹膜 — so it needs a dictionary row before anyone edits it again.

**Design.** Same test file as 3b; allow-list `locale-identical-allowlist.json` beside the locales
with web-app's five accepted reasons (`format`, `unit`, `identifier`, `brand`, `cognate`), plus one
rule instead of a hundred entries: a key matching `manual.*.name` is command syntax and is
identical by construction. Unlisted identical value → fail; stale entry → fail. Add placeholder-set
parity to the same file — bot-logic has no gate for it today (0 mismatches, by hand, in this
audit).

### 3d. The two small ones

- Recommendation 7: the subset gate commands in `i18n-manager/SKILL.md` and `evidence/scripts/
  run-gates.sh` need `--coverage.enabled=false`, or a green subset run exits 1 on coverage
  thresholds. A text fix in the skill and the script.
- Recommendation 8: one og-worker test rendering the harmony card with the longest de / fr wheel
  name in the deck row, asserting the line fits the 400 grid. The `fit()` guard exists; nothing
  exercises the long combination.

## 4. The What's New budget

**Problem.** The release-notes chunk reached 40.06 KB against a 40 KB limit; PR #192 raised the
limit to 48 KB. Measured (`evidence/whats-new-chunk-composition.txt`):

- 32 releases = 40.78 KB of module JSON (14.4 KB gzipped), **1.27 KB per release** on average;
- one release, 5.0.0, is 10.39 KB — a quarter of the chunk;
- the plugin bounds the module by **count** (`MAX_VERSIONS_TO_INCLUDE = 50`), which at today's
  average is **63.7 KB**. The gate measures bytes. The two bounds have never agreed.

At 1.27 KB per release, 48 KB is about six releases away — and 5.x has shipped fourteen in six
weeks. The raise was a patch, not a fix.

**Solution — bound the module in the unit the gate measures.**

1. `vite-plugin-changelog-parser.ts`: replace the 50-release cap with a byte budget
   (`MAX_MODULE_BYTES`, 36 KB of JSON): include newest-first until the next release would cross
   it, never fewer than 10. Export `olderReleases` (how many were left out).
2. `changelog-modal.ts` (history mode): when `olderReleases > 0`, one footer link — "Older
   releases on GitHub" → the full `CHANGELOG-laymans.md`. One new locale key ×6.
3. `check-bundle-size.js`: limit back to **40 KB**, with the comment pointing at the plugin's
   budget as the thing that keeps it true.
4. A plugin unit test on the real changelog: emitted module ≤ budget.

Today that keeps 22 releases (back to 4.10.0, April 2026) in the modal and the rest one click
away; nothing is deleted from the changelog. The gate can then only trip if a *single* release
note is enormous — which is a thing worth being told.

Optional, −3.1 KB: `highlights[]` repeats the section headers and `title` is always `""`; both can
be derived in the modal. Not needed once the budget exists; skip unless the byte budget feels
tight.

**Set aside.** Keep raising the limit (needs a human every ~6 releases); trim old entries from the
changelog file itself (deletes history the repo should keep, and `/changelog` on the bot reads its
own file anyway); condense 5.0.0 (one-time 10 KB, same growth afterwards).

## 5. The three unverified terms — closed

The report carried ko `데이터 센터` and zh `服务器` / `大区` as "not on a captured page". Both
official sites defeat a plain fetch (one through a summarizer, one client-rendered), so they were
loaded in a real browser and the raw DOM text read:

| Term | Page | Verbatim | Counter-check |
|---|---|---|---|
| ko `데이터 센터` | `m.ff14.co.kr/guide/start/detail.asp?no=1025` | "데이터 센터 란 여러개의 서버를 그룹하고 있는 상위 개념으로 1개의 데이터 센터 에 여러개의 서버가 존재한다." — ×38, always with the space | `데이터센터` ×0, `월드` ×0 |
| zh `服务器` | `ff.web.sdo.com/web8/index.html#/servers` | "服务器状况", "全服务器状况一览" — ×16 | `世界` ×0 |
| zh `大区` | same page | "※每个大区仅限获得1次100万金币，且仅限正式账号" | `数据中心` ×0 |

All eighteen Market / World / Data Center values are now read from the publisher's own page.
Recorded in `evidence/official-terms-research.md` (zh confidence MED-HIGH → HIGH) and in the
dictionary's source note; the recipe went into the skills' trap file so the next audit reads such
pages in the browser before asking for a capture. No shipped string changed.

## 6. Found while looking

### 6a. German: 48 formal strings in an informal product

web-app `de.json` matches `Sie` / `Ihr` in 49 strings (48 are address, one is a third-person
*sie*) — the older namespaces
(`tutorial` 19, `preset` 11, `errors` 6, `emptyStates` 5, `dyeSelector` 4) — and as `du` in about
29 newer ones. The bot's German (50 strings) and all four German policy documents are uniformly
`du`. French is uniformly `vous` on every surface, so this is a German-only drift. The
same-English check surfaced it: `gradient.slotsFull` says "Wähle einen…", its twin
`resultCard.slotsFull` "Wählen Sie einen…".

**[reviewer]** Standardise on **`du`**: it is already the majority in the web app, the only
register in the bot and the policies, and the German FFXIV client addresses the player informally;
`Sie` survives only in the five oldest namespaces, so it is legacy drift, not a decision. French
staying `vous` is not an inconsistency — German gaming convention is informal, French software
convention is formal. **Not a regex job** — 48 real strings plus one false positive, and most need
rewriting rather than swapping:

- `preset` "…eingereicht! **Sie** wird nach Moderatorprüfung angezeigt." — that `Sie` is *die
  Voreinstellung*, third person. It stays.
- "Sind Sie sicher, dass Sie … löschen möchten?" → "Möchtest du dieses Preset wirklich löschen?"
- button labels take the infinitive, not an imperative: "Versuchen Sie andere Filter" → "Andere
  Filter versuchen" (all `emptyStates.*.action` keys).
- reflexives and separable verbs move too: "Melden Sie sich … an" → "Melde dich … an".
- "Sie sind offline." reads better impersonal: "Keine Internetverbindung."
- `Ihr*` is always capitalised, `dein*` only string-initially — a case-preserving swap leaves a
  wrong mid-sentence "Deine".
- "Bitte versuchen Sie es erneut." → "Bitte versuch es noch einmal." (the idiomatic imperative
  drops the -e).

Would be filed as `I18N-011` (P3, web-app, de). Fix: one `sonnet` translator converts the 48 with
this list in its brief, one `opus` verifier reads the diff — the workflow that worked for the
policies.

### 6b. English: a typo, and one label naming two models

- `config.mixingSpectral` is `"Spectral -Realistic Paint"` — a missing space, in the default
  locale, in the sidebar's mode picker. All five translations have it right; the English source
  is the wrong one (the same shape as "Advanced Options").
- The sidebar and the Mixer name the six models differently, and **"Perceptual" names two of
  them**: LAB in the sidebar (`config.mixingLab`), OKLAB in the Mixer's tooltips and export line
  (`mixer.modelOklab`). Same-English checks cannot see this — the English itself disagrees.

  | Model | Sidebar option | Mixer tooltip / export |
  |---|---|---|
  | spectral | Spectral - Realistic Paint | Pigment |
  | ryb | RYB - Paint | Paint |
  | oklab | OKLAB - Modern Perceptual | **Perceptual** |
  | lab | LAB - **Perceptual** | LAB |
  | hsl | HSL - Hue-based | Hue |
  | rgb | RGB - Light | Light |

  The bot agrees with the sidebar (`preferences.blendingModes.oklab` = "Modern perceptual…",
  `.lab` = "Perceptually uniform CIELAB…"), so the Mixer's tooltips are the odd ones out.
  Smallest fix: `mixer.modelOklab` → "Modern Perceptual", `mixer.modelLab` → "Perceptual" (×6,
  the translations already exist under `config.mixing*`). Cleaner: one label family for both
  surfaces, as `toolLabel()` did for tool names. A naming decision, like the tool names were.

- **[reviewer] A structural hole behind the typo.** `config-sidebar.ts` hard-codes the `RYB - ` /
  `OKLAB - ` / `LAB - ` / `HSL - ` / `RGB - ` prefixes in the template but gives Spectral none, so
  "Spectral" is translated *inside* the value while the other five model names stay Latin. It also
  means `config.mixingSpectral` and `mixer.modelSpectral` never share an English value — no
  same-English rule can ever catch drift between them, which is exactly how `颜料画` / `颜料`
  diverged. Fix: move the prefix into the template; the key becomes "Realistic Paint" ×6.

### 6c. Notes — real, but beyond the open items

From the reviewer unless marked; recorded so they are not lost. None is proposed for this pass.

- **The ja 染料 / カララント "by surface" rule is unwritten and not followed.** web-app `ja.json` is
  86 カララント : 38 染料, with 染料 clustered in `tutorial`, `config`, `colorPalette`,
  `emptyStates`; the `preset` namespace is 10 : 1. Either write the boundary into the dictionary
  and enforce it, or sweep to カララント — as an unwritten rule it will keep producing §3b rows.
- **German `tutorial` says "Farbe(n)" 19 times where it means *Farbstoff(e)*** ("Wählen Sie eine
  Farbe aus der Farbpalette") while every tool namespace says Farbstoff. The §6a translator pass
  touches the same strings; fold it in there if §6a is approved.
- **One German noun, three words for *preset*:** "Preset", "Voreinstellung", and the bot's
  "Community-Vorlagen".
- (coordinator) ko writes the Spectral model `스펙트럼` in the sidebar and `스펙트럴` in the tutorial.

## 7. Choices that stay yours — no solution needed

- **"Also available in: …"** on the four English policies — navigation only; remove on request.
- **Harmony link-preview headline** "Harmony Explorer" (was "Color Harmony") — follows the
  official-name decision; the old short form is one table row away.
- **ko `코디` (UI) / `의상` (legal)** — Korean has no official noun for one outfit; both choices are
  sourced (`evidence/official-terms-research-glamour.md`). A Korean-speaking member of the Discord
  is a better judge than any further research.
- **Merging PR #192** — production deploy + the 5.9.0 announcement, then Publish Packages: core
  5.4.0 first, bot-logic 4.4.0 second, and confirm `register-commands` ran.

## 8. If approved — execution order

One commit each, on this branch, gates between:

1. §2 + §6b — `zh.json` ×3, `de.json` ×4, the sidebar prefix moved into the template (which
   removes the typo), + the Perceptual rename if wanted — web-app.
2. §6a — German register, translator + verifier — web-app.
3. §3 — guardrails, after 1–2 so the allow-lists are curated against the final strings; the six
   DRIFT groups and the §3c replacements land in the same commits that turn the gates on —
   web-app, then bot-logic.
4. **Fonts** — §3's bot rows change strings drawn on cards (`card.found` ×5, `card.slotLimbal`
   de / fr). Expected: no re-cut, since every value reuses glyphs already drawn; both
   `font-coverage.test.ts` files decide. One render check for de `NÄCHSTER FARBSTOFF` in the
   swatch card's slot.
5. §4 — byte-bounded What's New module, limit back to 40 KB — web-app.
6. §1 — the English sentences, the translations that follow, dates ×12, two changelog lines —
   discord-worker + web-app. Last, because it is the one item that needs a wording decision.
7. §3d, report + plan status, changelogs, PR body.

No version bumps beyond what the PR already carries: web-app 5.12.0, discord-worker 5.6.0 and
bot-logic 4.4.0 are all unreleased.
