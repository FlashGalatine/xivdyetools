# Per-language pass — tool names, "glamour", policy follow-through (2026-09-20)

Worktree root — run everything from here, never `cd` out:
`C:\dev\XIVProjects\xivdyetools\.claude\worktrees\i18n-audit-2026-09-19`

You own exactly SIX files for your language `<lc>` and may edit nothing else:

- `apps/web-app/src/locales/<lc>.json`
- `packages/bot-logic/src/i18n/locales/<lc>.json`
- `apps/web-app/PRIVACY.<lc>.md`, `apps/web-app/TERMS_OF_SERVICE.<lc>.md`
- `apps/discord-worker/PRIVACY_POLICY.<lc>.md`, `apps/discord-worker/TERMS_OF_SERVICE.<lc>.md`

Four other agents are doing the same for the other languages. **Hard rules:** no git writes
(`add/commit/stash/checkout/restore/reset`), no builds, no `turbo`, no `pnpm install`, no edits to
`en.json`, to any English `.md`, to `og-strings.ts`, or to anything under `docs/`. The shell here
rejects long compound Bash lines — put anything non-trivial in a script under
`C:\Users\DrawF\.claude\jobs\cfa7ff8d\tmp\naming-<lc>\` and run it plainly; set
`PYTHONIOENCODING=utf-8` for CJK output. Locale JSON: UTF-8, LF, 2-space indent, never reformat
untouched lines, keep key order, keep `{placeholders}` verbatim. Policy `.md`: keep structure,
numbers, backticked tokens, URLs and the English-prevails notice exactly as they are.

Read first: `docs/reference/ffxiv-terminology.md` sections **Glamour Terms** and **Market and
Server Terms**, and `docs/audits/2026-09-19-i18n/evidence/official-terms-research-glamour.md`.

## Task 1 — the two tool names (maintainer decision 2026-09-20)

The English names are now official and final: **"Swatch Matcher"** (`tools.character.title`, was
"Character Matcher") and **"Harmony Explorer"** (`tools.harmony.title`, was "Color Harmony
Explorer"). `en.json` already says so. Your language's two titles still translate the OLD names.

1. Choose your language's title for each. Do not coin: choose among the renderings that already
   exist for your language (your prompt lists them) unless every one is genuinely wrong, and
   prefer the smallest change to the current title that makes it a translation of the new English
   name (Harmony: drop the "colour" part; Swatch: replace the "character" part with your language's
   established word for a swatch). Match the other seven `tools.*.title` values in the file for
   form (compounding, hyphenation, capitalisation, katakana vs native).
2. Set `tools.character.title` and `tools.harmony.title`.
3. Every OTHER value in both JSON files that names either tool in running text must use the new
   title, correctly inflected — find them by searching the file for the OLD title, for the old
   title's distinctive part, and for the current value of `resultCard.sentToSwatch`. The key
   names (`tools.character`) do not change.
4. Do not touch `shortName` values or any other tool's name.

## Task 2 — "glamour"

In this toolset "glamour" means **one outfit / look** ("Dyes on this glamour", "glamour palette",
"a glamour page on an allowed site", "glamour shot"). Use the dictionary's last row for your
language, in BOTH JSON files, with correct grammar (gender, case, articles, particles). List the
keys with `python docs/audits/2026-09-19-i18n/evidence/scripts/en-needle-values.py web glamour <lc>`
and `… bot glamour <lc>`, then also search the files for your language's OLD word(s) directly —
running text may use it where the English does not say "glamour". The mass-noun / hobby sense
("glamour enthusiasts") may need a different word; your prompt says which.

## Task 3 — your four policy translations follow the UI

The translations quote UI labels, and a quoted label must be the one on screen today.

1. Wherever a document names the Swatch Matcher or the Harmony Explorer, use your new titles.
2. Wherever a document says "glamour", use the dictionary word — in the register the document
   needs (your prompt says if your language has a formal alternative).
3. The header-gear panel is **"Advanced Settings"** — confirm each mention equals the current value
   of `config.advancedSettings` in your web-app JSON.
4. `apps/web-app/PRIVACY.md` (English) changed today ("Advanced Options" → "Advanced Settings"),
   so its date moved: in `apps/web-app/PRIVACY.<lc>.md` ONLY, change the Last-updated date from
   `2026-09-16` to `2026-09-20`. The other three documents keep `2026-09-16`.
5. Re-read every sentence you touched against the English for meaning — a term swap must never
   change a commitment.

## Verify

- `python "C:/dev/XIVProjects/.claude/skills/i18n-manager/scripts/locale-diff.py" apps/web-app/src/locales --locale <lc>`
  and the same for `packages/bot-logic/src/i18n/locales` → 0 missing / extra / placeholder faults.
- `node apps/web-app/scripts/reorder-locales.mjs --check` — your file still in key order.
- `python "C:/dev/XIVProjects/.claude/skills/audit-shared/scripts/policy-locale-parity.py"` — your
  four `ok <lc>` lines (other languages may be mid-edit; `apps/web-app/PRIVACY.md` will show a
  date mismatch for a language until its agent has done step 3.4).
- A python proof that your language's OLD glamour word(s) and OLD tool titles occur nowhere in
  your six files (or list each survivor and why it is legitimate).

## Report (your final message, ≤ 45 lines)

`TITLES:` the two chosen titles, exact strings, one line of reasoning each — the coordinator copies
them into the link-preview card table, so they must be exact ·
`CHANGED:` a table `| file | key or § | before | after |` of every value you changed (group
identical policy-document replacements with a count) ·
`NEW GLYPHS:` CJK languages only — the Han / kana / Hangul characters you introduced into
`packages/bot-logic/src/i18n/locales/<lc>.json` outside `commands.*.options` that were not in
that file before (compute with python against `git show HEAD:<path>`; needed for the font re-cut) ·
`VERIFY:` each command → result · `NOTES:` judgment calls the coordinator should review.
