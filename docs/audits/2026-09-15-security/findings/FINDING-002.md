# FINDING-002: Preview approvals identify the preset, not the reviewed image
**Severity:** MEDIUM · **Exposure:** INTERNET-AUTH · **Deploy unit:** presets-api · **Rotation:** NONE · **CWE:** CWE-863

## Location
- `apps/presets-api/src/handlers/moderation.ts:260` — accepts action only; line 281 approves whichever image is currently on that preset.
- `apps/discord-worker/src/index.ts:324` — embed displays an image key, but buttons at lines 338/345 carry only the preset ID; `handlers/buttons/preview-image.ts:167` forwards no reviewed image version.
- `apps/presets-api/src/handlers/presets.ts:1147` — an owner replacement writes a new key with pending status.

## Evidence
- Owner uploads K1; a moderator sees its embed; owner replaces it with K2; clicking the old K1 approval marks K2 approved. No overlapping requests are required. Old rejection buttons likewise clear the current replacement.
- Local SQLite reproduction executes the actual source UPDATE strings: reviewed `K1.webp`, current `K2.webp`, resulting status `approved`. See [script](../evidence/scripts/probe-preview-approval.py) and [result](../evidence/preview-approval-probe.txt). Source authority flow independently verified.
- Public preview URLs are exposed only for approved images, so this bypasses the image review requirement. Pending R2 URLs being directly readable is a documented separate design choice.

## Fix
- Carry an opaque image revision from notification through button and signed API request; atomically update only that revision while pending. Return conflict on stale actions, and delete only the matching rejected key. Old buttons must fail closed.
- Coordinate the presets-api contract and discord-worker notification/client rollout; patching only the database read/write race does not fix stale buttons.

## Status
OPEN — fixed locally; deployment acceptance pending.

Implementation commits: 3c07b6b9, 247d368d, 0b5d814c. Regression and gate evidence: [implementation report](../IMPLEMENTATION_REPORT.md). Original evidence above describes the audited snapshot.
