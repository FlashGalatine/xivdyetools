# 2026-10-04 — whole-monorepo i18n audit, on a preview of the batch merge

**45 findings:** 2 P1, 17 P2, 26 P3, no P0.
- **By prefix:** 20 I18N, 21 TERM, 3 HC, 1 FONT.
- **From open PRs:** 7 touch text in #223, #227 and #230, all P2 or P3 policy text.
  - 6 are Sprint 0 decisions, which can be fixed inside the PRs before merging.
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
| [findings/](findings/) | 45 finding records |
| [evidence/reverify-2026-10-05.md](evidence/reverify-2026-10-05.md) | **Read before any sprint:** all three catalogs re-checked against `main@50165ec6` after the batch merge. Covers fixed items, moved anchors, amended fix steps, the baseline gate and the branch and version order. Inputs and raw verdicts are in `evidence/reverify-2026-10-05/`. |
| `evidence/reviewer-brief.md` | The rules and return format every reviewer worked from |
| `evidence/delta/` | Every key added / changed / removed since `5c80fcba`, with origin and all six values; per-document diffs split main / PR |
| `evidence/review-*.md` | The 17 reviewer files (15 slices + 2 gap sweeps) |
| `evidence/verdicts.tsv`, `workflow-result.json` | All 94 verdicts, with skeptic results; the workflow's full return |
| `evidence/catalog.json`, `id-map.json` | The consolidated catalog; which workflow candidates each finding came from |
| `evidence/_gate-summary.txt` + `*.txt` / `eslint.json` | Raw gate, parity, font and sweep output |
| `evidence/scripts/` | `run-gates.sh` (reusable runner), `delta.py`, `tally.py`, `write_findings.py`, `write_report.py`, `write_plan.py`, and the 2026-09-19 sweeps reused |

## Top items

1. **HC-001 (P1)** — packages/bot-logic: `tribeDisplay()` prints the clan in English on every `/glamour` and `/swatch` card.
2. **HC-002 (P1)** — apps/discord-worker: The bot fills its translated file-error message with English reasons.
3. **I18N-001 (P2)** — apps/web-app + apps/discord-worker: Both English privacy documents anchor "posts no longer show your Discord user ID" to the moving *Last updated* date.
4. **TERM-001 (P2)** — apps/web-app + apps/discord-worker: Korean policy documents call the moderator two things: 운영자 and 조정자.
5. **I18N-002 (P2)** — apps/web-app: The five web Terms of Service translations say "ten tools" and list nine: the Glamour Reader is missing.
6. **I18N-003 (P2)** — apps/web-app: Korean ΔE explainer and budget note contain a non-word (낙은) and a broken verb form (뺌 값을).

## Caveats worth carrying forward

- **The English can be the defect.**
  - I18N-004: the translators rendered the English's natural reading.
  - TERM-002: the Japanese was right and the English wrong.
  - Check the English before filing a translation.
- **Core's character-sheet names are not a source.** They are typed in `build-locales.ts`. Treat them like any unpinned term until the dictionary has a table.
- **Gate counts:**
  - a subset vitest run needs `--coverage.enabled=false`, or a green run exits 1;
  - `font-union-analysis.py` over-counts discord-worker "tofu" with option descriptions (see *Rejected*).
