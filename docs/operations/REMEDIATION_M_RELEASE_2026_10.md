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
  result contract. Source tests and local packs do not establish deployed acceptance.
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
publisher must not approve any app deployment. Do not treat draft status as an activation gate.

Push only flat `codex/release-cut-*` candidate refs, excluded by all three automatic beta
workflows. Never push the private builder or local implementation branches. Manual beta
dispatch remains unauthorized. The root `CHANGELOG-laymans.md` remains unchanged because its
announcement path is independent of environment approvals.

## Scope limits and proof

Core retains the 8,192-byte cap, nine relocated slot/result/lookup types, current facade,
palette-free `/chara` entry, provider, shader behavior and retained library oracles. Bot retains
`fileText`, `fileBytes`, `NO_INPUT`, `familySize`, errors and all card/embed semantics. No optional
KEEP removal or terminal F-DISCORD/F-OG work is included.

Each source cut needs its whole graph, applicable coverage and bundle gates, root checks,
secret scan and exact-head CI. The major packages additionally need clean built/packed
artifacts, retired-export/type checks, exact internal dependency pins and native consumer proof.
Revalidate after any future rebase or content change. A green conditional PR is not a shipped
release and does not close any gate above.
