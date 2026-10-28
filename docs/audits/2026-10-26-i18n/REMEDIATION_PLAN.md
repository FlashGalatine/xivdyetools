# Merged Remediation Plan — 2026-10-26

**Sources:** [Security](../2026-10-26-security/SECURITY_AUDIT_REPORT.md) 56 + [XIVCharaKit dead code](../2026-10-26-xivcharakit-dead-code/DEAD_CODE_REPORT.md) 47 + [deep dive](../2026-10-26-deep-dive/DEEP_DIVE_REPORT.md) 24 + [i18n](I18N_AUDIT_2026-10-26.md) 6.
**Status basis:** **133 IDs: 7 fixed, 101 outstanding (including 1 partially remediated and 1 blocked on feature eligibility), 23 KEEP, 2 superseded for scheduling, 0 requiring rotation.** Execution updates 2026-10-26–27: security FINDING-028 is fixed by repository secret cleanup, FINDING-035 by the Perspective-sunset checklist addition (actual policy changes remain scheduled for key deletion), FINDING-051 by branch protection, FINDING-052 by source tags for all four published library releases, FINDING-054 and FINDING-056 by live resource deletions, and FINDING-055 by zone settings (HSTS-comment wording remains companion app work). FINDING-009's one-off history/alias cleanup is complete; automated retention remains in R-CI. FINDING-050 remains open/blocked on GitHub feature eligibility. The other findings retain their audit status. Each primary ID appears in exactly one assignment table. Companion package/adoption sprints have no duplicate primary-ID rows.
Grades retain their source meaning: security severity/exposure, dead-code confidence/blast/semver, deep-dive severity and scheduling tier, or i18n priority. HIGH confidence in a removal is not a HIGH-severity bug.

This plan supersedes the scheduling in #333 and #334 while preserving their frozen catalogs. Their live-state checks are dated evidence and were not repeated here. The older `2026-10-04-deep-dive/OPT-003` is carried into the new optimization and is outside the 133-ID accounting.

## Approval, decisions and ordering

The maintainer already chose to remove moderator names, deprecate before the core 6 / bot-logic 5 major pair, drop the legacy parity `[host]` half and retain `[library]`. **Review first; nothing starts until a sprint is named.** This document does not authorize resource deletion, settings changes, upstream messages, publishing, deployment or a merge.

No P0/emergency sprint is needed. Named sprints are independently reviewable units, not permission to run the whole list. Prioritize the P1 displayed-text fixes and MEDIUM correctness bugs, then contained bugs, cleanup and hardening. Package prerequisites precede their consumers. Structural major removals are isolated after correctness and beta acceptance; terminal font work is last. A package publish, app deployment and external-settings verification are separate units. Nondependent ordinary app sprints may be reordered to deliver the higher-priority fix first.

Unresolved gates from #333 remain: per-record controls versus policy wording; CSP narrowing versus wording; tag/link moderation; failed-decode quota treatment; identity unlink/ban lookup behavior; signed-in browsing policy AMEND; button throttling versus a recorded trade-off; optional query signing. Resolve only the decisions needed for the named sprint. No default is chosen here.

All version numbers are targets inherited from the accepted major path, not fresh registry assertions. Before execution, compare local and registry versions: fold into an unpublished version where valid; otherwise additive/deprecation MINOR, compatible fix PATCH, published API removal MAJOR. Stage only owned paths; never stash or switch the shared checkout. **Merging to main is the deploy.** No bare wrangler deployment from this plan.

Each locale-owning release finalizes its text before checking/subsetting fonts. A missing drawable glyph blocks that release until its font update is ready; never ship a red glyph gate while waiting for the terminal phase. The final F-DISCORD/F-OG pass occurs only after the last rendered-text/item-name change.

## Sprint OPS-API-DEV — Cloudflare stale dev worker — ✅ COMPLETED 2026-10-26 (live action; no code commit)

The maintainer explicitly authorized deletion in chat. Rechecked all 16 workers' bindings, target domains/routes and the stale script before deleting it without force. Cloudflare confirmed deletion; the target is absent from inventory, its settings return 404 / 10007, and its public HEAD probe returns 404. [Execution evidence](../2026-10-26-security/evidence/remediation-finding-054-2026-10-26.md).

**Deploy needs:** none. No package publish, application deploy or KV namespace deletion. This documentation records the action and its verification evidence.

| ID | Source | Sev/Pri | Action |
|---|---|---|---|
| [2026-10-26-security/FINDING-054](../2026-10-26-security/findings/FINDING-054.md) | 2026-10-26-security | P2 · LOW / INTERNET-UNAUTH | Delete the worker `xivdyetools-api-worker-dev` (stale 2026-08-10 build, public on `workers.dev`), or redeploy it once so wrangler applies `workers_dev = false`; tick `OPEN_ITEMS.md:74-75` with the HEAD probe. |

**Ends with:** Explicit maintainer authorization at execution → narrowly scoped action/decision → read-only state verification recorded; no automatic action from this audit.

## Sprint OPS-ZONE — Cloudflare zone transport settings — ✅ COMPLETED 2026-10-26 (live action; no code commit)

The maintainer explicitly authorized Always Use HTTPS and minimum TLS 1.2 for `xivdyetools.app`. Rechecked the exact zone and old values, applied only those two settings, and confirmed both through fresh GETs. HTTP on all five main hosts redirects to HTTPS and finishes with 200; explicit negotiation at data.xivdyetools.app rejects TLS 1.0/1.1 and accepts 1.2. [Execution evidence](../2026-10-26-security/evidence/remediation-finding-055-2026-10-26.md).

**Deploy needs:** none for the live settings. This documentation records the action and its verification evidence. Reword the three worker HSTS comments in their owning app sprints; no app code changed here.

| ID | Source | Sev/Pri | Action |
|---|---|---|---|
| [2026-10-26-security/FINDING-055](../2026-10-26-security/findings/FINDING-055.md) | 2026-10-26-security | P3 · INFO / INTERNET-UNAUTH | Zone `xivdyetools.app` → SSL/TLS → Edge Certificates: **Always Use HTTPS** on, **Minimum TLS Version** 1.2. |

**Ends with:** Explicit maintainer authorization at execution → narrowly scoped action/decision → read-only state verification recorded; no automatic action from this audit.

## Sprint OPS-RETIRED — Retired Cloudflare resources — ✅ COMPLETED 2026-10-26 (live actions; no code commit)

The maintainer explicitly authorized deleting `xivdyetools-api-docs` and `xivdyetools-universalis-proxy`. Rechecked the exact resources, replacement domain ownership, all 15 workers' bindings and current docs/proxy content. Deleted the Pages project with its 22 deployments and the worker without force. Fresh inventories omit both and their API GETs return 404; replacement docs and both current proxy URLs still return expected content. [Execution evidence](../2026-10-26-security/evidence/remediation-finding-056-2026-10-26.md).

**Deploy needs:** none. Both DEPRECATIONS.md checklists and OPEN_ITEMS.md record the completed removals and verification evidence.

