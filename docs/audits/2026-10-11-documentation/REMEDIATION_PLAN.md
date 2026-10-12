# Remediation Plan — 2026-10-11 documentation audit

**Sources:** [`DOCUMENTATION_AUDIT_REPORT.md`](DOCUMENTATION_AUDIT_REPORT.md) — 79 `DOC-` findings (30 MEDIUM, 49 LOW) ·
**Status basis:** 79 total — 0 fixed, 79 outstanding, 0 superseded, 0 KEEP, 0 need rotation. No other catalog is open
for this codebase: every sprint PR of the merged 2026-10-04 plan merged on 2026-10-09, and the only open PRs are
Dependabot bumps. The hand-offs in `evidence/handoffs.md` are not catalog rows; their owners schedule them, but
Sprint 0 says where two of them must land.
**Ordering:** 1. one release per sprint: a deploy, or, for `docs/`-only sprints, one verification gate and a merge
that deploys nothing (no `deploy-*.yml` watches `docs/`) 2. P1 first, privacy routes before everything else
3. within P2, instructions that can damage production first, then what players read, then developer references
4. a document's fact fixes before its spelling pass (a quoted label must be right before `--fix` runs) 5. terminal:
the specifications and frozen-tier status lines, then the last spelling pass

**Tiers.** No P0: no finding corrupts data or exposes anything. **P1** = a user is told to use a route that is
dead or that publishes their data (DOC-001, DOC-004, DOC-005). **P2** = every other MEDIUM. **P3** = every LOW,
spelling included.

## Sprint 0 — Decisions before any edit (maintainer; nothing ships)

| Decision | Blocks | Options |
|---|---|---|
| Which invite the policies use | DOC-001 (Sprint 1) | `discord.gg/5VUSKTZCe5` (what `packages/core/src/config/product-links.ts` and every README already use), if that server carries the support channel; otherwise mint a non-expiring invite and put it in `product-links.ts` too |
| One rule for cross-links inside the translations | DOC-073 (Sprint 1) | localize every sibling-policy link in the 20 variants, or record "translations link the English siblings" in `.agents/skills/audit-shared/policy-documents.md` and revert `PRIVACY.ko.md:65` |
| Whether the collection manager comes back | DOC-003 (Sprint 5) | restore a route to `showCollectionManagerModal()` (a web-app code change, handed off in `evidence/handoffs.md`), or document that saved palettes cannot be exported in this release |
| security-audit's two hand-offs | Sprint 1 | the bot's first-run flag (`PRIVACY_POLICY.md:30`) and the web Privacy Guide's "Manage Collections → Delete Collection" route (`PRIVACY.md:60`). If security-audit rules either a policy CORRECT, land it **inside Sprint 1's commit 2** so each document takes one date bump, not two |
| i18n-manager's policy-translation hand-offs (policy-ja/de/fr/ko/zh in `evidence/handoffs.md`) | Sprint 1 | they edit 15 of the 24 policy files; a later translation-only commit breaks "one commit changes all six" and forces a second date bump. Land them in Sprint 1's commit 2, or defer them to i18n-manager's next six-variant policy commit |

**As decided 2026-10-11** (the maintainer chose the invite and asked for every sprint to run; the coordinator took
the rest as defaults, each reversible):
- **Invite:** `discord.gg/5VUSKTZCe5` (maintainer).
- **Cross-links:** translations link their own locale's sibling documents; only the line-3 notice links English.
  Backticked link labels stay verbatim for the parity script. Recorded in `policy-documents.md`.
- **Collection manager:** document what ships. There is no export, import or per-palette delete in this release
  (Sprints 1, 5 and 13 follow this). Restoring a route stays the web-app owner's hand-off.
- **security-audit hand-offs:** a verifier ruled both CORRECT, and both landed in Sprint 1's commit 2. The
  first-run flag is deliberate per its code comments, so the policy text changed, not the code. Sprint 2 brings
  the two user guides that repeat the old claim into line.
- **i18n-manager hand-offs:** 16 of the 17 policy rows landed in Sprint 1's commit 2. `policy-ko-02` (서버
  wording, the owner's call) and `manual-04` (bot-logic text) stay with i18n-manager.

