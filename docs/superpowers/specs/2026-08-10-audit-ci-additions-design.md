# Design — CI additions from the 2026-08-09 pre-release audit

**Date:** 2026-08-10
**Source:** [REMEDIATION_PLAN.md § Suggested CI additions](../../audits/2026-08-09-prerelease-monorepo-upgrade/REMEDIATION_PLAN.md)
**Status:** design approved, not yet implemented

---

## Why

All seven remediation sprints are complete. The plan closes with five suggested CI checks —
"not findings, but each one would have caught something in this audit the day it landed."

That framing is the point. Every one of these guards a defect class that reached a pre-release
audit *because nothing failed when it landed*. `FONT-001` is the sharpest example: subsets are
derived artefacts of the locale files, every locale edit invalidates them, and the 41
`discord-worker` test files assert SVG structure — so 128 missing glyphs sat in `main`'s
successor branch for two months with a fully green gate.

## Read this first — four of the five suggestions had wrong premises

Verified 2026-08-10 before designing. The plan's table is a lead, not a spec:

| Plan says | Verified reality | Consequence |
|---|---|---|
| Add `pnpm audit` as a non-blocking CI report | **Already present** — `ci.yml:32-34`, `continue-on-error: true`. But it runs `--prod`, which excludes devDependencies — and `FINDING-004` was *entirely* devDependencies | Widen the existing step; do not add a new one |
| Use "the ~120-line script in `evidence/`" | `evidence/` holds `i18n-parity.txt`, the **output**. The script was never committed. Separately, `apps/web-app/scripts/validate-i18n.js` exists, covers web-app only, and is wired into neither CI nor turbo | Write the script; cover all three trees |
| Enable ESLint `lit/no-literal-text` | **The rule does not exist.** eslint-plugin-lit ships 25 rules, none about literal text; `eslint-plugin-lit-a11y` is a11y-only; `eslint-plugin-i18next` documents no lit-html support | Write a custom local rule |
| Font-coverage assertion | Accurate | Build as described |
| `knip` as a non-blocking report | Accurate | Build, but see the sequencing note |

The plan's own standing guidance applies to its own suggestions: *"Findings are leads, not
gospel. Verify each finding's evidence against reality before coding."*

## Architecture — placement follows ownership

Two homes, and the split is not stylistic.

**`apps/discord-worker/src/services/fonts.coverage.test.ts`** — a vitest test. The Worker owns
the fonts, and `packages/core` + `packages/bot-logic` are *already declared dependencies* of it,
so turbo's graph marks discord-worker affected on any locale edit. CI runs
`--filter='...[HEAD^]'`, which means the check fires precisely when subsets are invalidated,
with no extra wiring. It also caches, and runs locally in `pnpm turbo run test`.

**`scripts/*.mjs` at the repo root** — for checks that span trees with no single owner. Web-app
locales are nobody's dependency, so an affected filter would skip them; these need to always
run. Each gets a root `package.json` script so it is runnable locally, and a CI step.

Existing precedent for both: `font-contract.test.ts` and `bundle-budget.test.ts` are invariant
guards living as tests; the bundle-size reporter is a CI step writing to `$GITHUB_STEP_SUMMARY`.

---

## 1. Font coverage — blocking test

**Highest value of the five.** The only check here that catches something no human review can:
a missing glyph is invisible in the diff, invisible in the SVG string, and invisible to every
existing assertion. And the class recurs forever, because every locale edit re-invalidates it.

### Requirement sets

Derived from what `subset-cjk-fonts.py` actually feeds each face — **not** one language each.
The audit measured SC against zh alone and consequently understated its requirement by 308
codepoints while mislabelling ~288 load-bearing ja fallback glyphs as trimmable:

| Face | Requirement set | Count today |
|---|---|---|
| `NotoSansSC-Subset.ttf` | CJK across **all five** subsetter languages — SC is the terminal fallback in every chain | 1,129 |
| `NotoSansJP-Subset.ttf` | CJK in `ja` only | 556 |
| `NotoSansKR-Subset.ttf` | Hangul across all | 489 |

The test reads the same locale paths the subsetter reads, so the two cannot drift.

