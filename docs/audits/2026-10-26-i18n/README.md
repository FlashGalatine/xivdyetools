# i18n audit — 2026-10-26

This audit appends to [PR #333](https://github.com/FlashGalatine/xivdyetools/pull/333) and [PR #334](https://github.com/FlashGalatine/xivdyetools/pull/334): **6 findings (3 P1, 2 P2, 1 P3), all OPEN**. No source files were modified by the audit. The [merged remediation plan](REMEDIATION_PLAN.md) reconciles both preceding catalogs and both new catalogs; no remediation sprint has started.

**Scope:** all 17 workspace units; six locales for i18n. **Branch:** `codex/deep-i18n-audits-20261026` at `6da3ff5b047188e6f8c08be2ea47f99f02e7a8d1`. PR #334 contains #333; both prior PRs are documentation-only and share main's runtime tree at `13c386e5`. Date follows the maintainer's local 2026-10-26 session; some evidence timestamps are UTC 2026-10-27.

**Method:** tracked-source inventories, runtime/declaration reads across packages/apps, targeted tests and caller traces, gates and independent Sol/xhigh verification. Some comments, static markup and style literals were elided as recorded in the read ledgers; no visual CSS audit is claimed. Generated data received structural checks; translations received changed-value and targeted semantic review, not a new native-speaker certification of all unchanged prose. See each report's scope and limitations.

| File | Purpose |
|---|---|
| [I18N_AUDIT_2026-10-26.md](I18N_AUDIT_2026-10-26.md) | Verified catalog, controls, rejections and status |
| [findings/](findings/) | One evidence-backed OPEN finding per file |
| [evidence/](evidence/) | Read ledgers, reviewer returns, verification, command logs and reusable scripts |
| [Merged remediation plan](REMEDIATION_PLAN.md) | One assignment per finding, retained KEEP register, release dependencies |

## Top items

1. **[HC-001](findings/HC-001.md) (P1)** — apps/web-app: The localized fatal startup screen always renders an English detail sentence.
2. **[HC-002](findings/HC-002.md) (P1)** — apps/discord-worker: Clan preference autocomplete and invalid-clan options print only English names.
3. **[I18N-002](findings/I18N-002.md) (P1)** — apps/og-worker: The default Harmony OG card advertises six harmony types while the tool and worker support ten.
4. **[I18N-001](findings/I18N-001.md) (P2)** — apps/discord-worker: Twelve plain-language slash-command choices remain English despite translated descriptions.
5. **[TERM-001](findings/TERM-001.md) (P2)** — apps/web-app: Five Korean web strings still call the Hue coordinate 색조 instead of the pinned 색상.
6. **[FONT-001](findings/FONT-001.md) (P3)** — apps/og-worker: Chinese OG cards can select Japanese CJK glyphs because their font buffers always load JP first.
