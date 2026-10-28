# DEAD-011: Protocol validates non-null dye objects that the worker can never send — ~245 lines
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** web-app · **Semver:** NONE · **Category:** Legacy

## Location
- `apps/web-app/src/services/chara-inspection-protocol.ts:98-119,270-294,336-338,406-408 (isSafeInteger, a cascade the reviewer missed),431-444,587-669 (readDye`
- `the call is at :685)`
- `apps/web-app/src/services/__tests__/chara-inspection-protocol.test.ts:15-16,131-145,811-822 (switch to draft()),837-897`

## Evidence
- git grep -w readDye|DYE_FIELDS|RuntimeDye|readNumbers|RGB/HSV/LAB_KEYS|DYE_HEX|ImportedDye finds only protocol.ts, so all are module-private. The only production caller of the validator is service.ts:242 parseInspectionResponse, which receives worker messages. worker.ts:88 calls resolveCharaWithProvider(inspection, palettes) with no dyes argument. core chara-library.ts:251 sets `dye: dyes?.getByStainId(..) ?? null`, so every badge arrives null. The worker tests at :188-192 and :198-209 assert dyes===undefined and badge.dye===null. service.ts:223-231 attachDyes then overwrites every dye. The inline mock goes through handleInspectRequest, so its dyes are null too. imported-chara factory gearDyes:[]. Only tests s…
- On every production path the worker sends `dye: null`. Core sets null whenever no DyeService is passed, and the worker never passes one; its own tests pin both facts. The page also replaces every dye with its own lookup after validation. The non-null branch of readDye and its about 120 lines of allowlist tables and helpers therefore guard input that never arrives. Rejecting any non-null dye is a stricter rule, so the page's trust boundary only tightens. Cautions: if a future change made the worker attach dyes, imports would fail as workerFailed, and the worker test at :198-209 would catch that first. The reviewe…
- Still live: none for the non-null branch. The null branch stays live through service.ts:242 → parseInspectionResponse → readGearDyes:685.

## Fix
- **REMOVE WITH CAUTION** — 1. In protocol.ts, replace readDye with `function readDye(v: unknown): null | undefined { return v === null ? null : undefined; }` and update the call at :685. 2. Delete DYE_HEX, ImportedDye, RuntimeDyeExtras/RuntimeDye (98-119), DYE_FIELDS/DYE_KEYS (270-294), RGB/HSV/LAB_KEYS (336-338), readNumbers (431-444) and isSafeInteger (406-408). Reword the header comment and service.ts:263. 3. In protocol.test.ts, drop the DyeService/dyeDatabase imports, realDye/draftWithDye and the F4 block (837-897). Change the test at :813 to draft() and add a test that reje…
- Prerequisite: Keep the worker's dye-null assertions (worker.test.ts:188-209) green, because they become the guard for the stricter rule.
- Cascade: isSafeInteger (protocol.ts:406-408) becomes unused because readDye is its only caller. The no-shared-node test at protocol.test.ts:811-822 uses draftWithDye and must move to draft(). protocol.test.ts loses its DyeService/dyeDatabase imports. Two comments need rewording: service.ts:263 and protocol.ts:14-16/105-110. The inline mock (chara-inspection-inline.ts) and the imported-chara factory are unaffected.

## Status
OPEN — remaining A-WEB implementation and regression proof prepared in web 5.16.4 (draft #347); production acceptance pending. [A-WEB evidence](../../2026-10-26-deep-dive/evidence/remediation-web-2026-10-28.md).
