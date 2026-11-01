# DEAD-034: matchHexFor's interpretation==='inactive' arm is unreachable under xivcharakit 0.1.0-beta.4
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** core · **Semver:** NONE · **Category:** Legacy
**Calibration:** Blast NONE->LOW: simplifying it would edit an internal production branch inside a published package's function, which the rubric grades LOW, not a comment-only change.

## Location
- `packages/core/src/services/chara/chara-library.ts:195`

## Evidence
- chara-library.ts:194 returns null for active!==true before :195 tests 'inactive'. grep '"inactive"' over xivcharakit/dist/*.js (pinned exactly "0.1.0-beta.4" in core package.json:78): only appearance.js:334 (inside `if (entry.active === false)`), :340 (sets active=false), :351 (sets active=false), each followed by `continue`. Only `.active =` writes: :339 false, :348 true (paired with extendedOnly), :352 false; no later pass flips active. So the arm cannot change the result. matchHexFor is module-private (sole caller :225, not exported from src/index.ts), so no API impact. Invariant is not stated in appearance/types.d.ts:30 (plain union). Same rule mirrored in web-app chara-inspection-protocol.ts:464.
- The claim holds: under the pinned beta every 'inactive' assignment co-occurs with active===false, so the second guard never decides anything. KEEP is still right. The guard is one zero-cost condition in a private helper. The invariant is undocumented in a 0.1.0 beta that the repo will bump, and the web-app validator enforces the same rule on purpose. Deleting it would save nothing and lose protection against a library change.

## Fix
- **KEEP** — revisit trigger: When core's exact xivcharakit pin (packages/core/package.json:78) moves off 0.1.0-beta.4: re-grep dist/appearance.js for "inactive". Simplify only if that release's appearance/types.d.ts encodes the invariant, for example as a discriminated union where interpretation 'inactive' implies active false.

## Status
OPEN
