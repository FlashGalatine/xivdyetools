# [DEAD-019]: `AnalyticsEvent.cacheHit` is hard-coded `false` at all 12 emit sites — the second Analytics Engine double is always 0

## Category
Dead Code Path (constant dimension)

## Location
- `src/types.ts:177` `cacheHit?: boolean`
- `src/index.ts:136` `doubles: [event.timestamp, event.cacheHit ? 1 : 0]`
- `src/index.ts:201, 336, 376, 421, 467, 512, 552, 585, 625, 649, 672` — every `trackAnalytics` call passes `cacheHit: false`

## Evidence
`grep -rn cacheHit src` — 12 literal `false`s, one reader. Cloudflare's cache serves hits *before* the worker runs, so a worker can only ever observe misses; the field can never be true by construction.

## Removal Risk Assessment
| Factor | Assessment |
|---|---|
| **Confidence** | HIGH that it is constant |
| **Blast Radius** | LOW — but Analytics Engine `doubles` are **positional** (`double1`, `double2`); dropping the entry shifts nothing today (it is the last double) but any saved SQL query selecting `double2` would start returning NULL |
| **Reversibility** | EASY |

## Recommendation
**REMOVE WITH CAUTION** — drop the field and the `? 1 : 0`, after checking the Analytics dashboard / saved queries for `double2`. If nobody reads it, 13 lines go; if something does, replace it with a genuinely varying signal (e.g. `frame === 'x'`) rather than a constant.