| ID | Source | Sev/Pri | Action |
|---|---|---|---|
| [2026-10-26-security/FINDING-056](../2026-10-26-security/findings/FINDING-056.md) | 2026-10-26-security | P3 · INFO / INTERNET-UNAUTH | Delete the retired Pages project `xivdyetools-api-docs` and the retired worker `xivdyetools-universalis-proxy`; tick `DEPRECATIONS.md:162,200` and `OPEN_ITEMS.md` §2. |

**Ends with:** Explicit maintainer authorization at execution → narrowly scoped action/decision → read-only state verification recorded; no automatic action from this audit.

## Sprint OPS-PAGES-HISTORY — Web Pages history and aliases — ✅ COMPLETED 2026-10-26 (live actions; no code commit)

The maintainer explicitly authorized deletion of all superseded deployments and the v4-ui-migration alias while preserving the current production and beta deployments. Saved the complete 522/240-record inventory, protected the two current IDs, and deleted 521/239 records in guarded batches. Fresh inventories show exactly one protected deployment per project; the retired alias/hash probes return 404, and all six live URL HTML hashes/CSPs are unchanged. An independent read-only verifier confirmed the inventory/guards and all 760 receipts plus preservation results. [Execution evidence](../2026-10-26-security/evidence/remediation-finding-009-2026-10-26.md).

**Deploy needs:** none for this cleanup. Automated retention and live-origin probe integration remain in R-CI, so FINDING-009 is PARTIAL. This documentation records the one-off cleanup and verification evidence.

| ID | Source | Sev/Pri | Action |
|---|---|---|---|
| [2026-10-26-security/FINDING-009](../2026-10-26-security/findings/FINDING-009.md) | 2026-10-26-security | P2 · LOW / INTERNET-UNAUTH | Bulk-delete the superseded Pages deployments (522 in `xivdyetools`, 240 in `xivdyetools-beta`, each at its own `<hash>.pages.dev` host; the `ecc7fb76` beta deployment serves no CSP, XFO or HSTS) and the `v4-ui-migration` alias, keeping the current production and beta deployments. Add a retention step to `deploy-web-app*.yml` in R-CI. |

**Ends with:** Explicit maintainer authorization at execution → narrowly scoped action/decision → read-only state verification recorded; no automatic action from this audit.

## Sprint OPS-REPO-SECRETS — GitHub repository secret scope — ✅ COMPLETED 2026-10-26 (live actions; no code commit)

The maintainer explicitly authorized deleting only the four repository-scope Discord secrets while keeping the environment copies. Verified current workflow environment references, both successful production command-registration steps and the environment copies before deletion. All four repository DELETEs returned 204. Fresh listings confirm the four repository copies are absent; both environment inventories and secret metadata are unchanged, and CLOUDFLARE_ACCOUNT_ID remains. [Execution evidence](../2026-10-26-security/evidence/remediation-finding-028-2026-10-26.md).

**Deploy needs:** none. No environment secret mutation, token rotation or workflow run was performed. Current and carried-forward finding status plus the operations tracker record the completed repository-scope cleanup.

| ID | Source | Sev/Pri | Action |
|---|---|---|---|
| [2026-10-26-security/FINDING-028](../2026-10-26-security/findings/FINDING-028.md) | 2026-10-26-security | P3 · LOW / LOCAL | `gh secret delete` the repository-scope `DISCORD_TOKEN`, `MODERATION_DISCORD_TOKEN`, `BETA_DISCORD_TOKEN`, `BETA_DISCORD_GUILD_ID` (the environment copies already exist and every consuming job declares `environment:`); check off FINDING-023 in `docs/operations/OPEN_ITEMS.md`. Optional token reset. |

**Ends with:** Explicit maintainer authorization at execution → narrowly scoped action/decision → read-only state verification recorded; no automatic action from this audit.

## Sprint OPS-SECRET-SCANNING — GitHub scanning settings — BLOCKED 2026-10-26 (feature eligibility)

The maintainer authorized enabling both options. Combined and isolated non-provider-pattern API requests returned success, but fresh GETs still show both disabled. The repository is user-owned, admin permission is present, and its settings UI exposes neither control. Current GitHub documentation lists these options for eligible organization-owned repositories with Secret Protection. [Attempt and eligibility evidence](../2026-10-26-security/evidence/remediation-finding-050-2026-10-26.md).

**Remaining:** eligibility must change or GitHub must clarify availability before these controls can be enabled. No ownership transfer, paid-plan change, substitute implementation or accepted deferral was performed. Existing scanning and push protection remain enabled; FINDING-050 stays OPEN and the status-basis counts are unchanged. The CI-comment correction remains companion work in R-CI.

| ID | Source | Sev/Pri | Action |
|---|---|---|---|
| [2026-10-26-security/FINDING-050](../2026-10-26-security/findings/FINDING-050.md) | 2026-10-26-security | P3 · INFO / LOCAL | Enable secret-scanning non-provider patterns and validity checks, or record the choice. |

**Ends with:** Explicit maintainer authorization at execution → narrowly scoped action/decision → read-only state verification recorded; no automatic action from this audit.

## Sprint OPS-BRANCH-PROTECTION — GitHub branch protection — ✅ COMPLETED 2026-10-26 (live actions; no code commit)

The maintainer explicitly authorized `enforce_admins` and `strict` on main. Saved the full protection configuration, used the dedicated admin-enforcement POST and required-status-check PATCH (`strict: true` only), then read back the full configuration. Both settings are true. A semantic before/after comparison confirms that no other field changed, including all four required checks and their app bindings. [Execution evidence](../2026-10-26-security/evidence/remediation-finding-051-2026-10-26.md).

**Deploy needs:** none. The old FINDING-024 deferral is closed. Linear history remains a separate open operations item; this documentation records the two authorized settings changes.

| ID | Source | Sev/Pri | Action |
|---|---|---|---|
| [2026-10-26-security/FINDING-051](../2026-10-26-security/findings/FINDING-051.md) | 2026-10-26-security | P3 · INFO / LOCAL | Turn on `enforce_admins` and `strict` on `main` now that the 2026-10-03 remediation PRs merged, or record the deferral. |

**Ends with:** Explicit maintainer authorization at execution → narrowly scoped action/decision → read-only state verification recorded; no automatic action from this audit.

## Sprint OPS-XIVCHARAKIT-PROVENANCE — XIVCharaKit release provenance — ✅ COMPLETED 2026-10-27 (remote tags; no code commit)

The maintainer authorized tagging published releases. Created annotated chara-v0.1.0-beta.1 through .4 tags at commits verified from the byte-identical retained beta.1 candidate and beta.2–.4 npm provenance. An independent read-only verifier confirmed all mappings and the exclusion of npm's code-free 0.0.0-stage placeholder. Fresh GitHub reads, peeled Git refs and tagged package metadata agree. npm artifacts/dist-tags and the main branch are unchanged. [Execution evidence](../2026-10-26-security/evidence/remediation-finding-052-2026-10-27.md).

**Deploy needs:** none. The published library releases now have source tags. Future publishes need the same tag discipline; publish-workflow automation is follow-up work. This documentation records the version/commit mappings and verification evidence.

| ID | Source | Sev/Pri | Action |
|---|---|---|---|
| [2026-10-26-security/FINDING-052](../2026-10-26-security/findings/FINDING-052.md) | 2026-10-26-security | P3 · INFO / LOCAL | Tag the `xivcharakit` releases in the XIVCharaKit repository (your own repo) so each npm version maps to a commit. |

