# DEAD-124: extractor.ts unimplemented TODO (v4 matching/market options)

## Category
Legacy/Deprecated (TODO marker)

## Location
- File(s): `apps/discord-worker/src/handlers/commands/extractor.ts`
- Line(s): 263

## Evidence
New finding. A lone planned-feature marker sits between the option extraction and validation:
```ts
// extractor.ts:261-263
const colorOption = options.find((opt) => opt.name === 'color');
const countOption = options.find((opt) => opt.name === 'count');
// TODO: matching and market options for v4 enhancements
```
The handler reads only `color` and `count`; the "matching method" and "market" options the TODO anticipates are not
registered for `/extractor` and no code references them. It is an informational marker, not dead code — there is nothing
to delete, only a decision to make (implement or drop the note).

## Why It Exists
`/extractor` is the V4 successor to `/match_image`; the TODO records an intended feature-parity step (matching-method and
market-price toggles) that was deferred.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — it's a comment; no runtime/build impact |
| **Blast Radius** | NONE |
| **Reversibility** | EASY |
| **Hidden Consumers** | None |

## Recommendation
**MONITOR**

### Rationale
- Per the broader prevention guidance, TODOs about future features should carry a tracking reference or be removed. This is
  the only TODO in the discord-worker production tree (a healthy signal), so the cleanup is trivial.

### If Acting
1. Either implement the matching/market options for `/extractor`, **or** delete the L263 comment and file a tracked issue
   so intent isn't lost in source.
