# DEAD-036: Exports used in their own file that exist only as test seams (web-app-09): KEEP
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** web-app · **Semver:** NONE · **Category:** Legacy

## Location
- `apps/web-app/src/services/chara-inspection-protocol.ts:782 validateImportedCharacter`
- `apps/web-app/src/workers/chara-inspection.worker.ts:75 handleInspectRequest`
- `apps/web-app/src/shared/item-links.ts:71,76,81,94,118,128 garlandToolsUrl/teamcraftUrl/mirapriUrl/gamerEscapeUrl/lodestoneUrl/GLASSES_BLOCK`

## Evidence
- symrefs.sh apps/web-app <9 syms>: prod=2-3 each, all in the declaring file; tests 78/19/2/2/3/5/8/2/4; other=0 (glamourMarkdownInput only in docs prose). git grep -w (non-test): each has a live in-file caller: protocol.ts:814; worker.ts:179 (worker spawned at chara-inspection-service.ts:291); item-links.ts:141,147,180-199 via buildItemLinkMenu (used by item-links-menu.ts:172-183); glamour-list-actions.ts:184,236 (imported by glamour-sheet.ts:39). knip.jsonc:28 ignoreExportsUsedInFile:true; check-dead-code.ts:849-855 counts in-file non-decl lines as prod use. No dead code; only the export keyword is test-facing.
- Each symbol is reached in production through its own file: the worker entry, the protocol validator, buildItemLinkMenu and the glamour copy/save actions. The export exists so tests can unit-test the pure helper directly. Both gates (knip with ignoreExportsUsedInFile, and the dead-code gate's in-file rule) treat these as live. Apps are unpublished, so semver is NONE.
- Still live: In-file production callers: chara-inspection-protocol.ts:814, chara-inspection.worker.ts:179, item-links.ts:141/147/180-199 (via buildItemLinkMenu, called from item-links-menu.ts:172), glamour-list-actions.ts:184/236

## Fix
- **KEEP** — revisit trigger: Re-audit a symbol when symrefs.sh apps/web-app <sym> shows prod<=1 (its in-file caller was deleted, so the body is dead) or tests=0 (no test imports it, so the export can be dropped), or when knip.jsonc ignoreExportsUsedInFile is set to false.
- Cascade: None. docs/projects/web-app/tools.md:209 names glamourMarkdownInput in prose only.

## Status
OPEN
