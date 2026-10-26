# DEAD-039: familySize ?? twins.length fallback is dead for this repo's api-worker
**Confidence:** HIGH · **Blast radius:** MEDIUM · **Deploy unit:** bot-logic · **Semver:** MAJOR · **Category:** Legacy
**Calibration:** Blast LOW->MEDIUM: making familySize required narrows a field on the published @public GlamourResolvedItem type. A MAJOR row cannot be LOW blast under the rubric.

## Location
- `packages/bot-logic/src/commands/glamour.ts:66-79,350`
- `packages/bot-logic/src/index.ts:114-120`

## Evidence
- git grep -w familySize: api-worker resolver.ts:144 always sets familySize: sorted.length; types.ts:47 `familySize: number` (required), present since the endpoint's first commit 1d13e4c2 (git log -S). discord-worker glamour.ts:54-95 passes api-worker's envelope items straight to executeGlamour with no reshaping, so the `?? twins.length` branch (glamour.ts:350) cannot fire in production. But GlamourResolvedItem is exported `/** @public */` (index.ts:117) and familySize is optional (glamour.ts:71). npm view: bot-logic latest 4.11.0 == local. A third-party resolver may omit the field, so making it required breaks a published type (MAJOR). glamour.test.ts ANSWER fixture omits familySize, so tests exercise the fallb…
- The fallback is dead inside this repo, because api-worker always emits familySize and discord-worker passes it through unchanged. It is still deliberately kept. GlamourResolvedItem is a published @public resolver contract in bot-logic 4.11.0, where familySize is optional. Removing the fallback without making the field required would give NaN-free but wrong twin counts (undefined - 1 = NaN) to external resolvers. Making the field required is a MAJOR change. The cost of keeping it is a single expression.
- Still live: None in production (api-worker always supplies familySize). The published npm contract @xivdyetools/bot-logic@4.11.0 GlamourResolvedItem (index.ts:117) and the glamour.test.ts fixtures without familySize are the only things that reach the fallback.

## Fix
- **KEEP** — revisit trigger: Make familySize required in bot-logic 5.0.0, bundled with D41.
- Trigger as verified: The release of @xivdyetools/bot-logic 5.0.0 (bundle it with the bot-discord-08 fileText removal), or GlamourResolvedItem losing its @public tag or export in index.ts:117. Whichever comes first, make familySize required and drop the `?? twins.length` fallback.
- Cascade: None. The glamour.test.ts fixtures need familySize added when the field becomes required.
- Published: bot-logic 4.11.0 is published (npm latest == local). Making familySize required narrows a published @public type, which is MAJOR.

## Status
OPEN
