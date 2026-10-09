# TERM-014: Korean privacy guide says 복장 for "outfit" in a line #223 added
**Tier:** P3 · **Locale(s):** ko · **Deploy unit:** apps/web-app · **Term source:** dictionary *Glamour Terms*: the policies use 의상 · **Origin:** PR#223

## Location
- `apps/web-app/PRIVACY.ko.md:30` — "\"모두 초기화\"는 해당 복장의 고쳐 쓴 줄을 삭제합니다"

## Evidence
- The same file says 의상 at :17, :18 and :48 (blame `3daa83fd`, #223).

## Fix
- "해당 의상의": inside #223 before merging, or in the policy sprint.

## Status
FIXED 2026-10-05 — `91de5f8d` (PR #223, merged in `5e3b000d`). Re-verified on `main@50165ec6`: [reverify-2026-10-05.md](../evidence/reverify-2026-10-05.md).
