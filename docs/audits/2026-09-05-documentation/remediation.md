# Remediation record — 2026-09-05 documentation audit

Five fix agents applied the sweep findings to disjoint file sets on the same day, each
re-checking the cited code before editing. This page records what was applied, what was skipped
because the evidence did not hold, and what was left for a later decision. The per-finding detail
is in the `findings/` files; the ids below refer to them.

## Sweep A — architecture / operations / developer-guides / reference / SECURITY.md

**Applied: 97 of 98.** Every version literal dropped from `architecture/overview.md` and
`dependency-graph.md` (both now point at `versions.md`); the binding map, service-binding pages
and `Env` interfaces rebuilt from the seven `wrangler.toml` files; the OAuth, voting and
market-price sequence diagrams redrawn to the real flows; every stale line number in
`DOMAIN_DEPRECATION.md` re-measured; `IMAGE_WORKER_SPLIT.md` marked implemented;
`environment-variables.md` given real sections for api-worker, og-worker, moderation-worker,
image-worker and stoat-worker; `testing.md`'s invented helpers, DOM utilities and assertion
helpers deleted; `release-process.md`'s `--otp` / `--provenance` break-glass replaced with the
security-key + granular-token flow; `ffxiv-terminology.md` regenerated from the six locale files
(with new Facewear and Colour Wheel tables).

**Corrected on the facts:** A-43 — all four app `CLAUDE.md` files still carry a "Custom domains"
line (only the line numbers had moved); A-37 — `GET /auth/me` returns `success` and
`user: { id, username, global_name, avatar, avatar_url }`, not `auth_provider` / `discord_id`;
A-45 — 94 files, not 95.

**Left alone, on purpose:** `DOMAIN_DEPRECATION.md`'s "Phase 0 not yet run" header (the
post-merge checklist still lists Phase 0 as open, so it is consistent).

## Sweep B — packages

**Applied: 105 of 105.** `docs/projects/logger/overview.md`, `test-utils/overview.md`,
`core/services.md` and `core/types.md` rewritten from the real barrels (167–287 lines each — the
150-line target was deliberately exceeded rather than omit real API); `core/algorithms.md` gained
a harmony-generation section (offsets table, `generateHarmonySlots`, the five wheels, band cuts)
and the shipped Brettel and Machado matrices; `core/publishing.md` reduced to build notes plus a
pointer; package READMEs and CLAUDE.md files corrected in place (22-entry redact list, `verifyJWT`
options, four rate-limit backends, ten harmony types, `wheel` on `HarmonyInput`, real consumer
lists); the one-line JSDoc fixes in `packages/types/src/preset/community.ts` (both occurrences)
and `packages/test-utils/src/index.ts`.

**Corrected on the facts:** B-53 — `LocalizationService.getAvailableLocales()` does exist; only
`translate()` and `getLocale()` were fictional.

**Noted:** `packages/types/src/preset/community.ts` was not prettier-clean before the audit; it
was left unformatted so the one-line change stays a one-line change.

## Sweep C1 — discord-worker and web-app

**Applied: 98 of 98.** `commands.md` rate-limit table rebuilt (nothing is unlimited; `/a11y`
shares accessibility's bucket; `/extractor image` is 5/min); phantom options (`color_space`,
`vibrancy_boost`, `/mixer count`) removed and the `wheel` option documented; the resolved
"known issue" about `/preset submit` deleted; the discord-worker source tree corrected
(`utils/verify.ts` never existed — Ed25519 comes from `@xivdyetools/auth`); ToS wording for
favourites and moderation corrected; web-app theming API, source tree, share-URL grammar
(`hexStart`/`hexEnd`, `hexA`/`hexB`, `lang=`, `wheel=`), component inventory and env vars
corrected; a Colour-wheels subsection added to `tools.md`. `docs/projects/{discord-worker,web-app}/deployment.md`
folded into their overviews (app-specific facts only) and deleted; every inbound link repointed.

**Corrected on the facts:** the fonts-src byte figures (~10 MiB original, ~940 KiB subsets);
WEB-38's proposed wording (`pricing-mixin.ts` exports only `setupMarketBoardListeners()`, which
`budget-tool.ts` does not import).

