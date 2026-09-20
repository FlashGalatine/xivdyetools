# 2026-09-19 — whole-monorepo i18n audit

Six locales (`en ja de fr ko zh`) across every deploy unit, on `origin/main` `e86c7404`, focused on
the surface added since [2026-09-03-i18n](../2026-09-03-i18n/README.md). **15 findings — 2 P1,
6 P2, 7 P3.** All three locale sets are again structurally perfect (238 / 513 / 1135 keys × 6, zero
duplicate, missing, extra or placeholder faults), every gate's tests pass, fonts are static, tight
and tofu-free. What is left is what structural gates cannot see: the same noun translated three
ways, Discord picker metadata that was never finished, an English plural rule applied to French,
an accent-blind search, and one typo. No source or locale file was modified by the audit itself;
**all 15 findings were then fixed on the same branch on 2026-09-20**, one commit per sprint — see
*Remediation status* in the report, which also lists what remediation found that the audit had not
and seven open items that need a maintainer decision.

| File | Purpose |
|---|---|
| [I18N_AUDIT_2026-09-19.md](I18N_AUDIT_2026-09-19.md) | The catalog: locale + font status, all 15 findings, positive controls, rejected suspicions, recommendations |
| [REMEDIATION_PLAN.md](REMEDIATION_PLAN.md) | Sprint-sequenced plan (remediation-planner) |
| [OPEN_ITEMS_SOLUTIONS.md](OPEN_ITEMS_SOLUTIONS.md) | 2026-09-20: the best solution for each item the report left open, measured and reviewed — **applied the same day**; the commit table and what differed from the proposal are at its top |
| `findings/` | One file per finding — `I18N-001…010`, `HC-001`, `TERM-001…004` |
| `evidence/official-terms-research-glamour.md` | The second round of web research (2026-09-20): "glamour" as a system, as four item compounds, and as one outfit, in five languages — with the false friends and the refuted guesses |
| `evidence/naming-glamour-brief.md` | The brief the five per-language agents worked from for the naming + glamour pass |
| `evidence/official-terms-research.md` | Web research requested mid-audit: the official Market Board / World / Data Center term in ja de fr ko zh, with sources and confidence |
| `evidence/remediation-brief.md`, `policy-translation-brief.md`, `policy-verification-brief.md` | The briefs the 13 remediation agents, 5 translators and 2 `opus` verifiers worked from |
| `evidence/same-en-groups-after.txt`, `market-board-term-after.txt` | The consistency sweeps re-run after remediation (35 → 11 groups; one Market Board term per locale) |
| `evidence/open-items-review-brief.md`, `review-open-items.md` | The brief and the hand-back of the `opus` reviewer who checked the open-item proposals in five languages |
| `evidence/open-items-apply-review-brief.md`, `review-open-items-apply.md` | The second `opus` review: every string written while applying them (53 of 54 German strings and all twelve legal sentences correct; 8 corrections) |
| `evidence/scripts/edits-0*.json`, `apply-locale-edits.py`, `apply-terms-clarification.py`, `unwrap-cjk-policy.py`, `add-older-releases-key.py` | Every string edit of that pass as data + the exact-match, idempotent appliers — re-running any of them on the final tree changes nothing |
| `evidence/guardrail-measure.txt`, `whats-new-chunk-composition.txt` | What the two unbuilt guardrails would flag today; what the What's New chunk is made of |
| `evidence/reviewer-brief.md` | The shared brief the six per-unit reviewers worked from (checklist, do-not-re-file list, return schema) |
| `evidence/review-*.md` | The six reviewer returns (web-app, discord-worker, bot-logic, og-worker, core-svg, api-workers) |
| `evidence/_gate-summary.txt` + `*.txt` / `eslint.json` | Raw gate, parity, font and sweep output |
| `evidence/scripts/` | Every script used — `run-gates.sh` (reusable runner) and three new sweeps: `tool-name-consistency.py`, `market-board-term.py`, `en-needle-values.py` |

## Top items

1. **TERM-001 (P2)** — web-app + bot-logic: "Market Board" is `Tableau des ventes` *and* `Tableau des marchés`, `시장 게시판` *and* `마켓보드`, `市场板` *and* `市场版` *and* `市场布告板` — config sidebar vs panel. Official: `tableau des ventes`, `장터`, `市场布告板`; `市场版` exists in no source. The dictionary has no row for it.
2. **I18N-001 (P1)** — discord-worker: 134 of 151 slash-command descriptions (every subcommand and option tooltip) are English in all locales — the never-executed phase 2 of 2026-08-20's F-03; the test pins the gap at 17.
3. **I18N-005 (P1)** — core + bot-logic: dye search by localized name folds ASCII case only, so `schneeweiss` and `creme` find nothing; a third of de/fr dye names carry ß or an accent. Hits the public API and every Discord dye option.
4. **I18N-003 (P2)** — bot-logic: `tc()` picks plural forms with `count === 1` for every locale; French treats 0 as singular, and `vote_count === 0` is the state of every new preset card.
5. **TERM-002 (P2)** — web-app: the result card's "send to tool" menu names five tools differently from the tools' own titles in de/fr/ja/ko (`Farbstoff-Mischer` → page titled `Farbstoffmixer`).
6. **I18N-002 / HC-001 / I18N-004 (P2)** — `/manual topic` choices English in the picker; `/about` has an English sentence under a translated heading; Korean ΔE explainer says `안팡` for `안팎`.

## Decisions made during the audit (2026-09-19)

- **TERM-003** — adopt the KR/CN client terms: ko `서버` / `데이터 센터`, zh `服务器` / `大区`.
- **I18N-010** — translate all four policy documents (2 Privacy, 2 ToS) into ja de fr ko zh as `<STEM>.<locale>.md`; English stays governing. The audit skills now check them in every language (`audit-shared/policy-documents.md`, `scripts/policy-locale-parity.py`).

## Decisions made after remediation (2026-09-20)

- **"Swatch Matcher" and "Harmony Explorer" are the official tool names** — `en.json` said "Character Matcher" and "Color Harmony Explorer". Applied to the six locales, the docs, the policy translations and og-worker's card table (2.10.3).
- **The header-gear panel is "Advanced Settings"** — `PRIVACY.md` said "Advanced Options"; corrected, date moved on all six variants.
- **"glamour" is in the terminology dictionary**, researched on the publishers' sites and applied everywhere: ja `ミラプリ`, de `Projektion` (f.), fr `mirage` (m.), ko `코디`, zh `幻化`. Japanese `グラマー` and Korean `글래머` were false friends. See `evidence/official-terms-research-glamour.md` and the report's *Follow-up* section.

## Caveats worth carrying forward

- **Terminology needs a cited source, and the raw page beats a summary of it.** The coordinator guessed `장터 게시판` for the Korean Market Board; the researcher reported it refuted in favour of `장터`; the maintainer's raw capture of the official guide then showed both are official — `장터` is the feature (what the apps mean, and what shipped), `장터 게시판` the board object's in-game map label.
- The maintainer supplied raw full-page captures on 2026-09-20 for the fetches the researchers could not make cleanly: they confirm ko `장터` and `서버` and zh `市场布告板` verbatim (quotes in `evidence/official-terms-research.md`). The three they did not cover — ko `데이터 센터` (guide no. 1025), zh `服务器` and `大区` — were verified the same day by loading the official pages in a real browser and reading the raw DOM text, so all eighteen values now rest on the publisher's own page.
- Two gate runs exit 1 with every test green: `coverage.enabled: true` in web-app's and discord-worker's vitest configs trips thresholds on subset runs. Not a failure.
