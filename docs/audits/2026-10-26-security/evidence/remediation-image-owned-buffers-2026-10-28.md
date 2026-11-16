# A-IMAGE — owned-buffer implementation preparation, 2026-10-28

**FINDING-020 remains PARTIAL / OPEN; production activation remains held.** The recommended
Photon prototype is implemented and integrated locally, with admission and caller compatibility
changes. Independent Astra review approves source preparation. This does not close the unresolved
Cloudflare memory/platform acceptance or the corrected-manual release prerequisite.

Changes fold into pending image-worker **1.3.5 PATCH** and presets-api **2.8.1 PATCH**. Discord
production code, locale text, analytics taxonomy and policy documents are unchanged. This work
does not publish, deploy, merge or update the draft PR. The base is
`a35034bce2288fb47c922f23fe4bacfbe5e25617` on the existing isolated A-IMAGE branch.

The earlier [implementation evidence](remediation-image-2026-10-28.md) and
[investigation](remediation-image-investigation-2026-10-28.md) remain historical snapshots.
Their 142.330/141.518 MiB observations and diagnostic-GC results are not overwritten or relabeled.

## Implemented behavior

- **Photon ownership:** consume decoded RGBA storage instead of copying it twice; borrow crop
  and resize inputs instead of cloning full frames. Outputs remain independently owned, with
  the same algorithms, Lanczos3 filter, crop arithmetic and explicit frees.
- **One artifact and wrapper:** exactly pin `@cf-wasm/photon` to 0.4.0 and initialize the retained
  WASM once through `/others`. The auto-initializing default and `/workerd` entries are absent
  from the production import graph. [Retained inputs and rebuild context](../../../../apps/image-worker/vendor/photon/README.md)
  include source archives, the minimal patch, lock, tool metadata, licenses and hashes.
- **Admission:** one active image acquisition/processing operation per isolate, no waiting
  queue, shared across both POST routes. Busy/aborted work receives HTTP503 with
  `{ "error": "Image processing unavailable" }`. Admission precedes JSON/body/CDN work;
  health, unknown routes, wrong methods and public-hostname rejection retain their behavior.
- **Cancellation:** stop owned readers and CDN work, remove listeners and reject before decode.
  Abandon unused or oversized streams without waiting for an uncooperative cancellation promise.
  The new configured `src/worker.ts` entry protects the complete dispatch, including admission's
  `finally`, with `waitUntil`. A caller abort or timer never releases a still-active operation.
- **Caller compatibility:** presets distinguishes HTTP5xx, binding fetch/timeout and response-read
  failures as generic HTTP503 `SERVICE_UNAVAILABLE`; actual image4xx remains HTTP400. Both retain
  the reserved attempt, with no R2 write/attachment after unavailability. Existing cheap-validation,
  storage and database refund rules remain. Discord uses its existing generic localized failure
  and coarse `unknown` outcome for service unavailability.

The prepared 5 MiB encoded cap, 8,388,608 input pixels, 4096 side cap, PNG16 rejection,
16–512 extraction output/default256 and 640×264 thumbnail remain unchanged. Ordinary 4K and
ultrawide screenshots remain within the existing pixel allowance. No new provider, storage,
secret, public route or persistent logging is introduced.

## Reconstructing and selecting the artifact

The original installed binary maps to cf-wasm release
`a7423d01eacc7ce20359ad0df202d0ce58cf0347`. Its complete original Cargo.lock and Binaryen build
version are unavailable. The reconstruction pins the known embedded decoder versions, Rust
1.96.1, wasm-bindgen 0.2.126 and Binaryen 123, and retains the resolved lock. It is not described
as the publisher's exact original source-build environment.

Two clean unmodified builds produce the same artifact SHA256
`7d519bf220c1b01b52bd5b0c1fdaa3389da1ddc6da01df7666287fb6022a7b6d`; their tested outputs and
WASM high-water match the installed artifact. Then constructor, crop and resize ownership changes
are measured separately. Constructor-only lowers construction allocation but worsens the mixed
warm high-water to 115,998,720 bytes; borrowing crop reduces it to 91,619,328, and borrowing resize
reduces it to 82,378,752. Those failed/partial candidates remain evidence, not accepted fixes.

The final **1,571,497-byte** artifact SHA256 is
`f848bcd2a2794ef7dcea077ecdd3e4eaf06a2ace874a390d33800577968d2461`.
A fresh compact source extraction and target rebuild reproduces both optimized and pre-opt
WASM exactly; only isolated tool binaries and Cargo registry cache are reused. All 35 source
files match. The build recipe is actually executed after correcting its missing log-directory
creation and Windows path-remapping details.

The 279 retained inputs have original and retained hashes. Only a metadata path prefix and five
licenses' CRLF line endings are normalized in the vendored copy. Archives/WASM retain their bytes.
All 279 retained hashes are checked against both the working files and staged Git blobs, avoiding
a fresh-checkout mismatch. Narrow whitespace attributes preserve upstream legal-text whitespace
and unified-diff context; ordinary source checks and LF normalization still apply. The license
inventory is an audit record, not a legal conclusion.

## Actual entrypoint parity and ordinary memory observations

The actual configured entry, source, manual initializer and imports are bundled unchanged.
The control substitutes only the original installed CompiledWasm bytes, with identical JavaScript
SHA256 `f4737e4ad087c20156831bdcd9d1f829203895ee7c317033344bb20a80c355eb`.
There is exactly one WASM import and one initializer. All 64 source/config/lock/input hashes remain
unchanged before and after the runs.

