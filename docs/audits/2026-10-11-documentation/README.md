# Documentation audit — whole repo (2026-10-11)

Full audit of the `docs/` living tier (93 documents, all read in full), the frozen-body tiers, the bot's `/manual`,
and the four policy documents in all six languages, against what production serves (`16a6123f`, equal to HEAD for
all code) and what npm publishes (at parity). **79 findings: 0 HIGH, 30 MEDIUM, 49 LOW.** Twenty carry forward
findings from the 2026-09-21 audit and two of its findings are fixed. **No source file and no existing document was
modified by this audit**; every finding is OPEN and carries its own fix direction.

| File | Purpose |
|---|---|
| `DOCUMENTATION_AUDIT_REPORT.md` | The catalog: baseline, coverage, gates, findings, prior-audit status, positive controls, rejected suspicions, hand-offs, gaps, prioritized corrections |
| `findings/DOC-0NN.md` | One file per confirmed finding (79) |
| `evidence/baseline.md`, `evidence/baseline-live.txt` | What is served, per unit, with evidence and limits; read-only live probes (maintainer email redacted) |
| `evidence/docs-gates.txt`, `manual-check-*.txt`, `policy-locale-parity.txt` | Gate output |
| `evidence/american-spelling*.txt`, `spelling-by-file.txt`, `spelling-confirmed.md` | The spelling sweep (default and `--all`), and the confirmed per-document counts, rejections and dictionary misses |
| `evidence/review-*.md` | The 26 reviewer returns (13 clusters, frozen tier, `/manual`, 6 policy reviews, 2 by-time sweeps, cross-document facts, 2 mechanical sweeps) |
| `evidence/workflow-result.json`, `verdicts.md`, `priors.md`, `coverage.md` | Every candidate with its verifier verdict and skeptic vote; prior-finding rechecks; per-file coverage |
| `evidence/findings-draft.json`, `verify-merged-result.json`, `coordinator-overrides.json`, `findings-spelling.json`, `catalog.json` | The merged findings, their re-verification at exact `file:line`, and the coordinator's title corrections |
| `evidence/handoffs.md` | Confirmed items owned by security-audit (2), i18n-manager (18) and the web-app owner (5) |
| `evidence/inventory-*.txt`, `living-files.txt`, `frozen-files.txt`, `clusters.json`, `clusters/` | What was inventoried and how it was split |
| `evidence/scripts/` | `clusters.mjs`, `split-spelling.mjs`, `summarize.mjs`, `dump.mjs`, `write-findings.mjs` — reusable by the next run |

## Top items

1. **DOC-001 (MEDIUM)** — web-app, discord-worker: all 24 policy files send deletion, appeal and contact requests to a Discord invite that has expired.
2. **DOC-004 / DOC-005 (MEDIUM)** — web-app, discord-worker: both FAQs tell users to request data deletion in public GitHub issues, which the policies forbid, and misdescribe what is stored.
3. **DOC-002 (MEDIUM)** — repo-wide: the deployment guide says `db:migrate` applies D1 migrations; it re-runs `schema.sql`, so no numbered migration would ever be applied.
4. **DOC-003 (MEDIUM)** — web-app: the FAQ's export/import steps go through a Manage Collections button the app no longer renders (confirmed live; the orphaned UI is handed to the web-app owner).
5. **DOC-018 / DOC-019 (MEDIUM)** — repo-wide: two statements of which deploy is safe are wrong for og-worker (bare deploy is live beta) and oauth (bare deploy is production).
6. **DOC-074…079 (LOW)** — 473 British spellings across 62 documents, up from 417; filed per cluster.

**Totals:** 79 findings — 0 HIGH, 30 MEDIUM, 49 LOW. Nothing needs out-of-band action; DOC-001 should be the first correction merged.
