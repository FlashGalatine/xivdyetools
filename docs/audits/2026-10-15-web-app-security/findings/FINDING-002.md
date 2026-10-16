# FINDING-002: Malformed character fields lack processing and diagnostic budgets

**Severity:** LOW · **Exposure:** INTERNET-AUTH (Discord `/glamour` and `/swatch`; the web path is a user-assisted import parsed in the user's own browser) · **Deploy unit:** core (the cap work also touches web-app, bot-logic and discord-worker) · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-400 (resource-hardening classification; persistent DoS not demonstrated)

## Location
- `packages/core/src/services/chara/chara-parser.ts:268` — splits/maps the full float string before validating component count.
- `packages/core/src/services/chara/chara-parser.ts:281` — interpolates the whole float string into its error.
- `packages/core/src/services/chara/chara-parser.ts:323` — serializes the entire invalid index value into an error with `JSON.stringify`, which recurses.
- `packages/core/src/services/chara/chara-parser.ts:364` — `mapNamed` interpolates the whole Tribe/Gender string into its error (added 2026-10-16).
- `packages/core/src/services/chara/chara-parser.ts:384` — parses input without a core size ceiling; callers supply caps of 20 MiB (web) and 1 MiB (Discord).
- `apps/web-app/src/services/chara-file-loader.ts:37-39,74,79` and `apps/web-app/src/components/chara-file-card.ts:144-147` — the web loader passes core's raw message into a toast and logs it in full (added 2026-10-16).

## Evidence
- A 10,000-deep invalid `Skintone` array (20,014 bytes) throws `RangeError: Maximum call stack size exceeded` during error construction. Re-measured 2026-10-16 (Node 22): the smallest overflowing file is 8,195 bytes on a bare stack, and an 8,191-byte file overflows with about 25 extra caller frames, so the proposed 8 KiB cap does not exclude this class. `JSON.parse` itself handled a 1,000,000-deep array.
- A 1 MiB Tribe value produced a 1,048,232-character message (2026-10-16).
- The web loader catches the error. Discord's `packages/bot-logic/src/commands/glamour.ts:385` and `swatch.ts:205` also catch it as `PARSE_FAILED`; the input is below the worker's 1 MiB cap, so the work now demonstrably occurs server-side too. No outage or cross-user effect was demonstrated.
- [Core results](../evidence/parser-probes.json) and [Discord results](../evidence/discord-parser-probes.json): fixed localized bot errors, class-only logs and zero equipment resolver calls. Long-string amplification remains source-observed, not a load-test result.

## Fix
- Use bounded, non-recursive diagnostics at all three interpolation sites and cap field processing before splitting. This is required independently of, and before, any size cap; no code path may recurse over parsed values.
- Propose dedicated 8 KiB (8,192-byte) web pre-read and Discord metadata/stream caps, with [corpus evidence](../evidence/size-cap-review-notes.md); retain field bounds and separate image-upload limits. The cap alone cannot exclude small spoofed image fields or establish safety.
- Prioritize this shared fix when scheduling; cover both bot commands and retain their stream cap, fixed public errors and class/code-only logs.

## Status
FIXED 2026-10-16 — `d8490205`, PR #315, merged as `f5ea2272` (core 5.13.0). A private, non-recursive `describeValue()` replaces the whole-value interpolation at `:281`, `:323` and `:364`; float strings over 128 characters are refused before `split`. An 8,192-byte nested index under 200 extra frames, a 200,000-level one, a 1 MiB comma string and 1 MiB Tribe/Gender values all give short `AppError` messages. The supporting 8 KiB caps ship in PR #316 (core 5.14.0 `MAX_CHARA_FILE_BYTES`).
