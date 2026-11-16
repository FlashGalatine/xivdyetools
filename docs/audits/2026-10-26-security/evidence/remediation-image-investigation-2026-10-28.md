# A-IMAGE — remaining memory investigation, 2026-10-28

**Recommendation: prototype a minimal Photon ownership patch, with early request admission as
a complementary control.** Recover a reproducible unmodified build first, then remove unnecessary
full-image copies one change at a time. Cloudflare Images is the fallback if that approach cannot
produce sufficient headroom at an acceptable maintenance cost. This is a recommendation for the
next experiment, not a selected production architecture or a memory-safety verdict.

**FINDING-020 remains PARTIAL / OPEN; image-worker activation remains held.** The prepared PNG16
rejection and other mitigations are unchanged. This investigation adds evidence; it does not
supersede the [earlier implementation receipt](remediation-image-2026-10-28.md) or revise its
historical measurements. No runtime source, dependency, deployment, policy or release metadata
changes are made here.

## What the new experiments establish

The source remains `a35034bce2288fb47c922f23fe4bacfbe5e25617`, with all six source/config/lock
hashes matching the frozen implementation receipt. The local runtime uses Node 22.21.0,
Miniflare 5.20261019.2-beta, workerd 1.20261019.1 and Photon 0.4.0, with compatibility date
2024-12-01, external metadata disabled and telemetry disabled. All fixtures are synthetic.

One six-request warm sequence mixes near-cap, 4K, ultrawide and smaller inputs across both
routes. **All six responses are HTTP 200 and match the frozen control hashes.** Three bounded
diagnostic experiments follow; no new image processor or experimental product fix is substituted.

| Observation | Result | Interpretation |
|---|---|---|
| Existing cold cap fixture, extraction and thumbnail | WASM reaches **103.375 MiB during construction**, before resize/crop | The decoder ownership path is the first optimization target. These stage samples are reused from the frozen receipt, not new measurements. |
| New warm sequence | WASM reaches **103.375 MiB** and remains there | Freeing images reuses allocator space but does not shrink linear memory. |
| Requested GC, followed by local health dispatch | External storage **20,824,074 → 220,536 bytes**, WASM unchanged | Large temporary JS buffers are collectible in this sequence. |
| Intentionally retained then released 8 MiB buffer | Snapshot graph and external counter both lose exactly **8,388,608 bytes** after release and snapshot-triggered collection | Positive/negative control confirms the graph distinguishes this retained buffer; release alone did not immediately reclaim it. |
| Released snapshot | WASM backing store **108,396,544 bytes**, other JS array-buffer backing stores total **12 bytes** | No retained full input/output backing buffer is identified after these diagnostics. This is not a universal leak verdict. |

