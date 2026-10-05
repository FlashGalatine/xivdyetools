# Reviewer brief — i18n audit 2026-10-04

You are one reviewer in a whole-monorepo i18n audit of **the code as it will be after tomorrow's
batch merge**: the local preview branch `preview/integration-2026-10-04` (`main@8ecb878f` + the 13
open PRs #223–#235). Repo root (run everything from here):
`C:\dev\XIVProjects\xivdyetools\.claude\worktrees\preview-2026-10-04`.

**Read-only.** Never edit, stage, stash or commit anything. Write exactly one file:
`docs/audits/2026-10-04-i18n/evidence/review-<your-slice>.md` (what you checked, positive
controls, rejected items, files covered). No scratch files anywhere in the tree — use
`$TEMP` if you must.

## Revisions

| Name | Rev | Meaning |
|---|---|---|
| BASE | `5c80fcba` | merge of PR #192 — the last i18n audit (2026-09-19) and its remediation |
| MAIN | `8ecb878f` | `origin/main` today |
| HEAD | `HEAD` | the preview branch = MAIN + the 13 open PRs |

Tag every candidate's **origin**: `MAIN` if the defect exists at `8ecb878f`, `PR#<n>` if an open PR
introduced it (`git log 8ecb878f..HEAD -- <file>`, or the `*.pr.diff` files below). An open PR can
still be fixed before tomorrow's merge, so origin matters.

## Evidence already produced (read these, do not regenerate)

- `docs/audits/2026-10-04-i18n/evidence/delta/web-app.tsv`, `bot-logic.tsv` — every locale key
  added / changed / removed BASE→HEAD with origin and all six HEAD values (tab-separated; `\n` =
  newline). Core's generated set has no delta.
- `docs/audits/2026-10-04-i18n/evidence/delta/diffs/*.main.diff` (BASE→MAIN) and `*.pr.diff`
  (MAIN→HEAD) for the 24 policy documents, `og-strings.ts`, `og-embed.ts`, `localize.ts`,
  moderation-worker `bot-i18n.ts`, `docs/reference/ffxiv-terminology.md`, the two allow-lists.
- `docs/audits/2026-10-04-i18n/evidence/_gate-summary.txt` + one file per gate/sweep (repo i18n
  gates, `locale-diff`, fonts, eslint, `policy-locale-parity`, `american-spelling*`,
  `tool-name-consistency`, `market-board-term`, `term-check`, `hc-sentences-*`, `webapp-innerhtml-sites`).
  A subset vitest run that exits 1 with every test green is a coverage-threshold artefact, not a failure.

## Rules that decide verdicts (do not re-file what these settle)

- **Terminology dictionary:** `docs/reference/ffxiv-terminology.md` (+ `docs/reference/glossary.md`).
  Game nouns come from core locale data (`packages/core/src/data/locales/*.json`) — a dye, category,
  race, clan, harmony, wheel, vision, currency or Facewear name must equal core's value, never a
  hand translation. *Market and Server Terms*: Market Board = fr `tableau des ventes` / ko `장터` / zh
  `市场布告板`; World = ko `서버` / zh `服务器`; Data Center = ko `데이터 센터` / zh `大区`. *Glamour
  Terms*: one glamour (outfit) = ja `ミラプリ` / de `die Projektion` (f.) / fr `le mirage` (m.) / ko
  `코디` / zh `幻化`. **False friends — never:** ja `グラマー`, ko `글래머`; not the client's word: de
  Mirage/Glamour, fr glamour, zh 时装, ko 시장 게시판/마켓보드/월드, zh 市场板/市场版. Equipment-slot
  names are in the dictionary's *Equipment Slots* section — check them against it.
- **A terminology call needs a cited source.** If the dictionary has no row for a game noun you
  think is wrong, report it as `unpinned` with what each locale says — do not assert the "right" word
  from fluency (fluent guesses `幻化棱晶`, `투영 서랍장` were wrong last time).
- **House register:** German `du` everywhere (web, bot, policies); French `vous`. German dye =
  `Farbstoff` (never `Farbe` = color); RYB Paint = `Malfarbe`. Chinese `颜料` (RYB) / `真实颜料`
  (Spectral). Korean Hue = `색상` (not `색조`). ja `染料` vs `カララント` is a per-surface house style —
  do not file. CJK uses full-width punctuation.
- **Tool names are official in English:** Swatch Matcher, Harmony Explorer (keys still
  `tools.character.*`); the gear panel is "Advanced Settings". The tenth tool is the **Glamour**
  tool — its name in each locale must agree across web-app title, nav, result-card menu, og-worker
  `OG_DECK`, bot `/manual`, and the policies.
- **`en` is American English** (`.agents/skills/audit-shared/american-english.md`): color,
  behavior, favorites… but **Grey** (game color/dye names) and **Glamour** (game system) keep the
  game's spelling. Identifiers (`card.colours` as a KEY, `favourites` KV prefix) are not defects.
- **Deliberately English (do not file):** `/stats` admin dashboards, raw presets-api
  `response.error`, changelog/announcement bodies, preset name/blurb, codes/tags (`R·C`, `ID`,
  `STANDARD·WIDE·COFFER`, `RGB DIST`, `DISTINGUISH %`, mixer "Spectral", `216 G`, A/B/C, ALGO_TAG,
  LENS_SHORT, tier names), ko/zh CIEDE2000 learn-link = no link, moderator-facing paths pinned to
  `createTranslator('en')` (English-only moderation decision), `/harmony wheel` picker choices, the
  glamour list export's slot labels (fixed GPOSERS format, documented in
  `apps/web-app/src/shared/glamour-markdown.ts`; item and dye names inside it ARE localized).
