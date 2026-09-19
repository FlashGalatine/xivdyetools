# Documentation audit — whole repository + the bot's `/manual` (2026-09-18)

- **Branch/commit:** `worktree-docs-audit-2026-09-18` off `origin/main` `0fec18f4` (clean tree, no untracked docs)
- **Scope:** every document under `docs/` plus the Discord bot's in-app `/manual`. READMEs, per-unit
  `CLAUDE.md`, source, config, workflows and `apps/api-worker/docs/` were supporting evidence only.
- **Method:** a collector ran the inventory, both docs gates, `manual-check.mjs` and the
  served-version lookups; twelve reviewers each fact-checked one cluster against source; three
  verifiers (plus the `/manual` pre-commit reviewer, for the late candidate) re-opened every candidate at `file:line` and graded it. 52 candidates → 49 confirmed →
  merged into the findings below, together with three facts the verifiers found outside the
  candidate list (two became DOC-011, one DOC-038). The audit pass modified no source or living document; the
  remediation pass that followed the same day did, in separate commits (see *Remediation status*).
- **Totals:** 38 findings — 1 HIGH, 26 MEDIUM, 11 LOW (DOC-038 surfaced while verifying a fix) ·
  **Status:** every finding fixed on a branch the same day — 29 in #190, 9 in #189, public-site
  twins in #191; nothing merged yet (see *Remediation status*)

