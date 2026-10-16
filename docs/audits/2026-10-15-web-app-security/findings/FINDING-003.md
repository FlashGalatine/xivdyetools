# FINDING-003: Discord attachment helper downloads unsupported file types

**Severity:** INFO · **Exposure:** INTERNET-AUTH, Discord command user with signed interaction · **Deploy unit:** discord-worker · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-20 (hardening classification; no execution exploit demonstrated)

## Location
- `apps/discord-worker/src/utils/chara-attachment.ts:65` — validates presence, size and URL, but not filename or MIME metadata.
- `apps/discord-worker/src/handlers/commands/glamour.ts:113,139` and `swatch.ts:68,100` — both use the helper before downloading and parsing.

## Evidence
- Under-limit `.pose`, `.png` and `.txt` metadata all pass the shared guard; both supplied poses are downloaded by a mocked transport and then rejected by both actual command functions.
- Renaming either pose to `.chara` still produces `PARSE_FAILED`, a fixed localized message and zero equipment resolver calls. The guard's 1 MiB stream cap, CDN allowlist, timeout and redirect refusal remain effective.
- [Source review](../evidence/discord-review-notes.md) and [16 local probes](../evidence/discord-parser-probes.json). The user has already uploaded to Discord; early rejection prevents worker work, not that upload.

## Fix
- Validate the agreed supported extensions against `attachment.filename` before download/deferral; return a localized ephemeral refusal for both commands.
- Keep MIME advisory and all content/transport safeguards; test rejected filenames cause no fetch, lookup or render work, and renamed poses still fail parsing.

## Status
FIXED 2026-10-16 — `e7919b2f`, PR #316 (discord-worker 5.8.15, bot-logic 4.10.0). `checkCharaAttachment` refuses a filename not ending in `.chara` (case-insensitive) before the size and host checks and before deferring, with the new localized `card.charaFileReason.notChara`; tests assert no fetch and no command run. The reported-size and streamed caps are 8 KiB.