- **Bots:** `Translator.t()` never returns falsy (returns the raw key) → `|| 'x'` after it is dead,
  and a missing key shows the raw dotted key. Plurals go through `.tc()` with `_one`/`_other` and
  per-locale rules (fr treats 0 as singular). Discord limits: option/command description 100 chars,
  choice name 100, embed field value 1024, description 4096, total 6000, autocomplete 25 choices.
- **web-app:** `LanguageService.t()` logs and returns the key; `no-hardcoded-ui-strings` is `warn`
  and does not scan `innerHTML = \`…\`` sites; there are 11 key-lookup patterns incl. dynamic
  prefixes (catalog: `docs/audits/2026-08-16-web-app-dead-code/evidence/agent-report-i18n.md` §A).
- **og-worker:** `og-strings.ts` = card text (font-subset-parsed, every `  xx: {` block);
  `og-embed.ts` = crawler text (not subset); tool names from `OG_DECK`, never core `tools.*`; share
  URLs carry `?lang=`. `font-coverage.test.ts stringsFor()` must list every card-drawn table.
- **Policy documents** (`.agents/skills/audit-shared/policy-documents.md`): English unsuffixed
  file governs; siblings `<STEM>.<lc>.md`; every variant needs the localized English-prevails notice;
  one commit changes all six; same `Last updated` date; retention numbers, commands, hosts, storage
  names, third-party names verbatim; ja/ko/zh one paragraph per line. Known traps: **the operator is
  one person** (ja 運営者 not 当社; ko 저희/자체 not 자사/당사; zh 我们 not 本公司; de wir not *unser
  Unternehmen*; fr nous not *notre société*); a modifier on the wrong verb flips a clause (read
  every governing-law, liability, survival, deletion and retention clause twice); ja 利用 = plain
  "use"; de `Sammlung` for both batch and collections; ko 서버 / zh 服务器 for both a Discord server
  and an FFXIV World; quoted UI labels must equal the CURRENT `<lc>.json` value; the English itself
  can be the stale or ambiguous one.

## Already right at the last audit (do not re-file unless it regressed)

Colour-wheel vocabulary end to end; `/manual` 5.0 harmony/wheel/category names equal core;
bot locale threading (KV preference → Discord locale → en, re-resolved per interaction); web-app
`shared/format.ts` formatters default to the app locale; `<html lang>` + `document.title` follow
locale; Extractor share links keep `?lang=`; `dyenames.csv` clean; api-worker `?locale=` middleware
uniform (`INVALID_LOCALE` 400, `?locale=JA`/`zh-CN` → 400 is intended); presets-api errors carry an
`ErrorCode` and clients localize from it (English `error` text is not user-visible); de
`about.poweredBy` anglicism; zh `manual5.topics.spectrumPrices.name`; zh `——` vs ` — ` split
(cosmetic, not filed); KR subset "missing" CJK punctuation is carried by the SC face (union tofu 0).

## Tiers

| Prefix | Use for | Tier |
|---|---|---|
| `I18N` | wrong / untranslated / half-English text, raw key shown, placeholder or plural fault, missing key, a policy variant whose meaning differs from English | P0 duplicate keys · **P1** wrong or raw text a user sees, or a policy variant that promises something different · P2 missing key (falls back to en), untranslated secondary text · P3 cosmetic |
| `TERM` | dictionary violation; two names for one concept; British spelling in `en` (one per set) | P2 (P3 if cosmetic) |
| `HC` | hardcoded user-visible English in code | P1 visible text · P3 tooltip/aria |
| `FONT` | missing glyph (tofu), stale subset, stack gap | P1 tofu · P3 stale |

## Return (your final message — ≤ 40 lines, nothing else)

```
| cand | prefix | tier | file:line | locale(s) | origin | one-line claim | evidence pointer |
POSITIVE: <bullets — what you checked that is right>
REJECTED: <bullets — suspicions you dropped, one-line reason each>
COVERED: <what you read: files / key count / documents>
```
`file:line` must be a real line in the HEAD tree (for a locale key: the line of the key in that
locale's JSON). One row per defect class per file — list every affected key in the evidence
pointer (your review file), not one row per key. Quote the exact offending text in the claim.