The previous audit (`2026-09-05-documentation`, merged as `39e08c32`) fixed about 600 findings, so
this one is mostly a measure of 13 days of drift: nine feature and fix PRs (#171–#173, #183–#188)
touched 14 living pages between them. Two things were not drift. The `/manual` text was never
brought to 5.0 — it predates the last audit, which did not look at it — and the HIGH finding is a
"Required" column that was already wrong.

## Baseline — what is actually served

| Unit | Channel | Served / published | Evidence (checked 2026-09-18) | Local | Limits |
|---|---|---|---|---|---|
| web-app, discord-worker, moderation-worker, presets-api, oauth, api-worker, og-worker, image-worker | production | `0fec18f4` | last successful `deploy-<app>.yml` run on `main`, 2026-09-18T12:47Z (`evidence/served-revisions.txt`) | `0fec18f4` | workflow success, not a live probe; no traffic split visible from `gh` |
| web-app beta, discord-worker beta, og-worker beta | beta | not established | the `*-beta.yml` workflows have no successful run on `main` by design | — | beta was out of scope |
| stoat-worker | none (parked) | — | no deploy workflow | 0.3.1 | source-only |
| `@xivdyetools/types`, `auth`, `svg` | npm `latest` | 3.2.0, 2.0.2, 4.1.0 | registry API (`evidence/npm-versions.txt`) | same | — |
| `@xivdyetools/logger`, `worker-kit`, `core`, `bot-logic` | npm `latest` | 2.2.0, 1.3.0, 5.2.0, 4.2.0 | same | **2.2.1, 1.4.0, 5.3.0, 4.3.0** | release drift, below |
| `@xivdyetools/test-utils` | private | not published | `private: true` | — | consumers resolve it from the workspace |

Production runs the commit this audit read, so for every app the checkout **is** the served
baseline. The apps bundle packages through `workspace:*`, so the four unpublished package versions
are already live inside the workers; only npm consumers see the older ones.

## Gates

| Gate | Exit | Result |
|---|---|---|
| `pnpm docs:check-versions` | 0 | 34 version claims across `README.md` and `docs/versions.md` match `package.json` |
| `pnpm docs:check-links` | 0 | 887 relative links across 241 documents resolve |
| `manual-check.mjs . --ref 0fec18f4` | 0 | every locale's replies fit Discord's limits (largest: fr `match_image`, 3,266 / 6,000; largest field 458 / 1,024); no missing keys; **8 of 17 registered commands absent from the overview** — the script reports that without failing on it |

All three are green and none of them could see any finding below: they check local consistency,
not whether the prose is true.

## Coverage

2,083 tracked files under `docs/`. Per-file rows are in each cluster's `evidence/review-*.md`.

| Cluster | Tier | Files | Result | Candidates → confirmed | Evidence |
|---|---|---|---|---|---|
| `projects/discord-worker`, `user-guides/discord-bot` | living | 8 | reviewed | 1 → 1 | `review-discord-worker.md` |
| `projects/web-app` | living | 4 | reviewed | 3 → 3 | `review-web-app-projects.md` |
| `user-guides/web-app`, `user-guides/index.md` | living | 13 | reviewed | 6 → 6 | `review-web-app-user-guides.md` |
| `user-guides/public-api.md` | living | 1 | reviewed (late — see *Late cluster*) | 1 → 1 | `review-public-api-guide.md` |
| `projects/{presets-api,moderation-worker,oauth}` | living | 10 | reviewed | 6 → 5 | `review-presets-moderation-oauth.md` |
| `projects/{api-worker,og-worker,universalis-proxy}`, `projects/index.md` | living | 5 | reviewed | 3 → 3 | `review-api-og-workers.md` |
| `projects/{core,types,logger,test-utils}` | living | 8 | reviewed | 1 → 1 | `review-packages.md` |
| `architecture`, `maintainer`, `reference` | living | 13 | reviewed | 4 → 4 | `review-architecture-maintainer-reference.md` |
| `developer-guides`, `operations` | living | 19 | reviewed; `ANALYTICS_QUERIES.md` partial (SQL columns spot-checked, not re-derived) | 8 → 8 | `review-devguides-operations.md` |
| `index.md`, `README.md`, `CLAUDE.md`, `versions.md`, `specifications` | living | 11 | reviewed | 5 → 4 | `review-entry-specs.md` |
| `research`, `superpowers` | frozen-body | 128 (107 `.md`) | status lines, index coverage and links only | 6 → 5 | `review-frozen-body.md` |
| `/manual` (6 locale files, `manual.ts`, schema, registry, handlers) | shipped bot text | 13 | reviewed | 8 → 8 (+2 found in verification) | `review-manual.md`, `verify-manual.md` |
| `audits`, `historical` | archive | 1,863 | historical context — inventoried, not fact-checked | — | `docs-inventory.txt` |

## Catalog

| ID | Title | Severity | Kind | Deploy unit |
|---|---|---|---|---|
| [DOC-001](findings/DOC-001.md) | `environment-variables.md` marks three presets-api secrets "Required: No" that production refuses to start without | HIGH | WRONG | presets-api |
| [DOC-002](findings/DOC-002.md) | `environment-variables.md` omits two secrets discord-worker reads | MEDIUM | MISSING | discord-worker |
| [DOC-003](findings/DOC-003.md) | `/manual` documents the deleted 4.x `/swatch color\|grid` instead of the `.chara` command | MEDIUM | WRONG | discord-worker |
| [DOC-004](findings/DOC-004.md) | `/manual topic:match_image` documents `/match` and `/match_image`, both deleted in 5.0, with four wrong numbers | MEDIUM | PLANNED-VS-SHIPPED | discord-worker |
| [DOC-005](findings/DOC-005.md) | `/manual` says it lists "all available commands" and names 9 of 17 | MEDIUM | MISSING | discord-worker |
| [DOC-006](findings/DOC-006.md) | `/manual` lists 7 of `/harmony`'s 10 types and never mentions colour wheels | MEDIUM | WRONG | discord-worker |
| [DOC-007](findings/DOC-007.md) | `/manual` gives `/gradient` the wrong option names and the wrong step range | MEDIUM | WRONG | discord-worker |
| [DOC-008](findings/DOC-008.md) | `/manual` describes `/mixer` as one blend; it is a five-ratio sweep | MEDIUM | WRONG | discord-worker |
| [DOC-009](findings/DOC-009.md) | `/manual topic:character_file` names 5 of `/swatch`'s 7 colour slots | MEDIUM | WRONG | discord-worker |
| [DOC-010](findings/DOC-010.md) | `/manual` documents a `/preferences set <key> <value>` shape that does not exist | LOW | WRONG | discord-worker |
| [DOC-011](findings/DOC-011.md) | `/manual` tips: "All commands support autocomplete" is false, and the Facewear tip describes a filter that no longer exists | LOW | WRONG | discord-worker |
| [DOC-012](findings/DOC-012.md) | Two documents give the concurrent-moderation 409 the wrong error code, and one calls `CONFLICT` "Reserved" | MEDIUM | WRONG | presets-api |
| [DOC-013](findings/DOC-013.md) | presets-api docs never mention `content_revision`: the column, migration 0014, or the 409 it produces on edit and revert | MEDIUM | MISSING | presets-api |
| [DOC-014](findings/DOC-014.md) | The preview-image moderation route is documented with a body the handler rejects | MEDIUM | MISSING | presets-api |
| [DOC-015](findings/DOC-015.md) | `api-contracts.md` says presets-api writes five `moderation_log` actions; it writes six | MEDIUM | MISSING | presets-api |
| [DOC-016](findings/DOC-016.md) | `interactions.md` implies only the GitHub webhook counts real body bytes | MEDIUM | WRONG | discord-worker |
| [DOC-017](findings/DOC-017.md) | `contributing.md` says `main` has two required checks; the dated check in `OPEN_ITEMS.md` records three | MEDIUM | WRONG | repo |
| [DOC-018](findings/DOC-018.md) | Two web-app documents still say the Palette Extractor has no share link | MEDIUM | WRONG | web-app |
| [DOC-019](findings/DOC-019.md) | The Swatch item-links menu (5.9.0) and glamour list Copy / Export .md (5.10.0) appear nowhere in `docs/` | MEDIUM | MISSING | web-app |
| [DOC-020](findings/DOC-020.md) | `web-app/overview.md` says every backend enforces an origin allowlist; api-worker allows `*` | MEDIUM | WRONG | web-app |
| [DOC-021](findings/DOC-021.md) | `swatch-matcher.md` prints a ΔE scale the app does not use | MEDIUM | WRONG | web-app |
| [DOC-022](findings/DOC-022.md) | `swatch-matcher.md` lists an incomplete ⋮ menu | MEDIUM | WRONG | web-app |
| [DOC-023](findings/DOC-023.md) | `swatch-matcher.md` says reverse matching lights "the three closest swatches"; the count follows Max results | MEDIUM | WRONG | web-app |
| [DOC-024](findings/DOC-024.md) | `community-presets.md` states the submission limit as 10 per hour; it is 10 per day | MEDIUM | WRONG | presets-api |
| [DOC-025](findings/DOC-025.md) | `budget-aware-suggestions.md` is the one living spec with no as-shipped banner, and describes a design that did not ship | MEDIUM | PLANNED-VS-SHIPPED | web-app |
| [DOC-026](findings/DOC-026.md) | `versions.md` says auth 2.0.2 still needs publishing (it is published) and names none of the four packages that do | MEDIUM | STALE-VERSION | repo |
| [DOC-027](findings/DOC-027.md) | Four frozen-body `Status:` lines still say planned / pending for work that shipped | MEDIUM | PLANNED-VS-SHIPPED | repo |
| [DOC-028](findings/DOC-028.md) | `superpowers/README.md` does not index the sprint-0 webhook-bytes plan | LOW | MISSING | repo |
| [DOC-029](findings/DOC-029.md) | Developer guides state Vitest 4 and Playwright 1.62; the repo is on Vitest 5 and Playwright 1.63 | LOW | STALE-VERSION | repo |
| [DOC-030](findings/DOC-030.md) | `environment-variables.md` omits oauth's optional `XIVAUTH_CLIENT_SECRET` | LOW | MISSING | oauth |
| [DOC-031](findings/DOC-031.md) | presets-api `endpoints.md` banner gives the legacy-itemID cutoff as 5729; the check is 5000 | LOW | WRONG | presets-api |
| [DOC-032](findings/DOC-032.md) | api-worker `endpoints.md`: two error codes missing from the reference table, two parameter caps undocumented | LOW | MISSING | api-worker |
| [DOC-033](findings/DOC-033.md) | test-utils overview omits `resetMockDyeSequence()` and `randomStainId()` | LOW | MISSING | test-utils |
| [DOC-034](findings/DOC-034.md) | `data-flow.md`'s JWT example lacks `jti` | LOW | MISSING | oauth |
| [DOC-035](findings/DOC-035.md) | `dependency-graph.md` counts 28 `@internal` symbols in core; there are 17 | LOW | WRONG | core |
| [DOC-036](findings/DOC-036.md) | `multi-color-extraction.md` names a component file that does not exist | LOW | WRONG | web-app |
| [DOC-037](findings/DOC-037.md) | `public-api.md` shows `X-RateLimit-Remaining: 59`; in production the header is only ever 64 or 0 | MEDIUM | WRONG | api-worker |
| [DOC-038](findings/DOC-038.md) | `glossary.md` prints a pre-5.0 ΔE scale as "the bands for CIEDE2000" — and five guides link to it for more | MEDIUM | WRONG | web-app |

## Late cluster — `docs/user-guides/public-api.md`

The first fan-out split `user-guides/` by its two sub-folders and missed the one page that sits
beside them. It was reviewed afterwards (`evidence/review-public-api-guide.md`): every endpoint,
parameter, limit, example and link checked out, all four public route families are covered, and
one candidate came back — confirmed by the verifier as **DOC-037** (MEDIUM): the example header
`X-RateLimit-Remaining: 59` can never occur in production, where the value is synthetic (64 while
allowed, 0 when denied) and the guide does not say so.

## Positive controls

Checked and right — do not re-file:

- All 17 version rows, the "17 projects / 9 tools / 125 dyes / 11 Facewear colours / 6 languages" counts and the dev-server ports on the entry pages.
- `dependency-graph.md`'s full matrix against all 17 `package.json` files; `service-bindings.md`'s bindings and rate-limit namespace ids against every `wrangler.toml`.
- discord-worker's `command-reference.md` and `commands.md`: roster, every option table, choices, ranges, rate limits, the 22 `/budget quick` picks, all 13 SVG generator names.
- api-worker and og-worker pages: rate limits, cache TTLs, domains, all 11 `/og/*` routes, the share-URL grammar of all nine tools.
- presets-api rate limits, the Perspective pipeline (fail-closed), notification retries; oauth redirect allowlist, JWT claims, refresh grace, all six rate-limit tiers.
- core / types / logger / test-utils: every `exports` map, the band-vocabulary tables, both `JWTPayload` shapes; no barrel changed since the last audit.
- Web-app guides: Harmony's 10 types and 5 wheels, Gradient, Mixer, Extractor, Budget, Comparison and Presets limits, all against source constants. The Extractor's mobile "camera" affordance survives #172 (the file-input capture path was kept).
- `/manual`: the four other 5.0 topics (`color_vision`, `contrast`, `matching_methods`, `spectrum_prices`) are correct, the topic roster agrees across schema, `manual.ts` and core's `MANUAL_TOPICS`, and the `commands.*` block behind `/about` is current for all 17 commands — the staleness is confined to `manual.*` and `matchImageHelp.*`.
- No deploy page tells anyone to run `wrangler d1 migrations apply`, publish locally, or use `--otp`.

## Rejected suspicions

- **`moderation.md` omits the revert 409** — that page is the pipeline overview and carries no status codes; the gap belongs to `endpoints.md` and is in DOC-013.
- **`multi-color-extraction.md` documents a live `/match_image … colors:1-5`** — the page's own Overview carries an "As shipped" sentence with the 3-10 range and `/extractor image`.
- **`04-proposed-changes.md` "no code changed in this pass"** — pass-scoped and pinned to a base commit; it claims nothing about today, which is what frozen-body means. `research/index.md` carries the current state.
- **Facewear category count differs between `ffxiv-terminology.md` (9) and `adding-dyes.md` (8)** — two different vocabularies, each correct.
- **`stainID: number | null` in api-worker docs** — the type is declared that way; it is simply never null in practice.
- **`/a11y` missing from `/manual`** — deliberate and recorded (`registry.ts:45-46`).
- **`/manual` syntax lines omit optional flags** — house style: required options plus the headline optional ones. Only wrong names and wrong ranges were filed.

## Release drift (not defects)

- **Four packages are ahead of npm**: logger 2.2.1, worker-kit 1.4.0, core 5.3.0, bot-logic 4.3.0. Actions → *Publish Packages to npm* is owed for each. DOC-026 is the documentation side of this.
- Anything in `docs/projects/{core,logger}` that describes 5.3.0 / 2.2.1 behaviour describes the checkout and the deployed workers, not npm `latest`. No such claim was found to be wrong.

## Verification gaps

- ~~`docs/projects/discord-worker/rendering.md`'s CJK codepoint counts (SC 1,129 / JP 556 / KR 489)~~ — **closed in remediation**: the cmaps at `0fec18f4` hold JP 622 / KR 582 / SC 1,202 codepoints, so the numbers were wrong, and they move with every locale edit. The page now says what decides and what enforces the subsets instead (`4b912720`).
- ~~`contributing.md`'s required-checks list (DOC-017)~~ — **closed in remediation**: branch protection was read live (`gh api …/branches/main/protection/required_status_checks`, 2026-09-18) — three checks; `monorepo-2.0-prep` no longer exists.
- ~~`apps/api-worker/docs/` was out of scope~~ — **closed in remediation**: surveyed, same `page` / `q` / rate-limit-example gaps found, fixed in PR #191.
- Beta environments and the live responses of the public API were not probed; "served" means "last successful production deploy".
- Non-English `/manual` text was compared with English claim by claim at the syntax lines and numbers; the prose around them was not back-translated word for word.

## Recommendations

- Make `manual-check.mjs`'s roster check a **test** in `manual.test.ts` (done in the `/manual` PR), so the next new command cannot ship without a help entry.
- Generate the `environment-variables.md` "Required" column from each worker's `validateEnv`, or add a test that fails when a name in `requiredStrings` is missing from the page.
- Stop stating npm publication state in prose (`versions.md`) — the version gate cannot check it.
- Drop counts nothing enforces (`@internal` symbols, tool minor versions).
- Add "user guide + project page" to the PR checklist for user-visible web-app features: #173 and #187 shipped with changelog entries and no documentation.
- Extend the status-line convention in `superpowers/README.md:27` to `research/` and check it in the link gate (a `Status:` line containing "pending" or "awaiting" for a PR number that is merged).

## Remediation status

The first request covered the audit and `/manual`; a second, the same day, asked for everything
to be resolved. Six fix agents worked disjoint file sets, three verifiers then re-checked every
changed hunk against source (their corrections are in the commits), and nothing is left OPEN.
All commits below are on this branch (PR #190) unless a PR is named; **none of the three PRs is
merged**.

| ID | Status | Commit / PR |
|---|---|---|
| DOC-001, 002, 017, 029, 030, 033 | FIXED | `146cee72` |
| DOC-012, 013, 014, 015, 024, 031, 034, 035 | FIXED | `b7754ee9` |
| DOC-018, 019, 020, 021, 022, 023, 025, 036, 038 | FIXED | `589846b0` |
| DOC-016, 032, 037 | FIXED in `docs/`; app-local twins in #189 / #191 | `4b912720` · #189 `45051233` · #191 `2a87d3e0` |
| DOC-026, 027, 028 | FIXED (7 of 22 marker removals live in #189 / #191) | `b9428956`, `da661eb0` |
| DOC-003 … DOC-011 (`/manual`) | FIX PROPOSED — draft PR #189 | `29e055e9`, `45051233`, `ba97c9d4` |
| Pre-merge review fixes (2026-09-19) | one corrective commit per PR | `8dbf57f2` · #189 `e94f8fd4` · #191 `c6de8507` |

**What verification changed.** Every finding was confirmed resolved, but the verifiers found more
than they were sent: a false sentence next to a fixed one (`dependency-graph.md` — `@internal`
symbols *are* in the barrel), a pre-existing false claim on the HIGH page (`ENVIRONMENT` is also
read by `/stats`), an undocumented dev var (`UNIVERSALIS_PROXY_URL`), three new-prose errors in
the Swatch guide (which lens has which click target, the shorter Facewear menu, and a claim
about pasting into Discord that no source supports — the guide now says what the source says:
bold in Word and Google Docs, plain text elsewhere), the telemetry route's own Origin allowlist,
the root `README.md` still saying "Vitest 4", and DOC-038.

**Pre-merge review (2026-09-19).** Before merging, nine independent reviewers went over the three
PRs — code and English facts, the release contract and what each merge fires, the five
translations, both halves of the living-doc diff, this folder, and the public docs site. No
blockers; every finding was re-checked against source before it was applied:

- **#190 (`8dbf57f2`).** The "Setting Secrets" blocks on the DOC-001 page (and in
  `projects/presets-api/overview.md`) ran a bare `wrangler secret put`, which writes to the
  top-level block — the routeless `-dev` worker — beside comments saying "Required in production";
  they now carry `--env production`, as `operations/SECRET_ROTATION.md` already required.
  `dependency-graph.md`'s `@internal` sentence, corrected once in verification, was still half the
  story: the barrel lists those symbols, but `stripInternal` drops their declarations from the
  published `.d.ts`. The Swatch guide said the Facewear row always appears (it needs Show all, in
  the Pieces view); the SAME / CLOSE / NEAR / FAR words are printed by Dye Comparison and the
  bot's comparison card only; `X-RateLimit-Remaining` reads 64 on "an" allowed request, not
  "every" one (the fail-open branch answers 65); and the community-presets spec still listed
  three deleted secrets.
- **#189 (`e94f8fd4`).** The 📸 topic now says the `/extractor image` card lists matches for the
  five largest colours only; the French Character File topic named a card badge that does not
  exist ("HORS GRILLE" for `HORS G.`); six German lead sentences were third-person where their
  neighbours are imperative; a Korean range used `-` for the file's `~`. The "names no
  unregistered command" guard saw only back-ticked commands and would have missed the old field
  name "When to Use /match_image vs /match". Japanese and Chinese: no findings.
- **#191 (`c6de8507`).** The changelog's "every allowed request", as above.
- **Corrected here:** the candidate arithmetic (DOC-011's two facts came from outside the 52), and
  what #189's merge fires — discord-worker **and** a redeploy of moderation-worker, whose path
  filter includes `packages/bot-logic/**` (no behaviour change, no bump: eight earlier
  bot-logic-only commits on `main` did the same). The beta workflow ignores `main`.

**The three PRs merge cleanly in any order.** A first trial merge conflicted in
`docs/versions.md`: #189 inserts a row at the top of the discord-worker history table, beside
rows this branch had edited, and git flags an insertion next to modified lines even when the
overlapping edits are byte-identical. Each unit's history table is therefore edited only by the
PR that owns it. Re-tested in three merge orders: all clean, identical tree, both docs gates green
on the merged tree, zero "(prepared)" markers left.

**Deliberately not done** — each would trigger a production deploy for a comment-level change,
so they wait for the next real change to that unit:

- `apps/web-app/CLAUDE.md:9` still says "Vitest 4 (jsdom) + Playwright 1.62" (DOC-029's class).
- `apps/presets-api/src/services/validation-service.ts:213` — the comment says `>= 5729`, the
  check below it is `>= 5000` (DOC-031's other half).
- The shipped 5.10.0 release notes (`apps/web-app/CHANGELOG-laymans.md`, root 5.7.0) say Copy list
  pastes as real bold "into Word, Google Docs or Discord"; the source only promises Word and
  Google Docs. Published notes were left alone — worth one real paste into Discord to settle.

**Needs the maintainer:** merging the three PRs (each merge is a deploy; #189's second commit
fires the release announcement) and Actions → *Publish Packages to npm* for logger 2.2.1,
worker-kit 1.4.0, core 5.3.0 and bot-logic 4.3.0. The recommendations above are not implemented.

## `/manual` update

The request included updating `/manual`, so DOC-003 … DOC-011 were fixed on a separate branch
(the audit branch stays documentation-only): **draft PR
[#189](https://github.com/FlashGalatine/xivdyetools/pull/189)**, `fix/manual-5-0-refresh`,
discord-worker 5.5.8, text folded into the unpublished bot-logic 4.3.0. Not merged — merging is the
production deploy and fires the release announcement, so that decision stays with the maintainer.

- All 17 commands are named (two new embeds, seven in total); `/swatch`, the 📸 topic, `/harmony`,
  `/gradient`, `/mixer`, `/preferences`, the Character File topic and the tips say what the code does.
- Translated into ja, de, fr, ko, zh; syntax lines are byte-identical to English in every locale.
- **The first draft broke Discord.** With seven embeds the French overview came to 6,310 characters
  against a 6,000-per-message cap; `manual-check.mjs` caught it. The English overview was tightened
  and every locale followed — largest reply now 4,994 (fr).
- `font-coverage.test.ts` then went red twice over: topic emoji had been written into a locale
  string (now interpolated from core's `MANUAL_TOPICS`), and ja/ko had new glyphs (subsets regenerated).
- A pre-commit review re-checked every English claim against `schemas.ts` and the handlers and found
  one more false claim carried over from the old text (`/dye search` "shows categories") plus the
  deleted `/match` in the `/preferences filters set` footer — both fixed in the PR.
- Four new guards in `manual.test.ts` read the real locale source: roster coverage, nothing
  unregistered, Discord limits per locale, syntax lines identical to English. Mutation-checked.
- Follow-up (`45051233`): `localize.ts` records that core owns the harmony vocabulary (TERM-001) —
  Discord's picker shows core's localized names — so the manual's harmony, colour-wheel and
  dye-category lists are now derived from core's locale data in every locale. Korean harmony
  names, Japanese / Korean / French wheel names and Japanese / French / Korean / Chinese category
  names had differed from what the bot itself shows. `apps/discord-worker/CLAUDE.md` carries the
  DOC-016 correction here, because editing that path deploys the bot.
- Gates: `turbo run build type-check lint test --filter=...@xivdyetools/bot-logic` exit 0, 21/21
  tasks; `docs:check-versions`, `docs:check-links`, `test:scripts`, `manual-check.mjs` exit 0
  (largest reply fr 4,997 / 6,000). CI on the PR: all checks green, gitleaks included.

After merge: publish `@xivdyetools/bot-logic` 4.3.0 from Actions. `register-commands` has nothing
new — the `match_image` topic id and its choice label were deliberately left alone.

## Next steps

1. Review and merge **#190** (this branch — documentation only, no deploy). It carries DOC-001.
2. Review and merge **#189** (`/manual`; deploys discord-worker, redeploys moderation-worker
   unchanged, and its root layman's changelog commit fires the 5.8.1 announcement) and **#191** (public API docs; deploys api-worker 0.14.3).
   Any order — see *Remediation status*.
3. Actions → *Publish Packages to npm* → `all-modified` (logger, worker-kit, core, bot-logic).
4. When web-app or presets-api next change, pick up the two deferred one-line corrections.
