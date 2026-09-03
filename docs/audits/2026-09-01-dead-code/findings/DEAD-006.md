# DEAD-006: `@xivdyetools/core` — three public methods with no consumer in this repo (`CharacterColorService.getSharedColors` / `.getRaceSpecificColors`, `LocalizationService.getAvailableLocales` ×2) — KEEP, ~25 lines

**Confidence:** HIGH (unused in-repo) · **Blast radius:** HIGH if removed · **Deploy unit:** packages/core · **Semver:** MAJOR · **Category:** Unused Export (published API)

## Location
- `packages/core/src/services/CharacterColorService.ts:154-156` `getSharedColors`, `:248-258` `getRaceSpecificColors` (a dispatch facade over the live `getHairColors`/`getSkinColors`)
- `packages/core/src/services/LocalizationService.ts:550-559` `getAvailableLocales` — instance **and** static, both returning `[...SUPPORTED_LOCALES]`

## Evidence
- `evidence/members.txt`: `extSrc=0 unitSrc=0` for all three; only core's own tests call them.
- `npm view @xivdyetools/core version` → **4.0.1**, which equals `packages/core/package.json`. Per the version rule in `audit-shared/release-mechanics.md`, the local version is already published, so removing a public export is a **major** bump — and npm consumers this repo cannot see are legitimate consumers.

## Fix
**KEEP.** ~25 lines of thin facade is not worth `@xivdyetools/core` 5.0.0 on its own, and the two `getAvailableLocales` overloads are the documented way to enumerate locales.
**Revisit trigger:** the next core major for any other reason — fold the removal into that bump, together with a check of whether `getRaceSpecificColors` should instead become the *only* entry point (its two callees are public today, so the facade adds nothing).

## Status
OPEN (KEEP) — unchanged; revisit at the next `@xivdyetools/core` major.

