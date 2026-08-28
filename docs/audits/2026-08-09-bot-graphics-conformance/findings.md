# Bot Graphics Redesign — Design/Implementation Conformance Audit

**Date:** 2026-08-09
**Scope:** the shipped bot graphics against the six confirmed Claude Design documents
**Design source:** project `993f0c5c-05b9-439b-8047-66a9c5ab1bd6` — Turns 11–14 (card vocabulary and every generator), Turn 17 (embed shell), and the 2026-08-07 Swatch/banner-glyph turn
**Outcome:** 13 deviations found, all remediated. Both open questions resolved 2026-08-09 (§D). Workspace green: 57/57 turbo tasks (build · test · type-check · lint).

---

## Summary

The two layers of the redesign diverged very differently.

**The card layer is a high-fidelity port.** `packages/svg/src/frame.ts` encodes the 400 px canvas, the 350 px ceiling, the 11/13/16 type floor, the `measuredRow` five-slot abstraction and the app-icon footer exactly as confirmed. Every generator's docblock names its frame ID, the routers (`/contrast`, `/compare`, `/accessibility`) route on the inputs the design specified, and all 81 `card.*` locale keys exist in all six languages. Four deviations, one of them substantive.

**The embed shell was essentially unimplemented.** Turn 17's headline decision — *fix the shell first*, one shared `#EA4133` accent replacing `COLORS.blurple` — had not happened. Blurple was declared independently in five files and appeared as a bare literal in three more. Six deviations.

One finding sits outside both: a **type-floor breach in `/compare`** that no existing test could see, found by a guard written during this audit.

---

## A · Card layer — `packages/svg`

### A1 · Harmony was frozen at superseded Turn-11 geometry — FIXED

**Severity: high.** The only place where a *later design turn overrode an earlier one and the code kept the earlier*.

Turn 11 drew 11A at 400 × 390 with 55 px rows capped at three. Turn 13 re-measured it against a square harmony and corrected it on five counts — the code carried none of them:

| | Turn 11 (shipped) | Turn 13 (confirmed) |
|---|---|---|
| Frame | 400 × 390 — **breaks the 350 ceiling** | 400 × ≤350 |
| Slot row | 55 px, cap 3 | **39 px, cap 4** (44.9 px spare measured) |
| Base row | swatch + name + hex line | hex line **dropped** — the pair implies it, and that line pays for the verdict |
| Slot lead | none | the **angle** the maths asked for (90° / 180° / 270°) |
| Verdict | none | `↓ 270° · name · value` — a glyph, because "weakest slot" overran the row in German |
| Method | never printed | printed wherever a tier or verdict appears |
| Column header | none | `IDEAL HUE → NEAREST DYE` |
| Slot ΔE | hardcoded `'ciede2000'` even when the search ran another method | follows the chosen method |

Turn 13 also **corrected the verdict's content**: Turn 11's "a triadic from a saturated red has no answer in this game" is contradicted by the real dye pool (Cactuar Green 11.19, Dragoon Blue 5.97). Since the shipped card printed no verdict at all, the wrong claim never reached a player — but the geometry it was drawn on did.

**Fixed:** [harmony-card.ts](../../../packages/svg/src/harmony-card.ts) re-cut; `HARMONY_ROW_CAP` 3 → 4 in [frame.ts](../../../packages/svg/src/frame.ts); [bot-logic/harmony.ts](../../../packages/bot-logic/src/commands/harmony.ts) now derives the angle per slot, scores in the chosen method, and composes the weakest-slot verdict.

**Measured after the re-cut** (DE, longest real names, worst case):

| slots | ΔE2000 | off-default method |
|---|---|---|
| 1 | 227 | 241 |
| 2 | 266 | 280 |
| 3 | 305 | 319 |
| **4** | **344** | **344** |
| 5 | 346 (tail strip) | 346 (tail strip) |

344 at four slots is the design's own "about 6 px spare". At four slots an off-default method drops the *derived-note* footer line rather than the verdict — the method **tag** in the ΔE column header is the load-bearing half (it is what stops two players comparing tiers that were never comparable); the line explaining the derivation is the gloss.

---

### A2 · `contrastRatio` re-implemented in the SVG package — FIXED

Doc 4 (14A): the contrast ratio *"moves to `core` with the rest … all seven must land in **one** shared vocabulary or the bot disagrees with the app about what ΔE means."*

`packages/svg/src/contrast-card.ts:94` carried a second implementation alongside `ColorAccessibility.getContrastRatio` in core — the same class of defect as the two hardcoded 4.5/7 ladders the redesign removed.

**Fixed:** now re-exports `ColorService.getContrastRatio`.

---

### A3 · `abbreviateDyeName` duplicated instead of shipping in core — FIXED

