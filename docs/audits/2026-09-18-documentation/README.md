# Documentation audit — whole repository + `/manual`, 2026-09-18

Every document under `docs/` and the Discord bot's in-app `/manual`, checked against what
production serves: all eight app deploy workflows last succeeded on `0fec18f4` (= `origin/main`),
so the checkout was the served baseline. **38 findings — 1 HIGH, 26 MEDIUM, 11 LOW** — from 52
reviewer candidates, 49 of which survived verification (several merge into one finding), plus
three a verifier found outside the candidate list: two while checking `/manual` (DOC-011) and one
while a fix was being verified (DOC-038).

**All 38 were fixed the same day, on three draft PRs — none merged yet.** The audit pass itself
modified nothing; the remediation commits sit on top of it on this branch. A pre-merge review on
2026-09-19 (nine independent reviewers, no blockers) added one corrective commit to each PR — see
*Pre-merge review* in the report:

| PR | Carries | Deploys on merge |
|----|---------|------------------|
| [#190](https://github.com/FlashGalatine/xivdyetools/pull/190) (this branch) | the audit + 29 findings fixed in `docs/`, the root `README.md` and root `CLAUDE.md` | nothing |
| [#189](https://github.com/FlashGalatine/xivdyetools/pull/189) | DOC-003 … DOC-011 — `/manual` in six languages, discord-worker 5.5.8 | discord-worker, plus a no-change redeploy of moderation-worker (its path filter includes `packages/bot-logic/**`), plus the 5.8.1 release announcement |
| [#191](https://github.com/FlashGalatine/xivdyetools/pull/191) | the public developer site's copies of DOC-032 / DOC-037, api-worker 0.14.3 | api-worker |

They were trial-merged into `main` in three orders: clean each time, same tree, both docs gates green.

| File | Purpose |
|------|---------|
| [DOCUMENTATION_AUDIT_REPORT.md](DOCUMENTATION_AUDIT_REPORT.md) | Baseline and coverage tables, gate results, the findings catalog, positive controls, rejected suspicions, release drift, verification gaps, recommendations |
| [findings/](findings/) | `DOC-001` … — one file per confirmed finding: location, evidence, exact correction, status |
| [evidence/](evidence/) | Gate output, served-revision and npm lookups, the docs inventory, one `review-<cluster>.md` per reviewer (per-file coverage, positive controls, rejected items) and one `verify-*.md` per verifier |
| [evidence/scripts/](evidence/scripts/) | `gen-findings.mjs` — the finding files and the catalog table are generated from one list so they cannot drift |

## Top items

1. **DOC-001 (HIGH)** — presets-api: `environment-variables.md` marks `MODERATOR_IDS`, `BOT_SIGNING_SECRET` and `INTERNAL_WEBHOOK_SECRET` as not required; production answers 500 to every request without them.
2. **DOC-003 / DOC-004 / DOC-005 (MEDIUM)** — discord-worker: `/manual` still documents the deleted `/swatch color|grid`, `/match` and `/match_image`, and names 9 of 17 commands — in all six languages. `/extractor image` sends users to that topic.
3. **DOC-012 – DOC-014 (MEDIUM)** — presets-api: wrong 409 error code in two documents, `content_revision` and migration 0014 undocumented, and a moderation route documented with a body the handler rejects.
4. **DOC-018 / DOC-019 (MEDIUM)** — web-app: the restored Extractor share link is still documented as absent, and the Swatch item-links menu (5.9.0) and glamour list export (5.10.0) appear nowhere in `docs/`.
5. **DOC-026 (MEDIUM)** — repo: `versions.md` says auth 2.0.2 awaits publishing (it is published) and names none of the four packages that do: logger, worker-kit, core, bot-logic.
6. **DOC-027 (MEDIUM)** — repo: four frozen-body `Status:` lines still say planned or pending for work that merged.
