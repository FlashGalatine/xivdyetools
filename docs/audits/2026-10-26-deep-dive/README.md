# Deep-dive audit — 2026-10-26

This audit appends to [PR #333](https://github.com/FlashGalatine/xivdyetools/pull/333) and [PR #334](https://github.com/FlashGalatine/xivdyetools/pull/334): **24 findings (20 LOW, 4 MEDIUM), all OPEN**. No source files were modified by the audit. The [merged remediation plan](../2026-10-26-i18n/REMEDIATION_PLAN.md) reconciles both preceding catalogs and both new catalogs; no remediation sprint has started.

**Scope:** all 17 workspace units; six locales for i18n. **Branch:** `codex/deep-i18n-audits-20261026` at `6da3ff5b047188e6f8c08be2ea47f99f02e7a8d1`. PR #334 contains #333; both prior PRs are documentation-only and share main's runtime tree at `13c386e5`. Date follows the maintainer's local 2026-10-26 session; some evidence timestamps are UTC 2026-10-27.

**Method:** tracked-source inventories, runtime/declaration reads across packages/apps, targeted tests and caller traces, gates and independent Sol/xhigh verification. Some comments, static markup and style literals were elided as recorded in the read ledgers; no visual CSS audit is claimed. Generated data received structural checks; translations received changed-value and targeted semantic review, not a new native-speaker certification of all unchanged prose. See each report's scope and limitations.

| File | Purpose |
|---|---|
| [DEEP_DIVE_REPORT.md](DEEP_DIVE_REPORT.md) | Verified catalog, controls, rejections and status |
| [findings/](findings/) | One evidence-backed OPEN finding per file |
| [evidence/](evidence/) | Read ledgers, reviewer returns, verification, command logs and reusable scripts |
| [Merged remediation plan](../2026-10-26-i18n/REMEDIATION_PLAN.md) | One assignment per finding, retained KEEP register, release dependencies |

## Top items

1. **[BUG-001](findings/BUG-001.md) (MEDIUM)** — packages/bot-logic: Harmony hue-only selection prints angular degrees as the chosen matching metric.
2. **[BUG-002](findings/BUG-002.md) (MEDIUM)** — packages/bot-logic: Swatch merges same-index eyes even when live extended colors differ.
3. **[BUG-015](findings/BUG-015.md) (MEDIUM)** — apps/web-app: A language switch empties settled Swatch matches and disables Share.
4. **[BUG-018](findings/BUG-018.md) (MEDIUM)** — apps/web-app: Harmony ignores canonical harmony type on initialization and reset/import broadcasts.
5. **[BUG-003](findings/BUG-003.md) (LOW)** — packages/core: Character label cap can split a surrogate pair.
6. **[BUG-004](findings/BUG-004.md) (LOW)** — packages/bot-logic: Glamour embed truncation leaves oversized notes unbounded.