## Sprint 1 — Policy documents, web-app + discord-worker: the dead contact route (P1) **✅ COMPLETED 2026-10-11 `d6eb816d` `133c677f` — PR [#287](https://github.com/FlashGalatine/xivdyetools/pull/287)**

The one deliberate two-unit sprint, following the 2026-10-04 i18n plan's Sprint 7 (PR #249). DOC-001 is one fact
spread over 24 files: splitting it by app would leave half the policies pointing at a dead invite. The spelling
pass goes first, as its own commit, so the content commit that bumps every date is the last commit to touch all
six variants and `policy-locale-parity.py` stays clean.

| ID | Tier · Sev | Unit | Item |
|---|---|---|---|
| [DOC-079](findings/DOC-079.md) | P3 · LOW | web-app | Commit 1: American spelling in `apps/web-app/PRIVACY.md` and `TERMS_OF_SERVICE.md` (17 words). English only; **no** `Last updated` change |
| [DOC-001](findings/DOC-001.md) | P1 · MEDIUM | web-app, discord-worker | Commit 2: replace the expired invite in all 24 files with the Sprint 0 choice, and bump `Last updated` to the same date in all six variants of each of the four documents (plus any Sprint 0 hand-off edits) |
| [DOC-073](findings/DOC-073.md) | P3 · LOW | web-app, discord-worker | Inside commit 2 (with DOC-001): apply the Sprint 0 cross-link rule — it edits translations, which may never change without their English file |

**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-web-app --filter=xivdyetools-discord-worker`
+ `pnpm --filter xivdyetools-web-app run build:check` (web-app's `privacy-copy-parity` and `about-modal` tests read
these files) + `python .agents/skills/audit-shared/scripts/policy-locale-parity.py` (PASS) +
`node .agents/skills/audit-shared/scripts/american-spelling.mjs . apps/web-app/PRIVACY.md apps/web-app/TERMS_OF_SERVICE.md`
(no hits — commit 2 adds English text after commit 1's pass) + `pnpm docs:check-links` → patch bumps with
*Documents only* entries in both `CHANGELOG.md`s and both version tables (`README.md`, `docs/versions.md`;
`pnpm docs:check-versions`) → laymans entries in `apps/web-app/CHANGELOG-laymans.md` (a versioned
`## Web-App Version x.y.z — <date>` block; an `Unreleased` block never renders) and
`apps/discord-worker/CHANGELOG-laymans.md` (`## [x.y.z] - YYYY-MM-DD`, not ahead of `package.json`). A root
`CHANGELOG-laymans.md` entry, in its own commit, fires the announcement webhook, which is the bot policy's §11 Discord
announcement; whether to send it is the maintainer's call, as it was in PR #249 → merge. The merge fires
`deploy-web-app.yml` and `deploy-discord-worker.yml` on unchanged code; the discord deploy re-runs
`register-commands` on an unchanged roster. Each push of the sprint branch also fires `deploy-web-app-beta.yml` and
`deploy-discord-worker-beta.yml`, which take the single shared beta site and beta bot from whoever is testing on them.
**Deploy needs:** if the PR merges after the date written in commit 2, re-date all 24 variants to the merge date in
one commit, then re-run the parity script.

**Deploy needs (as executed):** merge #284 and #285 first (they hold web-app 5.15.1/5.15.2 and discord-worker 5.8.12); this PR is web-app 5.15.3 / discord-worker 5.8.13. The merge fires deploy-web-app.yml and deploy-discord-worker.yml on unchanged code (register-commands on an unchanged roster). If it merges after 2026-10-11, re-date all 24 variants in one commit and re-run the parity script. The root CHANGELOG-laymans.md announcement (5.11.1) is the maintainer's call; its text is in the PR body. Sprint 0 as executed: invite 5VUSKTZCe5; translations cross-link their own locale (rule in policy-documents.md); collection manager documented as unreachable (no export/import), code restore stays a hand-off; both security-audit hand-offs ruled CORRECT and landed in commit 2; 16 of 17 policy i18n hand-offs landed in commit 2 (policy-ko-02 left to i18n-manager).

## Sprint 2 — User guides: the privacy answers (P1, `docs/` only) **✅ COMPLETED 2026-10-11 `67591833` `39b50bdc` — PR [#288](https://github.com/FlashGalatine/xivdyetools/pull/288)**

