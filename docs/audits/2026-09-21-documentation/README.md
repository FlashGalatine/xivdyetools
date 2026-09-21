# Documentation audit — whole repo (2026-09-21)

Full audit of the `docs/` living tier (92 documents), the frozen-body tiers, the bot's `/manual`,
and the four policy documents in all six languages. Both documentation gates, the `/manual` size and
roster check, the policy locale-parity script and the American-English sweep were run and their raw
output is under `evidence/`. **No source file and no document was modified by this audit** — every
finding is OPEN and carries its own fix direction.

| File | Purpose |
|---|---|
| `DOCUMENTATION_AUDIT_REPORT.md` | The catalog: baseline, coverage, gates, findings, positive controls, rejected suspicions, gaps |
| `findings/DOC-0NN.md` | One file per confirmed finding |
| `evidence/baseline.md` | What is currently served, per unit, with the evidence and its limits |
| `evidence/baseline-npm.txt` | npm `latest` vs local vs `main` for all 8 packages |
| `evidence/review-*.md` | Per-cluster reviewer returns (5 clusters) + `/manual` + the policy review |
| `evidence/american-spelling.txt` / `-all.txt` | The spelling sweep, default and `--all` zones |
| `evidence/spelling-confirmed.md` | Per-document confirmed counts + the 3 rejections and why |
| `evidence/policy-locale-parity.txt` | Policy parity script output (PASS) |
| `evidence/manual-check-*.txt` | `/manual` size + roster check, against the branch and `origin/main` |
| `evidence/docs-gates.txt` | `docs:check-versions` and `docs:check-links` |
| `evidence/inventory-*.txt`, `living-files.txt`, `clusters/` | What was inventoried and how it was split |

## Top items

1. **DOC-015 (MEDIUM)** — web-app: 23 documents call the tool "Community Presets"; the app has always titled it "Preset Palettes". Needs a maintainer decision before either side moves.
2. **DOC-021 (MEDIUM)** — core: the multi-color-extraction spec's `PaletteService` signatures and its worked example no longer compile against the shipped code.
3. **DOC-019 (MEDIUM)** — repo-wide: `OPEN_ITEMS.md` lists cross-identity bans as unshipped work; moderation-worker shipped it on 2026-09-16. Only a narrower residual remains.
4. **DOC-020 (MEDIUM)** — repo-wide: the glossary defines "Special Dye" by an acquisition tier the schema does not have, contradicting the maintainer guide.
5. **DOC-016 (MEDIUM)** — oauth: the setup guide omits `XIVAUTH_CLIENT_SECRET`, so an operator provisions two of three secrets.
6. **DOC-001…006 (LOW)** — 417 British spellings across 56 documents, filed per cluster.

**Totals:** 22 findings — 0 HIGH, 13 MEDIUM, 9 LOW. Nothing needs acting on out-of-band.
