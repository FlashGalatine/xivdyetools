# Merged Remediation Plan — 2026-10-26

**Sources:** [Security](../2026-10-26-security/SECURITY_AUDIT_REPORT.md) 56 + [XIVCharaKit dead code](../2026-10-26-xivcharakit-dead-code/DEAD_CODE_REPORT.md) 47 + [deep dive](../2026-10-26-deep-dive/DEEP_DIVE_REPORT.md) 24 + [i18n](I18N_AUDIT_2026-10-26.md) 6.
**Status basis:** **133 IDs: 0 fixed, 108 scheduled, 23 KEEP, 2 superseded for scheduling, 0 requiring rotation.** All underlying new findings remain OPEN; no remediation has started. Each primary ID appears in exactly one assignment table. Companion package/adoption sprints have no duplicate primary-ID rows.
Grades retain their source meaning: security severity/exposure, dead-code confidence/blast/semver, deep-dive severity and scheduling tier, or i18n priority. HIGH confidence in a removal is not a HIGH-severity bug.

This plan supersedes the scheduling in #333 and #334 while preserving their frozen catalogs. Their live-state checks are dated evidence and were not repeated here. The older `2026-10-04-deep-dive/OPT-003` is carried into the new optimization and is outside the 133-ID accounting.

## Approval, decisions and ordering

The maintainer already chose to remove moderator names, deprecate before the core 6 / bot-logic 5 major pair, drop the legacy parity `[host]` half and retain `[library]`. **Review first; nothing starts until a sprint is named.** This document does not authorize resource deletion, settings changes, upstream messages, publishing, deployment or a merge.

No P0/emergency sprint is needed. Named sprints are independently reviewable units, not permission to run the whole list. Prioritize the P1 displayed-text fixes and MEDIUM correctness bugs, then contained bugs, cleanup and hardening. Package prerequisites precede their consumers. Structural major removals are isolated after correctness and beta acceptance; terminal font work is last. A package publish, app deployment and external-settings verification are separate units. Nondependent ordinary app sprints may be reordered to deliver the higher-priority fix first.

Unresolved gates from #333 remain: per-record controls versus policy wording; CSP narrowing versus wording; tag/link moderation; failed-decode quota treatment; identity unlink/ban lookup behavior; signed-in browsing policy AMEND; button throttling versus a recorded trade-off; optional query signing. Resolve only the decisions needed for the named sprint. No default is chosen here.

All version numbers are targets inherited from the accepted major path, not fresh registry assertions. Before execution, compare local and registry versions: fold into an unpublished version where valid; otherwise additive/deprecation MINOR, compatible fix PATCH, published API removal MAJOR. Stage only owned paths; never stash or switch the shared checkout. **Merging to main is the deploy.** No bare wrangler deployment from this plan.

Each locale-owning release finalizes its text before checking/subsetting fonts. A missing drawable glyph blocks that release until its font update is ready; never ship a red glyph gate while waiting for the terminal phase. The final F-DISCORD/F-OG pass occurs only after the last rendered-text/item-name change.

## Sprint OPS-API-DEV — Cloudflare stale dev worker

Future maintainer-only action; recheck the dated evidence and exact target before acting.

| ID | Source | Sev/Pri | Action |
|---|---|---|---|
| [2026-10-26-security/FINDING-054](../2026-10-26-security/findings/FINDING-054.md) | 2026-10-26-security | P2 · LOW / INTERNET-UNAUTH | Delete the worker `xivdyetools-api-worker-dev` (stale 2026-08-10 build, public on `workers.dev`), or redeploy it once so wrangler applies `workers_dev = false`; tick `OPEN_ITEMS.md:74-75` with the HEAD probe. |

**Ends with:** Explicit maintainer authorization at execution → narrowly scoped action/decision → read-only state verification recorded; no automatic action from this audit.

## Sprint OPS-ZONE — Cloudflare zone transport settings

Future maintainer-only action; recheck the dated evidence and exact target before acting.

| ID | Source | Sev/Pri | Action |
|---|---|---|---|
| [2026-10-26-security/FINDING-055](../2026-10-26-security/findings/FINDING-055.md) | 2026-10-26-security | P3 · INFO / INTERNET-UNAUTH | Zone `xivdyetools.app` → SSL/TLS → Edge Certificates: **Always Use HTTPS** on, **Minimum TLS Version** 1.2. |

**Ends with:** Explicit maintainer authorization at execution → narrowly scoped action/decision → read-only state verification recorded; no automatic action from this audit.

## Sprint OPS-RETIRED — Retired Cloudflare resources

Future maintainer-only action; recheck the dated evidence and exact target before acting.

| ID | Source | Sev/Pri | Action |
|---|---|---|---|
| [2026-10-26-security/FINDING-056](../2026-10-26-security/findings/FINDING-056.md) | 2026-10-26-security | P3 · INFO / INTERNET-UNAUTH | Delete the retired Pages project `xivdyetools-api-docs` and the retired worker `xivdyetools-universalis-proxy`; tick `DEPRECATIONS.md:162,200` and `OPEN_ITEMS.md` §2. |

**Ends with:** Explicit maintainer authorization at execution → narrowly scoped action/decision → read-only state verification recorded; no automatic action from this audit.

## Sprint OPS-PAGES-HISTORY — Web Pages history and aliases

Future maintainer-only action; recheck the dated evidence and exact target before acting.

| ID | Source | Sev/Pri | Action |
|---|---|---|---|
| [2026-10-26-security/FINDING-009](../2026-10-26-security/findings/FINDING-009.md) | 2026-10-26-security | P2 · LOW / INTERNET-UNAUTH | Bulk-delete the superseded Pages deployments (522 in `xivdyetools`, 240 in `xivdyetools-beta`, each at its own `<hash>.pages.dev` host; the `ecc7fb76` beta deployment serves no CSP, XFO or HSTS) and the `v4-ui-migration` alias, keeping the current production and beta deployments. Add a retention step to `deploy-web-app*.yml` in R-CI. |

**Ends with:** Explicit maintainer authorization at execution → narrowly scoped action/decision → read-only state verification recorded; no automatic action from this audit.

## Sprint OPS-REPO-SECRETS — GitHub repository secret scope

Future maintainer-only action; recheck the dated evidence and exact target before acting.

| ID | Source | Sev/Pri | Action |
|---|---|---|---|
| [2026-10-26-security/FINDING-028](../2026-10-26-security/findings/FINDING-028.md) | 2026-10-26-security | P3 · LOW / LOCAL | `gh secret delete` the repository-scope `DISCORD_TOKEN`, `MODERATION_DISCORD_TOKEN`, `BETA_DISCORD_TOKEN`, `BETA_DISCORD_GUILD_ID` (the environment copies already exist and every consuming job declares `environment:`); check off FINDING-023 in `docs/operations/OPEN_ITEMS.md`. Optional token reset. |

**Ends with:** Explicit maintainer authorization at execution → narrowly scoped action/decision → read-only state verification recorded; no automatic action from this audit.

## Sprint OPS-SECRET-SCANNING — GitHub scanning settings

Future maintainer-only action; recheck the dated evidence and exact target before acting.

| ID | Source | Sev/Pri | Action |
|---|---|---|---|
| [2026-10-26-security/FINDING-050](../2026-10-26-security/findings/FINDING-050.md) | 2026-10-26-security | P3 · INFO / LOCAL | Enable secret-scanning non-provider patterns and validity checks, or record the choice. |

**Ends with:** Explicit maintainer authorization at execution → narrowly scoped action/decision → read-only state verification recorded; no automatic action from this audit.

## Sprint OPS-BRANCH-PROTECTION — GitHub branch protection

Future maintainer-only action; recheck the dated evidence and exact target before acting.

| ID | Source | Sev/Pri | Action |
|---|---|---|---|
| [2026-10-26-security/FINDING-051](../2026-10-26-security/findings/FINDING-051.md) | 2026-10-26-security | P3 · INFO / LOCAL | Turn on `enforce_admins` and `strict` on `main` now that the 2026-10-03 remediation PRs merged, or record the deferral. |

**Ends with:** Explicit maintainer authorization at execution → narrowly scoped action/decision → read-only state verification recorded; no automatic action from this audit.

## Sprint OPS-XIVCHARAKIT-PROVENANCE — XIVCharaKit release provenance

Future maintainer-only action; recheck the dated evidence and exact target before acting.

| ID | Source | Sev/Pri | Action |
|---|---|---|---|
| [2026-10-26-security/FINDING-052](../2026-10-26-security/findings/FINDING-052.md) | 2026-10-26-security | P3 · INFO / LOCAL | Tag the `xivcharakit` releases in the XIVCharaKit repository (your own repo) so each npm version maps to a commit. |

**Ends with:** Explicit maintainer authorization at execution → narrowly scoped action/decision → read-only state verification recorded; no automatic action from this audit.

## Sprint DECISION-UPSTREAM-MERGE — Upstream identity-merge decision

Future maintainer-only action; recheck the dated evidence and exact target before acting.

| ID | Source | Sev/Pri | Action |
|---|---|---|---|
| [2026-10-26-security/FINDING-008](../2026-10-26-security/findings/FINDING-008.md) | 2026-10-26-security | P3 · LOW / INTERNET-UNAUTH | Report upstream to XIVAuth (MFA or owner confirmation on the email auto-merge path); decide whether oauth narrows its side (A-OAUTH). |

**Ends with:** Explicit maintainer authorization at execution → narrowly scoped action/decision → read-only state verification recorded; no automatic action from this audit.