Both FAQs send deletion requests to public GitHub issues, which the policies forbid. The answers should point at
the policies' own deletion sections, which Sprint 1 has just corrected.

| ID | Tier · Sev | Unit | Item |
|---|---|---|---|
| [DOC-004](findings/DOC-004.md) | P1 · MEDIUM | web-app | `faq.md` deletion answer → the Privacy Guide's private routes; full stored-data list (Discord or XIVAuth ID + name); quote `en.json` `preset.privacyNote` verbatim in `community-presets.md` |
| [DOC-005](findings/DOC-005.md) | P1 · MEDIUM | discord-worker | bot `faq.md` deletion answer → email or DM; "usage statistics keyed to your Discord ID" instead of "anonymous" |

**Ends with:** `pnpm docs:check-links && pnpm docs:check-versions` → merge (no deploy fires).

## Sprint 3 — Developer and maintainer guides: instructions that misfire (P2, `docs/` only) **✅ COMPLETED 2026-10-11 `0cbbd858` `0e63a056` `01dc7cd5` `a9dfd9d3` `6a5db29e` `c2c56672` `d3df795e` `15ed5315` `a0ef4b80` `3af15721` `a4e04bb2` — PR [#289](https://github.com/FlashGalatine/xivdyetools/pull/289)**

Anchored on DOC-002, DOC-018 and DOC-019: a migration that would never be applied, and two deploys described as
safe that go live. Every other finding in these files rides along so each file is edited once.

| ID | Tier · Sev | Unit | Item |
|---|---|---|---|
| [DOC-002](findings/DOC-002.md) | P2 · MEDIUM | repo-wide | `deployment.md`: `db:migrate` re-runs `schema.sql` only; add the per-file `wrangler d1 execute --file` procedure (presets-api and oauth) and the never-`migrations apply` rule; point `release-process.md` step 6 and the `contributing.md` checklist at it |
| [DOC-018](findings/DOC-018.md) | P2 · MEDIUM | repo-wide | `deployment.md`: take og-worker out of Convention A; its bare deploy is the routed beta |
| [DOC-019](findings/DOC-019.md) | P2 · MEDIUM | repo-wide | `versions.md:734-737`: drop "always"; oauth's bare deploy is production, og-worker's is live beta (same fact class as DOC-018, so it ships with it; DOC-063 and DOC-078 edit `versions.md` later) |
| [DOC-020](findings/DOC-020.md) | P2 · MEDIUM | repo-wide | `contributing.md`: `lint:fix` exists only in web-app and core |
| [DOC-021](findings/DOC-021.md) | P2 · MEDIUM | repo-wide | `local-setup.md`: single-test path → `src/services/__tests__/DyeService.test.ts --coverage.enabled=false` |
| [DOC-053](findings/DOC-053.md) | P3 · LOW | repo-wide | `contributing.md`: list the repo-wide CI gates, including `workers:check-logs` |
| [DOC-054](findings/DOC-054.md) | P3 · LOW | repo-wide | `deployment.md`: name the register-commands step instead of citing line numbers |
| [DOC-052](findings/DOC-052.md) | P3 · LOW | repo-wide | `environment-variables.md`: ENVIRONMENT's second gate, the 32-character webhook secret; `SECRET_ROTATION.md:45` "bearer", not "HMAC" |
| [DOC-055](findings/DOC-055.md) | P3 · LOW | repo-wide | `testing.md` count and thresholds; delete the stale coverage row in `maintainer/index.md` |
| [DOC-056](findings/DOC-056.md) | P3 · LOW | core | `adding-dyes.md`: Soot Black is stainID 6; rewrite Step 2 around the Stain sheet color |
| [DOC-057](findings/DOC-057.md) | P3 · LOW | repo-wide | `logging-standards.md`: say Workers Logs are off; merge the duplicate heading |

**Ends with:** `pnpm docs:check-links && pnpm docs:check-versions` → merge (no deploy fires).

## Sprint 4 — Operations runbooks (P2, `docs/` only) **✅ COMPLETED 2026-10-11 `2fa2a691` `6eb0f153` `16a6e769` `73618156` `7ea6ca86` `76ccefda` `aeaf56fb` — PR [#290](https://github.com/FlashGalatine/xivdyetools/pull/290)**

