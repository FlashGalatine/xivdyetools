---
name: i18n-manager
description: Use for any translation/localization work in xivdyetools — checking or syncing locales, missing or untranslated keys, terminology, American vs British spelling in the en locale, hardcoded UI strings, CJK fonts or font subsets, or an i18n audit/remediation plan ("check translations", "sync locales", "i18n audit", "British spellings", "font subset", "CJK fonts", "localization").
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Agent, Skill
---

# i18n Manager (xivdyetools)

Before delegating or running command blocks, read `../audit-shared/model-routing.md`. It defines the Claude/Codex runtime mapping, coordinator rules, and shell/tool conventions for this workflow.

Six locales everywhere: `en ja de fr ko zh`. Three locale JSON sets, two TypeScript string
tables, CJK subset fonts in two workers. **Run the repo's own gates first, then the scripts
here for what the gates don't cover.** Runs from the monorepo root `xivdyetools/`; set
`PYTHONIOENCODING=utf-8` before any python that prints CJK (and never `grep -P` for CJK).

## Where the text lives (fixed — do not rediscover)

| Set | Path | Edited by | Gate(s) |
|---|---|---|---|
| **core** (dye/category/term names, used by every app) | `packages/core/src/data/locales/*.json` | **GENERATED**: `packages/core/scripts/fetch_dye_names.py` → `packages/core/dyenames.csv` + `localize.yaml` → `scripts/build-locales.ts` (runs in core `build`). Hand edits are overwritten — fix the CSV/generator. | `pnpm --filter @xivdyetools/core run build:locales && git status --porcelain packages/core/src/data/locales` (drift = hand edit); `band-vocabulary.parity.test.ts`, `DyeSearch.parity.test.ts` |
| **bot-logic** (Discord/Stoat UI) | `packages/bot-logic/src/i18n/locales/*.json` | hand | `pnpm --filter @xivdyetools/bot-logic exec vitest run src/i18n --coverage.enabled=false` — locale parity, orphans, **reverse key-existence** (`t.t()` keys exist), `.tc()` plural gates, and (2026-09-20) `__tests__/locale-quality.test.ts`: identical-to-en allow-list, **same English → same translation**, `{placeholder}` parity — exceptions with reasons in `locale-quality-allowlist.json`, stale entries fail |
| **web-app** | `apps/web-app/src/locales/*.json` | hand; key order enforced | `pnpm --filter xivdyetools-web-app run validate:i18n` (referenced keys exist + key order + parity: duplicates, missing/extra, `{placeholder}` sets, identical-to-en, same-English) — **hand-run only, in no CI workflow**; the CI gate is its vitest twin `exec vitest run scripts/i18n-parity-gate.test.js --coverage.enabled=false` (2026-09-20: every parity ERROR, un-allow-listed identical values, **same English → same translation** via `scripts/i18n-same-english-allowlist.json`, and "de never says Sie") · `run i18n:unused` (`-- --json`) · `exec vitest run src/__tests__/i18n-orphans.test.ts src/components/__tests__/v4/locale-switch.test.ts` · eslint plugin `xivdyetools-i18n` rules `no-hardcoded-ui-strings`, `no-i18n-fallback` (both **warn**; do not scan `innerHTML = \`…\`` sites) |
| **og-worker tables** | `apps/og-worker/src/services/og-strings.ts` (card text — subset-parsed), `og-embed.ts` (crawler og:title/description — not subset) | hand | `exec vitest run src/services/og-strings.test.ts src/services/svg/roles-i18n.test.ts src/services/svg/harmony.deck-fit.test.ts src/og-data-generator.test.ts src/services/font-coverage.test.ts --coverage.enabled=false` (`harmony.deck-fit` = every dye × the longest de / fr wheel names stays inside the deck's pixel budget) |
| **discord-worker / moderation-worker** | command metadata `commands/localize.ts` (`name_localizations`), handler code via `Translator.t()/tc()` | hand | `exec vitest run src/services/bot-i18n.test.ts src/services/i18n.test.ts src/services/locale-and-fonts.test.ts src/services/font-coverage.test.ts`; `register-commands` runs in CI on merge |
| **policy documents** (Privacy + ToS × 2 units) | `apps/web-app/{PRIVACY,TERMS_OF_SERVICE}.md`, `apps/discord-worker/{PRIVACY_POLICY,TERMS_OF_SERVICE}.md` + `<STEM>.<locale>.md` siblings (English unsuffixed, governing) | hand; **all six in one commit** | `python "<SKILL_DIR>/../audit-shared/scripts/policy-locale-parity.py"` (existence, structure, numbers/commands/hosts, `Last updated`, English-prevails notice) — rules in `../audit-shared/policy-documents.md`; claim differences belong to security-audit, missing/stale variants to documentation-audit, wording/terminology here |
| **fonts** | `apps/{og-worker,discord-worker}/src/fonts/` (Onest, Space Grotesk, Fragment Mono + NotoSans JP/SC/KR subsets); web-app `public/fonts/*.woff2` Latin only | `scripts/subset-cjk-fonts.py` in each worker (fontTools; sources cached in gitignored `scripts/.font-sources/`); og's also parses every `  xx: {` block of `og-strings.ts` | `font-coverage.test.ts` in both workers (cmap union covers every runtime string; `ja` glyphs in JP; surplus = warning → re-subset) |

Terminology dictionary: `docs/reference/ffxiv-terminology.md` (+ `docs/reference/glossary.md`).
Game nouns come from core locale data (XIVAPI en/ja/de/fr; ko/zh hand-sourced in
`dyenames.csv`) — reference the core key, never re-translate a dye/category/term by hand.
Placeholders are single-brace `{name}`; confirm against the set's `en.json` before adding keys.
**`en` is American English** — the standard, the carve-outs and the sweep are in
`../audit-shared/american-english.md`. The dictionary above wins wherever it conflicts, so a game
term keeps the game's spelling (**Grey** — the Facewear color and the four Grey dyes — and
**Glamour**) and is never filed.