Doc 4 (14C) is explicit: *"It must ship in `core`, not be re-derived here."* Two identical copies existed, in `bot-logic/commands/comparison.ts:52` and `bot-logic/commands/contrast.ts:57`.

The order of operations is the reason it must be shared:

1. **Uppercase before slicing** — `'ß'.toUpperCase()` is `'SS'`, two characters, so slicing first yields a four-character code for German names.
2. **Strip punctuation** — `Ul'dahbrauner` must abbreviate to `ULD`, not `UL'`.
3. **CJK keeps its first three characters**, uncased.

**Fixed:** one `abbreviateDyeName()` in [core/utils](../../../packages/core/src/utils/index.ts), exported from core's index, with six tests covering exactly those cases. Both call sites import it.

---

### A4 · `preset-swatch.ts` carried every defect doc 4 said to fix regardless — FIXED

`/preset`'s redesign is correctly **deferred** — not between frames, but on whether the command survives 5.0, which is a product call. Doc 4 was equally explicit that the deferral does not cover the defects: *"the **defects** are real in shipped code today … and they are cheap fixes whether or not the command is redesigned."*

| Defect | Was | Now |
|---|---|---|
| Centred header measured nothing | six `textAnchor: 'middle'` on unmeasured strings | measured against the content box |
| Description cut | `maxDescLength = 60` **Latin characters** | pixel budget |
| Dye name cut | `Math.floor(width / 7)` — pixels ÷ one Latin character, so CJK overran by ~2× | pixel budget |
| Latin-only font stack on localized strings | `FONTS.primary` | `FONTS.primaryCjk` |