Anchored on the moderation runbook (DOC-022, DOC-023): a review queue that does not exist, a ban syntax that is
rejected, and records described as kept that are deleted.

| ID | Tier · Sev | Unit | Item |
|---|---|---|---|
| [DOC-022](findings/DOC-022.md) | P2 · MEDIUM | moderation-worker | `MODERATION.md`: document `/preset moderate` and the review-embed buttons; `user:<username search>` with the discord:/xivauth: choices; fix the `@mention` examples |
| [DOC-023](findings/DOC-023.md) | P2 · MEDIUM | moderation-worker | `MODERATION.md`: no User ID on the ban post; unban blanks name and reason, and the row is deleted after 90 days; quote the real messages |
| [DOC-058](findings/DOC-058.md) | P3 · LOW | repo-wide | `OPEN_ITEMS.md`: cross-identity bans shipped; walk date, tense, grep text, override count |
| [DOC-059](findings/DOC-059.md) | P3 · LOW | repo-wide | `DEPLOY_ENVIRONMENTS.md`: put the beta failure in the past tense; beta bot has no D1; `run deploy` |
| [DOC-060](findings/DOC-060.md) | P3 · LOW | presets-api | `security-remediation-2026-09-15.md`: add a Status line; add an OPEN_ITEMS line to confirm migration 0015 ran in production |
| [DOC-061](findings/DOC-061.md) | P3 · LOW | repo-wide | `SECRET_ROTATION.md`: date; send incident write-ups to a folder that exists |
| [DOC-062](findings/DOC-062.md) | P3 · LOW | repo-wide | `DOMAIN_DEPRECATION.md`: symbol names, not line numbers; strike the done row; past-tense the sequencing section |

**Ends with:** `pnpm docs:check-links` → merge (no deploy fires).

## Sprint 5 — web-app docs: what players and contributors read (P2, `docs/` only) **✅ COMPLETED 2026-10-11 `a3b7401a` `bffe3f45` `1466c3ab` `66280ba2` `194842ee` `485475e4` `d8c2015f` `b0531dce` `53296079` `9d51743e` `a1c4a125` — PR [#291](https://github.com/FlashGalatine/xivdyetools/pull/291)**

Anchored on DOC-003 (follows the Sprint 0 decision) and the Glamour Reader guide (DOC-006). The label quotes
(DOC-031) are fixed before the spelling pass (DOC-074), so `--fix` never rewrites a quote the app still shows.

| ID | Tier · Sev | Unit | Item |
|---|---|---|---|
| [DOC-003](findings/DOC-003.md) | P2 · MEDIUM | web-app | `faq.md`, `favorites-collections.md`: export/import per the Sprint 0 decision |
| [DOC-006](findings/DOC-006.md) | P2 · MEDIUM | web-app | `glamour-reader.md`: Facewear acquisition fill; a served twins example; the retired-item row note |
| [DOC-007](findings/DOC-007.md) | P2 · MEDIUM | web-app | `dye-mixer.md`: RYB Blue + Yellow = Green; the shipped mode names |
| [DOC-008](findings/DOC-008.md) | P2 · MEDIUM | web-app | `components.md`, `tools.md`: rename or drop the nine missing symbols |
| [DOC-031](findings/DOC-031.md) | P3 · LOW | web-app | Quote Behavior, Color wheel, Harmony Explorer and the two strings exactly |
| [DOC-032](findings/DOC-032.md) | P3 · LOW | web-app | Add the Glamour Reader to the tool lists and tables |
| [DOC-033](findings/DOC-033.md) | P3 · LOW | web-app | Bundle limit 2,250 KB; drop the key count; no `.glass-panel`; the four root deploy inputs |
| [DOC-034](findings/DOC-034.md) | P3 · LOW | web-app | Dye Filters lists: add the Ishgardian and Expensive toggles, or refer to the panel |
| [DOC-035](findings/DOC-035.md) | P3 · LOW | web-app | Document the About modal's Policies row |
| [DOC-064](findings/DOC-064.md) | P3 · LOW | web-app | `user-guides/index.md`: drop the "Preset Palettes" note |
| [DOC-074](findings/DOC-074.md) | P3 · LOW | web-app | Last commit: spelling sweep `--fix` on the 14 web-app documents |

