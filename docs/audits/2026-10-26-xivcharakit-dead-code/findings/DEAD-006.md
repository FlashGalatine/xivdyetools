# DEAD-006: The ISSUE_KEY entry for EYE_PAIRING_UNCONFIRMED cannot be reached and duplicates the default — ~2 lines
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** web-app · **Semver:** NONE · **Category:** Legacy
**Calibration:** Blast NONE->LOW: it removes a production map entry in web-app code. The rubric reserves NONE for comment, doc or test-only changes.

## Location
- `apps/web-app/src/components/chara-ui.ts:328-329`

## Evidence
- git grep -w EYE_PAIRING_UNCONFIRMED: production hit only chara-ui.ts:329. The other hits are chara-ui.test.ts:392 and core parity tests that pin the non-default policy. xivcharakit beta.4 dist/appearance.js:10 sets historicalEyeCorrection to true by default. pairEyes returns at :165-177 before it can reach the UNCONFIRMED add at :180-184. Core chara-library.ts:214 calls resolveAppearance(inspection,{palettes:provider}) with no policy, and git grep finds no historicalEyeCorrection in any src. IssueCollector.add defaults severity to 'warning' (chunk-TCBT3LBA.js:31). Core (:167-170) and the worker protocol (:714-718) pass severity through unchanged. The fallback at chara-ui.ts:373 therefore returns the same swatch.issue.unknown, so output is identical even if the code were reached.
- Core never passes an appearance policy, so the library keeps historicalEyeCorrection at its default (true) and never emits EYE_PAIRING_UNCONFIRMED. Even if it did, the explicit entry maps to the same swatch.issue.unknown key that the warning-severity fallback gives. Removing it changes nothing, and the web-app is not published. The decision to keep the default is recorded at docs/research/2026-10-22-xivcharakit-integration.md:51. Revisit trigger: if the host ever sets historicalEyeCorrection:false (the open row-111 decision noted in the core parity tests), give the code a real translated key rather than restoring this placeholder.
- Still live: None in production. The only other consumer is the test row at apps/web-app/src/components/__tests__/chara-ui.test.ts:392, which keeps passing through the fallback.

## Fix
- **REMOVE** — In apps/web-app/src/components/chara-ui.ts, delete lines 328-329: the comment and `EYE_PAIRING_UNCONFIRMED: 'swatch.issue.unknown',`. Keep the swatch.issue.unknown locale key, which the :373 fallback still uses. The test row at chara-ui.test.ts:392 still passes because it uses severity 'warning' and now goes through the fallback. Keep it as fallback coverage, or move it next to the generic-unknown test. Gate: pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app.
- Cascade: None. swatch.issue.unknown stays live through the issueRow fallback at chara-ui.ts:373. No other module reads ISSUE_KEY.

## Status
OPEN
