# Isolated A/R/H release preparation — 2026-10-29

**Production activation: HOLD.** The authorized settings change is complete; source preparation does not authorize integration or activation.

The production environment requires FlashGalatine review, permits self-review for the sole maintainer, disallows administrator bypass and retains exactly the custom main branch rule. Two initial readbacks and a final readback confirm it. No approval or dispatch exercised the UI. The root announcement file remains byte-identical to baseline in every cut; direct deploy and announcement paths are outside the environment gate.

| Cut | Prepared unit | Candidate | Draft PR | Hosted CI |
|---|---|---|---|---|
| 00 | bootstrap | `9e6341ddc9cf` | [#369](https://github.com/FlashGalatine/xivdyetools/pull/369) | [Passed](https://github.com/FlashGalatine/xivdyetools/actions/runs/40898033080) |
| 01 | logger 2.4.0 | `c2410fa919d2` | [#370](https://github.com/FlashGalatine/xivdyetools/pull/370) | [Passed](https://github.com/FlashGalatine/xivdyetools/actions/runs/40898690789) |
| 02 | auth 3.0.0 | `9958553e11a3` | [#371](https://github.com/FlashGalatine/xivdyetools/pull/371) | [Passed](https://github.com/FlashGalatine/xivdyetools/actions/runs/40899976140) |
| 03 | core 5.16.0 | `0fed2b3744c2` | [#373](https://github.com/FlashGalatine/xivdyetools/pull/373) | [Passed](https://github.com/FlashGalatine/xivdyetools/actions/runs/40902784155) |
| 04 | worker-kit 1.6.0 | `489b9c5e9282` | [#374](https://github.com/FlashGalatine/xivdyetools/pull/374) | [Passed](https://github.com/FlashGalatine/xivdyetools/actions/runs/40902809507) |
| 05 | svg 4.4.1 | `f42786596cf1` | [#375](https://github.com/FlashGalatine/xivdyetools/pull/375) | [Passed](https://github.com/FlashGalatine/xivdyetools/actions/runs/40904626927) |
| 05a | discord-fonts-prerequisite 5.9.1 | `c2d6231190d6` | [#376](https://github.com/FlashGalatine/xivdyetools/pull/376) | [Passed](https://github.com/FlashGalatine/xivdyetools/actions/runs/40911743491) |
| 06 | bot-logic 4.12.0 | `ebba1baaa08a` | [#377](https://github.com/FlashGalatine/xivdyetools/pull/377) | [Passed](https://github.com/FlashGalatine/xivdyetools/actions/runs/40914423702) |
| 07 | oauth 3.2.0 | `cb728e14ebd0` | [#378](https://github.com/FlashGalatine/xivdyetools/pull/378) | [Passed](https://github.com/FlashGalatine/xivdyetools/actions/runs/40915136281) |
| 08 | presets-base 2.8.1 | `ca352abc7c7f` | [#379](https://github.com/FlashGalatine/xivdyetools/pull/379) | [Passed](https://github.com/FlashGalatine/xivdyetools/actions/runs/40915830404) |
| 09 | discord 5.9.7 | `47e297d1893f` | [#380](https://github.com/FlashGalatine/xivdyetools/pull/380) | [Passed](https://github.com/FlashGalatine/xivdyetools/actions/runs/40917240469) |
| 10 | presets-named 2.8.2 | `f54c8d832ba2` | [#381](https://github.com/FlashGalatine/xivdyetools/pull/381) | [Passed](https://github.com/FlashGalatine/xivdyetools/actions/runs/40917430325) |
| 11 | api 0.21.1 | `c0985720f9e7` | [#382](https://github.com/FlashGalatine/xivdyetools/pull/382) | [Passed](https://github.com/FlashGalatine/xivdyetools/actions/runs/40920237972) |
| 12 | web 5.16.4 | `0e5c660bda76` | [#383](https://github.com/FlashGalatine/xivdyetools/pull/383) | [Passed](https://github.com/FlashGalatine/xivdyetools/actions/runs/40920869184) |
| 13 | og 2.12.2 | `d81fece2ed6c` | [#384](https://github.com/FlashGalatine/xivdyetools/pull/384) | [Passed](https://github.com/FlashGalatine/xivdyetools/actions/runs/40921201682) |
| 14 | moderation 1.9.0 | `99a7ae4dd7da` | [#385](https://github.com/FlashGalatine/xivdyetools/pull/385) | [Passed](https://github.com/FlashGalatine/xivdyetools/actions/runs/40921843268) |
| 15 | image 1.3.5 | `fe087b42348b` | [#386](https://github.com/FlashGalatine/xivdyetools/pull/386) | [Passed](https://github.com/FlashGalatine/xivdyetools/actions/runs/40922146681) |
| 16 | stoat 0.3.4 | `315f40075dae` | [#387](https://github.com/FlashGalatine/xivdyetools/pull/387) | [Passed](https://github.com/FlashGalatine/xivdyetools/actions/runs/40922169825) |

All 18 source cuts passed their recorded whole build/type-check/lint/test graph and root gates, applicable coverage and bundle checks, secret scans and all four hosted CI jobs at their final heads. Turbo cache reuse is explicit in the [normalized receipt](isolated-release-cuts-2026-10-29.json); graph success is not a claim of an uncached run. Recorded branch-run queries found zero automatic beta runs. Cut 09 runtime and documentation qualification identities are recorded separately.

The completed local native consumer tested six frozen archives, 600 matching dist files, 27 native exports, six locale/manual payloads and three real private JWT producer cases. Node 22.21 ran the probe; pnpm 11.17 packed with lifecycle suppression proven by a positive control; pnpm 10.27 performed the final offline install after controlled exact dependency cache fills (13 reused, 0 downloaded). This is local evidence, not a registry release, CI attestation or hosted provider acceptance. Exact-version lookups still report six pending targets absent; types 3.3.0 is already published and is not republished.

The [font proof and output-only reproduction](isolated-font-reproduction/README.md) preserve old glyphs while adding four face/codepoint pairs. Comparisons use expanded/recompiled glyph records, not original raw glyf file bytes; pixel equality is bounded to the named renderer and four sampled sizes. F-DISCORD/F-OG remain unstarted.

Intermediate compatibility and test-fixture companions are explicit in the receipt: presets default then named binding releases; exact temporary locale reservations removed with real consumers; API data and stale-exception removal together; scoped initial-runner and local multiworker harness fixtures retaining their assertions/timeouts. Failed diagnostic attempts and raw logs remain ignored local operator evidence, bound by hashes where recorded. No private XIVAuth report or Cloudflare support/forum attachment was read or added to Git.

The [operational runbook](../../../operations/REMEDIATION_RELEASE_2026_10.md) retains migration, provider, disclosure, rollback and independent image-resource gates. The prior stack and PR #367 are historical review material; the isolated cuts are the selected future review boundaries. No finding is marked shipped by this preparation.