## Sprint A-WORKER-KIT — packages/worker-kit

Publish an additive MINOR. API, presets-api and oauth opt into IPv6 keying; Discord adopts the glamour tier in their separate releases.

| ID | Source | Sev/Pri | Action |
|---|---|---|---|
| [2026-10-26-security/FINDING-004](../2026-10-26-security/findings/FINDING-004.md) | 2026-10-26-security | LOW / INTERNET-UNAUTH · P2 | `getClientIp` (opt-in option): collapse IPv6 to its /64 (expand `::`, keep four hextets), leave IPv4 alone; test that two addresses in one /64 share a key. |
| [2026-10-26-security/FINDING-017](../2026-10-26-security/findings/FINDING-017.md) | 2026-10-26-security | LOW / INTERNET-AUTH · P2 | Add a `glamour` entry to `DISCORD_COMMAND_LIMITS` (about 5/min on the existing `RL_5` binding); discord-worker wires it in A-DISCORD. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...@xivdyetools/worker-kit` and whole-graph gates before merge → version/CHANGELOG decision → merge → Actions **Publish Packages to npm** for `@xivdyetools/worker-kit`; verify registry before downstream adoption.

## Sprint A-CORE — packages/core

Publish the deprecation MINOR before any removal. Also harden the quadratic GPOSERS sink as a companion to the upstream-name finding assigned to A-API. Preserve exported names when relocating live limits/types; add the legacy API deprecation record.

| ID | Source | Sev/Pri | Action |
|---|---|---|---|
| [2026-10-26-xivcharakit-dead-code/DEAD-002](../2026-10-26-xivcharakit-dead-code/findings/DEAD-002.md) | 2026-10-26-xivcharakit-dead-code | HIGH / NONE · NONE · REMOVE | Fix the stale comments, docs and READMEs (shader-table reader claims, "lands in the stacked change", `@entrypoint` docblocks on `chara.ts` and `copy-chara-notices.mjs`, core CLAUDE.md / services.md / overview.md, the npm README and NOTICE credit for xivcharakit). |
| [2026-10-26-xivcharakit-dead-code/DEAD-003](../2026-10-26-xivcharakit-dead-code/findings/DEAD-003.md) | 2026-10-26-xivcharakit-dead-code | HIGH / NONE · NONE · REMOVE | Remove the seven stale `/** @public */` tags on chara-facade barrel exports that now have in-repo consumers. |
| [2026-10-26-xivcharakit-dead-code/DEAD-020](../2026-10-26-xivcharakit-dead-code/findings/DEAD-020.md) | 2026-10-26-xivcharakit-dead-code | HIGH / LOW · NONE · REFACTOR FIRST | Move `MAX_CHARA_FILE_BYTES` into `chara-library.ts` (or a tiny `chara-limits.ts`); keep the barrel export unchanged and rewrite the stale doc. |
| [2026-10-26-xivcharakit-dead-code/DEAD-021](../2026-10-26-xivcharakit-dead-code/findings/DEAD-021.md) | 2026-10-26-xivcharakit-dead-code | HIGH / MEDIUM · NONE · REFACTOR FIRST | Relocate the live slot, result and `StainIdLookup` types out of `chara-parser.ts` / `chara-resolver.ts`; type `race` as `Race \| null`; same exported names. In the same release add `@deprecated` to the legacy pair and its legacy-only types plus a `DEPRECATIONS.md` entry targeting 6.0.0 (phase 1 of [2026-10-26-xivcharakit-dead-code/DEAD-024](../2026-10-26-xivcharakit-dead-code/findings/DEAD-024.md)). |
| [2026-10-26-deep-dive/BUG-003](../2026-10-26-deep-dive/findings/BUG-003.md) | 2026-10-26-deep-dive | LOW / P2 | Truncate on code-point boundaries while preserving a documented code-unit cap; coordinate with web file-name truncation. Publish core before consumers. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...@xivdyetools/core` and whole-graph gates before merge → version/CHANGELOG decision → merge → Actions **Publish Packages to npm** for `@xivdyetools/core`; verify registry before downstream adoption.

## Sprint A-SVG — packages/svg

After A-CORE: harden quadratic fitText and adopt the new core release. This is a separate SVG publish; A-BOT-LOGIC and direct consumers follow it.

Companion task only; its primary finding is assigned to A-API.

**Ends with:** `pnpm turbo run build type-check lint test --filter=...@xivdyetools/svg` and whole-graph gates before merge → version/CHANGELOG decision → merge → Actions **Publish Packages to npm** for `@xivdyetools/svg`; verify registry before downstream adoption.

## Sprint A-BOT-LOGIC — packages/bot-logic

After A-CORE and A-SVG. Publish one 4.x deprecation MINOR with correctness/sanitizer fixes, the legacy-oracle rewrite, and new six-language order/sort keys for A-DISCORD. Reuse existing slot labels. Deprecate the approved redundant result field without removing it yet.

