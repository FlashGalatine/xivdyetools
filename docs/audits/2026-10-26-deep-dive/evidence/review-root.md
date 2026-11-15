# Coordinator review — web character-import and glamour surfaces

Snapshot: `6da3ff5b047188e6f8c08be2ea47f99f02e7a8d1`; complete source reads in `read-files-root.txt`. Related tests and core GPOSERS code read as needed. Runtime protocol is assigned to the services reviewer.

Candidate: `web-root-001`, old export sheet opens after a file is cleared. The archived Vitest probe imports the unchanged application source and asserts the defective result. Run `powershell -NoProfile -ExecutionPolicy Bypass -File docs/audits/2026-10-26-deep-dive/evidence/scripts/run-repro.ps1` from the repository root; its temporary app-local harness is removed afterward.

Positive controls: file size checked both before and after the bounded read; a later load wins; SWAP cancels inspection; worker replies validate identity and shape; settled workers terminate; unresolved gear keeps slot/dye facts; export actions wait for name resolution; GPOSERS English labels are intentional; rich clipboard starts inside the click; sheet focus trap and teardown are explicit; twin picks survive navigation with the session.

Rejected suspicions: export sheet opening before name resolution (buttons disabled); female Robe test using the wrong gender enum (facade normalizes to Male/Female); web collapsing differing right-eye colors (web renders each slot independently); JSON strings treated as HTML (DOM text sinks/escaping); cache version omitted from icon requests (explicit compatibility contract and dead-code catalog coverage).

Related evidence: `repro-web.txt`. The original attempt to run the archived test directly from docs failed because Vitest is a workspace-local dependency. An early PowerShell wrapper used Stop for native stderr and was interrupted; the final runner preserves native exit codes with Continue, passes, and leaves no scratch source files. These harness failures are not project failures.

## Root tooling read
All six non-test TypeScript root scripts were read; long reachability-script comments were elided in later slices. The script inventory excludes tests and JSON config. Conservative source-mask fallback and public/testonly/entrypoint separation are deliberate; no removal verdict was inferred from textual reachability alone. Living-link validation uses exact tracked paths; archived docs require a separate link check. Coverage report baselines are advisory and differ from per-unit gates. No new tooling defect filed.

## Environment diagnosis
Fresh coverage hit Windows sandbox EPERM at core scripts/stain-audit/output.test.ts:174 before the symlink assertion. The narrow sandbox retry reproduced the setup error; the same file outside the sandbox passed 15/15. No test/source was changed. See core-symlink-recheck.txt and core-symlink-unsandboxed.txt. Remaining unit coverage is collected separately.
