# 2026-08-20 — web-app i18n audit

**Scope:** `apps/web-app` only (locale files, source, fonts). Branch `monorepo-2.0-prep` @ `1cbb303e`.

| Document | What it holds |
|----------|---------------|
| [I18N_AUDIT_2026-08-20.md](I18N_AUDIT_2026-08-20.md) | Executive summary, locale comparison, content defects L-1…L-7, checklist, recommendations |
| [HARDCODED_STRINGS.md](HARDCODED_STRINGS.md) | ≈270 hardcoded-string rows grouped into 12 systemic shapes (HC-SYS-001…012) + per-component highlights; new-key list; side observations |
| [TERMINOLOGY_VIOLATIONS.md](TERMINOLOGY_VIOLATIONS.md) | TERM-001…005 — official-term check vs `docs/reference/ffxiv-terminology.md` and the runtime core locales |
| [FONT_SUBSET_AUDIT.md](FONT_SUBSET_AUDIT.md) | Script coverage, `--font-cjk` ordering (FONT-WEB-001), font-contract check |
| [REMEDIATION_PLAN.md](REMEDIATION_PLAN.md) | Sprint-sequenced plan built from the three catalogs |
| `evidence/` | Parity / terminology / quality script output, gate output, the seven reviewers' line-level tables |

**Headline:** locale files clean (0 dup / 0 missing / 0 interp); code has ≈100 High hardcoded-string rows incl. one bug (palette-drawer category headings English in every locale), an un-localized `preset-edit-form.ts`, English service toasts, a 7-tool `Custom (#HEX)` leak, hardcoded `gil`, English-only route titles, and a 58-cell vocabulary split between web-app `config.*` keys and core getters.

No source or locale file was modified by this audit itself — the audit only produced the catalogs above. The remediation it planned was executed separately, on branch `i18n-remediation-2026-08-20`, commits `37668a97..13b84fdb` (22 commits, Tasks 1–19 of [EXECUTION_TASKS.md](EXECUTION_TASKS.md); Task 20 closes out this folder). See `REMEDIATION_PLAN.md`'s per-sprint completion annotations and "Execution notes" section for what shipped and what was deferred.
