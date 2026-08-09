# Remediation Plan — 2026-08-09 Pre-Release Audit

**Sources (merged):**

| Catalog | Findings |
|---|---|
| [DEEP_DIVE_REPORT.md](DEEP_DIVE_REPORT.md) | 10 — `BUG-001…003`, `REFACTOR-001…005`, `OPT-001…002` |
| [SECURITY_AUDIT_REPORT.md](SECURITY_AUDIT_REPORT.md) | 7 — `FINDING-001…007` |
| [DEAD_CODE_REPORT.md](DEAD_CODE_REPORT.md) | 8 — `DEAD-001…008` |
| [i18n/I18N_AUDIT_2026-08-09.md](i18n/I18N_AUDIT_2026-08-09.md) + [FONT_SUBSET_AUDIT.md](i18n/FONT_SUBSET_AUDIT.md) + [HARDCODED_STRINGS.md](i18n/HARDCODED_STRINGS.md) | 8 — `FONT-001…002`, `HC-001…004`, `I18N-001…002` |

**Status basis:** 33 findings total — **0 completed** (no code was modified during the audit),
**25 outstanding and scheduled**, **4 superseded** by cross-audit conflict resolution,
**1 KEEP** (unscheduled, with a revisit trigger), **3 informational / no action**.
**0 require credential rotation.**

All catalogs come from this single audit folder, so bare IDs are unambiguous — each audit uses
a distinct prefix. Outside this folder, qualify every ID as
`2026-08-09-prerelease-monorepo-upgrade/BUG-001`.

---

## Read this first

**There is no Sprint 0.** Nothing in this audit is actively exploitable, nothing is losing
data, and no credential needs rotating. Every correctness gate the project defines is green:
24/24 type-check tasks and 24/24 test tasks over 8,262 tests in 320 files, run uncached. **This release
is not being held back by its defects — it is being tidied before it ships.**

Two findings genuinely should not ship as-is:

- **`BUG-001`** — the Discord bot's *registered* command schema offers a `community` preset
  category that `PresetCategory` no longer defines. Discord itself vouches for the broken input,
  so the user cannot tell it is a bug.
- **`FONT-001`** — `discord-worker`'s CJK subsets are stale by 128 glyphs, rendering tofu (`□`)
  mid-sentence for ja/ko/zh users.

Everything else is conformance drift, stale artefacts, or dependency freshness.

### Ordering principles applied

1. **One deploy unit per sprint** — each sprint ends in one coordinated release. Sprint 1 is the
   deliberate exception; it says so and explains why.
2. **Severity × Exposure for security findings** — an INTERNET-UNAUTH MEDIUM outranks a LOCAL
   HIGH. This is why `FINDING-001`/`002` are scheduled early and the `seroval` **critical**
   (`FINDING-003`) is not scheduled at all: it sits in a parked, undeployed app.
3. **Make the gate honest before using it** — `REFACTOR-003` leads, so every later sprint is
   linted truthfully.
4. **Cascades never share their trigger's sprint** — `DEAD-004` follows `BUG-002` into a later
   sprint so a failure has the smallest possible bisect target.
5. **Fonts are terminal, unconditionally** — `FONT-001` is the last sprint despite being the
   highest-impact user-facing finding. See the note in Sprint 7 for why that is correct here.

---

## Sprint 1 — Prerequisites: an honest lint gate, and one dependency bump across every Worker

Two pieces of groundwork that make everything after them cheaper and more trustworthy.

`REFACTOR-003` comes first because `web-app`'s `lint` task currently runs `eslint --fix` — it
mutates the source it is meant to verify, inside a Turbo-cached task. Every subsequent sprint in
this plan touches `web-app`. Fixing the gate before leaning on it is the difference between
"lint passed" and "lint edited the code until it passed".

`FINDING-001` then bumps `hono` `4.12.32 → ^4.12.34`, closing four advisories including a ReDoS
in the CORS middleware that every Worker mounts on `'*'` **ahead of authentication**.

**This sprint deliberately breaks the one-deploy-unit rule**, because the finding itself is
cross-cutting: `hono` is a dependency of all six Workers plus `worker-kit`. The alternative —
folding the bump into each Worker's own sprint — would leave an internet-reachable DoS vector
open behind unrelated cleanup work, and would still require the same six deploys, just later
and scattered. Doing it once, first, is both safer and cheaper.