### cmap reader

Hand-rolled **format 4** parser, ~50 lines, no new dependency. Verified 2026-08-10: all three
subsets expose only `(3,1,4)` and `(0,3,4)` subtables, max codepoint U+FF1F — entirely BMP.
Adding `fontkit` to a Worker app's devDependencies to read one table is not warranted.

Two correctness details:

- **"Covered" means *maps to a non-zero glyph id*.** Format 4 requires a final
  `0xFFFF → glyph 0` segment, and a segment can map a codepoint to glyph 0 mid-range. Resolving
  `idDelta` / `idRangeOffset` is a few extra lines and makes the check exact rather than
  approximate. A naive "is the key present" check would pass on a `.notdef` mapping.
- **Assert the subtable format is 4, and fail loudly on anything else.** If a future re-cut
  emits format 12, a format-4-only reader would silently see zero coverage or partial coverage.
  The check must break visibly rather than under-report.

### Second assertion — family names

Each face's `name` table family must match the `FONT_STACKS` strings in
`packages/svg/src/frame.ts`. This guards the defect fixed in Sprint 7: subsetting a variable
source without `fix_names` left `nameID 1 = "Noto Sans SC Thin"` while every stack asked for
`Noto Sans SC`. It rendered correctly only because resvg's fontdb prefers `nameID 16` — and the
identical condition still ships in `og-worker`. Nothing else in the repo would catch it
returning.

### Deliberately excluded

Glyph-outline checking (`glyf`/`loca` parsing to confirm non-zero contours). It guards only a
subsetter bug, the one-time Sprint 7 verification found nothing, and it roughly doubles the
parser. Recorded here so a later reader knows it was considered.

---

## 2. i18n parity — three blocking checks, one report

`scripts/check-i18n-parity.mjs`, covering all three locale trees:

- `packages/core/src/data/locales/`
- `packages/bot-logic/src/i18n/locales/`
- `apps/web-app/src/locales/`

### Blocking — exact checks, no allowlist

| Check | Why it matters |
|---|---|
| Leaf-key parity vs `en` | A missing key renders the raw key path to users |
| **Duplicate keys** | `JSON.parse` silently keeps the *last* value, so a duplicate destroys a translation with no signal anywhere. Must be a raw-text scan; a parsed object cannot see it |
| Interpolation-token parity | A translation that drops `{count}` renders a sentence missing its number |

All three are exact. Nothing to allowlist, nothing to maintain.

### Report-only — the untranslated heuristic

"Value identical to `en` ⇒ possibly untranslated" is a heuristic, and the audit already ruled
its output a non-finding: all 62 hits were brand names, standards identifiers (`WCAG AA`),
method tags (`ΔE76 · CIE 1976`), true cognates, or command literals (`I18N-002`). **Never block
CI on a heuristic.** It reports; a human reads it.

> **Design revision.** An earlier draft made this blocking behind an
> `i18n-parity-allowlist.json` of known-good identifier strings. That allowlist existed only to
> repair a problem the blocking decision created, and would have needed updating whenever any
> of those strings changed. Dropped entirely.

### The one structural config that survives

`I18N-001`: `preset.*.tags` arrays are **authored per locale at different lengths** (en 4,
others 2–3) and consumed safely via `.map()`/`.some()`. The *exact* key-parity check must know
these paths are variable-length or it reports 122 false missing entries. This is a stable
structural fact about the data — a short list of path globs, not a list of strings.

Lives as a `VARIABLE_LENGTH_PATHS` constant **inside `check-i18n-parity.mjs`**, not a separate
config file. It is a handful of globs that change only when the data's shape changes; a
standalone JSON file would imply it is routinely edited.

### Also wire in `validate:i18n`

`apps/web-app/scripts/validate-i18n.js` already exists and does a **different** job: verifying
that every `LanguageService.t()` / `tInterpolate()` call site references a key that exists. It
is currently wired into nothing. Run it in CI with `--strict`. The small overlap on "missing
keys" is harmless redundancy.

---

## 3. `no-untranslated-literal` — custom ESLint rule

