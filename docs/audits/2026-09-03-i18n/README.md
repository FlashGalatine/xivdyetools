# 2026-09-03 — whole-monorepo i18n audit

Six locales (`en ja de fr ko zh`) across every deploy unit, on `origin/main` `cf79ac9f` (base `7bf5444e`).
**17 findings — 2 P1, 6 P2, 9 P3 — and not one of them is a locale-file data defect:** all three
locale sets are structurally perfect (222 / 507 / 1143 keys × 6, zero duplicate, missing, extra or
placeholder faults) and every repo gate is green. The defects are in code, in generator inputs, in
fonts, and in three surfaces disagreeing about the same word. No source or locale file was modified
by this audit.

| File | Purpose |
|---|---|
| [I18N_AUDIT_2026-09-03.md](I18N_AUDIT_2026-09-03.md) | The catalog: locale + font status tables, all 17 findings, positive controls, rejected suspicions, recommendations |
| [REMEDIATION_PLAN.md](REMEDIATION_PLAN.md) | Sprint-sequenced plan: 9 sprints, one deploy unit each, plus two Sprint-0 decisions |
| `findings/` | One file per finding — `I18N-001…012`, `TERM-001…003`, `FONT-001…003` |
| `evidence/base-correction.md` | **Read this first** — the audit started on a stale base; what changed and what it cost |
| `evidence/coordinator-verification.md` | The coordinator's own verification pass: gates, parity, fonts, vocabulary drift, terminology |
| `evidence/review-*.md` | The six per-unit reviewer returns (web-app, discord-worker, bot-logic+moderation+stoat, og-worker, core+svg, api-workers) |
| `evidence/scripts/` | Every script written for this audit, reusable next time |
| `evidence/*.txt` | Raw gate, parity, font and sweep output |

## Top items

1. **FONT-001 (P1)** — discord-worker + og-worker: all six bundled CJK subsets are still *variable* fonts whose default instance is Thin 100, so every `font-weight="600"/"700"` on a card is a no-op for CJK — Japanese, Korean and Chinese text renders thin beside correctly-weighted Latin. The 2026-08-29 fix (PR #148) covered only the Latin faces; the gate misses these because it matches filenames against `/VariableFont/i` and the files are named `-Subset.ttf`.
2. **I18N-007 (P1)** — core: the German name for Pearl White ships as `Perlmutt-`, a truncated compound with a dangling hyphen, visible in the web app, both bots, OG cards and the public API. One cell in `dyenames.csv:114`.
3. **FONT-002 (P1)** — svg: `/preset` cards draw `${voteCount}★`, and U+2605 is in none of the 10 bundled faces in either worker — tofu on every preset card with a vote count. The gate's glyph list is a hand-maintained literal that never got `★`.
4. **TERM-001 (P2)** — bot-logic: the Discord bot names harmonies and vision types from its own table while web-app and og-worker both use core's, so "Split-Complementary" is `分裂補色` in the app and `スプリット補色` in the bot. PR #159 converged the harmony *algorithm* across these three surfaces yesterday; the names are what is left.
5. **I18N-005 (P2)** — web-app: presets-api's specific error codes are flattened to a generic `submitFailed`, so a banned user gets a localized headline that says the wrong thing ("submit failed") over an English explanation of the real reason.
6. **I18N-009 (P3, needs a decision)** — moderation-worker maps all six locales to the English table while maintaining a full locale ladder and an unused `preset.status.*` key set. Staff-facing, so English is defensible — but the apparatus should either become real or be deleted.

## Caveat worth carrying forward

The audit was started from a local `main` that was two days behind `origin/main` and had to be
rebased mid-run; one finding (I18N-001) was withdrawn because the fix had already shipped, and
I18N-004's scope shrank by half for the same reason. Pin the base commit and diff it against
`origin/main` **before** running anything next time.