| ID | Source | Sev/Pri | Action |
|---|---|---|---|
| [2026-10-26-security/FINDING-014](../2026-10-26-security/findings/FINDING-014.md) | 2026-10-26-security | LOW / INTERNET-AUTH · P2 | `/glamour` `plain()`: escape `[` `]`, defuse mention/timestamp tokens, collapse CR/LF (or route through `sanitizeEmbedText`). |
| [2026-10-26-security/FINDING-021](../2026-10-26-security/findings/FINDING-021.md) | 2026-10-26-security | LOW / INTERNET-AUTH · P2 | Add `<` to `MARKDOWN_SPECIALS` (after `defuseMentions`), add U+061C, U+2066–2069 and the tag block to `INVISIBLE`; mirror in stoat-worker's copy. Tests for `<#id>`, `</cmd:id>`, `<:e:id>`, `<t:0>`, `<id:customize>`. |
| [2026-10-26-xivcharakit-dead-code/DEAD-005](../2026-10-26-xivcharakit-dead-code/findings/DEAD-005.md) | 2026-10-26-xivcharakit-dead-code | HIGH / NONE · NONE · REMOVE WITH CAUTION | Fix the comments and README that describe the legacy parser's errors and value echoes (the README ships to npm). |
| [2026-10-26-xivcharakit-dead-code/DEAD-015](../2026-10-26-xivcharakit-dead-code/findings/DEAD-015.md) | 2026-10-26-xivcharakit-dead-code | HIGH / LOW · NONE · REMOVE | Remove the unreachable `?? 'card.slotSkin'` slot-label fallback. |
| [2026-10-26-xivcharakit-dead-code/DEAD-016](../2026-10-26-xivcharakit-dead-code/findings/DEAD-016.md) | 2026-10-26-xivcharakit-dead-code | HIGH / LOW · NONE · REMOVE | Un-export the module-internal `getCharacterColors` and `CharaFileSource`. |
| [2026-10-26-xivcharakit-dead-code/DEAD-017](../2026-10-26-xivcharakit-dead-code/findings/DEAD-017.md) | 2026-10-26-xivcharakit-dead-code | HIGH / NONE · NONE · REMOVE | Exclude `__fixtures__/` in `tsconfig.build.json` so the test fixture stops shipping in the tarball; add an `npm pack --dry-run` file-list check. |
| [2026-10-26-xivcharakit-dead-code/DEAD-022](../2026-10-26-xivcharakit-dead-code/findings/DEAD-022.md) | 2026-10-26-xivcharakit-dead-code | HIGH / NONE · NONE · REFACTOR FIRST | Replace the four legacy-oracle sites and the `vi.fn` resolver wrapper in `swatch.test.ts` with facade or literal expectations, so the legacy imports can go in core 6.0. |
| [2026-10-26-deep-dive/BUG-001](../2026-10-26-deep-dive/findings/BUG-001.md) | 2026-10-26-deep-dive | MEDIUM / P2 | Keep hue deviance for selection, then recompute the selected dye row's displayed distance in matchingMethod just as for companions. Add a false-strictness card-argument regression; publish bot-logic then deploy consumers. |
| [2026-10-26-deep-dive/BUG-002](../2026-10-26-deep-dive/findings/BUG-002.md) | 2026-10-26-deep-dive | MEDIUM / P2 | Merge only when both active winning hexes (including composites where relevant) are equal; derive the LR label from that effective-color equality. Add EXT-28 at the command boundary. Publish bot-logic, then deploy bot consumers. |
| [2026-10-26-deep-dive/BUG-004](../2026-10-26-deep-dive/findings/BUG-004.md) | 2026-10-26-deep-dive | LOW / P2 | Allocate a nonnegative tail budget first and bound/compact note names or lines, then truncate body within remaining space and assert the final description cap. Add oversized-tail and no-complete-body-line cases. Keep the worker failed-edit handling as its separate finding. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...@xivdyetools/bot-logic` and whole-graph gates before merge → version/CHANGELOG decision → merge → Actions **Publish Packages to npm** for `@xivdyetools/bot-logic`; verify registry before downstream adoption.

## Sprint A-API — apps/api-worker

After A-WORKER-KIT/A-CORE/A-SVG as applicable. Adopt IPv6 keying and the updated core; combine upstream bounds with adjacent dead-code cleanup.

| ID | Source | Sev/Pri | Action |
|---|---|---|---|
| [2026-10-26-security/FINDING-002](../2026-10-26-security/findings/FINDING-002.md) | 2026-10-26-security | LOW / INTERNET-UNAUTH · P2 | Read the search and Glasses bodies with the existing bounded reader (about 2 MiB / 32 KiB), map oversize to `UpstreamUnavailableError`; in `cleanName` strip C0/C1 controls and bidi, collapse whitespace, cap at about 128 code points before caching; same cleaner in the build scripts. The two quadratic sinks (core `chara-gposers.ts:120`, svg `fitText`) are hardened in A-CORE and A-SVG. |
| [2026-10-26-security/FINDING-005](../2026-10-26-security/findings/FINDING-005.md) | 2026-10-26-security | LOW / INTERNET-UNAUTH · P2 | Charge only cache misses on `/v1/chara/*` to a dedicated per-IP native limiter (mirror the Universalis `onMiss`, with a 20× service key for discord-worker); accept `?version=` only when it matches the discovered/pinned context. |
| [2026-10-26-security/FINDING-029](../2026-10-26-security/findings/FINDING-029.md) | 2026-10-26-security | LOW / LOCAL · P3 | Resolve the Teamcraft staging head to a SHA as `build-acquisition.ts` does, record it with a sha256 per file in `meta.sources`; fail instead of falling back to `master`. |
| [2026-10-26-security/FINDING-038](../2026-10-26-security/findings/FINDING-038.md) | 2026-10-26-security | INFO / INTERNET-UNAUTH · P3 | Allowlist the telemetry `ver` field or drop the prerelease suffix. |
| [2026-10-26-xivcharakit-dead-code/DEAD-004](../2026-10-26-xivcharakit-dead-code/findings/DEAD-004.md) | 2026-10-26-xivcharakit-dead-code | HIGH / NONE · NONE · REMOVE | Correct the stale docs and comments: icon caching, the resolve "consumer" claim, the `latest`-version claim, the orphaned `POST /resolve` origin comment, and the `cache.ts:20` stale-while-revalidate comment. |
| [2026-10-26-xivcharakit-dead-code/DEAD-018](../2026-10-26-xivcharakit-dead-code/findings/DEAD-018.md) | 2026-10-26-xivcharakit-dead-code | HIGH / LOW · NONE · REMOVE | Delete the redundant `status === 503` test in `XivapiClient.get`. |
| [2026-10-26-xivcharakit-dead-code/DEAD-019](../2026-10-26-xivcharakit-dead-code/findings/DEAD-019.md) | 2026-10-26-xivcharakit-dead-code | HIGH / LOW · NONE · REMOVE | Drop the `CharaTwinRules` re-export from `types.ts`. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...xivdyetools-api-worker` and whole-graph gates before merge → merge → `deploy-api-worker.yml` (production); beta workflow only when explicitly selected.

## Sprint A-PRESETS — apps/presets-api

After A-WORKER-KIT. Add the capped approved-only batch-by-id lookup before A-DISCORD switches favorite listing; preserve missing/failed outcomes and acting-user rate limits. Atomic quota admission can satisfy both distinct quota findings with separate assertions. Any linked-identity provider support selected here must deploy before A-MODERATION.

| ID | Source | Sev/Pri | Action |
|---|---|---|---|
| [2026-10-26-security/FINDING-015](../2026-10-26-security/findings/FINDING-015.md) | 2026-10-26-security | LOW / INTERNET-AUTH · P2 | Add `AND NOT EXISTS (…banned_users…)` to the `prepareStatusUpdate` and `prepareRevert` WHERE clauses so the ban is the server's guard (moderation-worker's pre-check stays as the friendly message). |
| [2026-10-26-security/FINDING-016](../2026-10-26-security/findings/FINDING-016.md) | 2026-10-26-security | LOW / INTERNET-AUTH · P2 | Run tags (joined) and `example_link` through `moderateContent` on submit and on change; count a tag/link change as a text edit for the `text_edit` quota and the approved→pending flip. (existing decision gate) |
| [2026-10-26-security/FINDING-018](../2026-10-26-security/findings/FINDING-018.md) | 2026-10-26-security | LOW / INTERNET-AUTH · P2 | `reserveDailyEvent('submission')` before `moderateContent` (reserve-then-act); correct `security-trade-offs.md:309`. May lapse with the Perspective key — decide before the 2026-12-31 sunset. |
| [2026-10-26-security/FINDING-019](../2026-10-26-security/findings/FINDING-019.md) | 2026-10-26-security | LOW / INTERNET-AUTH · P2 | Keep the `preview_upload` slot when the image-worker decode fails, or count decode failures as their own capped kind. (existing decision gate) |
| [2026-10-26-security/FINDING-037](../2026-10-26-security/findings/FINDING-037.md) | 2026-10-26-security | INFO / INTERNET-UNAUTH · P3 | Clamp `page` to a sane maximum before computing the OFFSET. |
| [2026-10-26-deep-dive/BUG-005](../2026-10-26-deep-dive/findings/BUG-005.md) | 2026-10-26-deep-dive | LOW / P2 | Reserve submission quota atomically or use the event's monotonic id as the final-slot tie-break and release reservations for rolled-back creates. |
| [2026-10-26-deep-dive/BUG-006](../2026-10-26-deep-dive/findings/BUG-006.md) | 2026-10-26-deep-dive | LOW / P2 | Validate effective primary plus effective secondary list after merging edits with the stored preset; optionally normalize away the promoted secondary. |
| [2026-10-26-deep-dive/BUG-007](../2026-10-26-deep-dive/findings/BUG-007.md) | 2026-10-26-deep-dive | LOW / P2 | Build the response from the post-vote row already read for notification or copy the successful vote result's count. |
| [2026-10-26-deep-dive/BUG-008](../2026-10-26-deep-dive/findings/BUG-008.md) | 2026-10-26-deep-dive | LOW / P2 | Compare-and-set against captured image state, inspect changes, remove newly stored object on lost/deleted row, and clean only the replaced key for the winning update. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...xivdyetools-presets-api` and whole-graph gates before merge → merge → `deploy-presets-api.yml` (production); beta workflow only when explicitly selected.

## Sprint A-OAUTH — apps/oauth

After A-WORKER-KIT. Resolve the identity-link product decision first. If oauth is chosen as the linked-identity provider, ship that support before A-MODERATION.

| ID | Source | Sev/Pri | Action |
|---|---|---|---|
| [2026-10-26-security/FINDING-023](../2026-10-26-security/findings/FINDING-023.md) | 2026-10-26-security | LOW / INTERNET-AUTH · P2 | On XIVAuth sign-in, when the row's `discord_id` is set but upstream no longer asserts it, detach the XIVAuth link onto a fresh row instead of minting the stale id; keep the Discord-sign-in lookup. Check production D1 first (operations gates). (existing decision gate) |
| [2026-10-26-security/FINDING-032](../2026-10-26-security/findings/FINDING-032.md) | 2026-10-26-security | LOW / LOCAL · P3 | `[env.development]`: add `routes = []` and `workers_dev = false` (or an explicit dev route); extend `wrangler-config.test.ts`. |
| [2026-10-26-security/FINDING-036](../2026-10-26-security/findings/FINDING-036.md) | 2026-10-26-security | INFO / INTERNET-UNAUTH · P3 | Domain-separate the state HMAC from the JWT signing key (prefix or derived subkey) with a migration window for in-flight states. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...xivdyetools-oauth-worker` and whole-graph gates before merge → merge → `deploy-oauth.yml` (production); beta workflow only when explicitly selected.

## Sprint A-MODERATION — apps/moderation-worker

After A-PRESETS, A-BOT-LOGIC and the selected identity provider. Preserve the accepted decision to remove moderator names, with no policy AMEND for those removed names.

| ID | Source | Sev/Pri | Action |
|---|---|---|---|
| [2026-10-26-security/FINDING-001](../2026-10-26-security/findings/FINDING-001.md) | 2026-10-26-security | MEDIUM / INTERNET-AUTH · P2 | *(decided 2026-10-26)* Attribute decisions through `moderation_log` and drop the moderator username from the moderation-channel and submission-log posts, the ban post and discord-worker's preview-image post (the discord-worker file changes in A-DISCORD); update the `previewImage.approvedFooter` / `rejectedFooter` keys and tests; no policy edit. |
| [2026-10-26-security/FINDING-025](../2026-10-26-security/findings/FINDING-025.md) | 2026-10-26-security | LOW / INTERNET-AUTH · P2 | Ask presets-api or oauth for the author's linked identities and hide and match both on ban; or show the moderator every id sharing the author name. (existing decision gate) |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...xivdyetools-moderation-worker` and whole-graph gates before merge → merge → `deploy-moderation-worker.yml` (production); beta workflow only when explicitly selected.

## Sprint A-DISCORD — apps/discord-worker

After A-WORKER-KIT/A-BOT-LOGIC and the capped batch endpoint. Also remove moderator names from preview posts, apply the bot half of snapshot-policy correction, fix paired attachment comments, and correct beta-secret comments. Measure favorite requests at 1/10/50 entries: up to 49 fewer request/query round trips, not rows read. Command localization registration ships through the workflow.

| ID | Source | Sev/Pri | Action |
|---|---|---|---|
| [2026-10-26-security/FINDING-022](../2026-10-26-security/findings/FINDING-022.md) | 2026-10-26-security | LOW / INTERNET-AUTH · P2 | CORRECT `PRIVACY_POLICY.md` §3 Character Files item 2: the card also shows clan, gender and the producing tool. Six files; same commit as the policy half of [2026-10-26-security/FINDING-027](../2026-10-26-security/findings/FINDING-027.md). |
| [2026-10-26-security/FINDING-024](../2026-10-26-security/findings/FINDING-024.md) | 2026-10-26-security | LOW / INTERNET-AUTH · P2 | After A-PRESETS deploys its capped approved-only batch lookup, switch favorite listing to that endpoint; preserve favorite order, distinguish missing from failed results, and pass acting-user rate-limit context. Assert one binding request for a 50-entry list and handle delivery/partial failures. This one implementation also satisfies the deduplicated optimization. |
| [2026-10-26-security/FINDING-039](../2026-10-26-security/findings/FINDING-039.md) | 2026-10-26-security | INFO / INTERNET-UNAUTH · P3 | `/webhooks/preset-submission`: failed-auth throttle (or binding-only check) before the bearer compare. |
| [2026-10-26-security/FINDING-040](../2026-10-26-security/findings/FINDING-040.md) | 2026-10-26-security | INFO / INTERNET-AUTH · P3 | Add a cheap `button` tier before `trackButtonClick`, or record the Analytics-Engine-only effect in `security-trade-offs.md` (existing decision gate). |
| [2026-10-26-xivcharakit-dead-code/DEAD-014](../2026-10-26-xivcharakit-dead-code/findings/DEAD-014.md) | 2026-10-26-xivcharakit-dead-code | HIGH / LOW · NONE · REMOVE | Drop `downloadCharaAttachment`'s text-only shape and the adapters' `fileText` pass-through; the adapters assert `fileBytes`. |
| [2026-10-26-deep-dive/BUG-009](../2026-10-26-deep-dive/findings/BUG-009.md) | 2026-10-26-deep-dive | LOW / P2 | Paginate or budget complete lines within 4096 including escaped names and truncation notice; check edit success. |
| [2026-10-26-deep-dive/BUG-010](../2026-10-26-deep-dive/findings/BUG-010.md) | 2026-10-26-deep-dive | LOW / P2 | Preserve found/missing/failed outcomes; show and trace upstream failures; identify partial results. |
| [2026-10-26-deep-dive/BUG-011](../2026-10-26-deep-dive/findings/BUG-011.md) | 2026-10-26-deep-dive | LOW / P2 | Check safeEdit boolean and mark delivery failure; select bounded retry or short fallback. Consider a shared delivery helper to prevent repetition across adapters. |
| [2026-10-26-i18n/HC-002](findings/HC-002.md) | 2026-10-26-i18n | P1 | Carry locale into autocomplete, match/display official localized race/clan names while preserving existing canonical stored values, and render localized names alongside canonical tokens in validation. Keep this optional preference's dormant consumer status explicit. |
| [2026-10-26-i18n/I18N-001](findings/I18N-001.md) | 2026-10-26-i18n | P2 | Reuse card.swatchSlotName.* for slot display names while preserving emoji and canonical values. Author six-language row-order and sort display keys, then cover these three choice families in localize.test.ts. Deliberately English method tags, endonyms and preset categories are outside this finding. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...xivdyetools-discord-worker` and whole-graph gates before merge → merge → `deploy-discord-worker.yml` (production); beta workflow only when explicitly selected.

## Sprint A-WEB — apps/web-app

After required package publishes. Also apply the code-point-safe file-name cap paired with core labels. Keep persisted settings, result rendering, async modal ownership and cache generations consistent. All policy edits are six-file owner changes, behind unresolved decisions where listed.

| ID | Source | Sev/Pri | Action |
|---|---|---|---|
| [2026-10-26-security/FINDING-003](../2026-10-26-security/findings/FINDING-003.md) | 2026-10-26-security | LOW / INTERNET-UNAUTH · P2 | Name the Swatch character record with the localized default or add an empty name field; CORRECT PRIVACY.md:36-40 (six files). (existing decision gate) |
| [2026-10-26-security/FINDING-006](../2026-10-26-security/findings/FINDING-006.md) | 2026-10-26-security | LOW / INTERNET-UNAUTH · P2 | Reword `preset.gateBrowseNote` in all six `locales/*.json`; run `validate:i18n`. |
| [2026-10-26-security/FINDING-007](../2026-10-26-security/findings/FINDING-007.md) | 2026-10-26-security | LOW / INTERNET-UNAUTH · P2 | CORRECT the "saved palettes" term collision in `PRIVACY.fr.md` (and ja/ko where it collides): say saved community presets are not cleared by that control. |
| [2026-10-26-security/FINDING-010](../2026-10-26-security/findings/FINDING-010.md) | 2026-10-26-security | LOW / INTERNET-UNAUTH · P2 | CORRECT "a dozen small integers" (up to 27 plus 12 slot names). |
| [2026-10-26-security/FINDING-011](../2026-10-26-security/findings/FINDING-011.md) | 2026-10-26-security | LOW / INTERNET-UNAUTH · P2 | Narrow `connect-src` to the named hosts, or CORRECT the sentence. (existing decision gate) |
| [2026-10-26-security/FINDING-012](../2026-10-26-security/findings/FINDING-012.md) | 2026-10-26-security | LOW / INTERNET-UNAUTH · P2 | CORRECT Terms "Appeals and removal" step 3 so XIVAuth-only accounts can follow it. |
| [2026-10-26-security/FINDING-013](../2026-10-26-security/findings/FINDING-013.md) | 2026-10-26-security | LOW / INTERNET-UNAUTH · P2 | CORRECT Terms "Accounts": display name, with the username as the fallback. |
| [2026-10-26-security/FINDING-026](../2026-10-26-security/findings/FINDING-026.md) | 2026-10-26-security | LOW / INTERNET-AUTH · P2 | **AMEND** PRIVACY.md Network access item 3: browsing while signed out sends nothing; signed in, opening a preset sends the token to check the vote. (existing decision gate) Optionally defer the check. |
| [2026-10-26-security/FINDING-027](../2026-10-26-security/findings/FINDING-027.md) | 2026-10-26-security | LOW / INTERNET-AUTH · P2 | CORRECT the previous-version-snapshot wording (approved presets only) in web PRIVACY.md; the bot policy half rides A-DISCORD's commit. |
| [2026-10-26-security/FINDING-033](../2026-10-26-security/findings/FINDING-033.md) | 2026-10-26-security | INFO / INTERNET-UNAUTH · P3 | Translation fix: "other people" in `PRIVACY.de.md` and `PRIVACY.fr.md` (and ja). |
| [2026-10-26-security/FINDING-034](../2026-10-26-security/findings/FINDING-034.md) | 2026-10-26-security | INFO / INTERNET-UNAUTH · P3 | Restore the "not uploaded" assurance in `de.json` `preset.shotSlot`. |
| [2026-10-26-security/FINDING-041](../2026-10-26-security/findings/FINDING-041.md) | 2026-10-26-security | INFO / INTERNET-AUTH · P3 | Apply `sanitizePreviewImageUrl` in `preset-edit-form.ts`. |
| [2026-10-26-security/FINDING-045](../2026-10-26-security/findings/FINDING-045.md) | 2026-10-26-security | INFO / INTERNAL · P3 | Validate tribe against the clan list in `chara-inspection-protocol.ts` before casting to `SubRace`. |
| [2026-10-26-security/FINDING-048](../2026-10-26-security/findings/FINDING-048.md) | 2026-10-26-security | INFO / INTERNAL · P3 | Field-validate the `/v1/chara/resolve` response before it reaches CSS `url()`, link builders and `Intl.ListFormat`. |
| [2026-10-26-xivcharakit-dead-code/DEAD-001](../2026-10-26-xivcharakit-dead-code/findings/DEAD-001.md) | 2026-10-26-xivcharakit-dead-code | HIGH / NONE · NONE · REMOVE | Comments only: `swatch-tool.ts:1103`, `glamour-block.ts:244-247,302-304`, `chara-resolve-service.ts:3`, the app `CLAUDE.md:136`. |
| [2026-10-26-xivcharakit-dead-code/DEAD-006](../2026-10-26-xivcharakit-dead-code/findings/DEAD-006.md) | 2026-10-26-xivcharakit-dead-code | HIGH / LOW · NONE · REMOVE | Drop the unreachable `ISSUE_KEY` entry for `EYE_PAIRING_UNCONFIRMED` (it falls to the default). |
| [2026-10-26-xivcharakit-dead-code/DEAD-007](../2026-10-26-xivcharakit-dead-code/findings/DEAD-007.md) | 2026-10-26-xivcharakit-dead-code | HIGH / LOW · NONE · REMOVE | Remove the facewear-era `dye.itemID <= 0` guard in the swatch matching loops (always false since schema v2). |
| [2026-10-26-xivcharakit-dead-code/DEAD-008](../2026-10-26-xivcharakit-dead-code/findings/DEAD-008.md) | 2026-10-26-xivcharakit-dead-code | HIGH / LOW · NONE · REFACTOR FIRST | Import `MONO` / `SANS` from `chara-ui` instead of redefining them in `swatch-tool.ts`. |
| [2026-10-26-xivcharakit-dead-code/DEAD-009](../2026-10-26-xivcharakit-dead-code/findings/DEAD-009.md) | 2026-10-26-xivcharakit-dead-code | HIGH / LOW · NONE · REMOVE WITH CAUTION | Remove `CharaResolveUnavailableError.status` (never read, no caller checks the error type). |
| [2026-10-26-xivcharakit-dead-code/DEAD-010](../2026-10-26-xivcharakit-dead-code/findings/DEAD-010.md) | 2026-10-26-xivcharakit-dead-code | HIGH / LOW · NONE · REMOVE WITH CAUTION | Remove `CharaResolveResult.version` (stored, never read). First confirm no planned client use of the XIVAPI version key. |
| [2026-10-26-xivcharakit-dead-code/DEAD-011](../2026-10-26-xivcharakit-dead-code/findings/DEAD-011.md) | 2026-10-26-xivcharakit-dead-code | HIGH / LOW · NONE · REMOVE WITH CAUTION | Remove the non-null dye-object validators from the inspection protocol (~245 lines); keep the worker's dye-null assertions green — they become the guard. |
| [2026-10-26-xivcharakit-dead-code/DEAD-012](../2026-10-26-xivcharakit-dead-code/findings/DEAD-012.md) | 2026-10-26-xivcharakit-dead-code | HIGH / LOW · NONE · REFACTOR FIRST | Make `actionsHost` / `onSubmitPalette` required and delete the missing-host fallbacks in `GlamourBlock`. |
| [2026-10-26-xivcharakit-dead-code/DEAD-013](../2026-10-26-xivcharakit-dead-code/findings/DEAD-013.md) | 2026-10-26-xivcharakit-dead-code | MEDIUM / LOW · NONE · REMOVE WITH CAUTION | Remove the `check-bundle-size.js` rows that match no emitted chunk (vendor-spectral, other vendor, dye selector); re-run `build:check`. |
| [2026-10-26-deep-dive/BUG-012](../2026-10-26-deep-dive/findings/BUG-012.md) | 2026-10-26-deep-dive | LOW / P2 | Invalidate sheetOpenToken and close any open export sheet on session replacement/clear, or bind the pending open to the captured session identity. Test SWAP and a replacement file during the import. |
| [2026-10-26-deep-dive/BUG-013](../2026-10-26-deep-dive/findings/BUG-013.md) | 2026-10-26-deep-dive | LOW / P2 | Carry matchingMethod through export payloads, preserve its identity in JSON and format with the core metric vocabulary/precision (BAND_METHOD_DP gives OKLAB three places). Use the same precision in swatch summaries and reverse badges. Keep generic Delta labels where intended but identify the selected metric nearby. |
| [2026-10-26-deep-dive/BUG-014](../2026-10-26-deep-dive/findings/BUG-014.md) | 2026-10-26-deep-dive | LOW / P2 | Snapshot cacheGeneration (and preferably authenticated identity) when starting hasVoted, and cache only if unchanged when its response arrives; invalidate on vote mutations/auth changes. Add a deferred check-versus-successful-vote test that verifies a subsequent hasVoted actually fetches fresh state. |
| [2026-10-26-deep-dive/BUG-015](../2026-10-26-deep-dive/findings/BUG-015.md) | 2026-10-26-deep-dive | MEDIUM / P2 | Restore the derived match cards and share parameters during/after every render without reloading the selected cell or duplicating subscriptions; add a settled forward-match locale regression. |
| [2026-10-26-deep-dive/BUG-016](../2026-10-26-deep-dive/findings/BUG-016.md) | 2026-10-26-deep-dive | LOW / P2 | Keep the edit form modal ID and dismiss only that ID, mirroring the submission form. Keep the callback semantics explicit when the initiating modal has already closed. |
| [2026-10-26-deep-dive/BUG-017](../2026-10-26-deep-dive/findings/BUG-017.md) | 2026-10-26-deep-dive | LOW / P2 | Seed Accessibility display options from ConfigController before the first results render, then subscribe to changes. Retain intentional tool-specific metadata restrictions. |
| [2026-10-26-deep-dive/BUG-018](../2026-10-26-deep-dive/findings/BUG-018.md) | 2026-10-26-deep-dive | MEDIUM / P2 | Use the canonical harmony config as the initial authority for type/count, and apply harmonyType through the controller subscription with the existing pin-clearing and regeneration behavior. Avoid redundant full regenerations from the bridge. |
| [2026-10-26-deep-dive/BUG-019](../2026-10-26-deep-dive/findings/BUG-019.md) | 2026-10-26-deep-dive | LOW / P2 | Apply the complete supported DisplayOptionsConfig key set, preferably through the shared helper. Seed it from canonical settings and test the single-card and duel-card rows. |
| [2026-10-26-deep-dive/BUG-020](../2026-10-26-deep-dive/findings/BUG-020.md) | 2026-10-26-deep-dive | LOW / P2 | Have the canonical results/selection-change path fetch the newly displayed dyes when price display is enabled, respecting existing service request coalescing and price toggles; cover direct v4 selectDye plus restored Gradient endpoints. |
| [2026-10-26-deep-dive/BUG-021](../2026-10-26-deep-dive/findings/BUG-021.md) | 2026-10-26-deep-dive | LOW / P2 | Handle article keyboard activation only when the article itself is the event target, or use a separate open-details button so nested controls retain native keyboard behavior. |
| [2026-10-26-deep-dive/BUG-022](../2026-10-26-deep-dive/findings/BUG-022.md) | 2026-10-26-deep-dive | LOW / P2 | Either represent a pending End endpoint independently so an armed pick goes into End, or prevent/clearly explain End arming until Start is selected. Preserve serialization and existing no-duplicate rules. |
| [2026-10-26-deep-dive/BUG-023](../2026-10-26-deep-dive/findings/BUG-023.md) | 2026-10-26-deep-dive | LOW / P2 | Refresh or update userSubmissions on successful edit in addition to the public pool, including pending moderation fields, and assert the next Mine card/edit baseline reflects the authoritative response. |
| [2026-10-26-i18n/HC-001](findings/HC-001.md) | 2026-10-26-i18n | P1 | Extend the existing dependency-free six-language fatal copy table with a localized detail (or localized safe error-code details), and use it without calling LanguageService on this failure path. Keep the default English fallback. Assert all displayed fatal-screen sentences in each locale. |
| [2026-10-26-i18n/TERM-001](findings/TERM-001.md) | 2026-10-26-i18n | P2 | Apply the established 색상 house term to these five Hue uses, retaining the surrounding Korean wording. This is an existing project terminology decision, not a new translation or a guessed game-client term. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app` and whole-graph gates before merge; `pnpm --filter xivdyetools-web-app run build:check` → merge → `deploy-web-app.yml` (production); beta workflow only when explicitly selected.

## Sprint A-OG-COPY — apps/og-worker

After relevant core/SVG publication. Correct the default Discord-frame subtitle in all six authored tables; X omits this subtitle. Bump the OG cache version and run glyph/fit gates.

| ID | Source | Sev/Pri | Action |
|---|---|---|---|
| [2026-10-26-i18n/I18N-002](findings/I18N-002.md) | 2026-10-26-i18n | P1 | Update the count in all six authored deck subtitles, or remove the brittle number, then perform the OG string/font gates and re-subset only if required by the changed glyphs. Bump the OG cache version so existing cached cards receive the corrected copy. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...xivdyetools-og-worker` and whole-graph gates before merge → merge → `deploy-og-worker.yml` (production); beta workflow only when explicitly selected.

## Sprint A-IMAGE — apps/image-worker

One image-worker release; validate peak decode memory in the Worker runtime before treating the accounting change as complete.

| ID | Source | Sev/Pri | Action |
|---|---|---|---|
| [2026-10-26-security/FINDING-020](../2026-10-26-security/findings/FINDING-020.md) | 2026-10-26-security | LOW / INTERNET-AUTH · P2 | Read the PNG IHDR bit depth and colour type in `dimensions.ts`; refuse 16-bit input or charge it a 2× factor against the pixel budget; re-measure the peak (8-bit at the cap is already about 110 MiB) and confirm against workerd. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...xivdyetools-image-worker` and whole-graph gates before merge → merge → `deploy-image-worker.yml` (production); beta workflow only when explicitly selected.

## Sprint R-CI — repository tooling/workflows

One repository verification gate, not a package publish. Also add Pages deployment retention as the companion to the history cleanup, preserving current production/beta deployments.

| ID | Source | Sev/Pri | Action |
|---|---|---|---|
| [2026-10-26-security/FINDING-031](../2026-10-26-security/findings/FINDING-031.md) | 2026-10-26-security | LOW / LOCAL · P3 | Raise the override to `'vitepress>vite': '>=6.4.5 <7'`, `pnpm install`, confirm Dependabot alerts #13–#17 close; update the stale FINDING-036 comment. |
| [2026-10-26-security/FINDING-049](../2026-10-26-security/findings/FINDING-049.md) | 2026-10-26-security | INFO / LOCAL · P3 | `publish-packages.yml`: grant `id-token: write` only to the job (or step) that runs `pnpm publish`; build and test in a job without it. |

**Ends with:** `pnpm test:scripts`, `pnpm type-check:scripts`, `pnpm docs:check-links`, `pnpm docs:check-versions`, `pnpm workers:check-logs` as affected → repository verification gate; no unrelated application deploy.

## Sprint R-DOCS-DECISIONS — repository docs/process

One repository documentation/process gate. Carry dated live-state evidence as inherited, not freshly rechecked. On actual Perspective key deletion, schedule separate presets-api behavior verification and web/Discord six-file ToS updates; do not publish those claims early. If query signing is chosen, add the explicit auth/presets/Discord/moderation compatibility sequence below.

| ID | Source | Sev/Pri | Action |
|---|---|---|---|
| [2026-10-26-security/FINDING-030](../2026-10-26-security/findings/FINDING-030.md) | 2026-10-26-security | INFO / LOCAL · P3 | The live check found no signing secret on `-dev`. Correct `DEPLOY_ENVIRONMENTS.md:283-284` and `:324` and the discord-worker `wrangler.toml:92-96` comment to say `BOT_API_SECRET` / `BOT_SIGNING_SECRET` must NOT be set on `-dev`; reword the "writes a genuine row" residual-risk line. |
| [2026-10-26-security/FINDING-035](../2026-10-26-security/findings/FINDING-035.md) | 2026-10-26-security | P3 · INFO / INTERNET-UNAUTH | **Dated: before 2026-12-31.** Add both Terms-of-Service auto-publish sentences to the `DEPRECATIONS.md` Perspective-sunset checklist (doc-only); the six-file CORRECTs land on key-deletion day. |
| [2026-10-26-security/FINDING-046](../2026-10-26-security/findings/FINDING-046.md) | 2026-10-26-security | INFO / INTERNAL · P3 | Decide: record "v2 signature binds the path, not the query" in `security-trade-offs.md`, or sign the query (a coordinated `auth` + three-app change). |
| [2026-10-26-security/FINDING-053](../2026-10-26-security/findings/FINDING-053.md) | 2026-10-26-security | INFO / LOCAL · P3 | Add a deletion-and-export runbook under `docs/operations/` listing every per-user store (D1 tables, KV prefixes, R2 objects, the web and bot stores) the 30-day promises cover. |

**Ends with:** `pnpm test:scripts`, `pnpm type-check:scripts`, `pnpm docs:check-links`, `pnpm docs:check-versions`, `pnpm workers:check-logs` as affected → repository verification gate; no unrelated application deploy.

## Sprint H-LOGGER — packages/logger

Publish hardening after ordinary correctness work. Its dependent package and app adoption sprints below are required; do not leave propagation as next deploy.

| ID | Source | Sev/Pri | Action |
|---|---|---|---|
| [2026-10-26-security/FINDING-044](../2026-10-26-security/findings/FINDING-044.md) | 2026-10-26-security | INFO / INTERNAL · P3 | Run a non-Error `error` object through `redactSensitiveFields` before `safeStringify`; fix the five context-as-error call sites (`logger.error(msg, undefined, ctx)`). |
| [2026-10-26-security/FINDING-047](../2026-10-26-security/findings/FINDING-047.md) | 2026-10-26-security | INFO / INTERNAL · P3 | Add Discord webhook and interaction-token URL shapes to the value-shape and sanitize rules. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...@xivdyetools/logger` and whole-graph gates before merge → version/CHANGELOG decision → merge → Actions **Publish Packages to npm** for `@xivdyetools/logger`; verify registry before downstream adoption.

## Sprint H-AUTH — packages/auth

Publish canonical-encoding hardening. Run private test-utils verification, then release each auth consumer separately using the adoption table.

| ID | Source | Sev/Pri | Action |
|---|---|---|---|
| [2026-10-26-security/FINDING-042](../2026-10-26-security/findings/FINDING-042.md) | 2026-10-26-security | INFO / INTERNET-AUTH · P3 | `base64UrlDecodeBytes` for JWT and V2 signature segments: reject whitespace, padding and non-zero trailing bits (re-encode and compare). |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...@xivdyetools/auth` and whole-graph gates before merge → version/CHANGELOG decision → merge → Actions **Publish Packages to npm** for `@xivdyetools/auth`; verify registry before downstream adoption.

## Required hardening adoption sprints

Each row below is a **separate sprint** ending in the named unit publish/deploy/verification. Package adoption is explicit because packed dependency pins can otherwise retain old versions. Resolve compatible bump sizes against the actual published manifests at execution. The five context-as-error call-site corrections ride their owning apps, not the logger package sprint.

| Sprint | Unit | Depends on / action | Ends with |
|---|---|---|---|
| H-CORE-ADOPT | packages/core | H-LOGGER; update logger dependency/publish core 5.x; wait for its upstream publishes | `pnpm turbo run build type-check lint test --filter=...@xivdyetools/core` and whole-graph gates before merge → version/CHANGELOG decision → merge → Actions **Publish Packages to npm** for `@xivdyetools/core`; verify registry before downstream adoption. |
| H-WORKER-KIT-ADOPT | packages/worker-kit | H-LOGGER; update logger dependency/publish; wait for its upstream publishes | `pnpm turbo run build type-check lint test --filter=...@xivdyetools/worker-kit` and whole-graph gates before merge → version/CHANGELOG decision → merge → Actions **Publish Packages to npm** for `@xivdyetools/worker-kit`; verify registry before downstream adoption. |
| H-SVG-ADOPT | packages/svg | H-CORE-ADOPT; update core dependency/publish; wait for its upstream publishes | `pnpm turbo run build type-check lint test --filter=...@xivdyetools/svg` and whole-graph gates before merge → version/CHANGELOG decision → merge → Actions **Publish Packages to npm** for `@xivdyetools/svg`; verify registry before downstream adoption. |
| H-BOT-LOGIC-ADOPT | packages/bot-logic | H-CORE-ADOPT and H-SVG-ADOPT; update packed dependencies/publish 4.x; wait for its upstream publishes | `pnpm turbo run build type-check lint test --filter=...@xivdyetools/bot-logic` and whole-graph gates before merge → version/CHANGELOG decision → merge → Actions **Publish Packages to npm** for `@xivdyetools/bot-logic`; verify registry before downstream adoption. |
| H-TEST-UTILS | packages/test-utils | H-AUTH; verify the private auth consumer; wait for its upstream publishes | `pnpm turbo run build type-check lint test --filter=...@xivdyetools/test-utils` and whole-graph gates before merge → private verification gate; no npm publish. |
| H-API | apps/api-worker | Adopt core + worker-kit and transitive logger; wait for its upstream publishes | `pnpm turbo run build type-check lint test --filter=...xivdyetools-api-worker` and whole-graph gates before merge → merge → `deploy-api-worker.yml` (production); beta workflow only when explicitly selected. |
| H-PRESETS | apps/presets-api | Adopt auth + worker-kit/logger; correct context-as-error call sites; wait for its upstream publishes | `pnpm turbo run build type-check lint test --filter=...xivdyetools-presets-api` and whole-graph gates before merge → merge → `deploy-presets-api.yml` (production); beta workflow only when explicitly selected. |
| H-OAUTH | apps/oauth | Adopt auth + worker-kit/logger; wait for its upstream publishes | `pnpm turbo run build type-check lint test --filter=...xivdyetools-oauth-worker` and whole-graph gates before merge → merge → `deploy-oauth.yml` (production); beta workflow only when explicitly selected. |
| H-IMAGE | apps/image-worker | Adopt worker-kit/logger; wait for its upstream publishes | `pnpm turbo run build type-check lint test --filter=...xivdyetools-image-worker` and whole-graph gates before merge → merge → `deploy-image-worker.yml` (production); beta workflow only when explicitly selected. |
| H-OG | apps/og-worker | Adopt core + SVG + worker-kit/logger; wait for its upstream publishes | `pnpm turbo run build type-check lint test --filter=...xivdyetools-og-worker` and whole-graph gates before merge → merge → `deploy-og-worker.yml` (production); beta workflow only when explicitly selected. |
| H-DISCORD | apps/discord-worker | Adopt auth + bot-logic + SVG + core + logger + worker-kit; correct context-as-error call sites; wait for its upstream publishes | `pnpm turbo run build type-check lint test --filter=...xivdyetools-discord-worker` and whole-graph gates before merge → merge → `deploy-discord-worker.yml` (production); beta workflow only when explicitly selected. |
| H-MODERATION | apps/moderation-worker | Adopt auth + bot-logic + logger + worker-kit; correct context-as-error call sites; wait for its upstream publishes | `pnpm turbo run build type-check lint test --filter=...xivdyetools-moderation-worker` and whole-graph gates before merge → merge → `deploy-moderation-worker.yml` (production); beta workflow only when explicitly selected. |
| H-WEB | apps/web-app | Adopt core + SVG + logger; wait for its upstream publishes | `pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app` and whole-graph gates before merge; `pnpm --filter xivdyetools-web-app run build:check` → merge → `deploy-web-app.yml` (production); beta workflow only when explicitly selected. |
| H-STOAT | apps/stoat-worker | Adopt bot-logic/logger, mirror sanitizer and correct context-as-error calls; keep parked; wait for its upstream publishes | `pnpm turbo run build type-check lint test --filter=...xivdyetools-stoat-worker` and whole-graph gates before merge → parked-unit verification only; no activation or deployment. |

## Isolated major sequence

Requires ordinary fixes/adoptions and shipped minor deprecations, eliminated legacy test oracle, Discord attachment preparation, and explicit beta acceptance. No KEEP item is automatically converted into a removal just because a major is opened.

### Sprint M-CORE — packages/core

Isolated core 6.0.0 after shipped/adopted deprecation MINOR, legacy-oracle rewrite and explicit beta acceptance. Remove legacy parser/resolver and parity [host] half; retain [library]. Preserve relocated live contracts. Optional KEEP removals require their own revisit decision.

| ID | Source | Sev/Pri | Action |
|---|---|---|---|
| [2026-10-26-xivcharakit-dead-code/DEAD-024](../2026-10-26-xivcharakit-dead-code/findings/DEAD-024.md) | 2026-10-26-xivcharakit-dead-code | HIGH / HIGH · MAJOR · REFACTOR FIRST | Phase 2 (core 6.0.0, after the deprecation release has shipped and beta acceptance has closed): delete `parseCharaFile`, `resolveCharaColors`, the legacy-only types, the three legacy test files and the parity harness's `[host]` half; drop the barrel rows; update the three docs. Phase 1 (the `@deprecated` tags) is in A-CORE. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...@xivdyetools/core` and whole-graph gates before merge → version/CHANGELOG decision → merge → Actions **Publish Packages to npm** for `@xivdyetools/core`; verify registry before downstream adoption.

### Sprint M-BOT-LOGIC — packages/bot-logic

Isolated bot-logic 5.0.0 after M-CORE is published and M-SVG compatibility adoption is published. Remove the approved redundant character field. fileText/NO_INPUT/familySize optional removals remain KEEP until separately selected; the earlier Discord attachment cleanup is still required.

| ID | Source | Sev/Pri | Action |
|---|---|---|---|
| [2026-10-26-xivcharakit-dead-code/DEAD-023](../2026-10-26-xivcharakit-dead-code/findings/DEAD-023.md) | 2026-10-26-xivcharakit-dead-code | HIGH / MEDIUM · MAJOR · REFACTOR FIRST | Remove `SwatchResult.character` and its legacy `ResolvedCharaSlot` back-mapping; first ship `@deprecated` tags in a 4.x minor and rewrite the library tests to assert on the card and embed. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...@xivdyetools/bot-logic` and whole-graph gates before merge → version/CHANGELOG decision → merge → Actions **Publish Packages to npm** for `@xivdyetools/bot-logic`; verify registry before downstream adoption.

M-SVG below occurs **between** M-CORE and M-BOT-LOGIC. Each other row is its own consumer release after the package versions are available; no deploy-everything step.

| Sprint | Unit | Action | Ends with |
|---|---|---|---|
| M-SVG | packages/svg | Compatibility/adoption publish against core 6 before bot-logic 5 | `pnpm turbo run build type-check lint test --filter=...@xivdyetools/svg` and whole-graph gates before merge → version/CHANGELOG decision → merge → Actions **Publish Packages to npm** for `@xivdyetools/svg`; verify registry before downstream adoption. |
| M-API | apps/api-worker | Adopt core 6; keep v1 HTTP compatibility | `pnpm turbo run build type-check lint test --filter=...xivdyetools-api-worker` and whole-graph gates before merge → merge → `deploy-api-worker.yml` (production); beta workflow only when explicitly selected. |
| M-WEB | apps/web-app | Adopt core 6/SVG; preserve protocol/live-field contracts and bundle budget | `pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app` and whole-graph gates before merge; `pnpm --filter xivdyetools-web-app run build:check` → merge → `deploy-web-app.yml` (production); beta workflow only when explicitly selected. |
| M-OG | apps/og-worker | Adopt core 6/SVG and verify card generation | `pnpm turbo run build type-check lint test --filter=...xivdyetools-og-worker` and whole-graph gates before merge → merge → `deploy-og-worker.yml` (production); beta workflow only when explicitly selected. |
| M-DISCORD | apps/discord-worker | Adopt core 6/SVG/bot-logic 5 and verify adapters | `pnpm turbo run build type-check lint test --filter=...xivdyetools-discord-worker` and whole-graph gates before merge → merge → `deploy-discord-worker.yml` (production); beta workflow only when explicitly selected. |
| M-MODERATION | apps/moderation-worker | Adopt bot-logic 5 and verify moderation replies | `pnpm turbo run build type-check lint test --filter=...xivdyetools-moderation-worker` and whole-graph gates before merge → merge → `deploy-moderation-worker.yml` (production); beta workflow only when explicitly selected. |
| M-STOAT | apps/stoat-worker | Adopt bot-logic 5 and verify parked adapter; no activation | `pnpm turbo run build type-check lint test --filter=...xivdyetools-stoat-worker` and whole-graph gates before merge → parked-unit verification only; no activation or deployment. |

oauth, presets-api and image-worker have hardening adoption releases above; no extra core-major deployment is required solely because unrelated consumers change.

## Terminal font sprints

### Sprint F-DISCORD — apps/discord-worker

After all rendered locale/item-name changes and major adoption: regenerate subsets only where the required cmap changed, run actual regional-face/coverage/item-name tests, and compare missing/surplus codepoints. If no font change is needed, this is a verification-only gate; do not create an empty release. Otherwise keep its Discord release separate from OG. This is a companion task, with no extra catalog ID.

**Ends with:** unchanged fonts → recorded coverage/face verification; changed fonts → `pnpm turbo run build type-check lint test --filter=...xivdyetools-discord-worker` and whole-graph gates before merge → merge → `deploy-discord-worker.yml` (production); beta workflow only when explicitly selected.

### Sprint F-OG — apps/og-worker

Terminal after all translated text and major adoption. Thread locale through OG renderer/font loader, select Chinese regional faces, and assert actual rendered glyph choice. Re-subset only if required cmap changed; bump OG cache version. F-DISCORD precedes this separate OG release.

| ID | Source | Sev/Pri | Action |
|---|---|---|---|
| [2026-10-26-i18n/FONT-001](findings/FONT-001.md) | 2026-10-26-i18n | P3 | Thread locale to the OG renderer/font loader and use JP-first for ja, SC-first for zh (and the existing intended fallback for the other locales), mirroring the tested Discord approach. Add actual regional-face render assertions. Schedule after string fixes; no re-subset is inherently required for a load-order change. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...xivdyetools-og-worker` and whole-graph gates before merge → merge → `deploy-og-worker.yml` (production); beta workflow only when explicitly selected.

## Superseded and deduplicated assignments

| ID | Superseded by | Reason |
|---|---|---|
| [2026-10-26-security/FINDING-043](../2026-10-26-security/findings/FINDING-043.md) | [2026-10-26-xivcharakit-dead-code/DEAD-023](../2026-10-26-xivcharakit-dead-code/findings/DEAD-023.md) | Approved result-field removal wins over the narrower field hardening; restore the security task if that approved major path is reversed. |
| [2026-10-26-deep-dive/OPT-001](../2026-10-26-deep-dive/findings/OPT-001.md) | [2026-10-26-security/FINDING-024](../2026-10-26-security/findings/FINDING-024.md) | Scheduling deduplication only: the same capped batch lookup/caller change has one implementation. Retain request-count and failure-semantic acceptance checks. |

## KEEP register — unchanged

All 23 original KEEP entries retain their full evidence/revisit conditions in the linked findings. The trigger is a review gate, not automatic permission to remove.

| ID | Item | Reason / revisit trigger |
|---|---|---|
| [2026-10-26-xivcharakit-dead-code/DEAD-025](../2026-10-26-xivcharakit-dead-code/findings/DEAD-025.md) | Chara row cache's stale-while-revalidate window never revalidates | The next change to CHARA_CACHE_CONFIG or CHARA_ROW_SHAPE_VERSION, a maintainer decision to add real background revalidation or a strict 7-day TTL, or a report of stale item names that outlived a game patch. |
| [2026-10-26-xivcharakit-dead-code/DEAD-026](../2026-10-26-xivcharakit-dead-code/findings/DEAD-026.md) | Eight api-worker chara exports referenced only in their own file (live symbols, redundant export keyword) | Revisit if knip.jsonc ignoreExportsUsedInFile is changed to false, or if knip starts flagging these exports in api-worker's lint:dead. At that point, un-export only the four constants. |
| [2026-10-26-xivcharakit-dead-code/DEAD-027](../2026-10-26-xivcharakit-dead-code/findings/DEAD-027.md) | ImportedCharaCharacter.extendedValid / extendedDeclared are filled but no production code reads them (KEEP: published type contract) | Published fields: review at core 6 / bot-logic 5 planning and explicitly select or reject their removal. They remain KEEP until selected; an optional prior deprecation does not itself authorize removal. |
| [2026-10-26-xivcharakit-dead-code/DEAD-028](../2026-10-26-xivcharakit-dead-code/findings/DEAD-028.md) | Provider arm of resolveCharaForTools (isPaletteProvider) is test-only in-repo but is published, documented 5.15.0 API: KEEP until core 6.0.0 | Published provider overload: at core 6 planning, re-grep every production caller and review the exact linked trigger; explicitly select narrowing only if the consumer condition still holds. |
| [2026-10-26-xivcharakit-dead-code/DEAD-029](../2026-10-26-xivcharakit-dead-code/findings/DEAD-029.md) | Barrel re-export of resolveCharaWithProvider duplicates the ./chara subpath; in-repo barrel use is test-only | Published barrel re-export: review at core 6 planning whether the subpath becomes the sole supported route. Keep unless that compatibility decision is explicitly selected. |
| [2026-10-26-xivcharakit-dead-code/DEAD-030](../2026-10-26-xivcharakit-dead-code/findings/DEAD-030.md) | CHARA_WEAPON_SLOTS exported @public with no consumer outside its own module | Published CHARA_WEAPON_SLOTS: review its consumers when core 6 planning opens; explicitly select any removal rather than automatically folding it into the major. |
| [2026-10-26-xivcharakit-dead-code/DEAD-031](../2026-10-26-xivcharakit-dead-code/findings/DEAD-031.md) | FIXED_KEYS.noItem entry cannot be reached | A core release changes the CharaPieceProblem union (chara-game-rules.ts:132), OR git grep "push('noItem')" packages/core/src/services/chara returns a hit. |
| [2026-10-26-xivcharakit-dead-code/DEAD-032](../2026-10-26-xivcharakit-dead-code/findings/DEAD-032.md) | KEEP shader tables + chara-shader-colors.ts (live via palette bridge; deliberate duplicate of xivcharakit corpus) | Re-audit when either of two conditions holds. (a) An xivcharakit release after 0.1.0-beta.4 exports a lazy, shader-only PaletteProvider entry, and switching core to it keeps web-app `run build:check` within budget. (b) A core MAJOR removes both createCharaPaletteProvider and the legacy resolveCharaColors. Before removing anything, git grep -w charaShaderHex must show no production caller. |
| [2026-10-26-xivcharakit-dead-code/DEAD-033](../2026-10-26-xivcharakit-dead-code/findings/DEAD-033.md) | KEEP CharacterColorService, interface sheets, build-character-colors script, .chara fixtures, chara-models helpers | Fixtures: revisit when the core 6.0.0 release that removes parseCharaFile/resolveCharaColors (core-legacy-03) lands AND `git ls-files \| xargs grep -l 'fixtures/.*\.chara\|lalafell-dunesfolk'` returns no test in packages/core, packages/bot-logic, apps/web-app or apps/discord-worker. Script + sheets: revisit only if production switches to xivcharakit's createDefaultPaletteProvider (i.e. createCharaPaletteProvider and CharacterColorService get no non-test import). gearModelKey/weaponModelKey/CHARA_WEAPON_SLOTS exports: revisit at the next planned core MAJOR (6.0.0). |
| [2026-10-26-xivcharakit-dead-code/DEAD-034](../2026-10-26-xivcharakit-dead-code/findings/DEAD-034.md) | matchHexFor's interpretation==='inactive' arm is unreachable under xivcharakit 0.1.0-beta.4 | When core's exact xivcharakit pin (packages/core/package.json:78) moves off 0.1.0-beta.4: re-grep dist/appearance.js for "inactive". Simplify only if that release's appearance/types.d.ts encodes the invariant, for example as a discriminated union where interpretation 'inactive' implies active false. |
| [2026-10-26-xivcharakit-dead-code/DEAD-035](../2026-10-26-xivcharakit-dead-code/findings/DEAD-035.md) | Palette provider guards (table, palette type, shader lipsLight/facePaint) the library never trips | Revisit :109/:110 only at a core MAJOR that removes createCharaPaletteProvider from the published barrel (drops the @public export at index.ts:278), and only if every remaining caller validates the request first (web-app parsePaletteRequestMessage does). Keep :133 for as long as charaShaderHex throws for a palette outside SHADER_PALETTES. |
| [2026-10-26-xivcharakit-dead-code/DEAD-036](../2026-10-26-xivcharakit-dead-code/findings/DEAD-036.md) | Exports used in their own file that exist only as test seams (web-app-09): KEEP | Re-audit a symbol when symrefs.sh apps/web-app <sym> shows prod<=1 (its in-file caller was deleted, so the body is dead) or tests=0 (no test imports it, so the export can be dropped), or when knip.jsonc ignoreExportsUsedInFile is set to false. |
| [2026-10-26-xivcharakit-dead-code/DEAD-037](../2026-10-26-xivcharakit-dead-code/findings/DEAD-037.md) | config-controller scrub of the retired swatch.fileProvided key | Remove it when either of these becomes true: (a) loadFromStorage passes stored values through sanitizeConfigPartial, so undeclared keys are dropped as importConfigs already does at :426, which makes the delete redundant; or (b) CONFIG_STORAGE_PREFIX changes from 'xivdyetools_v4_config_', which abandons all pre-5.12.7 storage. Either can be checked with a git grep on config-controller.ts. |
| [2026-10-26-xivcharakit-dead-code/DEAD-038](../2026-10-26-xivcharakit-dead-code/findings/DEAD-038.md) | Published SwatchInput/GlamourInput.fileText and the NO_INPUT guard: KEEP until bot-logic 5.0.0 | Published fileText/NO_INPUT compatibility: review at bot-logic 5 planning. Making fileBytes required and removing compatibility paths needs an explicit selection; retain them until then. |
| [2026-10-26-xivcharakit-dead-code/DEAD-039](../2026-10-26-xivcharakit-dead-code/findings/DEAD-039.md) | familySize ?? twins.length fallback is dead for this repo's api-worker | Published optional familySize: review at bot-logic 5 planning or a change to its public export/contract. Requiring it and removing the fallback needs an explicit selection; retain it until then. |
| [2026-10-26-xivcharakit-dead-code/DEAD-040](../2026-10-26-xivcharakit-dead-code/findings/DEAD-040.md) | Unreachable guard for a 304 with no retained ETag in loadIcon | Revisit when any of these happens: apps/api-worker/src/chara/xivapi.ts get() stops refusing a 304 without allowNotModified (lines 395-397); fetchIcon gets a caller other than icons.ts:25; or fetchIcon's allowNotModified is no longer Boolean(ifNoneMatch). If one does, the guard becomes reachable and needs a direct test. It does not become removable. |
| [2026-10-26-xivcharakit-dead-code/DEAD-041](../2026-10-26-xivcharakit-dead-code/findings/DEAD-041.md) | Empty-lookup guards in searchItems and loadRows are reached only by tests | Re-check when either of these happens. (1) router.ts drops its `misses.length > 0` check at line 225: the loadRows guard then becomes the live path and must stay. (2) A caller other than lookup-loader.ts:55 starts calling searchItems, or one other than router.ts:225 starts calling loadRows (`git grep -n -w -e searchItems -e loadRows apps/api-worker/src ':!*.test.ts'` shows more than these two sites). In either case keep the guards. |
| [2026-10-26-xivcharakit-dead-code/DEAD-042](../2026-10-26-xivcharakit-dead-code/findings/DEAD-042.md) | Resolve response field 'version' is read by no in-repo client | Revisit when either of these happens. (a) api-worker adds a /v2/chara/resolve route, or meta.apiVersion moves past 'v1' (apps/api-worker/src/index.ts and docs/reference/chara.md). (b) chara.md's field table marks `version` as deprecated. Until then, removing it is a breaking v1 change. |
| [2026-10-26-xivcharakit-dead-code/DEAD-043](../2026-10-26-xivcharakit-dead-code/findings/DEAD-043.md) | Icon ?version= branch has no in-repo caller | Revisit in either of two cases. (1) web-app's charaIconUrl (chara-resolve-service.ts:124) starts appending the resolve result's version: the branch is then live in-repo, so close the item. (2) The api-worker CHANGELOG and docs/reference/chara.md announce a deprecation of the /v1/chara/icon version query, or the /v1/chara/icon route is removed: drop the branch in that release. |
| [2026-10-26-xivcharakit-dead-code/DEAD-044](../2026-10-26-xivcharakit-dead-code/findings/DEAD-044.md) | Exported unit-test seams in the chara resolver | Re-audit when the CI `pnpm dead-code:check` step (ci.yml:244) reports any of these nine symbols under apps/api-worker/src/chara, or when a PR removes one of the production call sites: router.ts:193, router.ts:216, lookup-loader.ts:56, resolver.ts:135, resolver.ts:212, xivapi.ts:186-189, :422, :439, :468. |
| [2026-10-26-xivcharakit-dead-code/DEAD-045](../2026-10-26-xivcharakit-dead-code/findings/DEAD-045.md) | chara-concurrency.test.mjs is run by no CI job or turbo task (manual workerd check, deliberately kept) | The next commit that touches apps/api-worker/src/chara/lookup-loader.ts or the POST /resolve handler in apps/api-worker/src/chara/router.ts, or the next wrangler major bump in apps/api-worker/package.json. When that happens, run pnpm --filter xivdyetools-api-worker run test:chara-runtime in that PR. If it passes, add it as a ci.yml step. If it cannot pass or be maintained, delete it along with its two doc mentions. |
| [2026-10-26-xivcharakit-dead-code/DEAD-046](../2026-10-26-xivcharakit-dead-code/findings/DEAD-046.md) | facewear-unlocks.json maps 12 Glasses rows (709-720) to unlock item 52447, which has no acquisition line | acquisition.en.json gains key "52447" (Thick-rimmed Goggles gets a confirmed source) on a build-acquisition.ts run. acquisition.test.ts:38 (known === 720) and :57 (undefined for the 12 variants) then fail, so update those expectations. |
| [2026-10-26-xivcharakit-dead-code/DEAD-047](../2026-10-26-xivcharakit-dead-code/findings/DEAD-047.md) | acquisition.meta.json provenance keys read by no code | Revisit only if a commit to build-acquisition.ts removes the human review pause: its printReview call, or the user-approval step in the 2026-09-27 plan. Also revisit if regeneration moves to an unattended CI job that nobody reads. Either change would be visible as a diff to build-acquisition.ts lines 539-557. Even then, cut the keys in the generator, not in the JSON. |

## Standing verification and conditional follow-ups

- Re-read each finding at the execution commit. Prefer a focused observable regression over broad test rewrites. Gate the affected unit and dependents (`--filter=...<unit>`), then the whole graph before merge; run `pnpm dead-code:check` after removals and web `build:check` after web/shared bundle changes.
- Package releases are Actions-only. Verify registry availability before a downstream publish/deploy. Keep one package or app per sprint even when dependencies require a coordinated sequence; do not push main or deploy from this audit.
- Policy corrections use all six variants, matching Last updated dates and policy parity; AMEND requires the existing explicit product decision and must not precede the described runtime behavior. The Perspective ToS follow-ups occur on actual key deletion, with the inherited before-2026-12-31 deadline rechecked then.
- If query signing is chosen, add separate auth publish, presets-api compatibility deploy, Discord signer deploy, moderation signer deploy and final presets-api transition. Recording the current path-only trade-off instead needs no invented code rollout.
- Use current role routing for collectors/workers/verifiers; keep approvals, commits, pushes and outward-facing prose with the coordinator. This plan received independent Sol/xhigh scheduling verification; no new security-critical verdict was made.
- Record completed sprints with date, commits, publication/deployment evidence and remaining consumer work. Keep failures/blocked glyph gates visible; never lower thresholds or silently skip a unit.
