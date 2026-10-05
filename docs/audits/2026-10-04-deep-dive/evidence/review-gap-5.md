# review-gap-5: web-app share URL -> og-worker crawler unfurl contract

Preview worktree @80262a2f. Origin of everything below: MAIN (the grammar and the crawler both predate the open PRs).

## Map

| Surface | Emits / reads | Evidence |
|---|---|---|
| web gradient `getShareParams` | `start`/`hexStart`, `end`/`hexEnd`, `steps`, `interpolation`, `algo` | apps/web-app/src/components/gradient-tool.ts:1670-1693 |
| web mixer `getShareParams` | `dyeA`/`hexA`, `dyeB`/`hexB`, `ratio`, `mode`, `algo` (a pair; `hexC` is never emitted) | apps/web-app/src/components/mixer-tool.ts:1909-1935 |
| web harmony share | `dye`/`hex`, `harmony`, `algo`, `perceptual`, `wheel` | harmony-tool.ts:1859 |
| web budget share | `dye`/`hex`, `maxPrice`, `maxDelta` | share-service.ts:119-124 |
| crawler gradient | reads `start,end,steps,algo` only | apps/og-worker/src/og-data-generator.ts:822-830 |
| crawler mixer | reads `dyeA,dyeB,dyeC,ratio,mode,algo` | og-data-generator.ts:832-843 |
| crawler harmony | reads `dye,harmony,algo,wheel` | og-data-generator.ts:810-820 |
| crawler budget | reads `dye` only | og-data-generator.ts:921-925 |
| crawler allowlist (image routes) | `lang,frame,algo,mode,wheel` | apps/og-worker/src/index.ts:216 |
| gradient card | one interpolation space chosen from `algo` (oklab / rgb-ish / else Lab); ranks middle dyes by hardcoded ciede2000; caps bands at 5 | apps/og-worker/src/services/svg/gradient.ts:36-43, 88-91; band.ts:54 |

## Candidates

### gap5-01 BUG MEDIUM — a gradient share with a custom-colour endpoint unfurls the generic tool card
- file:line apps/og-worker/src/og-data-generator.ts:822-830 (and :293-303)
- Claim: the web grammar declares `hexStart`/`hexEnd` as a first-class endpoint (gradient-tool.ts:1678-1685), but the crawler reads only `start`/`end`.
- Repro: `/gradient/?hexStart=ff8800&end=43&steps=5` -> crawler computes `start = parseInt('0') = 0` -> `getDyeInfo(0)` is null (og-data-generator.ts:223-229) -> `toolDefault('gradient')` -> title "Gradient Builder | XIV Dye Tools", image `/gradient/default.png`, `og:url` `/gradient/` (lines 184-193) with no params at all. The page restores a custom-colour -> Dye 43 gradient. Both endpoints custom gives the same.
- Weaker than og-worker-05 (wrong dyes) in that it is honest-generic rather than misleading, but it throws away a valid share. Same for mixer `hexA`/`hexB` (dyeA=0 -> default card, 832-843, 325-337) and harmony `hex` (dye=0 -> `titleNoDye`, 251-262). The sibling swatch case already handles `hex` (860-885), and budget documents its hex degrade (generateBudgetOGData docblock, line 580), so this is an accepted-looking design for budget but not documented for gradient/mixer/harmony.
- Tests: og-data-generator.test.ts:108-135 pin only `start: 999999` (an unknown dye id), never a missing `start` with `hexStart` present, and nothing mentions hexStart/hexA in apps/og-worker (git grep empty). Covered: no.
- Excerpt:
```
start: parseInt(searchParams.get('start') || '0', 10),
end: parseInt(searchParams.get('end') || '0', 10),
```
- Fix direction: either render hex endpoints (route would need a hex path segment/key and an allowlist addition, which collides with the S7-R7/R10 cache-key ruling), or record the degrade in og-worker CLAUDE.md and add a test that pins "hex slot -> tool default card with the params preserved on og:url" (appUrl currently drops them, so a crawler following og:url loses the share).

