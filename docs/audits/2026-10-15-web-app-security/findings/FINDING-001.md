# FINDING-001: Shared loader lacks early unsupported-extension rejection

**Severity:** INFO · **Exposure:** INTERNET-UNAUTH, user-assisted browser import · **Deploy unit:** web-app · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-20 (hardening classification; no exploit demonstrated)

## Location
- `apps/web-app/src/components/chara-file-card.ts:225,241` — picker hint and unconditional forwarding of the first dropped file.
- `apps/web-app/src/services/chara-file-loader.ts:44` — file-size check precedes reading; no extension guard.

## Evidence
- Both supplied `.pose` files reach content parsing and are rejected for missing colour keys; the drop itself is accepted.
- `accept = '.chara,application/json'` guides the picker and is not applied by the drop handler.
- [Review notes](../evidence/review-notes.md) and [parser results](../evidence/parser-probes.json). This is a confusing import affordance and unnecessary read, not evidence of execution.

## Fix
- Add a shared pre-read supported-extension check and a localized unsupported-type result; preserve size/content validation.
- Decide `.json` compatibility explicitly; test both entry points and both tools, including renamed invalid content.

## Status
OPEN — deferred at maintainer request on 2026-10-15; no implementation started.
