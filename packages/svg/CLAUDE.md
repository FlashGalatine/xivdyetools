# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package Overview

`@xivdyetools/svg` is a collection of **pure SVG card generators**: each top-level export takes data (dyes, colors, options) and returns an SVG **string**. The package never touches the filesystem, never opens a network connection, and never rasterizes — turning the SVG into a PNG (via `resvg-wasm`, `@resvg/resvg-js`, or any other rasterizer) is the consumer's responsibility. That boundary keeps it safe for Cloudflare Workers, Node bots, and any other runtime.

Since 5.0 the cards are **not free-form drawings** — they are compositions of one shared vocabulary defined in `frame.ts`. Read that file before changing any generator.

## The frame system — read this first

The whole redesign rests on one measurement: **the canvas width IS the display width.** The v4 generators drew at 500–800 px into a ~400 px Discord embed box, so every card arrived at a different reduction (0.5× / 0.67× / 0.8×) and the same "11 px label" meant four different physical sizes depending on which command you ran.

Four constants encode the fix. Changing any of them changes every card:

| Constant | Value | Why |
|---|---|---|
| `CARD_WIDTH` | `400` | Discord's embed image box. Draw here, raster at 2× for sharpness. |
| `CARD_MAX_HEIGHT` | `350` | **A wall, not a guideline.** Past 350 the client contracts the box *horizontally*, so a taller image is served narrower than 400 and every type size in it shrinks again. |
| `CARD_TYPE` | `{ label: 11, value: 13, name: 16 }` | The type floor. Nothing below 11 px, ever. |
| `ROW_CAP` | `5` | R1 Cap: every list graphic holds five rows at full size. The tail is a swatch strip plus a count in the **embed**. |

`HARMONY_ROW_CAP` is `4` — harmony's taller 39 px slot rows. (Turn 11 asserted three at 55 px on a 400 × 390 frame that broke the ceiling; Turn 13 re-measured and corrected it. Base + four slots renders at 344 px.)

**Height grows with the result and stops at the ceiling.** A three-dye `/dye random` is a *shorter* image than a five-dye one; a gradient whose endpoints have no interior gets shorter still. 350 is a ceiling, never a size — an over-tall frame makes the type smaller for no content.

### Shared primitives (`frame.ts`)

```ts
CARD_WIDTH, CARD_MAX_HEIGHT, CARD_TYPE, ROW_CAP, HARMONY_ROW_CAP
CARD_DARK, CARD_LIGHT, cardTheme(mode)          // light ships via /preferences
cardShell(height, theme, content)               // rounded surface + inset hairline
cardText(x, y, content, opts)                   // font stacks incl. CJK fallback
textWidth(content, size, font)                  // CJK counts 2× (estimateTextWidth)
fitText(content, maxPx, size, font)             // ellipsise to PIXELS, never a char count
commandChip(x, y, label, theme, { glyph, onDye })  // the pill; the tool glyph rides INSIDE it
appIcon(x, y, size) / markFooter(rightX, y, theme) // bottom-right, never centred
swatch(...) / idealSwatch(...)                  // solid = buyable · outlined = the maths' ideal
measuredRow(x, y, rowH, opts)                   // the suite's five-slot list row
dashedRule / hairline
```

**`measuredRow` has no variants and no optional slots.** Lead value · butted source→dye pair · name · tier bar · measure — every argument required. Only the lead's *meaning* varies (step, share, rank, slot label), which is a label the caller passes, not a branch. A consumer that cannot fill all five is the signal the abstraction needs revisiting, **not** a reason to add a flag.

### Rules that are not stylistic preferences

