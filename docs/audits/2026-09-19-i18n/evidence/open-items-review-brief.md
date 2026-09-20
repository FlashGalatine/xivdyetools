# Reviewer brief — open items of the 2026-09-19 i18n audit (verifier, 2026-09-20)

You are a native-level reviewer of **Japanese, German, French, Korean and Simplified Chinese** UI
and legal text. The product is XIV Dye Tools (Final Fantasy XIV dye / colour tools): a web app, a
Discord bot, link-preview cards. Six locales: `en ja de fr ko zh`.

**Read-only.** Work in `C:\dev\XIVProjects\xivdyetools\.claude\worktrees\i18n-audit-2026-09-19`.
Write no files, run no git command of any kind, no builds, no installs. Your final message is the
deliverable, in the format at the end. Be decisive: a verdict with a one-line reason beats a survey.

Files you will need:

- `docs/audits/2026-09-19-i18n/evidence/guardrail-measure.txt` — the data for Tasks 3 and 5.
- `apps/web-app/src/locales/<lc>.json`, `packages/bot-logic/src/i18n/locales/<lc>.json`.
- `apps/web-app/TERMS_OF_SERVICE[.<lc>].md`, `apps/discord-worker/TERMS_OF_SERVICE[.<lc>].md`.
- `docs/reference/ffxiv-terminology.md` — game nouns. House choices that are NOT defects: ja uses
  both 染料 and カララント by surface; ko "glamour" = 코디 (UI) / 의상 (legal); operator = one person
  (運営者 / 저희 / 我们 / wir / nous — never "the company").

## Task 1 — Chinese: two mixing modes that collapse into one word

The Dye Mixer has six blending models. Two are paint-like:

| Model | EN tooltip (`mixer.model*`) | EN sidebar option (`config.mixing*`) | What it is |
|---|---|---|---|
| `ryb` | Paint | `RYB - Paint` — desc "Paint simulation. Blue + Yellow = Green." | the artist's red-yellow-blue wheel, a simple model |
| `spectral` | Pigment | `Spectral - Realistic Paint` — desc "Kubelka-Munk physics. Blue + Yellow = Green." | physically based Kubelka–Munk pigment mixing |

ja 絵の具 / 顔料 and ko 물감 / 안료 have two words. zh ships `mixer.modelSpectral` = `颜料`,
and because of that collision `mixer.modelRyb` / `config.mixingRyb` = `颜料画`;
`config.mixingSpectral` = `光谱 - 真实颜料`.

The coordinator's reading: `颜料画` means "a painting done in pigments" (a picture), not a medium,
so it is wrong as a mode name; Chinese has one everyday word (`颜料`) for both paint and pigment,
and "颜料三原色 = 红黄蓝" makes `颜料` the natural label for RYB. Proposal: **RYB → `颜料`,
Spectral → `真实颜料`** in both families (the sidebar already says `光谱 - 真实颜料`).

Verdict wanted: accept, or give a better pair. Candidates considered and set aside: `色料`
(textbook "colourant", stiff), `绘画颜料`, `涂料` (house paint), `色素` (food colouring), `光谱`.
The two labels must be distinct, natural to a player, and short (tooltip + a `<select>` option).
Also say whether de `Farbe` for "Paint" (it also means "colour") is a problem worth fixing and
with what (the sidebar reads `RYB - Farbe`, `Spektral - Realistische Farbe`).

## Task 2 — three clarified English policy sentences

Two English sentences were parsed two ways by translators; an earlier review corrected the
translations. The English is now to be made unambiguous with **no change of meaning**:

| # | File | Today | Proposed |
|---|---|---|---|
| 2a | `apps/discord-worker/TERMS_OF_SERVICE.md` §3 | `- **Color Matching**: Find FFXIV dyes closest to any hex color or extracted from images` | `- **Color Matching**: Find the FFXIV dyes closest to any hex color, or to colors extracted from an image` |
| 2b | same file §11 | `Nothing in these Terms removes a consumer-protection right your local law grants you and does not permit you to waive.` | `Nothing in these Terms removes any consumer-protection right that your local law grants you and that the same law does not permit you to waive.` |
| 2c | `apps/web-app/TERMS_OF_SERVICE.md` (Governing law) | `Nothing here takes away a consumer-protection right your local law gives you and does not let you waive.` | `Nothing here takes away any consumer-protection right that your local law gives you and that the same law does not let you waive.` |

