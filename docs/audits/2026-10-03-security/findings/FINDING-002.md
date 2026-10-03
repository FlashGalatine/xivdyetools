# FINDING-002: budget.ts:272 / budget-calculator.ts:180 log the option-derived target dye id, matching method and max_distance threshold, which PRIVACY_POLICY §5 says are never logged
**Severity:** HIGH · **Exposure:** INTERNET-AUTH · **Deploy unit:** discord-worker · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-532
**Reconcile case:** 1 (Step 3a) · **Grade note:** HIGH by the skill rule (a field the policy explicitly promises is never in these lines). The calibration pass argued MEDIUM (catalog id / enum / number, Workers Logs off); the maintainer may downgrade at the §8 gate.

## Location
- apps/discord-worker/src/handlers/commands/budget.ts:272 — logger.info('Budget: building ledger', { targetDyeId, hasWorld }); targetDyeId comes from the target_dye option (budget.ts:177)
- apps/discord-worker/src/services/budget/budget-calculator.ts:180-185 — logger.info('Budget ledger: candidates priced', { method, threshold, ... }); method comes from the matching option or the stored preference (budget.ts:179,186-189), threshold from the max_distance option (budget.ts:180, clamped at calculator:126-127)
- apps/discord-worker/PRIVACY_POLICY.md:118 — §5: diagnostic lines 'never include command option values'

## Evidence
- budget.ts:272: if (logger) logger.info('Budget: building ledger', { targetDyeId, hasWorld: Boolean(world) });
budget-calculator.ts:180-185: logger.info('Budget ledger: candidates priced', { method, threshold, candidates: candidates.length, fetched: marketIds.size });
- Joinable to a person: index.ts:832 logs 'Handling command' with { command, userId }, and worker-kit middleware/logger.ts:122-140 builds one request logger per request from c.get('requestId'), so every line of the request carries the same id.
- git blame dates: calculator:180-185 = 2026-08-08 (84fb7b9d); budget.ts:272 = 2026-08-30 (dfc6de47, the 2026-08-29 FINDING-011 remedy, accepted when the policy made no such promise); PRIVACY_POLICY.md:118 = 2026-09-16 (d71d4512). The promise came after the accepted fix, so this is a new contradiction. Impact is low: catalog id, enum and number, no retention because Workers Logs are off.

## Fix
- Remove targetDyeId from the log context at budget.ts:272 and keep { hasWorld }.
- Remove method and threshold from the log context at budget-calculator.ts:180-185 and keep { candidates, fetched }. Drop method even when it comes from the stored preference.
- No policy edit is needed: once the fields are gone, §5 is true as written. Add a test that checks these log contexts contain no option-derived keys.

## Status
OPEN
