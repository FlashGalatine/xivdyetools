# [DEAD-014]: svg — six dead helpers/types on the public barrel (`arcPath`, `truncateText`, `rgbToHsv`, `DisplayOptions`+`DEFAULT_DISPLAY_OPTIONS`, `AllVisionTypes`, `CATEGORY_DISPLAY`)

## Category
Unused Export (DEAD)

## Location
`packages/svg/src/`:

| Symbol | File:lines | Lines (src + test) | Notes |
|---|---|---|---|
| `arcPath` | base.ts:231-252 | 22 + 22 (`base.test.ts:263-284`) | pie/donut helper from the retired harmony wheel; README "Low-level SVG primitives" lists it |
| `truncateText` | base.ts:359-374 | 16 + ~38 (`base.test.ts:368-384` **and again 450-470**) | only external ref is og-worker's `services/svg/base.ts` re-export, which og-worker never calls; contradicts the README/CLAUDE rule "Never ellipsise to a character count" |
| `rgbToHsv` | base.ts:403-442 | 40 + 37 | duplicate of core `ColorService.rgbToHsv`; all external hits are core's/web-app's own |
| `DisplayOptions` + `DEFAULT_DISPLAY_OPTIONS` | base.ts:9-41 | 33 | no generator takes display flags; web-app hits are its own `DEFAULT_DISPLAY_OPTIONS`; the "backward compat" comment at base.ts:13 has nothing to be compatible with |
| `AllVisionTypes` | a11y-card.ts:52 | 2 | unused even inside a11y-card.ts |
| `CATEGORY_DISPLAY` | preset-swatch.ts:92-101 | 12 | docblock says "Moved here from discord-worker's types/preset.ts", but discord-worker (`types/preset.ts:165`) and moderation-worker (`types/preset.ts:62`) still carry and import their own copies; svg's is touched only by `index.test.ts` |

## Evidence
Per-symbol `git grep -nw` over tracked files: int = definition only, ext = 0 (except the inert og-worker re-export of `truncateText`). knip flagged the first five; `CATEGORY_DISPLAY` was hidden by `index.test.ts`.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH |
| **Blast Radius** | LOW — svg is npm-published; `arcPath`/`truncateText`/`rgbToHsv` are README-documented, so this is a semver-minor break for hypothetical external consumers (none known — DEPRECATIONS.md names workspace consumers only) |
| **Reversibility** | EASY |
| **Hidden Consumers** | og-worker `services/svg/base.ts` re-exports `truncateText` — delete that line too (og-worker never calls it) |

## Recommendation
**REMOVE** (`DisplayOptions`, `AllVisionTypes`, `CATEGORY_DISPLAY` outright); **REMOVE WITH CAUTION** (`arcPath`, `truncateText`, `rgbToHsv` — documented API; note in the svg CHANGELOG). Alternatively for `CATEGORY_DISPLAY`: make the two apps import svg's copy and delete theirs (the docblock's original intent).

### If Removing
1. Delete the six symbols + their `describe` blocks (both `truncateText` blocks — see DEAD-017); update README/CLAUDE.
2. Remove the og-worker re-export line.
3. `pnpm turbo run build test --filter=@xivdyetools/svg --filter=xivdyetools-og-worker`; bump svg minor.