## Parameters

| Param | Values |
|---|---|
| SCOPE | sets/units above (default: all that the named unit consumes) |
| MODE | `check` (gates + diff, report in chat) · `audit` (findings + catalog + plan, nothing modified) · `fix` (after approval) |
| OUTPUT | audit: `docs/audits/YYYY-MM-DD-<scope>-i18n/` (layout in `../audit-shared/conventions.md` §1) |

## Step 0 — load (audit mode)

Read `../audit-shared/conventions.md` + `model-routing.md`, `../audit-shared/traps/shell.md` and `traps/i18n-fonts.md`
(generated files, fonts-by-cmap, deliberately-English list, lookup-pattern catalog pointer), and
`../audit-shared/american-english.md` (the `en` spelling standard and its glossary exception). If a prior i18n
audit exists for the scope, read its README + *Rejected suspicions*; carry-forwards get new IDs.

## Step 1 — gates first (capture to `<OUT>/evidence/`)

Run the gate commands from the table for every set in scope; read only summaries/failures.
**Every subset `vitest run <files>` takes `--coverage.enabled=false`**: most workspaces set
`coverage.enabled: true` with thresholds, so a green run of five files exits 1 on coverage and
reads as a red gate (two false alarms in the 2026-09-19 audit). **A gate that is not in
`.github/workflows/ci.yml` is a hand-run gate** — before recommending "add the check to script X",
grep the workflows for X; `validate:i18n` was in none of them, and its checks only became a gate
when they moved under vitest.
Then inventory what changed since the last audit: `git log --since=<date> --stat -- <locale paths>`.

The gate runs and the `scripts/` sweeps in Step 2 are mechanical → a `collector` agent
(`../audit-shared/model-routing.md`) runs them, writes `evidence/`, and returns pass/fail per gate plus
counts (missing keys, orphans, cmap gaps, subset sizes). Follow the coordinator rules —
locale diffs and font dumps are exactly the output that should never enter the coordinator's
context.

## Step 2 — what the gates don't cover (`scripts/` here; copy the ones used to `evidence/scripts/`)