- **The PNG must be self-contained.** These get saved and reposted into servers that never ran the command. Never burn an instruction into an image (`"Run again for new results"`, a `/manual` pointer) — that outlives the message. Actionable, context-dependent lines belong in the embed.
- **Never ellipsise to a character count.** Use `fitText` / `estimateTextWidth`. CJK is 2× wide, and German compounds run ~3× English (`Farbstoffverkäufer` vs `Dye Vendor`).
- **Blanks, never inventions.** A missing price is an em dash; a ratio with no numerator is an empty cell.
- **The outlined swatch means *unbuyable*.** It is the vocabulary's marker for "the hue the maths asked for" — an ideal gradient step, a blend, a harmony's target hue.
- **A tier is a property of the matching method, not of the pair.** Print the method wherever a tier or a verdict appears; never compare a tier across methods. Only ΔE2000's bands follow the user's threshold.

### Band vocabulary

Three calibrations of the same four tiers live in `@xivdyetools/core` (`classifyBandTier(value, method, context)`) and are **not** interchangeable:

| Context | Cuts | Question |
|---|---|---|
| `match` | 5 / 10 / 20 | is this the same colour? (smaller is better) |
| `harmony` | 6 / 12 / 20 | is this hue reachable in the palette? |
| `separation` | 8 / 15 / 30 ascending | can these two be told apart under a lens? (**larger** is safer — the UI reads it 30/15/8) |

Polarity is per-tool and deliberately inconsistent between them: green means *close* in Comparison, and *far apart and therefore safe* in Contrast/Accessibility. Each follows its own shipped convention.

**The ramp is `#5bbd68 · #8bc34a · #ffc107 · #f4645a` (dark) — settled 2026-08-09.** The design set disagreed with itself: Turns 13/14 draw those middle bands, the 2026-08-07 Swatch doc draws `#9ecf5e / #F4BF4F`. Turns 13/14 win, because that ramp is already shipped in eight web-app components as well as here — it is what a player has learned to read, and a two-frame revision does not outrank a suite-wide convention.

`#F4BF4F` is **not** a retired tier colour. It is the separate **state** amber — OFF GRID on the swatch card, the vendor-cheaper flag, a destructive confirm. A tier answers *"how close is this?"*; a state answers *"something here needs your attention."* They are allowed to look similar; they are not allowed to be the same token. `frame-budget.test.ts` pins both ramps.

## Commands

```bash
pnpm --filter @xivdyetools/svg run build
pnpm --filter @xivdyetools/svg run test
pnpm --filter @xivdyetools/svg run test:coverage
pnpm --filter @xivdyetools/svg run type-check
pnpm --filter @xivdyetools/svg run lint
pnpm --filter @xivdyetools/svg run clean
```

From the monorepo root:

```bash
pnpm turbo run build test --filter=@xivdyetools/svg
pnpm --filter @xivdyetools/svg exec vitest run src/svg-pipeline.integration.test.ts
```

## Architecture

Every generator is a standalone module named after its output. Generators import the vocabulary from `frame.ts` and low-level primitives from `base.ts`. There is no class hierarchy — each module is independently testable.

```
src/
├── index.ts                  # Public API re-exports
├── frame.ts                  # THE FRAME SYSTEM — read before touching a generator
├── base.ts                   # XML escape, hex/RGB helpers, primitives, THEME, FONTS
├── icons/tool-icons.ts       # Single geometry home: 9 tool glyphs × compact + detail
│
│  # 5.0 cards — each names its confirmed frame in its module docblock
├── harmony-card.ts           # /harmony            11A (Turn-13 geometry)
├── dye-info-card.ts          # /dye info           11B sheet
├── random-dyes-grid.ts       # /dye random         11B table
├── gradient.ts               # /gradient           12H·2 / ·3 / ·4
├── mixer-card.ts             # /mixer              12F ratio sweep
├── contrast-card.ts          # /contrast           13A / 13B / 13C·1 (routes on pair count)
├── a11y-card.ts              # /accessibility      13D / 13E / 13H (routes on vision:)
├── budget-ledger.ts          # /budget             13G ledger
├── comparison-card.ts        # /compare            14A / 14C·2 / 14C (routes on dye count)
├── palette-grid.ts           # /extractor image    14K ramp
├── nearest-sheet.ts          # /extractor color    14J·2 colour sheet
├── swatch-card.ts            # /swatch             1a / 1b (order: option)
└── preset-swatch.ts          # /preset             DEFERRED — pre-frame, see its docblock
```

