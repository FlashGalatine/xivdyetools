---
name: documentation-audit
description: Use when asked for a documentation audit of xivdyetools, to check docs/ or the Discord bot's in-app /manual help for stale or inaccurate claims, to update /manual after bot commands changed, to compare project documentation with currently deployed apps and published packages, or to check English documents for British spellings that should be American ("spell check the docs", "American English", "British spellings").
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Agent, Skill
---

# Documentation Audit (xivdyetools)

Review `xivdyetools/docs/` and the bot's `/manual` help against the versions users can currently
access. Produce findings and suggested corrections. Implement a correction only when the request
asks for that work. A request such as "update /manual if needed" is enough to carry out
[manual-update.md](manual-update.md) once its findings are confirmed. No request authorizes a
deploy, a publish, or command registration. Run repository commands from `xivdyetools/`, or from
the worktree during an update.

Before starting, read [model-routing.md](../audit-shared/model-routing.md). The coordinator
applies its routing rules; this table gives the role for each step of this skill.

## Agent routing

| Step | Role | Assignment → return |
|---|---|---|
| Docs inventory, `docs:check-*` gates, `manual-check.mjs`, `american-spelling.mjs`, served-version lookups | `collector` | Fixed commands → exit codes, counts, evidence paths |
| Review one living-docs cluster (see *Review and verify*) | `worker` | Cluster paths + checklist + baseline rows → conventions §7 schema, `evidence/review-<cluster>.md` |
| Review `/manual` | `worker` | *`/manual` checklist* + served ref → same schema, `evidence/review-manual.md` |
| Confirm candidates at `file:line`, grade severity, separate release drift from defects | `verifier` | Candidate rows verbatim → model-routing's verification contract |
| `/manual` update: ja/de/fr/ko/zh drafts; gate runs; pre-commit review | `worker`; `collector`; `verifier` | See [manual-update.md](manual-update.md) |
| Report, finding files, changelog prose, all git operations | coordinator | Never delegated |

Every agent call passes its role's model **explicitly**, taken from the model-routing.md table. A
narrowed run with one cluster may run inline, except where model-routing's coordinator rules
require delegation (some coordinator models must delegate all three roles).

## Context and scope

Read the workspace and monorepo `CLAUDE.md`, `docs/CLAUDE.md`, applicable `AGENTS.md`, and
[units.md](../audit-shared/units.md) for **Deploy unit** tags. Read a target unit's `CLAUDE.md`
when checking its claims. Use [conventions.md](../audit-shared/conventions.md) §2–7a for IDs,
finding files, reports, evidence and fan-out, and [shell guidance](../audit-shared/traps/shell.md)
for its command patterns. Read [american-english.md](../audit-shared/american-english.md) for the
spelling standard — it applies to every English document in scope, and to this audit's own prose.

By default the audit covers every document under `docs/`, including its entry pages, plus
`/manual` and the **policy documents** — the two Privacy policies and two Terms of Service under
`apps/web-app/` and `apps/discord-worker/`, in all six languages (see *Policy documents* below).
A user may narrow the folders, units, or environment. App/package READMEs, source,
configuration, workflows, and `apps/api-worker/docs/` are supporting evidence. They are audit
targets only when the user asks.

Inventory tracked documents with `git ls-files -- docs`. Separately record untracked documents
with `git ls-files --others --exclude-standard -- docs`, and include the relevant ones as local
drafts with that status stated. Record branch, commit, and dirty state. Leave the current
audit's own output out of its inventory.

Apply the tier rules from `docs/CLAUDE.md`:

- **Living:** verify present-tense claims against the appropriate current baseline.
- **Archive (`audits/`, `historical/`):** inventory as historical context; do not flag old
  behavior or versions merely because production changed.
- **Frozen-body (`research/`, `superpowers/`):** check status lines and links; preserve the
  original proposal/research body. Distinguish planned behavior from shipped behavior.

## Establish what is currently served

Build a baseline table before judging release-dependent claims:
`| Unit | Environment/channel | Served/published version or revision | Evidence + checked-at time | Local version/commit | Verification limits |`.
Discover units from workspace manifests and routes/workflows. Do not hardcode unit counts,
versions, or domains, and do not assume every unit is public or published.

