# Documentation audit — cluster `entry-specs`

Reviewer scope: `docs/index.md`, `docs/README.md`, `docs/CLAUDE.md`, `docs/versions.md`, every file
under `docs/specifications/`. Worktree: `docs-audit-2026-09-18` @ `0fec18f4`.

## Coverage table

| file | sections reviewed | result |
|------|--------------------|--------|
| docs/index.md | all (Quick Nav, Ecosystem diagram, Doc Sections, Projects Overview, Dye DB Composition, Recent Updates, Contributing, Legal) | reviewed |
| docs/README.md | all (Folders table, Contributing, Document Template, License, Support) | reviewed |
| docs/CLAUDE.md | all (Doc Bible table, Monorepo Quick Reference, Commands, Architecture Quick Ref, Key Patterns, Cross-Project References) | reviewed |
| docs/versions.md | all (Current Versions ×2 tables, Deprecated table, full Version History for every unit, Compatibility Matrix, Updating Versions) | reviewed |
| docs/specifications/index.md | all | reviewed |
| docs/specifications/collections.md | all | reviewed |
| docs/specifications/community-presets.md | all | reviewed |
| docs/specifications/multi-color-extraction.md | all | reviewed |
| docs/specifications/preset-palettes.md | all | reviewed |
| docs/specifications/budget-aware-suggestions.md | all | reviewed |
| docs/specifications/feature-roadmap.md | all | reviewed |

11/11 files fully read, no partials.

## Source-of-truth checks performed

- `git ls-files packages/*/package.json` (8) and `apps/*/package.json` (9) — counts and names
  confirmed against `docs/index.md`/`docs/CLAUDE.md`/`docs/versions.md` "17 active projects" claim.
- Every `packages/*/package.json` and `apps/*/package.json` `version` field read directly and
  diffed against both `docs/versions.md` "Current Versions" tables — **all 17 match exactly**
  (auth 2.0.2, bot-logic 4.3.0, core 5.3.0, logger 2.2.1, svg 4.1.0, test-utils 2.0.1, types 3.2.0,
  worker-kit 1.4.0; api-worker 0.14.2, discord-worker 5.5.7, image-worker 1.3.2, moderation-worker
  1.7.3, og-worker 2.10.2, oauth-worker 3.1.1, presets-api 2.3.6, stoat-worker 0.3.1, web-app 5.11.0).
  Also cross-checked against `docs/audits/2026-09-18-documentation/evidence/check-versions.txt`
  (`scripts/check-doc-versions.ts` — "checked 34 version claims ... all match package.json") and
  `.../evidence/npm-versions.txt` (independent local-vs-package.json dump, same numbers).
- `packages/core/src/data/dyes.json` — 125 entries (matches "125 dyes" / "125 standard dyes" claims
  everywhere in the cluster).
- `packages/core/src/data/facewear_colors.json` — 11 entries (matches "11 Facewear colours").
- `packages/core/src/services/LocalizationService.ts:33-40` — `SUPPORTED_LOCALES` = en/ja/de/fr/ko/zh
  (6 languages, matches every "6 languages" / "6-language" claim).
- `apps/web-app/src/components/*.ts` — 8 named tool components (accessibility, budget, comparison,
  extractor, gradient, harmony, mixer, swatch) + `v4/preset-tool.ts` = 9, matches "9 tools" /
  "9 colour tools" claims.
- `apps/discord-worker/src/commands/registry.ts:31-58` — 17 `COMMAND_REGISTRY` entries (harmony,
  mixer, gradient, extractor, swatch, dye, comparison, contrast, accessibility, a11y, budget, preset,
  preferences, manual, changelog, about, stats), matches "17 registered slash commands" / "17 slash
  commands" claims.
