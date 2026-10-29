# A-IMAGE release-readiness follow-up — 2026-10-28

**Status: local source integration and validation prepared; hosted aggregate-memory acceptance and production activation remain open.** Base is adoption PR #362 at `316513243bc18ac8e11670013a87b7140756e72c`. This work does not publish packages, merge main, deploy or activate image-worker, or change production callers, logging, policies or secrets.

## Manual companion integration

Integrate both [PR #349](https://github.com/FlashGalatine/xivdyetools/pull/349) source commits, `14f859af587cada27456239bd1835d589044b810` and `9e5e6b9208749facb1b6b6f3e71e7e52b158fec9`, as a scoped squash on the adoption tip. The original PR stays available for its separate review/release boundary. All six resulting locale blobs are byte-identical to the companion head. Keep bot-logic **4.12.0**, Discord **5.9.7** and image-worker **1.3.5** as pending versions; preserve the H logging tests and higher-version changelogs.

Six real rendered `/manual match_image` cases independently require the approved 5-unit limits; French retains `5 Mo`. Temporarily restoring the old English `10MB` causes exactly one intended failure, then byte restoration and all focused suites pass: **369 tests /11 files** across Discord manual/index/fonts, bot i18n and OG fonts. No new translation, font regeneration, command shape or announcement change is introduced.

Source integration is not manual delivery. Publish the complete eligible bot-logic source after its upstream prerequisites and verify the corrected deployed manual before lower image caps activate. Bot-logic source paths trigger Discord and moderation deployments independently of npm publication. This branch and the existing stack are source preparation, not an enforced production hold or a safe merge-everything operation.

## Decoder allocation admission

The source review identified two allocation boundaries missing from the existing canvas checks. The pinned GIF decoder can allocate descriptor-sized RGBA before generic limits; extended WebP can decode nested VP8/VP8L using dimensions independent of its outer canvas/frame. This is source-backed admission evidence, not a demonstrated production OOM.

The new metadata-only parser requires every GIF image to fit the logical screen, consistent with [GIF89a section 20](https://www.w3.org/Graphics/GIF/spec-gif89a.txt). It checks palettes and length-delimited blocks without decoding or retaining frame arrays. Extended WebP uses checked RIFF/chunk extents, padding and nested dimensions; static payloads match the canvas, animation payloads match contained frames, and alpha partners/order are validated. Malformed duplicate or mixed reconstruction paths are refused before decode, following the [WebP container specification](https://developers.google.com/speed/webp/docs/riff_container).

File/pixel/side/output caps, five formats, WASM bytes, crop/filter math and the `{width,height}` result shape are unchanged. Previously tolerated malformed structures now fail through the existing `format` error marker. Both routes test eleven fixture classes for refusal before any Photon constructor/crop/resize call, followed by recovery. Red-first controls produce **seven parser and eleven route failures**; **six guard mutations** are caught and restored. The image unit suite passes **281 tests /11 files**, type-check and lint/knip. Ordinary and escalated source reviews accept the fix.

## Current retained-artifact runtime evidence

The [normalized receipt](remediation-image-readiness-memory-2026-10-28.json) records **148 local responses**, zero mismatches and 64 matching before/after source/artifact identities. The groups are separate: **98** observed actual-entry responses, **20** plain configured-entry responses without observer/inspector, and **30** compatibility responses. Compatibility includes valid GIF offsets/animation, WebP alpha/lossless metadata/animation, retained versus original WASM, and a clearly labeled prior-validator-only control. All valid compatibility inputs remain accepted with matching outputs.

The input/sequence proof includes valid 4096×2048 GIF/JPEG/WebP/BMP boundaries and an exact **1 MiB** unread extraction output overlapping the next successful request. Ninety-six unchanged-input rows match the immediately preceding local baseline; the historical seventy-response matrix also matches the prior receipts. The retained artifact remains SHA256 `f848bcd2a2794ef7dcea077ecdd3e4eaf06a2ace874a390d33800577968d2461`, with one initializer, the actual `worker.ts`, unchanged compatibility date/flag and no stock-wrapper substitution.

| Observation | Retained artifact | Original-WASM control |
|---|---:|---:|
| Main mixed matrix WASM capacity | 78.5625 MiB | 103.375 MiB |
| Largest capacity in expanded valid-format matrix | 110.4375 MiB | 132.0625 MiB |
| Largest post-response diagnostic sum | 120,022,986 bytes | 143,720,041 bytes |

The larger format matrix supersedes use of 78.5625 MiB as an all-format bound. The older 142.330 MiB report predates the retained ownership patch. Diagnostic sums and WASM capacity are ordinary post-response observations, not continuous simultaneous peaks, proven disjoint accounting, a Cloudflare formula or guaranteed headroom. The original control passing locally above the nominal hosted limit illustrates why local success cannot establish enforcement. No forced-GC or snapshot result is used as a pass criterion.

### Reviewed finite hosted-test sequence

The concrete proposal has **42 sequential valid requests**, three rounds of fourteen (24 extraction and 18 thumbnail), with exact SHA256 `e84a0b3d62bf4bbcbb3df0e00a8eecb71ea60be6898e7f11367b094fcc196eb0`. Its eight synthetic inputs are within the existing caps; maximum encoded input is 5,101,959 bytes and maximum expected output is 1,048,576 bytes. Every expected output comes from the already validated 148-response receipts. The [sequence receipt](remediation-image-readiness-sequence-2026-10-28.json) preserves order, hashes, bounds and provenance; executable fixtures/sequence stay in ignored readiness storage.

A single local plain run and a single observed run each pass **42/42**, adding **84** responses for **232 total local matrix responses**. All 64 source/artifact identities remain unchanged. The three rounds keep observed WASM stable at **107.25 MiB**, but ordinary diagnostic sums reach **138,038,845**, **146,092,141** and **146,065,557 bytes**. The maximum, at round-two JPEG thumbnail, comprises JS used 4,573,060 + embedder 861,192 + backing storage 28,198,113 + WASM capacity 112,459,776 bytes.

This is a material limit of the local evidence: the earlier 120,022,986-byte sample and positive subtraction from a numeric 128 MiB reference are **not mix-wide headroom bounds**. The new sum is not a Cloudflare formula, continuous peak or demonstrated hosted OOM either. No forced GC, extra retries, cap reduction or allocator substitution was used to produce a pass. The hosted gate remains open.

Preserve the initial sandbox loopback denial and the bounded early-refusal transport reset separately from the successful final run. New tests are synthetic and bounded; they perform no resource-exhaustion experiment or real-user request. Full raw receipts/scripts remain in the ignored readiness workspace, with hashes in the public receipt. This does not claim a newly portable complete historical harness; the older portable stock-WASM probe is not a current-candidate acceptance runner.

## Hosted test preparation and remaining acceptance

The [canary tools and operator instructions](scripts/image-acceptance-2026-10-28/README.md) are inert until separately authorized. They prepare an ignored, hashed wrapper of the actual source/artifact, a new routeless `xivdyetools-image-acceptance-20261028` preview configuration, an explicit account pin and a fresh 15-minute token/deadline. Production names, routes, resources and bindings are absent; public worker/preview URLs and persistent logs stay disabled. The wrapper substitutes only a synthetic fixture fetch and denies other outbound access. The loopback-only client refuses redirects, pins inputs/outputs and reserves a finite session budget. Tokens are neither printed nor committed.

Local canary safety controls pass **13/13**, and missing/invalid account arguments fail before output creation. A read-only connected-account inventory confirms the proposed name is vacant and the existing production image-worker is present. Wrangler identity/account and exact sequence must be checked again before any hosted action. No account/plan change, login flow, paid-feature purchase or deployment fallback is selected.

[Cloudflare limits](https://developers.cloudflare.com/workers/platform/limits/#memory) include JavaScript and WASM in a per-isolate limit and describe possible isolate replacement while in-flight requests complete. Standalone workerd uses a [null limit enforcer](https://github.com/cloudflare/workerd/blob/v1.20261019.1/src/workerd/server/factory/worker-factory.c%2B%2B#L256); accepting an unrecognized Miniflare option is not enforcement. Invocation-time [memory metrics](https://developers.cloudflare.com/workers/observability/metrics-and-analytics/#memory-usage) are sampled, so neither percentile charts nor successful requests certify a maximum.

The proposed hosted action is a separately authorized temporary authenticated remote-development preview, not a production deployment. Its extra fixture retention/wrapper allocations differ from production. Official remote-development documentation does not establish identical preview limits/telemetry. A successful hosted sequence may therefore remain insufficient: require suitable enforcement/outcome evidence, a conservative allocation assessment and explicit reviewer acceptance, or keep the hold. Stop on identity drift, resource errors, unexpected boot changes, output mismatch, deadline/budget exhaustion or any unexpected public exposure. Do not enable routes/logs or alter production bindings to make the test work.

## Final gate receipts and release decision

Forced serial integration gate passes **62/62 tasks**, **zero cached**, **17,852 tests /610 files /17 test workspaces**. Root script tests pass **220/220**; script types, reachability, version claims and Workers Logs pins pass. The image production dry-run passes at 1,681.68 KiB upload /649.94 KiB gzip, and the inert canary dry-run passes at 1,677.10 KiB /649.86 KiB. Both exit before upload. Initial CLI attempts used an unsupported deploy logging flag; corrected flag-only retries pass, with original failures retained. The complete bot-logic tarball passes sixteen native manifest/locale checks, including all six exact translated limit values and unchanged core/SVG/types pins; SHA256 is `0b252816e5e045fd0fce59f969e245b631fd9c29ecd60c13accc6bd81500db31`. Initial scratch assertions assumed byte-identical compiler JSON formatting and an incorrect key prefix; only the harness was corrected, preserving structural JSON equality and exact rendered strings. Canary controls pass thirteen cases plus two account-argument negatives, and Wrangler account access matches the pinned target. Final staged reachability and 1,140 relative links across 266 living documents pass. Filename-aware staged Gitleaks scans report zero findings; the committed outgoing range is scanned before push.

FINDING-020 remains **PARTIAL / OPEN**. The identified source admission gaps are addressed; hosted aggregate-memory acceptance, verified manual delivery and activation are separate, pending gates. No production safety verdict is claimed from this branch.
