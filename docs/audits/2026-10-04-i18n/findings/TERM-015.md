# TERM-015: Chinese privacy guide calls the moderator 版主 in a line #223 added, and 审核员 everywhere else
**Tier:** P3 · **Locale(s):** zh · **Deploy unit:** apps/web-app · **Term source:** the same file: 审核员 ×15 · **Origin:** PR#223

## Location
- `apps/web-app/PRIVACY.zh.md:13` — "在版主批准后通过 shots.xivdyetools.app 公开显示"

## Evidence
- 审核员 appears 15 times in the file and throughout the bot documents. (web `zh.json` `fieldPreviewImageHint` also says 版主; the UI word is in the pin register.)

## Fix
- "审核员": inside #223 before merging, or in the policy sprint.

## Status
FIXED 2026-10-05 — `91de5f8d` (PR #223, merged in `5e3b000d`). The UI string `zh.json:1051` stays a *Pin first* row. Re-verified on `main@50165ec6`: [reverify-2026-10-05.md](../evidence/reverify-2026-10-05.md).