- **Apps:** use production unless the request or document explicitly targets another
  environment. Discover destinations from deployment configuration, and corroborate with
  read-only deployment records, version metadata, or live behavior. For an app deployed by a
  workflow on `main`, the `headSha` of its last successful run is the served revision:
  `gh run list --workflow deploy-<app>.yml --branch main --status success -L 1 --json headSha,createdAt`.
  A successful CI run or local `package.json` does not by itself establish what is serving
  traffic. Record traffic splits or multiple active revisions when deployment evidence shows them.
- **Published packages:** check registry dist-tags and metadata for the relevant release
  channel (normally `latest`). For API/export examples, inspect that release's artifact or
  source tied to its published revision. A local workspace dependency can differ from npm;
  an app can bundle a different package revision than npm `latest`.
- **Private, internal, or inactive units:** label their status. Use available deployment or
  consuming-build evidence; do not invent a public endpoint or claim a private package is
  published. Source-only checks remain explicitly source-only.
- Use fresh live or registry evidence for current claims, through read-only tools or APIs. Do not
  deploy, publish, register bot commands, or call mutating endpoints to test a doc. If access
  fails or a revision cannot be established, record the gap and continue with the checks that
  do not depend on it. Never quietly use local HEAD as the served baseline.

Match each claim to its audience: production guides use the served baseline; contributor
instructions may describe the checkout. A checkout/npm/production difference is release
drift to report, not automatically a documentation defect. Repository version tables still
follow the repository's manifest-based version gate.

## `/manual` (in-app bot help)

`/manual` is documentation that ships inside discord-worker. Its served text is whatever the
production discord-worker commit bundles: bot-logic comes through `workspace:*`, so npm's
bot-logic version does not decide it.

| What | Source of truth |
|---|---|
| Command roster | `apps/discord-worker/src/commands/registry.ts` (`COMMAND_REGISTRY`) |
| Syntax, subcommands, topic `choices` | `apps/discord-worker/src/commands/schemas.ts` |
| Behavior | `apps/discord-worker/src/handlers/commands/<command>.ts` |
| Topic roster + learn links | core `MANUAL_TOPICS` (`packages/core/src/config/learn-links.ts`) |
| `/manual` structure | `apps/discord-worker/src/handlers/commands/manual.ts` |
| `/manual` text | `packages/bot-logic/src/i18n/locales/<locale>.json` → `manual.*`, `manual5.*`, `matchImageHelp.*` |

**`git fetch origin main` first.** A session's clone can carry a stale `origin/main`, and the check
reads every file through it: the 2026-09-21 run's first pass reported 8 registered commands absent
from the overview against an `origin/main` 159 commits behind, and none absent after the fetch.
Then run `node <SKILL_DIR>/scripts/manual-check.mjs <xivdyetools-dir> --ref <served-sha>`, and again with
`--ref origin/main` when the two differ. If `gh` cannot establish the served SHA, try
`wrangler deployments list --env production` from `apps/discord-worker`, which is read-only. If
that fails too, run the check against `origin/main` and record in the baseline table that the
served revision is unverified. It reports each locale's reply sizes against Discord's
limits (6,000 characters per message, 1,024 per field value), any missing keys, and registered
commands the overview never names. It exits 1 when a reply is over a limit or a key is missing.

**`/manual` checklist:**

1. **Coverage:** every registered command appears. A command may be left out on purpose only if
   a source comment or decision record says so. For example, `registry.ts` records that `/a11y`
   shares `/accessibility`'s handler. Cite that evidence. Otherwise the omission is a finding.
2. **Syntax:** each syntax line matches the schema. Check the command and subcommand names,
   option names, required `<x>` versus optional `[x]`, and ranges.
3. **Claims:** each description matches the handler. Check counts (modes, harmony types,
   wheels, steps), defaults, and what the reply actually shows.
4. **Topics:** the schema's topic `choices`, the branches in `manual.ts` (`match_image` and
   `TOPIC_KEYS`), and `MANUAL_TOPICS` all list the same topics.
