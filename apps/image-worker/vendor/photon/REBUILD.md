# Local Photon ownership prototype

The supported prototype is `artifacts/resize/photon_rs_bg.wasm`. Its source changes
are only `src/lib.rs` construction and `src/transform.rs` crop/resize inputs, shown
in `ownership.patch`. All source variants retain independently owned outputs and
the original decoder/resampling/crop operations. No product integration is made.

`retention/` is a compact candidate for coordinator review: both source archives,
the resolved Cargo.lock, minimal patch, WASM, source license, dependency license
inventory/files, tool and source hashes, ABI evidence and a standalone build script.
It omits tool binaries, build targets, synthetic fixtures and runtime persistence.

The original complete Cargo.lock and Binaryen version were not published. This
reconstruction locks known embedded versions (image 0.24.9, png 0.17.16,
jpeg-decoder 0.3.2, gif 0.13.3, wasm-bindgen 0.2.126) and all other resolved
dependencies. It uses Rust 1.96.1 and explicitly chosen Binaryen 123. It reproduces
its own two clean unmodified builds; it does not reproduce the installed hash.

## Tools (all homes must stay under this prototype)

Use the exact binaries/hashes in `provenance.json`. The already-provisioned local
tools are below `toolchain/`. On a fresh copy, set `RUSTUP_HOME` and `CARGO_HOME`
to its `toolchain/rustup` and `toolchain/cargo` before provisioning:

```powershell
rustup toolchain install 1.96.1 --profile minimal --target wasm32-unknown-unknown
```

Tool archives used:

- https://github.com/wasm-bindgen/wasm-bindgen/releases/download/0.2.126/wasm-bindgen-0.2.126-x86_64-pc-windows-msvc.tar.gz
- https://github.com/WebAssembly/binaryen/releases/download/version_123/binaryen-version_123-x86_64-windows.tar.gz
- https://codeload.github.com/fineshopdesign/cf-wasm/tar.gz/a7423d01eacc7ce20359ad0df202d0ce58cf0347

Extract tools below `toolchain/` with their archive directory names. The rustup
download completed the toolchain install but then returned an error looking for
rustup itself under the isolated Cargo home; direct toolchain binaries are used
by the build script. The original sandbox DNS failure and host retry are retained.
Host build scripts use Rust's bundled rust-lld to avoid MSVC link.exe long-path
failure. There is no global rustup default or registry/cache change.

## Rebuild in this full scratch directory

```powershell
./build.ps1 -Variant baseline -Clean
./build.ps1 -Variant baseline-repeat -Clean
./build.ps1 -Variant constructor -Clean
./build.ps1 -Variant crop -Clean
./build.ps1 -Variant resize -Clean
node ./provenance.mjs
node ./abi-compare.mjs
```

The script restores the chosen preserved source snapshot into `source/`, uses a
fresh target directory with `-Clean`, compiles Rust with `--locked --release
--target wasm32-unknown-unknown`, generates web glue with wasm-bindgen 0.2.126,
then applies `wasm-opt -O3 --enable-mutable-globals`. Default `enable_wasm` features
are unchanged. Absolute scratch prefixes are remapped to `/photon-prototype`.
In the compact retention directory, run `./build.ps1 -Variant unmodified` and
`./build.ps1 -Variant patched` after provisioning its isolated tools; the script
extracts the matching source archive and creates `logs/` before redirection.
To reuse this experiment's existing isolated tools/cache, supply
`-ToolchainDirectory <absolute-path-to-photon/toolchain>`. This also avoids nested
Windows linker executable path limits. Tool-cache and source paths are separately
remapped; the tool remap deliberately preserves the original Windows backslash
in `/photon-prototype\toolchain` so panic-path strings remain byte-identical.

The compact patched recipe was executed successfully in `compact-exact/`: its
source, target and outputs were absent before execution; source was extracted
only from the retained archive; compilation took 46.94 seconds into a fresh
target. Existing isolated tool binaries and Cargo registry source/download cache
were reused; no previous objects, targets or output WASM were used. All 35 source
files, pre-optimization WASM and final WASM match the original candidate exactly.
Final SHA256 is `f848bcd2a2794ef7dcea077ecdd3e4eaf06a2ace874a390d33800577968d2461`.
`compact-exact-result.json` records source/archive/tool hashes and the preflight;
`compact-cleanroom-attempts.md` preserves sandbox junction denial, nested linker
launch failure and the intermediate slash-remap hash mismatch. The successful
command was `./build.ps1 -Variant patched -Clean -ToolchainDirectory <existing-isolated-toolchain>`.
This proves the retained patched recipe with the recorded Windows tool/cache
set, not fresh-download installation or cross-platform reproducibility.

## Runtime comparisons in the full checkout

Use Node 22.21.0 and the frozen pnpm dependencies recorded in `measure.mjs`.
Measurements require normal-host loopback access here; sandbox health dispatch
failed. Keep other heavy gates idle during sampling. The script uses copied
`frozen-app/` sources and synthetic fixtures; it never imports the edited live app.

```powershell
node ./measure.mjs installed
node ./measure.mjs baseline
node ./compare.mjs installed baseline
node ./compare.mjs baseline baseline memory # expected RED, unchanged control
node ./measure.mjs resize
node ./measure.mjs resize --stock-glue
node ./compare.mjs baseline resize memory
node ./compare.mjs baseline resize-stock memory
node ./measure.mjs resize --cold-thumbnail
node ./measure.mjs resize --edges
```

Run each variant separately with `--phases` for stage capacity diagnostics or
`--edges` for the ten supplementary cases. Raw response hashes, errors, counters
and failures are in `runs/*/result.json`; comparisons and summary are additive
files in this directory. There is no forced GC or snapshot passing criterion.
Do not equate the checkpoint diagnostic sum with a continuous production peak.

Stock-glue mode imports installed `dist/others.js`, initializes exactly once with
`initPhoton.sync({module:customWasm})`, and uses the same instance's classes. It
does not import the auto-initializing `/workerd` entry point. All import/export
names, kinds and function signatures match; export ordering alone differs.

The smoke matrix is bounded, not exhaustive: no dedicated color-managed ICC,
EXIF-orientation, CMYK JPEG, animated GIF/WebP or cross-platform/toolchain run was
performed. A simple ancillary metadata PNG preserves alpha and produces identical
outputs to its no-metadata counterpart. Decoder scratch and imageops intermediate
allocations remain. Production activation/platform memory acceptance are held.
Retained license files and metadata form an audit inventory, not a legal conclusion.