| ID | Source | Sev/Pri | Item |
|----|--------|---------|------|
| [REFACTOR-003](refactoring/REFACTOR-003.md) | deep-dive | MED / P2 | Split `web-app`'s `lint` into read-only `lint` + explicit `lint:fix`, matching all 15 sibling workspaces. Also drops a `src/**/*.ts` shell-glob that expands differently on Windows dev vs Linux CI |
| [FINDING-001](findings/FINDING-001.md) | security | MED / **INTERNET-UNAUTH** / P2 | Bump `hono` to `^4.12.34` in all 6 Workers + `worker-kit`. Closes CORS ReDoS, Language-middleware DoS, `memo()` SSR retention, Proxy Helper header leak |

**Expect `REFACTOR-003` to surface pre-existing lint debt** on its first read-only run. That
debt already exists — this only makes it visible. Fix it with an explicit `lint:fix`, **review
the diff**, and commit it separately. That review is the entire point of the split.

**Ends with:** one `@xivdyetools/worker-kit` version bump + publish, and six `wrangler deploy`
runs (staging → production). `REFACTOR-003` is tooling only and needs no deploy.

**Gate:** `pnpm turbo run type-check test --force` (24/24 each) + `pnpm turbo run lint`.

---

## Sprint 2 — `discord-worker`: the registered contract

The anchor is `BUG-001`, the one finding that should not reach users. `PresetCategory` dropped
`community` in 5.0 and `web-app` followed, but three subcommand schemas in
`schemas.ts` (lines 918, 964, 997) still offer **🌐 Community** as a registered Discord choice.
A user selecting it sends a category the API no longer has.

`DEAD-006` rides along because it is the same retired concept surviving in
`@xivdyetools/test-utils`'s category factory — killing it in the same pass is what stops the
idea coming back. It is workspace-private and never published, so there is no external consumer
to coordinate; its `MINOR` semver marker is internal only.

| ID | Source | Sev/Pri | Item |
|----|--------|---------|------|
| [BUG-001](bugs/BUG-001.md) | deep-dive | **HIGH / P1** | Remove `community` from 3 schema sites; hoist to one shared `PRESET_CATEGORY_CHOICES` typed `value: PresetCategory` so the next dropped member is a compile error; add a parity test |
| DEAD-006 | dead-code | MED/LOW · MINOR / P3 | Drop the `community` row from `test-utils`' category factory (`category.ts:122`). Grep first for tests that index the array by position or expect six categories |
| DEAD-005 | dead-code | HIGH/NONE / P3 | Delete `fonts.test.ts:13`'s `vi.mock('../fonts/Habibi-Regular.ttf')` — the file has not existed since the Fragment Mono migration; Vitest mocks unresolved specifiers silently |

**⚠️ The code change alone does not close `BUG-001`.** Registered command schemas live on
Discord's side. Shipping requires **both**:

1. `pnpm --filter xivdyetools-discord-worker run deploy:production`, then
2. `pnpm --filter xivdyetools-discord-worker run register-commands`

Until step 2 runs, the stale choice stays visible in every Discord client regardless of what the
Worker code says. **Step 2 is the actual fix**, and it is user-run per the project's deploy
process.

**Ends with:** one `@xivdyetools/test-utils` version bump (workspace-private, no publish), one
`discord-worker` deploy, and one `register-commands` run.

---

## Sprint 3 — `presets-api`: close the CORS gap its own docs describe

Both findings are in one middleware block, one file, one review.

`FINDING-002` is the substantive one: the localhost origin allowlist has **no environment
guard**, so production `api.xivdyetools.app` reflects `Access-Control-Allow-Origin` for four
loopback origins with `credentials: true`. The code contradicts both its own inline comment
("*Only allow specific localhost ports in development*") and `apps/presets-api/CLAUDE.md`. The
sibling `oauth` Worker already solved exactly this as `OAUTH-SEC-001` — the fix was applied
instance-by-instance and never mirrored here.

