# Deep-Dive Analysis Report — Pre-Release, Monorepo 2.0 / Web-App 5.0

## Executive Summary

- **Project:** xivdyetools (16 workspaces, ~253k lines TypeScript)
- **Analysis Date:** 2026-08-09
- **Branch:** `monorepo-2.0-prep` @ `58dbe2f`
- **Total Findings:** 10 (3 bugs, 5 refactors, 2 optimizations)

**Verdict: the implementation is sound and stable.** Every gate the project defines is green —
24/24 type-check tasks, 24/24 test tasks over 8,262 tests in 320 files, uncached. The classic hidden-bug
categories this analysis hunts came back essentially empty: no race conditions, no floating
promises, no swallowed exceptions, no resource leaks, no unreachable branches, no
loose-equality defects.

What the analysis *did* find is **conformance drift between the shipped code and the 5.0 design
record** — decisions that landed on one surface and not its sibling. That is the honest shape
of this release's risk, and it is exactly what a pre-release audit should surface.

The single finding that should not ship as-is is **BUG-001**: the Discord bot's *registered*
command schema still offers a `community` preset category that `PresetCategory` no longer
defines.

## Status Basis

- **Completed during analysis:** 0 — no code was modified, per the audit brief.
- **Outstanding:** 10 — 3 bugs, 5 refactors, 2 optimizations.

## What Was Checked and Found Clean

Recording the negatives is as valuable as the findings — it tells the next audit what not to
re-derive.

| Category | Method | Result |
|---|---|---|
| Race conditions / concurrency | Worker async paths, `ctx.waitUntil` usage, D1 batch transactions | **Clean.** 48 correct `waitUntil` calls; vote insertion uses `INSERT … ON CONFLICT DO NOTHING`; multi-statement writes use `db.batch()` |
| Floating promises | unawaited `env.*.fetch/put/get/delete` in Workers | **0 hits** |
| Swallowed exceptions | empty `catch {}` blocks | **0 hits** |
| Loose equality | every `==` / `!=` outside tests | **All deliberate** — uniformly the `== null` nullish idiom, which is correct and intentional |
| Unsafe randomness | every `Math.random()` | **All non-security** — random dye pick, k-means++ seeding, test fixtures |
| Dynamic code execution | `eval`, `new Function` | **0 hits** |
| Off-by-one / empty collections | `whereClause` construction, pagination edges | **Defended** — `conditions[]` seeds a non-empty base clause; `OPT-017` already fixed the out-of-range-page count collapse |
| Type safety | `pnpm turbo run type-check` | **24/24 pass** under `strict` + `verbatimModuleSyntax` |
| Test health | `pnpm turbo run test --force` | **24/24 pass** — 8,262 tests, 320 files, uncached |

## Findings Catalog

The `Deploy Unit` column is the key the remediation plan clusters sprints by.

### Hidden Bugs

| ID | Title | Severity | Type | Deploy Unit |
|----|-------|----------|------|-------------|
| [BUG-001](bugs/BUG-001.md) | Registered `/preset` schema still offers the retired `community` category (3 sites) | HIGH | Logic / contract drift | `discord-worker` |
| [BUG-002](bugs/BUG-002.md) | web-app still applies the retired Habibi proportional serif to numeric columns | MEDIUM | Design-conformance / rendering | `web-app` |
| [BUG-003](bugs/BUG-003.md) | `parseInt` on a Discord snowflake loses precision → wrong default avatar | LOW | Edge case / numeric precision | `web-app` |

### Refactoring Opportunities

