# Retained Photon ownership patch

This private application uses `photon-owned.wasm` with the exactly pinned
`@cf-wasm/photon/others` JavaScript wrapper. `src/photon-runtime.ts` initializes this module once;
do not import the wrapper's default or `/workerd` entry, which initializes its original binary.

The patch consumes decoded RGBA ownership and borrows crop/resize inputs instead of cloning
full images. Outputs retain independent ownership; codecs, pixel math, Lanczos3 filtering and
explicit `.free()` calls are preserved. Input and output limits have not been raised.

The accepted artifact is SHA256
`f848bcd2a2794ef7dcea077ecdd3e4eaf06a2ace874a390d33800577968d2461`.
`vendor-photon.test.ts` checks the artifact hash, wrapper pin and WASM ABI against
the installed wrapper artifact. Runtime parity and memory observations are separate evidence;
these guards do not establish Cloudflare production memory safety.

## Build inputs and proof

- `ownership.patch`, `source-unmodified.tar.gz` and `source-patched.tar.gz` retain the reviewed
  source change and both source baselines, derived from cf-wasm release
  `a7423d01eacc7ce20359ad0df202d0ce58cf0347`.
- `Cargo.lock`, `provenance.json` and `REBUILD.md` pin the reconstructed dependencies and build
  tools. The publisher's complete original lock is unavailable; the unmodified reconstruction
  is compared with the installed artifact before patch measurements.
- `compact-exact-result.json` records a fresh source/target rebuild reproducing the accepted
  artifact. Existing isolated tool binaries and registry cache were reused; build objects and
  outputs were not reused. Earlier failed reconstruction attempts are recorded in the audit.
- `LICENSE.md`, `licenses/` and `licenses.json` retain upstream license material and the
  dependency inventory. The inventory is an audit record rather than a legal conclusion.
- `retention-manifest.json` records the 279 retained inputs, original and retained hashes, and
  explicit metadata-path and LF normalization. Archives and WASM retain their original bytes.
  This current-context README, the local build-output ignores and the manifest itself are not
  part of those original retained inputs.

Ordinary application builds use the checked-in artifact and require no Rust installation.
To rebuild manually with the tool versions/layout described in `REBUILD.md`, from this folder:

```powershell
./build.ps1 -Variant patched -Clean -ToolchainDirectory '<isolated-tool-root>'
```

The script extracts the retained source and writes a fresh result under `artifacts/patched/`.
Compare its SHA256 with the accepted artifact; it does not automatically replace that artifact.
Any source/tool/dependency or wrapper change requires new ABI, pixel/error parity, cold/warm and
concurrency evidence, followed by review. Do not use GC or snapshots to manufacture headroom.

The release remains subject to the image-worker activation hold, platform acceptance and the
corrected bot-manual deployment prerequisite.
