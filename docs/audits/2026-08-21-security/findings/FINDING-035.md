# FINDING-035: stoat-worker (parked Revolt bot) — no rate limiting/abuse control, other bots' messages not ignored, raw echo of user input

## Severity
**LOW** — the app is parked with no deploy workflow; listed so the gaps are known before any revival. Reviewer IDs: STOAT-2, STOAT-3 (see FINDING-027), STOAT-4 (see FINDING-019).

## Category
CWE-770 · CWE-74

## Location
- `apps/stoat-worker/src/services/dye-resolver.ts:23, 115-117`, `src/commands/info.ts:70-78` — one command can emit up to 4 messages; no per-user/channel throttle; messages from other bots are processed (bot-loop risk).
- `apps/stoat-worker/src/services/response-formatter.ts:79, 100`, `src/router.ts:63` — user text echoed verbatim under the bot identity.

## Positive controls verified
`BOT_TOKEN` env-only, never logged; no `fetch`/fs/`child_process`/`eval`; no regex from input; SVG text from DB data only; `seroval` resolves to 1.6.2 (≥ 1.5.3 floor, GHSA-mv8w-475r-vwqw closed).

## Recommendation
Before un-parking: per-user cooldown, ignore `author.bot`, reuse the shared embed sanitiser and `Object.hasOwn` command lookup.

## References
- Evidence: `../evidence/review-infra-stoat.md` (STOAT-1..6)
