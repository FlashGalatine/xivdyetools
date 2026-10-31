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
| 4 | M-API | API 0.21.2 | Keep the public v1 request/response contract and `familySize` |
| 5 | M-WEB | Web 5.16.5 | Preserve inspection-worker protocol, eight slots, matching eligibility and bundle budget |
| 6 | M-OG | OG 2.12.3 | Preserve card output; the app version also advances cache identity |
| 7 | M-DISCORD | Discord 5.9.8 | Preserve original-byte attachment guards, cards, embeds and adapter behavior |
| 8 | M-MODERATION | Moderation 1.9.1 | Preserve shared sanitization, private replies and disabled confirmation paths |
| 9 | M-STOAT | Stoat 0.3.5 | Verify the parked adapter; no activation or deployment |

Version reservations were checked against public npm and all 56 open PR heads (504 manifests)
on October 29: no proposed target conflict or unavailable manifest. Refresh before any release.
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
- Publish Core 6 and verify it before SVG compatibility publication; verify both before
  Bot Logic 5 publication. Select each package individually through the gated Actions publisher.
- Select and accept each consumer release separately. Keep the original schema, provider,
  disclosure, identity/session, metadata-moderation, notification and rollback gates intact.
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

[Redacted preparation receipt](../audits/2026-10-26-security/evidence/m-sprint-preparation-2026-10-29.json) records the immutable heads, gates, native archive hashes and exact-head CI. It covers twelve source PRs; the documentation companion verifies its own CI separately.

| Source | Version | Draft PR | Head |
|---|---|---|---|
| M-CORE | 6.0.0 | [#391](https://github.com/FlashGalatine/xivdyetools/pull/391) | `cf54ecfd6670bc3a30dbe7d74d49e2969b9abf69` |
| M-SVG | 4.4.2 | [#392](https://github.com/FlashGalatine/xivdyetools/pull/392) | `ebeb016e8437e714ddf706aacbabdce4636cf406` |
| M-BOT-LOGIC | 5.0.0 | [#394](https://github.com/FlashGalatine/xivdyetools/pull/394) | `7215c3660ade7b2adb1a0c53f6129034390a50c0` |
| M-API | 0.21.2 | [#395](https://github.com/FlashGalatine/xivdyetools/pull/395) | `ac6fd77d79e8d0e5af98845f06a72772fbb95102` |
| M-WEB | 5.16.5 | [#396](https://github.com/FlashGalatine/xivdyetools/pull/396) | `4ed3ad35a28b3c618aad664deba17512771711f6` |
| M-OG | 2.12.3 | [#397](https://github.com/FlashGalatine/xivdyetools/pull/397) | `f95dd83798a37aa943223b6c0b31d707054a2211` |
| M-DISCORD | 5.9.8 | [#398](https://github.com/FlashGalatine/xivdyetools/pull/398) | `929f8f6c1cf98bdfe1ae2b8c9525c51e82af6db6` |
| M-MODERATION | 1.9.1 | [#399](https://github.com/FlashGalatine/xivdyetools/pull/399) | `c79d2b24180d84865950e9b8ea2030cc4e9789c9` |
| M-STOAT | 0.3.5 | [#400](https://github.com/FlashGalatine/xivdyetools/pull/400) | `876dadb33bbefdaa0dc12d982e539eddd13cf1d0` |
| Web development compatibility companion | 5.16.5 | [#402](https://github.com/FlashGalatine/xivdyetools/pull/402) | `179b2ebbb31b43e044eae88467e92368c950ccd3` |

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
