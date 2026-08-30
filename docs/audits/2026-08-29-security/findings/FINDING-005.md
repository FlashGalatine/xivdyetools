# FINDING-005: presets-api content moderation fails open — a Perspective error/429/timeout returns `null` and the text passes with a one-word local list; the call runs before the edit cap and carries the API key in the query string
**Severity:** MEDIUM · **Exposure:** INTERNET-AUTH · **Deploy unit:** presets-api · **Rotation:** NONE · **CWE:** CWE-636 (not failing securely)

## Location
- `apps/presets-api/src/services/moderation-service.ts:240-243` (non-OK → `return null`), `:277-280` (throw/`AbortSignal.timeout(5000)` → `null`), `:312-316` — `null` = passed, `method: 'local'`
- `apps/presets-api/src/data/profanity/en.ts:14` — the local fallback list has a single entry
- `apps/presets-api/src/handlers/presets.ts:494→523` — `moderateContent` runs before the flagged-edit cap; `moderation-service.ts:221` — `?key=${PERSPECTIVE_API_KEY}`

## Evidence
- Perspective's default quota is ~1 QPS: a burst of name/description PATCHes from one account (no per-user cap before the call) drives 429s → every subsequent edit is approved on the local list alone; the "PRESETS-HIGH-001" comment documents the fail-open deliberately.
- Promotes 2026-08-21 INFO PAPI-16 (unchanged since).

## Fix
- On Perspective error/429/timeout set `moderationStatus = 'pending'` for name/description changes (fail closed into the moderator queue); send the key in `x-goog-api-key`; apply a small per-user pre-moderation edit cap.

## Status
FIXED 2026-08-30 e10d740e (+ 1e80ebff docs; presets-api 2.2.0) — Perspective error / 429 / timeout / unparsable → "needs manual review": persisted `pending` + moderator notification, treated exactly like a flagged result; per-user `text_edit` cap (30/day) before `moderateContent` for every status — **needs hand-run migration `0012_submission_events_text_edit.sql`** (inert until applied); key sent in `x-goog-api-key`; decision recorded in `docs/architecture/security-trade-offs.md`.
