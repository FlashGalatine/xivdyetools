# A-IMAGE temporary hosted-preview attempt — 2026-10-28

**Result: FAILED / STOPPED. Production activation remains held; FINDING-020 stays PARTIAL / OPEN.** The user explicitly authorized an exception to the repository's deployment restriction for this temporary preview and the reviewed 42 synthetic requests only. The attempt did not complete the workload and does not establish aggregate-memory acceptance.

**Later local follow-up:** the [CPU profile and budget investigation](remediation-image-cpu-profile-2026-10-28.md) identifies crop/resize as local hotspots with eight matching control/profile responses. The effective numeric legacy-preview CPU budget remains unverified; no further hosted test or production change was made.

## Identity and bounded execution

The tested source is draft [PR #363](https://github.com/FlashGalatine/xivdyetools/pull/363) at `777660935fd054f597cf5dd6ba3c075d7ce0cec6`. Before startup, read-only account access and account-wide name vacancy were reverified. A fresh ignored session pinned the same authorized account, the reviewed generator/template/driver, all 64 candidate source identities and the unchanged retained WASM. Its random token was supplied through ignored development variables, never printed or committed. Compatibility remains `2024-12-01` plus `enable_request_signal`; there is one product initializer and one WASM artifact.

The coordinator started only `wrangler dev --remote` for `xivdyetools-image-acceptance-20261028`, with a loopback proxy, no routes or production bindings, disabled public worker/preview URLs and observability, and a 15-minute admission deadline. The wrapper replaces only the synthetic fixture fetch and denies other outbound access. No production deployment, caller rebinding, package publication, plan change or increased resource budget was performed.

The exact sequence SHA256 remained `e84a0b3d62bf4bbcbb3df0e00a8eecb71ea60be6898e7f11367b094fcc196eb0`: three identical rounds of fourteen valid requests, planned as 24 extraction and 18 thumbnail requests. The client reserved all 42 attempts before sending. It ran once without driver retries and stopped on the first failed response check. This is not a 42-response pass.

## Observed outcome

The [normalized receipt](remediation-image-hosted-preview-2026-10-28.json) preserves expected/actual hashes, dimensions, lengths, capacity headers, timings and raw-receipt hashes. All times below are UTC; the filename uses the local session date. The driver started at **2026-10-29 03:29:44.331** and finished at **03:29:47.510**.

| Sequence position | Valid synthetic input | Operation | Outcome |
|---:|---|---|---|
| 1 | 4096×2048 GIF, 5,862 bytes | Extract, max dimension 512 | 200; baseline hash, 512×256 and 524,288 bytes match |
| 2 | Near-5 MiB 4K PNG, 5,101,959 bytes | Thumbnail | 200; baseline hash, 640×264 and 20,538 bytes match |
| 3 | 4096×2048 WebP, 396 bytes | Extract, max dimension 512 | 200; baseline hash, 512×256 and 524,288 bytes match |
| 4 | 4096×2048 1-bpp BMP, 1,048,638 bytes | Thumbnail | 503; 4,773 bytes, no candidate boot/capacity headers |
| 5–42 | Remaining approved entries | Not dispatched | Stopped; no attempt to complete or retry them |

The three successful responses share one boot identity. Their post-dispatch WASM capacities are 60,358,656, 84,738,048 and 84,738,048 bytes. These are not aggregate isolate-memory measurements or continuous peaks. The failed response's missing capacity header was parsed as numeric zero by the raw driver; the normalized receipt uses `null`, because no measurement was obtained.

Wrangler reports **“Worker exceeded CPU time limit.”** three times in this session's private log. The lines have no invocation identifiers or timestamps; their count does not prove three separate requests/retries or identify the charged processing stage. The defensible result is a fourth-response failure accompanied by session-level CPU-limit diagnostics. No hosted memory-exhaustion result, numeric CPU budget or production-equivalent preview budget is established.

The generated config has no resource-limit override. The installed Wrangler 4.152.0 remote-preview builders omit a numeric `limits` value; that omission does not establish unlimited CPU or identify the platform's effective allowance. Neither the 243 ms client duration of the failed response nor the local timings below identify that allowance.

The same BMP thumbnail succeeds in all three existing plain local rounds, with matching output and roughly 433/491/482 ms durations. Those values are wall time, not Cloudflare CPU measurements. The thumbnail path performs decode, crop, Lanczos3 resize and WebP encoding; the canary adds upload/fixture copies. Existing evidence does not separate these CPU costs or prove which caused the resource failure.

## Stop, cleanup and release decision

The coordinator interrupted the preview immediately after the failure. The owned Wrangler session exited; port 8787 has no listener, its recorded proxy process is gone, and no matching owned preview Node process remains. The wrapper's admission deadline is **03:43:34.016 UTC**. Stopping the local process is verified; immediate deletion of Cloudflare's temporary uploaded artifact is not claimed.

Read-only before/after account inventories contain the same fourteen normal Worker entries with identical compared script identifiers, etags, modification times, observability values and routes. The proposed canary name is absent from both normal script catalogs. This supports unchanged listed metadata, including production image-worker; it does not claim that the temporary preview never existed. All 64 source identities and four generated artifact hashes still match after the attempt. Private tokens, account identities, preview credentials and raw CLI logs remain outside Git.

The stop conditions worked. The proposed hosted acceptance **failed**, and the unresolved local 146,092,141-byte diagnostic observation remains material. The run neither clears the memory gate nor independently demonstrates a production OOM. Production activation and verified manual delivery remain separate holds. No cap reduction, plan upgrade, CPU-limit increase, logging enablement, production binding change or replacement hosted run was selected.

The next investigation should isolate CPU costs in a bounded local profile of the existing valid BMP thumbnail path, then establish the applicable preview budget and its relationship to production before proposing another hosted test. Keep aggregate-memory accounting as a separate requirement. Any subsequent hosted experiment needs its own concrete scope and authorization; the completed exception does not authorize production activation.

[Cloudflare documents remote development](https://developers.cloudflare.com/workers/wrangler/commands/workers/#dev) as execution in a preview environment. Its [error reference](https://developers.cloudflare.com/workers/observability/errors/) distinguishes CPU-limit errors from memory errors, and its [limits reference](https://developers.cloudflare.com/workers/platform/limits/#cpu-time) distinguishes CPU time from wall time. Those references support these distinctions; they do not provide the missing session-specific CPU or aggregate-memory measurements.
