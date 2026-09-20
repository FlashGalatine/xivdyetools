# Policy translation brief — I18N-010 (2026-09-19)

You translate the project's four legal documents into ONE target language. Read first:
`docs/audits/2026-09-19-i18n/evidence/remediation-brief.md` (hard rules — no git writes, no builds,
edit only your files, report format) and `C:\dev\XIVProjects\.claude\skills\audit-shared\policy-documents.md`.

## Source → target (create exactly these four files; touch nothing else)

| English (governing, READ-ONLY) | Your file |
|---|---|
| `apps/web-app/PRIVACY.md` | `apps/web-app/PRIVACY.<lc>.md` |
| `apps/web-app/TERMS_OF_SERVICE.md` | `apps/web-app/TERMS_OF_SERVICE.<lc>.md` |
| `apps/discord-worker/PRIVACY_POLICY.md` | `apps/discord-worker/PRIVACY_POLICY.<lc>.md` |
| `apps/discord-worker/TERMS_OF_SERVICE.md` | `apps/discord-worker/TERMS_OF_SERVICE.<lc>.md` |

## Rules — a mechanical parity gate enforces most of these

1. **Translate everything, change nothing.** Same meaning sentence by sentence. Never soften
   ("never" stays an absolute), never strengthen, never add, never drop a right, an obligation, a
   data item, a retention period or a condition. If a sentence is awkward in your language, keep
   the meaning and restructure the grammar — do not paraphrase the commitment.
2. **Structure is identical**: same headings in the same order and at the same `#` level, same
   section numbers, same number of list items and of table rows (keep Markdown tables as tables, the
   `|---|` row included), same bold/italic emphasis on the same phrases, same horizontal rules.
3. **Verbatim, never translated or reformatted**: everything inside backticks; every URL and email
   address; slash-commands (`/preferences`); hostnames; storage and product names (`localStorage`,
   `IndexedDB`, `KV`, `D1`, `R2`, Analytics Engine, Cloudflare, Discord, Universalis, XIVAPI,
   Perspective API, GitHub, Square Enix, FINAL FANTASY XIV, XIV Dye Tools); HTTP header names;
   **every number as the same ASCII digits** (no spelling out "30" as a word, no turning the word
   "two" into "2", no full-width digits, no localized decimal/thousands separators, units like
   `KB`/`MB` unchanged). Link *text* is translated; link *targets* are not.
4. **Last-updated line**: translate the label, keep the DATE as ISO `2026-09-16` (the same date as
   the English file — a translation is not a content change). Keep the rest of that line.
5. **English-prevails notice**: directly under the H1 title, add one blockquote in your language:
   "This is a translation provided for convenience. The English version is the authoritative
   text; if the two differ, the English version prevails." followed by a relative link to the
   English file, e.g. `[English](PRIVACY.md)`. The notice must contain **no digits** and no other
   link. Nothing else may be added anywhere.
6. **UI labels the document names** (buttons, toggles, menu paths, settings names such as
   "Enable Analytics") must be the label the user actually sees in your language: look it up in
   `apps/web-app/src/locales/<lc>.json` (web documents) or
   `packages/bot-logic/src/i18n/locales/<lc>.json` (bot documents) and use that exact string. If
   no localized label exists, keep the English label in quotes. Those two files are being edited by
   another agent right now — read them, never write them.
7. Game nouns per the official-term table in the remediation brief; the word for "dye" follows
   `packages/core/src/data/locales/<lc>.json` usage. Legal register appropriate to a consumer
   privacy policy / terms in your language (formal, clear, not archaic). Governing-law / venue /
   warranty-disclaimer / limitation-of-liability clauses: translate faithfully and list each one in
   your report under `INTERPRETED:` if any term had no exact equivalent and you had to choose.
8. UTF-8, LF line endings, final newline. ja/zh: full-width punctuation in prose; ko: ASCII
   punctuation; fr: French typography (espace insécable before `: ; ? !` is fine as a normal space).

## Verify before you report

From the worktree root: `python "C:/dev/XIVProjects/.claude/skills/audit-shared/scripts/policy-locale-parity.py"`.
It prints one line per document × locale; **your locale must read `ok` on all four documents**
(other locales may still be `missing` — other agents are working on them). Fix every
`FAIL <lc>` detail it prints (headings / list_items / table_rows / numbers / code / urls /
commands / Last-updated / notice) by correcting the translation — never by editing the English
file or the script. Then re-read each of your files once, top to bottom, against the English for
meaning (rule 1) — the script cannot check that.

## Report (≤ 40 lines)

`FILES:` four paths + line counts · `PARITY:` the four `ok` lines · `UI LABELS:` each UI label you
looked up → the locale key and value used · `INTERPRETED:` clauses that needed a choice, with the
English and your rendering · `NOTES:` anything in the English source that looks wrong or ambiguous
(do not fix it).
