# DEAD-030: CHARA_WEAPON_SLOTS exported @public with no consumer outside its own module
**Confidence:** HIGH · **Blast radius:** HIGH · **Deploy unit:** core · **Semver:** MAJOR · **Category:** Legacy

## Location
- `packages/core/src/index.ts:210`
- `packages/core/src/services/chara/chara-models.ts:35 (only use :38 isCharaWeaponSlot)`

## Evidence
- git grep -n -w CHARA_WEAPON_SLOTS: source hits only at core index.ts:210 (barrel, /** @public */), chara-models.ts:35 (decl) and :38 (isCharaWeaponSlot); no tests, apps, scripts, workflows or configs; the rest are CHANGELOG.md:1001 and older audit evidence. chara.ts (the ./chara subpath) does not re-export it. git log -S: added 1d13e4c2 (2026-08-20). npm view: latest 5.15.0 == local. Fetched the 5.15.0 tarball: dist/index.d.ts:112 and dist/index.js:69 export CHARA_WEAPON_SLOTS. So npm consumers can import it from the root entry. Removing it is MAJOR, and the claim and the KEEP recommendation both hold.
- The symbol is live: isCharaWeaponSlot (chara-models.ts:38) reads it, and chara-parser.ts:63 imports that function. Only the root-barrel export has no in-repo consumer. That export ships in the published @xivdyetools/core 5.15.0 (dist/index.d.ts:112) with an explicit @public tag, so dropping it breaks npm consumers and needs a MAJOR. Keeping it costs one line.
- Still live: Inside the module only: isCharaWeaponSlot at chara-models.ts:38, which chara-parser.ts:63 calls. Outside: possible npm consumers of the published root export.

## Fix
- **KEEP** — revisit trigger: Fold the removal of the CHARA_WEAPON_SLOTS barrel export into core 6.0.0, or keep it as published API.
- Trigger as verified: Revisit when the core 6.0.0 major-bump PR is opened (packages/core/package.json version goes to 6.x). Fold this into that PR's removals of @public exports that have no consumer.
- Cascade: None. The const stays because isCharaWeaponSlot uses it. Only the barrel re-export goes.
- Published: Published in @xivdyetools/core 5.15.0 (npm latest) at dist/index.d.ts:112 and dist/index.js:69, tagged @public.

## Status
OPEN