**Several commands route rather than scale.** `/contrast`, `/compare` and `/accessibility` each pick a different frame from their input (pair count, dye count, `vision:`) — the input decides, nothing picks it for the user, and the routers are total. Do not "generalise" a router into one frame that scales; the shapes are genuinely different layouts.

`preset-swatch.ts` is the one generator not on the frame system. `/preset`'s redesign is deferred on whether the command survives 5.0 at all — its defects were fixed in place, its layout was not. See its module docblock.

## Key Patterns

### Pure function contract
Every `generate*` returns a self-contained `<svg>` string with `xmlns` and `viewBox`. No shared mutable state — the same input produces byte-identical output, which makes snapshot testing natural. (`appIcon` keeps a module-level counter for unique clip-path ids per placement; it never affects output for a given call order.)

### XML escaping
`cardText` and `base.ts::text()` always run content through `escapeXml`. **Do not** concatenate user-supplied strings into raw `<text>` blocks.

### CJK-safe text widths
`estimateTextWidth(s, charWidth)` counts CJK ideographs, Hangul and CJK compatibility as **2×** Latin width. `frame.ts`'s `textWidth`/`fitText` wrap it with per-font-class factors. This is the only correct way to decide a truncation point.

### Font stacks
`Fragment Mono` (mono), `Onest` (body), `Space Grotesk` (display), each falling back through `Noto Sans JP → SC → KR`. **Order matters**: JP must precede SC or Japanese renders in Chinese letterforms, and SC has zero Hangul glyphs so KR must come last. Habibi was retired in 5.0 — it was never a monospace, which is why no column of numbers in a v4 card lined up.

### Rendering boundary (consumer's responsibility)
1. Load the font files (Onest, Space Grotesk, Fragment Mono, Noto Sans JP + SC + KR subsets).
2. Feed the SVG and font buffers to `resvg-wasm` / `@resvg/resvg-js`.
3. Return the PNG bytes to Discord, Revolt, etc.

A dye name introducing a glyph outside the current Noto subsets renders as `.notdef` tofu — re-subset via `apps/discord-worker/scripts/subset-cjk-fonts.py`.

## Consumers

- `apps/discord-worker` — every generator; rasterizes via `resvg-wasm`.
- `apps/stoat-worker` — Revolt bot mirror.
- `@xivdyetools/bot-logic` — orchestrates the command flows that call these generators.

`apps/og-worker` keeps its **own** local `THEME` and SVG services; it is on the OG card directions, not this frame system.

## Internal Dependencies

- `@xivdyetools/core` — colour algorithms, `classifyBandTier`, `MATCHING_METHOD_TAGS`, `abbreviateDyeName`, dye database (read-only).
- `@xivdyetools/core/blending` — in-card colour mixing.
- `@xivdyetools/types` — shared `Dye`, `HexColor`, etc.
- `@xivdyetools/test-utils` (dev) — fixtures for snapshot tests.

## Publishing

Publishing goes through the **Publish Packages to npm** GitHub Actions workflow, authenticated via npm trusted publishing (OIDC). There is no npm token — see the root `CLAUDE.md` for the full flow and the break-glass local path.

```bash
# 1. Bump version in packages/svg/package.json and merge to main
# 2. Build + test
pnpm turbo run build test --filter=@xivdyetools/svg

# 3. Actions → "Publish Packages to npm" → package: @xivdyetools/svg
```

This package declares `workspace:*` dependencies, which `pnpm publish` rewrites to exact versions at pack time. After a release, confirm they resolved — a literal `workspace:*` reaching the registry makes the package uninstallable:

```bash
npm view @xivdyetools/svg dependencies --json
```