**Ends with:** Explicit maintainer authorization at execution → narrowly scoped action/decision → read-only state verification recorded; no automatic action from this audit.

## Sprint DECISION-UPSTREAM-MERGE — Upstream identity-merge decision — REPORT SENT 2026-10-27; upstream triage pending

The maintainer authorized review, preparation and then sending of the private upstream report. Rechecked current upstream source, obtained an independent security review and sent the report to XIVAuth's published security address with the policy-requested PGP-encrypted attachment. A fresh Gmail sent-copy read confirms the recipient and byte-identical attachment. The report, source snapshots and receipt remain outside Git. Upstream acknowledgement and triage are pending. FINDING-008 remains OPEN; local OAuth mitigation in A-OAUTH remains a separate decision.

| ID | Source | Sev/Pri | Action |
|---|---|---|---|
| [2026-10-26-security/FINDING-008](../2026-10-26-security/findings/FINDING-008.md) | 2026-10-26-security | P3 · LOW / INTERNET-UNAUTH | Report upstream to XIVAuth (MFA or owner confirmation on the email auto-merge path); decide whether oauth narrows its side (A-OAUTH). |

**Ends with:** Explicit maintainer authorization at execution → narrowly scoped action/decision → read-only state verification recorded; no automatic action from this audit.

## Sprint A-WORKER-KIT — packages/worker-kit — IMPLEMENTED 2026-10-27; release pending

Prepare an additive MINOR; the 2026-10-27 registry check found local and npm latest both at 1.5.0, so the current target is 1.6.0. API, presets-api and oauth explicitly opt into IPv6 keying in their own app sprints.

**Readiness review 2026-10-27:** both findings are still present. Preserve default `getClientIp` output, header precedence and X-Forwarded-For opt-in. With the new /64 option enabled, normalize valid IPv6 to a canonical network key without a `/64` suffix. Treat IPv4-mapped IPv6 separately: dotted and hex forms should resolve to the embedded IPv4 address rather than sharing one zero-prefix /64 bucket. Preserve the existing trimmed/lowercase pass-through for malformed input. Pin these compatibility expectations, equivalent spellings, same/different prefixes, shared quota consumption and key-scope redaction in regression tests.

**Rollout decision approved 2026-10-27:** the maintainer selected the existing automatic-deployment behavior and validation of every affected app. All seven backend production workflows include `packages/worker-kit/**` in their push filters and bundle workspace dependencies, so merging this package change triggers their deployments independently of npm publication. Discord already calls the shared `getDiscordCommandLimit` lookup: the new `glamour: { maxRequests: 5, windowMs: 60_000 }` entry selects RL_5 on that deployment, covered by a native-binding integration regression. Discord's patch release is 5.9.1; no workflow gating change is planned. FINDING-004 remains open until consumer opt-ins are deployed; FINDING-017 closes only after the effective Discord limit is verified. This rollout choice does not itself merge, publish or manually deploy the changes.