**Ends with:** `pnpm docs:check-links` + `node .agents/skills/audit-shared/scripts/american-spelling.mjs . <the 14
files>` (no hits) → merge (no deploy fires).

## Sprint 6 — discord-worker docs (P2, `docs/` only)

| ID | Tier · Sev | Unit | Item |
|---|---|---|---|
| [DOC-009](findings/DOC-009.md) | P2 · MEDIUM | discord-worker | Share links: only `/harmony`, `/dye info`, `/swatch`, `/glamour` and `/budget` carry one |
| [DOC-010](findings/DOC-010.md) | P2 · MEDIUM | discord-worker | `overview.md` and `rendering.md` examples → `generateComparisonCard`, `renderSvgToPng(svg, { locale })`, `sendFollowUp` |
| [DOC-036](findings/DOC-036.md) | P3 · LOW | discord-worker | FAQ: autocomplete fires on 1 character; `/glamour` in the 15/min row; `/preset submit` goes live when it passes the check |
| [DOC-037](findings/DOC-037.md) | P3 · LOW | discord-worker | `commands.md` quick picks and preferences; ENVIRONMENT readers; autocomplete source; bundle size |
| [DOC-038](findings/DOC-038.md) | P3 · LOW | discord-worker | Add `/health`, dye emoji, `generateGlamourCard`, releases after 5.0, the bundle gate |
| [DOC-075](findings/DOC-075.md) | P3 · LOW | discord-worker | Last commit: spelling `--fix` on the 8 bot documents + the 6 hand-found words |

**Ends with:** `pnpm docs:check-links` → merge (no deploy fires).

## Sprint 7 — og-worker and api-worker docs (P2, `docs/` only)

| ID | Tier · Sev | Unit | Item |
|---|---|---|---|
| [DOC-011](findings/DOC-011.md) | P2 · MEDIUM | og-worker | Ten tools and a `/glamour` route row in `og-worker/overview.md`; "ten" in `architecture/overview.md:329,337`; ×10 in `DEPLOY_ENVIRONMENTS.md:31-32` |
| [DOC-012](findings/DOC-012.md) | P2 · MEDIUM | api-worker | api-worker bindings table: three limiters + five KV prefixes; "native binding, KV fallback"; `/v1/chara/resolve` caller; the two `UNIVERSALIS_*` lines in `architecture/overview.md` |
| [DOC-039](findings/DOC-039.md) | P3 · LOW | api-worker | `endpoints.md`: `.chara` shape (or link `chara.md`), the 502 rule, Glamour Reader, strict parsing |
| [DOC-046](findings/DOC-046.md) | P3 · LOW | og-worker | `og-worker/overview.md`: both datapoint kinds; `/health`, `/` and the crawler 404 |

**Ends with:** `pnpm docs:check-links` → merge (no deploy fires).

## Sprint 8 — presets-api and moderation-worker docs (P2, `docs/` only)

| ID | Tier · Sev | Unit | Item |
|---|---|---|---|
| [DOC-013](findings/DOC-013.md) | P2 · MEDIUM | presets-api | `moderation.md`, `overview.md`, `architecture/security-trade-offs.md:290,312`, root `DEPRECATIONS.md:31-38`: no key → unscored → queued; keep the key until the 2026-12-31 Perspective shutdown (neither extra file is in a deploy filter) |
| [DOC-040](findings/DOC-040.md) | P3 · LOW | presets-api | Migration 0015, the retention cron, the image actions, retention rows; "publish", not "will publish" |
| [DOC-041](findings/DOC-041.md) | P3 · LOW | moderation-worker | `types/modal.ts`; the `--env production` secret step; "Preset favorites, preferences" |

**Ends with:** `pnpm docs:check-links` → merge (no deploy fires).

## Sprint 9 — oauth docs (P2, `docs/` only)

| ID | Tier · Sev | Unit | Item |
|---|---|---|---|
| [DOC-014](findings/DOC-014.md) | P2 · MEDIUM | oauth | `api-contracts.md`: add `POST /auth/revoke` and the three XIVAuth routes |
| [DOC-043](findings/DOC-043.md) | P3 · LOW | oauth | `oauth/overview.md`: the optional `XIVAUTH_CLIENT_SECRET`; `pnpm --filter xivdyetools-oauth-worker run deploy`, which is production |
| [DOC-044](findings/DOC-044.md) | P3 · LOW | oauth | Error rows with the real strings; xivauth callback 20/min; `redirect_uri` optional |
| [DOC-045](findings/DOC-045.md) | P3 · LOW | oauth | A Database section, or a link to `apps/oauth/CLAUDE.md` § Database |

