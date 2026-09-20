# Policy translation verification brief — I18N-010 (VERIFIER role, read-only)

Worktree root (never cd out): `C:\dev\XIVProjects\xivdyetools\.claude\worktrees\i18n-audit-2026-09-19`

Four English legal documents are the governing text; each has been translated into five languages
as `<STEM>.<lc>.md` siblings. A mechanical gate already passes for all 20 files (same headings,
list/table counts, numbers, backticked tokens, URLs, slash-commands, date, English-prevails notice)
— **do not re-check those**. Your job is the part no script can do: does each translation make
**exactly the same promise** as the English?

| English (governing) | Variants |
|---|---|
| `apps/web-app/PRIVACY.md` | `apps/web-app/PRIVACY.<lc>.md` |
| `apps/web-app/TERMS_OF_SERVICE.md` | `apps/web-app/TERMS_OF_SERVICE.<lc>.md` |
| `apps/discord-worker/PRIVACY_POLICY.md` | `apps/discord-worker/PRIVACY_POLICY.<lc>.md` |
| `apps/discord-worker/TERMS_OF_SERVICE.md` | `apps/discord-worker/TERMS_OF_SERVICE.<lc>.md` |

Context you need: XIV Dye Tools is run by **one individual maintainer, not a company** (the English
says "we"/"I"/the maintainer's handle — check how each English document refers to the operator and
hold the translation to the same thing; a rendering that means "our company" / "当社" / "당사" /
"本公司" / "unser Unternehmen" / "notre société" is a meaning change). The project's stance is
"collect nothing personal". North Carolina governing law. Read
`C:\dev\XIVProjects\.claude\skills\audit-shared\policy-documents.md` for the convention.

## Check, sentence by sentence, for each variant of each document

1. **Strength of commitments**: absolutes stay absolute ("never", "no", "only", "not … at all",
   "complete list"); nothing softened ("normally", "in principle", "as far as possible") or
   strengthened; conditions and exceptions all present and attached to the same clause.
2. **Completeness**: no dropped or added sentence, data item, right, obligation, retention period,
   third party, deletion/opt-out path, age or eligibility condition, liability cap, warranty
   disclaimer, governing-law / venue wording, change-notification promise.
3. **Who does what**: subject and object not swapped (who stores, who deletes, who may terminate,
   who is liable); the operator is not turned into a company; "you" is the same party.
4. **Mistranslation with legal or practical effect**: false friends, "taken down" vs "downloaded",
   "may" vs "must" vs "will", "including" vs "only", "at least" vs "at most", tense (does vs did).
5. **UI labels are the ones the user sees TODAY.** The locale files changed during this work, after
   some translations were drafted. For every button / toggle / menu path / tool name a document
   quotes, confirm it equals the current value in `apps/web-app/src/locales/<lc>.json` (web
   documents) or `packages/bot-logic/src/i18n/locales/<lc>.json` (bot documents). Known changes to
   look for: fr is now sentence case (`Afficher les prix`, `Vérification d'accessibilité`, `Types
   de vision`, `Espace colorimétrique`); ko Market Board `장터`, World `서버`, Data Center
   `데이터 센터`; zh `市场布告板`, `服务器`, `大区`; de `Sehtypen`, `Perzeptuell`.
6. **Register and naturalness** only where it affects comprehension: an untranslated English
   sentence, a garbled sentence, inconsistent form of address within a language (du/Sie, tu/vous,
   です・ます vs plain, 합니다체), half-width punctuation in ja/zh prose. Do not nitpick style.
7. **The English-prevails notice** says: translation for convenience; the English version is
   authoritative; if they differ the English prevails — and nothing more or less.

Do NOT flag: dates rendered as ISO `2026-09-16` (required), numbers kept as ASCII digits,
backticked/brand/product names kept in English (`XIV Dye Tools`, `Universalis`, `Perspective API`,
`Global Privacy Control`), literal strings a user must type (email subjects, the maintainer's
Discord handle) kept in English, Korean `제3자`.

## Return (your final message; nothing else; ≤ 70 lines)

A table — one row per REQUIRED correction, most serious first:

`| # | file | § / heading | severity | English (exact quote) | current translation (exact quote, copy-pasteable) | replacement (exact text) | why |`

Severity: **A** changes a commitment, right, obligation or who-does-what · **B** wrong UI label or
term the user would not find · **C** comprehension (garbled / untranslated / inconsistent address).
The "current translation" cell must be an exact substring of the file so it can be replaced
mechanically; keep each replacement minimal. Then `CLEAN:` the files you read fully and found
nothing in, and `NOTES:` ≤ 5 bullets (e.g. an English source sentence that is itself ambiguous).
Read-only: write no files, run no git writes, no builds.
