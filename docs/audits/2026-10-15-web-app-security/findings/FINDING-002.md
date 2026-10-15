# FINDING-002: Malformed character fields lack processing and diagnostic budgets

**Severity:** LOW · **Exposure:** INTERNET-UNAUTH through user-assisted web import; INTERNET-AUTH through Discord `/glamour` and `/swatch` · **Deploy unit:** core · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-400 (resource-hardening classification; persistent DoS not demonstrated)

## Location
- `packages/core/src/services/chara/chara-parser.ts:268` — splits/maps the full float string before validating component count.
- `packages/core/src/services/chara/chara-parser.ts:323` — serializes the entire invalid index value into an error.
- `packages/core/src/services/chara/chara-parser.ts:381` — parses input without a core size/depth ceiling; callers supply caps of 20 MiB (web) and 1 MiB (Discord).

## Evidence
- A 10,000-deep invalid `Skintone` array (20,014 bytes) throws `RangeError: Maximum call stack size exceeded` during error construction.
- The web loader catches the error. Discord's `packages/bot-logic/src/commands/glamour.ts:384` and `swatch.ts:204` also catch it as `PARSE_FAILED`; the input is below the worker's 1 MiB cap, so the work now demonstrably occurs server-side too. No outage or cross-user effect was demonstrated.
- [Core results](../evidence/parser-probes.json) and [Discord results](../evidence/discord-parser-probes.json): fixed localized bot errors, class-only logs and zero equipment resolver calls. Long-string amplification remains source-observed, not a load-test result.

## Fix
- Use bounded depth-safe diagnostics and cap field processing before splitting; choose metadata limits against supported exports.
- Evaluate document limits without misrepresenting post-parse checks as protection from parsing allocation; add bounded regression tests.
- Prioritize this shared fix when scheduling; cover both bot commands and retain their stream cap, fixed public errors and class/code-only logs.

## Status
OPEN — deferred; Discord exposure verified in the 2026-10-15 follow-up. No implementation started.