5. **Locales:** each non-en locale makes the same claims as en. If a translation still describes
   the old behavior, that is a finding for that locale. The en text is American English
   ([american-english.md](../audit-shared/american-english.md)); the sweep reads its `manual.*`,
   `manual5.*` and `matchImageHelp.*` values as the `ui-text` zone. Fix a whole surface at a time —
   correcting `/manual` while the rest of the bot's en strings stay British splits the bot's voice,
   so file those as well rather than half-fixing (they are `i18n-manager`'s `TERM-`, not `DOC-`).
6. **Other surfaces:** `/manual` agrees with `docs/user-guides/discord-bot/command-reference.md`
   and `docs/projects/discord-worker/commands.md`. Where they disagree, the source decides which
   one is wrong.

File each confirmed `/manual` finding as a `DOC-` finding. Point at the `en.json` key `file:line`
(or at `manual.ts`) and list the other locales affected. The **Deploy unit** is `discord-worker`.
When the fix changes bot-logic text, add the bot-logic publish to **Fix**.

## Policy documents (Privacy + Terms of Service, six languages)

Read [policy-documents.md](../audit-shared/policy-documents.md) first: it names the four documents,
the `<STEM>.<locale>.md` convention (English unsuffixed and governing), what parity means, and
which skill files which defect. These are the only user-facing legal text the project publishes
and they live outside `docs/`, so no other inventory step reaches them. Inventory with
`git ls-files 'apps/*/PRIVACY*.md' 'apps/*/TERMS_OF_SERVICE*.md'` and give every variant its own
row in the coverage table.

1. **Mechanical parity** (`collector`): run
   `python "<SKILL_DIR>/../audit-shared/scripts/policy-locale-parity.py" > <OUT>/evidence/policy-locale-parity.txt`
   from the monorepo root and record the exit status. It checks existence of all five variants per
   document, heading/list/table structure, the multiset of numbers, backticked tokens, URLs and
   slash-commands, the `Last updated` date, the English-prevails notice, and staleness against the
   English file's last commit. Exit 1 is a parity failure to triage, not a runner error.
2. **Meaning** (`worker` per language, `verifier` for the verdict): each variant read section by
   section against the English file. Flag a section that says something different, weaker or
   extra; an untranslated sentence; a command, toggle or UI path named differently from what that
   locale's UI actually shows (check `apps/web-app/src/locales/<lc>.json` and the bot's
   `<lc>.json` — the policy must use the label the user will see); game nouns that disagree with
   `docs/reference/ffxiv-terminology.md`. A difference in a privacy or data **claim** is
   `security-audit`'s finding — hand it over with the `file:line` pair rather than filing it twice.
   The English file is the governing text, so it is also read for American English
   ([american-english.md](../audit-shared/american-english.md)); the sweep's default surface already
   includes all four. A spelling fix there changes no claim, so it owes no re-translation and must
   **not** bump `Last updated` — the parity script fails every variant whose date differs from the
   English one. It compares commits as well, so an English-only commit makes all five variants
   report `stale: last commit … predates the English file's …` on the next run. That is expected
   from a spelling-only commit: record it in the audit's evidence so the next run does not chase it.
3. **Links and surfaces**: every surface that links a policy links the **viewer's locale variant**
   and falls back to English only when the variant is absent — web-app's About modal
   (`about-modal.ts`, `policyDocFile()`) and the Discord developer-portal URLs recorded in `docs/`.
   A localized link label over an English-only target is a finding. The bot's `/about` links **no**
   policy — it renders `PRODUCT_LINKS.webApp` + `inviteBot` + `SOCIAL_LINKS` and nothing else
   (verified 2026-09-21) — so there is nothing to check there; that the bot's two policies are
   reachable only from the Discord listing is a product question, not a `DOC-` finding, unless a
   living document claims otherwise.
   Relative links inside a variant resolve (`docs:check-links` does not cover `apps/*/PRIVACY*.md`
   variants unless the gate's tier list says so — check, don't assume).
4. **Agreement with `docs/`**: `docs/projects/*/overview.md`, the user guides and
   `docs/operations/ANALYTICS_QUERIES.md` describe the same retention, storage and third parties as
   the policies. Where they disagree, the source decides which is wrong; a wrong *policy* goes to
   `security-audit` (its accuracy row), a wrong *doc* is a `DOC-` finding here.

File as `DOC-` with **Deploy unit** = the document's owner (`web-app` or `discord-worker`) and list
every affected variant in **Location**. Severity: MEDIUM for a missing or stale variant or a
different claim, LOW for structure or a missing notice. `2026-09-19-i18n/I18N-010` (the four
documents were English-only) is **closed** — `FIXED 2026-09-20`, 20 translations plus locale-aware
About links, parity PASS — so every variant now exists and each new gap is its own finding.
A fix edits all six variants in one commit and bumps all six `Last updated` lines, **except** a
spelling-only fix to the English file, which changes no claim and must leave the dates alone.

## Review and verify

Read every in-scope living document and the applicable parts of frozen-body documents.
Maintain a per-file coverage table: tier, related units, baseline, reviewed sections, and
result (`reviewed`, `partial`, `historical context`, or `unverified` with a reason).