**70/70 responses match:** per artifact, 24 main requests, ten edge requests and one fresh cold
thumbnail. Both artifacts also match both earlier expected-output receipts. The matrix covers all
five supported codecs on small fixtures; near-cap/4K/ultrawide sources; byte/pixel/output/PNG16
rejections; recovery; simple PNG metadata/alpha; narrow dimensions; and truncated decode. It does
not claim dedicated ICC, EXIF-orientation, CMYK or animated-image coverage.

| Actual application | Mixed warm WASM capacity | Separate cold-cap thumbnail |
|---|---:|---:|
| Original binary control | 103.375 MiB | 103.375 MiB |
| Ownership-patched binary | 78.5625 MiB | 65.6875 MiB |

Warm WASM capacity falls by **26,017,792 bytes /24.8125 MiB**. The worst diagnostic checkpoint
for each artifact uses counters returned together at one actual request checkpoint:

| Artifact | JS used | Embedder | External backing | WASM capacity | Diagnostic sum, bytes |
|---|---:|---:|---:|---:|---:|
| Original control | 4,701,596 | 1,289,864 | 21,228,579 | 108,396,544 | 135,616,583 |
| Ownership patch | 4,964,392 | 1,547,832 | 21,070,439 | 82,378,752 | 109,961,415 |

No forced GC, snapshots or phase instrumentation ran in these actual-entry comparisons. These
are ordinary post-response checkpoints, not continuous peaks or Cloudflare's accounting formula.
Standalone workerd does not enforce the production isolate memory limit. The smaller footprint
supports source preparation, not a production memory-safety verdict.

## Runtime cancellation regression and fix

Unit tests initially pass while a real service-binding control fails **24/34 checks**: abort
reaches the incoming signal and owned reader, but request-context cancellation drops cleanup
continuations before `finally`. The isolate then keeps answering503. Diagnostic evidence retains
this failure rather than claiming that signal delivery alone proves recovery.

A scratch whole-dispatch `waitUntil` hypothesis passes34/34; the product then implements that
same lifetime boundary. A fresh **uninstrumented actual-entry + actual-artifact** run passes
**38/38 checks across seven cases**, with no injected keep-alive wrapper. All five abort cases
recover before manual input release, including stalled/rejected underlying cancellation and CDN
fetch/body stages. Refused extraction performs no CDN fetch. Source/config/bundle/WASM hashes
remain unchanged throughout.

An unread 1 MiB response can overlap a later successful request. This deliberately demonstrates
that the admission slot covers acquisition/processing, not all outstanding response storage.
Cloudflare [bounds post-disconnect execution](https://developers.cloudflare.com/workers/runtime-apis/context/)
through `waitUntil`; noncooperative I/O or runtime termination cannot carry an unconditional
cleanup guarantee. No lease timer resets the slot to conceal pending work.

## Verification and remaining release gates

Red-first caller controls fail12 expected assertions before implementation; the corrected focused
run passes126/126. Additional cancellation and Discord regressions are included in the final
repository run. Four admission mutations and the caller's service-status mutation are killed and
restored; the new lifetime entry also has pending-dispatch and rejection handling tests. Tests,
assertions, coverage thresholds and default environments are preserved.

The restricted sandbox initially blocks Miniflare's test registry, Git's worktree index and local
tool cache/loopback operations. Exact normal-host retries are recorded separately; startup failures
are not counted as passing tests. The exact dependency pin is verified with a frozen offline,
scripts-disabled install: 717 lock entries, already up to date. Original compiler/linker/path-remap
and two phase-only refusal-transport failures remain in the prototype record; the final actual-entry
70-response run has no failures or retries.

[Raw counters, source/artifact hashes, successful and failed controls, rebuild and runtime receipts](remediation-image-owned-buffers-memory-2026-10-28.json)
preserve original JSON hashes and normalize only machine path prefixes. Original harnesses and
full logs remain in the ignored prototype workspace; no new portable harness is claimed.

Fresh final gates pass with numeric exit0 for every command:

- Whole-graph build/type-check/lint: **45/45 tasks**, zero cached.
- Forced serial tests: **17,613/17,613 tests**, **607 files**, **17 workspaces**, **25/25 tasks**,
  zero failed/skipped and zero cached.
- All six root gates: **167 script tests**, script types, reachability (**646 production /644
  test files**), **34 version claims**, **1,067 links across 260 living documents**, and all
  seven Workers Logs pins.
- Image coverage run: **257 tests /11 files**, with statements **93.14%**, branches **89.29%**,
  functions **100%** and lines **96.35%**. The summary contains all eight source entries;
  fully covered files are omitted from the console's partial-file table.
- Wrangler production **dry-run only**: **1,676.23 KiB** upload estimate, **648.65 KiB** gzip,
  exactly one **1,571,497-byte** owned-buffer WASM and no bindings. It explicitly exits without
  deploying.

The first collector shell attempt fails before any gate because WSL is unavailable. Final runs
use Git Bash with explicit numeric native exit capture; neither startup nor boolean shell status
is substituted for a gate verdict. [Final gate receipt](remediation-image-owned-buffers-gates-2026-10-28.json)
preserves the command results and original JSON hash. The archived evidence's own relative links
are checked separately because the living-document link gate excludes the audit archive.

The independent final security review approves source preparation; its one documentation
attribution correction is applied. Complete all inherited package/provider
prerequisites, deploy/verify the corrected manual, and deploy the presets caller classification
before activating image overload behavior. Platform-memory acceptance remains a separate release
gate. A pnpm lockfile merge can trigger broad production deployment; source preparation does not
select that merge, deployment or npm publication.