- Dev-server ports in `docs/CLAUDE.md` "Dev Servers" block: web-app 5173 (`apps/web-app/vite.config.ts:54`
  `port: 5173`), oauth 8788 (`apps/oauth/wrangler.toml:12` `port = 8788`), presets-api 8787
  (`apps/presets-api/wrangler.toml:19` `port = 8787`), api-worker 8790 (`apps/api-worker/wrangler.toml:22`
  `port = 8790`) — all match. discord-worker line carries no port claim ("Wrangler local" only), nothing
  to check.
- `packages/core/src/data/presets.json` — schema `2.0.0`, 15 palettes total, category breakdown
  `grand-companies: 3, seasons: 4, events: 8` — matches the "as shipped" correction block at the top
  of `docs/specifications/preset-palettes.md:7-10` and the Phase-3 section of `feature-roadmap.md:237-247`
  exactly.
- Link check: every relative link in the 4 top-level cluster files and all 7 specification files
  resolves on disk (verified with a standalone Node script mirroring `scripts/check-doc-links.ts`);
  cross-checked against `docs/audits/2026-09-18-documentation/evidence/check-links.txt`
  ("checked 887 relative links across 241 documents — all resolve").
- No references anywhere in the cluster to the retired `apps/api-docs`, `apps/universalis-proxy`, or
  an `apps/maintainer` app path — all mentions correctly point at `xivdyetools-api-worker` /
  `docs/maintainer/adding-dyes.md`.

## Candidate table

| cand-id | sev | kind | file:line | one-line claim vs reality | evidence pointer (source path:line) |
|---|---|---|---|---|---|
| ES-01 | MEDIUM | WRONG | docs/specifications/community-presets.md:1246 | Rate Limits table says "Submit preset \| 10 per hour per user" | apps/presets-api/src/services/rate-limit-service.ts:24 `DAILY_SUBMISSION_LIMIT = 10` is a **per-day** cap (enforced via `submission_events`), not per-hour; the same spec's own sibling doc `docs/specifications/index.md:34` correctly says "Rate limiting (10 submissions/user/day)" |
| ES-02 | MEDIUM | PLANNED-VS-SHIPPED | docs/specifications/multi-color-extraction.md:216-224 | "Enhanced `/match_image` Command" section describes `/match_image image:<attachment> [colors:<1-5>]` as the live Discord command | `apps/discord-worker/src/handlers/commands/about.ts:67` `REMOVED_IN_V5 = ['/match', '/match_image', ...]`; `apps/discord-worker/src/commands/registry.ts:31-58` has no `match_image` entry, only `extractor`; actual param range is 3-10 (`apps/discord-worker/src/commands/schemas.ts:345` "Number of colors to extract (3-10)"), not 1-5 |
| ES-03 | LOW | WRONG | docs/specifications/multi-color-extraction.md:198 | File-changes table lists `color-matcher-tool.ts` as the file to modify | no such file exists; the actual (and only) extraction tool component is `apps/web-app/src/components/extractor-tool.ts` (`git ls-files apps/web-app/src/components \| grep -i extractor`) |
| ES-04 | MEDIUM | PLANNED-VS-SHIPPED | docs/specifications/budget-aware-suggestions.md (whole doc, e.g. line 53 "Add budget controls to the existing Color Matcher tool", line 102 "Enhanced `/match` Command") | Entire doc still describes budget as a filter bolted onto the Color/dye Matcher and `/match`, never updated post-ship | Budget shipped as its own standalone tool/command: `apps/web-app/src/components/budget-tool.ts` exists as a separate component; `apps/discord-worker/src/commands/registry.ts:48` has a standalone `budget` entry, not a `/match` option. The project's own `docs/specifications/feature-roadmap.md:325-327` explicitly documents this drift ("Shipped as its own tool, not as a filter on matching. The draft below imagined budget as a `max_price` option bolted onto the matcher") — every sibling spec (collections.md, community-presets.md, preset-palettes.md, multi-color-extraction.md) received an "as shipped" correction header; this one did not |

Only 4 candidates found in this cluster — all listed above, none omitted.

## NEEDS-REGISTRY-CHECK

