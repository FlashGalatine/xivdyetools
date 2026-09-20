# Policy documents (xivdyetools) — Privacy + Terms of Service, in six languages

Read by `security-audit` (claims vs code), `documentation-audit` (parity, links, agreement with
`docs/`) and `i18n-manager` (translation quality, terminology). Edit this file once when the facts
change; the skills only point here.

## The four documents

| Document | Owner unit | Linked from | `Last updated` format |
|---|---|---|---|
| `apps/web-app/PRIVACY.md` | web-app (covers web + beta; describes api-worker, og-worker, oauth, presets-api behaviour) | About modal → `about.privacyPolicy` (`about-modal.ts` `POLICY_DOCS_BASE`) | `**Last updated:** YYYY-MM-DD` |
| `apps/web-app/TERMS_OF_SERVICE.md` | web-app (added 2026-09-16; NC governing law) | About modal → `about.termsOfService` | check the file — keep its own format |
| `apps/discord-worker/PRIVACY_POLICY.md` | discord-worker (describes presets-api, Perspective) | Discord developer-portal URL only — the bot emits **no** link to it in code (checked 2026-09-20), and the portal takes one URL, so it points at the English file, whose notice links nothing; a reader reaches a translation from the repo listing | `**Last Updated**: Month D, YYYY` |
| `apps/discord-worker/TERMS_OF_SERVICE.md` | discord-worker | same | `**Last Updated**: Month D, YYYY` |

## Localization convention (maintainer decision 2026-09-19, `2026-09-19-i18n/I18N-010`)

All four documents are to exist in **every supported locale** (`en ja de fr ko zh`).

- The unsuffixed file is **English and is the governing version**. Translations are siblings named
  `<STEM>.<locale>.md` — `PRIVACY.ja.md`, `TERMS_OF_SERVICE.de.md`, `PRIVACY_POLICY.ko.md`.
  Discover them with `git ls-files 'apps/*/PRIVACY*.md' 'apps/*/TERMS_OF_SERVICE*.md'`; never
  hard-code a list of variants.
- Every translation opens with a localized notice: it is a translation for convenience, the English
  version prevails in case of any difference, with a link to the English file. A translation
  without that notice is a finding.
- The surface that links a document links the **viewer's locale variant**, falling back to English
  when a variant is absent — web-app's About modal does (`policyDocFile()` in `about-modal.ts`). If
  the bot ever gains a policy link, it resolves by the user's locale the same way.
- **One commit changes all six.** A content change to the English file that does not touch the
  five siblings in the same commit is a parity defect the moment it merges; so is a translation
  edited alone. `Last updated` is the same *date* in all six variants of a document (the format
  may be localized; the date may not differ).
- Legal/defined terms, section numbering, retention numbers, command names (`/preferences`),
  hostnames, storage names (`localStorage`, `KV`, `D1`) and third-party names stay **verbatim**
  across variants. Game nouns follow `docs/reference/ffxiv-terminology.md`.

