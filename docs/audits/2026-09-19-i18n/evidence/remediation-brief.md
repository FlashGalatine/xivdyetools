# Remediation brief — i18n audit 2026-09-19 (read fully before touching anything)

Worktree root — every command runs from here; never `cd` out, never touch `C:\dev\XIVProjects\xivdyetools` itself:
`C:\dev\XIVProjects\xivdyetools\.claude\worktrees\i18n-audit-2026-09-19`

Audit folder: `docs/audits/2026-09-19-i18n/` — `REMEDIATION_PLAN.md` (the sprints), `findings/<ID>.md`
(each ≤ 25 lines; its `## Fix` is your spec), `evidence/official-terms-research.md` (cited terms).

## Hard rules (many agents are editing this worktree at the same time)

1. **Edit only the files your prompt assigns.** Other agents own the rest; a file outside your list
   is read-only to you even if it looks wrong — report it instead.
2. **No git writes**: no `git add/commit/stash/checkout/restore/reset/merge/rebase`, no branch
   switching. `git diff`, `git log`, `git grep`, `git ls-files`, `git status` are fine. The
   coordinator commits.
3. **No package builds, no `turbo`, no `pnpm install`**, unless your prompt says you own a build.
   Concurrent builds race on `dist/`. Run only single-file vitest
   (`pnpm --filter <pkg> exec vitest run <file> --coverage.enabled=false`) and
   `pnpm --filter <pkg> exec tsc --noEmit` for your own unit. Never pass `--reporter=basic`.
   A red test caused by another agent's unfinished work (missing locale key, stale `dist`) is
   expected — name it in your report, do not "fix" it outside your files.
4. Do **not** bump versions or edit any `CHANGELOG*.md`, `README.md`, `docs/versions.md` — the
   coordinator does releases. Do not edit anything under `docs/audits/`.
5. The shell rejects long compound Bash lines and long heredocs here: write a script file under
   `C:\Users\DrawF\.claude\jobs\cfa7ff8d\tmp\<your-name>\` and run it with a plain command.
   Set `PYTHONIOENCODING=utf-8` for any python printing CJK. Never `grep -P` for CJK.
   Search tracked files only (`git grep`, `git ls-files | xargs grep`).
6. `verbatimModuleSyntax` is on: type-only imports need `import type`. Match the surrounding code's
   comment density and idiom; cite the finding ID in a comment where the fix is non-obvious.
7. Locale JSON: UTF-8, LF, 2-space indent, no reformatting of untouched lines, **same key order as
   `en.json`** for new keys. Placeholders `{name}` verbatim. Identifiers, slash-command names,
   option names, hex, brand names (`FFXIV`, `Universalis`, `Discord`, `spectral.js`) stay as-is.
   ja/zh prose uses full-width punctuation (、。：（）); ko uses ASCII punctuation.
8. Game nouns (dye names, categories, harmony types, wheel names, vision types, acquisitions) come
   from core's value for that locale — `packages/core/src/data/locales/<lc>.json` — never a fresh
   translation. Official terms decided in this audit (use exactly):

| Noun | ja | de | fr | ko | zh |
|---|---|---|---|---|---|
| Market Board | マーケットボード | Marktbrett | tableau des ventes (sentence-initial / label: `Tableau des ventes`) | 장터 | 市场布告板 |
| World (game server) | ワールド | Welt / Welten | Monde / Mondes (capitalized) | 서버 | 服务器 |
| Data Center | データセンター | Datenzentrum | centre de données | 데이터 센터 (with the space) | 大区 |

9. Match the register of the neighbouring keys in the same file; do not churn anything your task
   does not name. Never translate silently: your final report lists every new or changed value.

## Final report (your last message — ≤ 40 lines)

`FILES:` each file you created/edited · `DONE:` per finding ID, one line · `VALUES:` table of
changed/new translations (for bulk sets: count + 10 representative rows + where the full list is) ·
`TESTS:` command → exit code + pass/fail counts · `BLOCKED / NOTES:` anything you could not do,
any file outside your list that needs a change, any judgment call the coordinator should review.
