"""Write I18N_AUDIT_2026-10-04.md and README.md from evidence/catalog.json. Run from the repo root."""
import collections
import json
import pathlib

OUT = pathlib.Path('docs/audits/2026-10-04-i18n')
cat = json.loads((OUT / 'evidence/catalog.json').read_text(encoding='utf-8'))
by = collections.defaultdict(list)
for c in cat:
    by[c['prefix']].append(c)
tiers = collections.Counter(c['tier'] for c in cat)
prefixes = collections.Counter(c['prefix'] for c in cat)
pr = [c for c in cat if 'PR#' in c['origin']]
s0 = [c['id'] for c in cat if c['sprint0']]
N = len(cat)


def esc(s):
    return s.replace('|', '\\|')


def table(rows):
    out = ['| ID | Title | Tier | Locale(s) | Deploy unit | Origin |', '|---|---|---|---|---|---|']
    for c in rows:
        out.append(f"| [{c['id']}](findings/{c['id']}.md) | {esc(c['title'])} | {c['tier']} | {c['loc_']} | {c['unit']} | {c['origin']} |")
    return '\n'.join(out)


SECTIONS = {'HC': 'Hardcoded strings (`HC-`)', 'I18N': 'Translations and structure (`I18N-`)', 'TERM': 'Terminology (`TERM-`)', 'FONT': 'Fonts (`FONT-`)'}