**Status:** all 20 variants were written, reviewed and gated on 2026-09-20 (branch
`worktree-i18n-audit-2026-09-19`, PR #192). Until that merges, a checkout of `main` still shows no
variants — that is the one known open finding `2026-09-19-i18n/I18N-010`, not twenty new ones.
Once a variant of a document exists on the branch being audited, every gap for that document is a
fresh finding.

## What "parity" means (each is a finding when it fails)

1. **Existence** — 6 variants per document (after remediation); no orphan variant whose English
   source is gone.
2. **Structure** — same heading count and order, same section numbers, same number of list items
   and table rows per section.
3. **Hard facts** — the multiset of numbers (retention periods, TTLs, ages, dates), backticked
   tokens, URLs/hosts and slash-commands in a variant equals the English file's.
4. **Freshness** — same `Last updated` date; a variant whose last commit predates the English
   file's last *content* commit is stale (`git log -1 --format=%cI -- <file>`). ja / ko / zh
   variants keep **one paragraph per line** — a hard wrap between two CJK characters renders as a
   stray space (the script counts them).
5. **English-prevails notice** present, localized, linking to the English file.
6. **Meaning** — a reviewer who reads the language confirms each section makes the *same claims*:
   nothing softened ("never" → "normally not"), nothing added, no obligation or right dropped, no
   sentence left in English. This is `worker` (draft) + `verifier` (verdict) work per
   `model-routing.md`; items 1–5 are mechanical (`collector`).
7. **Agreement with in-product copy** — the privacy strings in `apps/web-app/src/locales/<lc>.json`
   and the bot's `<lc>.json` say the same thing as that locale's policy variant.

Mechanical sweep for 1–5 (writes nothing; exit 1 when any check fails):

```bash
python "<AUDIT_SHARED>/scripts/policy-locale-parity.py" > <OUT>/evidence/policy-locale-parity.txt   # run from the monorepo root
```

## What the first translation pass taught (2026-09-20, 20 files, 32 corrections)

The mechanical gate passed on all 20 files *before* two `verifier` reviewers found four commitment-
changing errors. Parity is necessary and nowhere near sufficient. Check for these by name:

- **The operator is one person, not a company.** ja 当社, ko 자사 / 당사, zh 本公司, de *unser
  Unternehmen*, fr *notre société* all incorporate the maintainer. ja drafted 当社 45 times. Use
  運営者 / 저희·자체 / 我们 / wir / nous.
- **A modifier attached to the wrong verb flips a clause.** zh "presets published *after you
  leave* may stay up" (for: presets you published may stay up after you leave) dropped the
  licence-survival promise; fr `ne vous permet pas de renoncer` without `auquel il` detached
  non-waivability from local law. Read every governing-law, liability and survival clause twice.
- **False friends across CJK.** ja 利用 is plain "use" (zh 利用 = exploit): "do not abuse, *use*
  or circumvent rate limits" bound users to something the English never asks.
- **One word for two things.** de `Sammlung` for both a telemetry *batch* and the user's saved
  *collections* ("discards every collection…"); ko 서버 / zh 服务器 for both a Discord server
  (id NOT stored) and an FFXIV World (stored) two table rows apart — use the shipped label
  (`마켓 서버`, `市场服务器`).
- **Quoted UI labels go stale during the work.** Translations drafted while the locale JSON is
  being edited quote the old label. Verify every quoted button / toggle / filter name against the
  *current* `<lc>.json` last, after all locale edits have landed.
- **The English can be the stale one.** `PRIVACY.md` told users to go to "Advanced Options"; the
  panel is "Advanced Settings" (`config.advancedSettings`). All five translators looked the label
  up and wrote the right one, so the translations were correct where the governing text was not.
  Check every UI path the ENGLISH quotes against `en.json` as well (corrected 2026-09-20, with the
  date bumped on all six variants of that document — a label a user must follow to opt out or
  delete data is content, not typography).
- **Game nouns need the dictionary, not fluency.** "glamour" was ja グラマー / ko 글래머 (both mean a
  voluptuous figure), de Mirage / Glamour, fr glamour with the wrong gender — every one written by
  a fluent translator with no row to look up. `docs/reference/ffxiv-terminology.md` now has
  *Glamour Terms* and *Market and Server Terms*; add a row before translating a new game noun.
- **The gate must never force unnatural wording.** Korean writes "third party" as 제3자; a
  translator respelled it 제삼자 to satisfy the digit multiset. `LEXICAL_DIGIT_WORDS` in the script
  is the escape hatch — add a word there only when the digit is lexical. Spelled-out English
  quantities ("a dozen", "a daily marker") must stay digit-free in the translation too.
- **Ambiguous English costs five translations.** "dyes closest to any hex color or extracted from
  images" and "a right your local law gives you and does not let you waive" were each parsed two
  ways. When a reviewer reports two languages diverging on one sentence, fix the English.
  (Fixed 2026-09-20: "…or to colors extracted from an image"; "…any consumer-protection right
  that the law of the place where you live gives you and that the same law does not let you
  waive". Two lessons inside that one: **name the subject of every clause** — "the same law" is
  clunky prose and exactly right for a translation source; and **say WHOSE law** — "your local
  law" directly after a sentence naming the North Carolina courts can be read as the venue's law,
  which inverts the clause. *Place*, not *country*: non-waivable consumer rights are often state
  or provincial. ja 居住地 had it right before the English did.)
- **Never hard-wrap a CJK paragraph.** A Markdown soft line break renders as a SPACE, so a ja / ko
  / zh paragraph wrapped between two CJK characters shows a stray space inside the sentence on
  GitHub (`您居住地 法律赋予`). All four zh files had it (74 breaks; ja and ko did not) and nobody
  saw it in a diff, because a diff does not render. One paragraph per line; the parity script
  fails on it since 2026-09-20. Tell translators in the brief.
- Workflow that worked: one `worker` translator per language (4 documents each, parity gate as its
  exit condition) → two `verifier` reviewers (de+fr, ja+ko+zh) returning exact-substring corrections →
  the coordinator applies them with a script that refuses a non-matching row and is idempotent.

## Who files what

| Defect | Skill | Prefix | Severity guide |
|---|---|---|---|
| A claim (any language) is false against the code | security-audit | `FINDING-` (`Policy:` CORRECT/AMEND, list **every** variant to edit) | per its accuracy row |
| A variant makes a *different* privacy/data claim than English (softened, omitted, added) | security-audit | `FINDING-` | MEDIUM, INTERNET-UNAUTH — a user is promised something else in their language |
| Missing / stale / structurally divergent variant, missing notice, dead link, wrong locale linked, disagreement with `docs/` | documentation-audit | `DOC-` | MEDIUM (missing, stale, wrong claim) · LOW (structure, notice) |
| Untranslated sentence, terminology, register, punctuation in a variant | i18n-manager | `I18N-` / `TERM-` | P2 / P3 |

One defect, one finding: when two skills run together the planner merges; when in doubt the row
higher in the table owns it.

## Remediation rules

- A `Policy` CORRECT/AMEND fix edits **all six variants in one commit**, bumps every variant's
  `Last updated`, and — being user-visible — goes in the laymans changelogs. The bot policy's §11
  announcement promise applies to the change, not per language.
- Translations of legal text are listed in the commit/report like any generated translation
  ("never auto-translate silently"); the maintainer is not a lawyer's substitute — flag any clause
  whose translation needed interpretation rather than rendering.
