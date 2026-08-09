# Pre-Release Audit — Monorepo 2.0 / Web-App 5.0

**Date:** 2026-08-09 · **Branch:** `monorepo-2.0-prep` @ `58dbe2f` · **No code was modified.**

Four audits run against the full monorepo (16 workspaces, ~253k lines TypeScript), measured
against the 5.0 design record in `XIVDyeTools-redesign-5.0/`.

## Verdict

**The implementation is sound, sensible and stable.** Every gate the project defines is green —
**24/24 type-check tasks** and **24/24 test tasks — 8,262 tests across 320 files**, run uncached. No SQL
injection, no XSS sink, no hardcoded secret, no auth bypass, no race condition, no floating
promise, no swallowed exception, no duplicate locale key, no dropped interpolation variable.

The 33 findings are overwhelmingly **conformance drift** — decisions that landed on one surface
and were never mirrored to its sibling — plus stale build artefacts and dependency freshness.
**Nothing is actively exploitable; no credential needs rotating.**

Two findings should not ship as-is:

| | |
|---|---|
| **[BUG-001](bugs/BUG-001.md)** | The Discord bot's *registered* command schema still offers a `community` preset category that `PresetCategory` no longer defines. Discord vouches for the broken input, so users cannot tell it is a bug. |
| **[FONT-001](i18n/FONT_SUBSET_AUDIT.md)** | `discord-worker`'s CJK subsets are stale by 128 glyphs — tofu (`□`) mid-sentence for ja/ko/zh users, with no fallback for 112 of them. |

## Start here

**→ [REMEDIATION_PLAN.md](REMEDIATION_PLAN.md)** — the merged, sprint-sequenced execution plan.
All four catalogs schedule into **7 sprints**, clustered so each ends in one coordinated release.

## Documents

| Document | Contents |
|---|---|
| [ANALYSIS_MANIFEST.md](ANALYSIS_MANIFEST.md) | Scope, measured baseline health, deploy units, evidence index, and the scoping correction made mid-audit |
| [REMEDIATION_PLAN.md](REMEDIATION_PLAN.md) | **Merged plan** — 25 scheduled, 4 superseded, 1 KEEP, 3 no-action |
| [DEEP_DIVE_REPORT.md](DEEP_DIVE_REPORT.md) | 10 findings — `BUG-001…003`, `REFACTOR-001…005`, `OPT-001…002` |
| [SECURITY_AUDIT_REPORT.md](SECURITY_AUDIT_REPORT.md) | 7 findings — `FINDING-001…007` |
| [DEAD_CODE_REPORT.md](DEAD_CODE_REPORT.md) | 8 findings — `DEAD-001…008` · Health score **A** |
| [i18n/I18N_AUDIT_2026-08-09.md](i18n/I18N_AUDIT_2026-08-09.md) | Locale parity across 3 trees × 6 languages |
| [i18n/FONT_SUBSET_AUDIT.md](i18n/FONT_SUBSET_AUDIT.md) | Per-worker glyph coverage — `FONT-001`, `FONT-002` |
| [i18n/HARDCODED_STRINGS.md](i18n/HARDCODED_STRINGS.md) | `HC-001…004` |

Detail files: [`bugs/`](bugs/) · [`refactoring/`](refactoring/) · [`findings/`](findings/) (security + dead-code) · [`evidence/`](evidence/) (raw tool output)

## Findings at a glance

| Audit | Findings | Highest | Notes |
|---|---:|---|---|
| Deep-dive | 10 | `BUG-001` HIGH | 7 of 10 are `web-app` conformance drift |
| Security | 7 | 2 × MEDIUM | 0 critical, 0 high **as deployed**; 0 rotations |
| Dead code | 8 | HIGH confidence | ~685 KiB stale assets; **no orphaned source modules** |
| i18n | 8 | `FONT-001` HIGH | 0 duplicate keys, 0 interpolation mismatches, 0 real key gaps |

**On the dependency numbers:** `pnpm audit` reports 1 critical / 5 high. Re-scored for actual
reachability, nothing lands above MEDIUM — the "critical" (`seroval`) sits in the **parked,
undeployed** `stoat-worker`, and the highs are dev-toolchain packages that never reach a
deployed artefact. [FINDING-003](findings/FINDING-003.md) and
[FINDING-004](findings/FINDING-004.md) show the working.

## The cross-cutting observation

Six findings share one root cause, across three different audits:

| Decision | Landed | Missed |
|---|---|---|
| `OAUTH-SEC-001` — gate localhost CORS on environment | `oauth` | `presets-api` (`FINDING-002`) |
| Habibi → Fragment Mono for numerics | `packages/svg`, both graphics Workers | `web-app` (`BUG-002`) |
| Drop the `community` category | `PresetCategory`, `web-app` | `discord-worker` schemas (`BUG-001`) |
| Re-cut CJK subsets for 5.0 strings | `og-worker` | `discord-worker` (`FONT-001`) |
| One accent `#EA4133` | `discord-worker` | `web-app` `theme-color` (`REFACTOR-001`) |

Each was applied **instance-by-instance rather than as a class**. The design record already
prescribes the cure — *"Fix the class, not the instance; enumerate siblings … and edit them
together"* — and adopting a grep-all-surfaces step when a suite-wide decision lands would have
caught all six before this audit.

## Method note

The font analysis **corrected itself mid-audit**, and the correction is instructive. A first
pass pooled all three locale trees and reported ~1,500 missing glyphs across both graphics
Workers. Re-scoped to each worker's *own* subsetter inputs — `discord-worker` reads
`core` + `bot-logic`; `og-worker` reads `core` + its card strings; neither renders `web-app`
strings — the true figure is **128 missing in `discord-worker` and zero in `og-worker`**.

Both runs are kept in [`evidence/`](evidence/): `font-subset-scoped.txt` is authoritative,
`font-subset-audit.txt` documents the correction. Treat findings as leads, not gospel.

## Finding IDs

Every prefix restarts at `001` for this folder — `BUG-001` and `FINDING-001` coexisting is
correct, not a collision. Outside this folder, qualify IDs as
`2026-08-09-prerelease-monorepo-upgrade/BUG-001`.