To delegate the review, split the living docs into clusters of roughly one deploy unit each:

- each `projects/<unit>/` folder together with that unit's `user-guides/` folder;
- the repo-wide folders: `architecture/`, `developer-guides/`, `operations/`, `maintainer/`;
- the entry pages together with `reference/`, `specifications/` and `versions.md`;
- one cluster for all frozen-body folders, checking status lines and links only.

Combine small clusters. Archive folders need no worker, because the collector's inventory covers
them. Before verifying, diff the living-tier inventory against the union of the clusters' file
lists: a split by sub-folder misses files that sit beside the folders (the 2026-09-18 run missed
`user-guides/public-api.md`). Finish one worktree's fan-out before switching worktrees — an agent
writes into whichever worktree the session is in when it runs, not the one its prompt names.

Check concrete claims about features, UI and bot commands, API routes/authentication/error
shapes, package exports and examples, data models, architecture/service bindings, environment
variables, setup/build/test/deployment instructions, migrations, versions, and links. Read the
examples that make production changes, but never run them as audit probes.

Run `pnpm docs:check-versions` and `pnpm docs:check-links`, recording command, exit status,
and relevant output. These gates check local consistency, not live parity or prose accuracy.
Keep out-of-scope failures separate. If a gate could not run, report it as unrun, never as
passing. Current-version tables belong only in the root `README.md` and `docs/versions.md`;
mentioning a past release elsewhere is allowed.

**Spelling.** Every English document in scope is read for American English, per
[american-english.md](../audit-shared/american-english.md) — that reference holds the standard, the
carve-outs, and the rule that the FFXIV terminology glossary wins wherever it conflicts (a game term
such as **Grey** or **Glamour** keeps the game's spelling and is never filed). A `collector` runs
`node "<SKILL_DIR>/../audit-shared/scripts/american-spelling.mjs" .` into
`evidence/american-spelling.txt`, once more with `--all` for the prose that sits inside code fences
(ASCII trees, English values in JSON examples), and returns the counts plus the exit status; exit 1
means candidates, not a broken run. Each cluster's `worker` confirms its own file's candidates at
`file:line` and also reads for British spellings the script's explicit dictionary misses. File one
`DOC-` per document listing every location, not one per word, at LOW severity unless the spelling
changes meaning or breaks a quoted identifier. When a whole tier is affected — the 2026-09-21 run
found 418 across 56 documents — file one per **cluster** instead, with the top three documents in
**Location** and the per-document table in `evidence/`; conventions.md §3 caps Location at three
bullets, so one-per-document does not survive that volume. Every `glossary?` and `multilingual-row?` candidate
the dictionary or a non-English table cell settles goes to *Rejected suspicions* with its reason.

Verify every candidate at its document `file:line` and at its supporting source, release, or live
evidence. Merge duplicate claims into one finding that lists every affected location. Separate
confirmed inaccuracies, missing documentation for a feature that exists, release drift, and
unverified claims. Grade confirmed findings HIGH (likely harmful operational advice), MEDIUM
(broken instructions or materially misleading behavior), or LOW (minor clarity/navigation).

## Deliverable

Write the audit to `docs/audits/YYYY-MM-DD-documentation/`. For a narrowed run, include a unit
slug in the folder name, and if the folder already exists, add a new suffix. Create `README.md`,
`DOCUMENTATION_AUDIT_REPORT.md`, `findings/DOC-001.md` onward for confirmed findings, and
`evidence/` as needed. Keep the version observations you made during the audit in this dated
evidence; do not add another living version table.

Use the shared finding skeleton with **Severity**, **Deploy unit**, and **Baseline** fields.
Include the incorrect claim, document location, evidence with retrieval time or revision,
reader impact, and an exact suggested correction or a precise description of missing content.
Keep verification gaps in the report, without assigning them confirmed-finding IDs.

The report includes:

- the baseline and coverage tables;
- gate results, including `manual-check.mjs` and `american-spelling.mjs`;
- a linked findings catalog;
- positive controls and rejected suspicions;
- release drift and verification gaps;
- prioritized corrections.

Account for every inventoried file, and say plainly where coverage is partial. Summarize the
result and link the report.

If the request includes updating `/manual`, follow [manual-update.md](manual-update.md) after the
report is written, and link its draft PR from the report. Use `remediation-planner` only if the
user asks for scheduling. Make any other correction only when the user's request includes it.