| ID | Title | Priority | Effort | Deploy Unit |
|----|-------|----------|--------|-------------|
| [REFACTOR-001](refactoring/REFACTOR-001.md) | Stale 4.x branding in the live HTML entry (`theme-color` indigo vs 5.0 red) | MEDIUM | LOW | `web-app` |
| [REFACTOR-002](refactoring/REFACTOR-002.md) | Three disagreeing font stacks: `noscript`, `load-fonts.js`, `globals.css` | MEDIUM | LOW | `web-app` |
| [REFACTOR-003](refactoring/REFACTOR-003.md) | `web-app` `lint` script runs `--fix`, mutating source inside a cached Turbo task | MEDIUM | LOW | `web-app` |
| REFACTOR-004 | `v4-layout.css:29` uses a raw `'Segoe UI', Tahoma, Geneva, Verdana` system stack, bypassing the design system | LOW | LOW | `web-app` |
| REFACTOR-005 | `globals.css` still headed "XIV Dye Tools v2.0.0"; `.number` doc comment describes retired behaviour | LOW | LOW | `web-app` |

### Optimization Opportunities

| ID | Title | Impact | Category | Deploy Unit |
|----|-------|--------|----------|-------------|
| OPT-001 | 640 KiB of unreferenced woff2 (Cinzel ×9, Lexend ×18, Habibi) in `apps/web-app/fonts/` | LOW | Bundle / repo size | `web-app` |
| OPT-002 | `web-app` fetches 4 font families from Google Fonts at runtime despite self-hosting capability; 4 preconnect/dns-prefetch hints to third-party origins | LOW | I/O / privacy / LCP | `web-app` |

> **OPT-001 note:** `apps/web-app/fonts/` sits *outside* `public/`, so Vite never copies it — it
> costs repository size and reviewer attention, not deployed bundle size. It is tracked in the
> dead-code catalog as `DEAD-002`; listed here only so the optimization view is complete.
> Schedule it once, in the dead-code sprint.

## Cross-Cutting Observation — The Pattern Behind These Findings

Seven of the ten findings sit in `web-app`, and every one of them is the *same shape*: a
decision that landed on the bot/SVG surfaces and was never mirrored to the web surface.

- Habibi was retired for numeric columns → fixed in `packages/svg` and both graphics Workers
  (`FONTS.mono` → Fragment Mono), **not** in `web-app`'s `globals.css` (BUG-002).
- The 5.0 accent is `#EA4133`/`#CE2222` → `COLORS.blurple` collapsed to one constant in the bot,
  while the web entry still declares `theme-color: #4F46E5` (REFACTOR-001).
- The `community` category was dropped from `PresetCategory` → removed from the type and the
  web tab logic, **not** from the bot's registered schema (BUG-001).

The same shape appears in the security audit (`OAUTH-SEC-001` fixed in `oauth`, not mirrored to
`presets-api` — FINDING-002) and the i18n audit (subsets re-cut for `og-worker`, not for
`discord-worker` — FONT-001).

**This is the actionable finding above any individual line of code:** these changes were
applied instance-by-instance rather than as a class. The design record itself prescribes the
cure — *"Fix the class, not the instance; enumerate siblings … and edit them together"*
(`XIVDyeTools-redesign-5.0/CLAUDE.md` § Process). Adopting a grep-all-surfaces step when a
suite-wide decision lands would have caught six of these before the audit.

## Recommendations

1. **Fix BUG-001 before the release.** It is the only finding that changes a *registered*
   Discord contract, and registered schemas need a `register-commands` run — so it must be
   sequenced deliberately, not patched after launch.
2. **Batch the `web-app` conformance drift into one sprint.** BUG-002, BUG-003, REFACTOR-001
   through 005, OPT-002 and the dead-code items all live in `web-app` and share a single Pages
   deploy. Doing them together costs one verification pass instead of eight.
3. **Adopt the design record's own class-fix rule as a merge check.** When a suite-wide decision
   lands, grep every surface — web, bot, og, packages — in the same commit.
4. **Keep the test suite as the gate it already is.** 8,262 tests across 320 files passing uncached is a
   genuinely strong safety net; every fix below should be able to lean on it.

## Next Steps

See [REMEDIATION_PLAN.md](REMEDIATION_PLAN.md) for the sprint-sequenced execution plan — every
finding above is scheduled into exactly one sprint there, merged with the security, dead-code
and i18n catalogs.