report = f"""# i18n audit — whole monorepo, preview of the 2026-10-04 batch merge (2026-10-04)

- **Branch/commit:** the local, never-pushed preview branch `preview/integration-2026-10-04@80262a2f`, the same tree the 2026-10-04 dead-code and deep-dive audits read. It is `main@8ecb878f` with the 13 PRs open on 2026-10-04 merged in (#223–#235), plus the dead-code audit's two Sprint 0 fixes. Every open PR's head was confirmed inside it before the run (`git merge-base --is-ancestor`).
- **Scope:** six locales (`en ja de fr ko zh`) across every deploy unit: the three locale JSON sets, og-worker's two string tables, the moderation bot's table, Discord command metadata, both resvg font bundles, the 24 policy documents and the API workers' user-visible text.
  - **Focus:** everything that changed since the last i18n audit's remediation merge (`5c80fcba`, PR #192). That is mostly the tenth tool, the Glamour Reader, in web-app, the bot and og-worker (189 keys added or changed), plus the policy documents.
  - Three open PRs rewrite policy translations in all five languages: #223, #230 and #227.
- **Method:**
  1. The repo's i18n gates first (`evidence/scripts/run-gates.sh`, the 2026-09-19 runner extended with the newer gates and sweeps).
  2. A string delta tagged by origin (`evidence/scripts/delta.py`).
  3. 15 reviewers: one for UI strings and one for policy translations in each of ja, de, fr, ko and zh, one for the English source, and four code slices (web-app; the bots; og-worker + svg + fonts; core + the API workers + moderation + stoat).
  4. A verifier on every candidate, re-deriving its origin with git.
  5. An independent skeptic on every P0/P1.
  6. A completeness critic and a two-slice gap sweep: 94 verdicts in all.
  7. The coordinator re-checked both P1s, every open-PR finding and every point where two verdicts disagreed before consolidating. **No source, locale or policy file was modified.**
- **Totals:** **{N} findings:**
  - by tier: {tiers['P1']} P1, {tiers['P2']} P2, {tiers['P3']} P3, no P0;
  - by prefix: {prefixes['I18N']} I18N, {prefixes['TERM']} TERM, {prefixes['HC']} HC, {prefixes['FONT']} FONT;
  - by origin: {len(pr)} touch text in open PRs, all of it P2 or P3 policy text. That is the {len(s0)} Sprint 0 rows, plus TERM-001, which has one line in #223 next to text already on `main`. The rest are already on `main`.
- **Sprint 0 (decide before the merge):** {', '.join(s0)}. These are policy-text fixes that can be made inside #223, #227 and #230. **No i18n finding blocks the batch merge.**

## Decide before tomorrow's merge

**Six policy-text items are Sprint 0 decisions.** All six come from the open PRs. They can be fixed inside the PRs, or in the plan's policy sprint after the merge. Nothing has been pushed. (TERM-001 also has one line in #223, but most of it is already on `main`, so it is scheduled in the policy sprint.)

- **I18N-001 (P2, #230 + #227):** both English privacy documents say posts made since the *Last updated* date (2026-10-04) do not show the poster's Discord user ID. The code that drops the ID goes live at merge, so posts made before then still show it, and the next date bump moves the cutoff. The correct fixed date only exists at merge time.
- **I18N-004 (P3, #227):** the bot policy's retention row for hide / restore log entries reads as "kept until the preset is deleted"; the code deletes them at 12 months or sooner. All five translations carry the same wording.
- **I18N-005 (P3, #230):** the web guide gives a hide / restore log entry two retention rules.
- **I18N-006, TERM-014, TERM-015 (P3, #223 / #227 / #230):** one Korean or Chinese phrase each.
- **How heavy they are:**
  - I18N-001, I18N-004 and I18N-005 are English edits, so each needs its five translations in the same commit, as the policy rules require.
  - The other three are one phrase in one language.

**One decision needs a source: the character-creation sheet names.** TERM-003, TERM-004 and TERM-021 are blocked on it.
- web-app and the bot name highlights, tattoo, face paint and the limbal ring two or three ways within one file.
- Core's names (`build-locales.ts` `buildSheets`) are typed by hand with no source, and its limbal is "cornea" / "iris" in ja, ko and zh.
- A dictionary table taken from the client's own text has to come first.
- **Answered 2026-10-05 (#239).** The client's labels are in the dictionary, so these three findings are unblocked.
  - The same research found 19 Korean and Chinese race and clan names in core that weren't the clients'.
  - Those are fixed in #240 (core 5.8.1), which merges before Sprint 2, because HC-001 prints core's clan names. See the plan.

## Locale status

| Set | Keys × 6 | dup | missing | extra | placeholder | identical to en (de / fr / ja / ko / zh) | Gate |
|---|---|---|---|---|---|---|---|
| `packages/core/src/data/locales` (generated) | 238 | 0 | 0 | 0 | 0 | 11 / 8 / 0 / 0 / 0, proper nouns | ✅ 9 files / 258 tests; **no drift** from `build:locales` |
| `packages/bot-logic/src/i18n/locales` | 706 | 0 | 0 | 0 | 0 | 38 / 39 / 29 / 29 / 28, all allow-listed with reasons | ✅ 8 files / 164 tests, incl. `locale-quality` (same English → same translation) |
| `apps/web-app/src/locales` | 1197 | 0 | 0 | 0 | 0 | 34 / 34 / 10 / 13 / 10, all allow-listed | ✅ `validate:i18n` clean (63 same-English groups, 16 diverge, all allow-listed) · `i18n:unused` 0 orphans · 10 files / 139 tests · eslint `xivdyetools-i18n/*` 0 warnings |
| `apps/og-worker` tables | — | 0 | 0 | 0 | 0 | — | ✅ 6 files / 147 tests, incl. `harmony.deck-fit` |
| discord-worker / moderation-worker / svg glamour card | — | — | — | — | — | — | ✅ 8 / 99, 2 / 81 and 1 / 14 tests |
| Policy documents (4 × 6) | — | — | — | — | — | — | ✅ `policy-locale-parity.py`: 0 problem groups |

**For the third audit running, no locale set has a structural defect.** Every finding below is something a structural gate cannot see:
- a meaning;
- a word choice;
- a string assembled in code;
- a list that lost an item;
- a claim whose English is the stale one.

`american-spelling.mjs` over the five `en` tables found **0** candidates. The sweep's other 425 candidates are in the `docs/` living tier and the two English web-app policies. Those belong to a documentation audit and are not filed here (*Out of scope*).

## Font status

| Worker | Needed cps | Union cmap | Real tofu | Surplus (JP / KR / SC) | Static | Subsets vs the last drawn-string change |
|---|---|---|---|---|---|---|
| discord-worker | 1787 by the sweep (more than the gate's set: see *Rejected*) | 2486 | 0 | 0 / 0 / 0 | ✅ | re-cut 2026-09-28 08:40, with the last drawn bot-logic change. The 2026-10-04 change only deleted three undrawn keys |
| og-worker | 999 | 1790 | 0 | 0 / 0 / 0 | ✅ | re-cut in the same commit as the last `og-strings.ts` change (2026-09-28) |

**Sizes:** discord SC 491 KiB, JP 328, KR 141; og SC 336, JP 221, KR 112.
- All are under the over-inclusion thresholds (SC / JP 500 KiB, KR 300 KiB).
- discord SC has 9 KiB to spare, so FONT-001's option A (about +1,171 hanzi) would cross it. Measure before choosing.

**FONT-001 is not tofu:** `/glamour` deliberately draws the English item name whenever the localized one has a glyph outside the subset.

## Catalog

"""
for p in ('HC', 'I18N', 'TERM', 'FONT'):
    report += f"### {SECTIONS[p]}\n\n{table(by[p])}\n\n"

