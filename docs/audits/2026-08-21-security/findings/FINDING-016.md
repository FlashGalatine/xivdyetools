# FINDING-016: presets-api visibility/vote gating gaps — duplicate submission returns the full pending preset, votes accepted on non-approved presets, 403-vs-404 oracle

## Severity
**LOW** — information disclosure of moderation-pending content and vote-count manipulation on hidden rows. Reviewer IDs: PAPI-2, PAPI-5, PAPI-11. Coordinator-verified at `presets.ts:558-568` and `votes.ts:157-166`.

## Category
CWE-285 Improper Authorization · CWE-204 Observable Response Discrepancy

## Location
- `apps/presets-api/src/handlers/presets.ts:558-568, 599-607`; `services/preset-service.ts:290-302` — on a dye-signature collision the response embeds the **entire** matching row (`duplicate`, incl. `previous_values`, `author_discord_id`) regardless of its status (pending/rejected/hidden) and records a vote on it — bypassing the BUG-014 visibility gate.
- `apps/presets-api/src/handlers/votes.ts:157-166` — `POST /votes/:presetId` checks existence only (`SELECT id FROM presets`), so pending/rejected/flagged/hidden presets accumulate votes.
- `handlers/presets.ts:249, 310, 702, 837`; `votes.ts:158-164` — 403 vs 404 reveals whether a non-approved UUID exists (INFO-level oracle).

## Recommendation
Return only `{ id, status }` (or a 409 without a body) for duplicates of non-approved presets and do not auto-vote unless the target is approved; require `status = 'approved'` in the vote handler; return 404 for any preset the caller may not see.

## References
- Evidence: `../evidence/review-presets-api.md` (PAPI-2, PAPI-5, PAPI-11)
