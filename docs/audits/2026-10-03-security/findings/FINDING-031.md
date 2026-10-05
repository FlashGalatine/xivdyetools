# FINDING-031: presets-api: no test or startup check ties migration 0014's content-revision trigger to schema.sql or to the deployed D1
**Severity:** INFO · **Exposure:** LOCAL · **Deploy unit:** presets-api · **Rotation:** NONE · **Policy:** NONE · **CWE:** n/a
**Guard gap for:** 2026-09-15-security/FINDING-004

## Location
- apps/presets-api/migrations/0014_add_content_revision.sql:5-19 — CREATE TRIGGER presets_content_revision_after_update (the hand-applied copy)
- apps/presets-api/schema.sql:64-78 — a second, separately maintained copy of the same trigger (CREATE TRIGGER IF NOT EXISTS)
- apps/presets-api/tests/handlers/{owner,moderation,preview}-revision.test.ts:13 — each test builds its DB from readFileSync('../../schema.sql') only

## Evidence
- grep -rn "0014\|content_revision_after_update\|migrations/" apps/presets-api/tests -> no matches; the only schema source in the revision tests is schema.sql
- preset-service.ts:461/483/713 have WHERE ... content_revision = ? and nothing else. With no trigger the token stays 0 and every stale owner, status or revert write matches. No startup or health probe checks sqlite_master for the trigger.
- docs/operations/security-remediation-2026-09-15.md:22,34 — the trigger is checked by hand ('Verify ... the trigger before deploying'), and the deploy workflow does not apply migration 0014. IMPLEMENTATION_REPORT.md:63 states it 'does not claim migration or deployed-schema parity'.

## Fix
- Add a presets-api test that pulls the trigger body out of migrations/0014 and schema.sql, normalizes whitespace and IF NOT EXISTS, and asserts the two are equal. Or apply pre-0014 schema plus migration 0014 in the sqlite harness and run the revision tests against that DB too.
- Optionally add a cheap check in the deploy workflow or a health check: SELECT 1 FROM sqlite_master WHERE type='trigger' AND name='presets_content_revision_after_update'. Fail or alert when it returns nothing.

## Status
FIX COMMITTED, NOT DEPLOYED — `f1b54a0f` (local branch `fix/security-2026-10-03-sprint3`, presets-api 2.4.0; PR #224, open) (trigger parity test).