**Ends with:** `pnpm docs:check-links` → merge (no deploy fires).

## Sprint 10 — Architecture docs (P2, `docs/` only)

Runs after Sprints 3, 7 and 9, which also edit these trees (`api-contracts.md` in 9), so the spelling pass
(DOC-077) sees their final text.

| ID | Tier · Sev | Unit | Item |
|---|---|---|---|
| [DOC-015](findings/DOC-015.md) | P2 · MEDIUM | worker-kit | `security-trade-offs.md`: the KV limiter is honest best-effort; drop the removed conflict detection, backoff and read-back |
| [DOC-042](findings/DOC-042.md) | P3 · LOW | presets-api | `data-flow.md` duplicate branch; preview-upload 429 in `api-contracts.md` |
| [DOC-049](findings/DOC-049.md) | P3 · LOW | repo-wide | `dependency-graph.md`: `@cloudflare/workers-types` rows; drop or update the pinned ranges |
| [DOC-050](findings/DOC-050.md) | P3 · LOW | presets-api | presets-api verifies JWTs locally; remove the call to oauth |
| [DOC-051](findings/DOC-051.md) | P3 · LOW | web-app | "installable", not "PWA" |
| [DOC-077](findings/DOC-077.md) | P3 · LOW | repo-wide | Last commit: spelling `--fix` on the 11 architecture/developer/maintainer documents, plus the code-zone prose by hand; leave `api-contracts.md:444` |

**Ends with:** `pnpm docs:check-links` → merge (no deploy fires).

## Sprint 11 — Package docs: core and types (P2, `docs/` only)

Runs after Sprints 7–10 (`projects/index.md` is edited in 10), so the cross-tree spelling pass (DOC-076) sees
their final text.

| ID | Tier · Sev | Unit | Item |
|---|---|---|---|
| [DOC-016](findings/DOC-016.md) | P2 · MEDIUM | repo-wide (types, core docs) | `import type` in the eight examples (`docs/CLAUDE.md`, `core/overview.md`, `types/overview.md`) |
| [DOC-017](findings/DOC-017.md) | P2 · MEDIUM | core | `classifyBandTier(distance, method, context)` |
| [DOC-047](findings/DOC-047.md) | P3 · LOW | core | `getCategories` order, eight caches, Brettel without LMS, `getLabel` returns `string` |
| [DOC-048](findings/DOC-048.md) | P3 · LOW | core, types | Name the missing exports or point at each package README |
| [DOC-076](findings/DOC-076.md) | P3 · LOW | repo-wide | Last commit: spelling `--fix` on the 15 worker and package documents + the 4 hand-found words |

**Ends with:** `pnpm docs:check-links` → merge (no deploy fires). If the code-block type-check recommended in the
report exists by then, run it here too.

## Sprint 12 — Entry and reference pages (P2, `docs/` only)

| ID | Tier · Sev | Unit | Item |
|---|---|---|---|
| [DOC-024](findings/DOC-024.md) | P2 · MEDIUM | repo-wide | `glossary.md`: Special Dye is a category of 27 dyes, not an acquisition tier |
| [DOC-063](findings/DOC-063.md) | P3 · LOW | repo-wide | `versions.md` header (packages at parity, date) and the newer compatibility rows |
| [DOC-065](findings/DOC-065.md) | P3 · LOW | core | `ffxiv-terminology.md`: シャインシルバー |
| [DOC-066](findings/DOC-066.md) | P3 · LOW | repo-wide | `glossary.md`: no jobs; "Web app tools" with all ten; Market Board |
| [DOC-067](findings/DOC-067.md) | P3 · LOW | repo-wide | `index.md` Recent Updates, or a pointer to `versions.md` |

**Ends with:** `pnpm docs:check-versions && pnpm docs:check-links` → merge (no deploy fires).

## Sprint 13 — Specifications and frozen-tier status lines (terminal, `docs/` only)

Lowest reader impact: specs are design records and the frozen tier's bodies never change. The cross-tree spelling
pass (DOC-078) goes last of all, after Sprints 4 and 12 have edited the same trees.

