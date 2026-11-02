# Retained Photon ownership patch

This private application uses `photon-owned.wasm` with the exactly pinned
`@cf-wasm/photon/others` JavaScript wrapper. `src/photon-runtime.ts` initializes this module once;
do not import the wrapper's default or `/workerd` entry, which initializes its original binary.

The patch consumes decoded RGBA ownership and borrows crop/resize inputs instead of cloning
full images. Outputs retain independent ownership; codecs, pixel math, Lanczos3 filtering and
explicit `.free()` calls are preserved. Input and output limits have not been raised.

The accepted artifact is SHA256
`dd3badf24c0231a0b9b63272829d714c7d5feccccd9f2ebdd76c61b5fc6f1bd1` (the 2026-10-31 notice
rebuild; it replaces `f848bcd2a2794ef7dcea077ecdd3e4eaf06a2ace874a390d33800577968d2461` from
2026-10-28, and differs from it only in embedded panic-location line numbers).
`vendor-photon.test.ts` checks the artifact hash, the wrapper pin and the WASM ABI against the
installed wrapper artifact. It also checks every retained input (both source archives,
`ownership.patch`, `Cargo.lock`, `build.ps1`, the licenses and the evidence JSON) byte-for-byte
against `retention-manifest.json`, whose own hash it pins, and refuses an unrecorded file here.
Runtime parity and memory observations are separate evidence; these guards do not establish
Cloudflare production memory safety.

## Build inputs and proof

- `ownership.patch`, `source-unmodified.tar.gz` and `source-patched.tar.gz` retain the reviewed
  source change and both source baselines, derived from cf-wasm release
  `a7423d01eacc7ce20359ad0df202d0ce58cf0347`.
- `Cargo.lock`, `provenance.json` and `REBUILD.md` pin the reconstructed dependencies and build
  tools. The publisher's complete original lock is unavailable; the unmodified reconstruction
  is compared with the installed artifact before patch measurements.
- The WASM is a reconstruction. The upstream publisher's complete `Cargo.lock` and Binaryen
  version were never published, so the unmodified rebuild does not reproduce the stock
  `@cf-wasm/photon` binary, and the hash pin proves artifact identity, not upstream equivalence.
  The patched recipe is reproduced on Windows (`x86_64-pc-windows-msvc`) only, outside CI.
  Cross-platform rebuilds are unproven.
- `compact-exact-result.json` is the 2026-10-28 proof: a fresh source/target rebuild reproducing
  the previous artifact (`f848bcd2…`), reusing existing isolated tool binaries and registry cache.
  Earlier failed reconstruction attempts are in `compact-cleanroom-attempts.md`.
- `notice-rebuild-2026-10-31.json` is the proof of the current artifact. With freshly downloaded
  tools (archive hashes checked against `provenance.json`) and freshly downloaded locked crates, a
  control build of the unchanged 2026-10-28 source reproduced `f848bcd2…` and all four companion
  outputs. Two clean builds of the noticed source then both produced `dd3badf2…`.
- `LICENSE.md`, `licenses/` and `licenses.json` retain upstream license material and the
  dependency inventory. The inventory is an audit record rather than a legal conclusion.
- `retention-manifest.json` records the 280 retained inputs, original and retained hashes, and
  explicit metadata-path and LF normalization. Archives and WASM retain their original bytes.
  The three files the 2026-10-31 rebuild replaced keep their earlier hashes under
  `replaced.previous`. This current-context README, the local build-output ignores and the
  manifest itself are not part of those original retained inputs.

## Modification notice (Apache-2.0 section 4(b))

`source-patched.tar.gz` contains two files changed from photon-rs as shipped in cf-wasm release
`a7423d01eacc7ce20359ad0df202d0ce58cf0347` (Apache-2.0, `LICENSE.md`): `src/lib.rs`
(`PhotonImage::new_from_byteslice` takes ownership of the decoded RGBA buffer instead of copying
it) and `src/transform.rs` (crop and resize borrow the input pixels instead of cloning them).
XIV Dye Tools changed both on 2026-10-28. Since 2026-10-31 each file starts with a comment
stating that change; `ownership.patch` is the complete change, notices included.

## Rebuilding from this folder

Ordinary application builds use the checked-in artifact and require no Rust installation.

`REBUILD.md` is the retained prototype build log, kept byte-identical (its hash is in
`retention-manifest.json`), so it still names `f848bcd2…` as the final hash. Its references to
`artifacts/resize/`, `retention/`, `provenance.mjs`, `abi-compare.mjs`, `measure.mjs`,
`compare.mjs`, `frozen-app/` and the runtime-comparison commands are not vendored and cannot be
run here. Only its compact-retention recipe (REBUILD.md lines 59-80) applies.

`build.ps1` expects this layout under its tool root (`toolchain/` here by default, git-ignored):

- `rustup/` and `cargo/` homes holding toolchain `1.96.1-x86_64-pc-windows-msvc` with target
  `wasm32-unknown-unknown` (`rustup toolchain install 1.96.1-x86_64-pc-windows-msvc --profile
  minimal --target wasm32-unknown-unknown` with `RUSTUP_HOME`/`CARGO_HOME` set to them);
- `wasm-bindgen-0.2.126-x86_64-pc-windows-msvc/wasm-bindgen.exe`;
- `binaryen-version_123/bin/wasm-opt.exe`.

The download URLs are in REBUILD.md lines 29-33; the archive and binary hashes are in
`provenance.json` (`archives`, `tools`). Then, from this folder:

```powershell
./build.ps1 -Variant patched -Clean -ToolchainDirectory '<isolated-tool-root>'
```

The script extracts the retained source and writes a fresh result under `artifacts/patched/`.
Compare its SHA256 with the accepted artifact; it does not automatically replace that artifact.
Run it under PowerShell 7. Under Windows PowerShell 5.1, its `$ErrorActionPreference='Stop'`
turns cargo's redirected progress output into a terminating error; the 2026-10-31 rebuild used a
copy differing only in that line, as `notice-rebuild-2026-10-31.json` records.
Any source/tool/dependency or wrapper change requires new ABI, pixel/error parity, cold/warm and
concurrency evidence, followed by review. Do not use GC or snapshots to manufacture headroom.
The 2026-10-31 rebuild changed only line-number constants, but its memory, parity and
concurrency evidence is still owed: it must be re-measured on this artifact at image acceptance.

The release remains subject to the image-worker activation hold, platform acceptance and the
corrected bot-manual deployment prerequisite.
