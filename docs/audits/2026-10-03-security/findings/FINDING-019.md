# FINDING-019: presets-api moderateContent: on the documented Perspective-sunset path (delete PERSPECTIVE_API_KEY by 2026-12-31) the local word list holds no profanity or slurs, so every preset auto-approves
**Severity:** LOW · **Exposure:** INTERNET-AUTH · **Deploy unit:** presets-api · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-1188
**Note:** Deadline: Perspective key deletion by 2026-12-31 (DEPRECATIONS.md). DEPRECATIONS.md has no step to edit both privacy policies at removal — add one.

## Location
- apps/presets-api/src/data/profanity/en.ts:8-15 — enProfanity contains only 'ai slop'; de/fr/ja/ko/zh each hold two AI-slop phrases and no profanity or slurs
- apps/presets-api/src/services/moderation-service.ts:248-250, 371-375 — no key returns null and moderateContent then returns { passed: true, method: 'local' }; presets.ts:950 maps passed to 'approved'
- DEPRECATIONS.md:30-44 — the runbook calls `wrangler secret delete PERSPECTIVE_API_KEY --env production` before 2026-12-31 the 'supported degradation' and says 'the local word list alone decides'

## Evidence
- en.ts: `export const enProfanity: string[] = [ // ...List intentionally kept minimal - Perspective API handles most cases // Anti-AI-slop terms 'ai slop', ];`
- moderation-service.ts:248 `if (!env.PERSPECTIVE_API_KEY) { return null; }` -> :371 `return { passed: true, method: perspectiveResult ? 'all' : 'local', ... }`; presets.ts:950 `const status = moderationResult.passed ? 'approved' : 'pending';`
- docs/architecture/security-trade-offs.md:293 already calls the local list 'single-entry'. The fail-closed acceptance (FINDING-005) assumed Perspective stays configured; the 2026-09-01 DEPRECATIONS entry removes that assumption with no replacement filter.

## Fix
- Before deleting the key, put a real local filter in place: a curated profanity and slur list per locale with normalization for case, leetspeak and spacing, or a replacement scorer.
- Or, once Perspective is removed and no scorer replaces it, make new and text-edited presets default to 'pending' (moderator queue) instead of auto-approving.
- Update DEPRECATIONS.md: state that the local list holds no profanity today, and make the decision 'replace the ML tier or default to pending' a blocking checklist step before the key is deleted.

## Status
OPEN
