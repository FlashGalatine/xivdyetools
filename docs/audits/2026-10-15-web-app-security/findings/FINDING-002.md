# FINDING-002: Malformed character fields lack processing and diagnostic budgets

**Severity:** LOW · **Exposure:** INTERNET-UNAUTH through user-assisted web import · **Deploy unit:** core · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-400 (resource-hardening classification; persistent DoS not demonstrated)

## Location
- `packages/core/src/services/chara/chara-parser.ts:268` — splits/maps the full float string before validating component count.
- `packages/core/src/services/chara/chara-parser.ts:323` — serializes the entire invalid index value into an error.
- `packages/core/src/services/chara/chara-parser.ts:381` — parses input without a core size/depth ceiling; the web loader supplies a 20 MiB file cap.

## Evidence
- A 10,000-deep invalid `Skintone` array (20,014 bytes) throws `RangeError: Maximum call stack size exceeded` during error construction.
- The loader catches parser exceptions at `apps/web-app/src/services/chara-file-loader.ts:67`; no tab hang, code execution or cross-user effect was demonstrated.
- [Reusable probe](../evidence/scripts/probe-chara-import.mjs) and [results](../evidence/parser-probes.json); long-string amplification is source-observed, not a browser stress-test result.

## Fix
- Use bounded depth-safe diagnostics and cap field processing before splitting; choose metadata limits against supported exports.
- Evaluate document limits without misrepresenting post-parse checks as protection from parsing allocation; add bounded regression tests.

## Status
OPEN — deferred at maintainer request on 2026-10-15; no implementation started.