**The lowest-value of the five, and the design should say so.** The entire finding class was
four violations (`HC-001…004`), all fixed in Sprint 4. This prevents recurrence of a small
class; it does not find anything today.

New rule at `apps/web-app/eslint-rules/no-untranslated-literal.js`, following the local flat-
config plugin pattern already proven by `no-i18n-fallback.js` (registered as
`xivdyetools-i18n` in `apps/web-app/eslint.config.js`).

### Scope — Lit templates only

**14 of 62** component files import Lit's `html`. The other 48 return HTML strings from
`BaseComponent.render()`. Those are excluded deliberately:

- Their markup is inline-style-dense by necessity — tool content renders inside
  `v4-layout-shell`'s **shadow DOM**, where document-level Tailwind never reaches, so the
  inline styles are load-bearing (see `apps/web-app/CLAUDE.md`).
- The false-positive rate on string-concatenated markup would be severe, and a noisy rule gets
  disabled — taking the useful 14 files with it.
- All four original findings were in Lit files (`preset-detail.ts`).

Revisit only if an HC-class finding appears in string-render code.

### Detection

Flags text nodes inside `html\`\`` templates that contain word characters and are not `${…}`
interpolations. Ignores punctuation, numerals and standalone symbols. Among attributes, checks
only the user-facing four: `aria-label`, `title`, `placeholder`, `alt`.

Ships with `RuleTester` tests — a lint rule with no tests is a lint rule nobody can safely
change.

### Severity is measured, not assumed

The plan's "only 4 violations repo-wide, this can go straight to `error`" counted findings
Sprint 4 already fixed. Implement, run, count:

- **0 or a handful** → ship as `error` (expected outcome).
- **Many** → ship as `warn` and report the number. That result is itself useful news.

---

## 4. `pnpm audit` — widen the existing step, and diff a baseline

Keep `--prod --audit-level high` exactly as-is. Add a second step covering the **full** tree
including devDependencies at `--audit-level moderate`.

That gap is the whole story of `FINDING-004`: 14 advisories accumulated in `vite`, `esbuild`,
`wrangler`/`miniflare`, `undici`, `nanoid` and `brace-expansion` — every one a devDependency,
every one invisible to `--prod`.

### The baseline diff is not optional

Sprint 6 accepted 6 advisories with explicit revisit triggers (VitePress 2 shipping stable;
`stoat-worker` un-parking). An unfiltered report re-lists those 6 on **every PR**, which trains
readers to skip the section — and then a genuinely new advisory scrolls past unread.

Diff against a committed baseline and report only the delta. Sprint 6 already produced one:
`docs/audits/2026-08-09-prerelease-monorepo-upgrade/evidence/pnpm-audit-post-sprint-6.json`.

Copy it to **`.github/audit-baseline.json`** — a stable path outside the dated audit folder,
since the baseline is live config and the audit folder is a historical record that should not
be edited. Comparison is by advisory ID plus resolved package version, so a *known* advisory
reappearing in a *new* package path is reported as new. `scripts/audit-delta.mjs` performs the
diff and renders the step summary; accepting a new advisory means updating the baseline file,
which makes each acceptance a reviewable diff rather than a silent decision.

### Non-blocking permanently

Not "non-blocking at first". A newly published CVE can turn `main` red on an unrelated PR
through no action of the author's. That is the standard reason audit gates get ripped out, and
the reason the existing step already carries `continue-on-error: true`.

---

## 5. `knip` — measure before choosing the shape

Sequenced **last**, deliberately, because its correct shape depends on a number nobody has.

A non-blocking report that nobody triages is worse than no report: it lengthens the CI summary
and teaches people to skip it. The value in knip is the triage pass, and that is human work.

**Step 1 — run it once locally.** Root `knip.json`, workspace-aware, plus a `pnpm check:knip`
script. Read the number.

**Step 2 — decide from the number.** The threshold is **25 total findings** across unused files,
exports and dependencies — roughly what one sitting can genuinely judge rather than rubber-stamp:

| Result | Action |
|---|---|
| **≤ 25** | Fix or explicitly `ignore` each, then land the CI step **blocking**. A real guarantee |
| **> 25** | Land `knip.json` + the script only. Triage becomes its own scheduled work; no CI step until it is green |