**Checked and kept:** the `components.md` code-splitting paragraph — the 2,200 KB payload limit
and the named chunks match `scripts/check-bundle-size.js` and `vite.config.ts`.

## Sweep C2 — presets-api, image-worker, api-worker, og-worker, oauth, moderation-worker, stoat-worker

**Applied: 166 of 166.** presets-api: moderation described as fail-closed with clean submissions
auto-approved, the real five Perspective attributes and 0.7 threshold, three rate-limit layers on
`/api/*` (service-binding callers skip the IP layer), the votes table's composite key and single
toggle, seven live tables including `submission_events`, migrations to 0013, both 429 shapes,
`INTERNAL_WEBHOOK_SECRET` / `BOT_SIGNING_SECRET` / `TOKEN_BLACKLIST` / `RL_PUBLIC` as
production-required. image-worker: 9.4 MP pixel cap, `POST /thumbnail` documented, both callers
named, the error contract pointed at `IMAGE_INPUT_MARKERS`. api-worker: all `/v1` routes listed,
native `API_RATE_LIMITER` (65/60 s) with the synthetic `X-RateLimit-Remaining` caveat, full bindings,
`POST /v1/telemetry` as an internal route. og-worker: the five allowed query keys, the three-way
non-crawler host branch, ten static font instances, the real cache key and analytics shape.
oauth: every Durable Object reference removed, `/auth/xivauth/callback`, the GET / POST callback
split with `state` required, the worker-side PKCE binding, the real redirect allowlist, account
merge refused (FINDING-013), `RL_AUTH_*` bindings. moderation-worker: per-user rate limits,
English-only by design, `MODERATION_CHANNEL_ID` required, `RL_COMMAND` / `RL_AUTOCOMPLETE` +
`ENVIRONMENT`. stoat-worker: unwired helper and hard-coded locale flagged. Three source comments
corrected (`apps/oauth/src/index.ts` ×2, `apps/image-worker/src/index.ts`), no code changed.

**Corrected on the facts:** API-2 / API-9 — the public API has **16** `/v1` endpoints
(14 GET, 2 POST), not 17; IMG-02's CLAUDE.md half was already correct (only the README and the
source comment were stale).

**Noted for a follow-up:** `apps/api-worker/docs/` (the public VitePress site) was outside the
audit and should be checked against the same endpoint list.

## Sweep D — user guides, specifications, maintainer

**Applied: 66 of 67.** Discord command reference and FAQs (real options, ten harmony types with
`triadic` default, 22 quick picks, full rate-limit tables, no "report" button, invite via `/about`
or the community Discord, the 5.0 first-run notice documented); web-app guides (Colour wheel
setting, `ΔEOK2` at nine sites, image held in memory only, seven of nine tools have Share, the
Swatch Matcher's Pieces / Dyes / Show-all block, Discord *and* XIVAuth sign-in, opt-in
analytics); specifications (Budget ✅, collections ✅ web-only with the Discord half marked removed
in 5.0, multi-colour extraction ✅ with the real 1–10 clamp, preset palettes ✅, community-presets
schema regenerated from `schema.sql` + migrations 0002–0013, the roadmap re-statused item by
item); maintainer pages (version matrix deleted, `adding-dyes.md` publish/consumer steps rewritten
to pnpm + the Actions workflow).

**Corrected on the facts:** D-27 — collections export/import is reachable: the "Manage
Collections" button renders in the favourites panel of five tools, and the modal has Export All /
Import. Both guides now describe that path instead of denying it.

**Left alone, on purpose:** `feature-roadmap.md`'s historical "files created" lists keep their
pre-monorepo paths under a reading note (rewriting them would invent accuracy — many name files
the 5.0 rewrite deleted); `community-presets.md`'s draft-era command examples stay under a
correction banner mapping each to what shipped.

## Sweep E — changelogs

