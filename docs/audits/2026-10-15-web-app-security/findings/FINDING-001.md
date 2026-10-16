# FINDING-001: Shared loader lacks early unsupported-extension rejection

**Severity:** INFO · **Exposure:** INTERNET-UNAUTH, user-assisted browser import · **Deploy unit:** web-app · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-20 (hardening classification; no exploit demonstrated)

## Location
- `apps/web-app/src/components/chara-file-card.ts:225,241` — picker hint and unconditional forwarding of the first dropped file.
- `apps/web-app/src/services/chara-file-loader.ts:51` — file-size check precedes reading; no extension guard.

## Evidence
- Both supplied `.pose` files reach content parsing and are rejected for missing color keys; the drop itself is accepted.
- `accept = '.chara,application/json'` guides the picker and is not applied by the drop handler.
- [Review notes](../evidence/review-notes.md) and [parser results](../evidence/parser-probes.json). This is a confusing import affordance and unnecessary read, not evidence of execution.

## Fix
- Add a shared pre-read supported-extension check in `loadCharaFile` (it covers both entry points and both tools) and a localized unsupported-type result; preserve size/content validation.
- Decided 2026-10-16: `.chara` only, matched case-insensitively on `file.name`, never on MIME (`.chara` has no registered type, so `File.type` is usually empty). Test both entry points through real DOM events, including renamed invalid content.

## Status
OPEN — deferred at maintainer request on 2026-10-15; no implementation started.