For each of 2a / 2b / 2c and each of the five languages, read the current translated sentence in
the sibling file and answer: does it already say exactly what the **proposed** English says?
`OK`, or an exact-substring replacement (`old` → `new`, minimal). Note that ja / ko render "your
local law" as the law of the user's place of residence while de / fr / zh say "local law" — say
whether that difference matters and which the English should follow. Improve the proposed English
if you see a better wording that stays in each document's register (the bot's is formal, the web
app's is plain-spoken).

## Task 3 — same-English divergences: legitimate, or drift?

`guardrail-measure.txt` section A lists every group of keys that share one English value but are
translated differently inside a locale: 12 groups in web-app, 3 in bot-logic. A CI check is about
to enforce "same English → same translation" with an allow-list, so each group × locale needs a
verdict. Look at how each key is used when the value alone does not tell you (grep the key in
`apps/web-app/src` or `packages/bot-logic/src` / `apps/discord-worker/src`).

- `LEGIT` — the English word is doing two jobs (verb vs adjective, gender/number agreement, a
  theme name vs a lightness range). Give the allow-list reason in ≤ 12 words.
- `DRIFT` — it should be one translation. Give the value every key in the group should carry, per
  locale. Known suspects: `All slots are full. Select one to replace:` (de mixes du / Sie);
  bot `NEAREST DYE` (`card.found` looks like it still translates an older English "FOUND");
  de `Saved` (`Gespeichert` tab vs `Gemerkt` button, while the action is `Merken`).

## Task 4 — German register

web-app `de.json` addresses the user formally (`Sie` / `Ihr`) in 49 strings — older namespaces:
`tutorial` 19, `preset` 11, `errors` 6, `emptyStates` 5, `dyeSelector` 4 — and informally (`du`)
in about 29 newer ones. The bot's `de.json` (50 strings) and all four German policy documents are
uniformly `du`. French is uniformly `vous` everywhere. Verdict: standardise on which, and why;
list up to 8 strings where converting is not mechanical (imperatives, capitalised `Du`, passive
rewrites that would read better). Do not translate all 49.

## Task 5 — bot-logic values identical to English

Section B of `guardrail-measure.txt` lists 56 keys. 31 are identical in all five locales and are
command syntax, brand names, units or symbols — intentional. For the other 25 (de / fr cognates
such as `Version`, `Tags`, `Name`, `Pastel`, `Excellent`, card abbreviations such as `RATIO`,
`REST`, `SLOT`, `BASE`, `EXACT`, `LIMBAL`), flag **only** the ones that are genuinely untranslated
and should change, with the replacement. Suspects: de `about.poweredBy` = "Powered by Cloudflare
Workers"; de / fr `card.slotLimbal` = "LIMBAL" (the FFXIV limbal-ring colour slot — check the
dictionary and core locale data for the official de / fr noun).

## Return format

```
TASK1: ACCEPT | REPLACE — zh ryb=<…> spectral=<…> (sidebar spectral=<…>) — reason (≤ 2 lines)
       de Farbe: KEEP | REPLACE <…> — reason
TASK2: English: OK | improved wording per row
       | row | lc | verdict | old → new |          (only rows that are not OK; then "all others OK")
       local-law note: ≤ 3 lines
TASK3: | set | EN value | lc | LEGIT/DRIFT | reason or unified value(s) |
TASK4: standardise on <du|Sie> — reason (≤ 3 lines); pitfalls list
TASK5: | key | lc | replacement | reason |   (or "none")
NOTES: ≤ 5 bullets — anything else wrong that you tripped over while reading
```