Per the brief: version-table rows all match `package.json` exactly (see coverage checks above), so no
STALE-VERSION candidate against package.json. One piece of *prose* asserts npm registry state that I
cannot verify from the repo tree alone, but a sibling evidence file already collected in this shared
audit directory appears to resolve it:

- `docs/versions.md:10` — "September 15 security versions are prepared locally; auth 2.0.2 still
  needs npm publication." `docs/audits/2026-09-18-documentation/evidence/npm-versions.txt`
  (collected by another cluster's worker, timestamped this audit run) shows `auth: 2.0.2` already
  present under "NPM Registry Versions" — i.e. the registry already has 2.0.2, contradicting the
  "still needs npm publication" claim. I did not hit the npm registry myself (out of scope / no
  network calls), so I'm not promoting this to a WRONG candidate per the brief's rule, but flagging
  it for the coordinator since the resolving evidence already exists in this folder.

## Positive controls (checked and correct — no need to re-chase)

- "17 active projects — 8 packages and 9 applications" (docs/index.md:30, docs/CLAUDE.md:32) — exact package/app counts confirmed.
- All 17 unit versions in `docs/versions.md` "Current Versions" tables match `package.json` exactly.
- "125 standard dyes" / "11 Facewear colours" / "6 languages" — all confirmed against `dyes.json`, `facewear_colors.json`, `SUPPORTED_LOCALES`.
- "9 tools" (web-app) and "17 registered slash commands" (discord-worker) — both confirmed by direct source enumeration.
- Dev-server ports in `docs/CLAUDE.md` (5173 / 8788 / 8787 / 8790) all match `vite.config.ts` / `wrangler.toml`.
- `docs/specifications/preset-palettes.md`'s "as shipped" correction block (15 curated palettes, 3/4/8 split) is byte-accurate against `presets.json`.
- `docs/specifications/collections.md` and its "REMOVED IN 5.0" sections are accurate and well-annotated (no `/favorites`/`/collection` in the command registry, confirmed).
- `docs/specifications/feature-roadmap.md` is accurate throughout and correctly documents drift in its own sibling specs (see ES-04) — treat it as the reliable source when it disagrees with `budget-aware-suggestions.md` or `multi-color-extraction.md`.
- No links in the cluster point at retired paths (`apps/api-docs`, `apps/universalis-proxy`, an `apps/maintainer` app) — all correctly redirect to `api-worker` / `docs/maintainer/`.
- Full link check (own script + `check-links.txt`) — zero broken relative links anywhere in the cluster.

## Rejected items (looked wrong, were right)

- `docs/versions.md` rows showing "(prepared)" suffixes (e.g. discord-worker 5.5.7, web-app 5.9.1,
  og-worker 2.10.2, image-worker 1.3.2, presets-api 2.3.6, moderation-worker 1.7.3, api-worker 0.14.2)
  initially looked like a live-deploy-status claim I couldn't verify — but these are Version *History*
  entries (What's in the version), not the "Status" column of the Current Versions table (which just
  says "Active" for all of them), so there's no deploy-state assertion to fact-check from the repo tree.
  Not a candidate.
- `packages/worker-kit`, `packages/core`, `packages/logger`, `packages/bot-logic` local `package.json`
  versions are ahead of the npm registry dump in `npm-versions.txt` (worker-kit 1.4.0 vs 1.3.0, core
  5.3.0 vs 5.2.0, logger 2.2.1 vs 2.2.0, bot-logic 4.3.0 vs 4.2.0) — this is the normal "bumped locally,
  not yet published" state and `docs/versions.md`'s Current Versions table makes no explicit "already
  on npm" claim for any of them (just "Active"), so not a candidate — only the `auth` line makes an
  explicit publication claim (see NEEDS-REGISTRY-CHECK).
- oauth package name discrepancy: `docs/CLAUDE.md:44` calls it `xivdyetools-oauth-worker (apps/oauth)`
  — this exactly matches `apps/oauth/package.json:2` `"name": "xivdyetools-oauth-worker"`. Not a
  candidate.
