# Conditional F preparation and adoption gates — October 2026

**SOURCE AND OFFLINE VALIDATION ONLY. Merging, publication, deployment and production activation remain on hold.**
The maintainer authorized preparing F-DISCORD, F-OG and the adoption checks that can run locally.
The [A/R/H](REMEDIATION_RELEASE_2026_10.md) and [M](REMEDIATION_M_RELEASE_2026_10.md)
release gates still apply. No date, green test, draft PR or local package authorizes a release.

## Final text candidate

The selected text prerequisite is the authoritative dye-name correction in
[PR #390](https://github.com/FlashGalatine/xivdyetools/pull/390), frozen at
`b1f9010568bda4537688556dfa3efedd0642e116`. Select its CSV, generated German/French payloads,
consumer expectations and provenance into the conditional Core major candidate. Preserve Core's
pending major version and all M changes; do not import the older package/version matrices or the
root announcement commit. The captured research remains a historical record of that earlier
patch; its version does not describe this candidate.

The [source capture and original adoption receipt](../research/2026-10-29-dye-name-translations/README.md)
retain the pinned upstream identity and every changed cell. English/Japanese/Korean/Chinese
payloads, dye identity/order/color/acquisition data and all Facewear inputs remain unchanged.
Core generation must reproduce only the selected German/French changes. This is conditional
source integration, not a merge or deployed adoption of #390.

**Earlier-minor decision (2026-10-30).** The maintainer decided that #390's corrections also enter the earlier minors. [#409](https://github.com/FlashGalatine/xivdyetools/pull/409) carries the same file selection on the Core 5.16.0 line without a version bump, and Core 6 then ships no text change. Where the baseline is identical, its blobs are #404's blobs, so the two lines converge; the whole M and F wave merges onto it without conflict. Merge approval is not given.

## F-DISCORD — verification-only source boundary

The post-reconciliation required codepoint sets are identical to the prior candidate. Both
real subset scripts ran offline into scratch from cached source faces with downloads disabled.
No newly required codepoint is missing. The regenerated Discord SC cut omits the pre-existing
surplus U+5220; the JP cut omits U+4F53 and U+6574. Keep the existing fonts: no required coverage
changed, and removing these three historical surplus mappings would create an unnecessary
binary/release change. Discord KR and all OG regenerated cmap sets are identical.

All six tracked subset byte hashes remain unchanged. Coverage, item-name, static-face and
regional-render focus gates pass (five files, 50 tests). This closes the offline F-DISCORD check
for these selected inputs without an empty Discord release. Deployed M/text adoption still
precedes terminal release acceptance; rerun this proof after any further rendered-text or item
name change. The [font receipt](../audits/2026-10-26-i18n/evidence/f-discord-preparation-2026-10-30.json)
binds the corpus/source/font hashes and scratch regeneration results.

## F-OG — separate implementation boundary

Prepared in [PR #405](https://github.com/FlashGalatine/xivdyetools/pull/405), after the
[text/F-DISCORD boundary #404](https://github.com/FlashGalatine/xivdyetools/pull/404).
Every image route passes its resolved locale through the renderer. Japanese uses JP-first;
Chinese and the other/default locales use SC-first, matching Discord's intended fallback.
The two cached arrays share the existing font bytes. The app-version bump selects a fresh
Worker cache namespace; old social-platform/browser copies are not purged. The reserved app version is
**2.12.4** (`apps/og-worker/package.json`; `versionReservation.ogTarget` in the F adoption receipt), separate from M-OG 2.12.3.

The 14 route scenarios and actual bundled-font renders cover regional normalization, invalid
locale fallback and the real Japanese/Chinese accessibility routes. Eight representative
English/German/French/Korean accessibility cards across both frames preserve the former pixels;
this sample is not an exhaustive every-card claim. Global JP-first, dropped-renderer-locale
and forced-English-route mutations each fail. All 889 OG tests and coverage pass; the full
repository graph passes 62 tasks, with 17,548 tests across 17 workspaces. The compile-only OG
bundle is 1,953.97 KiB gzip; the separate Discord check is 2,737.62 KiB, both below 3,072 KiB.

## Offline adoption acceptance

The [redacted source/adoption receipt](../audits/2026-10-26-i18n/evidence/f-adoption-preparation-2026-10-30.json)
binds the source heads, validated trees, native archives, seeds, source invariants and exact-head
source CI. Original A/R/H/M refs and receipts remain immutable.

| Gate | Local result | Limit |
|---|---|---|
| Final Core/SVG/Bot artifacts | Fresh packs, exact internal pins, offline installs under Node 22 and pnpm 11; strict declarations with `skipLibCheck:false` | Local artifacts, not registry releases or CI provenance |
| Consumer resolution | 36 distinct public exports imported; all 12 dependency edges resolve inside the isolated consumer | No workspace aliases or network-install fallback |
| Text adoption | All six packed Core payloads match source; 750 runtime names and 250 pinned authoritative German/French names pass | No new upstream data capture |
| Bot and manual | Four successful result cases, six error cases and 69 manual strings per locale across six locales | Deployed manual delivery remains open |
| Logger/Auth/Worker Kit | Hash-verified unchanged archives adopted; actual private producer passes valid, wrong-secret and expired JWT cases | Rerun against published auth; test-utils remains private |
| Schema/provider/application contracts | Current full graph passes the synthetic tests; protected runtime source trees and inactive configurations remain unchanged from M | No remote probe, migration, real-provider delivery or recovery rehearsal |
| Release controls | Draft refs excluded from beta; production reviewer/main policy read back; announcement/workflow source unchanged | No run dispatched or approved; each later app needs separate selection |

Select the Core major source containing #404's final text before its publisher. The new Core
archive replaces the older local M archive as evidence for this candidate's locale bytes.
The new Bot archive has identical dist bytes and semantically identical packed manifest to
the old M proof; its tarball hash differs because dependency keys serialize in a different
order. Use the fresh exact hash and consumer evidence recorded here. SVG's archive is unchanged.
If #390 is integrated into an earlier minor candidate, refresh that candidate's artifacts and
consumer proof too; the corrected minor receipts establish only their frozen sources.

## Adoption and release hold

Local artifacts and synthetic provider/schema tests establish source compatibility only.
Preserve the corrected minor declaration companions and required deprecation-release sequence
before the majors. F-DISCORD and F-OG are implemented/verified as conditional sources; terminal
release acceptance remains open until the actual selected M/text stack has been adopted.

Actual registry artifact/attestation/native installs, the private producer against published
auth, external npm-consumer review and deployed beta/production acceptance remain open. The
provider cycle, migrations/recovery, disclosures/manual/delivery, command registration, Image
resource gate and approval of each selected workflow run also remain open. Keep all activation
flags false, OAuth's outbound continuity binding absent, Pages retention dry-run and Stoat parked.
No new hosted Image request, remote database probe, package publication, registration, secret
deletion, workflow dispatch/approval or announcement is part of this preparation.

Release order remains logger/auth, corrected Core minor/worker-kit, SVG minor, Bot Logic minor,
accepted consumers/deprecations, then Core major, SVG compatibility, Bot Logic major, separately
selected M consumers and terminal F acceptance. Revalidate on the actual integrated source.
