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
FIXED 2026-10-16 — `e7919b2f`, PR #316 (web-app 5.15.5). `loadCharaFile` refuses a file not named `*.chara` (case-insensitive, by name) before the size check and before `file.text()`, covering drag-and-drop and Choose file in both tools; DOM-event tests drive both entry points. The picker's `accept` keeps `application/json` until a `.chara`-only picker is tested on iOS.