Record the actual number in the implementation plan either way — it is the finding, and it
answers whether `DEAD-001`/`002`/`003` were isolated or the visible part of a pattern.

A prior one-off report exists at `docs/audits/2026-02-28/evidence/knip-report.txt` for
comparison, but it predates the monorepo consolidation and both 5.0 and Monorepo 2.0 — treat it
as historical only.

---

## Bundled fix — pin `SOURCE_DATE_EPOCH` in the subsetter

Roughly three lines in `apps/discord-worker/scripts/subset-cjk-fonts.py`.

fontTools stamps `head.modified` with wall-clock time, so the subsetter is **not
byte-deterministic**: three consecutive runs produce three different file hashes with identical
glyph coverage (measured 2026-08-10). Every re-cut therefore dirties three ~800 KiB binaries
whether or not anything changed.

Pinning a fixed epoch converts that into "the fonts change only when coverage changes", which
makes the new font test's failures reviewable and makes `git diff` on fonts meaningful. Risk is
confined to one metadata timestamp. It belongs with this work rather than floating as a separate
decision.

---

## Complete file surface

Every path this design creates or edits, so the plan can be checked against it:

| Path | New? | Purpose |
|---|---|---|
| `apps/discord-worker/src/services/fonts.coverage.test.ts` | new | The blocking font guard (§1) |
| `apps/discord-worker/scripts/subset-cjk-fonts.py` | edit | Pin `SOURCE_DATE_EPOCH` |
| `scripts/check-i18n-parity.mjs` | new | Three blocking checks + one report (§2) |
| `scripts/audit-delta.mjs` | new | Baseline diff + step summary (§4) |
| `.github/audit-baseline.json` | new | Accepted advisories, seeded from Sprint 6 |
| `apps/web-app/eslint-rules/no-untranslated-literal.js` | new | The custom rule (§3) |
| `apps/web-app/eslint-rules/no-untranslated-literal.test.js` | new | `RuleTester` cases |
| `apps/web-app/eslint.config.js` | edit | Register the rule |
| `knip.json` | new | Workspace-aware config (§5) |
| `package.json` (root) | edit | The four `check:*` scripts below |
| `.github/workflows/ci.yml` | edit | New steps |

Root scripts, so nothing is reachable only from a workflow:

```
pnpm check:i18n     → node scripts/check-i18n-parity.mjs
pnpm check:audit    → node scripts/audit-delta.mjs
pnpm check:knip     → knip
pnpm check:all      → the three above, sequentially
```

The font guard needs no script — it is a test, and `pnpm turbo run test` already runs it.

## Implementation order

1. **Font coverage** — highest value, fully self-contained, no new dependencies.
2. **`pnpm audit` widening** — smallest change; two workflow steps and a baseline file.
3. **i18n parity** — new script, three trees, plus wiring `validate:i18n`.
4. **ESLint rule** — new rule plus `RuleTester` tests; severity set from the measured count.
5. **`knip`** — config and script; CI step gated on the triage number.

`SOURCE_DATE_EPOCH` rides with step 1, since both touch the font pipeline.

## Success criteria

- A locale edit that introduces an uncovered codepoint **fails** `pnpm turbo run test`, locally
  and in CI, without anyone remembering to re-run the subsetter.
- A duplicate key, a dropped `{count}`, or a missing key in any of the three locale trees fails
  CI.
- A hardcoded user-facing string in a Lit template is flagged at lint time.
- A **new** advisory appears in the CI step summary; the 6 accepted ones do not.
- Every new check is runnable locally by name, not only inside a workflow.
- No check that is red on the day it lands.

## Out of scope

- Making `knip` blocking before triage.
- Extending `no-untranslated-literal` to the 48 string-render components.
- Glyph-outline verification in the font test.
- Re-cutting `og-worker`'s fonts — verified complete by `FONT-002`, and untouched by this work.
  (Its subsets carry the same `nameID 1` quirk; the family-name assertion here covers
  discord-worker only. Extending it to og-worker is a reasonable follow-up, not part of this.)
