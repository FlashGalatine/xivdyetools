# Reviewer brief — i18n audit 2026-09-19

Base: `origin/main` `e86c7404`. Worktree root (run everything from here, never `cd` out):
`C:\dev\XIVProjects\xivdyetools\.claude\worktrees\i18n-audit-2026-09-19`

Six locales everywhere: `en ja de fr ko zh`. You are a **read-only** reviewer of ONE deploy unit
(named in your prompt). Find i18n defects a user would see. Do not modify source. Write exactly
one file: `docs/audits/2026-09-19-i18n/evidence/review-<unit>.md`. If the Write tool is refused,
return the same content in your reply instead.

## Where text lives

| Set | Path | Notes |
|---|---|---|
| core (GENERATED) | `packages/core/src/data/locales/*.json` | from `packages/core/dyenames.csv` + `localize.yaml` via `scripts/build-locales.ts`. A defect here is a CSV/yaml/generator defect. |
| bot-logic | `packages/bot-logic/src/i18n/locales/*.json` | hand-edited; `Translator.t()` returns the RAW KEY on a miss (never falsy); plurals via `.tc()` |
| web-app | `apps/web-app/src/locales/*.json` | hand-edited; `LanguageService.t()`; placeholders `{name}` |
| og-worker | `apps/og-worker/src/services/og-strings.ts` (card text, subset-parsed), `og-embed.ts` (crawler text) | tool names come from `OG_DECK` |
| discord/moderation | `commands/localize.ts` (`name_localizations`), handlers via `Translator` | moderation-worker is English-only BY DECISION (2026-09-03) |
| fonts | `apps/{og-worker,discord-worker}/src/fonts/` | Noto Sans JP/SC/KR static subsets; resvg ignores variable fonts |

Terminology dictionary: `docs/reference/ffxiv-terminology.md`, `docs/reference/glossary.md`.
Game nouns (dye names, categories, harmony types, wheel names, vision types, acquisitions) must
come from core's locale data / getters — never re-translated by hand on a surface.

## Surface that is NEW since the last audit (2026-09-03) — look hardest here

