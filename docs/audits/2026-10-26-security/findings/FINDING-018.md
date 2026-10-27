# FINDING-018: POST /presets spends a Perspective call before reserving quota; a same-dye concurrent burst is charged one submission
**Severity:** LOW · **Exposure:** INTERNET-AUTH · **Deploy unit:** presets-api · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-770

## Location
- `apps/presets-api/src/handlers/presets.ts:1031` — POST /presets spends a Perspective call before reserving quota; a same-dye concurrent burst is charged one submission

## Evidence
- presets.ts:998 `const rateLimitResult = await checkSubmissionRateLimit(c.env.DB, auth.userDiscordId!);` (read-only); :1031 `const moderationResult = await moderateContent(`; :1058-1064 `if (isDyeSignatureCollision(error)) { ... return respondToDuplicate(c, auth, existingPreset); }`; :1075 `await recordSubmissionEvent(..., 'submission', preset.id, ...)` reached only after createPreset succeeds; versus :683 `const textEditReservation = await reserveDailyEvent(c.env.DB, auth.userDiscordId, 'text_edit', ...)` before moderateContent on PATCH.
- Reach: A logged-in user (web JWT, or a bot-signed request) sends a burst of concurrent POST /api/v1/presets with the same fresh dye set and clean name/description. Every request passes the read-only cap check (:998) and the duplicate pre-check (:1025) before the first INSERT lands, so each one calls moderateContent/Perspective (:1031). The losers then hit the dye_signature UNIQUE collision (:1058) and return through respondToDuplicate (:171-205) without writing a submission_events row.
- checkSubmissionRateLimit (rate-limit-service.ts:389) only reads counts. recordSubmissionEvent (:1075) runs only after a successful createPreset, so collision losers are never charged: N Perspective calls cost one daily slot, and this can repeat once per slot (10 per day), bounded by the 100/min per-user limiter. Perspective's quota is about 1 QPS, so the burst drives it to 429, and other users' submissions and edits fall to perspective_unavailable, then pending (moderation-service.ts:280-285). This fails closed, so nothing gets published unmoderated, but auto-approval and the moderator queue are degraded. It also contradicts securi… Preconditions: PERSPECTIVE_API_KEY is set in production. The attacker has a valid account that is not banned and has daily submission quota left. The burst requests arrive inside the first request's Perspective latency window (up to the 5 s timeout), and the name/description pass the local word list so they reach…
- Live state (read-only Cloudflare query 2026-10-26, [evidence](../evidence/live-state-cloudflare-2026-10-26.md)): `PERSPECTIVE_API_KEY` **is set** on production `xivdyetools-presets-api`, so the ordering is reachable today and lapses only if the key is removed for the 2026-12-31 sunset.

## Fix
- Reserve a 'submission' slot with reserveDailyEvent before moderateContent in POST (reserve-then-act, never released), the same pattern PATCH uses for text_edit, and keep the BUG-049 post-insert recount as a backstop. Then update security-trade-offs.md mitigation 2 / Code References to name the POST reservation.
- **Maintainer decision:** Choose whether to fix the reserve-before-Perspective ordering now or let it lapse when PERSPECTIVE_API_KEY is removed for the 2026-12-31 sunset (and correct security-trade-offs.md:309 either way).

## Status
OPEN — source prepared in A-PRESETS: atomic pre-moderation submission-attempt admission and shared reporting; [presets evidence](../evidence/remediation-presets-2026-10-27.md). Merge and production acceptance remain pending.
