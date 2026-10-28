# A-IMAGE — reviewed mitigation preparation, 2026-10-28

**FINDING-020 remains PARTIAL / OPEN.** The 16-bit PNG vector is closed in source and
reviewed mitigations are prepared in image-worker **1.3.5 PATCH**. Aggregate memory
headroom and Cloudflare production acceptance remain unresolved. Do not activate this
release or describe the worker as proven memory-safe from these local results.

Base: verified A-OG-COPY `e66c67a937436a951331789207c57817ffdd0a50`. No main merge,
package publication, manual deployment, command registration or production load test occurs.

## Implementation and caller behavior

- Parse complete PNG IHDR depth/color metadata before Photon. Reject every legal 16-bit
  grayscale/RGB/grayscale-alpha/RGBA combination, malformed metadata and truncated headers;
  preserve legal supported lower depths. Both processing paths retain the existing
  unsupported-format error envelope and the caller's format classification.
- Apply a **5 MiB** encoded-input cap while streaming, **8,388,608** total input pixels
  (64 MiB admission allowance), and a separate extraction-output range **16–512**. The input
  side cap remains **4096**; 3840×2160 and 3440×1440 fit the pixel allowance. Default extraction
  is still **256** and thumbnails still **640×264**. Files between 5 and 10 MiB, and internal
  extraction requests above 512 output pixels, now receive the existing rejection envelope.
- Return the original Photon image when no resize is needed, avoiding a full PNG encode/decode.
  Release distinct consumed thumbnail images before the next allocating stage. Preserve
  alias-safe exactly-once/best-effort cleanup through crop, resize, encode and free failures.
