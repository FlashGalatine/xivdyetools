param([string]$Variant='patched',[switch]$Clean,[string]$ToolchainDirectory)
$ErrorActionPreference='Stop'
$base=$PSScriptRoot
New-Item -ItemType Directory -Force (Join-Path $base 'logs') | Out-Null
if($Variant -notin @("unmodified","patched")){throw "Unknown variant"}
New-Item -ItemType Directory -Force (Join-Path $base "source") | Out-Null
tar -xzf (Join-Path $base "source-$Variant.tar.gz") -C (Join-Path $base "source")
if($LASTEXITCODE){throw "Source extraction failed"}
$toolBase=if($ToolchainDirectory){[IO.Path]::GetFullPath($ToolchainDirectory)}else{Join-Path $base 'toolchain'}
$env:RUSTUP_HOME=Join-Path $toolBase 'rustup'
$env:CARGO_HOME=Join-Path $toolBase 'cargo'
$tool=Join-Path $env:RUSTUP_HOME 'toolchains/1.96.1-x86_64-pc-windows-msvc/bin'
$env:RUSTC=Join-Path $tool 'rustc.exe'
$env:RUSTDOC=Join-Path $tool 'rustdoc.exe'
$env:CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER=Join-Path $env:RUSTUP_HOME 'toolchains/1.96.1-x86_64-pc-windows-msvc/lib/rustlib/x86_64-pc-windows-msvc/bin/rust-lld.exe'
$env:CARGO_TARGET_DIR=Join-Path $base "target-$Variant"
$env:RUSTFLAGS="--remap-path-prefix=$base=/photon-prototype --remap-path-prefix=$toolBase=/photon-prototype\toolchain"
$out=Join-Path $base "artifacts/$Variant"
New-Item -ItemType Directory -Force $out | Out-Null
if($Clean -and (Test-Path $env:CARGO_TARGET_DIR)) {
  $resolved=(Resolve-Path $env:CARGO_TARGET_DIR).Path
  if(!$resolved.StartsWith($base+[IO.Path]::DirectorySeparatorChar)){throw 'Target outside prototype'}
  Remove-Item -LiteralPath $resolved -Recurse -Force
}
& (Join-Path $tool 'cargo.exe') build --manifest-path (Join-Path $base 'source/Cargo.toml') --locked --target wasm32-unknown-unknown --release *> (Join-Path $base "logs/$Variant-cargo.log")
if($LASTEXITCODE){throw "cargo failed: $LASTEXITCODE"}
& (Join-Path $toolBase 'wasm-bindgen-0.2.126-x86_64-pc-windows-msvc/wasm-bindgen.exe') (Join-Path $env:CARGO_TARGET_DIR 'wasm32-unknown-unknown/release/photon_rs.wasm') --out-dir $out --out-name photon_rs --target web *> (Join-Path $base "logs/$Variant-bindgen.log")
if($LASTEXITCODE){throw "bindgen failed: $LASTEXITCODE"}
Copy-Item (Join-Path $out 'photon_rs_bg.wasm') (Join-Path $out 'pre-opt.wasm')
& (Join-Path $toolBase 'binaryen-version_123/bin/wasm-opt.exe') (Join-Path $out 'pre-opt.wasm') -o (Join-Path $out 'photon_rs_bg.wasm') -O3 --enable-mutable-globals *> (Join-Path $base "logs/$Variant-opt.log")
if($LASTEXITCODE){throw "wasm-opt failed: $LASTEXITCODE"}
Get-FileHash (Join-Path $out '*') -Algorithm SHA256 | Format-Table -AutoSize
