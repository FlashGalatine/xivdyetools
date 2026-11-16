# H adoption preparation — 2026-10-28

**Status: all fourteen units have local source/verification preparation; publication, registry adoption and production rollout remain pending.** This follows H-LOGGER/H-AUTH [PR #352](https://github.com/FlashGalatine/xivdyetools/pull/352). It does not close the deployed findings or authorize a deploy-everything step.

## Versions and dependency order

The [live registry receipt](adoption-registry-2026-10-28.json) shows logger 2.4.0, auth 3.0.0, core 5.16.0, worker-kit 1.6.0, SVG 4.4.1 and bot-logic 4.12.0 are still unpublished. Existing pending versions absorb this work. All nine app versions are already ahead of main; they also retain their pending versions. Private test-utils stays 3.0.0 with no npm release.

Keep `workspace:*`: pnpm packs exact internal versions, and the reviewed publisher rejects alternate internal dependency specifications. Publish logger/auth, then core and worker-kit, then SVG, then bot-logic, verifying each selected upstream registry version before the dependent release. Each application remains a separate gated adoption/deploy after its upstream versions exist. No M major-removal or F font sprint is included.

| Sprint | Local preparation | Release boundary |
|---|---|---|
| H-CORE-ADOPT | [Core evidence](adoption-core-2026-10-28.md): logger 2.4.0 exact pin; native JSON imports repaired | core 5.16.0 after logger |
| H-WORKER-KIT-ADOPT | [Middleware evidence](adoption-worker-kit-2026-10-28.md): logger 2.4.0 exact pin; real output and optional-peer checks | worker-kit 1.6.0 after logger |
| H-SVG-ADOPT | [SVG evidence](adoption-svg-2026-10-28.md): core 5.16.0 exact pin; real card generation | SVG 4.4.1 after core |
| H-BOT-LOGIC-ADOPT | [Bot library evidence](adoption-bot-logic-2026-10-28.md): exact core/SVG pins; native locale imports repaired | bot-logic 4.12.0 after core/SVG |
| H-TEST-UTILS | Real private JWT producer remains accepted by both hardened auth verifier paths; canonical and expired controls retained | private verification only; repeat after auth publication |
| H-API | Existing workspace closure selects core 5.16.0 and worker-kit 1.6.0, both carrying logger 2.4.0; complete API gate | API 0.21.1; production rollout remains separate |
| H-PRESETS | [Presets evidence](adoption-presets-2026-10-28.md): five context calls and canonical JWT/v2 controls | presets 2.8.1 after auth/worker-kit/logger |
| H-OAUTH | [OAuth evidence](adoption-oauth-2026-10-28.md): real delegated verifier acceptance/rejection; stale comment corrected | OAuth 3.2.0 after auth/worker-kit/logger |
| H-IMAGE | Existing closure selects worker-kit 1.6.0/logger 2.4.0; binding-only and memory/ownership gates retained | image 1.3.5 after worker-kit/logger |
| H-OG | Existing closure selects core 5.16.0/SVG 4.4.1/worker-kit 1.6.0/logger 2.4.0; card/font gates retained | OG 2.12.2 after selected upstream publishes |
| H-DISCORD | [Discord evidence](adoption-discord-2026-10-28.md): three context calls; actual output tests | Discord 5.9.7 after selected upstream publishes |
| H-MODERATION | [Moderation evidence](adoption-moderation-2026-10-28.md): four context calls; actual output tests | moderation 1.9.0 after selected upstream publishes |
| H-WEB | Existing closure selects core 5.16.0/SVG 4.4.1/logger 2.4.0; full app and bundle gates | web 5.16.4 after selected upstream publishes |
| H-STOAT | [Parked adapter evidence](adoption-stoat-2026-10-28.md): three context calls; existing sanitizer mirror verified | parked verification only; no activation/deploy |

The five verification-only units (test-utils, API, image, OG and web) have no additional runtime or version changes here. Their evidence is kept together without inventing empty releases. The other units have separate source/release-note commits and draft PR boundaries.

## Behavior and artifact checks

The inventory is now **fifteen** genuine context-as-error calls: Discord three, moderation four, presets five and Stoat three. Each becomes `error(message, undefined, context)`. Tests assert the third slot, retained fields and actual sanitized console output; reverting each owning fix makes its test fail. Presets retention-job has an intentional two-argument logger and remains unchanged. Browser errorTracker field traversal and direct callable-value limits from H-LOGGER remain unchanged.

OAuth and presets tests accept canonical issuance and reject same-byte padding/unused-bit aliases. Independent native cryptography accepts the aliased bytes, proving the negative cases test encoding policy rather than a bad signature. Uppercase v2 HMAC rejects before nonce storage, followed by a canonical success control. Auth implementation, session behavior, token claims, v2 wire format and generic hex decoding remain unchanged.

The [local artifact receipt](adoption-artifacts-2026-10-28.json) records seven real tarball hashes/exact dependency manifests, **44 native consumer checks**, a separate **20-check core probe**, **eight negative controls**, and restoration of all **765** extracted files to their tarball bytes. Real exports exercise core locale/creator/shader data, API logging, Hono middleware, SVG generation, localized bot logic, canonical auth and the private built JWT producer. Hono-absent root/rate-limiter checks explicitly block optional-peer resolution.

Native Node 22.21.0 initially failed on core's missing character JSON import attributes; an integrity-checked published core 5.15.0 artifact reproduces it. The combined check then exposed the same issue in bot-logic's six UI locale imports. Eleven core imports and six bot imports now carry attributes; eager/lazy behavior and data are unchanged. Final checks use no JSON loader. Independent removals of the static, lazy hair, lazy skin, shared shader, race shader and bot locale attributes fail again.

This is a local artifact check with external runtime dependencies linked from the locked installation, not a fresh registry install or CI provenance. Private producer testing uses its actual built auth module, not the Vitest-dependent root barrel. Node checks do not claim production, browser or workerd behavior.

## Gate receipts and review

62/62 forced serial graph tasks, zero cached; 17 test tasks, 610 files and 17822 passing tests. Web bundle budget passes at 2.17/2.20 MB for one locale. Root documentation links pass: 1,139 links across 265 living documents. Filename-aware staged Gitleaks scan: zero findings.

Scoped checks already passed: presets 58 files/1,415 tests; OAuth 21 files/554 tests; Discord index 163; moderation context 16; Stoat 68 across four files including the existing echo mirror. Presets five-site and bot ten-site reversions fail, then restored runs pass. App type/lint checks retain existing warnings, with no threshold, timeout or assertion reductions.

Root script tests pass 220/220, with script types, production/test reachability, 34 version claims and seven Workers Logs configuration checks passing. Independent Sol regression/semver and Astra security review cover the source and real artifact controls; both reviews accept the source; final evidence and committed-range acceptance are recorded before the authorized push.

## Decisions and operational holds

- Preserve workspace protocol and use scratch artifact checks rather than add a second publisher subsystem. The cost of an incomplete local probe is caught again by the existing publisher and the post-publication adoption gate.
- Keep pending versions and separate unit review/release boundaries. Refresh registry versions and packed dependencies immediately before shipping; stale assumptions could otherwise require a new bump or repack.
- Repair the discovered native JSON imports within the two pending package releases. Actual tarball negative controls and full dependent/bundle gates cover the compatibility risk.
- Keep verification-only evidence together, retain Stoat's existing sanitizer and keep its adapter parked. No speculative runtime rewrite or empty release is created.

All A-sprint provider, D1, service-binding, storage and activation prerequisites remain. Existing automatic beta workflows may run on feature pushes. There is no npm publication, manual deployment, main merge/push, policy/secret/scanner change or private XIVAuth report in this work. Findings 042/044/047 retain their existing PARTIAL status until publication, registry adoption and actual consumer rollout are evidenced.