| ID | Tier · Sev | Unit | Item |
|---|---|---|---|
| [DOC-025](findings/DOC-025.md) | P2 · MEDIUM | repo-wide | `superpowers/README.md` + the glamour-acquisition plan/spec Status lines → Shipped with PR numbers; the two `research/index.md` Outcome cells |
| [DOC-026](findings/DOC-026.md) | P2 · MEDIUM | presets-api | `community-presets.md` API section: base URL, paths, cap, 201 body, duplicate rule, limits — or an "as shipped" callout linking `projects/presets-api/endpoints.md` |
| [DOC-027](findings/DOC-027.md) | P2 · MEDIUM | presets-api | Auth table (bot secret + v2 signature + nonce; web JWT) and the full secret list |
| [DOC-028](findings/DOC-028.md) | P2 · MEDIUM | presets-api | Describe the shipped moderation flow and the sunset; label the rest as the original design |
| [DOC-029](findings/DOC-029.md) | P2 · MEDIUM | core | `multi-color-extraction.md`: shipped signatures; `/extractor image [colors:<3-10>]` |
| [DOC-030](findings/DOC-030.md) | P2 · MEDIUM | web-app | `feature-roadmap.md`: F and C shipped; Ctrl+Shift+C is the one that never did |
| [DOC-068](findings/DOC-068.md) | P3 · LOW | presets-api | `community-presets.md`: untick the owner DM, 6 slots, schema notes, `@xivdyetools/types`, label design-era sections |
| [DOC-069](findings/DOC-069.md) | P3 · LOW | repo-wide | Pre-monorepo path caveat in the three specs |
| [DOC-070](findings/DOC-070.md) | P3 · LOW | web-app | `feature-roadmap.md` extractor rows |
| [DOC-071](findings/DOC-071.md) | P3 · LOW | web-app | `collections.md` API, name rule, rename suffix, shortcut |
| [DOC-072](findings/DOC-072.md) | P3 · LOW | core | `preset-palettes.md`: widen the banner or correct the shapes |
| [DOC-078](findings/DOC-078.md) | P3 · LOW | repo-wide | Last commit of the plan: spelling `--fix` on the 12 entry, reference, operations and specification documents; leave the dictionary rows and quoted seeds |

**Ends with:** `pnpm docs:check-links && pnpm docs:check-versions` +
`node .agents/skills/audit-shared/scripts/american-spelling.mjs .` over the default surface (only the standing
rejections remain) → merge (no deploy fires).

## Superseded findings

None. No two findings share a fix that would supersede one by the other. The overlaps between lenses were merged
into single findings before filing (the report's catalog lists each once).

## KEEP register

Not applicable: documentation findings carry no KEEP verdict.

## Standing guidance

- Verify each finding's evidence against the code before editing — findings are leads, and the code moves.
- One commit per finding (per sprint when tiny); spelling passes always in their own commit, last in the sprint.
- `docs/`-only sprints deploy nothing; Sprint 1 is the only sprint whose merge fires deploys (web-app and
  discord-worker, identical code), because the policies live under `apps/*/`.
- Policy edits follow `.agents/skills/audit-shared/policy-documents.md`: content changes bump all six dates in one
  commit; a spelling-only English change bumps none.
- Spelling passes run as `node .agents/skills/audit-shared/scripts/american-spelling.mjs . <files> --fix` (the repo
  directory is the first argument; without it the script exits 2).
- After each sprint re-run the doc gates; after the last, run the sweep with only `.` and confirm only the standing
  rejections remain.
- **Out-of-`docs/` lines are not in these sprints**, because editing them fires deploys or needs a publish:
  DOC-010 `apps/discord-worker/CLAUDE.md:212` (`sendFollowup()`), DOC-016 `packages/types/README.md` (9 plain
  type-only imports; npm shows the README only after the next types publish), DOC-019 `apps/api-worker/README.md:208`
  ("Production always needs…"). Each rides that unit's next release; mark the finding **PARTIAL**, not FIXED, until
  it lands.
- Annotate executed sprints in the heading: **✅ COMPLETED <date> <commits>** + the PR number. The plan doubles as the
  tracker; update each finding's `## Status` and the report's status table when it lands.