### gap5-02 BUG MEDIUM — `interpolation` is never read, and the card interpolates in a different space even at defaults
- file:line apps/og-worker/src/services/svg/gradient.ts:36-43 (+ og-data-generator.ts:822-830)
- Claim: the page ramps in the sharer's `interpolation` space (rgb/hsv/lab/oklch/lch; default `hsv`, gradient-tool.ts:96, 1710-1766), then matches by `algo`. The card ignores `interpolation` and derives the space from `algo` (oklab -> OKLab mix; rgb/distinguish/redmean -> RGB; everything else, including the default ciede2000, -> Lab). `interpolation` is also absent from `OG_ALLOWED_QUERY_KEYS` (index.ts:216) and from the emitted `og:url`/image URL.
- Repro: Ink Blue -> Snow White (any pair whose hue differs), steps 5, defaults (`interpolation=hsv&algo=ciede2000`). Page middle steps are matched from the HSV ramp; the card's middle bands are matched from the Lab ramp. Different theoretical colours give different middle dyes; the unfurl names dyes the page does not show, with the same title. `interpolation=oklch` or `rgb` is worse (rgb with default algo still goes through Lab). The effect holds for every gradient link, not only non-default ones.
- Compounding (separate accepted findings, so only a cross-reference): ciede2000-hardcoded ranking (gradient.ts:88) and the 5-band cap vs the page's 3-12 steps (steps 6-12 are 5 bands on the card).
- Tests: gradient.test.ts has no algorithm or interpolation case (already filed); no test compares the card with the page for any pair. Covered: no.
- Fix direction: accept that the card is an approximation and say so (docblock + CLAUDE.md), or default the card to the web's HSV space and bound it by adding one allowlisted `interp` enum (5 values, same class as `algo`). Do not ship the current mix silently, because the docblock (gradient.ts:1-9) claims the bands are what the page shows.

### gap5-03 BUG LOW — mixer `ratio` 0 or 100 is clamped to 1/99 in the unfurl
- file:line apps/og-worker/src/og-data-generator.ts:838 (`clampInt(..., OG_MIN_MIXER_RATIO=1, OG_MAX_MIXER_RATIO=99, 50)`, og-params.ts:30-31)
- The page accepts and shares `ratio` in 0-100 (mixer-tool.ts:702, 1931). A 100/0 mix unfurls "99% A + 1% B", and the image route would 400 for 0/100 anyway. Edge input only; the page's default slider may not reach it (not verified), so LOW. Covered: no.
- Fix direction: document, or let 0/100 take the single-dye card.

### gap5-04 BUG LOW — `perceptual`, `maxDelta`, `maxPrice` are not read; only perceptual is documented
- harmony `perceptual` is deliberately pinned true on the card (apps/og-worker/src/services/svg/harmony.ts:103-109) and the divergence is written down, so this is a known accepted gap and is not re-filed beyond confirming it. A harmony share with `perceptual=0` unfurls dyes picked with perceptual on, same title.
- budget `maxDelta`/`maxPrice` (share-service.ts:119-124) are ignored by `generateBudgetOGData` (og-data-generator.ts:584-603): the card names only the target dye and the default budget card, which is consistent with a card that shows no limits. No wrong claim made; recorded for completeness. Covered: no (no per-param test).

## POSITIVE
- Unknown or missing endpoints always degrade to a tool default card; no fake dye is invented (og-data-generator.ts:293-303, comment at 866-870 states the policy).
- Mixer `mode` and `algo` are carried to the card (withMode/withAlgo, og-data-generator.ts:98-103, 335-348), closing the old "every unfurl rendered CIELAB" gap for the mixer.
- Harmony `wheel` and `algo` reach the card; only `perceptual` diverges and is documented (harmony.ts:103-109).
- Web mixer emits a pair only, so the crawler's optional `dyeC` branch cannot misfire on a hex third slot (mixer-tool.ts:1909-1935).
- Crawler-only: human requests pass through to the SPA (index.ts:568-580), so the meta-refresh dropping hex/interpolation params from `og:url` does not reach people.

## REJECTED
- `hexC` mixer unfurl as a 2-dye card for a 3-way page: web never emits `hexC` or `dyeC` for new links (mixer-tool.ts:1909-1935; a legacy 3-slot link is already an accepted finding, mixer loadSelectedDyes).
- `og:url` omitting `hexStart`/`interpolation` as a human regression: crawlers only (index.ts:568), the person never sees it; filed only as a fix hint under gap5-01.
- `steps` 3-12 vs crawler clamp 2-20: web range is a subset, no divergence (gradient-tool.ts:365; og-params.ts:26-27).
- Budget hex target degrade: documented in the function docblock (og-data-generator.ts:580-583).

## COVERED
8 files: apps/web-app/src/services/share-service.ts (lines 50-130, 380-440, 620-720), apps/web-app/src/components/gradient-tool.ts (295-380, 1670-1900), apps/web-app/src/components/mixer-tool.ts (695-710, 1295-1310, 1909-1935), apps/og-worker/src/og-data-generator.ts (150-340, 575-640, 780-930), apps/og-worker/src/og-params.ts, apps/og-worker/src/services/svg/gradient.ts, apps/og-worker/src/services/svg/harmony.ts (90-125), apps/og-worker/src/index.ts (216-290, 559-600, 850-900); tests skimmed: apps/og-worker/src/og-data-generator.test.ts (94-135).
