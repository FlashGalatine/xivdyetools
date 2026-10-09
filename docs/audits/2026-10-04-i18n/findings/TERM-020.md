# TERM-020: Japanese privacy guide says the fonts are 自社ホスト ("hosted by our company")
**Tier:** P3 · **Locale(s):** ja · **Deploy unit:** apps/web-app · **Term source:** `policy-documents.md`: the operator is one person · **Origin:** MAIN

## Location
- `apps/web-app/PRIVACY.ja.md:44` — "フォントは自社ホストです"

## Evidence
- 自社 casts the one-person operator as a company, the error the 2026-09-20 translation pass removed elsewhere (当社). Unchanged since the last audit.

## Fix
- "フォントはセルフホストです".

## Status
FIX COMMITTED, NOT DEPLOYED — `bf332ddd` (branch `fix/remediation-2026-10-04-sprint7`, web-app 5.14.5, discord-worker 5.8.3; PR #249, open, stacked on #248). Documents only: live when merged (served from `main`).