- core: colour-wheel names in the shared vocabulary (5 wheels: RYB, RGB/HSV, OKLCH ×2, Munsell), one-implementation-per-mixing-mode rename, Facewear colour names
- web-app: Harmony colour-wheel selector; Palette Extractor 4A (loupe, weighted bar, card sheet, share link); Swatch "Show all pieces", item-links menu (5 community databases), glamour list Copy / Export .md; Terms of Service + privacy pages; analytics toggle copy; "true things about matching" copy (ΔE bands, ΔEOK)
- discord-worker / bot-logic: `/manual` rewritten for 5.0 in six languages (uses core's harmony/wheel/category names), `/changelog`, analytics
- api-worker: `/v1/wheels`, `/v1/harmony*`, `/v1/chara/resolve`, `/v1/telemetry`; `?locale=` handling
- og-worker: `?lang=` on share URLs, localized cards

## Checklist (apply what fits your unit)

1. **Hardcoded user-visible strings** in handler/component code: English literals that reach a user
   in a non-English locale — labels, headings, button text, toasts, error messages, embed
   titles/fields/footers, card text, aria-labels/titles/placeholders/alt text, `innerHTML = \`…\``
   templates, `document.title`, clipboard/export text, date/number formatting
   (`toLocaleString()` with no/hardcoded locale, hand-built dates, hardcoded `,`/`.` separators,
   English ordinal/plural `+ 's'`).
2. **Raw keys / missing keys at call sites**: every `t('a.b')` / `t.t('a.b')` literal and every
   dynamically-built key family (`` `prefix.${x}` ``) resolves in all six files. Enumerate the
   value domain of `x` — do not assume.
3. **Locale plumbing**: is the user's locale actually threaded to every render path? Look for
   defaults to `'en'`, dropped `locale`/`lang` params, fallbacks that silently return English,
   locale lists spelled literally instead of imported, `Accept-Language`/Discord-locale mapping
   gaps (`zh-TW`, `en-GB`, `pt-BR`…), caches keyed without the locale.
4. **Placeholder / plural / concatenation defects**: sentence built by string concatenation around
   a translated fragment (word order breaks in ja/ko/de), English plural logic, `{count}` without
   a plural form, placeholder present in en but unused by the caller (or vice-versa).
5. **Translation quality in NEW keys** (added since 2026-09-03; `git log -p --since=2026-09-03 -- <locale path>`):
   untranslated English left in a non-en file, machine-translation tells, wrong register vs
   neighbours, half-width punctuation in CJK sentences, truncated values, inconsistent term for
   the same concept inside one file, game nouns that disagree with core / the dictionary.
6. **Cross-surface vocabulary**: same concept named differently here than in core or a sibling
   surface (harmony types, wheel names, vision types, categories, "metallic", match-quality bands).
7. **Fonts / glyphs** (card-rendering units only): any glyph a card can draw that no bundled face
   carries (symbols, arrows, stars, full-width punctuation, emoji); `font-family` stacks that can
   draw CJK but omit a JP/SC/KR face; weights requested that no static instance provides; text
   rows with no width guard for long de/fr strings or CJK.
8. **Public metadata**: `<html lang>`, `hreflang`, og:locale, manifest, sitemap, meta description —
   localized or deliberately English?

## Do NOT re-file (deliberate / already settled)

- Deliberately English: `/stats` admin dashboards, raw presets-api `response.error`,
  changelog/announcement bodies, preset name/blurb (user content), codes/tags (`R·C`, `ID`,
  `STANDARD·WIDE·COFFER`, `RGB DIST`, `DISTINGUISH %`, mixer "Spectral", `216 G`, A/B/C, ALGO_TAG,
  LENS_SHORT, tier names), ko/zh CIEDE2000 learn-link = no link, ja 染料 vs カララント per-surface
  house style, the whole of moderation-worker (staff-facing, English by decision), stoat-worker
  pinning `en` (parked app), log lines, thrown Error messages that never reach a user, identifiers,
  hex codes, brand names (`FFXIV`, `Universalis`, `Discord`, database site names).
- Already verified 2026-09-03 and fixed: locale file parity (dup/missing/extra/placeholder — the
  gates cover this; do NOT spend time re-diffing key sets), CJK subsets static + tight, `★` glyph,
  `Perlmutt-`, bot harmony/vision names from core, `/budget` quick-pick names, Facewear names,
  web-app `--font-cjk` stacks, presets-api error-code mapping in web-app, `?lang=` on og meta-refresh.
- web-app identical-to-EN values with a written reason in `apps/web-app/scripts/i18n-identical-allowlist.json`.
- JSDoc/comment CJK literals in `packages/svg`; Discord *message* emoji (not drawn by resvg).

## Rules of evidence

- Search tracked files only: `git grep -n <pat> -- '<unit>/src/*.ts'` or `git ls-files … | xargs grep`.
  Never `grep -r apps packages` (coverage HTML and e2e JSON embed source and fake hits).
- No `grep -P` for CJK — use python with `PYTHONIOENCODING=utf-8`.
- Every candidate needs a `file:line` you actually opened, and a one-line statement of **what a
  user in which locale sees**. "Might be" candidates are fine but mark them `?`.
- A string is user-visible only if you traced it to a render/response path. Say how.
- Do not run builds or the full test suite (a collector is doing that concurrently). Single
  targeted `vitest run <file>` is OK if needed; never pass `--reporter=basic`.

## Return schema (your final reply — ≤ 40 lines, nothing else)

```
| cand-id | tier | file:line | locale(s) | one-line claim (what the user sees) | evidence pointer |
```
Tier: P1 wrong/raw/English text a user sees in normal use · P2 missing key / falls back to en /
edge path · P3 tooltip-aria-latent-cosmetic. Then `POSITIVE:` ≤ 6 bullets (what is right and
should not be re-filed), `REJECTED:` ≤ 6 bullets (checked and dropped, with reason),
`COVERED:` file count. The review file carries the long form (module map, per-candidate excerpt).
