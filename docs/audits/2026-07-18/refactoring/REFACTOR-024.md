# [REFACTOR-024]: og-worker doc/code drift — stale font claims in CLAUDE.md, duplicate `DyeService` instances, duplicated locale resolution

## Priority

LOW

## Category

Documentation drift + minor structural duplication

## Location

1. `apps/og-worker/CLAUDE.md` — claims "Three brand fonts" and "fonts are Latin-only — CJK would require subset font additions"
2. `apps/og-worker/src/og-data-generator.ts:79` and `apps/og-worker/src/services/svg/dye-helpers.ts:17` — two module-scope `new DyeService(dyeDatabase)` instances
3. `apps/og-worker/src/index.ts:147-151` (`resolveLocale` helper) vs seven inline `extractLocaleCode(c.req.query('lang') ?? '') ?? 'en'` copies at `:223, 266, 310, 355, 399, 444, 472`

## Current State

- CLAUDE.md documents the pre-CJK font state; the worker actually bundles five fonts including `NotoSansSC-Subset.ttf` / `NotoSansKR-Subset.ttf` (`services/fonts.ts:19-28, 52-58`) with `FONTS.primaryCjk` / `headerCjk` used throughout the generators, and ships `scripts/subset-cjk-fonts.py` for regeneration.
- `og-data-generator.ts` builds its own `DyeService` even though `dye-helpers.ts` already exports one; each construction validates 136 entries, builds three indexes, hue buckets, and a k-d tree — all duplicated per isolate cold start.
- Locale resolution logic exists as a named helper but is only used by `createToolHandler`; every `/og/*` image route re-inlines the expression.

## Issues

1. The stale CLAUDE.md misleads the deployment checklist ("if fonts changed…") and any future i18n work — an agent or contributor following it would wrongly conclude CJK is unsupported.
2. Double `DyeService` init wastes cold-start CPU for zero benefit and creates two objects that could theoretically diverge if options are ever passed to one.
3. Seven copies of the locale expression = seven places to update if `lang` handling changes (e.g. adding `Accept-Language`).

## Proposed Refactoring

1. Update CLAUDE.md: five bundled fonts, CJK subset pipeline (`subset-cjk-fonts.py`), re-subset trigger ("re-run when dyes/locales change"), reference to OPT-001 sizing (~176 KiB KR / ~290 KiB SC).
2. In `og-data-generator.ts`, delete the local instance and `import { dyeService } from './services/svg/dye-helpers'`.
3. Reuse `resolveLocale(url.searchParams)` (or add `resolveLangQuery(c)` taking the Hono context) in all seven image routes.

## Benefits

- Accurate operator/agent documentation for the font pipeline.
- One dye-DB initialization per isolate (halves that portion of cold-start work).
- Single locale-resolution point.

## Effort Estimate

Trivial-Small (≤1 hour total, mostly the CLAUDE.md rewrite).

## Risk Assessment

Minimal. The two DyeService instances are constructed identically, so unifying them cannot change behavior; locale helper substitution is mechanical. CLAUDE.md changes are documentation-only.

> Source: evidence/edge-workers-analysis.md (2026-07-18 deep-dive, edge-workers area)