```bash
python "<SKILL_DIR>/scripts/locale-diff.py" packages/bot-logic/src/i18n/locales          # dup keys (nested), missing/extra vs en, identical-to-en candidates, placeholder mismatches
python "<SKILL_DIR>/scripts/locale-diff.py" packages/core/src/data/locales --source en    # generated set: drift means the generator/CSV, not the JSON
python "<SKILL_DIR>/scripts/script-inventory.py" packages/core/src/data/locales apps/og-worker/src/services/og-strings.ts   # codepoints per script block per file
python "<SKILL_DIR>/scripts/font-coverage.py" apps/og-worker/src/fonts/NotoSansSC-Subset.ttf packages/core/src/data/locales apps/og-worker/src/services/og-strings.ts --scripts cjk   # missing/stale per font
python "<SKILL_DIR>/scripts/cmap-diff.py" <old.ttf> <new.ttf>                               # compare subsets by cmap, never md5
node "<SKILL_DIR>/../audit-shared/scripts/american-spelling.mjs" . <en-file…>                # British spellings in en values (add --all for code zones)
```
- **Hardcoded UI strings in handler code**: web-app → `pnpm --filter xivdyetools-web-app exec eslint src -f json > <OUT>/evidence/eslint.json` and keep rule IDs starting `xivdyetools-i18n/`; plus `git ls-files 'apps/web-app/src/**/*.ts' | xargs grep -n 'innerHTML = `'` for the unscanned sites. Bots/og → `git ls-files '<unit>/src/**/*.ts' | grep -v -E '\.test\.ts$|og-strings|og-embed|localize' | xargs grep -n -E "['\"\`][A-Z][a-z]+( [a-z]+){2,}"` for sentences, and on card/crawler surfaces (`services/svg/*.ts`, `og-data-generator.ts`, handlers) also 2-word labels `"['\`][A-Z][a-z]+ [A-Za-z]+['\`]"`; triage by surface (user-visible vs log/error code/identifier). Web-app key lookups follow 11 patterns (dynamic prefixes included) — catalog in `docs/audits/2026-08-16-web-app-dead-code/evidence/agent-report-i18n.md` §A; `i18n:unused` resolves the prefixes, so check `swatch.*`-style families by hand.
- **Missing keys at call sites** (raw dotted keys in UI): bot-logic's reverse gate covers `t.t()`; for web-app `validate:i18n` covers `t('literal')`; dynamic keys need the pattern catalog.
- **Terminology**: compare game nouns in hand-edited sets/tables against the dictionary and core values; flag generic translations where an official term exists (`TERM-`).
- **`en` spelling**: `american-spelling.mjs` over each set's `en` file (`--keys=<prefix>` to narrow a shared file; a `.ts` table is read inside its `en:` block only). Confirm each candidate against `../audit-shared/american-english.md` before filing — the glossary wins, identifiers keep the code's spelling, and `og-strings.ts` is a positive control, not a target. One `TERM-` per set listing every key, never one per word.
- **Fonts**: every `font-family`/`STACKS` stack that can draw CJK lists JP/SC/KR; subsets newer than the last string change (`git log -1 --format=%cI -- <fonts>` vs locale paths); SC/JP subsets > 500 KiB or KR > 300 KiB = over-inclusion; og-worker `font-coverage.test.ts stringsFor()` lists every card-drawn table.

Scope > 1 unit → fan out per `conventions.md` §7 (one `worker` per unit/set,
candidate table back); single unit → inline unless the coordinator rules require delegation.
Terminology calls against the dictionary and any "is this string user-visible?" verdict are
`verifier` work.

## Step 3 — findings (`findings/<PREFIX>-XXX.md`, skeleton `conventions.md` §3)

| Prefix | Covers | Header fields |
|---|---|---|
| `I18N-` | duplicate keys, missing/extra keys, untranslated values, placeholder/structure mismatches, raw keys shown in UI | **Tier** P0 dupes · P1 wrong/raw text in UI · P2 missing key (falls back to en) · **Locale(s)** · **Deploy unit** · **Generated?** (core → fix generator/CSV) |
| `TERM-` | dictionary violations; British spellings in `en` | Tier P2 · Locale(s) · Deploy unit · official term + source row (spelling: the `american-english.md` rule, and the dictionary row when one settles it) |
| `HC-` | hardcoded UI strings | Tier P1 user-visible / P3 tooltip-aria · Deploy unit · target set + proposed key |
| `FONT-` | missing glyphs, stale subsets, stack gaps | Tier P1 tofu / P3 stale · Deploy unit — always scheduled **last** |

## Step 4 — report

One file `I18N_AUDIT_<date>.md` (skeleton `conventions.md` §4): locale status table per set
(`| Set | Keys | ja de fr ko zh coverage | dupes | gate result |`), catalog by prefix, font status
(`| Font | Needed | Covered | Missing | Stale |`), positive controls, rejected suspicions,
recommendations (guardrails: reverse gate where missing, eslint rule → error, subset script in CI).
Split `HARDCODED_STRINGS.md` / `TERMINOLOGY_VIOLATIONS.md` / `FONT_SUBSET_AUDIT.md` out only when a
section exceeds ~40 rows. No ASCII boxes.

## Step 5 — hand off + confirm (audit mode)

Load the `remediation-planner` skill by name with `<OUT>/` (+ other open catalogs). Planner rules this
audit relies on: Sprint 0 = dedupe/validity with **no translation changes**; wrong text before
missing text; fix the generator not the artifact; **fonts are the terminal sprint**. Then the
confirmation gate (`conventions.md` §8).

## Step 6 — fix mode (after approval, or `check`/`fix` requests)

1. Edit the **owning** source: web-app/bot-logic JSON directly; core via `dyenames.csv`/
   `localize.yaml` → `build:locales`; og tables in `og-strings.ts`/`og-embed.ts`; command
   metadata in `commands/localize.ts`.
2. Add/remove a key in **all six** files at once; web-app order via `node scripts/reorder-locales.mjs`
   (`--check` to verify); keep placeholders verbatim; plural forms via `.tc()` (bots only — web-app has none).
3. Re-run that set's gates; if any text changed in a set a worker renders, re-run
   `python scripts/subset-cjk-fonts.py` in og-worker and discord-worker and their
   `font-coverage.test.ts` (compare subsets by cmap). `git status --porcelain` must list only
   intended files.
4. Update each finding's `## Status` and the report's status table.

## Translation rules

- Official term exactly as the dictionary/core gives it (spelling, case, script); flag unknown
  game terms for review instead of inventing. That includes a game term the dictionary spells the
  British way (**Grey**, **Glamour**) — it outranks the American-English rule below.
- New and edited `en` values are American English (`../audit-shared/american-english.md`): *color*,
  *behavior*, *normalize*, *center*, *favorites*, *labeled*. Everything else in this list still
  applies — an identifier, a code, or a quotation keeps its own spelling.
- Match the register of the five neighboring keys in that set; don't churn per-surface house
  choices (ja 染料 vs カララント) or the deliberately-English items in `traps/i18n-fonts.md`.
- Identifiers, codes, tags, hex, brand names, `FFXIV`, `Universalis` stay as-is; CJK text uses
  full-width punctuation; keep UI length comparable (cards truncate).
- Never auto-translate silently — every generated translation is listed in the report/commit.

## Quick commands

| Ask | Do |
|---|---|
| "check translations for web-app / bots" | that set's gates + `locale-diff.py`; summary table in chat |
| "find missing/untranslated in `<locale>`" | `locale-diff.py <dir> --locale <code>` |
| "scan for hardcoded strings" | Step 2 hardcoded bullet only |
| "check en spelling" / "British spellings" | Step 2 `en` spelling bullet — `american-spelling.mjs` over the set's `en` file, triaged against `../audit-shared/american-english.md` |
| "font subset audit" / "check fonts" | Step 2 fonts bullet + `font-coverage.py` per subset + both `font-coverage.test.ts` |
| "full i18n audit" | Steps 0–5 |
| "add key X" / "fix translations" | Step 6 |