- Caller reservation/refund policy is unchanged. Presets already has its own 5 MiB upload
  cap; Discord uses the default 256 output. Prepare the six-language bot-manual numeric
  correction separately in [PR #349](https://github.com/FlashGalatine/xivdyetools/pull/349)
  and ship its truthful limit before the lower worker cap.

The chosen bounds reduce measured allocation pressure. They are not an arithmetic proof
of the shared isolate limit or a substitute for the remaining platform gate.

## Regression and reversal proof

The original image suite passes **138 tests across eight files** before edits. Red-first
regressions cover PNG depth/type/header boundaries, both real routes/processors with Photon
and network doubles, no-resize behavior, thumbnail lifetimes, streamed/content-length byte
caps, exact cap/one-byte-over rejection, CDN abort and output validation before fetch/decode.

The restored candidate suite passes **221 tests across eight files**, coverage statements /
branches /functions /lines **92.35 /89.32 /97.36 /96.12**. Types, ESLint and knip pass.
Isolated reversals kill **41** header tests, **3** no-resize tests, **4 /1** early-free tests,
and **12 /5 /8** encoded/pixel/output-limit tests; each fixed source is restored exactly.
The first large-byte-array RED run was interrupted while formatting enormous expected-failure
output; a finite-stream retry maps successful results to byte length and retains the same
rejection assertions. No timeout, skip, coverage threshold or behavior assertion is weakened.

## Real workerd measurements

Use Photon **0.4.0**, workerd **1.20261019.1**, Miniflare **5.20261019.2-beta** and the original
**2024-12-01** compatibility date. Synthetic PNGs have valid CRCs and deterministic real
compressed IDAT data; near-cap payloads do not rely on meaningless padding. Instrumented
bundles capture numeric stage records; ordinary controls omit processor instrumentation,
constructor wrapping and the inspector. Source hashes are captured before/after bundling.

The earlier source, measured in actual workerd, reaches **110.25 MiB WASM** for cap-sized
RGBA8, **128.875** for RGB16 and **146.875** for RGBA16. A near-10-MiB RGBA8 input reaches
**120.6875 MiB WASM**; full-size extraction's redundant encode/decode can reach **182.375–
196.875 MiB**. A 64 MiB pixel allowance alone, or smaller encoded/output caps without early
thumbnail cleanup, is insufficient. Four scratch early-free comparisons retain exact WebP
body hashes while reducing the measured failing thumbnail allocation.

Frozen actual implementation: **29 cold cases**, including **nine accepted instrumented /
ordinary control pairs**, agree on status, output hash and WASM capacity. New-cap near-5-MiB
extraction and thumbnail cases reach **103.375 MiB WASM**; corresponding 4K cases reach
**102.6875**. All **11** rejection cases return 400 with zero Photon constructor calls and
WASM at its **1.3125 MiB** initialized baseline, including eight legal 16-bit cases, both
oversize routes and output 513 (before any CDN call). One HTTP client's early-response
transport attempt fails; the relevant real service-binding proxy retry succeeds and the
failed attempt is retained separately.

The same-isolate sequence runs **18 requests per mode**, three rounds mixing cap/4K/
ultrawide/smaller near-cap sources and both routes. All requests succeed, all **18** output /
status comparisons agree, and WASM grows to **103.375 MiB once**, then remains there.

**This is not a green aggregate-headroom result.** A checkpoint sums **142.330 MiB**:
103.375 WASM +7.226 JS used +29.972 external JS +1.757 embedder. Before the next header gate,
about **20.19 MiB** of external storage drops naturally while WASM is unchanged. This is
consistent with completed-request garbage; no inspector handle-retention defect is established.
The ordinary control independently reproduces the WASM plateau and output hashes.

Calibration shows the installed inspector's external-storage field excludes WASM but counts
an ordinary ArrayBuffer. Keep raw fields and stage definitions; summed per-field maxima need
not occur simultaneously. WASM capacity is a non-shrinking high-water allocation, not live
allocator bytes. Whole-process RSS includes bridge/runtime isolates and is not Cloudflare
isolate accounting. No exact continuous JS+WASM peak or production enforcement is proven.
A further **18-request non-pausing Runtime-only** sequence reproduces the same WASM plateau
and an idle accounting checkpoint of **141.518 MiB**, without debugger stage hooks. One requested
idle-only garbage collection command, sent after the sequence, does not reply within the
bounded 15 seconds; there is no after-GC result or proof of reachable memory from that attempt.
Forced GC is never treated as production behavior or used to manufacture a passing gate.

Cloudflare documents a [shared per-isolate JS/WASM memory limit](https://developers.cloudflare.com/workers/platform/limits/#memory).
V8's [heap statistics implementation](https://github.com/v8/v8/blob/main/src/inspector/v8-runtime-agent-impl.cc)
reports allocated counters; its [debugger resumes by releasing backtrace handles](https://github.com/v8/v8/blob/main/src/inspector/v8-debugger-agent-impl.cc).
Those primary-source observations do not establish identical production GC behavior.

## Reproducible receipts

- [Baseline measurements](remediation-image-memory-baseline-2026-10-28.json).
- [Frozen implementation and cold/warm controls](remediation-image-memory-actual-2026-10-28.json).
- [Non-pausing runtime diagnostic](remediation-image-memory-runtime-only-2026-10-28.json).

Receipt paths are normalized to checkout/probe placeholders; numeric observations, fixture
hashes and frozen source hashes are preserved. Original receipt hashes are retained.
The local-only [measurement probe](scripts/image-memory-2026-10-28/measure-image-memory.mjs)
and [summarizer](scripts/image-memory-2026-10-28/summarize-image-memory.mjs) require Windows with PowerShell and Node 22+
and the installed frozen dependencies. From the source checkout, for a bounded cold check:

```powershell
node docs/audits/2026-10-26-security/evidence/scripts/image-memory-2026-10-28/measure-image-memory.mjs --source-root=. --label=local-check --only=rgba8-64cap-near5MiB-extract256
```

Use a unique label. Default outputs go to the ignored `.superpowers/sdd/image-memory-repro-<label>`
folder; audit and nonignored checkout outputs are refused. `--warm` adds the mixed sequences;
`--warm-only --runtime-only-diagnostic` selects non-pausing idle samples. The optional
`--diagnostic-gc-at-end` is explicitly diagnostic and never a pass criterion. No package
install, external fixture fetch, deployment or production request is performed by the probe.
It pins the recorded dependency versions and preserves compatibility/config behavior. The copied measurement program is executed on
one cold instrumented/control pair: **2/2** HTTP 200, identical output hashes and
**103.375 MiB** WASM, with unchanged source hashes. Empty case selection is rejected.
The summarizer requires the complete matrix; a filtered attempt is rejected explicitly,
and formatter validation over a copied complete 31-result dataset preserves the original
29-case/18-request results and **142.330 MiB** checkpoint. This formatter check creates no
new workerd measurements. The original full matrix is not relabeled as a new portable run.
The early unspecified Miniflare metadata-cache request is documented in baseline limitations;
corrected controls and the clean probe disable external metadata and telemetry.

## Gates and activation hold

Whole-graph build/type/lint passes **45/45 tasks** (43 cached). The forced serial test
graph passes **17,564 tests across 604 files in all 17 workspaces**, **25/25 tasks**, zero
cached. All six root gates pass: **167 script tests**, script types, reachability,
**34** version claims, **1,064 links across 259 living documents**, and worker logging pins.
Wrangler **4.152.0** production `--dry-run` exits without deploying: **1,669.25 KiB** upload,
**647.08 KiB** gzip, Photon WASM **1,566,855 bytes**, no bindings. The first restricted-sandbox
pnpm startup reports a SQLite store permission failure before tests; identical normal-host
runs pass with the original assertions, coverage settings, timeouts and default environment.
The startup failure remains separate from the successful test run.
Ordinary implementation review and the escalated security source review find no actionable
source defect. The escalated verdict retains **5 MiB /512 /64 MiB for source preparation**,
closes the 16-bit vector in source only, and withholds a production memory-safety verdict.
Do not introduce extra resolution/file regressions merely to fit an unbounded GC schedule.

The complete reviewed bot-logic **4.12.0** source must include the six-language manual companion
before publication; fresh registry baseline is **4.11.0**. Publish and verify eligible packages,
deploy and verify the corrected manual, then consider image-worker activation only after the
unresolved aggregate-memory platform gate is satisfied. Bot-logic paths automatically deploy
Discord **and moderation** from workspace source, so withholding npm publication is not a hold.
No production approval hold is assumed or changed. Existing provider/consumer gates remain.
Image-worker has no automatic beta workflow; feature CI and a local dry-run are not a live
image-worker deployment. [Merged plan](../../2026-10-26-i18n/REMEDIATION_PLAN.md).