| ID | Source | Sev/Pri | Item |
|----|--------|---------|------|
| [FINDING-002](findings/FINDING-002.md) | security | MED / **INTERNET-UNAUTH** / P2 | Wrap the loopback allowlist in `if (env.ENVIRONMENT === 'development')`, mirroring `OAUTH-SEC-001`. Add a regression test asserting `null` for `localhost:5173` under `ENVIRONMENT: 'production'` |
| [FINDING-005](findings/FINDING-005.md) | security | LOW / INTERNET-UNAUTH / P3 | Drop `X-User-Discord-ID` / `X-User-Discord-Name` from CORS `allowHeaders`. **Not exploitable** — both are gated behind a valid HMAC signature — but browsers never legitimately send them, and leaving the permission in place is a trap for a future refactor |

**While here, close the class rather than the instance.** This finding exists because
`OAUTH-SEC-001` was fixed one file at a time. Confirm — do not assume — that no other Worker
has the same omission. `api-worker` is fine (`origin: '*'` but `credentials: false`,
read-only); `discord-worker` uses a static production-only array.

**Ends with:** one `presets-api` deploy.

---

## Sprint 4 — `web-app`: conformance drift and stale artefacts

The largest sprint, and the one that reveals this release's dominant risk shape. Seven of the
ten deep-dive findings sit in `web-app`, and every one is the same story: **a decision that
landed on the bot/SVG surfaces and was never mirrored to the web surface.**

`BUG-002` is the anchor. Habibi was retired in 5.0 for a measured reason — it is a proportional
display serif, so digits have unequal advance widths and numeric columns do not align.
`packages/svg` and both graphics Workers moved to Fragment Mono; `discord-worker` even keeps a
`RETIRED_FONTS` guard. `web-app`'s `globals.css` still force-applies it to `.number` /
`.font-numeric` with `!important`, across 10 live call sites in the Extractor, Gradient, Mixer
and Swatch tools. The result is that **the same ΔE value looks worse on the web than on the
bot** — precisely the cross-surface inconsistency the 5.0 vocabulary work set out to end.

Three orphaned-file findings all trace to one event — the Vite `root: 'src'` move — and
together they leave `public/_headers` as the **single** CSP source of truth, replacing today's
three drifting copies.

| ID | Source | Sev/Pri | Item |
|----|--------|---------|------|
| [BUG-002](bugs/BUG-002.md) | deep-dive | MED / P2 | Repoint `.number` / `.font-numeric` at Fragment Mono; add `font-variant-numeric: tabular-nums`; drop the `!important` |
| HC-004 | i18n | MED / P2 | `preset-detail.ts:880` renders the raw enum slug `grand-companies` to users. Route through a locale key — reuse the existing `labelKey` convention from `preset-submission-form.ts:363` |
| HC-002, HC-003 | i18n | MED / P2 | `preset-detail.ts:993,995` hardcode `Voted (n)` / `Vote (n)`. **Keys `preset.voteCount` / `preset.votesCount` already exist in all six locales** — authored, shipping, never called. Also fixes missing plural handling |
| HC-001 | i18n | MED / P2 | `preset-detail.ts:981` hardcodes `Copy Link`. Needs one new key ×6 |
| [BUG-003](bugs/BUG-003.md) | deep-dive | LOW / P3 | `config-sidebar.ts:1565` — `parseInt` on a 19-digit Discord snowflake exceeds `MAX_SAFE_INTEGER` and rounds, so `% 5` picks the wrong default avatar. Use `BigInt`; return `null` for absent IDs instead of masking with `\|\| '0'` |
| [REFACTOR-001](refactoring/REFACTOR-001.md) | deep-dive | MED / P3 | `theme-color` / `msapplication-TileColor` still declare indigo `#4F46E5`; 5.0 is `#CE2222` light / `#EA4133` dark. User-visible in PWA chrome and pinned tiles. Sweep `manifest.json` and `browserconfig.xml` in the same pass |
| REFACTOR-004 | deep-dive | LOW / P3 | `v4-layout.css:29` uses a raw `Segoe UI, Tahoma, Geneva, Verdana` stack that renders differently per OS and matches nothing else |
| REFACTOR-005 | deep-dive | LOW / P3 | `globals.css` still headed "v2.0.0"; the `.number` doc comment describes the retired behaviour |
| [DEAD-001](findings/DEAD-001.md) | dead-code | HIGH/NONE / P3 | Delete the orphaned `apps/web-app/index.html` (22.7 KiB) — unreachable since Vite `root: 'src'`, and a live edit trap |
| [DEAD-002](findings/DEAD-002.md) | dead-code | HIGH/NONE / P3 | Delete `apps/web-app/fonts/` — 28 unreferenced woff2 (640 KiB), outside both `src/` and `publicDir` |
| [DEAD-003](findings/DEAD-003.md) | dead-code | HIGH/NONE / P3 | Delete `netlify.toml` — v2.0.0-era config for a platform this app does not deploy to, carrying a third CSP copy and an `npm run build` that is wrong for a pnpm workspace |
| DEAD-007 | dead-code | MED/NONE / P3 | Resolve 3 skipped legacy E2E suites — rewrite against the 5.0 DOM (as `ed8f477` did for `ui-interactions`) or delete. `color-matcher.spec.ts` self-documents that its coverage moved to the v4 extractor suite: a clean delete |

