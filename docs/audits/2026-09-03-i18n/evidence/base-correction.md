# Base correction (mid-audit) — read before trusting any line number in `coordinator-verification.md`

The worktree was branched from **local `main` = `32e08207` (2026-09-01)**, which is **not** an
ancestor of `origin/main`. `origin/main` was `cf79ac9f` (2026-09-03 06:46), five merges ahead:
PRs **#158, #159, #160, #161**. The audit therefore started two days behind what actually ships.

Caught while chasing a reviewer's aside that "two out-of-tree commits already fix this". Corrected
by merging `origin/main` into the audit branch → base **`7bf5444e`** = `origin/main` plus the one
local-only commit `32e08207 docs(repo): add Working-in-this-checkout block`, which the user has
not pushed and which touches only `CLAUDE.md`.

## Consequences

- **I18N-001 withdrawn** — already fixed on `origin/main` by `35914823` (BUG-021), which is
  precisely the fix that finding proposed, comment and all.
- Every gate and every script was re-run on the corrected base. All still green.
- Corrected-base gate counts: core **3 files / 23 tests**, bot-logic i18n **4 / 72**,
  web-app i18n **4 / 50**, og-worker **4 / 125**, discord-worker **4 / 69**,
  moderation-worker **2 / 84**, svg **17 / 304**. `validate:i18n` and `i18n:unused` exit 0.
- Corrected-base parity: core **222** keys ×6, bot-logic **507** ×6, web-app **1143** ×6 —
  still 0 duplicate / 0 missing / 0 extra / 0 placeholder mismatch in every set.
- Fonts re-measured: unchanged — 0 real tofu, **0 surplus glyphs** in all six CJK subsets.
  **Correction:** an early note here said the `FONT-` category produced no findings. That was
  wrong — it was true only of *coverage*. `FONT-001` (all six CJK subsets are still variable
  fonts defaulting to Thin 100) was found afterwards, by checking the `fvar` table rather than
  glyph coverage. Coverage and weight are separate properties; this audit's first font pass
  measured only the first.
- `term-check.py` on the corrected base: still exactly 3 ja mismatches (TERM-002).
- `vocab-split.py` on the corrected base: **42 paired keys, 29 divergent** (was 39 / 28).
- The five unit reviewers ran against the stale tree, so their returns are treated strictly as
  leads: every candidate is re-verified at `file:line` on `7bf5444e` before it becomes a finding.

## Lesson for the next audit

Pin and state the base commit **first**, and check it against `origin/main` before running
anything. This checkout's local `main` habitually lags — the same trap is recorded in the
project memory as "user's checkout needs `git pull --ff-only`" after several previous merges.

Note also: `docs/audits/2026-09-03-i18n/evidence/_gate-summary-STALE-BASE.txt` and
`_gate-summary2-STALE-BASE.txt` are the pre-correction runs, kept only for the record.
