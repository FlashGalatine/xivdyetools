# Conditional M release preparation — October 2026

**SOURCE AND DRAFT PR PREPARATION ONLY. Production activation remains on hold.**
The maintainer authorized preparing the M changes before the existing release prerequisites
have closed. No merge before **October 30, 2026, America/New_York**, and no merge on that date
without later explicit authorization and satisfied prerequisites. The date triggers no action.
Publication, deployment, workflow dispatch/approval, migrations and announcements remain held.

The base is `2b95c0df20b0585d405f2684b10b982d61a48bf6`, the [A/R/H overview PR #388](https://github.com/FlashGalatine/xivdyetools/pull/388).
Its source cuts and [release runbook](REMEDIATION_RELEASE_2026_10.md) remain the prerequisite
queue. These conditional M sources do not replace the earlier deprecation releases.

## Package and consumer boundaries

| Order | Sprint | Prepared target | Compatibility obligation |
|---|---|---|---|
| 1 | M-CORE | Core 6.0.0 | Remove only the approved legacy parser/resolver APIs and host parity half; preserve the live contracts and all 261 library cases |
| 2 | M-SVG | SVG 4.4.2 | Adopt Core 6 using retained APIs; public SVG contracts remain compatible |
| 3 | M-BOT-LOGIC | Bot Logic 5.0.0 | Remove the legacy character projection; successful results contain only `ok`, `svgString`, `embed` |
| 4 | M-API | API 0.21.3 (prepared as 0.21.2) | Keep the public v1 request/response contract and `familySize` |
| 5 | M-WEB | Web 5.17.1 in the order ruled on 2026-11-13 (prepared as 5.16.5; 5.16.12 if it merged on today's `main`) | Preserve inspection-worker protocol, eight slots, matching eligibility and bundle budget |
| 6 | M-OG | OG 2.12.3 | Preserve card output; the app version also advances cache identity |
| 7 | M-DISCORD | Discord 5.9.10 (prepared as 5.9.8) | Preserve original-byte attachment guards, cards, embeds and adapter behavior |
| 8 | M-MODERATION | Moderation 1.9.1 | Preserve shared sanitization, private replies and disabled confirmation paths |
| 9 | M-STOAT | Stoat 0.3.5 | Verify the parked adapter; no activation or deployment |

Version reservations were checked against public npm and all 56 open PR heads (504 manifests)
on October 29: no proposed target conflict or unavailable manifest. Refresh before any release.
**Since 2026-11-01** web 5.16.5 to 5.16.8, api 0.21.2 and discord 5.9.8 and 5.9.9 are taken on `main`, and since 2026-11-02 web 5.16.9 to 5.16.11; see [the renumbering section](#renumbering-after-the-merges-outside-the-window-2026-11-01). **2026-11-13:** the maintainer ruled that the web and docs independents merge before this line, so they take web 5.16.12 to 5.17.0 and M-WEB becomes 5.17.1; see [the 2026-11-13 section](#renumbering-for-the-order-ruled-on-2026-11-13).
The package targets remain separate from pending Core 5.16.0, SVG 4.4.1 and Bot Logic 4.12.0;
folding removal into those minor artifacts would defeat the required deprecation sequence.

## Release gates remain open

- Publish and verify the A/R/H prerequisite packages, including Core 5.16.0, SVG 4.4.1 and
  Bot Logic 4.12.0, with actual registry-artifact and consumer acceptance evidence.
- Record the required beta and production acceptance of the current facade and deprecated
  result contract. Source tests and local packs do not establish deployed acceptance. **Ruling (2026-10-31, R1):** beta acceptance is retired for this wave. Production acceptance of the deployed A/R/H consumers (discord 5.9.7, API 0.21.1, web 5.16.4, OG 2.12.2 and moderation 1.9.0 with `LINKED_BAN_CONFIRMATION_ENABLED=false`; units 9 and 11-14 of the [unit acceptance checklist](REMEDIATION_UNIT_ACCEPTANCE_2026_10.md)) stands in for the beta acceptance of the current facade and deprecated result contract before Core 6.0.0. Manual beta dispatch remains unauthorized, and the ruling authorizes no merge, publication, deployment or activation.
- Recheck external npm consumers before removing public APIs or the result field. Local
  zero-call-site searches cannot settle external use. Revisit removal if an active consumer
  still needs the field.
  **2026-11-01:** the window is 14 days and the recheck runs no earlier than 2026-11-15T16:08:53Z (AP-43; unit acceptance section 6). M2 svg 4.4.2 is a patch that pins core exactly, so an `@xivdyetools/svg@^4` consumer receives core 6.0.0 without choosing it. The major-version protection in the external-consumer review does not cover that path; weigh it at M2.
- Publish Core 6 and verify it before SVG compatibility publication; verify both before
  Bot Logic 5 publication. Select each package individually through the gated Actions publisher.
- Select and accept each consumer release separately. Keep the original schema, provider,
  disclosure, identity/session, metadata-moderation, notification and rollback gates intact.
- **Ruled 2026-11-01:** the M-API, M-WEB, M-DISCORD and M-MODERATION deploys wait until #404
  and #405 are on `main` and M-CORE, M-SVG and M-BOT-LOGIC are published. With
  e-02 on `main`, #404's merge changes only docs and #405's starts only an og-worker run, so
  each of these four deploys from the last run its own M merge starts (#395, #402, #398 and
  #399), held in the production gate until then and accepted one at a time. **Since 2026-11-01**
  #402's merge should start no web run, so M-WEB's is #396's
  ([renumbering section](#renumbering-after-the-merges-outside-the-window-2026-11-01)). Reject or cancel
  every earlier run of each workflow before the next merge that matches it. M-OG gets no
  selected run of its own: reject #397's og 2.12.3 run, and #405's og 2.12.4 run carries it, so
  it is accepted with F-OG ([unit acceptance](REMEDIATION_UNIT_ACCEPTANCE_2026_10.md) AP-05,
  AP-06). **2026-11-13:** the production Cloudflare deploy credential was re-issued on 2026-11-09
  and has been used only by three API, Presets and OG runs, none of which deploys Pages
  ([2026-11-13 section](#renumbering-for-the-order-ruled-on-2026-11-13)). M-DISCORD's and
  M-MODERATION's selected runs are the first approved runs of those two workflows under it. M-WEB's
  run is the first use of its Pages grant only if no independent's web run is approved first; in the
  ruled order, the independents' approved web run is.
- Keep all activation flags false, OAuth's outbound continuity binding absent, Pages retention
  dry-run, the independent Image CPU/resource/manual hold, and Stoat parked.

## Workflow fanout and announcement hold

`workspace:*` consumers already build against the checkout's current packages. Core/SVG/Bot
changes also match app production workflow filters. Separate app patch PRs provide source,
verification and version boundaries; they do not pin or delay dependency adoption themselves.

The existing production reviewer gate must hold every package-triggered app run. During a
later explicitly authorized release, hold/cancel stale consumer runs and select only the
intended app source/run after its prerequisites and acceptance checks. Approving a package
publisher must not approve any app deployment. Do not treat draft status as an activation gate. **Rule (2026-10-31):** stale runs are no longer held: reject or cancel every stale run that is waiting for review or pending in its workflow's concurrency group before the next merge that matches the same workflow, and never cancel an approved run in progress, which can stop between `wrangler deploy` and `register-commands`. Each deploy workflow's single concurrency group has `cancel-in-progress: false`, so a stale run left waiting can hold up the selected one ([unit acceptance](REMEDIATION_UNIT_ACCEPTANCE_2026_10.md) AP-06).

Push only flat `codex/release-cut-*` candidate refs, excluded by all three automatic beta
workflows. Never push the private builder or local implementation branches. Manual beta
dispatch remains unauthorized. The root `CHANGELOG-laymans.md` remains unchanged because its
announcement path is independent of environment approvals.

## Scope limits and proof

Core retains the 8,192-byte cap, nine relocated slot/result/lookup types, current facade,
palette-free `/chara` entry, provider, shader behavior and retained library oracles. Bot retains
`fileText`, `fileBytes`, `NO_INPUT`, `familySize`, errors and all card/embed semantics. No optional
KEEP removal or terminal F-DISCORD/F-OG work is included.

The later [conditional F preparation](REMEDIATION_F_RELEASE_2026_10.md) now selects the pending
final dye-name inputs, verifies Discord fonts and prepares OG regional glyph selection. Its
fresh native Core archive identifies those different locale bytes; the original M receipts
remain historical. Final package selection must include the intended F text before publication,
and terminal deployed acceptance still follows eligible major/text adoption. All release holds
and the corrected earlier minor/deprecation sequence remain in force.

Each source cut needs its whole graph, applicable coverage and bundle gates, root checks,
secret scan and exact-head CI. The major packages additionally need clean built/packed
artifacts, retired-export/type checks, exact internal dependency pins and native consumer proof.
Revalidate after any future rebase or content change. A green conditional PR is not a shipped
release and does not close any gate above.

## Prepared source and acceptance receipts

[Redacted preparation receipt](../audits/2026-10-26-security/evidence/m-sprint-preparation-2026-10-29.json) records the immutable heads, gates, native archive hashes and exact-head CI. It covers twelve source PRs; the documentation companion verifies its own CI separately. Where a cell names two heads, the receipt binds the first; the second is the 2026-10-31 low-finding head ([unit acceptance](REMEDIATION_UNIT_ACCEPTANCE_2026_10.md) section 1).

| Source | Version | Draft PR | Head |
|---|---|---|---|
| M-CORE | 6.0.0 | [#391](https://github.com/FlashGalatine/xivdyetools/pull/391) | `cf54ecfd6670bc3a30dbe7d74d49e2969b9abf69`; `3cd1b6df23fb64e276efe868b89a7e3d398e4d75` since 2026-10-31 (test-only low-finding commit) |
| M-SVG | 4.4.2 | [#392](https://github.com/FlashGalatine/xivdyetools/pull/392) | `ebeb016e8437e714ddf706aacbabdce4636cf406` |
| M-BOT-LOGIC | 5.0.0 | [#394](https://github.com/FlashGalatine/xivdyetools/pull/394) | `7215c3660ade7b2adb1a0c53f6129034390a50c0` |
| M-API | 0.21.2 | [#395](https://github.com/FlashGalatine/xivdyetools/pull/395) | `ac6fd77d79e8d0e5af98845f06a72772fbb95102` |
| M-WEB | 5.16.5 | [#396](https://github.com/FlashGalatine/xivdyetools/pull/396) | `4ed3ad35a28b3c618aad664deba17512771711f6` |
| M-OG | 2.12.3 | [#397](https://github.com/FlashGalatine/xivdyetools/pull/397) | `f95dd83798a37aa943223b6c0b31d707054a2211` |
| M-DISCORD | 5.9.8 | [#398](https://github.com/FlashGalatine/xivdyetools/pull/398) | `929f8f6c1cf98bdfe1ae2b8c9525c51e82af6db6` |
| M-MODERATION | 1.9.1 | [#399](https://github.com/FlashGalatine/xivdyetools/pull/399) | `c79d2b24180d84865950e9b8ea2030cc4e9789c9` |
| M-STOAT | 0.3.5 | [#400](https://github.com/FlashGalatine/xivdyetools/pull/400) | `876dadb33bbefdaa0dc12d982e539eddd13cf1d0` |
| Web development compatibility companion | 5.16.5 | [#402](https://github.com/FlashGalatine/xivdyetools/pull/402) | `179b2ebbb31b43e044eae88467e92368c950ccd3`; `a33e7f588f6f94e8acd630a07028f2c1a1f2dfed` since 2026-10-31 (changelog-only low-finding commit) |
| Core declaration repair (earlier minor) | 5.16.0 (no new version) | [#393](https://github.com/FlashGalatine/xivdyetools/pull/393) | `e0e8c3eccf44f66ca054fa21e17b1ddb3b5502da`; `d1e0c467f97fd553628726432460c540508b9f7c` since 2026-10-31 (test-only low-finding commit) |
| Bot Logic declaration repair (earlier minor) | 4.12.0 (no new version) | [#401](https://github.com/FlashGalatine/xivdyetools/pull/401) | `698b7cefa2fb6a829a84425012e2ce584f14f25d` |

## Corrective prerequisites for the earlier release

- [@xivdyetools/core 5.16.0 declaration repair](https://github.com/FlashGalatine/xivdyetools/pull/393) must be integrated and revalidated before its earlier publisher. It retains the legacy API/result contract; no new minor version is allocated.
- [@xivdyetools/bot-logic 4.12.0 declaration repair](https://github.com/FlashGalatine/xivdyetools/pull/401) must be integrated and revalidated before its earlier publisher. It retains the legacy API/result contract; no new minor version is allocated.

The Core repair restores five existing public helper declarations. The Bot repair restores five
existing command/translator declarations. Both fixes are also present in the major candidates.
The corrected Bot minor native proof selects the corrected Core minor archive and SVG 4.4.1.
Do not use an earlier historical receipt as strict declaration acceptance. Old refs and receipts
remain immutable; refresh/revalidate later cuts when integrating these companions.

A third companion was found on 2026-10-30: `@xivdyetools/logger` 2.4.0, and the published 2.3.0, re-export six symbols that `stripInternal` removes from the emitted declarations. Unlike the Core and Bot Logic repairs, it is not present in the major candidates (the F tip ships the unrepaired logger source). A repair ([#407](https://github.com/FlashGalatine/xivdyetools/pull/407)) is prepared and recommended before P1 and merges cleanly onto this tree; whether to require it is the maintainer's decision. The M-wave strict-declaration receipts covered Core, SVG and Bot Logic only. See [section 9 of the A/R/H runbook](REMEDIATION_RELEASE_2026_10.md#9-earlier-minor-reconciliation--2026-10-30).

## Browser compatibility acceptance

A controlled live development page found that native JSON import attributes reject Vite's
JavaScript-transformed palette responses. The original fifteen assertions passed while missing
this failure. The companion adds independent Hair and Skin checks with known colors, 192 cells
and no live page errors; removing the plugin fails both. A narrow client-only `serve` transform
adapts two Core modules, retaining source maps, lazy imports and native Node package attributes.
The plugin is absent from production builds. No production failure was established by the
development probe, and this local result does not establish deployed acceptance. The bridge
uses a deprecated Vite API and must be revisited when upstream behavior changes.

## Stop, rollback and later execution

Keep the earlier accepted app artifacts and their matching package/source identities. Stop
dependent publishers/consumers on a failed registry or acceptance check; do not publish an
already-used version again or substitute a locally packed archive into the gated publisher.
Select the reviewed source/run and freshly built same-run artifact through the existing publisher.
For application rollback, verify the selected source's package/API compatibility and retain all
existing identity/moderation/notification safeguards and unresolved-operation holds. This wave
adds no migration or activation action.

Every merge remains blocked until October 30 or later **and** a new explicit approval plus
satisfied prerequisites. There is no scheduled merge, publication or deployment.

## Renumbering after the merges outside the window (2026-11-01)

**Superseded on 2026-11-13** by [the section below](#renumbering-for-the-order-ruled-on-2026-11-13), which reruns this table for the order the maintainer ruled that day. This section stays as the record of the simulation on `ee4dd0b6`. Its #411 and #414 heads (`4ffefc33`, `17c23411`) are older than the heads of 2026-11-13 (`811d3083`, `9d056543`).

On 2026-11-01 the maintainer asked to merge what does not depend on the 14-day window, so web 5.16.5 to 5.16.7 (#372, #417, #418), api 0.21.2 (#389), discord 5.9.8 (#420) and oauth 3.2.1 (#419) are on `main` ahead of this line, followed that night by oauth 3.2.2, web 5.16.8 and discord 5.9.9 (#421), and on 2026-11-02 by web 5.16.9 to 5.16.11 (#423, #424, #425) ([receipt](../audits/2026-10-26-security/evidence/outside-window-merges-2026-11-01.json)). **M-API becomes 0.21.3, M-WEB 5.16.12 and M-DISCORD 5.9.10.** Every other target stays, and none of those pull requests changed `packages/`. The first table above shows both numbers. The Version column of the prepared-source table keeps the prepared numbers, because it names frozen heads.

**The trap.** At #395, `package.json`, the README row, the current `docs/versions.md` row and its Conditional M row merge cleanly at 0.21.2, because both sides say so. `docs:check-versions` passes, because it only compares those places with each other. Set them by hand, or M-API ships Core 6 under a version already used. At #398 only the Conditional M row is silent, because `main`'s 5.9.9 makes the rest conflict visibly.

**Selected runs.** The last web run is #396's and #402's merge should start none, so do not reject #396's as stale. The last discord run is #398's and the last api run is #395's. Moderation runs at #399 for M-MODERATION and at #414 for the activation. This comes from the simulated trees and each workflow's path filter and has not been observed live, so read the run list at merge time.

Simulated in order on `main` at `ee4dd0b6`, with these rules applied:

| Pull request | Conflicts | Merges cleanly but must be set by hand | Rule |
|---|---|---|---|
| #391, #392, #394 | none | none | None. #391 merges first at its real tip: `3cd1b6df` aligns core's `package-declarations.test.ts` with `main`, and a later branch merged without it conflicts on that test. |
| #395 | `README.md`, api `CHANGELOG.md`, `docs/versions.md` | api `package.json`, the README api row, the current `docs/versions.md` row and its Conditional M row: all to 0.21.3 | Changelog: #395's section as `[0.21.3]` above `main`'s `[0.21.2]`; keep `main`'s `[0.21.1]` dated 2026-10-29, not the branch's 2026-10-27. History: v0.21.3 above v0.21.2. README: keep oauth 3.2.2. |
| #396 | `README.md`, web `CHANGELOG.md`, web `package.json`, `docs/versions.md` | none | Web 5.16.12 in `package.json`, the README row and the current row, taking neither side's number (`main` 5.16.11, branch 5.16.5); keep discord 5.9.9 from `main`. Changelog: `[5.16.12]` above `main`'s seven sections, `[5.16.11]` down to `[5.16.5]`. History: v5.16.12 above those seven. Conditional M hunk: web v5.16.12, api v0.21.3, in the branch's row order. This is M-WEB's selected run. |
| #397 | `README.md`, `docs/versions.md` | none | Per row take the higher version: oauth 3.2.2, api 0.21.3, og 2.12.3. Conditional M hunk: the branch's row order, og v2.12.3, web v5.16.12, api v0.21.3. |
| #398 | `README.md`, discord `CHANGELOG.md`, discord `package.json`, `docs/versions.md` | the Conditional M discord row in `docs/versions.md`: to v5.9.10 | Discord 5.9.10 in `package.json`, the README row and the current row, taking neither side's number (`main` 5.9.9, branch 5.9.8). Changelog: `[5.9.10]` above `[5.9.9]` and `[5.9.8]`. History: v5.9.10 above v5.9.9 and v5.9.8. Keep web 5.16.12. Do not replace 5.9.8 globally, because that corrupts `main`'s `[5.9.8]` changelog heading and v5.9.8 history row. The Prepared source row is v5.9.9 and stays. |
| #399 | `docs/versions.md` | none | Current rows: moderation 1.9.1, keep oauth 3.2.2. Conditional M hunk: the branch's row order, moderation v1.9.1, discord v5.9.10. Never take the branch's oauth 3.2.0. |
| #400 | none | none | None, provided the earlier Conditional M hunks kept the branch's row order. |
| #402 | `docs/versions.md` | none | Replace the v5.16.12 history row with #402's wording at v5.16.12, and keep `main`'s rows from v5.16.11 down to v5.16.5. That row is #402's whole net delta, because its code files match `main` and its changelog and `CLAUDE.md` additions resolve to `main`'s blobs. The row claims a Hair/Skin restore that `main` records under 5.16.4, so decide then whether to keep that clause; the first simulation recommended dropping it. This merge should start no web run: M-WEB's selected run is #396's, so do not reject that one as stale. |
| #403, #404 | none | none | None. #404's net change is two documents, with nothing under `apps/discord-worker`. |
| #405 | `README.md`, `docs/versions.md` | none | Per row take the higher version: oauth 3.2.2, api 0.21.3, og 2.12.4. Conditional M hunk: the branch's row order, discord v5.9.10, og v2.12.4, web v5.16.12, api v0.21.3. |
| #406 | none | none | None. |
| #411 | `docs/research/index.md`, `docs/versions.md` | none | Keep every research row. Prepared source hunk: keep `main`'s discord v5.9.9 and #411's presets-api v2.8.2. Do not bump that row to 5.9.10, because it lists bot-logic 4.12.0. |
| #414 | `docs/versions.md` | none | Current rows: moderation 1.9.2, keep oauth 3.2.2. The Conditional M moderation row stays v1.9.1. This step has two merge bases, and only this file conflicted. |

In the simulated final tree, `package.json`, the README and `docs/versions.md` agree for every workspace, `docs:check-versions` passes on an extracted copy, the web, api and discord changelogs descend, `'Restore Hair and Skin'` appears once in the web changelog, and root `test:scripts` keeps `publish-packages.test.ts` and `test:research-privacy`. Net across the line, the only files it shares with #421 or with #423 to #425 are `README.md`, `docs/versions.md`, and the web and discord `CHANGELOG.md` and `package.json`, resolved as above.

This is a merge-level result only, with no install, build or tests, using #411 at `4ffefc33` and #414 at `17c23411`. Rerun it after any new commit on the line or on `main`, and run the full gate on a preview merge before merging; a follow-up session on the review's remaining narrow-window issues is open, and if it merges first it takes the next web number. On 2026-11-02 the full gate on a preview merge caught the review's fixes to #423 going 55 bytes over the layout chunk's budget before they were pushed, so run `build:check` there too. Root notes 5.13.0 is posted, so this line's own entry needs a later number; the hook is off until the maintainer says otherwise. Each simulated step merged the branch onto the previous step; the real flow updates each PR with `main` first, which gives the same trees only if the same resolutions are made. `packages/bot-logic/src/commands/swatch.test.ts` auto-merged with changes from both sides and was read, not run. The simulated tree keeps #402's Hair/Skin clause; dropping it leaves #402 with no net change, with no web run either way. Re-date the renumbered changelog headings and history rows to the real merge date, since they still say 2026-10-29 and Oct 2026.

## Renumbering for the order ruled on 2026-11-13

On 2026-11-13 the maintainer ruled "Independents first": the web and docs pull requests #438, #427, #431, #433, #434, #432 and #435 merge on Sunday 2026-11-15, before this line. #439 drops its app and package README edits, is renumbered, and merges after the line's three package publishes ([receipt](../audits/2026-10-26-security/evidence/review-2026-11-13.json)). These rulings approve no merge, publish or deploy. `main` is still `ee4dd0b6`, unchanged since 2026-11-02. This section supersedes the 2026-11-01 one above.

**Targets in this order.** M-WEB becomes **5.17.1**, because the independents take web 5.16.12 to 5.17.0. M-API stays **0.21.3** and M-DISCORD **5.9.10**. OG goes to 2.12.3 (M-OG) and then 2.12.4 (F-OG), moderation to 1.9.1 (M8) and then 1.9.2 (#414), and stoat to 0.3.5. After the publishes, #439 takes web 5.17.2 and discord 5.9.11, which its head `63118a74` already carries, and #436 needs core 6.0.1.

Simulated on `ee4dd0b6` with every head of 2026-11-13, #411 at `811d3083` and #414 at `9d056543`, each step merged with `--no-ff` onto the one before:

| Pull request | Conflicts | Merges cleanly but must be set by hand | Rule |
|---|---|---|---|
| #438, #427 | none | none | None. #438 is docs only. #427 brings web 5.16.12. |
| #431 | `README.md`, web `CHANGELOG.md`, web `CHANGELOG-laymans.md`, web `package.json`, `docs/versions.md` | none | Take the incoming number, 5.16.13, in `package.json`, the README row and the current row. Stack its changelog, in-app notes and history blocks above #427's. `e2e/tool-narrow-pane.spec.ts` auto-merges with tests from both sides. |
| #433 | the same five | none | The same rule at 5.16.14. |
| #434 | none | none | None: stacked on #433, it brings 5.16.15. Retarget it to `main` once #433 merges. `mixer-tool.ts` and `v4/result-card.ts` auto-merge with #431's and #427's changes. |
| #432 | the same five | none | The same rule at 5.17.0 (head `6ab9159b`). `v4/toggle-switch-v4.ts` and its test auto-merge with the changes of #433 and #434. |
| #435 | none | none | None. Docs only. |
| #391, #392, #394 | none | none | None, as on 2026-11-01. |
| #395 | `README.md`, api `CHANGELOG.md`, `docs/versions.md` | api `package.json`, the README api row, the current `docs/versions.md` row and its Conditional M row: all to 0.21.3 | Unchanged from 2026-11-01. |
| #396 | `README.md`, web `CHANGELOG.md`, web `package.json`, `docs/versions.md` | none | Web 5.17.1 in `package.json`, the README row and the current row, taking neither side's number (`main` 5.17.0, branch 5.16.5); keep discord 5.9.9 from `main`. Changelog: `[5.17.1]` above `main`'s thirteen sections, `[5.17.0]` down to `[5.16.5]`. Rename only the branch's `[5.16.5] - 2026-10-29` heading, never `main`'s `[5.16.5] - 2026-11-01`. History: v5.17.1 above v5.17.0. Conditional M hunk: the branch's row order, web v5.17.1, api v0.21.3. This is M-WEB's selected run. |
| #397 | `README.md`, `docs/versions.md` | none | Per row take the higher version: oauth 3.2.2, api 0.21.3, og 2.12.3. Conditional M hunk: the branch's row order, og v2.12.3, web v5.17.1, api v0.21.3. |
| #398 | `README.md`, discord `CHANGELOG.md`, discord `package.json`, `docs/versions.md` | the Conditional M discord row: to v5.9.10 | As on 2026-11-01, keeping web 5.17.1. |
| #399 | `docs/versions.md` | none | As on 2026-11-01: moderation 1.9.1, oauth 3.2.2; Conditional M hunk with moderation v1.9.1 and discord v5.9.10. |
| #400 | none | none | None. |
| #402 | `docs/versions.md` | none | Replace the v5.17.1 history row with #402's wording at v5.17.1, and keep `main`'s rows from v5.17.0 down to v5.16.5. That row is still #402's whole net delta, so its merge should start no web run. The simulation kept the Hair/Skin clause, as before. |
| #403, #404, #406 | none | none | None. |
| #405 | `README.md`, `docs/versions.md` | none | Per row take the higher version: oauth 3.2.2, api 0.21.3, og 2.12.4. Conditional M hunk: discord v5.9.10, og v2.12.4, web v5.17.1, api v0.21.3. |
| #411 | `docs/research/index.md`, `docs/versions.md` | none | As on 2026-11-01: keep every research row; Prepared source hunk with `main`'s discord v5.9.9 and #411's presets-api v2.8.2. |
| #414 | `docs/versions.md` | none | As on 2026-11-01: moderation 1.9.2, oauth 3.2.2; the Conditional M moderation row stays v1.9.1. |
| #436 | none | core's version, which stays 6.0.0 | Core's changelog auto-merges with #436's entries under `[Unreleased]`, above `[6.0.0]`. Add the 6.0.1 bump to #436 before it merges: `package.json`, the README and current rows, a history row and the changelog heading. |
| #439 | `README.md`, discord and web `CHANGELOG.md`, web `CHANGELOG-laymans.md`, discord and web `package.json`, `docs/versions.md`, core `CHANGELOG.md` | none beyond #436's | Take #439's web 5.17.2 and discord 5.9.11 and stack its blocks above M's. Core changelog: its `### Changed` goes under `[Unreleased]` with #436's entries, never inside `[6.0.0]`. |
| #428 | none | none | None. |
| #437 | none | none | None. It changes the `devDependencies` of core, svg and bot-logic with no version change. |
| #429 | six `package.json` files and `pnpm-lock.yaml` | not reached | **Stopped.** Its dependency lines conflict with #437's, which these rules do not cover. Update #429 by hand after #437 is on `main`, then rerun this step. |

**Silent cases.** At #395 the api version files merge cleanly at the used 0.21.2, and at #398 the Conditional M discord row merges cleanly at v5.9.8, as on 2026-11-01. New in this order: after #436 and #439, core's source changes while its version stays 6.0.0, and after #437 the packed `package.json` of the published core, svg and bot-logic changes with no version change. `docs:check-versions` flags none of these, because it only compares the version files with each other.

**Checks.** On the tree after #437, `docs:check-versions` and `docs:check-links` pass, the changelog checker reports nothing beyond `main`'s baseline, `'Restore Hair and Skin'` appears once in the web changelog, and root `test:scripts` keeps `publish-packages.test.ts` and `test:research-privacy`. This is a merge-level result only, with no install, build or tests. The integration preview of 2026-11-13 (never pushed, tip `f966778c`) passed the full gate with 62 of 62 tasks and 17,964 tests, with the one-locale JS payload at 99.62% of its budget. It merged #439 before this line, which gave M-WEB 5.17.2 and M-DISCORD 5.9.11 and a core changelog conflict at #391; in the ruled order that conflict moves to #439. It also used the heads of #438, #432 and #439 from before the 2026-11-13 fixes.

**Rules above that are now worded wrongly in this order.** The 2026-11-01 section's bold line and its #396, #397, #398, #402 and #405 rows name web 5.16.12, `main`'s 5.16.11 and seven sections; in this order they read 5.17.1, 5.17.0 and thirteen. Its "Selected runs" paragraph still holds inside the line, but by the deploy workflows' path filters #436 and #439 start api, discord, moderation, og and web runs, and #437 and #429 start all eight. Merged while a selected M or F2 run still waits at the gate, any of them starts a newer run of the same workflow, so they are best merged after those runs are approved and finished. This comes from the path filters and is not a ruling. Its closing note that a follow-up session takes the next web number is settled by this order.

**The 2026-11-09 credential rotation.** The maintainer re-issued the production Cloudflare deploy credential at minimum scope on 2026-11-09 and dispatched Deploy API Worker, Deploy Presets API and Deploy OG Worker at `ee4dd0b6` (runs 42668470928, 42668497099 and 42668526198), all of which passed; none exercised the Pages grant ([#438](https://github.com/FlashGalatine/xivdyetools/pull/438): `SECRET_ROTATION.md` and `OPEN_ITEMS.md`). No web, Discord or moderation deploy has run since 2026-11-02. So the first approved web run is the first use of the Pages grant: in this order that is the independents' approved web run, and M-WEB's only if none of theirs is approved first. M-DISCORD's and M-MODERATION's selected runs are the first approved runs of those two workflows under the new credential, since no independent matches their paths. #438 also defers the Discord credential rotation until the M line's deploys have finished green, because both bot deploys register commands with their GitHub copy.

Rerun this table after any other merge to `main`, and after any new commit on a pull request in it.