Applied in full by the orchestrator: see [sweep-E](findings/sweep-E-changelogs.md) for the
disposition table. Not changed: the duplicate `## [2.0.0]` headings in the 2025 web-app history,
and the discord-worker test that gates the root layman's file more loosely than the bot's own
(test code — recorded as a follow-up).

## Sweep F — structure

Applied by the orchestrator: see [sweep-F](findings/sweep-F-structure.md). Not done, on purpose:
renaming dated directories or `operations/` files; splitting `POST_MERGE_CHECKLIST.md`; a link
gate over the archive tier.

## Review round (third commit) — 15 findings from `/code-review`, all reproduced, all applied

Wrong facts the audit itself shipped: both FAQs said every preset submission is reviewed before it
appears (auto-approved on a clean check); the oauth page said missing production bindings "degrade
silently" (the worker fails closed with a 500); the env-var guide and image-worker's `Env` comment
said `ENVIRONMENT` is set by `[env.production]` (no `vars` block exists); the API docs said
`POST /v1/telemetry` returns no `X-RateLimit-*` headers (it does, from its own bucket); the root
layman's file credited the 4K-screenshot fix to the web Palette Extractor (browser-side, never
affected — the second surface is preset preview uploads) and named a "Whites" category (it is
Neutral); the bot's layman's file filed two 5.1.3 bullets under 5.1.2; `PresetEditRequest.dyes` still
said "2-5 dyes"; three beta deploy workflows' fail-closed message and six archive-tier links pointed
at files this PR moved or deleted.

Gate holes: `check-doc-versions` required coverage only from `docs/versions.md` (an emptied README
passed) and minted claims from any semver + name pair in a row (a Deprecated row without trailing
prose would have false-redded); `check-doc-links` used `existsSync` (case-insensitive on Windows and
macOS, satisfied by untracked files), toggled fences blindly, left HTML comments unmasked and dropped
`<bracketed>` destinations; the new root-changelog assertions lived in discord-worker's vitest suite,
which the affected-package filter never selects when only the root file changes. Fixes: both
checked files must cover every workspace; claims are read only from tables with a `Version` column
and a name column; a shared `scripts/markdown-mask.ts` masks fences (paired by character and
length), HTML comments and, for the link gate, inline spans; targets resolve against the tracked
path set; CI runs a build-free `root-changelog.test.ts` (grammar, ordering, contract — pure parser only) unconditionally beside the wrangler-config invariants, while the announcement-budget assertion, which needs a built `@xivdyetools/bot-logic`, stays in the filtered suite
and `turbo.json` names the root layman's file as a test input.

Documentation of the tiers now matches the gate: `audits/` and `historical/` are archive (not
link-checked); `research/` and `superpowers/` are frozen-body but link-maintained.

## Follow-ups — resolved the same day (second commit on the audit branch)

- `apps/api-worker/docs/` verified against the router: 15 public endpoints, parameters and group
  counts match; `POST /v1/telemetry` documented as internal in the rate-limits guide.
- `changelog-parser.test.ts`: the root layman's file now gets the bot file's grammar, ordering
  and uncut-announcement assertions (discord-worker 5.5.1).
- `POST_MERGE_CHECKLIST.md` split: record archived under `docs/historical/20260828-PostMerge5.0/`,
  open items re-verified live and moved to `docs/operations/OPEN_ITEMS.md`.

## Follow-ups not taken in this audit (original list, kept for the record)

- `apps/discord-worker/src/services/changelog-parser.test.ts` — give the root
  `CHANGELOG-laymans.md` the same all-headings / ordering / budget assertions the bot's own file
  gets.
- `docs/operations/POST_MERGE_CHECKLIST.md` — lift the still-open §2/§3 items into a short
  open-items page and archive the closed merge-day record, as the file's own footer asks.
- `docs/projects/web-app/components.md` §Code Splitting — the `manualChunks` list is right but
  Rolldown ignores 34 of the 51 assignments (per `check-bundle-size.js`); worth a sentence.
- `docs/projects/` has no page for image-worker or stoat-worker (their READMEs serve); no page
  for auth, worker-kit, svg, bot-logic (their READMEs are the more accurate layer anyway).
