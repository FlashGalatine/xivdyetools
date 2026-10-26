# Dead-code audit — the XIVCharaKit-facing code (2026-10-26)

47 findings (24 actionable, 23 KEEP; ~4,211 lines removable) in the code where the monorepo interacts with xivcharakit. The migration is complete at runtime — no production code calls the legacy `parseCharaFile` / `resolveCharaColors` — but both are published API with no deprecation, so their removal is a MAJOR release pair (core 6.0.0, bot-logic 5.0.0) after a deprecation MINOR. **No source files were modified by the audit**, and no Fable agent was used. It accompanies the [2026-10-26 security audit](../2026-10-26-security/README.md).

| File | Purpose |
|---|---|
| [DEAD_CODE_REPORT.md](DEAD_CODE_REPORT.md) | The catalog: findings, quick wins, KEEP register, positive controls, recommendations, remediation status |
| [CLEANUP_PLAN.md](CLEANUP_PLAN.md) | Sprint plan by deploy unit, with the interlocks to the security remediation plan |
| [findings/](findings/) | One file per finding (`DEAD-001`…`DEAD-047`) |
| [evidence/](evidence/) | Tool output (knip, tsc, i18n, the reachability gate, baseline gates), six slice reviews, candidates → groups → verification → `final-catalog.json`, and `scripts/` |

## Top items

1. **[DEAD-024](findings/DEAD-024.md) (REFACTOR FIRST, MAJOR)** — core: the legacy parser/resolver pair, its legacy-only public types and the parity harness's `[host]` half (~3,560 lines) are reachable only from tests; deprecate in core 5.16, remove in core 6.0 once beta acceptance closes.
2. **[DEAD-020](findings/DEAD-020.md) / [DEAD-021](findings/DEAD-021.md) (REFACTOR FIRST)** — core: `MAX_CHARA_FILE_BYTES` and the live slot and result types still live in the legacy files; move them first.
3. **[DEAD-023](findings/DEAD-023.md) (REFACTOR FIRST, MAJOR)** — bot-logic: `SwatchResult.character` and its legacy back-mapping (~324 lines) are read by no adapter.
4. **[DEAD-011](findings/DEAD-011.md) (REMOVE WITH CAUTION)** — web-app: the protocol validates dye objects the worker can never send (~245 lines).
5. **[DEAD-017](findings/DEAD-017.md) (REMOVE)** — bot-logic: a test fixture module ships in the published tarball.
6. **[DEAD-003](findings/DEAD-003.md) / [DEAD-002](findings/DEAD-002.md) (REMOVE)** — core: seven stale `@public` tags and docs that still describe the legacy parser as the live path.
