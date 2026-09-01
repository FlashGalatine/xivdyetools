# DEAD-013: presets-api `scripts/migrate-dyes-to-stainids.ts` — the one-shot migration it exists for ran and was verified on 2026-08-28 — 117 lines

**Confidence:** HIGH · **Blast radius:** NONE · **Deploy unit:** apps/presets-api · **Semver:** NONE · **Category:** Legacy (completed migration)

## Location
- `apps/presets-api/scripts/migrate-dyes-to-stainids.ts` — 117 lines; reads a `d1 execute --json` dump and emits `UPDATE` statements

## Evidence
- Not wired to anything: absent from `apps/presets-api/package.json` scripts (its sibling `migrate-presets.ts` **is** — `"db:seed"`), absent from every workflow. `evidence/script-refs.txt` shows only prose references (CHANGELOGs, `POST_MERGE_CHECKLIST.md`, `docs/projects/presets-api/database.md`).
- The migration completed: `docs/operations/POST_MERGE_CHECKLIST.md:285-291` — "**Done 2026-08-28 ~23:45Z** … 16 UPDATEs generated from a fresh dump, applied, verified". Its input format (4.x itemID rows) no longer exists in the table.

## Fix
**REMOVE WITH CAUTION.** The script is idempotent and harmless to keep, so the argument for deletion is that a migration tool outliving its data is a trap for the next reader. Delete it together with DEAD-007 (the client-side fallback it unblocked), in the same commit, and turn the `POST_MERGE_CHECKLIST.md` §2 lines into a past-tense record rather than an instruction. Keep `migrate-presets.ts` (live, `db:seed`).
Gate: `pnpm turbo run build type-check lint test --filter=xivdyetools-presets-api`.

## Status
OPEN — deliberately held with DEAD-007; the script and the client fallback it unblocked should go in the same commit, after the D1 check.