Source references: [Discord deployment workflow](../../../.github/workflows/deploy-discord-worker.yml#L21), [existing shared-limit lookup](../../../apps/discord-worker/src/services/rate-limiter.ts#L242), and [RL_5 production binding](../../../apps/discord-worker/wrangler.toml#L172).

**Execution update:** worker-kit 1.6.0 and Discord 5.9.1 are prepared. Red-first and mutation
regressions pass on the restored implementation; the whole graph passed 62/62 tasks and
16,310 test summaries (36 tasks cached). All seven backend bundles passed their dry-run/size
checks, with independent task and final security reviews. [Implementation evidence](../2026-10-26-security/evidence/remediation-worker-kit-2026-10-27.md).
The feature-branch push also completed the existing beta Discord deployment/registration
and beta OpenGraph deployment/health/card-URL smoke workflows; production remains pending.

**Deploy needs:** separately authorized merge and seven automatic backend deployments;
Actions publication of worker-kit 1.6.0; effective deployed Discord limit verification.
Explicit IPv6 opt-ins remain in A-API, A-PRESETS and A-OAUTH. Neither finding is closed by
this unmerged implementation, so the status-basis counts remain unchanged.

| ID | Source | Sev/Pri | Action |
|---|---|---|---|
| [2026-10-26-security/FINDING-004](../2026-10-26-security/findings/FINDING-004.md) | 2026-10-26-security | LOW / INTERNET-UNAUTH · P2 | `getClientIp` (opt-in option): collapse IPv6 to its /64 (expand `::`, keep four hextets), leave IPv4 alone; test that two addresses in one /64 share a key. |
| [2026-10-26-security/FINDING-017](../2026-10-26-security/findings/FINDING-017.md) | 2026-10-26-security | LOW / INTERNET-AUTH · P2 | Add `glamour: { maxRequests: 5, windowMs: 60_000 }` to `DISCORD_COMMAND_LIMITS` without burst; verify the existing Discord lookup selects RL_5 under the chosen rollout. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...@xivdyetools/worker-kit` and whole-graph gates before merge → version/CHANGELOG decision → separately authorized merge (triggers all seven backend deployment workflows) → Actions **Publish Packages to npm** for `@xivdyetools/worker-kit`; verify registry availability and actual consumer deployment/adoption separately.

## Sprint A-CORE — packages/core

Publish the deprecation MINOR before any removal. Also harden the quadratic GPOSERS sink as a companion to the upstream-name finding assigned to A-API. Preserve exported names when relocating live limits/types; add the legacy API deprecation record.

**Execution status (2026-10-27): [draft PR #338](https://github.com/FlashGalatine/xivdyetools/pull/338) open; implementation and automatic betas verified; production release pending.**
Fresh npm checks returned core 5.15.0 and bot-logic 4.11.0. This sprint prepares core
**5.16.0 MINOR**, web **5.16.1 PATCH** and Discord **5.9.2 PATCH**. The nine live contracts
and the 8,192-byte cap retain their exported names; six legacy symbols are deprecated,
with implementations and parity tests retained until the separately gated core 6 release.
BUG-003 keeps the existing 256 UTF-16-unit cap without splitting surrogate pairs. Web filename
truncation stays in A-WEB. FINDING-002's core GPOSERS companion preserves text output while
making newline joining linear; API body/name bounds and SVG fitting remain in A-API/A-SVG.
[Implementation evidence](../2026-10-26-xivcharakit-dead-code/evidence/remediation-core-2026-10-27.md).
All 62 graph tasks, the five affected app bundle gates and independent task/final reviews pass.
Public export/declaration contracts are preserved; the package smoke check passes. Source
commit `33c5abc7` deployed through the unchanged web, Discord and OpenGraph beta workflows,
including actual deploy and smoke/registration steps. Source PR CI passed, including Playwright.
The receipt-only documentation follow-up changes neither package nor app source. Merge, registry
publication and production acceptance remain pending.

**Actual rollout:** existing `workspace:*` consumers bundle the changed source. A core-path
merge triggers production web, Discord, API, OpenGraph and moderation workflows independently
of npm publication. Feature-branch pushes can replace the shared web, Discord and OpenGraph
betas; retain those workflows and validate the affected apps, as selected for the first sprint.
Verify core publication before the later SVG/bot-logic releases. API/OpenGraph/moderation need
bundle validation here, but no version bump for these unchanged execution paths. No merge,
package publication or manual production deployment is authorized by this execution record.

| ID | Source | Sev/Pri | Action |
|---|---|---|---|
| [2026-10-26-xivcharakit-dead-code/DEAD-002](../2026-10-26-xivcharakit-dead-code/findings/DEAD-002.md) | 2026-10-26-xivcharakit-dead-code | HIGH / NONE · NONE · REMOVE | Fix the stale comments, docs and READMEs (shader-table reader claims, "lands in the stacked change", `@entrypoint` docblocks on `chara.ts` and `copy-chara-notices.mjs`, core CLAUDE.md / services.md / overview.md, the npm README and NOTICE credit for xivcharakit). |
| [2026-10-26-xivcharakit-dead-code/DEAD-003](../2026-10-26-xivcharakit-dead-code/findings/DEAD-003.md) | 2026-10-26-xivcharakit-dead-code | HIGH / NONE · NONE · REMOVE | Remove the seven stale `/** @public */` tags on chara-facade barrel exports that now have in-repo consumers. |
| [2026-10-26-xivcharakit-dead-code/DEAD-020](../2026-10-26-xivcharakit-dead-code/findings/DEAD-020.md) | 2026-10-26-xivcharakit-dead-code | HIGH / LOW · NONE · REFACTOR FIRST | Move `MAX_CHARA_FILE_BYTES` into `chara-library.ts` (or a tiny `chara-limits.ts`); keep the barrel export unchanged and rewrite the stale doc. |
| [2026-10-26-xivcharakit-dead-code/DEAD-021](../2026-10-26-xivcharakit-dead-code/findings/DEAD-021.md) | 2026-10-26-xivcharakit-dead-code | HIGH / MEDIUM · NONE · REFACTOR FIRST | Relocate the live slot, result and `StainIdLookup` types out of `chara-parser.ts` / `chara-resolver.ts`; type `race` as `Race \| null`; same exported names. In the same release add `@deprecated` to the legacy pair and its legacy-only types plus a `DEPRECATIONS.md` entry targeting 6.0.0 (phase 1 of [2026-10-26-xivcharakit-dead-code/DEAD-024](../2026-10-26-xivcharakit-dead-code/findings/DEAD-024.md)). |
| [2026-10-26-deep-dive/BUG-003](../2026-10-26-deep-dive/findings/BUG-003.md) | 2026-10-26-deep-dive | LOW / P2 | Truncate on code-point boundaries while preserving a documented code-unit cap; coordinate with web file-name truncation. Publish core before consumers. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...@xivdyetools/core`, whole-graph and affected-app bundle gates → feature PR and actual automatic-beta receipts → separately authorized merge (deploys the five apps above) → Actions **Publish Packages to npm** for core 5.16.0 and registry verification → recorded production acceptance. Keep legacy removal and remaining FINDING-002 work open.

## Sprint A-SVG — packages/svg

After A-CORE: harden quadratic fitText and adopt the new core release. This is a separate SVG publish; A-BOT-LOGIC and direct consumers follow it.

Companion task only; its primary finding is assigned to A-API.

**Execution status (2026-10-27): [draft PR #339](https://github.com/FlashGalatine/xivdyetools/pull/339) open on #338; implementation/local gates and automatic betas verified; production release pending.**
Fresh npm checks returned SVG 4.4.0, core 5.15.0 and bot-logic 4.11.0. Prepare SVG
**4.4.1 PATCH**, Discord **5.9.3 PATCH** and OpenGraph **2.12.1 PATCH**. Discord 5.9.2
identifies the earlier core deployment; the sequential release needs its own patch identity.
Keep all public API and card output, width classification, Unicode boundaries, trimming and
numeric edge behavior. Replace repeated prefix joins/measurements with a linear scan using
the existing width helper. [Evidence](../2026-10-26-security/evidence/remediation-svg-2026-10-27.md).
All 62 graph tasks, 167 script tests, five affected app bundle checks and independent code
reviews pass. Source, packed-package and declaration parity checks preserve the public API.
Source `ac8c9892` passed all three automatic beta deployment/smoke/registration workflows.
Source PR CI passed, including Playwright. The receipt-only documentation follow-up changes
no package/app source. Merge, npm publication and production acceptance remain pending.

**Actual rollout:** SVG paths trigger production web, Discord, API, OpenGraph and moderation
workflows; feature pushes can update their existing three shared web/Discord/OpenGraph betas.
Discord and OpenGraph execute the changed fitter and receive technical patch notes. Web/API
consume glyphs and moderation consumes bot helpers, so filter matches alone do not justify
their version bumps. Parked Stoat invokes a card generator before discarding its SVG; it has
no automatic deploy here. Keep player-facing changelogs unchanged for this security-only fix.

**Release ordering:** prepare stacked source now. A-CORE's merge deploys Discord 5.9.2;
publish and verify core 5.16.0 before releasing SVG 4.4.1, whose packed `workspace:*` dependency
resolves to that version. A-SVG's later merge deploys Discord 5.9.3/OpenGraph 2.12.1 from local
workspace code independently of npm. No merge, package publication or manual deploy is
authorized by this execution record. API body/name bounds remain outstanding in FINDING-002.

**Ends with:** SVG/dependents gate, whole-graph/root checks, all five affected app bundles and
package/API parity checks → draft feature PR and automatic-beta receipts → separately authorized
merge after the core release prerequisite → Actions **Publish Packages to npm** for SVG 4.4.1
and registry verification → later bot-logic/adoption sprint. Keep FINDING-002 open.

## Sprint A-BOT-LOGIC — packages/bot-logic

After A-CORE and A-SVG. Publish one 4.x deprecation MINOR with correctness/sanitizer fixes, the legacy-oracle rewrite, and new six-language order/sort keys for A-DISCORD. Reuse existing slot labels. Deprecate the approved redundant result field without removing it yet.

**Execution status (2026-10-27):** source preparation targets bot-logic 4.12.0, Discord
5.9.4, moderation 1.8.3 and parked Stoat 0.3.4, stacked on A-SVG PR #339. The ten
primary fixes and DEAD-023's deprecation phase preserve the published result shape and
exports; major removal remains pending. I18N-001 prepares five labels in all six locales
under `commands.swatch.choices.order.*` and `commands.preset.choices.sort.*`, outside the
regenerated option-description subtree. A-DISCORD must consume explicit literal full keys,
reuse the seven existing slot labels and remove the exact five-key preparatory orphan
exception when those references land. No choice registration changes here.
[Implementation evidence](../2026-10-26-security/evidence/remediation-bot-logic-2026-10-27.md).

All 62 graph tasks, root checks and affected bundle checks pass. Independent task and
security/API/semver reviews approve preparation. Source commit `0e7d91d5` passes
[CI including Playwright](https://github.com/FlashGalatine/xivdyetools/actions/runs/40519914300)
and [actual Discord beta deployment/18-command registration](https://github.com/FlashGalatine/xivdyetools/actions/runs/40519834648).
[Draft PR #340](https://github.com/FlashGalatine/xivdyetools/pull/340) is stacked on #339;
the receipt-only follow-up changes no runtime source. Registry publication and production
acceptance remain pending.

**Rollout:** verify published core 5.16.0 → SVG 4.4.1 → bot-logic 4.12.0. Workspace apps
bundle local source; bot-logic-path merges deploy production Discord and moderation,
while feature pushes update only the existing Discord beta. Discord 5.9.4 follows the
separate SVG/5.9.3 release. Stoat stays parked. Merge, npm publication and production
acceptance remain pending; source preparation does not increase the fixed-ID count.

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

**Execution status (2026-10-27):** source preparation targets API worker 0.21.1 PATCH,
stacked on A-BOT-LOGIC PR #340. The seven primary IDs prepare bounded upstream bodies,
one runtime/build name cleaner, dedicated Chara upstream-operation budgets, current icon
version validation, numeric-only telemetry versions, immutable future-builder provenance
and adjacent API cleanup. Existing client-IP extraction opts into worker-kit 1.6.0's IPv6
`/64` keying. General admission remains; dedicated budget counts actual owned data fetches,
with existing coalesced waiters free and runtime backend errors fail-open as soft limits.
[Implementation evidence](../2026-10-26-security/evidence/remediation-api-2026-10-27.md).

FINDING-029 remains OPEN: historical tables/metadata and font subsets are unchanged;
authenticating their provenance requires a controlled refresh. DEAD-004's web-app comment
cascade remains in A-WEB. Source preparation does not increase fixed-ID counts. All 62 graph
tasks, root checks, 990 API tests with enforced coverage, 2/2 hermetic runtime cases and the
production dry run pass; independent group and whole-branch reviews approve preparation.
Source commit `0398a058` passes [CI including 167 Playwright tests](https://github.com/FlashGalatine/xivdyetools/actions/runs/40539274766).
[Draft PR #341](https://github.com/FlashGalatine/xivdyetools/pull/341) is stacked on #340;
the receipt-only follow-up changes no runtime source. The actual source workflow inventory
contains CI only. No existing API beta is selected or new workflow added;
the deleted API dev worker remains retired. Merge and production acceptance remain pending.

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

**Execution update 2026-10-27 — source prepared, release pending.** Stacked on A-API PR #341
at `239cac2b`; [draft PR #342](https://github.com/FlashGalatine/xivdyetools/pull/342), source
`fa018bfa`. [Implementation and verification evidence](../2026-10-26-security/evidence/remediation-presets-2026-10-27.md).
The maintainer chose tag/decoded-link-path moderation with narrow six-language privacy alignment,
and charging failed decode/processing attempts while refunding cheap/proven storage failures.
Unknown DB outcomes conservatively retain their slot. Prepare presets-api 2.7.0 MINOR and web 5.16.2,
Discord 5.9.5, moderation 1.8.4 PATCH companions. Minimum path-review consumers are included here;
favorite-list adoption and the other A-DISCORD/A-MODERATION findings remain in their own sprints.

FINDING-016 is implemented **inactive**: both API environment flags remain explicitly false.
Verify both consumer production deployments, then prepare a later activation-only API PR.
Explicitly recorded Revert targets stay validated/restorable after disabling the flag; only missing legacy
targets depend on activation. No shared package, identity-provider, dependency, schema or workflow
change is selected. All nine primary IDs remain OPEN; fixed/outstanding counts are unchanged.
The feature diff selects existing web/Discord betas; presets/moderation have no dedicated beta
workflow. No manual deploy, main merge, live migration or package publication runs in this slice.

**Verified source receipts:** [CI](https://github.com/FlashGalatine/xivdyetools/actions/runs/40565487013)
passes the affected gates and all 167 Playwright tests; the local full graph passes 16,879 tests
across 17 workspaces. [Web beta](https://github.com/FlashGalatine/xivdyetools/actions/runs/40565416619)
passes its deployment/content/robots/header smoke checks;
[Discord beta](https://github.com/FlashGalatine/xivdyetools/actions/runs/40565416626) deploys and
registers all 18 test-guild commands. These are source-head beta receipts, not the production
receipts needed to activate FINDING-016. The documentation follow-up changes evidence/plan only.

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

**Ends with:** scoped and whole-graph gates, dry runs, draft stacked PR and actual CI/web+Discord beta receipts. A separately authorized main merge runs the four app production workflows; verify both review consumers before a later metadata-activation PR. No preset/moderation beta or manual deploy is selected.

## Sprint A-OAUTH — apps/oauth

**Preparation decision 2026-10-27:** the maintainer selected OAuth as the private canonical provider, explicit private confirmation of stored IDs before ban expansion, and existing-ban continuity across unlinking. OAuth 3.2.0 prepares the provider, revision fencing and durable transition protocol; both `IDENTITY_SPLIT_ENABLED` flags remain false and no outbound continuity binding is declared. Detected existing relationship changes fail closed while inactive. The aggregate-only production recheck found 19 users / 4 linked rows, with zero writes and no identifiers selected. Existing finding bodies/counts remain historical; all three IDs stay OPEN pending release, with FINDING-023 additionally awaiting consumers and activation. [Preparation and verification evidence](../2026-10-26-security/evidence/remediation-oauth-2026-10-27.md).

Required presets continuity/membership/session support is prepared with the following A-MODERATION consumer work. Its actual ban transaction and moderator confirmation are not claimed by the provider's local RPC stubs. Apply additive migrations before dependent deployments, verify provider before consumer bindings, then verify all consumers/disclosures before a separate OAuth activation-only change. No main merge, deployment, publication or live migration is selected here. The reviewed ten-file moderation name-removal patch remains on its isolated branch for continuation.

Draft [PR #343](https://github.com/FlashGalatine/xivdyetools/pull/343) prepares the provider. Local final graph: 25 tasks / 17,047 tests pass. Initial CI caught an ignored-directory assumption in the disk-restart test; its self-contained temporary-directory correction preserves all recovery assertions and passes the full 552-test OAuth unit, configured coverage, types and lint. [Updated verification evidence](../2026-10-26-security/evidence/remediation-oauth-2026-10-27.md) retains the failed run and subsequent receipts.

Source `80026b53`: [CI](https://github.com/FlashGalatine/xivdyetools/actions/runs/40589390369) passes all four jobs, including **167/167 Chromium Playwright tests**. Provider preparation is ready for the following consumer work; release/production acceptance remains pending, including the mandatory bounded-RPC/cleanup gate before adding an outbound continuity binding. No merge or production action is selected.

After A-WORKER-KIT. Resolve the identity-link product decision first. If oauth is chosen as the linked-identity provider, ship that support before A-MODERATION.

| ID | Source | Sev/Pri | Action |
|---|---|---|---|
| [2026-10-26-security/FINDING-023](../2026-10-26-security/findings/FINDING-023.md) | 2026-10-26-security | LOW / INTERNET-AUTH · P2 | On XIVAuth sign-in, when the row's `discord_id` is set but upstream no longer asserts it, detach the XIVAuth link onto a fresh row instead of minting the stale id; keep the Discord-sign-in lookup. Check production D1 first (operations gates). (existing decision gate) |
| [2026-10-26-security/FINDING-032](../2026-10-26-security/findings/FINDING-032.md) | 2026-10-26-security | LOW / LOCAL · P3 | `[env.development]`: add `routes = []` and `workers_dev = false` (or an explicit dev route); extend `wrangler-config.test.ts`. |
| [2026-10-26-security/FINDING-036](../2026-10-26-security/findings/FINDING-036.md) | 2026-10-26-security | INFO / INTERNET-UNAUTH · P3 | Domain-separate the state HMAC from the JWT signing key (prefix or derived subkey) with a migration window for in-flight states. |

**Ends with:** scoped/full local gates, real SQLite and local RPC proof, dry run, reviewed draft stacked PR and actual CI receipts. A separately authorized main merge runs `deploy-oauth.yml` against production only after its additive migration. Consumer production verification and a separate activation change follow; no OAuth beta or manual deploy is selected.

## Sprint A-MODERATION — apps/moderation-worker

**Preparation 2026-10-27:** all three maintainer choices are resolved: OAuth canonical private lookup, exact stored-ID review before scope expansion, and particular-ban continuity after unlinking. Provider preparation is in draft PR #343 with passing source CI. This sprint preserves moderation's reviewed name-removal patch and adds the required presets receipt/membership/session companion, private one-use confirmations, explicit expansion of partial bans and recorded-scope unban. All affected web/bot privacy variants are synchronized; the new uses remain inactive. [Implementation and verification evidence](../2026-10-26-security/evidence/remediation-moderation-2026-10-27.md).

Prepared versions are presets 2.8.0 and moderation 1.9.0 MINOR, Discord 5.9.6 and web 5.16.3 PATCH. Both consumer flags remain false in both environments, including all new ban/unban controls. Apply additive presets migration before either dependent deployment, verify provider and disclosures, then enable consumers in a separate verified change. OAuth splitting/outbound binding remains a later activation with its mandatory bounded-RPC/global-cleanup correction. No name-derived association, implicit parent-ban merge, ownership grant, main merge, live migration, manual deployment or publication is selected. FINDING-001 still needs A-DISCORD's preview-image companion; both primary IDs and FINDING-023 remain OPEN.

Final local preparation: **45/45 build/type/lint tasks**, **25/25 test tasks**, **17,231 tests across 600 files**. Presets 1,394 and moderation 846 pass configured coverage; script/docs/logging/policy/budget/integration/dry-run gates pass. Independent ordinary/scoped and final critical reviews pass, including per-identity audit, full recorded-scope unban comparison and informational preview corrections. Source publication and actual CI/beta receipts follow in the evidence.

Published draft [PR #344](https://github.com/FlashGalatine/xivdyetools/pull/344), stacked on #343. Source `71bd291f` passes [CI](https://github.com/FlashGalatine/xivdyetools/actions/runs/40597497058), including **167/167 Playwright tests**; [web beta](https://github.com/FlashGalatine/xivdyetools/actions/runs/40597456102) verifies matching live content/noindex/headers, and [Discord beta](https://github.com/FlashGalatine/xivdyetools/actions/runs/40597456111) deploys and registers **18 commands**. The receipt-only update changes evidence/plan, with no runtime change. No main merge or production activation is selected; all three findings retain their pending release/companion/activation gates.

After A-PRESETS, A-BOT-LOGIC and the selected identity provider. Preserve the accepted decision to remove moderator names, with no policy AMEND for those removed names.

| ID | Source | Sev/Pri | Action |
|---|---|---|---|
| [2026-10-26-security/FINDING-001](../2026-10-26-security/findings/FINDING-001.md) | 2026-10-26-security | MEDIUM / INTERNET-AUTH · P2 | *(decided 2026-10-26)* Attribute decisions through `moderation_log` and drop the moderator username from the moderation-channel and submission-log posts, the ban post and discord-worker's preview-image post (the discord-worker file changes in A-DISCORD); update the `previewImage.approvedFooter` / `rejectedFooter` keys and tests; no policy edit. |
| [2026-10-26-security/FINDING-025](../2026-10-26-security/findings/FINDING-025.md) | 2026-10-26-security | LOW / INTERNET-AUTH · P2 | Ask presets-api or oauth for the author's linked identities and hide and match both on ban; or show the moderator every id sharing the author name. (existing decision gate) |

**Ends with:** scoped/full local gates, configured coverage, real SQLite/Workerd proof, production-config dry runs, reviewed draft stacked PR and actual CI/web+Discord beta receipts. A separately authorized production release needs migration/provider/disclosure ordering; consumer activation and later OAuth activation remain separate. No presets/moderation beta or manual deployment is selected.

## Sprint A-DISCORD — apps/discord-worker

**Preparation update 2026-10-27:** Discord **5.9.7 PATCH** and the additive exports/locale
companion in unpublished bot-logic **4.12.0 MINOR** pass local verification: **45/45 static tasks**,
**25/25 test tasks, 17,340 tests / 602 files**, configured coverage and independent ordinary/
escalated reviews. The private notification
boundary requires a separate presets **2.8.1 PATCH** configuration companion, after the Discord
provider; independent deploy jobs must not race. `PRESET_WEBHOOK_BINDING_ONLY=false` in both
provider configurations retains public compatibility until actual named delivery is verified
and a later cutover is separately authorized. FINDING-039 remains OPEN through that cutover;
all findings retain production release acceptance gates. [Execution evidence](../2026-10-26-security/evidence/remediation-discord-2026-10-27.md).

The manual publish workflow and automatic consumer deploys do not enforce the required ordering.
Before a production merge, separately authorize and verify publication from the reviewed ref
where eligible, or hold all affected automatic deployments before merge/publish/verification and
release that hold afterward. Never publish an incomplete 4.12.0 snapshot and reuse its version.
No publication, workflow hold or production deployment is selected by this preparation.

The separate presets **2.8.1** binding companion integrates provider `9e6ae7cd` ([draft #345](https://github.com/FlashGalatine/xivdyetools/pull/345))
before its own publication. Post-merge gates pass: **1,396 presets tests**, **7 actual Workerd
tests**, scoped static checks, dry run, docs and reachability. [Companion evidence](../2026-10-26-security/evidence/remediation-discord-binding-2026-10-27.md).

After A-WORKER-KIT/A-BOT-LOGIC and the capped batch endpoint. Also remove moderator names from preview posts, apply the bot half of snapshot-policy correction, fix paired attachment comments, and correct beta-secret comments. Measure favorite requests at 1/10/50 entries: up to 49 fewer request/query round trips, not rows read. Command localization registration ships through the workflow.

| ID | Source | Sev/Pri | Action |
|---|---|---|---|
| [2026-10-26-security/FINDING-022](../2026-10-26-security/findings/FINDING-022.md) | 2026-10-26-security | LOW / INTERNET-AUTH · P2 | CORRECT `PRIVACY_POLICY.md` §3 Character Files item 2: the card also shows clan, gender and the producing tool. Six files; same commit as the policy half of [2026-10-26-security/FINDING-027](../2026-10-26-security/findings/FINDING-027.md). |
| [2026-10-26-security/FINDING-024](../2026-10-26-security/findings/FINDING-024.md) | 2026-10-26-security | LOW / INTERNET-AUTH · P2 | After A-PRESETS deploys its capped approved-only batch lookup, switch favorite listing to that endpoint; preserve favorite order, distinguish missing from failed results, and pass acting-user rate-limit context. Assert one binding request for a 50-entry list and handle delivery/partial failures. This one implementation also satisfies the deduplicated optimization. |
| [2026-10-26-security/FINDING-039](../2026-10-26-security/findings/FINDING-039.md) | 2026-10-26-security | INFO / INTERNET-UNAUTH · P3 | Prepare private `PresetNotifications` Fetch entrypoint and default-false public cutover gate. Deploy/verify provider, then separate presets binding companion, then authorize activation; public requests are rejected before bearer comparison/body reads when active. |
| [2026-10-26-security/FINDING-040](../2026-10-26-security/findings/FINDING-040.md) | 2026-10-26-security | INFO / INTERNET-AUTH · P3 | Add the cheap per-user `button` tier before `trackButtonClick`, using the existing native binding; preserve backend failure reporting and private rejection. |
| [2026-10-26-xivcharakit-dead-code/DEAD-014](../2026-10-26-xivcharakit-dead-code/findings/DEAD-014.md) | 2026-10-26-xivcharakit-dead-code | HIGH / LOW · NONE · REMOVE | Drop `downloadCharaAttachment`'s text-only shape and the adapters' `fileText` pass-through; the adapters assert `fileBytes`. |
| [2026-10-26-deep-dive/BUG-009](../2026-10-26-deep-dive/findings/BUG-009.md) | 2026-10-26-deep-dive | LOW / P2 | Paginate or budget complete lines within 4096 including escaped names and truncation notice; check edit success. |
| [2026-10-26-deep-dive/BUG-010](../2026-10-26-deep-dive/findings/BUG-010.md) | 2026-10-26-deep-dive | LOW / P2 | Preserve found/missing/failed outcomes; show and trace upstream failures; identify partial results. |
| [2026-10-26-deep-dive/BUG-011](../2026-10-26-deep-dive/findings/BUG-011.md) | 2026-10-26-deep-dive | LOW / P2 | Check safeEdit boolean and mark delivery failure; select bounded retry or short fallback. Consider a shared delivery helper to prevent repetition across adapters. |
| [2026-10-26-i18n/HC-002](findings/HC-002.md) | 2026-10-26-i18n | P1 | Carry locale into autocomplete, match/display official localized race/clan names while preserving existing canonical stored values, and render localized names alongside canonical tokens in validation. Keep this optional preference's dormant consumer status explicit. |
| [2026-10-26-i18n/I18N-001](findings/I18N-001.md) | 2026-10-26-i18n | P2 | Reuse card.swatchSlotName.* for slot display names while preserving emoji and canonical values. Author six-language row-order and sort display keys, then cover these three choice families in localize.test.ts. Deliberately English method tags, endonyms and preset categories are outside this finding. |

**Ends with:** scoped/full local gates, actual configured Workerd boundary proof, coverage, font/bundle/dry-run/secret checks, independent ordinary/escalated reviews, and separate stacked provider/configuration draft PRs with actual CI/beta receipts. Production release remains separately authorized: publish prerequisite packages, deploy the capped batch provider, deploy Discord with compatibility retained, deploy/verify the presets binding companion, then separately activate binding-only mode. No manual deployment, registration or activation is selected.

Published drafts: [provider #345](https://github.com/FlashGalatine/xivdyetools/pull/345) source `9e6ae7cd`
and [binding companion #346](https://github.com/FlashGalatine/xivdyetools/pull/346) source `ae26ddc3`.
Their [provider CI](https://github.com/FlashGalatine/xivdyetools/actions/runs/40623733378) and
[companion CI](https://github.com/FlashGalatine/xivdyetools/actions/runs/40624786941) pass all four jobs
with **167 Playwright tests each**. Both automatically selected Discord betas deploy and register
**18 commands**. No web beta is selected. Receipt-only updates preserve runtime source and false
flags; production publication orchestration, provider/consumer verification and cutover remain.

## Sprint A-WEB — apps/web-app

**Security-only preparation — COMPLETE 2026-10-28 (`a6e1e3c`, [draft #347](https://github.com/FlashGalatine/xivdyetools/pull/347)):** all 14 selected security rows are implemented in web **5.16.4 PATCH**, including the three approved choices. Independent reviews, **4,483 web tests**, affected CI, **167 Playwright tests** and automatic web beta pass. Nonsecurity A-WEB rows were deferred at this security-only stage. [A-WEB evidence](../2026-10-26-security/evidence/remediation-web-security-2026-10-28.md). The [Windows loader correction](../2026-10-26-security/evidence/remediation-windows-loader-2026-10-28.md) now passes fresh full-repository testing: **17,410 tests /603 files /17 workspaces**, plus **45/45 build/type/lint tasks**. Prerequisite publication and production acceptance remain release gates; no production release is selected.

**Remaining scope reopened and prepared — 2026-10-28:** all 23 deferred table rows, the BUG-003 filename companion and DEAD-004's comment cascade are implemented in pending web **5.16.4 PATCH**, extending draft #347. Independent task and final Astra reviews pass. Fresh full-repository verification passes **17,469 tests /604 files /17 workspaces**, **25/25 test tasks with no cache**, and **45/45 build/type/lint tasks**. Web coverage is **88.53/79.15/86.31/89.94**; bundle and i18n gates pass. Canonical font regeneration preserves all 20 cmaps/non-head tables; six timestamp-only outputs restore exact original bytes and **38** font tests pass. DEAD-013 removes two inert rules and retains the dormant 30 KB generic vendor guard as an explicit KEEP adjustment. [Combined implementation, proof and release gates](../2026-10-26-deep-dive/evidence/remediation-web-2026-10-28.md). Two real Chromium keyboard cases and all six root checks also pass locally; updated-source remote receipts follow in that evidence. Production publication, deployment ordering and acceptance remain pending; A-OG-COPY then A-IMAGE follow this sprint.

After required package publishes. Also apply the code-point-safe file-name cap paired with core labels. Keep persisted settings, result rendering, async modal ownership and cache generations consistent. All policy edits are six-file owner changes, behind unresolved decisions where listed.

| ID | Source | Sev/Pri | Action |
|---|---|---|---|
| [2026-10-26-security/FINDING-003](../2026-10-26-security/findings/FINDING-003.md) | 2026-10-26-security | LOW / INTERNET-UNAUTH · P2 | **DECIDED 2026-10-28:** use the localized generic default for new Swatch character saves; preserve older names and numbering; CORRECT all six privacy variants to describe existing deletion controls. |
| [2026-10-26-security/FINDING-006](../2026-10-26-security/findings/FINDING-006.md) | 2026-10-26-security | LOW / INTERNET-UNAUTH · P2 | Reword `preset.gateBrowseNote` in all six `locales/*.json`; run `validate:i18n`. |
| [2026-10-26-security/FINDING-007](../2026-10-26-security/findings/FINDING-007.md) | 2026-10-26-security | LOW / INTERNET-UNAUTH · P2 | CORRECT the "saved palettes" term collision in `PRIVACY.fr.md` (and ja/ko where it collides): say saved community presets are not cleared by that control. |
| [2026-10-26-security/FINDING-010](../2026-10-26-security/findings/FINDING-010.md) | 2026-10-26-security | LOW / INTERNET-UNAUTH · P2 | CORRECT "a dozen small integers" (up to 27 plus 12 slot names). |
| [2026-10-26-security/FINDING-011](../2026-10-26-security/findings/FINDING-011.md) | 2026-10-26-security | LOW / INTERNET-UNAUTH · P2 | **DECIDED 2026-10-28:** narrow `connect-src` to self plus the three actual connection hosts (api/auth/data), preserving the separate image policy; pin the exact set in header tests. |
| [2026-10-26-security/FINDING-012](../2026-10-26-security/findings/FINDING-012.md) | 2026-10-26-security | LOW / INTERNET-UNAUTH · P2 | CORRECT Terms "Appeals and removal" step 3 so XIVAuth-only accounts can follow it. |
| [2026-10-26-security/FINDING-013](../2026-10-26-security/findings/FINDING-013.md) | 2026-10-26-security | LOW / INTERNET-UNAUTH · P2 | CORRECT Terms "Accounts": display name, with the username as the fallback. |
| [2026-10-26-security/FINDING-026](../2026-10-26-security/findings/FINDING-026.md) | 2026-10-26-security | LOW / INTERNET-AUTH · P2 | **AMEND APPROVED 2026-10-28:** signed-out browsing sends no account information; opening a preset while signed in sends the token for the existing vote check, which stores no view record. Update all six policies; retain timing and UI. |
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

**Execution update 2026-10-28:** source prepared in OpenGraph **2.12.2 PATCH**, with all six count corrections, the required Chinese glyph subset and a fresh Worker cache version beyond beta 2.12.1. [Evidence](evidence/remediation-og-copy-2026-10-28.md) records regression/reversal proof and the release gates. Production acceptance remains pending; A-IMAGE follows this sprint verification.

After relevant core/SVG publication. Correct the default Discord-frame subtitle in all six authored tables; X omits this subtitle. Bump the OG cache version and run glyph/fit gates.

| ID | Source | Sev/Pri | Action |
|---|---|---|---|
| [2026-10-26-i18n/I18N-002](findings/I18N-002.md) | 2026-10-26-i18n | P1 | Update the count in all six authored deck subtitles, or remove the brittle number, then perform the OG string/font gates and re-subset only if required by the changed glyphs. Bump the OG cache version so existing cached cards receive the corrected copy. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...xivdyetools-og-worker` and whole-graph gates before merge → merge → `deploy-og-worker.yml` (production); beta workflow only when explicitly selected.

## Sprint A-IMAGE — apps/image-worker

**Execution update 2026-10-28 — PARTIAL / source prepared, activation held:** image-worker **1.3.5 PATCH** rejects PNG16 before decode, bounds encoded/pixel/output allocation and releases consumed Photon images early. [Real workerd evidence](../2026-10-26-security/evidence/remediation-image-2026-10-28.md) records cold/control parity and a stable warm WASM plateau, but also a **142.330 MiB** allocated checkpoint. Aggregate headroom/platform acceptance remains unresolved; do not mark the finding fully fixed. A separate six-language bot-manual numeric companion must be published with complete bot-logic source and deployed before the lower cap. No production hold is assumed and no activation is selected.

One image-worker release; validate peak decode memory in the Worker runtime before treating the accounting change as complete.

| ID | Source | Sev/Pri | Action |
|---|---|---|---|
| [2026-10-26-security/FINDING-020](../2026-10-26-security/findings/FINDING-020.md) | 2026-10-26-security | LOW / INTERNET-AUTH · P2 | Read the PNG IHDR bit depth and colour type in `dimensions.ts`; refuse 16-bit input or charge it a 2× factor against the pixel budget; re-measure the peak (8-bit at the cap is already about 110 MiB) and confirm against workerd. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...xivdyetools-image-worker` and whole-graph gates before merge → merge → `deploy-image-worker.yml` (production); beta workflow only when explicitly selected.

## Sprint R-CI — repository tooling/workflows

One repository verification gate, not a package publish. Also add Pages deployment retention as the companion to the history cleanup, preserving current production/beta deployments.

The 2026-10-26 one-off cleanup completed OPS-PAGES-HISTORY. FINDING-009 remains PARTIAL until the retention step and branch-alias/hash-host live-origin checks are implemented and verified here.

| ID | Source | Sev/Pri | Action |
|---|---|---|---|
| [2026-10-26-security/FINDING-031](../2026-10-26-security/findings/FINDING-031.md) | 2026-10-26-security | LOW / LOCAL · P3 | Raise the override to `'vitepress>vite': '>=6.4.5 <7'`, `pnpm install`, confirm Dependabot alerts #13–#17 close; update the stale FINDING-036 comment. |
| [2026-10-26-security/FINDING-049](../2026-10-26-security/findings/FINDING-049.md) | 2026-10-26-security | INFO / LOCAL · P3 | `publish-packages.yml`: grant `id-token: write` only to the job (or step) that runs `pnpm publish`; build and test in a job without it. |

**Ends with:** `pnpm test:scripts`, `pnpm type-check:scripts`, `pnpm docs:check-links`, `pnpm docs:check-versions`, `pnpm workers:check-logs` as affected → repository verification gate; no unrelated application deploy.

## Sprint R-DOCS-DECISIONS — repository docs/process

One repository documentation/process gate. Carry dated live-state evidence as inherited, not freshly rechecked. On actual Perspective key deletion, schedule separate presets-api behavior verification and web/Discord six-file ToS updates; do not publish those claims early. If query signing is chosen, add the explicit auth/presets/Discord/moderation compatibility sequence below.

**Execution update 2026-10-27:** FINDING-035's checklist addition is complete in [DEPRECATIONS.md](../../../DEPRECATIONS.md). Both Terms of Service and the key-deletion-day requirements are recorded; actual policy documents and secrets are unchanged. The other tasks in this sprint remain open; this change is documentation only.

| ID | Source | Sev/Pri | Action |
|---|---|---|---|
| [2026-10-26-security/FINDING-030](../2026-10-26-security/findings/FINDING-030.md) | 2026-10-26-security | INFO / LOCAL · P3 | The live check found no signing secret on `-dev`. Correct `DEPLOY_ENVIRONMENTS.md:283-284` and `:324` and the discord-worker `wrangler.toml:92-96` comment to say `BOT_API_SECRET` / `BOT_SIGNING_SECRET` must NOT be set on `-dev`; reword the "writes a genuine row" residual-risk line. |
| [2026-10-26-security/FINDING-035](../2026-10-26-security/findings/FINDING-035.md) | 2026-10-26-security | P3 · INFO / INTERNET-UNAUTH | **FIXED 2026-10-27 (checklist only).** Both Terms-of-Service auto-publish sentences are in the `DEPRECATIONS.md` Perspective-sunset checklist. The six-file CORRECTs remain scheduled for key-deletion day, with the inherited before-2026-12-31 deadline. |
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
