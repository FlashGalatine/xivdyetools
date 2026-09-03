# DEAD-010: presets-api `validation-service.ts` — three exported validators and two exported types with no consumer anywhere — 108 + 2 lines

**Confidence:** HIGH · **Blast radius:** NONE · **Deploy unit:** apps/presets-api · **Semver:** NONE (app-internal) · **Category:** Unused Export / Unused Type

## Location
- `src/services/validation-service.ts:56-99` `validateStringLength` (44), `:101-146` `validateArray` (46), `:148-165` `validateEnum` (18)
- `src/services/validation-service.ts:438` `ModerationStatus` (type)
- `src/utils/api-response.ts:50` `ErrorCodeType` (type)

## Evidence
- knip (root config) reports all five under *Unused exports* / *Unused exported types* — `evidence/knip-root.txt`.
- `evidence/symrefs-presets-api.txt` agrees: each is `prod=1 tests=0 other=0`, i.e. the export line and nothing else — these three validators are not even tested.
- The live validation path is the per-field validators further down the same file; the three generic helpers were never adopted.

## Fix
**REMOVE.** `git rm`-scale deletion inside two files; no barrel to update (presets-api has no `src/index.ts` barrel for these). Re-grep each name first. presets-api CHANGELOG `### Removed`.
Gate: `pnpm turbo run build type-check lint test --filter=xivdyetools-presets-api`.

## Status
FIXED 2026-09-01 `825a45c0` — three validators + two type aliases removed (108 lines).

