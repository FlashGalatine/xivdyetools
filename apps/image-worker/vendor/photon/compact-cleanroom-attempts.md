# Compact recipe execution attempts

1. `compact-cleanroom/`: fresh compact-package copy. Sandbox denied creation of
   all four local tool-cache directory junctions with `Access is denied.` The
   script then could not invoke its expected `toolchain/.../cargo.exe` path.
   This is an environment/setup failure, not a Rust compiler result. The initial
   tool output records those errors; the attempt tree and preflight JSON remain.
2. `compact-cleanroom-host/`: fresh copy and normal-host junction creation.
   Cargo started but native build-script linking failed: rust-lld reported
   `The data area passed to a system call is too small.` The nested executable
   path exceeded the viable Windows process-launch path in this setup. Raw
   compiler diagnostics remain in `compact-cleanroom-host/logs/patched-cargo.log`.
3. `compact-fresh/`: fresh copy, no junctions, direct existing isolated tool/cache
   paths through `-ToolchainDirectory`. Source, target and outputs did not exist
   before this attempt (`compact-fresh-before.json`). Both source/tool prefixes
   were remapped, but the added tool remap used a forward slash where original
   panic-path strings contain a backslash. The build completed but produced
   SHA256 `95efe09f55e2bbaa9fcbed5c24d9d89e28969d85fbf3c5b00b15946927326191`.
   The hash assertion correctly failed (`logs/compact-fresh-hash-assertion.log`);
   source/tool hashes and the mismatch remain in `compact-fresh-result.json`.
4. `compact-exact/`: another fresh copy, no junctions or existing source/target/
   output directories. Same isolated tools/cache, corrected backslash tool remap.
   Full Rust compilation completed in 46.94 seconds; all 35 source files match;
   pre-opt SHA256 is `4bc8f98a9f099e72ef799a80ebf2b3eaed48d1d934ddd36da49ccbb0240fc5c6`;
   final SHA256 is `f848bcd2a2794ef7dcea077ecdd3e4eaf06a2ace874a390d33800577968d2461`.
   `verify-cleanroom.mjs compact-exact` exits 0. Receipt: `compact-exact-result.json`.

The original recipe defect was found by review before execution: `logs/` did not
exist in a fresh retained tree. `retention/build.ps1` now creates it before any
redirection. All four attempts use that correction. No global tools were installed.