**Sequencing inside the sprint:** land `DEAD-001`/`002`/`003` as **one clearly-labelled
cleanup commit** ("one CSP source of truth; drop the orphaned entry, the orphaned fonts and the
Netlify config") before the `BUG-002` font change. Deleting orphaned fonts and then adding an
intentional font in the same commit produces a diff nobody can read.

**Do not delete the live Habibi asset in this sprint** — it is a cascade
(`DEAD-004`, Sprint 5).

**Ends with:** one Cloudflare Pages deploy.

**Gate:** full suite + `playwright test` + a manual pass confirming numeric columns align and
the PWA installs with the red identity.

---

## Sprint 5 — `web-app`: font consolidation (the structural refactor)

Terminal structural work, deliberately last among the `web-app` sprints because it reshapes
files Sprint 4 touches.

Today four sources declare the web app's typefaces and **no two agree**: `load-fonts.js` fetches
Space Grotesk / Onest / Fira Code / Varela Round from Google Fonts; the `<noscript>` fallback
downloads Inter / Outfit / JetBrains Mono, which **no CSS rule references**; `globals.css` names
a fifth combination; `v4-layout.css` a sixth. Self-hosting collapses all of it — the families
already exist in-repo — and makes the divergence structurally impossible rather than merely
fixed.

| ID | Source | Sev/Pri | Item |
|----|--------|---------|------|
| [REFACTOR-002](refactoring/REFACTOR-002.md) | deep-dive | MED / P2 | Establish one font contract; self-host Space Grotesk / Onest / Fragment Mono; delete `load-fonts.js` and the `noscript` block; tighten CSP `style-src`/`font-src` to `'self'`; drop 4 third-party preconnect/dns-prefetch hints; **add an explicit CJK family** to the body and heading stacks |
| DEAD-004 | dead-code | HIGH/LOW / P3 | **CASCADE — trigger is `BUG-002` (Sprint 4).** Delete `public/fonts/habibi-…woff2` and its `@font-face`. Only becomes dead once `.number` is repointed |

**Why `DEAD-004` is not in Sprint 4:** the asset is *live* until `BUG-002` lands. Deleting it in
the same sprint would mean a broken-font regression could have come from either change. Split
across sprints, the bisect target is one commit.

**Risk note:** font swaps change metrics, and this project's layouts are measurement-sensitive.
Verify against **JA and DE** specifically — the design record warns they *"fail by different
mechanisms"*. Keep `font-display: swap` so a failed self-host degrades to system fonts rather
than invisible text.

Completing this sprint also subsumes `OPT-002` (runtime third-party font fetch), yielding a real
LCP and privacy win: no Google Fonts request per visitor.

**Ends with:** one Cloudflare Pages deploy.

---

## Sprint 6 — Repo-wide: dev toolchain maintenance

Deliberately separate from every Worker deploy. These packages change **build behaviour**, so
they deserve their own verification gate rather than riding a sprint whose failure signal should
mean something else.

| ID | Source | Sev/Pri | Item |
|----|--------|---------|------|
| [FINDING-004](findings/FINDING-004.md) | security | LOW / **LOCAL** / P3 | `vite ≥ 6.4.3`, `esbuild ≥ 0.28.1`, refresh `wrangler`/`miniflare` (pulls `undici ≥ 7.29.0`). Closes the Windows `server.fs.deny` bypass and the `launch-editor` NTLMv2 hash disclosure — both Windows-specific, and this project's primary dev platform is Windows |

Until this lands, the cheap mitigation is: **do not browse untrusted sites in the same browser
profile while a dev server is running.**

**Ends with:** no deploy — a verification gate only. Run `pnpm turbo run build type-check test
--force` plus the `web-app` Playwright suite, since bundler upgrades can shift output.

---

## Sprint 7 — TERMINAL: `discord-worker` CJK font re-subset

**The last sprint, unconditionally.**

`FONT-001` is the highest user-impact finding in the whole audit — 128 glyphs missing across
three subsets, rendering tofu mid-sentence for ja, ko and zh users. The missing characters are
not exotic: 読 / 读 ("read"), 測 ("measure"), 線 ("line"), 번 ("number"), 차 ("difference") —
ordinary vocabulary for a colour-measurement tool. **At least 112 of the 128 have no fallback**:
the sibling SC/JP subsets lack them too, and `NotoSansKR-Subset.ttf` is the only Hangul font
loaded.

| ID | Source | Sev/Pri | Item |
|----|--------|---------|------|
| [FONT-001](i18n/FONT_SUBSET_AUDIT.md) | i18n | **HIGH / P1** | Re-run `apps/discord-worker/scripts/subset-cjk-fonts.py`; verify coverage with the script in the finding; check the CJK size budget; deploy |

### Why the highest-impact finding goes last

Subsets are **derived artefacts of the locale files**. Any change to the strings they are cut
from invalidates every subset, so re-subsetting before the text is final means doing it twice.

Worth being precise about the reason here, because it is not this plan's own sprints:
`discord-worker`'s subsetter reads only `packages/core` + `packages/bot-logic` locales, and
**no sprint above touches either tree** — Sprint 4's `HC-*` work adds keys to `web-app`, a
different tree the Worker never renders.

The binding constraint is **pending work outside this audit**. The 5.0 design record still lists
unlanded bot strings: the curated-preset locale keys (`preset.<id>.*`) that ride the
`presets.json` stainID migration, and `/preset`'s post-backend strings. Cutting subsets before
those land guarantees a re-cut.

**Before running the subsetter, confirm no outstanding bot string work remains.** If the
curated-preset keys are still pending, this sprint waits for them.

**Size check:** the three subsets already total **1,577 KiB** against the record's stated
~1.3 MB budget. Re-subsetting also *drops* stale glyphs, so the total may fall — but if it lands
materially above ~1.6 MB, treat the budget as needing an explicit re-decision rather than
silently exceeding it. Workers have a bundle-size limit and fonts are the largest contributor.

**Ends with:** one `discord-worker` deploy. Verify by rendering a ja, ko and zh card on staging
and reading them — this is the one finding no automated test in the repo can catch, because the
41 `discord-worker` test files assert SVG *structure*, and glyph coverage is a property of the
rasteriser plus the font binary.

---

## Superseded Findings

| ID | Superseded by | Why |
|----|---------------|-----|
| OPT-001 | `DEAD-002` (Sprint 4) | Same 640 KiB of unreferenced fonts, filed from two angles. The dead-code finding carries the full removal procedure; scheduling both would double-count the work |
| OPT-002 | `REFACTOR-002` (Sprint 5) | Eliminating the runtime Google Fonts fetch *is* the self-hosting refactor. Not a separate action |
| FINDING-006 | `DEAD-001` (Sprint 4) | Informational — CSP is correctly delivered via `public/_headers`, which is *stronger* than the meta tag it replaced (`frame-ancestors`, `upgrade-insecure-requests`). **No security gap.** The orphaned file carrying the stale meta CSP is removed as dead code |
| FINDING-007 | `DEAD-003` (Sprint 4) | Informational — the drifting CSP copy in `netlify.toml` disappears with the file |

## No Action Required

| ID | Finding | Verdict |
|----|---------|---------|
| FONT-002 | `og-worker` CJK subsets | **Verified complete** — 368/368 zh, 272/272 ko Hangul. The 10 apparent ja gaps are Simplified Chinese characters, confirmed present in og-worker's SC subset (the documented ja fallback). Do not touch these fonts |
| I18N-001 | 122 `preset.*.tags[N]` "missing" entries | **Non-finding** — tag lists are authored per locale (en 4, others 2–3), confirmed by the design record and consumed safely via `.map()`/`.some()` with no fixed indexing. Recorded so the next audit does not re-file it |
| I18N-002 | 62 untranslated-looking values | **Non-finding** — all brand names, standards identifiers (`WCAG AA`), method tags (`ΔE76 · CIE 1976`), true cognates, or command literals. All correct per the design record's rule that identifiers never localise |

## KEEP Register (not scheduled)

| ID | Item | Reason to Keep | **Revisit Trigger** |
|----|------|----------------|---------------------|
| DEAD-008 | 7 `it.skip` in `presets-api` tests (`presets.test.ts` ×4, `auth.test.ts` ×3), each labelled *"requires Cloudflare Workers"* | **Not stale — environment-gated.** They cover real, valuable paths (preset creation, Service-Binding notification fan-out, JWT auth) that need the `workerd` runtime rather than Node. Deleting them would destroy an accurate record of what is deliberately untested locally | **When `presets-api` adopts `@cloudflare/vitest-pool-workers`** (or an equivalent `workerd` pool), un-skip all seven and confirm they pass. If that migration is declined, convert them to documented integration tests run against `wrangler dev`. Do not leave them skipped indefinitely without one of those two outcomes |

## Not Scheduled — Parked Surface

| ID | Item | Why unscheduled | Revisit trigger |
|----|------|-----------------|-----------------|
| [FINDING-003](findings/FINDING-003.md) | `seroval` **CRITICAL** advisory via `revolt.js` → `stoat-worker` | The app is **parked and undeployed** (design record: *"nothing waits on it"*). Unreachable code cannot be exploited; the vulnerable `fromJSON()` path is Solid's SSR hydration, which this codebase does not use. Bumping `revolt.js` on a parked surface spends regression risk for zero benefit | **Before any `stoat-worker` deploy**, re-run `pnpm audit` and resolve every advisory in its tree. Add this to the un-parking checklist |

---

## Standing guidance while executing

- **Verify each finding's evidence against reality before coding.** Findings are leads, not
  gospel. This audit corrected its own font analysis mid-flight — the first pass pooled all
  three locale trees and reported ~1,500 missing glyphs; scoped to each subsetter's real inputs
  the true figure is 128 and `og-worker` is clean. Apply the same scepticism.
- **Run the verification gate at every sprint boundary, not once at the end** — a failed sprint
  is then the smallest possible bisect target:
  `pnpm turbo run type-check test --force` (expect 24/24 each), `pnpm turbo run build`,
  `pnpm turbo run lint`, plus `playwright test` for any `web-app` sprint.
- **Every sprint touching a publishable package ends with a version bump**; batch the publishes
  through the OIDC `workflow_dispatch` workflow. The `detect` job only publishes when the local
  version differs from npm — with versions at parity it does nothing.
- **`BUG-001` needs `register-commands`, not just a deploy.** A registered schema lives on
  Discord's side; the code change alone does not close it.
- **Fix the class, not the instance.** Six of this audit's findings exist because a suite-wide
  decision was applied one file at a time — `OAUTH-SEC-001` in `oauth` but not `presets-api`,
  Fragment Mono in `svg` but not `web-app`, subsets re-cut for `og-worker` but not
  `discord-worker`. The design record already prescribes the cure: *"Fix the class, not the
  instance; enumerate siblings … and edit them together."* Adopt a grep-all-surfaces step when a
  suite-wide decision lands.
- **Re-run the source audits after each sprint** — fixes and removals unlock new findings.

## Suggested CI additions (prevent recurrence)

Not findings, but each one would have caught something in this audit the day it landed:

| Check | Would have caught |
|---|---|
| `pnpm audit` as a non-blocking CI report | `FINDING-001`, `FINDING-004` |
| Font-coverage assertion (locale codepoints ⊆ subset cmap) | `FONT-001` — the highest-impact finding, and the one most likely to recur since every locale edit invalidates subsets |
| i18n parity check (the ~120-line script in `evidence/`) | Duplicate keys, dropped `{count}` templates. Configure `preset.*.tags` as variable-length so `I18N-001` is not re-reported |
| `knip` as a non-blocking report | `DEAD-001`/`002`/`003` and any unused export this manual pass could not exhaustively cover across 253k lines |
| ESLint `lit/no-literal-text` scoped to `components/` | `HC-001…004`. With only 4 violations repo-wide, this can go straight to `error` |