The earlier idle-only GC command timed out after 15 seconds. In this run it is still pending
after 500 ms idle; local health requests then accompany completion at 531.779 ms total.
[Pinned V8 source](https://github.com/v8/v8/blob/15.7.112.5/src/inspector/v8-heap-profiler-agent-impl.cc#L267)
posts a non-nestable foreground task for this command. The source and experiment support a
scheduling explanation; the timeout did not establish that the buffers could not be collected.

Workerd handles heap snapshots synchronously, and V8 collects and completes sweeping during
snapshot generation. Both forced GC and snapshots change runtime behavior. The diagnostic
post-collection counter sum is **104.778 MiB**; snapshot self-size attribution is **106.481 MiB**.
Those are different measurements. Neither replaces the historical **142.330 /141.518 MiB**
allocated checkpoints, establishes a continuous peak, or proves production GC timing.

The diagnostic wrapper exposes WASM through a global so its size can be measured. That injected
root must not be described as the production retaining path. Photon's installed generated glue
also holds the singleton WASM instance and cached memory views independently.

The [compact receipt](remediation-image-investigation-memory-2026-10-28.json) preserves raw
observations, controls, source hashes, pinned source references and hashes of the original local
artifacts. Full snapshots, harness and graph analysis remain in the ignored investigation folder
listed there. The harness depends on the existing local synthetic fixture workspace; no new
portable reproduction command or full matrix rerun is claimed.

## Why the present path consumes so much memory

The relevant upstream source is Photon commit
`139038385b0cca7a743a2e5dd451c9e626b6b880`, identified by the installed wrapper's source reference.
It is evidence about the implementation, not a complete reproducible build manifest.

The installed 1,566,855-byte WASM is also mapped exactly to the prebuilt artifact in cf-wasm
release commit `a7423d01eacc7ce20359ad0df202d0ce58cf0347`: Git blob
`d35be6ba83cdfd147110fdfea3ce5ce1b7d8f45e`, SHA256
`f477b87cbea0445c65fc7e580e89050190600379fcd44821cec67403483872b1`.
Its embedded producer section identifies rustc 1.96.1, wasm-bindgen 0.2.126 and walrus 0.26.4;
embedded paths identify image 0.24.9, png 0.17.16, jpeg-decoder 0.3.2 and gif 0.13.3. This narrows
the rebuild baseline but does not recover the complete dependency lock or all build tools/flags.
The complete pinned release tree has no Cargo.lock or rust-toolchain file. Its
[build configuration](https://github.com/fineshopdesign/cf-wasm/blob/a7423d01eacc7ce20359ad0df202d0ce58cf0347/packages/photon/tsdown.config.ts#L14)
skips Rust compilation when generated JS/WASM already exist: a prototype must explicitly rebuild,
rather than accidentally benchmark the unchanged prebuilt artifact.

- [Construction](https://github.com/silvia-odwyer/photon/blob/139038385b0cca7a743a2e5dd451c9e626b6b880/crate/src/lib.rs#L93)
  decodes a `DynamicImage`, calls `to_rgba8()` and then `to_vec()`. Ownership transfer through
  `into_rgba8().into_raw()`, after saving dimensions, is a candidate to eliminate avoidable
  full-frame copies. Some formats still require conversion and decoder scratch space.
- The [resize helper](https://github.com/silvia-odwyer/photon/blob/139038385b0cca7a743a2e5dd451c9e626b6b880/crate/src/helpers.rs#L36)
  clones the full raw pixel vector; [crop](https://github.com/silvia-odwyer/photon/blob/139038385b0cca7a743a2e5dd451c9e626b6b880/crate/src/transform.rs#L40)
  performs its own full-input clone. Borrowed input with independently owned
  output is another candidate. The existing Lanczos3 implementation also has intermediate
  allocations; eliminating the input clone does not eliminate every allocation.
- `apps/image-worker/src/validators.ts:325` collects streamed chunks, then copies them into a
  contiguous encoded buffer. Chunk storage and destination can coexist. Changing that read path
  alone cannot remove the persistent WASM high-water allocation.
- `apps/image-worker/src/index.ts:135` and `:177` allow requests to overlap while awaiting CDN
  fetches or uploaded bodies. Photon operations themselves execute synchronously. A lock around
  decode alone therefore does not bound overlapping input buffers.

The wrapper initializes a shared module and offers no supported unload/reset API. Calling
`.free()`, clearing an image reference, enabling finalizers or using `memory.grow(0)` does not
shrink the allocated linear memory. A fresh-instance wrapper would need correctly scoped glue,
classes and finalizers, and old instances would still depend on GC. It is not a small reset fix.

## Options and tradeoffs

| Approach | Benefit | Unresolved cost or limit | Recommendation |
|---|---|---|---|
| Keep prepared mitigations and add early admission | Bounds active application body acquisition without changing image algorithms | Retains the observed 103.375 MiB WASM plateau; cannot compel GC of completed requests | Necessary complement, insufficient by itself |
| Minimal owned-buffer Photon patch | Targets confirmed full-frame copies; best opportunity to preserve current formats, crop arithmetic and resampling | WASM rebuild provenance, decoder scratch, parity and ongoing patch ownership need proof | **First bounded prototype** |
| Cloudflare Images preprocessing | Moves full-resolution decode/resize out of the Worker; extract would decode only a bounded PNG locally, thumbnail could return managed WebP | Format, color, crop, latency, privacy, provider dependency and billing changes | Fallback migration |
| Fresh isolate/module for each request | Could avoid retaining one warm module's capacity indefinitely | Does not reduce per-request decode peak; instance lifetime, GC, cold starts and binding/build complexity remain | Do not prioritize |
| Lower input limits again | Can reduce per-request work | Further screenshot rejection; no defensible new limit follows from an uncontrolled GC schedule | Do not use as the primary solution |

Cloudflare's [Images binding](https://developers.cloudflare.com/images/optimization/binding/)
accepts raw byte streams without publishing a source URL. Extraction still needs a small encoded
image decoded into RGBA; no raw RGBA output is documented. Binding responses are not automatically
cached, but that does not establish immediate internal deletion or the existing no-storage
privacy promise. URL-based transformations and caching should not be substituted silently.

The [documented input list](https://developers.cloudflare.com/images/get-started/limits/#input-formats)
omits BMP, which Discord extraction accepts. Public preset uploads already narrow input to
PNG/JPEG/WebP; the internal image-worker accepts all five formats. Retaining the old full-size
Photon path for BMP would preserve the original memory risk.

Managed processing cannot be assumed pixel-equivalent: it applies EXIF orientation and color
profiles, has no documented selector for the identical Photon Lanczos3 implementation, and uses
different default enlargement behavior. Direct `fit:cover` scales then crops; current thumbnails
compute an integer crop first, then resize. Ordered explicit trim and exact-size transforms could
preserve geometry, but require fixture validation. See [processing features](https://developers.cloudflare.com/images/optimization/features/).

[Current pricing](https://developers.cloudflare.com/images/pricing/) includes 5,000 unique
transformations per month; an Images Paid plan charges $0.50 per additional 1,000. The free-plan
limit rejects new transformations once exhausted. Account eligibility, current usage and a cost
budget have not been checked or changed. Local offline emulation is only a subset; it cannot
establish production color/crop/animation compatibility.

## Proposed prototype and acceptance sequence

1. **Reconstruct the build.** Pin Rust, wasm-bindgen, build flags, source, features and the full
   resolved Cargo dependency lock; retain licenses. The published wrapper does not supply the
   exact original Cargo.lock. Its Photon commit alone does not establish identical dependencies.
   First compare an unmodified rebuild with the installed binary across the fixture matrix.
   Explain any baseline output or footprint difference before attributing gains to a patch.
   The machine has native Rust tools but no installed WASM target or wasm-bindgen CLI; no tools
   have been installed for this investigation.
2. **Measure the smallest change.** Change constructor ownership first. Run unchanged controls
   and patched workerd cold/warm measurements, preserving output hashes and all rejection
   boundaries. Do not predict a MiB saving from source arithmetic alone.
3. **Remove operation clones if needed.** Change crop and resize independently, retaining the
   same pixel math, filter, output ownership and cleanup/error behavior. Do not introduce unsafe
   borrowed-view lifetimes or change codec dependencies as an unexplained optimization.
4. **Bound admission before acquisition.** Design an explicit per-isolate active/queued input
   envelope before CDN fetch/body reads, with cancellation and permit cleanup. Avoid an unbounded
   in-memory queue. Verify overload responses and caller retries/refunds together; an image-worker
   limit cannot bound a body a caller has already buffered, nor collect previous-request garbage.
5. **Verify compatibility and resource bounds.** Cover PNG/JPEG/GIF/WebP/BMP; corrupt/truncated
   and adversarial headers; 16-bit rejection and byte/pixel/output boundaries; odd crop rounding,
   ratios around 1.05, 1-pixel axes, small upscales, alpha around 128, EXIF orientation, ICC/gamma,
   CMYK and animation behavior. Compare dimensions, raw extraction pixels, resulting palettes/dye
   matches, decoded thumbnails and stripped metadata. Include repeated mixed warm requests,
   simultaneous/slow/cancelled inputs and both caller deadlines. Stress runs must not depend on
   forced GC or snapshots to pass. Establish a conservative allocation/concurrency budget rather
   than adding sampled field maxima or relying on successful responses.
6. **Validate on the platform before activation.** Standalone workerd's
   [NullIsolateLimitEnforcer](https://github.com/cloudflare/workerd/blob/v1.20261019.1/src/workerd/server/factory/worker-factory.c%2B%2B#L278)
   does not enforce the production memory limit. A separately authorized isolated Cloudflare
   evaluation must examine resource failures and lifecycle behavior as well as responses. The
   platform now exposes [invocation memory percentiles](https://developers.cloudflare.com/changelog/post/2026-06-30-memory-usage-metrics/);
   these provide operational evidence, not a continuous maximum or an accounting formula. Obtain
   provider clarification where material, or explicitly record the residual uncertainty in the
   release decision. Existing package/manual/caller release gates remain in force.

Switch to the managed-service evaluation if a trustworthy rebuild cannot be established, the
patch cannot demonstrate sufficient headroom across the declared envelope, or maintaining it is
unacceptable. That evaluation must resolve BMP support, accepted output changes, service failures,
cost and privacy before implementation; no provider fallback should reintroduce unrestricted
full-resolution decoding.

## Review and scope

The source/compatibility review and runtime investigation used `gpt-6.1-sol` at `high`; the
independent security/accounting verifier used `gpt-6-astra` at `high`. The verifier agrees with
the bounded Photon prototype plus early admission, and retains the production hold. The new
diagnostics comprise six matching responses and the three controlled experiments above; prior
full-repository tests are not relabeled as newly run tests. No architecture implementation,
publication, deployment, PR update or production request follows from this investigation.

The evidence receipt's raw/summary parity, source/config hashes and original artifact hashes are
checked. The two relative evidence links resolve; the existing documentation link gate passes
1,064 links across 259 living documents (the archive itself is excluded from that gate). The
independent review's two attribution/GC-timing corrections are incorporated above.