report += """## Positive controls — already right, do not re-file

- **The Glamour Reader is named the same everywhere, in every locale:**
  - it is ミラプリリーダー / Projektionsleser / Lecteur de mirages / 코디 리더 / 幻化查看器;
  - the name agrees across the web title and nav, og-worker `OG_DECK` and `TOOL_TAG`, the bot card and command, and the policies;
  - no グラマー or 글래머, and no German "Mirage" or French "glamour".
- **Slot names:** all 12 gear slots plus Facewear equal the dictionary's *Equipment Slots* table in web-app (`swatch.gearSlot.*`) and the bot (`card.glamourSlot.*`), in all five languages.
- **Delta mechanics:**
  - placeholders are identical to en on all 189 delta keys;
  - every new `_one` / `_other` pair is present and grammatical;
  - ja and zh punctuation is full-width;
  - the longest Discord descriptions fit (fr 95 / 100, de 92);
  - every en-only change since the last audit was a British → American spelling fix, so no translation went stale.
- **web-app code:**
  - every literal and dynamic key family the Glamour Reader builds exists in all six files (12 slots, 8 fact keys, sheet states, row variants);
  - the `innerHTML` sites in the new components route text through `t()`;
  - lists and verdict segments use `Intl.ListFormat` / `Intl.PluralRules` with the app locale;
  - the tool rebuilds on a language switch;
  - `policyDocFile()` links each locale's own policy variant.
- **Bot:**
  - locale threading for `/glamour` (KV preference → interaction locale → en) holds through the deferred step;
  - every other count goes through `tc()`;
  - the embed budget (4000) and the error cap (1024) are enforced;
  - `/manual` limits are asserted across all locales.
- **Policy translations:**
  - retention numbers, hosts, commands and third-party names are verbatim in all 20 variants;
  - every quoted UI label equals the current `<lc>.json`;
  - the operator is 運営者 / wir / nous / 저희 / 我们, apart from TERM-020;
  - no right, deletion path or opt-out was softened or dropped in the #223 / #230 / #227 hunks;
  - notices and dates match.
- **Fonts:** no tofu, no surplus, all faces static; both font gates' `stringsFor()` cover the new glamour tables.
- **API workers:**
  - acquisition lines and GPOSERS slot labels are English by recorded decision (`acquisition.ts:1-10`, spec D2, `chara-gposers.ts:15-17`);
  - api-worker's `?locale=` handling is unchanged;
  - new presets-api / oauth rejections carry an `ErrorCode` the clients localize;
  - the moderation bot is English-only by decision (`bot-i18n.ts:113-117`), with 32 keys used and 0 missing.
- **The Japanese Glamour list privacy note** ("この装備ごとに", per piece of gear) is the accurate one. TERM-002 fixes the English to match it.

## Rejected suspicions — checked and dropped

- **ja retention row as a ja defect (P1 → refuted):** a skeptic showed the Japanese renders the English's most natural reading. The defect is the English (I18N-004).
- **Korean "마켓 서버 / 마켓 가격 표시" as a Market Board violation:**
  - `마켓 서버` is the shipped label `policy-documents.md` tells translators to quote (it separates a World from a Discord server);
  - "market prices" is not the Market Board noun the dictionary pins.
- **"NO GLAM" / "KEINE PROJ" status chips:**
  - the dictionary's "no short forms" rule (`ffxiv-terminology.md:320`) covers slot names;
  - en abbreviates the chip itself.
- **Korean Dated tag 구형:** the Korean client itself prefixes 220 item names with 구형 (402 with 낡은, #372 with 구식), so it is not filed. Chinese is filed (TERM-008): 1,408 × 过期, 0 × 旧版.
- **The glamour card look-count line at 10.5 px:** already deep-dive BUG-145.
- **Glamour card status column ignores letter-spacing:** the ink spills about 5 px into the 10 px gap, and nothing is cut or overlaps.
- **Percent-encoded non-ASCII in example-link text (#223):** intended. It is the FINDING-016 anti-spoofing behavior (`example-link.ts:54-57`).
- **The sweep's 58 "real tofu" codepoints for discord-worker:**
  - `font-union-analysis.py` counts `commands.*.options.*.description`, which Discord renders in its own UI;
  - the gate and the subset script exclude them on purpose.
  - Same for the KR / JP "missing" CJK punctuation, which the SC face carries.
- **German `card.glamourFootShown_one` "von {n} gefärbten Teil":** correct; a digit reads as the inflected numeral.
- **Style alternatives rejected by the verifiers:**
  - ja 装備 / 着用, 点 / 部位, キャラ chips;
  - ja 同型 / 唯一 / 代替 card tags;
  - zh 同款 / 替代 and the paraphrased picker footers;
  - fr "voter sur", "Appels", "DM" and the Square Enix copyright line;
  - de `preset.dyesHint`;
  - ko "이에 국한되지 않습니다";
  - the "90 days if unresolved" anchor;
  - "restores it" in the web guide.
  - In each case a native reader takes the same meaning.
- **Sheet and twin picker do not follow a language switch while open:** unreachable, because the overlay covers the header and Shift+L stands down.
- **Unused moderation `enLocale` keys** (`ban.presetsHidden`, `ban.alreadyBanned`, `ban.userBanned`, `meta.*`): a dead-code matter, not i18n.

## Out of scope (for a documentation audit)

- **British spellings in English prose:** `american-spelling.mjs` lists 425 candidates in 56 files: the `docs/` living tier (e.g. 36 in `docs/projects/web-app/tools.md`) and 8 each in `apps/web-app/PRIVACY.md` and `TERMS_OF_SERVICE.md`. `american-english.md` assigns those to documentation-audit (`DOC-`); `evidence/american-spelling.txt` is the list.
- **What this audit's own folder does:** the prose here follows the standard.

## Recommendations — guardrails

1. **Make the Terms of Service tool list checkable:**
   - write it as a bullet list, so `policy-locale-parity.py`'s per-section item count sees a missing tool (I18N-002);
   - or add a check that every variant names each `tools.*.title` from its own locale file.
2. **Add a character-creation sheet table to `ffxiv-terminology.md`** (nine sheets × six locales, cited), and a parity test that web-app, bot-logic and core's `buildSheets` all use it (TERM-003, TERM-004, TERM-021).
3. **A bot test that renders the `/glamour` and `/swatch` cards in de and ja** and fails on an ASCII-only clan line or an English reason inside `swatchParseError` (HC-001, HC-002). The reverse key gate cannot see a value built in code.
4. **web-app plurals:**
   - extend `i18n-parity-gate.test.js` so any key that interpolates a numeric `{n}`, `{dyes}` or `{channels}` needs `_one` / `_other`;
   - route those keys through one `Intl.PluralRules` helper (I18N-007).
5. **Never anchor a policy claim to the document's own *Last updated* date** (I18N-001). Add the rule to `policy-documents.md`.
6. **Record FONT-001's outcome either way:** the measured English-fallback rate, or the subset budget, in `apps/discord-worker/CLAUDE.md`.
7. **Fix the audit sweep:** `font-union-analysis.py` should exclude Discord-rendered option descriptions, as the gate does, so its "real tofu" line means tofu.

## Remediation status

| ID | Status | Commit |
|---|---|---|
"""
for c in cat:
    report += f"| {c['id']} | OPEN{' (Sprint 0 decision)' if c['sprint0'] else ''} | — |\n"
