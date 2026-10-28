# DEAD-014: downloadCharaAttachment text-only shape and adapters' fileText pass-through are dead in production — ~15 lines
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** discord-worker · **Semver:** NONE · **Category:** Legacy

## Location
- `apps/discord-worker/src/utils/chara-attachment.ts:92-96,107-111,125-126`
- `apps/discord-worker/src/handlers/commands/glamour.ts:137,140,146,157`
- `apps/discord-worker/src/handlers/commands/swatch.ts:74,100,108-110`

## Evidence
- git grep -n -E 'downloadCharaAttachment|DownloadedChara|withBytes|fileText' (tracked, excl. audits): production calls only glamour.ts:140 and swatch.ts:100, both `(fileUrl, t, true)`; all 6 no-flag calls are in chara-attachment.test.ts. Both adapters set fileBytes on every ok path (glamour.ts:147,159; swatch.ts:111). bot-logic reads fileText only via readCharaForTools `file.fileBytes ?? file.fileText` (chara-identity.ts:47), called from glamour.ts:444 and swatch.ts:405; SwatchInput/GlamourInput.fileText are optional (swatch.ts:76, glamour.ts:101). No script, config, workflow or docs consumer besides historical CHANGELOG prose. App is unpublished.
- Every production download asks for bytes and every adapter passes fileBytes, which wins over fileText in bot-logic. The decoded text is computed and passed through but never read. bot-logic's public, optional fileText input is untouched, so semver is NONE. One caveat for the change: today the adapter tests check only fileText and never fileBytes, and chara-attachment.test never exercises withBytes=true. Re-point those tests at bytes rather than delete them, or the path production actually uses goes untested.
- Still live: none: no production code reads DownloadedChara.text. bot-logic chara-identity.ts:47 prefers fileBytes, which both adapters always set.

## Fix
- **REMOVE** — chara-attachment.ts: delete DownloadedChara (92-96), withBytes param and generic; return {ok:true, bytes}; drop the TextDecoder line 125; trim docblock. glamour.ts: drop `let fileText`, `fileText = file.text`, `fileText,` and the `, true` arg. swatch.ts: drop `fileText: ''` (74), line 110 and comment 108-109, the `, true` arg. Tests: chara-attachment.test.ts toEqual({ok:true, bytes: new TextEncoder().encode(...)}); glamour.test.ts:153 and swatch.test.ts:218 assert fileBytes (decoded) instead of fileText. Gate: pnpm turbo run build type-check lint test -…
- Prerequisite: Re-point adapter tests to assert fileBytes before dropping fileText, so the live bytes path stays covered.
- Cascade: Adapter tests glamour.test.ts:153 and swatch.test.ts:218 change to assert fileBytes. The chara-attachment.test.ts download expectations change from text to bytes. CHANGELOG 5.9.0 prose naming `downloadCharaAttachment(url, t, true)` is a historical release note and stays. bot-logic's CharaFileSource/fileText stays (published API, see bot-discord-08).

## Status
OPEN — app attachment text shape and adapter pass-through removed in prepared source; original-byte guards retained; release pending. [A-DISCORD evidence](../../2026-10-26-security/evidence/remediation-discord-2026-10-27.md).
