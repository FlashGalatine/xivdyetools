# Hardening adoption preparation implementation plan

> **For agentic workers:** use superpowers:subagent-driven-development, repository model routing and one writer per file. Execute the source preparation tasks; retain every separate publication and deployment boundary.

**Source preparation status:** implemented and locally verified; registry adoption and releases remain pending.

**Goal:** prepare and verify all fourteen H adoption sprints against H-LOGGER/H-AUTH, then commit, push and open draft PRs for review.

**Architecture:** keep internal `workspace:*` dependencies, which pnpm packs as exact versions. Verify real built tarballs and app consumers; correct only genuine context-as-error logger calls. Keep the parked Stoat adapter parked. Each unit has a separate review/release boundary.

**Tech stack:** TypeScript, Vitest, pnpm, Turborepo, Hono, Web Crypto.

**Spec:** [Required hardening adoption sprints](../../audits/2026-10-26-i18n/REMEDIATION_PLAN.md#required-hardening-adoption-sprints), security findings 042/044/047. Base: `9ff21e17ebad3a0fe5041bf31dfca9cd28864591`, PR #352.

## Global constraints

- Authorized here: source preparation, tests, commits, feature-branch pushes and draft PRs. No npm publication, manual worker deployment, main merge/push, policy/secret/activation change, or private XIVAuth report in Git.
- Logger 2.4.0, auth 3.0.0, core 5.16.0, worker-kit 1.6.0, SVG 4.4.1 and bot-logic 4.12.0 are unpublished at the live registry recheck. Fold changes into pending versions; do not invent additional releases. Refresh before shipping.
- Preserve signature v2 bytes/headers, canonical issuer output, sessions, default logging configuration, rate-limit settings and existing A-sprint holds. No unrelated major removals or translation changes. Feature pushes may run the repository's existing automatic beta workflows.
- Coordinator owns Git, versions, changelogs, audit statuses, release evidence and outward prose. Workers own only assigned runtime/test files; scratch artifact harness is separate. No shared-file writers.
- A source or local tarball pass is not registry adoption. Every package waits for its upstream registry versions; every app waits for its selected upstream releases. Private test-utils and parked Stoat have no publication/deployment.
- Preserve test assertions, thresholds and timeouts. Capture red-first and mutation evidence for behavior fixes, and artifact negative controls for dependency/version checks. Run the whole graph serially.

## Review focus

- Stale packed exact dependencies can retain old logger even when workspace tests pass: inspect real tarballs and use isolated consumer imports.
- Custom logger signatures differ: preserve intentional two-argument contracts, especially retention-job; verify real output for corrected callers.
- Canonical auth enforcement must accept existing issuance and reject equivalent encoding aliases at public app boundaries.
- Error/context moves must retain safe diagnostic fields while removing secret values; direct callable/errorTracker limitations remain unchanged.
- Stoat custom logging must keep its original options/filters and stay parked; no deploy workflow or flag changes.

## Tasks and release boundaries

Every task includes its owning unit's instructions, scoped gate and an additive dated evidence record. Package-only adoption requires no runtime change if real packing already produces the required pins. No empty runtime refactor is required. Coordinator adds release notes to the pending version and opens a separate draft PR for each meaningful unit change; verification-only units may share a docs-only evidence PR.

1. [x] **H-CORE-ADOPT** — verify core 5.16.0 packs logger 2.4.0; smoke public exports and packaged locale data. Repair the missing JSON import attributes in CharacterColorService and chara-shader-colors revealed by vanilla Node artifact tests, retaining eager/lazy loading. Publish only after logger.
2. [x] **H-WORKER-KIT-ADOPT** — verify worker-kit 1.6.0 packs logger 2.4.0; Hono middleware real redacted output and optional-peer subpaths. Publish only after logger.
3. [x] **H-SVG-ADOPT** — verify SVG 4.4.1 packs core 5.16.0 and generates a real card. Publish only after core.
4. [x] **H-BOT-LOGIC-ADOPT** — verify bot-logic 4.12.0 packs core 5.16.0/SVG 4.4.1 and executes localized comparison. Repair the six missing JSON import attributes in the bot UI translator exposed by native artifact imports; locale text remains unchanged. Publish only after core/SVG.
5. [x] **H-TEST-UTILS** — verify private producer with hardened auth; no npm release. Post-publication recheck remains.
6. [x] **H-API** — verify core/worker-kit/logger closure and application gate; no unrelated activation.
7. [x] **H-PRESETS** — correct genuine context-as-error calls in handlers/presets and moderation-service, retaining the retention-job custom signature; meaningful output/dispatch tests.
8. [x] **H-OAUTH** — verify canonical signing round trips and rejection of encoding aliases through the existing delegated verifier; remove stale permissiveness comment. Preserve issuer/session protocol.
9. [x] **H-IMAGE** — verify worker-kit/logger closure and binding-only app gate; preserve A-IMAGE memory and prototype controls.
10. [x] **H-OG** — verify core/SVG/worker-kit/logger closure and card/font gates; no new font/string/cache change solely for logging.
11. [x] **H-DISCORD** — correct genuine context-as-error calls in index.ts and test actual logger argument/output behavior; verify all adopted dependencies.
12. [x] **H-MODERATION** — correct genuine context-as-error calls in index.ts and test real context output; verify auth/bot-logic/logger/worker-kit.
13. [x] **H-WEB** — verify core/SVG/logger closure, full app gate and bundle budget; no UI/copy changes or errorTracker field-traversal claim.
14. [x] **H-STOAT** — correct index/message-handler context calls and mirror token-path sanitization in its custom logger only as required; meaningful output tests. Parked verification only.

## Verification and handoff

- Build and pack the actual public closure without publishing. Verify exact internal pins using the reviewed publisher validator, then exercise installed/extracted real package exports with synthetic inputs in an isolated consumer.
- Unit/dependent gates as specified in the remediation table; stable final `pnpm turbo run build type-check lint test --force --concurrency=1`, root scripts/type/dead-code/docs/worker-log checks and web bundle budget. No redundant concurrent whole graphs.
- Independent task regression/spec review, then Astra final review for authentication/redaction boundaries. Fix only assigned files and record exact reruns.
- One unit per release commit/PR where source or release metadata changes; no merged/deployed/published claims. Preserve all previous finding statuses as PARTIAL until real registry adoption and deployment.