report += """
## Next steps

[REMEDIATION_PLAN.md](REMEDIATION_PLAN.md) is **one merged plan** for this catalog and the same day's deep-dive and dead-code catalogs.
- It supersedes the deep-dive's `REMEDIATION_PLAN.md`.
- The two P1s ship early, as one bot-logic + discord-worker PR with the font re-cut (Sprints 2–3).
- The web-app translations follow the web-app correctness sprints (Sprint 6); the policy documents get one docs-only sprint (Sprint 7).
- The item-name font decision (FONT-001) is last of all.

**Nothing changes until you approve the plan.**
"""
(OUT / 'I18N_AUDIT_2026-10-04.md').write_text(report, encoding='utf-8', newline='\n')

top = sorted(cat, key=lambda c: (c['tier'], 0 if 'PR#' in c['origin'] else 1))[:6]
readme = f"""# 2026-10-04 — whole-monorepo i18n audit, on a preview of the batch merge

**{N} findings:** {tiers['P1']} P1, {tiers['P2']} P2, {tiers['P3']} P3, no P0.
- **By prefix:** {prefixes['I18N']} I18N, {prefixes['TERM']} TERM, {prefixes['HC']} HC, {prefixes['FONT']} FONT.
- **From open PRs:** {len(pr)} touch text in #223, #227 and #230, all P2 or P3 policy text.
  - {len(s0)} are Sprint 0 decisions, which can be fixed inside the PRs before merging.
  - TERM-001 has one #223 line next to text already on `main`.
- **Blocking:** **no finding blocks tomorrow's batch merge.**
- **No source, locale or policy file was modified by the audit.**

**What was read:** the same local, never-pushed preview branch as the 2026-10-04 dead-code and deep-dive audits, `preview/integration-2026-10-04@80262a2f`. It is `main@8ecb878f` plus the 13 open PRs, so it is the code that will be on `main` after the merge.
- All three locale sets are structurally clean again, and every repo i18n gate passes.
- What is left is what a gate cannot see: two bot strings built in code in English, translations that lost an item or took the wrong reading of the English, and one concept with two names.

[REMEDIATION_PLAN.md](REMEDIATION_PLAN.md) is **one merged plan** for this catalog and the same day's deep-dive and dead-code catalogs (284 IDs). It supersedes the deep-dive's plan.

| File | Purpose |
|---|---|
| [I18N_AUDIT_2026-10-04.md](I18N_AUDIT_2026-10-04.md) | Decide-before-merge list, locale + font status, the catalog, positive controls, rejected suspicions, recommendations, status |
| [REMEDIATION_PLAN.md](REMEDIATION_PLAN.md) | Sprint 0, then 30 sprints for all three catalogs: the i18n ones inserted, the deep-dive's kept; superseded items; KEEP register; *Pin first* terminology register |
| [findings/](findings/) | {N} finding records |
| `evidence/reviewer-brief.md` | The rules and return format every reviewer worked from |
| `evidence/delta/` | Every key added / changed / removed since `5c80fcba`, with origin and all six values; per-document diffs split main / PR |
| `evidence/review-*.md` | The 17 reviewer files (15 slices + 2 gap sweeps) |
| `evidence/verdicts.tsv`, `workflow-result.json` | All 94 verdicts, with skeptic results; the workflow's full return |
| `evidence/catalog.json`, `id-map.json` | The consolidated catalog; which workflow candidates each finding came from |
| `evidence/_gate-summary.txt` + `*.txt` / `eslint.json` | Raw gate, parity, font and sweep output |
| `evidence/scripts/` | `run-gates.sh` (reusable runner), `delta.py`, `tally.py`, `write_findings.py`, `write_report.py`, `write_plan.py`, and the 2026-09-19 sweeps reused |

## Top items

"""
for n, c in enumerate(top, 1):
    readme += f"{n}. **{c['id']} ({c['tier']})** — {c['unit']}: {c['title']}.\n"
readme += """
## Caveats worth carrying forward

- **The English can be the defect.**
  - I18N-004: the translators rendered the English's natural reading.
  - TERM-002: the Japanese was right and the English wrong.
  - Check the English before filing a translation.
- **Core's character-sheet names are not a source.** They are typed in `build-locales.ts`. Treat them like any unpinned term until the dictionary has a table.
- **Gate counts:**
  - a subset vitest run needs `--coverage.enabled=false`, or a green run exits 1;
  - `font-union-analysis.py` over-counts discord-worker "tofu" with option descriptions (see *Rejected*).
"""
(OUT / 'README.md').write_text(readme, encoding='utf-8', newline='\n')
print('report + README written;', N, 'findings')
