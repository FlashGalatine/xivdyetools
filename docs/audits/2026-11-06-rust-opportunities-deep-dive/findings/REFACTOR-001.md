# REFACTOR-001 — Rust adoption needs an explicit runtime and public API boundary

**Priority P3, prerequisite for publication. Confidence high. Effort high. Risk high across consumers. Primary unit packages/core, secondary package/app consumers. Semver depends on compatibility.**

## Location

- `packages/core/package.json:8` exposes ESM subpaths and declarations, with Node support declared later in the manifest.
- `packages/core/src/services/PaletteService.ts:416` is a synchronous public API.
- `scripts/publish-packages.ts:243` participates in the controlled artifact publication path.

## Evidence

- Vite browsers, native Node ESM and Cloudflare require different loader tests. Current package scripts build TS, and the isolated publisher uses prebuilt artifacts. [Release review](../evidence/review-runtime-release.md)
- Mandatory initialization, sync-to-async changes, narrower inputs/platforms, or changed output contracts can require a major. An additive opt-in entry can preserve the existing contract.
- Core 6.0 and bot-logic 5.0 have separate deprecation prerequisites, and package-path merges can trigger consumer deployment before npm publication.
- 2026-11-07 addendum: a 25 KB raw-ABI comparison kernel compiled and instantiated in 0.24 ms (warm, repeated compiles). Loaders, publication and the browser CSP's missing WASM allowance dominate cost, and a private-app landing (OPT-002) defers them. [Comparison](../evidence/review-rust-comparison.md)

## Fix

- Keep a documented TypeScript facade and narrow internal or opt-in kernel boundary. Pin and test WASM, generated glue/types, ownership and runtime adapters together.
- Validate the packed tarball, supported Node floor, browser CSP/bundle and workerd startup. Schedule package publication and consumer adoption separately with verified workflow holds.

## Status

OPEN — compatibility and release design prerequisite for any adopted public kernel.
