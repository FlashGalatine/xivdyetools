# American English (xivdyetools)

Read this before auditing or editing any English text the project publishes — `documentation-audit`
(docs, `/manual`, the English policy documents) and `i18n-manager` (the `en` side of every locale
set) both file against it. The sweep that generates candidates is
[`scripts/american-spelling.mjs`](scripts/american-spelling.mjs).

## The standard

**English text in this project is American English.** A British spelling is a defect to flag and
correct. This covers the `docs/` living tier, the root / `apps/*` / `packages/*` `README.md` and
`CLAUDE.md` files, the four English policy documents, the `en` values in every locale set
(`packages/bot-logic`, `apps/web-app`, `apps/og-worker`'s string tables), `/manual`, both changelog
grammars, and the prose an audit skill writes into `docs/audits/`. It does not reach the five
non-English locales, and it never rewrites the archive (`docs/audits/`, `docs/historical/`) or
frozen-body (`docs/research/`, `docs/superpowers/`) tiers — those record the tree as it was.

This is not a new convention, it is the existing one generalized: `apps/og-worker/src/services/og-strings.ts`
has recorded "EN writes EN-US (Color, not Colour — superseding the 2a mock drafts)" in its header
since the card deck shipped, and its `en` block sweeps clean. Cite that file as a positive control
rather than re-checking it from scratch.

## The exception: the glossary wins

`docs/reference/ffxiv-terminology.md` and `docs/reference/glossary.md` are the terminology
dictionary. **Where the standard and the dictionary disagree, the dictionary wins.** Square Enix's
English localization is British-flavored in places, and a game term is a proper noun: it is spelled
the way the game spells it, in prose and in code alike.

Protected today:

| Term | Where | Never |
|---|---|---|
| **Grey** | the Facewear color key `grey` → `Grey`; the dye names Ash Grey, Goobbue Grey, Slate Grey, Charcoal Grey | → Gray |
| **Glamour** | the game system (`docs/reference/ffxiv-terminology.md` → *Glamour Terms*) | → Glamor |

The test: *does the word name something in the game, or something the project built?* `Ash Grey` is a
dye — it stays. "theme tokens replace hardcoded greys" describes the project's own CSS — that is
`grays`. Both spellings can sit in one paragraph, and that is correct.

A dictionary entry you believe should change is a terminology decision for the maintainer, not a
spelling fix. Never file it as one, and never quietly correct it while editing something else — put
it in the report's *Rejected suspicions* with the reason, so the next audit does not re-chase it.

## Not a spelling defect either

| Case | Example | Rule |
|---|---|---|
| Identifiers | `favourites` as a KV key prefix, a JSON field, a CSS class, an env var, a branch or package name | The document must quote the identifier **exactly as the code spells it**. A British identifier is a code change with its own blast radius — note it for the owning unit, never rewrite the doc away from the truth. |
| Non-English cells | fr `centre de données`, fr `Analogue`, de `Analog` in the terminology tables | The sweep tags these `multilingual-row?`. Reject. |
| Quoted material | a spec title, a license name in its official form, an upstream error string, third-party product names, **a shipped UI label a document names so the reader can find it** | Quotations are reproduced, not corrected. |
| Same in both | `dialogue` (a conversation — only the UI element is `dialog`), `analyses` (the noun plural), `towards`, `forwards`, `glamour`, `judgement` inside a legal quotation | Not listed in the dictionary; do not "fix" them. |

## The sweep

```bash
node "<SKILL_DIR>/../audit-shared/scripts/american-spelling.mjs" . > <OUT>/evidence/american-spelling.txt
node "<SKILL_DIR>/../audit-shared/scripts/american-spelling.mjs" . --all      # adds code/link zones
node "<SKILL_DIR>/../audit-shared/scripts/american-spelling.mjs" . packages/bot-logic/src/i18n/locales/en.json
```

Run from the monorepo root. With no paths it sweeps the default English surfaces (living docs tier,
English policy documents, `/manual` en strings); pass paths for a narrowed run. Exit 1 means
candidates were found — that is the expected result of a first run, not a runner error. Each row is
`location · zone · found · suggested · note`; the script's own docblock defines the zones and lists
its known limits (an explicit dictionary that under-reports, backtick and fence spans, the
`glossary?` / `multilingual-row?` notes).

**Run `--all` once per audit.** Prose hides in code zones: ASCII tree diagrams in
`docs/architecture/`, and English `"description"` values inside JSON response examples, are text a
reader sees. Triage those by hand — the default view suppresses them because most code-zone hits are
genuine identifiers.

These are candidates. Confirm each at `file:line` before filing, exactly as with any other
candidate in `conventions.md` §7.

**Known standing rejections** (verified 2026-09-21, do not re-chase): `apps/web-app/CHANGELOG.md`
names the shipped labels *Save character colours* (×2) and *Behaviour toggles*, which is what
`apps/web-app/src/locales/en.json` still says (`swatch.saveCharacter`, `advanced.behaviorTitle` —
an American key with a British value). The changelog is right to match the app. These three clear
themselves the moment those `en` values are corrected, which is `i18n-manager`'s `TERM-` work, not
an edit to the changelog.

## Filing

| Skill | Prefix | Header fields |
|---|---|---|
| documentation-audit | `DOC-` | **Severity** LOW (MEDIUM only where the spelling changes meaning or breaks a quoted identifier) · **Deploy unit** = the document's owner |
| i18n-manager | `TERM-` | Tier P2 · **Locale(s)** `en` · **Deploy unit** = the set's owner · dictionary row that settles it |

**One finding per document or per locale set, never one per word.** Give the count and the full
`file:line` list in **Location**, and point **Evidence** at `evidence/american-spelling.txt` rather
than pasting the table. Rejected candidates — every `glossary?` hit the dictionary settles, every
`multilingual-row?` — go to *Rejected suspicions* with their one-line reason.

## Fixing

- **Docs prose:** a straight edit. Keep it in its own commit; never fold a spelling pass into a
  behavior change, where it buries the real diff.
- **An `en` locale value:** shipped UI text. The five other locales carry no English, so the edit is
  en-only, but it still needs that set's gates — bot-logic's `locale-quality.test.ts` and web-app's
  `i18n-parity-gate.test.js` both key their identical-to-en and *same English → same translation*
  allow-lists off the **en value**, so a changed en string can turn an allow-list entry stale and
  fail the gate. Re-run the set's gates and update the allow-list reason in the same commit.
- **`/manual`:** shipped bot text — follow [`../documentation-audit/manual-update.md`](../documentation-audit/manual-update.md),
  including the version bumps and both changelogs.
- **Fix a whole surface at a time.** The bot and web-app `en` sets currently say *colour* in many
  strings. Correcting `/manual` alone would leave the bot saying "Color Vision" in one reply and
  "Colour Vision" in the next; that split is worse than either spelling. If only part of a surface is
  in scope, file the rest rather than half-fixing it.
- The skills' own output follows the standard too: findings, reports, changelog prose and commit
  messages are American English. So does the `.agents/skills/` prose itself — it was swept on
  2026-09-21, and this file's British words are quotations and worked examples, not slips.