Still deferred with the command, and recorded as such in the module docblock: the 600 px canvas (against the suite's 400 × 350 budget), the proportional band, and localized category names. `generateCompactPresetSwatch` was already correctly deleted.

---

### A5 · The shared `THEME` still carried the deleted navy palette — FIXED

Turn 11: **"PALETTE — THEME REPLACED WHOLESALE."** `ACCENT` had been updated to `#EA4133`, but the rest of `base.ts`'s `THEME` was untouched, so `preset-swatch` — its only consumer — still drew on `#1a1a2e`, *"a navy that appears nowhere else we make"*.

| token | was | now |
|---|---|---|
| `background` | `#1a1a2e` | `#17171A` |
| `backgroundLight` | `#2d2d3d` | `#141416` |
| `text` | `#ffffff` | `#ECECEE` |
| `textMuted` | `#909090` | `#9C9CA2` |
| `textDim` | `#666666` | `#86868C` |
| `border` | `#404050` | `rgba(255,255,255,0.07)` |

`apps/og-worker` keeps its own local `THEME` and was not affected.

---

### A6 · `packages/svg/CLAUDE.md` documented a package that no longer exists — FIXED

It described `harmony-wheel.ts`, `contrast-matrix.ts`, `accessibility-comparison.ts`, `comparison-grid.ts`, `budget-comparison.ts`, `generateCompactPresetSwatch`, `FONTS.mono = 'Habibi'` and the blurple `THEME` — every one retired by this redesign. An agent reading it would have built against a package that has not existed for a release.

**Fixed:** rewritten around the frame system, with the four load-bearing constants, the `measuredRow` contract, the rules that are not stylistic preferences, the three band calibrations, and a frame-ID map for all thirteen generators.

---

### A7 · `/compare` broke the type floor — FIXED (found by a new guard)

**Not in any design document — found by writing the check the design implies.**

Two places in `comparison-card.ts` drew at **9.5 px** against an 11 px floor:

- the per-cell tier tag in the 14C triangle (6 cells at four dyes)
- the seven readout labels in the 14A duel

11 px is the wall the whole redesign is built on: the v4 cards drew 8–9 px labels into a 0.5× reduction and arrived at 4–5 px on screen. No existing test could see this, because each generator's own test asserts its own content.

**Fixed:** both raised to `CARD_TYPE.label`, and fitted to their column rather than trusted (`REDMEAN` is the widest label in the duel strip and clears a 52 px column by ~2 px).

**Guard added:** [frame-budget.test.ts](../../../packages/svg/src/frame-budget.test.ts) sweeps nine card configurations — every generator, in German, at its densest case — and asserts (a) 400 wide, (b) height ≤ 350, (c) no `font-size` below 11, (d) the constants themselves have not drifted. 21 assertions.

---

### A8 · The font-bundle checker was stale — FIXED

`scripts/test-font-rendering.ts` still required `Habibi-Regular.ttf` (retired in 5.0) and looked for a full `NotoSansSC-Regular.ttf` rather than the subset that actually ships. Rewritten to check the real six-font bundle in fallback-chain order, warn on retired fonts, and state the two ordering constraints (JP **before** SC or Japanese renders in Chinese letterforms; KR **after** SC because SC has zero Hangul glyphs).

---

## B · Embed shell — `apps/discord-worker` (Turn 17)

### B1 · `COLORS.blurple` was still spending our only branding on the platform — FIXED

Turn 17's core finding, verbatim: *"the embed accent bar is the only branding an embed has, and we are spending it on the platform. One shared constant at the app's `#EA4133`, imported."*

Found in **eight** files — five declarations plus three bare literals:

`about.ts:17` · `manual.ts:25` · `stats.ts:28` · `announcements.ts:14` · `preferences.ts:42` · `preset.ts:220,892` · `dye.ts:107,257,275`

**Fixed:** new [utils/brand.ts](../../../apps/discord-worker/src/utils/brand.ts) exports `BRAND_ACCENT` plus a `STATE` vocabulary (`confirm` / `error` / `success` / `warning` / `neutral`). Every embed the product owns imports the accent; colour is reserved for state. Zero `0x5865f2` remain in source.

### B2 · `/manual` spent five decorative colours — FIXED

blurple / green / yellow / fuchsia / blue, one per section, signalling nothing — *"colour spent where it carries no signal, in an app where green already means two contradictory things."* All five now take the one accent.

### B3 · The Square Enix attribution was absent — FIXED

Design: *"the one piece of that modal that does not degrade gracefully by being absent."* `/about` had no attribution field at all.

**Fixed:** an `⚖️ Attribution` field, last and never conditional. The notice ships **verbatim in every locale** for the same reason the Spectrum item name does — a trademark notice is a fixed string, and a loose translation of one is worse than the original. Only the field label localizes.

### B4 · `/about` structure — FIXED

Added: `Version` and `Dyes` inline fields (the dye count read from `dyeDatabase`, not hardcoded), `Built on` (Universalis · spectral.js), `⚖️ Attribution`, and the full link set.
Already correct: the registry-driven roster, `Removed in v5`.

**The links (resolved 2026-08-09).** The confirmed frame shows seven social links; the bot had four, one of which pointed at `xivdyetools-discord-worker` — a repo the project left behind when it moved into the monorepo. The web app's About modal already shipped the canonical seven.

Rather than copy them into the bot — the exact drift class this audit is about — they now have **one home**: [`packages/core/src/config/product-links.ts`](../../../packages/core/src/config/product-links.ts) exports `SOCIAL_LINKS` (the seven) and `PRODUCT_LINKS` (Web App, Invite Bot — the bot prints these because a Discord reader has no other route in; the web app does not, because a modal linking to the page it is drawn on says nothing). Icons stay with the surface that draws them: the web app maps its SVG set onto the shared labels, the bot renders markdown.

The rendered field is 444 characters against Discord's 1024 cap, and `about.test.ts` now asserts every entry by label *and* URL, so a change in core fails loudly here.

```
[Web App] • [Invite Bot] • [GitHub] • [X/Twitter] • [Twitch] • [Bluesky] • [Discord] • [Patreon] • [Ko-fi]
```

**One deliberate departure remains, recorded rather than silently taken:** the frame groups commands as Colour / Analysis / Data&nbsp;&&nbsp;community / Utility; the code groups by the five `COMMAND_REGISTRY` categories. Registry-driven is kept because *that* is the property that stops drift — it is what the parity test asserts — and those labels already ship in six languages. `Build` date is still omitted: no build-date stamp exists to read.

### B5 · The announcement truncated silently — FIXED

Cut at 4000 characters mid-bullet behind a bare `...`. Design: with `/changelog` shipped the announcement *"can afford to be a summary that links out — but it must say it is one."* Now cuts on a line boundary and appends *"Summary shown — run `/changelog` for the full notes."*

### B6 · Destructive-confirm collision — FIXED

Our `#EA4133` and Discord's fixed danger red `#DA373C` are four hex points apart, so an accent bar above a Reject button reads as one colour carrying two meanings. Button styles are fixed on this platform, so the fix moves to the bar. Codified as `STATE.confirm` and applied to the moderation embed, which carries the destructive buttons.

### B7 · KV migration — NOT A DEVIATION

The doc assumed `favorites:*` / `collection:*` / `language:*` should migrate into `preferences:*`. The shipped answer is better and already in place: `language` and `budget:world` fold into `prefs:v1:*` on first read; favorites/collections deliberately do **not** migrate because no v5 bot feature replaces them (saved things live in the web app's CollectionService), and `scripts/cleanup-v4-kv.ts` emits reviewable delete commands rather than deleting anything itself. **Resolved differently, and correctly.**

---

## C · Test-suite defects found while verifying

Three `discord-worker` tests were failing before this audit began, and all three were **one bug wearing three hats**: partial `vi.mock` factories.

`vi.mock('@xivdyetools/core', () => ({ DyeService, ColorService }))` replaces the *entire* module. Any symbol the code under test imports but the factory omits becomes `undefined`; calling it throws; the throw lands in a generic `catch`; the handler returns `GENERATION_FAILED`. So `expect(generateComparisonCard).toHaveBeenCalledWith(...)` saw **zero calls** — the assertions were vacuous rather than merely failing, and two commands' render paths had no real coverage.

Fixed with `async (importOriginal) => ({ ...(await importOriginal()), ...overrides })` in `harmony.test.ts` and `comparison.test.ts`, plus a real KV stub (the handlers read stored preferences before rendering, and `{} as KVNamespace` throws on `kv.get`).

Also fixed: a pre-existing `no-unnecessary-type-assertion` error in `core/src/config/facewear.ts` that was failing `turbo run lint` for the whole workspace, and therefore blocking CI for everything above.

---

## Landed correctly before this audit

Worth stating, because the port mostly succeeded:

`/changelog` with `parseAll()` and the brand accent · the root `CHANGELOG-laymans.md` path (the reason the announcement webhook had never fired) · registry-driven `/about` roster · JP subset font in **both** workers · Fragment Mono in, Habibi out · `/match` and `/match_image` deleted · the full option surface (`matching:` / `vision:` / `order:` / `slot:` / `exclude_coffers` / `exclude_wide_spectrum`) · the card `theme` preference defaulting to dark · `generateCompactPresetSwatch` deleted · all six new detail glyphs · all 81 `card.*` locale keys present in all six languages · every router (`/contrast` 2/3/4, `/compare` 2/3/4, `/accessibility` by `vision:`) matching its confirmed frame · the gradient card's three cap stages · the extractor band's minimum-slice floor · the budget ledger's group-level pricing and ΔE2000-pinned ratio.

---

## Verification

```
pnpm turbo run build test type-check lint     →  57/57 tasks successful, 0 errors
```

| package | tests |
|---|---|
| `@xivdyetools/core` | 138 (utils, incl. 6 new for `abbreviateDyeName`) |
| `@xivdyetools/svg` | 180 (incl. 22 new frame-budget assertions) |
| `@xivdyetools/bot-logic` | 267 (incl. 3 new harmony conformance tests) |
| `xivdyetools-discord-worker` | 793 |
| `xivdyetools-web-app` | 2092 |

Card geometry was measured programmatically rather than eyeballed — heights per slot count are in A1, and `frame-budget.test.ts` now asserts the width, ceiling and type floor for every generator on every run.

## D · Resolved 2026-08-09

### D1 · The social links now have one home

See B4. The URLs moved to `@xivdyetools/core`; both surfaces consume them; the bot's stale pre-monorepo GitHub link is gone.

### D2 · The tier ramp is the Turn 13/14 set

The design set disagreed with itself. **Turns 13/14 win**, and the reason is not recency — it is that `#5bbd68 · #8bc34a · #ffc107 · #f4645a` is already the shipped ramp in `frame.ts` *and* in eight web-app components (`budget-tool`, `chara-import`, `comparison-tool`, `gradient-tool`, `metric-help`, `mixer-tool`, `result-card`). It is what a player has learned to read, and a two-frame revision does not outrank a suite-wide convention. No code change was needed — the ramp was already correct.

**What did need saying is the part that would have caused the next mistake.** The Swatch doc's `#F4BF4F` is *not* a retired tier colour, and sweeping it into the ramp would have been the wrong fix. It is the separate **state** amber, and it is in active, correct use in six places: OFF&nbsp;GRID on the swatch card and importer, the vendor-cheaper flag, the awaiting-review count, and (added by this audit) the destructive-confirm bar.

> A tier answers *"how close is this?"* — a state answers *"something here needs your attention."* They are allowed to look similar. They are not allowed to be the same token.

Recorded in three places so it cannot be re-litigated: a docblock on `CardTheme.tiers`, the band section of `packages/svg/CLAUDE.md`, and an assertion in `frame-budget.test.ts` that pins both ramps and explicitly rejects `#F4BF4F` and `#9ecf5e`.

`#9ecf5e` appears nowhere in the codebase — the Swatch revision never leaked in.

---

## Open

1. **Deploy sequence.** Version bumps and npm publishes for `core` → `svg` → `bot-logic`, then the worker deploy. `web-app` also now imports from `core`, so it rebuilds against the new version. No schema changes, so `register-commands` is not required by this work.
2. **Not audited, worth a glance:** `apps/web-app/src/components/mixer-tool.ts:1154` reverses the ramp for its spread readout (`['#8a877f', '#8bc34a', '#ffc107', '#5bbd68']`) while its comment says "a wide spread is the notable state". Under the `separation` context tier&nbsp;0 is the *widest* spread, so the grey and the green may be the wrong way round. Different tool, different semantic, outside this audit's scope — flagged rather than guessed at.
